import Admin from '../models/admin/admin.js';
import BookieWalletTransaction from '../models/bookieWalletTransaction/bookieWalletTransaction.js';
import CommissionPayment from '../models/commission/commissionPayment.js';
import {
    getCommissionPaymentKind,
    getSuperBookieCommissionDisplaySummary,
} from '../utils/commissionMetrics.js';
import { isBookiePanelRole } from '../utils/adminRoles.js';
import {
    getBookieWalletTxLabel,
    getBookieWalletTxCategory,
    FROM_BOOKIE_TX_TYPES,
    FROM_BOOKIE_SUMMARY_TYPES,
    FROM_PLAYER_TX_TYPES,
    FROM_PLAYER_SUMMARY_TYPES,
    FROM_PLAYER_WITHDRAWAL_SUMMARY_TYPES,
    FROM_BOOKIE_COMMISSION_SETTLEMENT_TYPES,
    FROM_ADMIN_TX_TYPES,
    buildGrandTotalAfterByTxId,
    getGrandTotalDelta,
    isFromAdminWalletTx,
} from '../utils/bookieWalletLedger.js';

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

/**
 * List wallet ledger entries for the logged-in bookie / super_bookie operator.
 */
export const listMyBookieWalletTransactions = async (req, res) => {
    try {
        if (!isBookiePanelRole(req.admin)) {
            return res.status(403).json({
                success: false,
                message: 'Bookie panel access required',
            });
        }

        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(10, parseInt(req.query.limit, 10) || 50));
        const skip = (page - 1) * limit;

        const filter = { adminId: req.admin._id };
        if (req.query.direction === 'credit' || req.query.direction === 'debit') {
            filter.direction = req.query.direction;
        }

        const category = req.query.category;
        const operatorRoleEarly = req.admin?.role;
        if (category === 'from_bookie') {
            filter.type = { $in: FROM_BOOKIE_TX_TYPES };
        } else if (category === 'from_player') {
            filter.type = { $in: FROM_PLAYER_TX_TYPES };
        } else if (category === 'from_admin' && operatorRoleEarly === 'bookie') {
            filter.direction = 'credit';
            filter.$or = [
                { type: { $in: FROM_ADMIN_TX_TYPES } },
                {
                    type: 'balance_adjustment',
                    description: {
                        $not: /super bookie|advance commission to|commission settlement to/i,
                    },
                },
            ];
        } else if (category === 'other') {
            filter.type = { $nin: [...FROM_BOOKIE_TX_TYPES, ...FROM_PLAYER_TX_TYPES] };
        }

        const [rows, total, summaryAgg, settlementAgg, allLedgerTxs] = await Promise.all([
            BookieWalletTransaction.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            BookieWalletTransaction.countDocuments(filter),
            BookieWalletTransaction.aggregate([
                { $match: { adminId: req.admin._id } },
                {
                    $group: {
                        _id: '$type',
                        credit: {
                            $sum: {
                                $cond: [{ $eq: ['$direction', 'credit'] }, '$amount', 0],
                            },
                        },
                        debit: {
                            $sum: {
                                $cond: [{ $eq: ['$direction', 'debit'] }, '$amount', 0],
                            },
                        },
                        count: { $sum: 1 },
                    },
                },
            ]),
            BookieWalletTransaction.aggregate([
                {
                    $match: {
                        adminId: req.admin._id,
                        $or: [
                            { type: { $in: FROM_BOOKIE_COMMISSION_SETTLEMENT_TYPES } },
                            {
                                type: 'balance_adjustment',
                                direction: 'debit',
                                description: { $regex: /commission settlement/i },
                            },
                        ],
                    },
                },
                { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
            BookieWalletTransaction.find({ adminId: req.admin._id })
                .select('type direction amount description createdAt')
                .sort({ createdAt: 1, _id: 1 })
                .lean(),
        ]);

        const commissionSettled = Math.round((settlementAgg?.[0]?.total || 0) * 100) / 100;

        const summaries = {
            from_admin: {
                credit: 0,
                debit: 0,
                net: 0,
                received: 0,
                openingBalance: 0,
                commissionSettled: 0,
                count: 0,
            },
            from_bookie: {
                credit: 0,
                debit: 0,
                net: 0,
                received: 0,
                openingBalance: 0,
                commissionSettled: 0,
                count: 0,
            },
            from_player: {
                credit: 0,
                debit: 0,
                net: 0,
                received: 0,
                withdrawn: 0,
                netTotal: 0,
                count: 0,
                depositCount: 0,
                withdrawalCount: 0,
            },
            other: { credit: 0, debit: 0, net: 0, count: 0 },
        };
        let ledgerCreditAll = 0;
        let ledgerDebitAll = 0;
        for (const row of summaryAgg) {
            const cat = getBookieWalletTxCategory(row._id);
            summaries[cat].credit += row.credit || 0;
            summaries[cat].debit += row.debit || 0;
            summaries[cat].count += row.count || 0;
            ledgerCreditAll += row.credit || 0;
            ledgerDebitAll += row.debit || 0;
            if (FROM_BOOKIE_SUMMARY_TYPES.includes(row._id)) {
                summaries.from_bookie.received += row.credit || 0;
            }
            if (FROM_BOOKIE_COMMISSION_SETTLEMENT_TYPES.includes(row._id)) {
                summaries.from_bookie.commissionSettled += (row.credit || 0) + (row.debit || 0);
            }
            if (FROM_PLAYER_SUMMARY_TYPES.includes(row._id)) {
                summaries.from_player.received += row.credit || 0;
                summaries.from_player.depositCount += row.count || 0;
            }
            if (FROM_PLAYER_WITHDRAWAL_SUMMARY_TYPES.includes(row._id)) {
                summaries.from_player.withdrawn += row.debit || row.credit || 0;
                summaries.from_player.withdrawalCount += row.count || 0;
            }
        }
        for (const key of Object.keys(summaries)) {
            summaries[key].net = summaries[key].credit - summaries[key].debit;
        }
        summaries.from_player.netTotal =
            (summaries.from_player.received || 0) - (summaries.from_player.withdrawn || 0);

        const fresh = await Admin.findById(req.admin._id).select('balance role').lean();
        const currentBalance = Number(fresh?.balance ?? req.admin.balance ?? 0);
        const ledgerNetAll = ledgerCreditAll - ledgerDebitAll;
        const untrackedGap = Math.max(0, Math.round((currentBalance - ledgerNetAll) * 100) / 100);
        if (untrackedGap > 0 && fresh?.role === 'super_bookie') {
            summaries.from_bookie.openingBalance = untrackedGap;
            summaries.from_bookie.received += untrackedGap;
        }

        const settledTotal = Math.round(
            Math.max(commissionSettled, summaries.from_bookie.commissionSettled || 0) * 100
        ) / 100;
        summaries.from_bookie.commissionSettled = settledTotal;

        let advanceFromBookie = summaries.from_bookie.received || 0;
        let commissionSettledDeducted = settledTotal;

        if (fresh?.role === 'bookie') {
            let advanceToSuperBookie = 0;
            let commissionPaidToSuperBookie = 0;
            for (const row of summaryAgg) {
                if (row._id === 'balance_adjustment') {
                    advanceToSuperBookie += row.debit || 0;
                }
                if (row._id === 'initial_balance_allocated') {
                    advanceToSuperBookie += row.debit || 0;
                }
                if (FROM_BOOKIE_COMMISSION_SETTLEMENT_TYPES.includes(row._id)) {
                    commissionPaidToSuperBookie += row.debit || 0;
                }
            }
            advanceFromBookie = Math.round(advanceToSuperBookie * 100) / 100;
            commissionSettledDeducted = Math.round(commissionPaidToSuperBookie * 100) / 100;
        } else if (fresh?.role === 'super_bookie') {
            let settledFromBookie = 0;
            for (const row of summaryAgg) {
                if (FROM_BOOKIE_COMMISSION_SETTLEMENT_TYPES.includes(row._id)) {
                    settledFromBookie += row.credit || 0;
                }
            }
            commissionSettledDeducted = Math.round(settledFromBookie * 100) / 100;
        }

        summaries.from_bookie.advanceFromBookie = advanceFromBookie;
        summaries.from_bookie.commissionSettledDeducted = commissionSettledDeducted;
        summaries.from_bookie.remainingFromBookie = Math.round(
            Math.max(0, advanceFromBookie - commissionSettledDeducted) * 100
        ) / 100;

        if (fresh?.role === 'bookie') {
            let adminCredits = 0;
            let adminCount = 0;
            const allTxsForAdmin = await BookieWalletTransaction.find({ adminId: req.admin._id })
                .select('type direction amount description')
                .lean();
            for (const tx of allTxsForAdmin) {
                if (isFromAdminWalletTx(tx)) {
                    adminCredits += Number(tx.amount || 0);
                    adminCount += 1;
                }
            }
            const commissionPayments = await CommissionPayment.find({ bookieId: req.admin._id })
                .select('amount paymentType notes')
                .lean();
            let adminSettled = 0;
            for (const payment of commissionPayments) {
                if (getCommissionPaymentKind(payment) === 'settlement') {
                    adminSettled += Number(payment.amount || 0);
                }
            }
            adminSettled = Math.round(adminSettled * 100) / 100;
            summaries.from_admin.received = Math.round(adminCredits * 100) / 100;
            summaries.from_admin.credit = summaries.from_admin.received;
            summaries.from_admin.count = adminCount;
            summaries.from_admin.commissionSettled = adminSettled;
            summaries.from_admin.net = summaries.from_admin.received;
            summaries.from_admin.commissionSettledDeducted = adminSettled;
            if (untrackedGap > 0) {
                summaries.from_admin.openingBalance = untrackedGap;
                summaries.from_admin.received = round2(summaries.from_admin.received + untrackedGap);
                summaries.from_admin.credit = summaries.from_admin.received;
                summaries.from_admin.net = summaries.from_admin.received;
            }
            summaries.from_admin.advanceFromAdmin = summaries.from_admin.received;
            summaries.from_admin.remainingFromAdmin = round2(
                Math.max(0, summaries.from_admin.received - adminSettled),
            );
        }

        if (fresh?.role === 'bookie') {
            const adminComm = await getSuperBookieCommissionDisplaySummary(fresh);
            const commissionFromAdminTotal = round2(adminComm.totalCommission || 0);
            const commissionFromAdminPaid = round2(adminComm.displaySettled || 0);
            const commissionFromAdminPending = round2(adminComm.displayPending || 0);
            const advanceFromAdmin = round2(summaries.from_admin.received || 0);
            const commissionSettledDeducted = round2(
                Math.max(
                    Number(adminComm.displaySettled || 0),
                    summaries.from_admin.commissionSettledDeducted || 0,
                ),
            );
            const remainingFromAdmin = round2(
                Math.max(
                    summaries.from_admin.remainingFromAdmin || 0,
                    advanceFromAdmin - commissionSettledDeducted,
                ),
            );

            summaries.commission_from_admin = {
                totalCommission: commissionFromAdminTotal,
                totalPaid: commissionFromAdminPaid,
                totalPending: commissionFromAdminPending,
                advanceFromAdmin,
                commissionSettledDeducted,
                remainingFromAdmin,
            };

            summaries.grandTotal = {
                bookieRemaining: summaries.from_bookie.remainingFromBookie || 0,
                playerNet: summaries.from_player.netTotal || 0,
                commissionFromAdminTotal,
                commissionSettled: settledTotal,
                received: round2(
                    (summaries.from_bookie.remainingFromBookie || 0)
                    + (summaries.from_player.netTotal || 0)
                    + remainingFromAdmin,
                ),
            };
        } else {
            const superGrandTotal = round2(
                (summaries.from_bookie.remainingFromBookie || 0)
                + (summaries.from_player.netTotal || 0),
            );
            summaries.grandTotal = {
                bookieRemaining: summaries.from_bookie.remainingFromBookie || 0,
                playerDeposits: summaries.from_player.received || 0,
                playerWithdrawals: summaries.from_player.withdrawn || 0,
                playerNet: summaries.from_player.netTotal || 0,
                commissionSettled: settledTotal,
                received: superGrandTotal,
            };
        }

        let ledgerRunning = 0;
        for (const tx of allLedgerTxs) {
            ledgerRunning += getGrandTotalDelta(tx);
        }
        ledgerRunning = round2(ledgerRunning);
        const openingGap = round2(summaries.grandTotal.received - ledgerRunning);
        const grandTotalAfterByTxId = buildGrandTotalAfterByTxId(allLedgerTxs, openingGap);
        const grandTotalNow = summaries.grandTotal.received;

        const data = rows.map((row) => ({
            ...row,
            balanceAfter: grandTotalAfterByTxId.get(String(row._id)) ?? row.balanceAfter,
            label: getBookieWalletTxLabel(row.type),
            category: getBookieWalletTxCategory(row.type),
        }));

        return res.status(200).json({
            success: true,
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / limit)),
                hasNextPage: skip + rows.length < total,
                hasPrevPage: page > 1,
            },
            walletBalance: currentBalance,
            cashBalance: currentBalance,
            currentBalance: currentBalance,
            grandTotalSummary: grandTotalNow,
            operatorRole: fresh?.role || req.admin?.role,
            summaries,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
