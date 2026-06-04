import Admin from '../models/admin/admin.js';
import BookieWalletTransaction from '../models/bookieWalletTransaction/bookieWalletTransaction.js';
import CommissionPayment from '../models/commission/commissionPayment.js';
import {
    getCommissionPaymentKind,
    getSuperBookieCommissionDisplaySummary,
} from './commissionMetrics.js';
import {
    FROM_BOOKIE_COMMISSION_SETTLEMENT_TYPES,
    FROM_BOOKIE_SUMMARY_TYPES,
    FROM_BOOKIE_AFTER_PAID_TYPES,
    FROM_BOOKIE_ADVANCE_ALLOCATION_DEBIT_TYPES,
    FROM_PLAYER_SUMMARY_TYPES,
    FROM_PLAYER_WITHDRAWAL_SUMMARY_TYPES,
    isFromAdminWalletTx,
} from './bookieWalletLedger.js';

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

/** Super bookie: bookie remaining + player net (player add fund adds, withdrawal subtracts). */
export async function getSuperBookiePanelGrandTotal(adminId) {
    const fresh = await Admin.findById(adminId).select('balance role').lean();
    if (!fresh || fresh.role !== 'super_bookie') return 0;

    const summaryAgg = await BookieWalletTransaction.aggregate([
        { $match: { adminId } },
        {
            $group: {
                _id: '$type',
                credit: { $sum: { $cond: [{ $eq: ['$direction', 'credit'] }, '$amount', 0] } },
                debit: { $sum: { $cond: [{ $eq: ['$direction', 'debit'] }, '$amount', 0] } },
            },
        },
    ]);

    let ledgerCreditAll = 0;
    let ledgerDebitAll = 0;
    let advanceFromBookie = 0;
    let afterPaidFromBookie = 0;
    let playerReceived = 0;
    let playerWithdrawn = 0;
    let commissionSettledFromBookie = 0;

    for (const row of summaryAgg) {
        ledgerCreditAll += row.credit || 0;
        ledgerDebitAll += row.debit || 0;
        if (FROM_BOOKIE_SUMMARY_TYPES.includes(row._id)) {
            advanceFromBookie += row.credit || 0;
        }
        if (FROM_BOOKIE_AFTER_PAID_TYPES.includes(row._id)) {
            afterPaidFromBookie += row.credit || 0;
        }
        if (FROM_PLAYER_SUMMARY_TYPES.includes(row._id)) {
            playerReceived += row.credit || 0;
        }
        if (FROM_PLAYER_WITHDRAWAL_SUMMARY_TYPES.includes(row._id)) {
            playerWithdrawn += row.debit || row.credit || 0;
        }
        if (FROM_BOOKIE_COMMISSION_SETTLEMENT_TYPES.includes(row._id)) {
            commissionSettledFromBookie += row.credit || 0;
        }
    }

    const currentBalance = Number(fresh.balance ?? 0);
    const untrackedGap = round2(Math.max(0, currentBalance - (ledgerCreditAll - ledgerDebitAll)));
    if (untrackedGap > 0) {
        afterPaidFromBookie = round2(afterPaidFromBookie + untrackedGap);
    }

    const remainingFromBookie = round2(
        Math.max(0, advanceFromBookie - commissionSettledFromBookie),
    );
    const playerNet = round2(playerReceived - playerWithdrawn);

    return round2(remainingFromBookie + afterPaidFromBookie + playerNet);
}

/**
 * Grand total for panel sidebar — matches wallet-transactions card.
 */
export async function getBookiePanelGrandTotal(adminId) {
    const fresh = await Admin.findById(adminId).select('balance role').lean();
    if (!fresh) return 0;
    if (fresh.role === 'super_bookie') return getSuperBookiePanelGrandTotal(adminId);
    if (fresh.role !== 'bookie') return round2(fresh.balance ?? 0);

    const [summaryAgg, allTxsForAdmin] = await Promise.all([
        BookieWalletTransaction.aggregate([
            { $match: { adminId } },
            {
                $group: {
                    _id: '$type',
                    credit: { $sum: { $cond: [{ $eq: ['$direction', 'credit'] }, '$amount', 0] } },
                    debit: { $sum: { $cond: [{ $eq: ['$direction', 'debit'] }, '$amount', 0] } },
                },
            },
        ]),
        BookieWalletTransaction.find({ adminId })
            .select('type direction amount description')
            .lean(),
    ]);

    let ledgerCreditAll = 0;
    let ledgerDebitAll = 0;
    let playerReceived = 0;
    let playerWithdrawn = 0;
    let advanceToSuperBookie = 0;
    let commissionPaidToSuperBookie = 0;

    for (const row of summaryAgg) {
        ledgerCreditAll += row.credit || 0;
        ledgerDebitAll += row.debit || 0;
        if (FROM_PLAYER_SUMMARY_TYPES.includes(row._id)) {
            playerReceived += row.credit || 0;
        }
        if (FROM_PLAYER_WITHDRAWAL_SUMMARY_TYPES.includes(row._id)) {
            playerWithdrawn += row.debit || row.credit || 0;
        }
        if (FROM_BOOKIE_ADVANCE_ALLOCATION_DEBIT_TYPES.includes(row._id)) {
            advanceToSuperBookie += row.debit || 0;
        }
        if (FROM_BOOKIE_COMMISSION_SETTLEMENT_TYPES.includes(row._id)) {
            commissionPaidToSuperBookie += row.debit || 0;
        }
    }

    const playerNet = round2(playerReceived - playerWithdrawn);
    const bookieRemaining = round2(Math.max(0, advanceToSuperBookie - commissionPaidToSuperBookie));

    const currentBalance = Number(fresh.balance ?? 0);
    const ledgerNetAll = ledgerCreditAll - ledgerDebitAll;
    const untrackedGap = round2(Math.max(0, currentBalance - ledgerNetAll));

    let adminCredits = 0;
    for (const tx of allTxsForAdmin) {
        if (isFromAdminWalletTx(tx)) adminCredits += Number(tx.amount || 0);
    }
    let adminReceived = round2(adminCredits);
    if (untrackedGap > 0) adminReceived = round2(adminReceived + untrackedGap);

    const commissionPayments = await CommissionPayment.find({ bookieId: adminId })
        .select('amount paymentType notes')
        .lean();
    let adminSettled = 0;
    for (const payment of commissionPayments) {
        if (getCommissionPaymentKind(payment) === 'settlement') {
            adminSettled += Number(payment.amount || 0);
        }
    }
    adminSettled = round2(adminSettled);

    const adminComm = await getSuperBookieCommissionDisplaySummary(fresh);
    const advanceFromAdmin = adminReceived;
    const commissionSettledDeducted = round2(
        Math.max(Number(adminComm.displaySettled || 0), adminSettled),
    );
    const remainingFromAdmin = round2(
        Math.max(
            Math.max(0, adminReceived - adminSettled),
            advanceFromAdmin - commissionSettledDeducted,
        ),
    );

    return round2(bookieRemaining + playerNet + remainingFromAdmin);
}
