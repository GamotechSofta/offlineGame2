import Bet from '../models/bet/bet.js';

export const getBetHistory = async (req, res) => {
    try {
        const { userId, marketId, status, startDate, endDate } = req.query;
        const query = {};

        if (userId) query.userId = userId;
        if (marketId) query.marketId = marketId;
        if (status) query.status = status;
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        const bets = await Bet.find(query)
            .populate('userId', 'username email')
            .populate('marketId', 'marketName')
            .sort({ createdAt: -1 })
            .limit(1000);

        res.status(200).json({ success: true, data: bets });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getTopWinners = async (req, res) => {
    try {
        const { timeRange } = req.query;
        const dateFilter = {};

        if (timeRange === 'today') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            dateFilter.createdAt = { $gte: today };
        } else if (timeRange === 'week') {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            dateFilter.createdAt = { $gte: weekAgo };
        } else if (timeRange === 'month') {
            const monthAgo = new Date();
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            dateFilter.createdAt = { $gte: monthAgo };
        }

        const winners = await Bet.aggregate([
            { $match: { status: 'won', ...dateFilter } },
            {
                $group: {
                    _id: '$userId',
                    totalWins: { $sum: 1 },
                    totalWinnings: { $sum: '$payout' },
                },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user',
                },
            },
            { $unwind: '$user' },
            {
                $project: {
                    userId: {
                        _id: '$user._id',
                        username: '$user.username',
                        email: '$user.email',
                    },
                    totalWins: 1,
                    totalWinnings: 1,
                },
            },
            { $sort: { totalWinnings: -1 } },
            { $limit: 50 },
        ]);

        // Calculate win rate
        const winnersWithRate = await Promise.all(
            winners.map(async (winner) => {
                const totalBets = await Bet.countDocuments({ userId: winner._id, ...dateFilter });
                const winRate = totalBets > 0 ? ((winner.totalWins / totalBets) * 100).toFixed(2) : 0;
                return { ...winner, winRate };
            })
        );

        res.status(200).json({ success: true, data: winnersWithRate });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
