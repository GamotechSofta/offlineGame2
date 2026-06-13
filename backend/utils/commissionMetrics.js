import mongoose from 'mongoose';
import Bet from '../models/bet/bet.js';
import QuizBet from '../models/quiz/QuizBet.js';
import User from '../models/user/user.js';
import Admin from '../models/admin/admin.js';
import CommissionPayment from '../models/commission/commissionPayment.js';
import BookieWalletTransaction from '../models/bookieWalletTransaction/bookieWalletTransaction.js';
import { getBookieUserIds, getCommissionOperatorIds } from './bookieFilter.js';
import { buildIstDateFilter } from './istDateRange.js';
import { ADVANCE_COMMISSION_WALLET_TYPES } from './advanceCommissionTransfer.js';
import { isFromAdminWalletTx, ADVANCE_PAID_INITIAL_WALLET_TYPES } from './bookieWalletLedger.js';

export const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

/** Commission earned = bet volume × commission rate (%). */
export function calculateCommissionAmount(totalBetAmount, commissionPercentage) {
    return round2((Number(totalBetAmount || 0) * Number(commissionPercentage || 0)) / 100);
}

/** Admin share on Bookie (sub) commission only — bookieCommission × rate (%). */
export function calculateAdminCommissionAmount(bookieCommissionAmount, adminCommissionPercentage) {
    return calculateCommissionAmount(bookieCommissionAmount, adminCommissionPercentage);
}

/**
 * Total admin commission from a SuperBookie:
 * - Direct player bets × rate → full direct commission to admin
 * - Bookie commission × rate → admin share on bookie part only
 */
export function calculateSuperBookieAdminCommissionTotal(
    directCommission,
    subCommission,
    adminCommissionPercentage,
) {
    const fromDirect = round2(directCommission);
    const fromSub = calculateAdminCommissionAmount(subCommission, adminCommissionPercentage);
    return round2(fromDirect + fromSub);
}

/** Parent SuperBookie account for a sub Bookie (role super_bookie). */
export async function getParentSuperBookieAccount(superBookieAdmin) {
    let parentId = superBookieAdmin?.parentBookieId;
    if (!parentId && superBookieAdmin?._id) {
        const fresh = await Admin.findById(superBookieAdmin._id).select('parentBookieId').lean();
        parentId = fresh?.parentBookieId;
    }
    if (!parentId) return null;
    const resolvedId = parentId._id ?? parentId;
    return Admin.findById(resolvedId)
        .select('username commissionPercentage adminCommissionPercentage role')
        .lean();
}

/** Bet commission rate on this account (sub Bookie rate is set by SuperBookie). */
export async function getEffectiveCommissionPercentage(admin) {
    if (admin?.commissionPercentage != null && admin?.role === 'super_bookie') {
        return Number(admin.commissionPercentage || 0);
    }
    if (admin?.role === 'super_bookie' && admin?._id) {
        const fresh = await Admin.findById(admin._id).select('commissionPercentage').lean();
        return Number(fresh?.commissionPercentage || 0);
    }
    return Number(admin?.commissionPercentage || 0);
}

/** All non-cancelled player bets count toward commission (including bookie/super-bookie placed bets). */
const commissionMatkaMatch = {
    status: { $ne: 'cancelled' },
};

/** IST business-day bounds — aligned with GET /dashboard/stats date ranges. */
export const buildCommissionDateFilter = (startDate, endDate) => buildIstDateFilter(startDate, endDate);

/**
 * Matka + lottery bet metrics for commission (player bets only on matka).
 */
