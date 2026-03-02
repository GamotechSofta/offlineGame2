import Bet from '../models/bet/bet.js';
import Payment from '../models/payment/payment.js';
import User from '../models/user/user.js';
import Market from '../models/market/market.js';
import Admin from '../models/admin/admin.js';

import { Wallet } from '../models/wallet/wallet.js';
import HelpDesk from '../models/helpDesk/helpDesk.js';
import { getBookieUserIds } from '../utils/bookieFilter.js';
import { isBettingClosed } from '../utils/marketTiming.js';

/** Parse from/to query (YYYY-MM-DD). Returns { start, end } in UTC-like range for DB. 
 * If fromStr and toStr are not provided, returns null to indicate "all time" */
function getDateRange(fromStr, toStr) {
    // If no dates provided, return null to show all data
    if (!fromStr || !toStr) {
        return { start: null, end: null };
    }
    
    const [y1, m1, d1] = fromStr.split('-').map(Number);
    const [y2, m2, d2] = toStr.split('-').map(Number);
    
    let start = null;
    let end = null;
    
    if (!Number.isNaN(y1) && !Number.isNaN(m1) && !Number.isNaN(d1)) {
        start = new Date(y1, m1 - 1, d1);
    }
    if (!Number.isNaN(y2) && !Number.isNaN(m2) && !Number.isNaN(d2)) {
        end = new Date(y2, m2 - 1, d2, 23, 59, 59, 999);
    }
    
    // If dates are invalid, return null for "all time"
    if (!start || !end) {
        return { start: null, end: null };
    }
    
    return { start, end };
}

