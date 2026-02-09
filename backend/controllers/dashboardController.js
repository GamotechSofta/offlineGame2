import Bet from '../models/bet/bet.js';
import Payment from '../models/payment/payment.js';
import User from '../models/user/user.js';
import Market from '../models/market/market.js';
import Admin from '../models/admin/admin.js';

import { Wallet } from '../models/wallet/wallet.js';
import HelpDesk from '../models/helpDesk/helpDesk.js';
import { getBookieUserIds } from '../utils/bookieFilter.js';
import { isBettingClosed } from '../utils/marketTiming.js';

/** Parse from/to query (YYYY-MM-DD). Default to today if missing. Returns { start, end } in UTC-like range for DB. */
function getDateRange(fromStr, toStr) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let start = new Date(today);
    let end = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
    if (fromStr && toStr) {
        const [y1, m1, d1] = fromStr.split('-').map(Number);
        const [y2, m2, d2] = toStr.split('-').map(Number);
        if (!Number.isNaN(y1) && !Number.isNaN(m1) && !Number.isNaN(d1)) {
            start = new Date(y1, m1 - 1, d1);
        }
        if (!Number.isNaN(y2) && !Number.isNaN(m2) && !Number.isNaN(d2)) {
            end = new Date(y2, m2 - 1, d2, 23, 59, 59, 999);
        }
    }
    return { start, end };
}