export async function aggregatePlayerBetMetrics({ userIds, admin, dateFilter = {}, directOnly = false }) {
    let scope = null;
    if (admin) {
        scope = await getCommissionScopeMatch(admin, { directOnly });
    } else if (Array.isArray(userIds) && userIds.length > 0) {
        scope = { userId: { $in: userIds } };
    }

    if (!scope) {
        return {
            totalBetAmount: 0,
            matkaBetAmount: 0,
            lotteryBetAmount: 0,
            totalPayouts: 0,
            totalBets: 0,
            winningBets: 0,
            losingBets: 0,
        };
    }

    const matkaMatch = {
        ...dateFilter,
        ...commissionMatkaMatch,
        ...scope,
    };
    const quizMatch = {
        ...dateFilter,
        status: { $ne: 'cancelled' },
        ...scope,
    };

    const [
        matkaAgg,
        matkaPayoutAgg,
        quizAgg,
        quizPayoutAgg,
        matkaWins,
        matkaLosses,
        quizWins,
        quizLosses,
    ] = await Promise.all([
        Bet.aggregate([
            { $match: matkaMatch },
            { $group: { _id: null, totalAmount: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
        Bet.aggregate([
            { $match: { ...matkaMatch, status: 'won' } },
            { $group: { _id: null, totalPayout: { $sum: '$payout' } } },
        ]),
        QuizBet.aggregate([
            { $match: quizMatch },
            { $group: { _id: null, totalAmount: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
        QuizBet.aggregate([
            { $match: { ...quizMatch, status: 'win' } },
            { $group: { _id: null, totalPayout: { $sum: '$winPayout' } } },
        ]),
        Bet.countDocuments({ ...matkaMatch, status: 'won' }),
        Bet.countDocuments({ ...matkaMatch, status: 'lost' }),
        QuizBet.countDocuments({ ...quizMatch, status: 'win' }),
        QuizBet.countDocuments({ ...quizMatch, status: 'lose' }),
    ]);

    return {
        totalBetAmount: round2(
            Number(matkaAgg?.[0]?.totalAmount || 0) + Number(quizAgg?.[0]?.totalAmount || 0)
        ),
        matkaBetAmount: round2(matkaAgg?.[0]?.totalAmount || 0),
        lotteryBetAmount: round2(quizAgg?.[0]?.totalAmount || 0),
        totalPayouts: round2(
            Number(matkaPayoutAgg?.[0]?.totalPayout || 0) + Number(quizPayoutAgg?.[0]?.totalPayout || 0)
        ),
        totalBets: Number(matkaAgg?.[0]?.count || 0) + Number(quizAgg?.[0]?.count || 0),
        winningBets: Number(matkaWins || 0) + Number(quizWins || 0),
        losingBets: Number(matkaLosses || 0) + Number(quizLosses || 0),
    };
}

/**
 * $or match: players in downline OR bets placed by this operator (bookie panel).
 */
export async function getCommissionScopeMatch(admin, options = {}) {
    const userIds = (await getBookieUserIds(admin, options)) || [];
    const operatorIds = await getCommissionOperatorIds(admin, options);
    const clauses = [];
    if (userIds.length) clauses.push({ userId: { $in: userIds } });
    if (operatorIds.length) clauses.push({ placedByBookieId: { $in: operatorIds } });
    if (!clauses.length) return null;
    return clauses.length === 1 ? clauses[0] : { $or: clauses };
}

/**
 * Bet volume for commission (matka + lottery), optional date filter.
 * @param {{ directOnly?: boolean }} options — SuperBookie: direct players only when true.
 */
export async function getCommissionBetVolume(admin, dateFilter = {}, options = {}) {
    const scope = await getCommissionScopeMatch(admin, options);
    if (!scope) {
        return { totalBetAmount: 0, matkaBetAmount: 0, lotteryBetAmount: 0, betCount: 0 };
    }

    const matkaMatch = { ...dateFilter, ...commissionMatkaMatch, ...scope };
    const quizMatch = { ...dateFilter, status: { $ne: 'cancelled' }, ...scope };

    const [matkaAgg, lotteryAgg, matkaCount, quizCount] = await Promise.all([
        Bet.aggregate([
            { $match: matkaMatch },
            { $group: { _id: null, totalAmount: { $sum: '$amount' } } },
        ]),
        QuizBet.aggregate([
            { $match: quizMatch },
            { $group: { _id: null, totalAmount: { $sum: '$amount' } } },
        ]),
        Bet.countDocuments(matkaMatch),
        QuizBet.countDocuments(quizMatch),
    ]);

    const matkaBetAmount = round2(matkaAgg?.[0]?.totalAmount || 0);
    const lotteryBetAmount = round2(lotteryAgg?.[0]?.totalAmount || 0);
    return {
        totalBetAmount: round2(matkaBetAmount + lotteryBetAmount),
        matkaBetAmount,
        lotteryBetAmount,
        betCount: Number(matkaCount || 0) + Number(quizCount || 0),
    };
}

/** Admin panel: settled admin share vs gross SuperBookie commission. */
export function computeAdminShareSettlement(settlementPaidTotal, adminCommissionAmount) {
    const cap = round2(Number(adminCommissionAmount || 0));
    if (cap <= 0) {
        return { adminPaid: 0, adminPending: 0 };
    }
    const settledTotal = round2(Number(settlementPaidTotal || 0));
    const adminPaid = round2(Math.min(settledTotal, cap));
    const adminPending = round2(Math.max(0, cap - adminPaid));
    return { adminPaid, adminPending };
}

export async function getAdminShareSettlementForBookie(bookieId, adminCommissionAmount) {
    const payments = await CommissionPayment.find({ bookieId })
        .select('amount paymentType notes')
        .lean();
    const settledTotal = round2(
        payments
            .filter((p) => getCommissionPaymentKind(p) === 'settlement')
            .reduce((sum, p) => sum + Number(p.amount || 0), 0),
    );
    return computeAdminShareSettlement(settledTotal, adminCommissionAmount);
}

const toOperatorObjectId = (id) => {
    if (id instanceof mongoose.Types.ObjectId) return id;
    if (mongoose.Types.ObjectId.isValid(String(id))) {
        return new mongoose.Types.ObjectId(String(id));
    }
    return id;
};

/**
 * Matka + lottery bet volume grouped by attributed operator (parent or sub bookie).
 * Single pass for admin commission list instead of per-account aggregations.
 */
async function aggregateOperatorBetVolumes(operatorIds) {
    const volumeMap = {};
    if (!operatorIds?.length) return volumeMap;

    const operatorObjectIds = operatorIds.map(toOperatorObjectId);
    const operatorIdSet = new Set(operatorObjectIds.map(String));

    const addRow = (id, amount, count) => {
        const key = String(id);
        if (!operatorIdSet.has(key)) return;
        if (!volumeMap[key]) volumeMap[key] = { totalAmount: 0, betCount: 0 };
        volumeMap[key].totalAmount = round2(volumeMap[key].totalAmount + Number(amount || 0));
        volumeMap[key].betCount += Number(count || 0);
    };

    const userRows = await User.find({ referredBy: { $in: operatorObjectIds } })
        .select('_id')
        .lean();
    const allUserIds = userRows.map((u) => u._id);

    const orClauses = [{ placedByBookieId: { $in: operatorObjectIds } }];
    if (allUserIds.length) orClauses.unshift({ userId: { $in: allUserIds } });

    const matkaMatch = {
        status: { $ne: 'cancelled' },
        $or: orClauses,
    };

    const userLookup = {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: '_user',
        pipeline: [{ $project: { referredBy: 1 } }],
    };

    const [matkaGroups, quizGroups] = await Promise.all([
        Bet.aggregate([
            { $match: matkaMatch },
            { $lookup: userLookup },
            {
                $addFields: {
                    _attr: {
                        $cond: {
                            if: { $in: ['$placedByBookieId', operatorObjectIds] },
                            then: '$placedByBookieId',
                            else: { $arrayElemAt: ['$_user.referredBy', 0] },
                        },
                    },
                },
            },
            { $match: { _attr: { $in: operatorObjectIds } } },
            {
                $group: {
                    _id: '$_attr',
                    totalAmount: { $sum: '$amount' },
                    count: { $sum: 1 },
                },
            },
        ]),
        allUserIds.length
            ? QuizBet.aggregate([
                  { $match: { status: { $ne: 'cancelled' }, userId: { $in: allUserIds } } },
                  { $lookup: userLookup },
                  {
                      $addFields: {
                          _attr: { $arrayElemAt: ['$_user.referredBy', 0] },
                      },
                  },
                  { $match: { _attr: { $in: operatorObjectIds } } },
                  {
                      $group: {
                          _id: '$_attr',
                          totalAmount: { $sum: '$amount' },
                          count: { $sum: 1 },
                      },
                  },
              ])
            : Promise.resolve([]),
    ]);

    for (const row of [...matkaGroups, ...quizGroups]) {
        addRow(row._id, row.totalAmount, row.count);
    }

    return volumeMap;
}

/**
 * Batched rows for GET /daily-commission/all-summary (admin SuperBookie commissions).
 */
export async function buildAdminAllCommissionSummaryRows(parentBookies, subBookies) {
    const parentIds = parentBookies.map((b) => b._id);
    const allOperatorIds = [...parentIds, ...subBookies.map((sb) => sb._id)];
    const allOperatorObjectIds = allOperatorIds.map(toOperatorObjectId);

    const [volumeMap, playerCountAgg, payments] = await Promise.all([
        aggregateOperatorBetVolumes(allOperatorIds),
        User.aggregate([
            { $match: { referredBy: { $in: allOperatorObjectIds } } },
            { $group: { _id: '$referredBy', count: { $sum: 1 } } },
        ]),
        CommissionPayment.find({ bookieId: { $in: allOperatorObjectIds } })
            .select('bookieId amount paymentType notes createdAt')
            .lean(),
    ]);

    const playerCountMap = Object.fromEntries(
        playerCountAgg.map((row) => [String(row._id), row.count]),
    );

    const settlementPaidMap = {};
    const lastPaidMap = {};
    for (const payment of payments) {
        const key = String(payment.bookieId);
        if (getCommissionPaymentKind(payment) === 'settlement') {
            settlementPaidMap[key] = round2(
                (settlementPaidMap[key] || 0) + Number(payment.amount || 0),
            );
        }
        if (payment.createdAt) {
            const ts = new Date(payment.createdAt).getTime();
            if (!lastPaidMap[key] || ts > new Date(lastPaidMap[key]).getTime()) {
                lastPaidMap[key] = payment.createdAt;
            }
        }
    }

    const subsByParent = {};
    const parentUsernameMap = Object.fromEntries(
        parentBookies.map((b) => [String(b._id), b.username || '']),
    );
    for (const sb of subBookies) {
        const parentId = String(sb.parentBookieId?._id ?? sb.parentBookieId ?? '');
        if (!subsByParent[parentId]) subsByParent[parentId] = [];
        subsByParent[parentId].push(sb);
    }

    const normalized = [];

    for (const bookie of parentBookies) {
        const bookieId = String(bookie._id);
        const directVol = volumeMap[bookieId] || { totalAmount: 0, betCount: 0 };
        const adminRate = Number(bookie.commissionPercentage || 0);
        const directBetAmount = round2(directVol.totalAmount);
        const directCommission = calculateCommissionAmount(directBetAmount, adminRate);

        let subBetAmount = 0;
        let subCommission = 0;
        let subBetCount = 0;
        let hierarchyPlayerCount = playerCountMap[bookieId] || 0;

        for (const sub of subsByParent[bookieId] || []) {
            const subKey = String(sub._id);
            const subVol = volumeMap[subKey] || { totalAmount: 0, betCount: 0 };
            const subRate = Number(sub.commissionPercentage || 0);
            subBetAmount = round2(subBetAmount + subVol.totalAmount);
            subCommission = round2(subCommission + calculateCommissionAmount(subVol.totalAmount, subRate));
            subBetCount += subVol.betCount;
            hierarchyPlayerCount += playerCountMap[subKey] || 0;
        }

        const totalBetAmount = round2(directBetAmount + subBetAmount);
        const totalCommission = round2(directCommission + subCommission);
        const adminCommissionPercentage = Number(
            bookie.adminCommissionPercentage ?? bookie.commissionPercentage ?? 10,
        );
        const adminCommissionFromDirect = round2(directCommission);
        const adminCommissionFromSub = calculateAdminCommissionAmount(
            subCommission,
            adminCommissionPercentage,
        );
        const adminCommissionAmount = calculateSuperBookieAdminCommissionTotal(
            directCommission,
            subCommission,
            adminCommissionPercentage,
        );
        const { adminPaid, adminPending } = computeAdminShareSettlement(
            settlementPaidMap[bookieId] || 0,
            adminCommissionAmount,
        );

        normalized.push({
            bookieId: bookie._id,
            username: bookie.username || 'Unknown',
            phone: bookie.phone || '',
            role: bookie.role,
            accountLabel: 'parent',
            parentBookieUsername: '',
            commissionPercentage: adminRate,
            adminCommissionPercentage,
            adminCommissionFromDirect,
            adminCommissionFromSub,
            adminCommissionAmount,
            adminCommissionPaid: adminPaid,
            adminCommissionPending: adminPending,
            netCommissionAfterAdmin: round2(Math.max(0, subCommission - adminCommissionFromSub)),
            directCommission,
            subCommission,
            playerCount: hierarchyPlayerCount,
            betCount: directVol.betCount + subBetCount,
            totalBetAmount,
            totalCommission,
            totalPaid: adminPaid,
            totalPending: adminPending,
            paymentStatus: getAdminSharePaymentStatus(adminCommissionAmount, adminPaid),
            lastPaidAt: lastPaidMap[bookieId] || null,
        });
    }

    for (const sb of subBookies) {
        const subKey = String(sb._id);
        const subVol = volumeMap[subKey] || { totalAmount: 0, betCount: 0 };
        const parentCommissionPercentage = Number(sb.commissionPercentage || 0);
        const parentId = String(sb.parentBookieId?._id ?? sb.parentBookieId ?? '');

        normalized.push({
            bookieId: sb._id,
            username: sb.username || 'Unknown',
            phone: sb.phone || '',
            role: sb.role,
            accountLabel: 'sub',
            parentBookieUsername: sb.parentBookieId?.username || parentUsernameMap[parentId] || '',
            commissionPercentage: 0,
            parentCommissionPercentage,
            parentCommissionAmount: calculateCommissionAmount(subVol.totalAmount, parentCommissionPercentage),
            playerCount: playerCountMap[subKey] || 0,
            betCount: subVol.betCount,
            totalBetAmount: subVol.totalAmount,
            totalCommission: 0,
            totalPaid: 0,
            totalPending: 0,
            paymentStatus: 'none',
            lastPaidAt: lastPaidMap[subKey] || null,
        });
    }

    normalized.sort((a, b) => {
        if (b.totalPending !== a.totalPending) return b.totalPending - a.totalPending;
        return String(a.username).localeCompare(String(b.username));
    });

    return normalized;
}

export function getAdminSharePaymentStatus(adminCommissionAmount, adminPaid) {
    const total = round2(Number(adminCommissionAmount || 0));
    const paid = round2(Number(adminPaid || 0));
    if (total <= 0) return 'none';
    if (paid >= total) return 'paid';
    if (paid > 0) return 'partial';
    return 'pending';
}

/** Classify legacy rows without paymentType. */
export function getCommissionPaymentKind(payment) {
    if (payment?.paymentType === 'settlement') return 'settlement';
    if (payment?.paymentType === 'recovery') return 'recovery';
    if (payment?.paymentType === 'advance') return 'advance';
    const notes = String(payment?.notes || '');
    if (/commission settlement/i.test(notes)) return 'settlement';
    if (/advance recovery|applied to advance|recovering advance/i.test(notes)) return 'recovery';
    if (/initial balance|advance commission/i.test(notes)) return 'advance';
    return 'settlement';
}

export async function getRecoveryRecordedForAccount(adminId) {
    const payments = await CommissionPayment.find({ bookieId: adminId })
        .select('amount paymentType notes')
        .lean();
    return round2(
        payments
            .filter((p) => getCommissionPaymentKind(p) === 'recovery')
            .reduce((sum, p) => sum + Number(p.amount || 0), 0)
    );
}

export const SETTLEMENT_PAID_WITH_ADVANCE_TAG = 'paid with advance';

export function isSettlementPaidWithAdvance(payment) {
    if (!payment || getCommissionPaymentKind(payment) !== 'settlement') return false;
    return /paid with advance/i.test(String(payment.notes || ''));
}

/** Total commission already settled using "paid with advance". */
export async function getSettlementsPaidWithAdvanceTotal(adminId) {
    const payments = await CommissionPayment.find({ bookieId: adminId })
        .select('amount paymentType notes')
        .lean();
    return round2(
        payments
            .filter((p) => isSettlementPaidWithAdvance(p))
            .reduce((sum, p) => sum + Number(p.amount || 0), 0),
    );
}

/** Max amount parent can settle via "paid with advance" for this super bookie. */
export async function getAdvanceAvailableForSettlement(admin) {
    const summary = await getCommissionSummaryForAccount(admin);
    const advancePaidInitial = await getAdvancePaidInitialFromBookieForAccount(admin._id);
    const usedFromAdvance = await getSettlementsPaidWithAdvanceTotal(admin._id);
    const poolFromInitial = round2(Math.max(0, advancePaidInitial - usedFromAdvance));
    const recoverable = round2(Number(summary.advanceOutstanding || 0));
    return round2(Math.max(poolFromInitial, recoverable));
}

/**
 * Child super bookie: advance / initial from parent bookie minus settlements paid with advance.
 * Used for wallet "From bookie — Remaining" (not paid-with-other wallet debits).
 */
export async function getSuperBookieAdvancePoolFromBookie(adminId) {
    const [advancePaidInitial, recoverableAdvance, settledFromAdvance] = await Promise.all([
        getAdvancePaidInitialFromBookieForAccount(adminId),
        getAdvanceCommissionPaidForAccount(adminId),
        getSettlementsPaidWithAdvanceTotal(adminId),
    ]);
    const gross = round2(advancePaidInitial + recoverableAdvance);
    const settled = settledFromAdvance;
    const remaining = round2(Math.max(0, gross - settled));
    return {
        gross,
        settled,
        remaining,
        advancePaidInitial,
        recoverableAdvance,
    };
}

/** Sum of advance-paid initial balance credits from parent bookie (no bet recovery). */
export async function getAdvancePaidInitialFromBookieForAccount(adminId) {
    const walletAgg = await BookieWalletTransaction.aggregate([
        {
            $match: {
                adminId,
                direction: 'credit',
                type: { $in: ADVANCE_PAID_INITIAL_WALLET_TYPES },
            },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return round2(walletAgg?.[0]?.total || 0);
}

export async function getAdvanceCommissionPaidForAccount(adminId) {
    const id = adminId;
    const [walletAgg, payments] = await Promise.all([
        BookieWalletTransaction.aggregate([
            {
                $match: {
                    adminId: id,
                    direction: 'credit',
                    type: { $in: ADVANCE_COMMISSION_WALLET_TYPES },
                },
            },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        CommissionPayment.find({ bookieId: id }).select('amount paymentType notes').lean(),
    ]);
    const walletTotal = round2(walletAgg?.[0]?.total || 0);
    const advanceFromPayments = round2(
        payments
            .filter((p) => getCommissionPaymentKind(p) === 'advance')
            .reduce((sum, p) => sum + Number(p.amount || 0), 0)
    );
    return round2(Math.max(walletTotal, advanceFromPayments));
}

/** Parent bookie: advance / initial balance credited by super admin only. */
export async function getAdvanceFromAdminForBookie(bookieId) {
    const id = bookieId;
    const [fresh, txs, payments] = await Promise.all([
        Admin.findById(id).select('balance role').lean(),
        BookieWalletTransaction.find({ adminId: id })
            .select('type direction amount description')
            .lean(),
        CommissionPayment.find({ bookieId: id }).select('amount paymentType notes').lean(),
    ]);
    if (!fresh || fresh.role !== 'bookie') return 0;

    let adminCredits = 0;
    let ledgerCredit = 0;
    let ledgerDebit = 0;
    for (const tx of txs) {
        const amt = Number(tx.amount || 0);
        if (tx.direction === 'credit') ledgerCredit += amt;
        else ledgerDebit += amt;
        if (isFromAdminWalletTx(tx)) adminCredits += amt;
    }
    const ledgerNet = round2(ledgerCredit - ledgerDebit);
    const balance = Number(fresh.balance ?? 0);
    const untrackedGap = round2(Math.max(0, balance - ledgerNet));
    const fromLedger = round2(adminCredits + untrackedGap);
    const advanceFromPayments = round2(
        payments
            .filter((p) => getCommissionPaymentKind(p) === 'advance')
            .reduce((sum, p) => sum + Number(p.amount || 0), 0),
    );
    return round2(Math.max(fromLedger, advanceFromPayments));
}

/**
 * SuperBookie gross commission (before admin share):
 * - Direct players: bets × commission % set by admin on SuperBookie
 * - Sub Bookies: each sub's player bets × commission % set by SuperBookie on that sub
 * Admin total = direct commission (100% to admin) + sub commission × adminCommissionPercentage.
 * SuperBookie net = sub commission − admin share on sub (keeps nothing from direct commission).
 */
export async function calculateSuperBookieGrossCommission(admin, dateFilter = {}) {
    const account =
        admin?.role === 'bookie' && admin?.commissionPercentage != null
            ? admin
            : await Admin.findById(admin._id)
                .select('commissionPercentage adminCommissionPercentage role')
                .lean();

    if (!account || account.role !== 'bookie') {
        return {
            directBetAmount: 0,
            subBetAmount: 0,
            totalBetAmount: 0,
            directCommission: 0,
            subCommission: 0,
            totalCommission: 0,
            commissionPercentage: 0,
            adminCommissionPercentage: 0,
            adminCommissionAmount: 0,
            netCommissionAfterAdmin: 0,
            betCount: 0,
        };
    }

    const adminRate = Number(account.commissionPercentage || 0);
    const directVolume = await getCommissionBetVolume(account, dateFilter, { directOnly: true });
    const directCommission = calculateCommissionAmount(directVolume.totalBetAmount, adminRate);

    const subs = await Admin.find({ role: 'super_bookie', parentBookieId: account._id })
        .select('_id commissionPercentage')
        .lean();

    let subBetAmount = 0;
    let subCommission = 0;
    let subBetCount = 0;
    for (const sub of subs) {
        const subVol = await getCommissionBetVolume(sub, dateFilter);
        const subRate = Number(sub.commissionPercentage || 0);
        subBetAmount = round2(subBetAmount + subVol.totalBetAmount);
        subCommission = round2(subCommission + calculateCommissionAmount(subVol.totalBetAmount, subRate));
        subBetCount += Number(subVol.betCount || 0);
    }

    const totalBetAmount = round2(directVolume.totalBetAmount + subBetAmount);
    const totalCommission = round2(directCommission + subCommission);
    const adminCommissionPercentage = Number(
        account.adminCommissionPercentage ?? account.commissionPercentage ?? 10,
    );
    const adminCommissionFromDirect = round2(directCommission);
    const adminCommissionFromSub = calculateAdminCommissionAmount(
        subCommission,
        adminCommissionPercentage,
    );
    const adminCommissionAmount = calculateSuperBookieAdminCommissionTotal(
        directCommission,
        subCommission,
        adminCommissionPercentage,
    );
    const netCommissionAfterAdmin = round2(Math.max(0, subCommission - adminCommissionFromSub));

    return {
        directBetAmount: directVolume.totalBetAmount,
        subBetAmount,
        totalBetAmount,
        directCommission,
        subCommission,
        totalCommission,
        commissionPercentage: adminRate,
        adminCommissionPercentage,
        adminCommissionFromDirect,
        adminCommissionFromSub,
        adminCommissionAmount,
        netCommissionAfterAdmin,
        betCount: Number(directVolume.betCount || 0) + subBetCount,
    };
}

async function buildAdvanceAwareCommissionDisplaySummary(admin, advanceCommissionPaid) {
    const userIds = (await getBookieUserIds(admin)) || [];
    const gross = await calculateSuperBookieGrossCommission(admin);
    const totalBetAmount = gross.totalBetAmount;
    const commissionPercentage = gross.commissionPercentage;
    const totalCommission = gross.totalCommission;
    const adminCommissionAmount = gross.adminCommissionAmount;
    const { adminPaid, adminPending } = await getAdminShareSettlementForBookie(
        admin._id,
        adminCommissionAmount,
    );

    const advancePaid = round2(advanceCommissionPaid);
    const recoveryRecorded = await getRecoveryRecordedForAccount(admin._id);
    const maxRecoveryFromBets = round2(Math.min(totalCommission, advancePaid));
    const recoveryPendingFromBets = round2(Math.max(0, maxRecoveryFromBets - recoveryRecorded));
    const advanceRecovered = recoveryRecorded;
    const advanceOutstanding = round2(Math.max(0, advancePaid - advanceRecovered));
    const commissionPayable = advanceOutstanding <= 0
        ? round2(Math.max(0, totalCommission - advancePaid))
        : 0;

    const payments = await CommissionPayment.find({ bookieId: admin._id })
        .select('amount paymentType notes createdAt')
        .lean();

    const activityDates = payments
        .filter((p) => {
            const kind = getCommissionPaymentKind(p);
            return kind === 'settlement' || kind === 'recovery';
        })
        .map((p) => p.createdAt)
        .filter(Boolean);
    const lastSettledAt =
        activityDates.length > 0
            ? new Date(Math.max(...activityDates.map((d) => new Date(d).getTime())))
            : null;

    const adminCommissionPercentage = gross.adminCommissionPercentage;
    const adminCommissionFromDirect = gross.adminCommissionFromDirect ?? round2(gross.directCommission);
    const adminCommissionFromSub = gross.adminCommissionFromSub ?? 0;
    const netCommissionAfterAdmin = gross.netCommissionAfterAdmin;

    return {
        accountId: admin._id,
        playerCount: userIds.length,
        betCount: gross.betCount,
        totalBetAmount,
        directBetAmount: gross.directBetAmount,
        subBetAmount: gross.subBetAmount,
        directCommission: gross.directCommission,
        subCommission: gross.subCommission,
        commissionPercentage,
        totalCommission,
        adminCommissionPercentage,
        adminCommissionFromDirect,
        adminCommissionFromSub,
        adminCommissionAmount,
        adminCommissionPaid: adminPaid,
        adminCommissionPending: adminPending,
        netCommissionAfterAdmin,
        advanceCommissionPaid: advancePaid,
        advanceRecovered,
        advanceOutstanding,
        recoveryPendingFromBets,
        maxRecoveryFromBets,
        commissionPayable,
        totalPaid: adminPaid,
        totalPending: adminPending,
        displaySettled: adminPaid,
        displayPending: adminPending,
        lastSettledAt,
        paymentStatus: getAdminSharePaymentStatus(adminCommissionAmount, adminPaid),
    };
}

/**
 * Parent receivable commission from a sub Bookie (super_bookie): bet volume × rate minus settlements.
 */
export async function getSubBookieCommissionSettlementSummary(admin) {
    const account =
        admin?.role === 'super_bookie' && admin?.commissionPercentage != null
            ? admin
            : await Admin.findById(admin?._id ?? admin)
                .select('_id username phone commissionPercentage role parentBookieId initialBalancePaymentMode')
                .lean();

    if (!account || account.role !== 'super_bookie') {
        return {
            accountId: admin?._id,
            username: '',
            phone: '',
            playerCount: 0,
            betCount: 0,
            totalBetAmount: 0,
            commissionPercentage: 0,
            totalCommission: 0,
            parentCommissionAmount: 0,
            totalPaid: 0,
            totalPending: 0,
            paymentStatus: 'none',
            lastPaidAt: null,
            initialBalancePaymentMode: 'advance_paid',
        };
    }

    const userIds = (await getBookieUserIds(account)) || [];
    const volume = await getCommissionBetVolume(account);
    const commissionPercentage = Number(account.commissionPercentage || 0);
    const totalCommission = calculateCommissionAmount(volume.totalBetAmount, commissionPercentage);

    const payments = await CommissionPayment.find({ bookieId: account._id })
        .select('amount paymentType notes createdAt')
        .lean();

    const totalPaidRaw = round2(
        payments
            .filter((p) => getCommissionPaymentKind(p) === 'settlement')
            .reduce((sum, p) => sum + Number(p.amount || 0), 0),
    );
    const totalPaid = round2(Math.min(totalPaidRaw, totalCommission));
    const totalPending = round2(Math.max(0, totalCommission - totalPaid));

    const settlementDates = payments
        .filter((p) => getCommissionPaymentKind(p) === 'settlement')
        .map((p) => p.createdAt)
        .filter(Boolean);
    const lastPaidAt =
        settlementDates.length > 0
            ? new Date(Math.max(...settlementDates.map((d) => new Date(d).getTime())))
            : null;

    const paymentStatus =
        totalCommission <= 0
            ? 'none'
            : totalPending <= 0
              ? 'paid'
              : totalPaid > 0
                ? 'partial'
                : 'pending';

    return {
        accountId: account._id,
        username: account.username || '',
        phone: account.phone || '',
        playerCount: userIds.length,
        betCount: volume.betCount,
        totalBetAmount: volume.totalBetAmount,
        commissionPercentage,
        totalCommission,
        parentCommissionAmount: totalCommission,
        totalPaid,
        totalPending,
        paymentStatus,
        lastPaidAt,
        initialBalancePaymentMode: account.initialBalancePaymentMode || 'advance_paid',
    };
}

/** Parent SuperBookie panel row: commission receivable from one sub Bookie. */
export async function getParentReceivableCommissionFromSubBookie(superBookie) {
    const base = await getSubBookieCommissionSettlementSummary(superBookie);
    const [
        advancePaidInitial,
        advanceRecoverable,
        advanceSettledFromAdvance,
        advanceAvailableForSettlement,
    ] = await Promise.all([
        getAdvancePaidInitialFromBookieForAccount(base.accountId),
        getAdvanceCommissionPaidForAccount(base.accountId),
        getSettlementsPaidWithAdvanceTotal(base.accountId),
        getAdvanceAvailableForSettlement({ _id: base.accountId, role: 'super_bookie' }),
    ]);
    const advanceCommissionPaid = round2(advancePaidInitial + advanceRecoverable);
    const advanceOutstanding = round2(Math.max(0, advanceCommissionPaid - advanceSettledFromAdvance));

    return {
        superBookieId: base.accountId,
        username: base.username,
        phone: base.phone,
        commissionPercentage: base.commissionPercentage,
        subEarnedCommission: 0,
        playerCount: base.playerCount,
        betCount: base.betCount,
        totalBetAmount: base.totalBetAmount,
        totalCommission: base.totalCommission,
        parentCommissionFromSub: base.totalCommission,
        totalPaid: base.totalPaid,
        totalPending: base.totalPending,
        paymentStatus: base.paymentStatus,
        lastPaidAt: base.lastPaidAt,
        advanceCommissionPaid,
        advancePaidInitial,
        advanceRecoverable,
        advanceSettledFromAdvance,
        advanceOutstanding,
        advanceAvailableForSettlement,
        initialBalancePaymentMode: base.initialBalancePaymentMode,
        advanceRecovered: 0,
        recoveryPendingFromBets: 0,
        commissionPayable: base.totalPending,
        displaySettled: base.totalPaid,
        displayPending: base.totalPending,
    };
}

/**
 * Sub Bookie (super_bookie): player bets count here; commission flows to parent SuperBookie.
 * Example: ₹2000 bets × rate set by SuperBookie on this sub (e.g. 20%) = ₹400 to SuperBookie.
 */
export async function getSuperBookieCommissionDisplaySummary(admin) {
    const account = await Admin.findById(admin._id)
        .select('parentBookieId role _id initialBalancePaymentMode commissionPercentage username phone')
        .lean();
    if (!account) {
        return {
            accountId: admin._id,
            playerCount: 0,
            betCount: 0,
            totalBetAmount: 0,
            commissionPercentage: 0,
            parentCommissionPercentage: 0,
            parentCommissionAmount: 0,
            parentBookieUsername: '',
            totalCommission: 0,
            totalPaid: 0,
            totalPending: 0,
            paymentStatus: 'none',
            initialBalancePaymentMode: 'advance_paid',
        };
    }

    const [base, parent] = await Promise.all([
        getSubBookieCommissionSettlementSummary(account),
        getParentSuperBookieAccount(account),
    ]);

    return {
        accountId: base.accountId,
        playerCount: base.playerCount,
        betCount: base.betCount,
        totalBetAmount: base.totalBetAmount,
        commissionPercentage: 0,
        parentCommissionPercentage: base.commissionPercentage,
        parentCommissionAmount: base.parentCommissionAmount,
        parentBookieUsername: parent?.username || '',
        totalCommission: base.parentCommissionAmount,
        totalPaid: base.totalPaid,
        totalPending: base.totalPending,
        paymentStatus: base.paymentStatus,
        lastSettledAt: base.lastPaidAt,
        initialBalancePaymentMode: base.initialBalancePaymentMode,
    };
}

/**
 * Parent bookie: commission vs advance received from super admin.
 */
export async function getBookieCommissionFromAdminDisplaySummary(admin) {
    const advanceCommissionPaid = await getAdvanceFromAdminForBookie(admin._id);
    return buildAdvanceAwareCommissionDisplaySummary(admin, advanceCommissionPaid);
}

/**
 * Commission earned / paid / pending for a bookie or super bookie account.
 */
export async function getCommissionSummaryForAccount(admin) {
    if (admin?.role === 'super_bookie') {
        return getSuperBookieCommissionDisplaySummary(admin);
    }
    if (admin?.role === 'bookie') {
        return getBookieCommissionFromAdminDisplaySummary(admin);
    }

    const userIds = (await getBookieUserIds(admin)) || [];
    const volume = await getCommissionBetVolume(admin);
    const totalBetAmount = volume.totalBetAmount;
    const commissionPercentage = Number(admin.commissionPercentage || 0);
    const totalCommission = calculateCommissionAmount(totalBetAmount, commissionPercentage);

    const payments = await CommissionPayment.find({ bookieId: admin._id })
        .select('amount paymentType notes')
        .lean();
    const totalPaidRaw = round2(
        payments
            .filter((p) => getCommissionPaymentKind(p) === 'settlement')
            .reduce((sum, p) => sum + Number(p.amount || 0), 0)
    );
    const totalPaid = round2(Math.min(totalPaidRaw, totalCommission));
    const totalPending = round2(Math.max(0, totalCommission - totalPaid));

    return {
        accountId: admin._id,
        playerCount: userIds.length,
        betCount: volume.betCount,
        totalBetAmount,
        commissionPercentage,
        totalCommission,
        totalPaid,
        totalPending,
        paymentStatus:
            totalCommission <= 0
                ? 'none'
                : totalPending <= 0
                  ? 'paid'
                  : totalPaid > 0
                    ? 'partial'
                    : 'pending',
    };
}

/**
 * Per-player bet volume and commission share for a bookie / super bookie account.
 */
export async function getPerPlayerCommissionRows(admin, { startDate, endDate } = {}) {
    const userIds = (await getBookieUserIds(admin)) || [];
    let commissionPercentage = Number(admin.commissionPercentage || 0);
    if (admin?.role === 'super_bookie') {
        commissionPercentage = await getEffectiveCommissionPercentage(admin);
    }
    if (!userIds.length) return [];

    const dateFilter = buildCommissionDateFilter(startDate, endDate);
    const userIdFilter = { userId: { $in: userIds } };

    const [matkaByUser, quizByUser, users] = await Promise.all([
        Bet.aggregate([
            {
                $match: {
                    ...dateFilter,
                    ...commissionMatkaMatch,
                    ...userIdFilter,
                },
            },
            {
                $group: {
                    _id: '$userId',
                    betAmount: { $sum: '$amount' },
                    betCount: { $sum: 1 },
                },
            },
        ]),
        QuizBet.aggregate([
            {
                $match: {
                    ...dateFilter,
                    status: { $ne: 'cancelled' },
                    ...userIdFilter,
                },
            },
            {
                $group: {
                    _id: '$userId',
                    betAmount: { $sum: '$amount' },
                    betCount: { $sum: 1 },
                },
            },
        ]),
        User.find({ _id: { $in: userIds } })
            .select('username phone isActive createdAt')
            .lean(),
    ]);

    const byUser = new Map();
    const mergeAgg = (rows) => {
        for (const row of rows) {
            const id = String(row._id);
            const prev = byUser.get(id) || { betAmount: 0, betCount: 0 };
            byUser.set(id, {
                betAmount: round2(prev.betAmount + Number(row.betAmount || 0)),
                betCount: prev.betCount + Number(row.betCount || 0),
            });
        }
    };
    mergeAgg(matkaByUser);
    mergeAgg(quizByUser);

    const userMap = Object.fromEntries(users.map((u) => [String(u._id), u]));

    const rows = userIds.map((uid) => {
        const id = String(uid);
        const metrics = byUser.get(id) || { betAmount: 0, betCount: 0 };
        const betAmount = metrics.betAmount;
        const commissionAmount = calculateCommissionAmount(betAmount, commissionPercentage);
        const user = userMap[id];
        return {
            playerId: uid,
            username: user?.username || 'Unknown',
            phone: user?.phone || '',
            isActive: user?.isActive !== false,
            betCount: metrics.betCount,
            totalBetAmount: betAmount,
            commissionPercentage,
            commissionAmount,
        };
    });

    rows.sort((a, b) => b.commissionAmount - a.commissionAmount || b.totalBetAmount - a.totalBetAmount);
    return rows;
}

/**
 * Dashboard payload: all-time settlement + optional period earnings.
 */
export async function getCommissionDashboardForAccount(admin, { startDate, endDate } = {}) {
    const summary = await getCommissionSummaryForAccount(admin);
    const userIds = (await getBookieUserIds(admin)) || [];

    let periodBetAmount = 0;
    let periodCommission = 0;
    let periodParentCommission = 0;
    let periodAdminCommission = 0;
    let periodGrossBreakdown = null;
    let matkaBetAmount = 0;
    let lotteryBetAmount = 0;

    if ((startDate || endDate)) {
        const dateFilter = buildCommissionDateFilter(startDate, endDate);
        const metrics = await aggregatePlayerBetMetrics({ admin, dateFilter });
        matkaBetAmount = metrics.matkaBetAmount;
        lotteryBetAmount = metrics.lotteryBetAmount;

        if (admin?.role === 'super_bookie') {
            periodBetAmount = metrics.totalBetAmount;
            const parentRate = Number(summary.parentCommissionPercentage || 0);
            periodParentCommission = calculateCommissionAmount(periodBetAmount, parentRate);
            periodCommission = 0;
        } else if (admin?.role === 'bookie') {
            periodGrossBreakdown = await calculateSuperBookieGrossCommission(admin, dateFilter);
            periodBetAmount = periodGrossBreakdown.totalBetAmount;
            periodCommission = periodGrossBreakdown.totalCommission;
            periodAdminCommission = periodGrossBreakdown.adminCommissionAmount;
        } else {
            periodBetAmount = metrics.totalBetAmount;
            periodCommission = calculateCommissionAmount(periodBetAmount, summary.commissionPercentage);
        }
    }

    const isAdvanceAware = admin?.role === 'bookie';
    const advanceFields = isAdvanceAware
        ? {
              advanceCommissionPaid: summary.advanceCommissionPaid ?? 0,
              advanceOutstanding: summary.advanceOutstanding ?? 0,
              advanceRecovered: summary.advanceRecovered ?? 0,
              recoveryPendingFromBets: summary.recoveryPendingFromBets ?? 0,
              commissionPayable: summary.commissionPayable ?? summary.totalPending ?? 0,
              adminCommissionPaid: summary.adminCommissionPaid ?? summary.totalPaid ?? 0,
              adminCommissionPending: summary.adminCommissionPending ?? summary.totalPending ?? 0,
              displaySettled: summary.displaySettled ?? 0,
              displayPending: summary.displayPending ?? 0,
              paymentStatus: summary.paymentStatus,
          }
        : {};

    const effectiveCommissionPercentage = admin?.role === 'super_bookie'
        ? Number(summary.parentCommissionPercentage ?? 0)
        : Number(summary.commissionPercentage ?? 0);

    return {
        commissionPercentage: effectiveCommissionPercentage,
        ownCommissionPercentage: Number(summary.commissionPercentage ?? 0),
        parentCommissionPercentage: summary.parentCommissionPercentage ?? 0,
        parentCommissionAmount: summary.parentCommissionAmount ?? 0,
        parentBookieUsername: summary.parentBookieUsername ?? '',
        adminCommissionPercentage: summary.adminCommissionPercentage ?? 0,
        adminCommissionFromDirect: summary.adminCommissionFromDirect ?? summary.directCommission ?? 0,
        adminCommissionFromSub: summary.adminCommissionFromSub ?? 0,
        adminCommissionAmount: summary.adminCommissionAmount ?? 0,
        netCommissionAfterAdmin: summary.netCommissionAfterAdmin ?? summary.totalCommission ?? 0,
        directBetAmount: summary.directBetAmount ?? 0,
        subBetAmount: summary.subBetAmount ?? 0,
        directCommission: summary.directCommission ?? 0,
        subCommission: summary.subCommission ?? 0,
        periodDirectBetAmount: periodGrossBreakdown?.directBetAmount ?? 0,
        periodSubBetAmount: periodGrossBreakdown?.subBetAmount ?? 0,
        periodDirectCommission: periodGrossBreakdown?.directCommission ?? 0,
        periodSubCommission: periodGrossBreakdown?.subCommission ?? 0,
        periodAdminCommissionFromDirect: periodGrossBreakdown?.adminCommissionFromDirect ?? 0,
        periodAdminCommissionFromSub: periodGrossBreakdown?.adminCommissionFromSub ?? 0,
        periodNetCommissionAfterAdmin: periodGrossBreakdown?.netCommissionAfterAdmin ?? round2(
            Math.max(0, (periodGrossBreakdown?.subCommission ?? 0) - (periodGrossBreakdown?.adminCommissionFromSub ?? 0)),
        ),
        allTimeBetAmount: summary.totalBetAmount,
        allTimeCommission: summary.totalCommission,
        allTimeParentCommission: summary.parentCommissionAmount ?? 0,
        allTimePaid: summary.totalPaid,
        allTimePending: summary.totalPending,
        paymentStatus: summary.paymentStatus,
        ...advanceFields,
        periodBetAmount,
        periodCommission,
        periodParentCommission,
        periodAdminCommission,
        matkaBetAmount,
        lotteryBetAmount,
        // Back-compat for /reports/revenue consumers
        totalBetAmount: periodBetAmount,
        bookieRevenue: admin?.role === 'super_bookie' ? periodParentCommission : periodCommission,
        paidAmount: summary.totalPaid,
        pendingAmount: summary.totalPending,
    };
}

/**
 * Admin dashboard: total commission receivable from all SuperBookies (parent bookie accounts).
 */
export async function getAdminPlatformCommissionFromSuperBookies({ startDate, endDate } = {}) {
    const parentBookies = await Admin.find({ role: 'bookie' })
        .select('_id commissionPercentage adminCommissionPercentage role')
        .lean();

    const dateFilter = (startDate || endDate) ? buildCommissionDateFilter(startDate, endDate) : {};

    const breakdowns = await Promise.all(
        parentBookies.map((bookie) => calculateSuperBookieGrossCommission(bookie, dateFilter)),
    );

    const commissionFromSuperBookies = round2(
        breakdowns.reduce((sum, row) => sum + Number(row.adminCommissionAmount || 0), 0),
    );
    const directCommission = round2(
        breakdowns.reduce((sum, row) => sum + Number(row.adminCommissionFromDirect ?? row.directCommission ?? 0), 0),
    );
    const commissionFromSubBookies = round2(
        breakdowns.reduce((sum, row) => sum + Number(row.adminCommissionFromSub ?? 0), 0),
    );
    const directBetAmount = round2(
        breakdowns.reduce((sum, row) => sum + Number(row.directBetAmount || 0), 0),
    );
    const subBetAmount = round2(
        breakdowns.reduce((sum, row) => sum + Number(row.subBetAmount || 0), 0),
    );
    const subCommission = round2(
        breakdowns.reduce((sum, row) => sum + Number(row.subCommission || 0), 0),
    );
    const superBookiePlayersBetAmount = round2(
        breakdowns.reduce((sum, row) => sum + Number(row.totalBetAmount || 0), 0),
    );

    return {
        commissionFromSuperBookies,
        directCommission,
        commissionFromSubBookies,
        directBetAmount,
        subBetAmount,
        subCommission,
        superBookiePlayersBetAmount,
        superBookieCount: parentBookies.length,
    };
}
