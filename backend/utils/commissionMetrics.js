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

/** Admin share = SuperBookie commission × admin rate (%). */
export function calculateAdminCommissionAmount(superBookieCommission, adminCommissionPercentage) {
    return calculateCommissionAmount(superBookieCommission, adminCommissionPercentage);
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
export async function getAdminShareSettlementForBookie(bookieId, adminCommissionAmount) {
    const cap = round2(Number(adminCommissionAmount || 0));
    if (cap <= 0) {
        return { adminPaid: 0, adminPending: 0 };
    }
    const payments = await CommissionPayment.find({ bookieId })
        .select('amount paymentType notes')
        .lean();
    const settledTotal = round2(
        payments
            .filter((p) => getCommissionPaymentKind(p) === 'settlement')
            .reduce((sum, p) => sum + Number(p.amount || 0), 0),
    );
    const adminPaid = round2(Math.min(settledTotal, cap));
    const adminPending = round2(Math.max(0, cap - adminPaid));
    return { adminPaid, adminPending };
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
 * Admin share = gross × adminCommissionPercentage (on commission, not bets).
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
    const adminCommissionPercentage = Number(account.adminCommissionPercentage ?? 10);
    const adminCommissionAmount = calculateAdminCommissionAmount(totalCommission, adminCommissionPercentage);
    const netCommissionAfterAdmin = round2(Math.max(0, totalCommission - adminCommissionAmount));

    return {
        directBetAmount: directVolume.totalBetAmount,
        subBetAmount,
        totalBetAmount,
        directCommission,
        subCommission,
        totalCommission,
        commissionPercentage: adminRate,
        adminCommissionPercentage,
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

    let commissionSettled = round2(
        payments
            .filter((p) => getCommissionPaymentKind(p) === 'settlement')
            .reduce((sum, p) => sum + Number(p.amount || 0), 0)
    );
    commissionSettled = round2(Math.min(commissionSettled, commissionPayable));

    const totalPending = round2(Math.max(0, commissionPayable - commissionSettled));
    const totalPaid = commissionSettled;

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

    const displaySettled = round2(advanceRecovered + totalPaid);
    const displayPending = round2(recoveryPendingFromBets + totalPending);

    const adminCommissionPercentage = gross.adminCommissionPercentage;
    const adminCommissionAmount = gross.adminCommissionAmount;
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
        adminCommissionAmount,
        netCommissionAfterAdmin,
        advanceCommissionPaid: advancePaid,
        advanceRecovered,
        advanceOutstanding,
        recoveryPendingFromBets,
        maxRecoveryFromBets,
        commissionPayable,
        totalPaid,
        totalPending,
        displaySettled,
        displayPending,
        lastSettledAt,
        paymentStatus: (() => {
            if (advanceOutstanding > 0 && totalCommission <= 0) return 'advance_recovery';
            if (totalCommission <= 0) return 'none';
            if (recoveryPendingFromBets > 0) return 'advance_recovery';
            if (totalPending <= 0 && advanceOutstanding <= 0) return 'paid';
            if (totalPending > 0) return totalPaid > 0 ? 'partial' : 'pending';
            if (advanceOutstanding > 0) return 'advance_recovery';
            return 'paid';
        })(),
    };
}

/**
 * Sub Bookie (super_bookie): player bets count here; commission flows to parent SuperBookie.
 * Example: ₹2000 bets × rate set by SuperBookie on this sub (e.g. 20%) = ₹400 to SuperBookie.
 */
export async function getSuperBookieCommissionDisplaySummary(admin) {
    const account = await Admin.findById(admin._id)
        .select('parentBookieId role _id initialBalancePaymentMode commissionPercentage')
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

    const userIds = (await getBookieUserIds(account)) || [];
    const volume = await getCommissionBetVolume(account);
    const parent = await getParentSuperBookieAccount(account);
    const parentCommissionPercentage = Number(account.commissionPercentage || 0);
    const parentCommissionAmount = calculateCommissionAmount(
        volume.totalBetAmount,
        parentCommissionPercentage,
    );

    return {
        accountId: account._id,
        playerCount: userIds.length,
        betCount: volume.betCount,
        totalBetAmount: volume.totalBetAmount,
        commissionPercentage: 0,
        parentCommissionPercentage,
        parentCommissionAmount,
        parentBookieUsername: parent?.username || '',
        totalCommission: 0,
        totalPaid: 0,
        totalPending: 0,
        paymentStatus: 'none',
        initialBalancePaymentMode: account?.initialBalancePaymentMode || 'advance_paid',
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
        periodNetCommissionAfterAdmin: periodGrossBreakdown?.netCommissionAfterAdmin ?? round2(
            Math.max(0, periodCommission - periodAdminCommission),
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
