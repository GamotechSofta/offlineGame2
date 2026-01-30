import Bet from '../models/bet/bet.js';
import Payment from '../models/payment/payment.js';
import User from '../models/user/user.js';
import Market from '../models/market/market.js';
import { Wallet } from '../models/wallet/wallet.js';
import HelpDesk from '../models/helpDesk/helpDesk.js';

export const getDashboardStats = async (req, res) => {
    try {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const thisWeek = new Date(today);
        thisWeek.setDate(thisWeek.getDate() - 7);
        const thisMonth = new Date(today);
        thisMonth.setMonth(thisMonth.getMonth() - 1);

        // Total Users
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ isActive: true });
        const newUsersToday = await User.countDocuments({ createdAt: { $gte: today } });
        const newUsersThisWeek = await User.countDocuments({ createdAt: { $gte: thisWeek } });
        const newUsersThisMonth = await User.countDocuments({ createdAt: { $gte: thisMonth } });

        // Total Markets
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

        // Revenue Stats
        const totalRevenue = await Bet.aggregate([
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);
        const totalPayouts = await Bet.aggregate([
            { $match: { status: 'won' } },
            { $group: { _id: null, total: { $sum: '$payout' } } },
        ]);
        const revenueToday = await Bet.aggregate([
            { $match: { createdAt: { $gte: today } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);
        const revenueThisWeek = await Bet.aggregate([
            { $match: { createdAt: { $gte: thisWeek } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);
        const revenueThisMonth = await Bet.aggregate([
            { $match: { createdAt: { $gte: thisMonth } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);

        // Bet Stats
        const totalBets = await Bet.countDocuments();
        const betsToday = await Bet.countDocuments({ createdAt: { $gte: today } });
        const betsThisWeek = await Bet.countDocuments({ createdAt: { $gte: thisWeek } });
        const betsThisMonth = await Bet.countDocuments({ createdAt: { $gte: thisMonth } });
        const winningBets = await Bet.countDocuments({ status: 'won' });
        const losingBets = await Bet.countDocuments({ status: 'lost' });
        const pendingBets = await Bet.countDocuments({ status: 'pending' });

        // Payment Stats
        const totalPayments = await Payment.countDocuments();
        const pendingPayments = await Payment.countDocuments({ status: 'pending' });
        const totalDeposits = await Payment.aggregate([
            { $match: { type: 'deposit', status: { $in: ['approved', 'completed'] } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);
        const totalWithdrawals = await Payment.aggregate([
            { $match: { type: 'withdrawal', status: { $in: ['approved', 'completed'] } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);

        // Wallet Stats
        const totalWalletBalance = await Wallet.aggregate([
            { $group: { _id: null, total: { $sum: '$balance' } } },
        ]);

        // Help Desk Stats
        const totalTickets = await HelpDesk.countDocuments();
        const openTickets = await HelpDesk.countDocuments({ status: 'open' });
        const inProgressTickets = await HelpDesk.countDocuments({ status: 'in-progress' });

        // Calculate net profit
        const revenue = totalRevenue[0]?.total || 0;
        const payouts = totalPayouts[0]?.total || 0;
        const netProfit = revenue - payouts;

        // Win rate
        const winRate = totalBets > 0 ? ((winningBets / totalBets) * 100).toFixed(2) : 0;

        res.status(200).json({
            success: true,
            data: {
                users: {
                    total: totalUsers,
                    active: activeUsers,
                    newToday: newUsersToday,
                    newThisWeek: newUsersThisWeek,
                    newThisMonth: newUsersThisMonth,
                },
                markets: {
                    total: totalMarkets,
                    open: openMarkets,
                },
                revenue: {
                    total: revenue,
                    today: revenueToday[0]?.total || 0,
                    thisWeek: revenueThisWeek[0]?.total || 0,
                    thisMonth: revenueThisMonth[0]?.total || 0,
                    payouts: payouts,
                    netProfit: netProfit,
                },
                bets: {
                    total: totalBets,
                    today: betsToday,
                    thisWeek: betsThisWeek,
                    thisMonth: betsThisMonth,
                    winning: winningBets,
                    losing: losingBets,
                    pending: pendingBets,
                    winRate: parseFloat(winRate),
                },
                payments: {
                    total: totalPayments,
                    pending: pendingPayments,
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
