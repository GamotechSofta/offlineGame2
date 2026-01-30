import Bet from '../models/bet/bet.js';
import Payment from '../models/payment/payment.js';
import User from '../models/user/user.js';

export const getReport = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const dateFilter = {};

        if (startDate || endDate) {
            dateFilter.createdAt = {};
            if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
            if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
        }

        // Total revenue (from all bets)
        const totalRevenue = await Bet.aggregate([
            { $match: dateFilter },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);

        // Total payouts (from winning bets)
        const totalPayouts = await Bet.aggregate([
            { $match: { status: 'won', ...dateFilter } },
            { $group: { _id: null, total: { $sum: '$payout' } } },
        ]);

        // Total bets
        const totalBets = await Bet.countDocuments(dateFilter);

        // Winning and losing bets
        const winningBets = await Bet.countDocuments({ status: 'won', ...dateFilter });
        const losingBets = await Bet.countDocuments({ status: 'lost', ...dateFilter });

        // Active users
        const activeUsers = await User.countDocuments({ isActive: true });

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
