import Admin from '../models/admin/admin.js';
import BookieWalletTransaction from '../models/bookieWalletTransaction/bookieWalletTransaction.js';
import { isBookiePanelRole } from '../utils/adminRoles.js';
import {
    getBookieWalletTxLabel,
    getBookieWalletTxCategory,
    FROM_BOOKIE_TX_TYPES,
    FROM_BOOKIE_SUMMARY_TYPES,
    FROM_PLAYER_TX_TYPES,
    FROM_PLAYER_SUMMARY_TYPES,
    FROM_PLAYER_WITHDRAWAL_SUMMARY_TYPES,
} from '../utils/bookieWalletLedger.js';

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
        if (category === 'from_bookie') {
            filter.type = { $in: FROM_BOOKIE_TX_TYPES };
        } else if (category === 'from_player') {
            filter.type = { $in: FROM_PLAYER_TX_TYPES };
        } else if (category === 'other') {
            filter.type = { $nin: [...FROM_BOOKIE_TX_TYPES, ...FROM_PLAYER_TX_TYPES] };
        }

        const [rows, total, summaryAgg] = await Promise.all([
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
        ]);

        const summaries = {
            from_bookie: { credit: 0, debit: 0, net: 0, received: 0, openingBalance: 0, count: 0 },
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

        summaries.grandTotal = {
            bookieReceived: summaries.from_bookie.received || 0,
            playerDeposits: summaries.from_player.received || 0,
            playerWithdrawals: summaries.from_player.withdrawn || 0,
            received:
                (summaries.from_bookie.received || 0) + (summaries.from_player.netTotal || 0),
        };

        const data = rows.map((row) => ({
            ...row,
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
            currentBalance,
            summaries,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