export const getDashboardStats = async (req, res) => {
    try {
        const bookieUserIds = await getBookieUserIds(req.admin);
        const userFilter = bookieUserIds !== null ? { _id: { $in: bookieUserIds } } : {};
        const betFilter = bookieUserIds !== null ? { userId: { $in: bookieUserIds } } : {};
        const paymentFilter = bookieUserIds !== null ? { userId: { $in: bookieUserIds } } : {};
        const walletMatch = bookieUserIds !== null ? { userId: { $in: bookieUserIds } } : {};
        const helpDeskFilter = bookieUserIds !== null ? { userId: { $in: bookieUserIds } } : {};

        const { from, to } = req.query;
        const { start: rangeStart, end: rangeEnd } = getDateRange(from, to);
        const dateMatch = { createdAt: { $gte: rangeStart, $lte: rangeEnd } };

        // Total Users (all-time)
        const totalUsers = await User.countDocuments(userFilter);
        const activeUsers = await User.countDocuments({ ...userFilter, isActive: true });
        const newUsersInRange = await User.countDocuments({ ...userFilter, ...dateMatch });

        // Total Markets (all-time, current open)
        const totalMarkets = await Market.countDocuments();
        const openMarkets = await Market.find().then(markets => {
            return markets.filter(m => {
                const now = new Date();
                const currentTime = now.getHours() * 60 + now.getMinutes();
                const startTime = parseTimeToMinutes(m.startingTime);
                const endTime = parseTimeToMinutes(m.closingTime);
                return startTime && endTime && currentTime >= startTime && currentTime <= endTime;
            }).length;
        });

        // Revenue & Bets in selected range
        const totalRevenue = await Bet.aggregate([
            { $match: { ...dateMatch, ...betFilter } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);
        const totalPayouts = await Bet.aggregate([
            { $match: { status: 'won', ...dateMatch, ...betFilter } },
            { $group: { _id: null, total: { $sum: '$payout' } } },
        ]);
        const totalBets = await Bet.countDocuments({ ...dateMatch, ...betFilter });
        const winningBets = await Bet.countDocuments({ status: 'won', ...dateMatch, ...betFilter });
        const losingBets = await Bet.countDocuments({ status: 'lost', ...dateMatch, ...betFilter });
        const pendingBets = await Bet.countDocuments({ status: 'pending', ...betFilter });

        // Payments in range (deposits/withdrawals completed in period)
        const totalDeposits = await Payment.aggregate([
            { $match: { type: 'deposit', status: { $in: ['approved', 'completed'] }, ...dateMatch, ...paymentFilter } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);
        const totalWithdrawals = await Payment.aggregate([
            { $match: { type: 'withdrawal', status: { $in: ['approved', 'completed'] }, ...dateMatch, ...paymentFilter } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);

        // All-time payment counts (for reference)
        const totalPayments = await Payment.countDocuments(paymentFilter);
        const pendingPayments = await Payment.countDocuments({ status: 'pending', ...paymentFilter });
        const pendingDeposits = await Payment.countDocuments({ type: 'deposit', status: 'pending', ...paymentFilter });
        const pendingWithdrawals = await Payment.countDocuments({ type: 'withdrawal', status: 'pending', ...paymentFilter });

        // Markets by type (main vs starline)
        const mainMarkets = await Market.countDocuments({ marketType: { $ne: 'startline' } });
        const starlineMarkets = await Market.countDocuments({ marketType: 'startline' });
        const allMarketsForOpen = await Market.find();
        let openMainMarkets = 0;
        let openStarlineMarkets = 0;
        for (const m of allMarketsForOpen) {
            const now = new Date();
            const currentTime = now.getHours() * 60 + now.getMinutes();
            const startTime = parseTimeToMinutes(m.startingTime);
            const endTime = parseTimeToMinutes(m.closingTime);
            if (startTime && endTime && currentTime >= startTime && currentTime <= endTime) {
                if (m.marketType === 'startline') openStarlineMarkets++;
                else openMainMarkets++;
            }
        }

        // Markets pending result (betting closed but result not declared)
        const now = new Date();
        const marketsPendingResultList = [];
        for (const m of allMarketsForOpen) {
            if (!isBettingClosed(m, now)) continue;
            const isStarline = m.marketType === 'startline';
            const needsResult = isStarline
                ? !(m.openingNumber && /^\d{3}$/.test(String(m.openingNumber)))
                : !(m.openingNumber && /^\d{3}$/.test(String(m.openingNumber)) && m.closingNumber && /^\d{3}$/.test(String(m.closingNumber)));
            if (needsResult) {
                marketsPendingResultList.push({ _id: m._id, marketName: m.marketName, marketType: m.marketType || 'main' });
            }
        }
        const marketsPendingResult = marketsPendingResultList.length;

        // Bookies & Commission (super_admin only – when bookieUserIds is null)
        let bookies = { total: 0, active: 0 };
        if (bookieUserIds === null && req.admin?.role === 'super_admin') {
            bookies.total = await Admin.countDocuments({ role: 'bookie' });
            bookies.active = await Admin.countDocuments({ role: 'bookie', status: 'active' });
        }

        // Wallet & Help Desk (all-time)
        const totalWalletBalance = await Wallet.aggregate([
            ...(Object.keys(walletMatch).length ? [{ $match: walletMatch }] : []),
            { $group: { _id: null, total: { $sum: '$balance' } } },
        ]);
        const totalTickets = await HelpDesk.countDocuments(helpDeskFilter);
        const openTickets = await HelpDesk.countDocuments({ status: 'open', ...helpDeskFilter });
        const inProgressTickets = await HelpDesk.countDocuments({ status: 'in-progress', ...helpDeskFilter });

        const revenue = totalRevenue[0]?.total || 0;
        const payouts = totalPayouts[0]?.total || 0;
        const netProfit = revenue - payouts;
        const winRate = totalBets > 0 ? ((winningBets / totalBets) * 100).toFixed(2) : 0;

        res.status(200).json({
            success: true,
            data: {
                dateRange: { from: rangeStart.toISOString(), to: rangeEnd.toISOString() },
                users: {
                    total: totalUsers,
                    active: activeUsers,
                    newToday: newUsersInRange,
                    newThisWeek: newUsersInRange,
                    newThisMonth: newUsersInRange,
                },
                markets: {
                    total: totalMarkets,
                    open: openMarkets,
                    main: mainMarkets,
                    starline: starlineMarkets,
                    openMain: openMainMarkets,
                    openStarline: openStarlineMarkets,
                },
                revenue: {
                    total: revenue,
                    today: revenue,
                    thisWeek: revenue,
                    thisMonth: revenue,
                    payouts: payouts,
                    netProfit: netProfit,
                },
                bets: {
                    total: totalBets,
                    today: totalBets,
                    thisWeek: totalBets,
                    thisMonth: totalBets,
                    winning: winningBets,
                    losing: losingBets,
                    pending: pendingBets,
                    winRate: parseFloat(winRate),
                },
                payments: {
                    total: totalPayments,
                    pending: pendingPayments,
                    pendingDeposits,
                    pendingWithdrawals,
                    totalDeposits: totalDeposits[0]?.total || 0,
                    totalWithdrawals: totalWithdrawals[0]?.total || 0,
                },
                wallet: {
                    totalBalance: totalWalletBalance[0]?.total || 0,
                },
                helpDesk: {
                    total: totalTickets,
                    open: openTickets,
                    inProgress: inProgressTickets,
                },
                bookies,
                marketsPendingResult,
                marketsPendingResultList,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

function parseTimeToMinutes(timeStr) {
    if (!timeStr) return null;
    const [hour, min] = timeStr.split(':').map(Number);
    if (hour >= 0 && hour < 24 && min >= 0 && min < 60) {
        return hour * 60 + min;
    }
    return null;
}
