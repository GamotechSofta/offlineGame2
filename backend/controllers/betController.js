import Bet from '../models/bet/bet.js';
import User from '../models/user/user.js';
import Market from '../models/market/market.js';
import { Wallet, WalletTransaction } from '../models/wallet/wallet.js';
import { getBookieUserIds } from '../utils/bookieFilter.js';
import { isBettingAllowed } from '../utils/marketTiming.js';

const VALID_BET_TYPES = ['single', 'jodi', 'panna', 'half-sangam', 'full-sangam'];

/**
 * Place bets (user-facing). Body: { userId, marketId, bets: [ { betType, betNumber, amount } ] }
 * Deducts total amount from wallet, creates Bet records. Returns new balance.
 */
export const placeBet = async (req, res) => {
    try {
        const { userId, marketId, bets } = req.body;

        if (!userId || !marketId || !Array.isArray(bets) || bets.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'userId, marketId and non-empty bets array are required',
            });
        }

        const user = await User.findById(userId).select('isActive').lean();
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been suspended. Please contact admin.',
                code: 'ACCOUNT_SUSPENDED',
            });
        }

        const market = await Market.findById(marketId).lean();
        if (!market) {
            return res.status(404).json({ success: false, message: 'Market not found' });
        }

        const timing = isBettingAllowed(market);
        if (!timing.allowed) {
            return res.status(400).json({
                success: false,
                message: timing.message || 'Betting is not allowed for this market at this time.',
                code: 'BETTING_CLOSED',
            });
        }

        const sanitized = [];
        let totalAmount = 0;
        for (const b of bets) {
            const betType = (b.betType || '').toString().trim().toLowerCase();
            const betNumber = (b.betNumber || '').toString().trim();
            const amount = Number(b.amount);
            if (!VALID_BET_TYPES.includes(betType) || !betNumber || !Number.isFinite(amount) || amount <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Each bet must have betType, betNumber and amount > 0',
                });
            }
            totalAmount += amount;
            sanitized.push({ betType, betNumber, amount });
        }

        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            wallet = new Wallet({ userId, balance: 0 });
            await wallet.save();
        }

        if (wallet.balance < totalAmount) {
            return res.status(400).json({
                success: false,
                message: `Insufficient balance. Required: ₹${totalAmount}, Available: ₹${wallet.balance}`,
            });
        }

        wallet.balance -= totalAmount;
        await wallet.save();

        const betIds = [];
        const createdBets = [];
        for (const { betType, betNumber, amount } of sanitized) {
            const bet = await Bet.create({
                userId,
                marketId,
                betType,
                betNumber,
                amount,
                status: 'pending',
                payout: 0,
            });
            betIds.push(bet._id);
            createdBets.push(bet);
        }

        await WalletTransaction.create({
            userId,
            type: 'debit',
            amount: totalAmount,
            description: `Bet placed – ${market.marketName} (${bets.length} bet(s))`,
            referenceId: betIds[0]?.toString() || marketId,
        });

        res.status(201).json({
            success: true,
            message: 'Bet placed successfully',
            data: {
                newBalance: wallet.balance,
                betIds,
                totalAmount,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message || 'Failed to place bet' });
    }
};

export const getBetHistory = async (req, res) => {
    try {
        const { userId, marketId, status, startDate, endDate } = req.query;
        const query = {};

        const bookieUserIds = await getBookieUserIds(req.admin);
        if (bookieUserIds !== null) {
            query.userId = { $in: bookieUserIds };
            if (userId) {
                const ids = bookieUserIds.map((id) => id.toString());
                if (ids.includes(userId)) query.userId = userId;
            }
        } else if (userId) {
            query.userId = userId;
        }
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
        const bookieUserIds = await getBookieUserIds(req.admin);

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

        const matchStage = { status: 'won', ...dateFilter };
        if (bookieUserIds !== null) {
            matchStage.userId = { $in: bookieUserIds };
        }

        const winners = await Bet.aggregate([
            { $match: matchStage },
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
