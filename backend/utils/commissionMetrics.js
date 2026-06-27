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

/** Prefer cap-aware actualCommission for daily/summary rows. */
export function resolveCommissionDisplayAmount(record) {
    if (record?.actualCommission != null) {
        return round2(record.actualCommission);
    }
    return round2(record?.commissionAmount || 0);
}

/** Resolve paid amount when syncing or displaying daily commission rows. */
export function resolveDailyCommissionPaidAmount({ engineSnapshot, existingPaid, commissionAmount }) {
    const basePaid = engineSnapshot?.paidAmount ?? (existingPaid || 0);
    return round2(Math.min(basePaid, commissionAmount));
}

/**
 * Hierarchy bet volumes only (no commission formulas — use commission engine for money).
 */
export async function getOperatorHierarchyVolumeBreakdown(admin, dateFilter = {}) {
    const account =
        admin?._id && admin?.commissionPercentage != null
            ? admin
            : await Admin.findById(admin?._id ?? admin)
                .select('_id commissionPercentage adminCommissionPercentage role')
                .lean();

    if (!account) {
        return {
            directBetAmount: 0,
            subBetAmount: 0,
            totalBetAmount: 0,
            betCount: 0,
            commissionPercentage: 0,
            adminCommissionPercentage: 10,
        };
    }

    const directVolume = await getCommissionBetVolume(account, dateFilter, { directOnly: true });
    const { getOperatorDescendantIds } = await import('../services/commissionEngine/hierarchyService.js');
    const descendantIds = await getOperatorDescendantIds(account._id);

    let subBetAmount = 0;
    let subBetCount = 0;
    for (const subId of descendantIds) {
        const subVol = await getCommissionBetVolume({ _id: subId }, dateFilter);
        subBetAmount = round2(subBetAmount + subVol.totalBetAmount);
        subBetCount += Number(subVol.betCount || 0);
    }

    const adminRate = Number(account.commissionPercentage || 0);
    const adminCommissionPercentage = Number(
        account.adminCommissionPercentage ?? account.commissionPercentage ?? 10,
    );

    return {
        directBetAmount: round2(directVolume.totalBetAmount),
        subBetAmount,
        totalBetAmount: round2(directVolume.totalBetAmount + subBetAmount),
        betCount: Number(directVolume.betCount || 0) + subBetCount,
        commissionPercentage: adminRate,
        adminCommissionPercentage,
    };
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

/**
 * Child bookie (super_bookie): split gross profit after own commission into SuperBookie + Admin shares.
 */
export async function getChildBookieProfitDistribution(admin, { startDate, endDate } = {}) {
    if (admin?.role !== 'super_bookie') {
        return {
            ownCommission: 0,
            superBookieShare: 0,
            adminShare: 0,
            superBookieRate: 0,
            upwardPool: 0,
            grossProfit: 0,
            totalBet: 0,
            parentBookieUsername: '',
        };
    }

    const {
        settleTreeBottomUpPreview,
        parseSettlementPeriod,
        applyEdgeFormula,
    } = await import('../services/commissionEngine/index.js');
    const { loadOperator } = await import('../services/commissionEngine/hierarchyService.js');

    const period = startDate || endDate ? parseSettlementPeriod({ startDate, endDate }) : null;
    const childPreview = await settleTreeBottomUpPreview({
        rootOperatorId: admin._id,
        period: period?.start && period?.end ? period : undefined,
    });
    const childEdge = childPreview.edges.find((e) => String(e.operatorId) === String(admin._id));
    const ownCommission = round2(childEdge?.actualCommission ?? 0);
    const upwardPool = round2(childPreview.platformRemainder ?? 0);
    const totalBet = round2(childEdge?.totalBet ?? 0);
    const grossProfit = round2(childEdge?.grossProfit ?? 0);

    const parent = await getParentSuperBookieAccount(admin);
    let superBookieShare = 0;
    let adminShare = upwardPool;
    let superBookieRate = 0;

    if (parent?._id && upwardPool > 0) {
        const parentOp = await loadOperator(parent._id);
        superBookieRate = Number(parentOp?.commissionPercentage ?? parent.commissionPercentage ?? 0);
        const parentEdge = applyEdgeFormula({
            totalBet,
            remainingDistributableIn: upwardPool,
            grossProfit: upwardPool,
            playerWinning: 0,
            operatorId: String(parent._id),
        }, superBookieRate);
        superBookieShare = round2(parentEdge.actualCommission);
        adminShare = round2(parentEdge.remainingDistributableOut);
    }

    return {
        ownCommission,
        superBookieShare,
        adminShare,
        superBookieRate,
        upwardPool,
        grossProfit,
        totalBet,
        parentBookieUsername: parent?.username ?? '',
    };
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
    const { getOperatorCommissionReport, getPlatformRemainderReport } =
        await import('../services/commissionEngine/index.js');

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

    const directVolumeByParent = Object.fromEntries(
        await Promise.all(
            parentBookies.map(async (bookie) => {
                const vol = await getCommissionBetVolume(bookie, {}, { directOnly: true });
                return [String(bookie._id), vol];
            }),
        ),
    );

    const normalized = [];

    for (const bookie of parentBookies) {
        const bookieId = String(bookie._id);
        const directVol = directVolumeByParent[bookieId] || { totalBetAmount: 0, betCount: 0 };
        const adminRate = Number(bookie.commissionPercentage || 0);
        const directBetAmount = round2(directVol.totalBetAmount);
        const adminCommissionPercentage = Number(
            bookie.adminCommissionPercentage ?? bookie.commissionPercentage ?? 10,
        );

        let subBetAmount = 0;
        let subBetCount = 0;
        let hierarchyPlayerCount = playerCountMap[bookieId] || 0;

        for (const sub of subsByParent[bookieId] || []) {
            const subKey = String(sub._id);
            const subVol = volumeMap[subKey] || { totalAmount: 0, betCount: 0 };
            subBetAmount = round2(subBetAmount + subVol.totalAmount);
            subBetCount += subVol.betCount;
            hierarchyPlayerCount += playerCountMap[subKey] || 0;
        }

        const totalBetAmount = round2(directBetAmount + subBetAmount);

        const [report, platform] = await Promise.all([
            getOperatorCommissionReport(bookie._id, {}),
            getPlatformRemainderReport({ rootOperatorId: bookie._id }),
        ]);
        const { adminPaid: adminCommissionPaid, adminPending: adminCommissionPending } =
            await getAdminShareSettlementForBookie(bookie._id, platform.platformRemainder);

        normalized.push({
            bookieId: bookie._id,
            username: bookie.username || 'Unknown',
            phone: bookie.phone || '',
            role: bookie.role,
            accountLabel: 'parent',
            parentBookieUsername: '',
            commissionPercentage: adminRate,
            adminCommissionPercentage,
            adminCommissionAmount: platform.platformRemainder,
            adminCommissionPaid,
            adminCommissionPending,
            netCommissionAfterAdmin: report.totalEarned,
            actualCommission: report.totalEarned,
            calculatedCommission: report.calculatedCommission,
            platformRemainder: platform.platformRemainder,
            superBookieCommission: report.totalEarned,
            superBookieCommissionPending: report.totalPending,
            superBookieCommissionSettled: report.totalSettled,
            directBetAmount,
            directPlayerCount: playerCountMap[bookieId] || 0,
            directBetCount: directVol.betCount,
            subBetAmount,
            playerCount: hierarchyPlayerCount,
            betCount: directVol.betCount + subBetCount,
            totalBetAmount,
            totalCommission: report.totalEarned,
            totalPaid: adminCommissionPaid,
            totalPending: adminCommissionPending,
            paymentStatus: getAdminSharePaymentStatus(platform.platformRemainder, adminCommissionPaid),
            lastPaidAt: lastPaidMap[bookieId] || report.lastSettledAt || null,
            engineV2: true,
        });
    }

    for (const sb of subBookies) {
        const subKey = String(sb._id);
        const subVol = volumeMap[subKey] || { totalAmount: 0, betCount: 0 };
        const parentCommissionPercentage = Number(sb.commissionPercentage || 0);
        const parentId = String(sb.parentBookieId?._id ?? sb.parentBookieId ?? '');

        const report = await getOperatorCommissionReport(sb._id, {});
        normalized.push({
            bookieId: sb._id,
            username: sb.username || 'Unknown',
            phone: sb.phone || '',
            role: sb.role,
            accountLabel: 'sub',
            parentBookieUsername: sb.parentBookieId?.username || parentUsernameMap[parentId] || '',
            commissionPercentage: 0,
            parentCommissionPercentage,
            parentCommissionAmount: report.totalEarned,
            actualCommission: report.totalEarned,
            calculatedCommission: report.calculatedCommission,
            grossProfit: report.grossProfit,
            playerCount: playerCountMap[subKey] || 0,
            betCount: subVol.betCount,
            totalBetAmount: subVol.totalAmount,
            totalCommission: report.totalEarned,
            totalPaid: report.totalSettled,
            totalPending: report.totalPending,
            paymentStatus: report.paymentStatus,
            lastPaidAt: report.lastSettledAt || lastPaidMap[subKey] || null,
            engineV2: true,
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

async function buildAdvanceAwareCommissionDisplaySummary(admin, advanceCommissionPaid) {
    const userIds = (await getBookieUserIds(admin)) || [];
    const volumes = await getOperatorHierarchyVolumeBreakdown(admin);

    const { getOperatorCommissionReport } = await import('../services/commissionEngine/index.js');
    const report = await getOperatorCommissionReport(admin._id, {});
    const totalBetAmount = report.totalBet ?? volumes.totalBetAmount;
    const totalCommission = report.totalEarned;
    const adminCommissionAmount = report.platformRemainder;
    const adminPaid = 0;
    const adminPending = adminCommissionAmount;

    const totalSettled = report.totalSettled;
    const recoveryPendingFromBets = report.totalPending;
    const advancePaid = round2(advanceCommissionPaid);
    const advanceRecovered = round2(Math.max(0, totalSettled - adminPaid));
    const advanceOutstanding = round2(Math.max(0, advancePaid - advanceRecovered));
    const commissionPayable = round2(Math.max(0, totalCommission - totalSettled));

    return {
        accountId: admin._id,
        playerCount: userIds.length,
        betCount: volumes.betCount,
        totalBetAmount,
        directBetAmount: volumes.directBetAmount,
        subBetAmount: volumes.subBetAmount,
        commissionPercentage: volumes.commissionPercentage,
        totalCommission,
        adminCommissionPercentage: volumes.adminCommissionPercentage,
        adminCommissionAmount,
        adminCommissionPaid: adminPaid,
        adminCommissionPending: adminPending,
        netCommissionAfterAdmin: totalCommission,
        calculatedCommission: report.calculatedCommission,
        grossProfit: report.grossProfit,
        actualCommission: report.totalEarned,
        platformRemainder: report.platformRemainder,
        advanceCommissionPaid: advancePaid,
        advanceRecovered,
        advanceOutstanding,
        recoveryPendingFromBets,
        maxRecoveryFromBets: totalCommission,
        commissionPayable,
        totalPaid: totalSettled,
        totalPending: recoveryPendingFromBets,
        displaySettled: totalSettled,
        displayPending: recoveryPendingFromBets,
        lastSettledAt: report.lastSettledAt,
        paymentStatus: report.paymentStatus,
        engineV2: true,
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
    const betMetrics = await aggregatePlayerBetMetrics({ admin: account });
    const playerWinning = betMetrics.totalPayouts;
    const metricsGrossProfit = round2(betMetrics.totalBetAmount - betMetrics.totalPayouts);

    const { getOperatorCommissionReport } = await import('../services/commissionEngine/index.js');
    const report = await getOperatorCommissionReport(account._id, {});

    const grossProfit = metricsGrossProfit > 0
        ? metricsGrossProfit
        : round2(report.grossProfit ?? 0);

    return {
        accountId: account._id,
        username: account.username || '',
        phone: account.phone || '',
        playerCount: userIds.length,
        betCount: volume.betCount,
        totalBetAmount: volume.totalBetAmount,
        commissionPercentage,
        totalCommission: report.totalEarned,
        parentCommissionAmount: report.totalEarned,
        calculatedCommission: report.calculatedCommission,
        grossProfit,
        playerWinning,
        totalPayouts: playerWinning,
        actualCommission: report.totalEarned,
        totalPaid: report.totalSettled,
        totalPending: report.totalPending,
        paymentStatus: report.paymentStatus,
        lastPaidAt: report.lastSettledAt,
        initialBalancePaymentMode: account.initialBalancePaymentMode || 'advance_paid',
        engineV2: true,
    };
}

/** Parent SuperBookie panel row: parent remainder + child bookie commission from one sub account. */
export async function getParentReceivableCommissionFromSubBookie(superBookie) {
    const base = await getSubBookieCommissionSettlementSummary(superBookie);
    const distribution = await getChildBookieProfitDistribution(superBookie);

    const parentRemainderAmount = distribution.superBookieShare;
    const adminShareFromChild = distribution.adminShare;
    const bookieCommission = base.totalCommission;
    const bookieCommissionPending = base.totalPending;
    const bookieCommissionSettled = base.totalPaid;

    const { adminPaid: parentRemainderPaid, adminPending: parentRemainderPending } =
        await getAdminShareSettlementForBookie(base.accountId, parentRemainderAmount);

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
        playerCount: base.playerCount,
        betCount: base.betCount,
        totalBetAmount: base.totalBetAmount,
        grossProfit: base.grossProfit ?? distribution.grossProfit,
        calculatedCommission: base.calculatedCommission,
        actualCommission: base.actualCommission,
        bookieCommission,
        bookieCommissionPending,
        bookieCommissionSettled,
        parentRemainderAmount,
        parentRemainderPaid,
        parentRemainderPending,
        adminShareFromChild,
        parentCommissionFromSub: parentRemainderAmount,
        subEarnedCommission: bookieCommission,
        totalCommission: parentRemainderAmount,
        totalPaid: parentRemainderPaid,
        totalPending: parentRemainderPending,
        paymentStatus: getAdminSharePaymentStatus(parentRemainderAmount, parentRemainderPaid),
        parentRemainderPaymentStatus: getAdminSharePaymentStatus(parentRemainderAmount, parentRemainderPaid),
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
        commissionPayable: bookieCommissionPending,
        displaySettled: parentRemainderPaid,
        displayPending: parentRemainderPending,
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
        commissionPercentage: base.commissionPercentage,
        parentCommissionPercentage: base.commissionPercentage,
        parentCommissionAmount: base.totalCommission,
        parentBookieUsername: parent?.username || '',
        totalCommission: base.totalCommission,
        actualCommission: base.actualCommission,
        calculatedCommission: base.calculatedCommission,
        grossProfit: base.grossProfit,
        playerWinning: base.playerWinning ?? base.totalPayouts ?? 0,
        totalPayouts: base.totalPayouts ?? base.playerWinning ?? 0,
        totalPaid: base.totalPaid,
        totalPending: base.totalPending,
        paymentStatus: base.paymentStatus,
        lastSettledAt: base.lastPaidAt,
        initialBalancePaymentMode: base.initialBalancePaymentMode,
        engineV2: true,
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
    const commissionPercentage = Number(admin.commissionPercentage || 0);

    const { getOperatorCommissionReport } = await import('../services/commissionEngine/index.js');
    const report = await getOperatorCommissionReport(admin._id, {});

    return {
        accountId: admin._id,
        playerCount: userIds.length,
        betCount: volume.betCount,
        totalBetAmount: volume.totalBetAmount,
        commissionPercentage,
        totalCommission: report.totalEarned,
        actualCommission: report.totalEarned,
        calculatedCommission: report.calculatedCommission,
        grossProfit: report.grossProfit,
        totalPaid: report.totalSettled,
        totalPending: report.totalPending,
        paymentStatus: report.paymentStatus,
        engineV2: true,
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

    const { getOperatorEarnedCommission } = await import('../services/commissionEngine/index.js');
    const earned = await getOperatorEarnedCommission(admin._id, { startDate, endDate });
    const operatorActualTotal = earned.actualCommission;
    const operatorPeriodBet = earned.totalBet;
    const operatorCalculatedTotal = earned.calculatedCommission;

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
        const calculatedCommission =
            operatorPeriodBet > 0
                ? round2(operatorCalculatedTotal * (betAmount / operatorPeriodBet))
                : 0;
        const commissionAmount =
            operatorPeriodBet > 0
                ? round2(operatorActualTotal * (betAmount / operatorPeriodBet))
                : 0;
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
            calculatedCommission,
            engineV2: true,
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
    const allTimeMetrics = await aggregatePlayerBetMetrics({ admin });
    const allTimePlayerWinning = allTimeMetrics.totalPayouts;
    const allTimeGrossProfit = round2(allTimeMetrics.totalBetAmount - allTimeMetrics.totalPayouts);
    let allTimeProfitDistribution = null;
    let periodProfitDistribution = null;
    if (admin?.role === 'super_bookie') {
        allTimeProfitDistribution = await getChildBookieProfitDistribution(admin);
    }

    let periodBetAmount = 0;
    let periodCommission = 0;
    let periodParentCommission = 0;
    let periodAdminCommission = 0;
    let periodGrossBreakdown = null;
    let matkaBetAmount = 0;
    let lotteryBetAmount = 0;
    let engineV2Period = null;

    const { getOperatorCommissionReport, getPlatformRemainderReport } =
        await import('../services/commissionEngine/index.js');

    if (startDate || endDate) {
        const dateFilter = buildCommissionDateFilter(startDate, endDate);
        const metrics = await aggregatePlayerBetMetrics({ admin, dateFilter });
        matkaBetAmount = metrics.matkaBetAmount;
        lotteryBetAmount = metrics.lotteryBetAmount;

        const periodOpts = { startDate, endDate };
        const report = await getOperatorCommissionReport(admin._id, periodOpts);
        const platform = await getPlatformRemainderReport({ ...periodOpts, rootOperatorId: admin._id });
        engineV2Period = { report, platform };
        periodBetAmount = report.totalBet;
        periodAdminCommission = platform.platformRemainder;
        const periodPayouts = metrics.totalPayouts;
        const metricsGrossProfit = round2(metrics.totalBetAmount - metrics.totalPayouts);
        const periodGrossProfit = metricsGrossProfit > 0
            ? metricsGrossProfit
            : round2(report.grossProfit ?? 0);
        periodGrossBreakdown = {
            totalBetAmount: report.totalBet,
            totalPayouts: periodPayouts,
            grossProfit: periodGrossProfit,
            totalCommission: report.totalEarned,
            superBookieCommission: report.totalEarned,
            adminRemainder: platform.platformRemainder,
            adminCommissionAmount: platform.platformRemainder,
            calculatedCommission: report.calculatedCommission,
            actualCommission: report.totalEarned,
            totalSettled: report.totalSettled,
            totalPending: report.totalPending,
            directBetAmount: metrics.totalBetAmount,
            subBetAmount: 0,
            directCommission: admin?.role === 'bookie' ? report.totalEarned : 0,
            subCommission: 0,
            adminCommissionFromDirect: admin?.role === 'bookie' ? platform.platformRemainder : 0,
            adminCommissionFromSub: 0,
            netCommissionAfterAdmin: report.totalEarned,
        };

        if (admin?.role === 'super_bookie') {
            periodCommission = report.totalEarned;
            periodParentCommission = 0;
            periodProfitDistribution = await getChildBookieProfitDistribution(admin, { startDate, endDate });
            periodGrossBreakdown = {
                ...periodGrossBreakdown,
                superBookieShare: periodProfitDistribution.superBookieShare,
                adminShare: periodProfitDistribution.adminShare,
                parentSuperBookieRate: periodProfitDistribution.superBookieRate,
            };
        } else {
            periodCommission = report.totalEarned;
            periodParentCommission = 0;
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
        totalPaid: summary.totalPaid,
        totalPending: summary.totalPending,
        totalCommission: summary.totalCommission,
        grossProfit: allTimeGrossProfit > 0 ? allTimeGrossProfit : (summary.grossProfit ?? 0),
        playerWinning: allTimePlayerWinning,
        totalPayouts: allTimePlayerWinning,
        superBookieShare: allTimeProfitDistribution?.superBookieShare ?? 0,
        adminShare: allTimeProfitDistribution?.adminShare ?? 0,
        parentSuperBookieRate: allTimeProfitDistribution?.superBookieRate ?? 0,
        paymentStatus: summary.paymentStatus,
        ...advanceFields,
        periodBetAmount,
        periodCommission,
        periodParentCommission,
        periodAdminCommission,
        periodGrossProfit: periodGrossBreakdown?.grossProfit ?? 0,
        periodPayouts: periodGrossBreakdown?.totalPayouts ?? 0,
        periodPlayerWinning: periodGrossBreakdown?.totalPayouts ?? 0,
        periodSuperBookieShare: periodProfitDistribution?.superBookieShare ?? periodGrossBreakdown?.superBookieShare ?? 0,
        periodAdminShare: periodProfitDistribution?.adminShare ?? periodGrossBreakdown?.adminShare ?? 0,
        periodSettled: periodGrossBreakdown?.totalSettled ?? summary.totalPaid ?? 0,
        periodPending: periodGrossBreakdown?.totalPending ?? summary.totalPending ?? 0,
        periodSuperBookieCommission: admin?.role === 'bookie'
            ? (periodGrossBreakdown?.superBookieCommission ?? periodCommission)
            : (admin?.role === 'super_bookie'
                ? (periodGrossBreakdown?.superBookieCommission ?? periodCommission)
                : 0),
        periodAdminRemainder: periodGrossBreakdown?.adminRemainder ?? periodAdminCommission,
        periodCalculatedCommission: periodGrossBreakdown?.calculatedCommission ?? 0,
        matkaBetAmount,
        lotteryBetAmount,
        // Back-compat for /reports/revenue consumers
        totalBetAmount: periodBetAmount,
        bookieRevenue: periodCommission,
        paidAmount: summary.totalPaid,
        pendingAmount: summary.totalPending,
        ...(engineV2Period
            ? {
                  engineV2: true,
                  engineV2Period,
                  actualCommission: periodGrossBreakdown?.actualCommission
                      ?? summary.actualCommission
                      ?? summary.totalCommission,
                  calculatedCommission: periodGrossBreakdown?.calculatedCommission
                      ?? summary.calculatedCommission,
                  grossProfit: periodGrossBreakdown?.grossProfit ?? summary.grossProfit,
                  platformRemainder: periodGrossBreakdown?.adminRemainder ?? summary.platformRemainder,
              }
            : {}),
    };
}

/**
 * Admin dashboard: total commission receivable from all SuperBookies (parent bookie accounts).
 */
export async function getAdminPlatformCommissionFromSuperBookies({ startDate, endDate } = {}) {
    const { getPlatformRemainderReport } = await import('../services/commissionEngine/index.js');
    const platform = await getPlatformRemainderReport({ startDate, endDate });
    const parentBookies = await Admin.find({ role: 'bookie' })
        .select('_id')
        .lean();
    const superBookiePlayersBetAmount = round2(
        (platform.edges || []).reduce((s, e) => s + Number(e.totalBet || 0), 0),
    );

    return {
        commissionFromSuperBookies: platform.platformRemainder,
        directCommission: 0,
        commissionFromSubBookies: 0,
        directBetAmount: 0,
        subBetAmount: 0,
        subCommission: 0,
        superBookiePlayersBetAmount,
        superBookieCount: parentBookies.length,
        platformRemainder: platform.platformRemainder,
        totalActualCommission: platform.totalActualCommission,
        engineV2: true,
    };
}

// ---------------------------------------------------------------------------
// Commission Engine — settlement facade for controllers.
// ---------------------------------------------------------------------------

/**
 * Preview bottom-up settlement for an operator subtree (no wallet writes).
 * @param {{ rootOperatorId?: string, startDate?: string, endDate?: string, date?: string }} options
 */
export async function previewCommissionEngineSettlement(options = {}) {
    const { settleTreeBottomUpPreview, parseSettlementPeriod } =
        await import('../services/commissionEngine/index.js');

    const period = parseSettlementPeriod(options);

    const result = await settleTreeBottomUpPreview({
        rootOperatorId: options.rootOperatorId || null,
        period,
    });

    return {
        enabled: true,
        ...result,
        summary: {
            edgeCount: result.edges?.length ?? 0,
            platformRemainder: result.platformRemainder ?? 0,
            totalActualCommission: round2(
                (result.edges || []).reduce((s, e) => s + Number(e.actualCommission || 0), 0),
            ),
        },
    };
}

/**
 * Execute bottom-up settlement (wallet credits + CommissionSettlement persistence).
 * @param {{ rootOperatorId?: string, startDate?: string, endDate?: string, date?: string, period?: object, actor?: object }} options
 */
export async function executeCommissionEngineSettlement(options = {}) {
    const { settleTreeBottomUp, parseSettlementPeriod, assertValidPeriod } =
        await import('../services/commissionEngine/index.js');

    const period = options.period || parseSettlementPeriod(options);
    assertValidPeriod(period);

    const result = await settleTreeBottomUp({
        rootOperatorId: options.rootOperatorId || null,
        period,
        actor: options.actor || null,
    });

    return {
        enabled: true,
        ...result,
        summary: {
            edgeCount: result.edges?.length ?? 0,
            platformRemainder: result.platformRemainder ?? 0,
            totalActualCommission: round2(result.totalActualCommission ?? 0),
        },
    };
}

/**
 * Daily commission row fields from engine preview + settled aggregate for one day.
 */
export async function getDailyCommissionEngineV2Snapshot(bookieId, period) {
    const { getOperatorEarnedCommission, aggregateSettledCommissionForOperator } =
        await import('../services/commissionEngine/index.js');

    const [earned, settled] = await Promise.all([
        getOperatorEarnedCommission(bookieId, period),
        aggregateSettledCommissionForOperator(bookieId, period),
    ]);

    const actualCommission = earned.actualCommission;
    const paidAmount = settled.totalActual;
    const pendingAmount = round2(Math.max(0, actualCommission - paidAmount));

    return {
        actualCommission,
        calculatedCommission: earned.calculatedCommission,
        grossProfit: earned.grossProfit,
        commissionAmount: actualCommission,
        paidAmount,
        pendingAmount,
        paymentStatus:
            actualCommission <= 0
                ? 'paid'
                : pendingAmount <= 0
                  ? 'paid'
                  : paidAmount > 0
                    ? 'partial'
                    : 'pending',
        engineV2: true,
    };
}
