import Bet from '../models/bet/bet.js';
import Payment from '../models/payment/payment.js';
import User from '../models/user/user.js';
import Admin from '../models/admin/admin.js';
import { Wallet } from '../models/wallet/wallet.js';
import { getBookieUserIds } from '../utils/bookieFilter.js';
import { isBookiePanelRole } from '../utils/adminRoles.js';
import { ADMIN_TAB, denyUnlessTabAccess } from '../utils/adminTabAccess.js';
import {
    aggregatePlayerBetMetrics,
    buildCommissionDateFilter,
    getCommissionDashboardForAccount,
    round2,
} from '../utils/commissionMetrics.js';

export const getReport = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const dateFilter = {};
        const bookieUserIds = await getBookieUserIds(req.admin);

        if (startDate || endDate) {
            dateFilter.createdAt = {};
            if (startDate) dateFilter.createdAt.$gte = new Date(startDate + 'T00:00:00.000Z');
            if (endDate) dateFilter.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
        }
        if (bookieUserIds !== null) {
            dateFilter.userId = { $in: bookieUserIds };
        }

        // Total revenue (from all bets)
        const totalRevenue = await Bet.aggregate([
            { $match: dateFilter },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);

        const wonFilter = { status: 'won', ...dateFilter };
        // Total payouts (from winning bets)
        const totalPayouts = await Bet.aggregate([
            { $match: wonFilter },
            { $group: { _id: null, total: { $sum: '$payout' } } },
        ]);

        // Total bets
        const totalBets = await Bet.countDocuments(dateFilter);

        // Winning and losing bets
        const winningBets = await Bet.countDocuments({ status: 'won', ...dateFilter });
        const losingBets = await Bet.countDocuments({ status: 'lost', ...dateFilter });

        // Active users (filter by bookie if applicable)
        const userFilter = bookieUserIds !== null ? { _id: { $in: bookieUserIds }, isActive: true } : { isActive: true };
        const activeUsers = await User.countDocuments(userFilter);

        // Calculate net profit
        const revenue = totalRevenue[0]?.total || 0;
        const payouts = totalPayouts[0]?.total || 0;
        const netProfit = revenue - payouts;

        // Win rate
        const winRate = totalBets > 0 ? ((winningBets / totalBets) * 100).toFixed(2) : 0;

        res.status(200).json({
            success: true,
            data: {
                totalRevenue: revenue,
                totalPayouts: payouts,
                netProfit,
                totalBets,
                activeUsers,
                winningBets,
                losingBets,
                winRate,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Revenue report.
 * - Bookie: sees their own commission-based revenue (flat % of total bet amount from their users)
 * - Admin: sees per-bookie breakdown + direct users + totals
 */
export const getRevenueReport = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const dateFilter = buildCommissionDateFilter(startDate, endDate);

        const admin = req.admin;

        // ---- BOOKIE / SUPER BOOKIE VIEW ----
        if (isBookiePanelRole(admin)) {
            const userIds = (await getBookieUserIds(admin)) || [];
            const dashboard = await getCommissionDashboardForAccount(admin, { startDate, endDate });

            if (userIds.length === 0) {
                return res.status(200).json({
                    success: true,
                    data: {
                        totalBetAmount: 0,
                        matkaBetAmount: 0,
                        lotteryBetAmount: 0,
                        totalPayouts: 0,
                        commissionPercentage: dashboard.commissionPercentage,
                        bookieRevenue: 0,
                        periodCommission: 0,
                        allTimeCommission: dashboard.allTimeCommission,
                        allTimeBetAmount: dashboard.allTimeBetAmount,
                        totalUsers: 0,
                        totalBets: 0,
                        winningBets: 0,
                        losingBets: 0,
                        paidAmount: dashboard.allTimePaid,
                        pendingAmount: dashboard.allTimePending,
                    },
                });
            }

            const metrics = await aggregatePlayerBetMetrics({ admin, dateFilter });
            const commissionPct = dashboard.commissionPercentage;

            return res.status(200).json({
                success: true,
                data: {
                    totalBetAmount: metrics.totalBetAmount,
                    matkaBetAmount: metrics.matkaBetAmount,
                    lotteryBetAmount: metrics.lotteryBetAmount,
                    totalPayouts: metrics.totalPayouts,
                    commissionPercentage: commissionPct,
                    bookieRevenue: round2((metrics.totalBetAmount * commissionPct) / 100),
                    periodCommission: dashboard.periodCommission,
                    allTimeCommission: dashboard.allTimeCommission,
                    allTimeBetAmount: dashboard.allTimeBetAmount,
                    totalUsers: userIds.length,
                    totalBets: metrics.totalBets,
                    winningBets: metrics.winningBets,
                    losingBets: metrics.losingBets,
                    paidAmount: dashboard.allTimePaid,
                    pendingAmount: dashboard.allTimePending,
                },
            });
        }

        // ---- ADMIN VIEW ----
        const bookies = await Admin.find({ role: 'bookie' }).select('_id username phone commissionPercentage status').lean();
        const superBookies = await Admin.find({ role: 'super_bookie' })
            .select('_id parentBookieId')
            .lean();
        const superBookieToParent = Object.fromEntries(
            superBookies.map((sb) => [String(sb._id), String(sb.parentBookieId)])
        );

        const allUsers = await User.find().select('_id referredBy source').lean();

        const bookieUserMap = {};
        for (const bookie of bookies) {
            bookieUserMap[String(bookie._id)] = [];
        }
        const directUserIds = [];

        for (const user of allUsers) {
            if (!user.referredBy) {
                directUserIds.push(user._id);
                continue;
            }
            const refId = String(user.referredBy);
            if (bookieUserMap[refId]) {
                bookieUserMap[refId].push(user._id);
                continue;
            }
            const parentBookieId = superBookieToParent[refId];
            if (parentBookieId && bookieUserMap[parentBookieId]) {
                bookieUserMap[parentBookieId].push(user._id);
            }
        }

        // Calculate per-bookie revenue
        const bookieRevenues = [];
        let totalBookieCommission = 0;
        let totalAdminProfit = 0;
        let grandTotalBets = 0;
        let grandTotalPayouts = 0;

        for (const bookie of bookies) {
            const bId = bookie._id.toString();
            const userIds = bookieUserMap[bId] || [];

            if (userIds.length === 0) {
                bookieRevenues.push({
                    bookieId: bookie._id,
                    bookieName: bookie.username,
                    bookiePhone: bookie.phone,
                    bookieStatus: bookie.status,
                    commissionPercentage: bookie.commissionPercentage || 0,
                    totalBetAmount: 0,
                    totalPayouts: 0,
                    bookieShare: 0,
                    adminPool: 0,
                    adminProfit: 0,
                    totalUsers: 0,
                    totalBets: 0,
                });
                continue;
            }

            const metrics = await aggregatePlayerBetMetrics({
                admin: { _id: bookie._id, role: 'bookie', commissionPercentage: bookie.commissionPercentage },
                dateFilter,
            });
            const totalBetAmount = metrics.totalBetAmount;
            const totalPayouts = metrics.totalPayouts;
            const totalBets = metrics.totalBets;
            const commPct = bookie.commissionPercentage || 0;

            const bookieShare = round2((totalBetAmount * commPct) / 100);
            const adminPool = Math.round((totalBetAmount * (100 - commPct) / 100) * 100) / 100;
            const adminProfit = Math.round((adminPool - totalPayouts) * 100) / 100;

            totalBookieCommission += bookieShare;
            totalAdminProfit += adminProfit;
            grandTotalBets += totalBetAmount;
            grandTotalPayouts += totalPayouts;

            bookieRevenues.push({
                bookieId: bookie._id,
                bookieName: bookie.username,
                bookiePhone: bookie.phone,
                bookieStatus: bookie.status,
                commissionPercentage: commPct,
                totalBetAmount,
                totalPayouts,
                bookieShare,
                adminPool,
                adminProfit,
                totalUsers: userIds.length,
                totalBets,
            });
        }

        // Direct users (admin's own users - 100% admin revenue)
        let directStats = { totalBetAmount: 0, totalPayouts: 0, adminProfit: 0, totalBets: 0 };
        if (directUserIds.length > 0) {
            const metrics = await aggregatePlayerBetMetrics({ userIds: directUserIds, dateFilter });
            const totalBetAmount = metrics.totalBetAmount;
            const totalPayouts = metrics.totalPayouts;
            const totalBets = metrics.totalBets;

            directStats = {
                totalBetAmount,
                totalPayouts,
                adminProfit: Math.round((totalBetAmount - totalPayouts) * 100) / 100,
                totalBets,
                totalUsers: directUserIds.length,
            };

            grandTotalBets += totalBetAmount;
            grandTotalPayouts += totalPayouts;
            totalAdminProfit += directStats.adminProfit;
        }

        return res.status(200).json({
            success: true,
            data: {
                bookies: bookieRevenues,
                directUsers: directStats,
                summary: {
                    grandTotalBets: Math.round(grandTotalBets * 100) / 100,
                    grandTotalPayouts: Math.round(grandTotalPayouts * 100) / 100,
                    totalBookieCommission: Math.round(totalBookieCommission * 100) / 100,
                    totalAdminProfit: Math.round(totalAdminProfit * 100) / 100,
                },
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Bookie detail: comprehensive info for a single bookie.
 * Returns bookie profile, revenue stats, users list, and recent bet history.
 * Admin only.
 */
export const getBookieRevenueDetail = async (req, res) => {
    try {
        if (denyUnlessTabAccess(res, req.admin, ADMIN_TAB.REVENUE, 'You do not have access to revenue details')) {
            return;
        }

        const { bookieId } = req.params;
        const { startDate, endDate } = req.query;

        const bookie = await Admin.findOne({ _id: bookieId, role: 'bookie' }).select('-password').lean();
        if (!bookie) {
            return res.status(404).json({ success: false, message: 'Bookie not found' });
        }

        // Date filter
        const dateFilter = {};
        if (startDate || endDate) {
            dateFilter.createdAt = {};
            if (startDate) dateFilter.createdAt.$gte = new Date(startDate + 'T00:00:00.000Z');
            if (endDate) dateFilter.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
        }

        // Get bookie's users
        const users = await User.find({ referredBy: bookieId })
            .select('_id username email phone isActive createdAt')
            .sort({ createdAt: -1 })
            .lean();
        const userIds = users.map((u) => u._id);

        // Revenue stats
        let totalBetAmount = 0;
        let totalPayouts = 0;
        let totalBetCount = 0;
        let winningBets = 0;
        let losingBets = 0;

        if (userIds.length > 0) {
            const metrics = await aggregatePlayerBetMetrics({ userIds, dateFilter });
            totalBetAmount = metrics.totalBetAmount;
            totalPayouts = metrics.totalPayouts;
            totalBetCount = metrics.totalBets;
            winningBets = metrics.winningBets;
            losingBets = metrics.losingBets;
        }

        const commPct = bookie.commissionPercentage || 0;
        const bookieShare = Math.round((totalBetAmount * commPct / 100) * 100) / 100;
        const adminPool = Math.round((totalBetAmount * (100 - commPct) / 100) * 100) / 100;
        const adminProfit = Math.round((adminPool - totalPayouts) * 100) / 100;

        // Recent bets from bookie's users (last 100)
        let recentBets = [];
        if (userIds.length > 0) {
            recentBets = await Bet.find({ userId: { $in: userIds }, ...dateFilter })
                .sort({ createdAt: -1 })
                .limit(100)
                .populate('userId', 'username')
                .populate('marketId', 'marketName')
                .lean();
        }

        // Per-user bet summary
        const userBetSummary = [];
        if (userIds.length > 0) {
            const perUser = await Bet.aggregate([
                { $match: { userId: { $in: userIds }, ...dateFilter } },
                {
                    $group: {
                        _id: '$userId',
                        totalBets: { $sum: 1 },
                        totalAmount: { $sum: '$amount' },
                        totalPayout: { $sum: { $cond: [{ $eq: ['$status', 'won'] }, '$payout', 0] } },
                        wins: { $sum: { $cond: [{ $eq: ['$status', 'won'] }, 1, 0] } },
                        losses: { $sum: { $cond: [{ $eq: ['$status', 'lost'] }, 1, 0] } },
                    },
                },
            ]);

            const userMap = {};
            for (const u of users) userMap[u._id.toString()] = u;

            for (const row of perUser) {
                const user = userMap[row._id.toString()];
                if (user) {
                    userBetSummary.push({
                        userId: user._id,
                        username: user.username,
                        phone: user.phone,
                        isActive: user.isActive,
                        totalBets: row.totalBets,
                        totalAmount: row.totalAmount,
                        totalPayout: row.totalPayout,
                        wins: row.wins,
                        losses: row.losses,
                        profit: Math.round((row.totalAmount - row.totalPayout) * 100) / 100,
                    });
                }
            }
            // Add users with 0 bets
            for (const u of users) {
                if (!perUser.find((r) => r._id.toString() === u._id.toString())) {
                    userBetSummary.push({
                        userId: u._id,
                        username: u.username,
                        phone: u.phone,
                        isActive: u.isActive,
                        totalBets: 0, totalAmount: 0, totalPayout: 0, wins: 0, losses: 0, profit: 0,
                    });
                }
            }
            userBetSummary.sort((a, b) => b.totalAmount - a.totalAmount);
        }

        return res.status(200).json({
            success: true,
            data: {
                bookie: {
                    _id: bookie._id,
                    username: bookie.username,
                    email: bookie.email,
                    phone: bookie.phone,
                    status: bookie.status,
                    commissionPercentage: commPct,
                    createdAt: bookie.createdAt,
                },
                revenue: {
                    totalBetAmount,
                    totalPayouts,
                    bookieShare,
                    adminPool,
                    adminProfit,
                    totalBetCount,
                    winningBets,
                    losingBets,
                    winRate: totalBetCount > 0 ? ((winningBets / totalBetCount) * 100).toFixed(2) : 0,
                },
                users: userBetSummary,
                totalUsers: users.length,
                recentBets: recentBets.map((b) => ({
                    _id: b._id,
                    username: b.userId?.username || '—',
                    marketName: b.marketId?.marketName || '—',
                    betType: b.betType,
                    betNumber: b.betNumber,
                    betOn: b.betOn,
                    amount: b.amount,
                    payout: b.payout,
                    status: b.status,
                    createdAt: b.createdAt,
                })),
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get customer balance overview - shows all players with their toGive, toTake, and calculated balance
 * Balance = walletBalance + toGive - toTake
 */
export const getCustomerBalanceOverview = async (req, res) => {
    try {
        const bookieUserIds = await getBookieUserIds(req.admin);
        const userFilter = bookieUserIds !== null ? { _id: { $in: bookieUserIds } } : {};

        // Get all users with their toGive and toTake
        const users = await User.find(userFilter)
            .select('_id username email phone toGive toTake createdAt')
            .sort({ createdAt: -1 })
            .lean();

        // Get wallet balances for all users
        const userIds = users.map((u) => u._id);
        const wallets = await Wallet.find({ userId: { $in: userIds } })
            .select('userId balance')
            .lean();

        // Create a map of userId -> wallet balance
        const walletMap = {};
        wallets.forEach((w) => {
            walletMap[w.userId.toString()] = w.balance || 0;
        });

        // Calculate balance for each user: walletBalance + toGive - toTake
        const customerBalances = users.map((user, index) => {
            const walletBalance = walletMap[user._id.toString()] || 0;
            const toGive = user.toGive || 0;
            const toTake = user.toTake || 0;
            const balance = walletBalance + toGive - toTake;

            return {
                srNo: index + 1,
                userId: user._id,
                name: user.username,
                email: user.email || '',
                phone: user.phone || '',
                yene: toTake, // येणे - To Receive (money player owes to bookie)
                dene: toGive, // देणे - To Give (money bookie owes to player)
                aad: balance, // आड - Balance (walletBalance + toGive - toTake)
                walletBalance: walletBalance,
            };
        });

        res.status(200).json({
            success: true,
            data: customerBalances,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