export const getDashboardStats = async (req, res) => {
    try {
        // Get all user IDs that belong to this bookie (via referredBy field)
        // Returns null for super_admin (no filter - see all), array of IDs for bookie, empty array if no users
        const bookieUserIds = await getBookieUserIds(req.admin);
        
        // Build filters: if bookieUserIds is null (super_admin), filter is {} (match all)
        // If bookieUserIds is array (even empty), filter by those IDs (empty array = match nothing, which is correct)
        const userFilter = bookieUserIds !== null ? { _id: { $in: bookieUserIds } } : {};
        const betFilter = bookieUserIds !== null ? { userId: { $in: bookieUserIds } } : {}; // All bets from bookie's players
        const paymentFilter = bookieUserIds !== null ? { userId: { $in: bookieUserIds } } : {};
        const walletMatch = bookieUserIds !== null ? { userId: { $in: bookieUserIds } } : {};
        const helpDeskFilter = bookieUserIds !== null ? { userId: { $in: bookieUserIds } } : {};

        const { from, to } = req.query;
        const { start: rangeStart, end: rangeEnd } = getDateRange(from, to);
        // If rangeStart is null, don't apply date filter (show all data)
        const dateMatch = (rangeStart === null || rangeEnd === null) 
            ? {} 
            : { createdAt: { $gte: rangeStart, $lte: rangeEnd } };

        const revenueMatch = { ...dateMatch, ...betFilter, status: { $ne: 'cancelled' } };
        const payoutMatch = { status: 'won', ...dateMatch, ...betFilter };
        const betCountMatch = { ...dateMatch, ...betFilter, status: { $ne: 'cancelled' } };
        const lossMatch = { status: 'lost', ...betFilter };
        const isSuperAdmin = bookieUserIds === null && req.admin?.role === 'super_admin';

        // Run all independent DB queries in parallel for faster dashboard load
        const [
            totalUsers,
            activeUsers,
            newUsersInRange,
            totalMarkets,
            allMarketsForOpen,
            mainMarkets,
            starlineMarkets,
            totalRevenue,
            totalPayouts,
            totalBets,
            winningBets,
            losingBets,
            pendingBets,
            pendingBetAmount,
            totalDeposits,
            totalWithdrawals,
            totalPayments,
            pendingPayments,
            pendingDeposits,
            pendingWithdrawals,
            totalWalletBalance,
            walletBalances,
            usersWithToGiveTake,
            totalAdvance,
            totalLoss,
            totalTickets,
            openTickets,
            inProgressTickets,
            bookiesTotal,
            bookiesActive,
        ] = await Promise.all([
            User.countDocuments(userFilter),
            User.countDocuments({ ...userFilter, isActive: true }),
            User.countDocuments({ ...userFilter, ...dateMatch }),
            Market.countDocuments(),
            Market.find().lean(),
            Market.countDocuments({ marketType: { $ne: 'startline' } }),
            Market.countDocuments({ marketType: 'startline' }),
            Bet.aggregate([{ $match: revenueMatch }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
            Bet.aggregate([{ $match: payoutMatch }, { $group: { _id: null, total: { $sum: '$payout' } } }]),
            Bet.countDocuments(betCountMatch),
            Bet.countDocuments({ status: 'won', ...dateMatch, ...betFilter }),
            Bet.countDocuments({ status: 'lost', ...dateMatch, ...betFilter }),
            Bet.countDocuments({ status: 'pending', ...betFilter }),
            Bet.aggregate([{ $match: { status: 'pending', ...betFilter } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
            Payment.aggregate([{ $match: { type: 'deposit', status: { $in: ['approved', 'completed'] }, ...dateMatch, ...paymentFilter } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
            Payment.aggregate([{ $match: { type: 'withdrawal', status: { $in: ['approved', 'completed'] }, ...dateMatch, ...paymentFilter } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
            Payment.countDocuments(paymentFilter),
            Payment.countDocuments({ status: 'pending', ...paymentFilter }),
            Payment.countDocuments({ type: 'deposit', status: 'pending', ...paymentFilter }),
            Payment.countDocuments({ type: 'withdrawal', status: 'pending', ...paymentFilter }),
            Wallet.aggregate([...(Object.keys(walletMatch).length ? [{ $match: walletMatch }] : []), { $group: { _id: null, total: { $sum: '$balance' } } }]),
            Wallet.find(walletMatch).select('balance').lean(),
            User.find(userFilter).select('toGive toTake').lean(),
            Payment.aggregate([{ $match: { type: 'deposit', status: { $in: ['approved', 'completed'] }, ...paymentFilter } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
            Bet.aggregate([{ $match: lossMatch }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
            HelpDesk.countDocuments(helpDeskFilter),
            HelpDesk.countDocuments({ status: 'open', ...helpDeskFilter }),
            HelpDesk.countDocuments({ status: 'in-progress', ...helpDeskFilter }),
            isSuperAdmin ? Admin.countDocuments({ role: 'bookie' }) : 0,
            isSuperAdmin ? Admin.countDocuments({ role: 'bookie', status: 'active' }) : 0,
        ]);

        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        let openMarkets = 0;
        let openMainMarkets = 0;
        let openStarlineMarkets = 0;
        const marketsPendingResultList = [];
        for (const m of allMarketsForOpen) {
            const startTime = parseTimeToMinutes(m.startingTime);
            const endTime = parseTimeToMinutes(m.closingTime);
            if (startTime && endTime && currentTime >= startTime && currentTime <= endTime) {
                openMarkets++;
                if (m.marketType === 'startline') openStarlineMarkets++;
                else openMainMarkets++;
            }
            if (isBettingClosed(m, now)) {
                const isStarline = m.marketType === 'startline';
                const needsResult = isStarline
                    ? !(m.openingNumber && /^\d{3}$/.test(String(m.openingNumber)))
                    : !(m.openingNumber && /^\d{3}$/.test(String(m.openingNumber)) && m.closingNumber && /^\d{3}$/.test(String(m.closingNumber)));
                if (needsResult) {
                    marketsPendingResultList.push({ _id: m._id, marketName: m.marketName, marketType: m.marketType || 'main' });
                }
            }
        }
        const marketsPendingResult = marketsPendingResultList.length;

        let toGiveFromWallet = 0;
        let toReceiveFromWallet = 0;
        walletBalances.forEach(w => {
            const bal = w.balance || 0;
            if (bal > 0) toGiveFromWallet += bal;
            else if (bal < 0) toReceiveFromWallet += Math.abs(bal);
        });
        let toGive = 0;
        let toTake = 0;
        usersWithToGiveTake.forEach(u => {
            toGive += u.toGive || 0;
            toTake += u.toTake || 0;
        });

        const bookies = { total: bookiesTotal || 0, active: bookiesActive || 0 };

        const revenue = totalRevenue[0]?.total || 0;
        const payouts = totalPayouts[0]?.total || 0;
        const netProfit = revenue - payouts;
        // Calculate Total Profit: Net Profit + (To Take - To Give)
        // This represents the overall financial position including bet profits and outstanding amounts
        const totalProfit = netProfit + (toTake - toGive);
        const winRate = totalBets > 0 ? ((winningBets / totalBets) * 100).toFixed(2) : 0;

        res.status(200).json({
            success: true,
            data: {
                dateRange: { 
                    from: rangeStart ? rangeStart.toISOString() : null, 
                    to: rangeEnd ? rangeEnd.toISOString() : null 
                },
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
                    toGive: toGiveFromWallet,
                    toReceive: toReceiveFromWallet,
                },
                toGive: toGive,
                toTake: toTake,
                totalProfit: totalProfit,
                pending: pendingBetAmount[0]?.total || 0,
                advance: totalAdvance[0]?.total || 0,
                loss: totalLoss[0]?.total || 0,
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
