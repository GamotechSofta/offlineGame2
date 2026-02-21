import mongoose from 'mongoose';
import PDFDocument from 'pdfkit';
import Bet from '../models/bet/bet.js';
import User from '../models/user/user.js';
import Market from '../models/market/market.js';
import Admin from '../models/admin/admin.js';
import { Wallet, WalletTransaction } from '../models/wallet/wallet.js';
import { getBookieUserIds } from '../utils/bookieFilter.js';
import { isBettingAllowed, isBettingAllowedForSession } from '../utils/marketTiming.js';

const VALID_BET_TYPES = ['single', 'jodi', 'panna', 'half-sangam', 'full-sangam'];
const THREE_DIGITS = /^\d{3}$/;

const normalizeBetOn = (v) => {
    const s = String(v ?? '').trim().toLowerCase();
    if (!s) return null;
    if (s === 'open') return 'open';
    if (s === 'close' || s === 'closed') return 'close';
    if (s === 'o') return 'open';
    if (s === 'c') return 'close';
    if (s === 'openbet') return 'open';
    if (s === 'closebet') return 'close';
    // Also accept UI strings
    if (s === 'open ') return 'open';
    if (s === 'close ') return 'close';
    return null;
};

/**
 * Place bets (user-facing). Body: { userId, marketId, bets: [ { betType, betNumber, amount } ] }
 * Deducts total amount from wallet, creates Bet records. Returns new balance.
 */
export const placeBet = async (req, res) => {
    try {
        const { userId, marketId, bets, scheduledDate } = req.body;

        if (!userId || !marketId || !Array.isArray(bets) || bets.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'userId, marketId and non-empty bets array are required',
            });
        }

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: 'Invalid userId' });
        }
        if (!mongoose.Types.ObjectId.isValid(marketId)) {
            return res.status(400).json({ success: false, message: 'Invalid marketId' });
        }

        const user = await User.findById(userId).select('isActive referredBy').lean();
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

        // Get bookie ID if user is referred by a bookie (for reference only, commission calculated at end of day)
        let bookieId = null;
        if (user.referredBy) {
            const bookie = await Admin.findById(user.referredBy).select('_id').lean();
            if (bookie) {
                bookieId = bookie._id;
            }
        }

        const market = await Market.findById(marketId).lean();
        if (!market) {
            return res.status(404).json({ success: false, message: 'Market not found' });
        }

        // Determine default session for bets (open vs close).
        // For main markets: if opening is declared, bets are "close" session; else "open".
        // For startline: single result market; treat as "open".
        const defaultBetOn =
            market?.marketType === 'startline'
                ? 'open'
                : (market?.openingNumber && THREE_DIGITS.test(String(market.openingNumber)) ? 'close' : 'open');

        if (!isBettingAllowed(market).allowed) {
            return res.status(400).json({
                success: false,
                message: 'Betting is not allowed for this market at this time.',
                code: 'BETTING_CLOSED',
            });
        }

        const sanitized = [];
        let totalAmount = 0;
        const now = new Date();
        for (const b of bets) {
            const betType = (b.betType || '').toString().trim().toLowerCase();
            const betNumber = (b.betNumber || '').toString().trim();
            const amount = Number(b.amount);
            const betOnOverride =
                normalizeBetOn(b.betOn) ||
                normalizeBetOn(b.session) ||
                // some UI code may send `type: 'OPEN' | 'CLOSE'`
                normalizeBetOn(b.type);
            const betOn = betOnOverride || defaultBetOn;
            if (!VALID_BET_TYPES.includes(betType) || !betNumber || !Number.isFinite(amount) || amount <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Each bet must have betType, betNumber and amount > 0',
                });
            }
            const timing = isBettingAllowedForSession(market, now, betOn);
            if (!timing.allowed) {
                return res.status(400).json({
                    success: false,
                    message: timing.message || 'Betting is not allowed for this session at this time.',
                    code: 'BETTING_CLOSED',
                });
            }
            totalAmount += amount;
            sanitized.push({ betType, betNumber, amount, betOn });
        }

        // Use atomic operation to prevent race conditions
        // Try to decrement balance atomically - this will fail if balance is insufficient
        const walletUpdate = await Wallet.findOneAndUpdate(
            { userId, balance: { $gte: totalAmount } },
            { $inc: { balance: -totalAmount } },
            { new: true, upsert: false }
        );

        if (!walletUpdate) {
            // Check if wallet exists to provide better error message
            const existingWallet = await Wallet.findOne({ userId });
            const currentBalance = existingWallet?.balance ?? 0;
            return res.status(400).json({
                success: false,
                message: `Insufficient balance. Required: ₹${totalAmount}, Available: ₹${currentBalance}`,
            });
        }

        const wallet = walletUpdate;

        // Validate scheduledDate if provided
        let scheduledDateObj = null;
        let isScheduled = false;
        if (scheduledDate) {
            scheduledDateObj = new Date(scheduledDate);
            if (isNaN(scheduledDateObj.getTime())) {
                // Rollback: restore balance atomically
                await Wallet.findOneAndUpdate(
                    { userId },
                    { $inc: { balance: totalAmount } },
                    { upsert: false }
                );
                return res.status(400).json({
                    success: false,
                    message: 'Invalid scheduledDate format',
                });
            }
            // Ensure scheduled date is in the future
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            scheduledDateObj.setHours(0, 0, 0, 0);
            if (scheduledDateObj < now) {
                // Rollback: restore balance atomically
                await Wallet.findOneAndUpdate(
                    { userId },
                    { $inc: { balance: totalAmount } },
                    { upsert: false }
                );
                return res.status(400).json({
                    success: false,
                    message: 'Scheduled date must be today or in the future',
                });
            }
            isScheduled = true;
        }

        const betIds = [];
        const createdBets = [];
        try {
            for (const { betType, betNumber, amount, betOn } of sanitized) {
                const bet = await Bet.create({
                    userId,
                    marketId,
                    betOn,
                    betType,
                    betNumber,
                    amount,
                    status: 'pending',
                    payout: 0,
                    scheduledDate: scheduledDateObj,
                    isScheduled: isScheduled,
                    commissionAmount: 0, // Commission calculated at end of day
                    commissionPercentage: 0, // Commission calculated at end of day
                    placedByBookieId: bookieId,
                });
                betIds.push(bet._id);
                createdBets.push(bet);
            }
        } catch (createErr) {
            // Rollback: restore balance atomically
            await Wallet.findOneAndUpdate(
                { userId },
                { $inc: { balance: totalAmount } },
                { upsert: false }
            );
            throw createErr;
        }

        const labelForType = (t) => {
            const s = String(t || '').toLowerCase();
            if (s === 'single') return 'Single Ank';
            if (s === 'jodi') return 'Digit';
            if (s === 'panna') return 'Panna';
            if (s === 'half-sangam') return 'Half Sangam';
            if (s === 'full-sangam') return 'Full Sangam';
            return 'Bet';
        };

        try {
            if (createdBets.length > 0) {
                await WalletTransaction.insertMany(
                    createdBets.map((b) => ({
                        userId,
                        type: 'debit',
                        amount: Number(b.amount) || 0,
                        description: `Bet placed – ${market.marketName} (${labelForType(b.betType)} ${String(b.betNumber || '').trim()})`,
                        referenceId: b._id.toString(),
                    }))
                );
            }
        } catch (txErr) {
            // Rollback: restore balance atomically
            await Wallet.findOneAndUpdate(
                { userId },
                { $inc: { balance: totalAmount } },
                { upsert: false }
            );
            throw txErr;
        }

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
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: 'Invalid id format for user or market' });
        }
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: error.message || 'Validation failed' });
        }
        console.error('[placeBet]', error.message || error);
        res.status(500).json({ success: false, message: error.message || 'Failed to place bet' });
    }
};

/**
 * Bookie places bet on behalf of a player.
 * Requires bookie auth (verifyAdmin). Bookie can only bet for their own referred users.
 * Body: { userId, marketId, bets: [ { betType, betNumber, amount, betOn? } ] }
 */
export const placeBetForPlayer = async (req, res) => {
    try {
        const bookie = req.admin;
        if (!bookie || bookie.role !== 'bookie') {
            return res.status(403).json({ success: false, message: 'Bookie access required' });
        }

        const { userId, marketId, bets } = req.body;

        if (!userId || !marketId || !Array.isArray(bets) || bets.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'userId, marketId and non-empty bets array are required',
            });
        }

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: 'Invalid userId' });
        }
        if (!mongoose.Types.ObjectId.isValid(marketId)) {
            return res.status(400).json({ success: false, message: 'Invalid marketId' });
        }

        // Verify this player belongs to the bookie
        const user = await User.findById(userId).select('isActive referredBy username').lean();
        if (!user) {
            return res.status(404).json({ success: false, message: 'Player not found' });
        }
        if (String(user.referredBy) !== String(bookie._id)) {
            return res.status(403).json({ success: false, message: 'You can only place bets for your own players' });
        }
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: 'This player account is suspended.',
            });
        }

        const market = await Market.findById(marketId).lean();
        if (!market) {
            return res.status(404).json({ success: false, message: 'Market not found' });
        }

        const defaultBetOn =
            market?.marketType === 'startline'
                ? 'open'
                : (market?.openingNumber && THREE_DIGITS.test(String(market.openingNumber)) ? 'close' : 'open');

        if (!isBettingAllowed(market).allowed) {
            return res.status(400).json({
                success: false,
                message: 'Betting is not allowed for this market at this time.',
                code: 'BETTING_CLOSED',
            });
        }

        const sanitized = [];
        let totalAmount = 0;
        const now = new Date();
        for (const b of bets) {
            const betType = (b.betType || '').toString().trim().toLowerCase();
            const betNumber = (b.betNumber || '').toString().trim();
            const amount = Number(b.amount);
            const betOnOverride =
                normalizeBetOn(b.betOn) ||
                normalizeBetOn(b.session) ||
                normalizeBetOn(b.type);
            const betOn = betOnOverride || defaultBetOn;
            if (!VALID_BET_TYPES.includes(betType) || !betNumber || !Number.isFinite(amount) || amount <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Each bet must have betType, betNumber and amount > 0',
                });
            }
            const timing = isBettingAllowedForSession(market, now, betOn);
            if (!timing.allowed) {
                return res.status(400).json({
                    success: false,
                    message: timing.message || 'Betting is not allowed for this session at this time.',
                    code: 'BETTING_CLOSED',
                });
            }
            totalAmount += amount;
            sanitized.push({ betType, betNumber, amount, betOn });
        }

        // Use atomic operation to prevent race conditions
        // Try to decrement balance atomically - this will fail if balance is insufficient
        const walletUpdate = await Wallet.findOneAndUpdate(
            { userId, balance: { $gte: totalAmount } },
            { $inc: { balance: -totalAmount } },
            { new: true, upsert: false }
        );

        if (!walletUpdate) {
            // Check if wallet exists to provide better error message
            const existingWallet = await Wallet.findOne({ userId });
            const currentBalance = existingWallet?.balance ?? 0;
            return res.status(400).json({
                success: false,
                message: `Insufficient balance. Required: ₹${totalAmount}, Available: ₹${currentBalance}`,
            });
        }

        const wallet = walletUpdate;

        const betIds = [];
        const createdBets = [];
        try {
            for (const { betType, betNumber, amount, betOn } of sanitized) {
                const bet = await Bet.create({
                    userId,
                    marketId,
                    betOn,
                    betType,
                    betNumber,
                    amount,
                    status: 'pending',
                    payout: 0,
                    placedByBookie: true,
                    placedByBookieId: bookie._id,
                    commissionAmount: 0, // Commission calculated at end of day
                    commissionPercentage: 0, // Commission calculated at end of day
                });
                betIds.push(bet._id);
                createdBets.push(bet);
            }
        } catch (createErr) {
            // Rollback: restore balance atomically
            await Wallet.findOneAndUpdate(
                { userId },
                { $inc: { balance: totalAmount } },
                { upsert: false }
            );
            throw createErr;
        }

        const labelForType = (t) => {
            const s = String(t || '').toLowerCase();
            if (s === 'single') return 'Single Ank';
            if (s === 'jodi') return 'Digit';
            if (s === 'panna') return 'Panna';
            if (s === 'half-sangam') return 'Half Sangam';
            if (s === 'full-sangam') return 'Full Sangam';
            return 'Bet';
        };

        try {
            if (createdBets.length > 0) {
                await WalletTransaction.insertMany(
                    createdBets.map((b) => ({
                        userId,
                        type: 'debit',
                        amount: Number(b.amount) || 0,
                        description: `Bet placed by bookie – ${market.marketName} (${labelForType(b.betType)} ${String(b.betNumber || '').trim()})`,
                        referenceId: b._id.toString(),
                    }))
                );
            }
        } catch (txErr) {
            // Rollback: restore balance atomically
            await Wallet.findOneAndUpdate(
                { userId },
                { $inc: { balance: totalAmount } },
                { upsert: false }
            );
            throw txErr;
        }

        res.status(201).json({
            success: true,
            message: `Bet placed successfully for ${user.username}`,
            data: {
                newBalance: wallet.balance,
                betIds,
                totalAmount,
                playerName: user.username,
            },
        });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: 'Invalid id format' });
        }
        console.error('[placeBetForPlayer]', error.message || error);
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
            .populate('userId', 'username email phone')
            .populate({ path: 'marketId', select: 'marketName', model: Market })
            .populate('placedByBookieId', 'username')
            .sort({ createdAt: -1 })
            .limit(1000);

        res.status(200).json({ success: true, data: bets });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get bets placed by users (not by bookie)
 * GET /api/v1/bets/by-user?userId=&marketId=&status=&startDate=&endDate=
 * Returns bets where placedByBookie is false or not set (bets placed directly by users)
 */
export const getBetsByUser = async (req, res) => {
    try {
        const { userId, marketId, status, startDate, endDate } = req.query;
        const query = {};

        // Only get bets placed by users themselves (not by bookie)
        query.$or = [
            { placedByBookie: false },
            { placedByBookie: { $exists: false } }
        ];

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
            .populate('userId', 'username phone email')
            .populate({ path: 'marketId', select: 'marketName gameName', model: Market })
            .sort({ createdAt: -1 })
            .limit(1000);

        res.status(200).json({ success: true, data: bets });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get bet sessions - groups bets placed together (same userId, marketId, within 5 seconds)
 * GET /api/v1/bets/sessions?userId=&marketId=&startDate=&endDate=
 * Returns array of sessions, each containing session info and bets array
 */
export const getBetSessions = async (req, res) => {
    try {
        const { userId, marketId, startDate, endDate } = req.query;
        const bookie = req.admin; // Current bookie admin
        
        if (!bookie || bookie.role !== 'bookie') {
            return res.status(403).json({ success: false, message: 'Bookie access required' });
        }

        const query = {};

        // Only get bets placed by this specific bookie
        query.placedByBookie = true;
        query.placedByBookieId = bookie._id;

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
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                query.createdAt.$gte = start;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.createdAt.$lte = end;
            }
        }

        const bets = await Bet.find(query)
            .populate('userId', 'username phone email')
            .populate({ path: 'marketId', select: 'marketName', model: Market })
            .sort({ createdAt: -1 })
            .limit(5000)
            .lean();

        // Group bets by userId, marketId, and createdAt (within 5 seconds)
        const sessionsMap = new Map();
        const SESSION_WINDOW_MS = 5000; // 5 seconds

        bets.forEach((bet) => {
            const betTime = new Date(bet.createdAt).getTime();
            const userId = String(bet.userId?._id || bet.userId);
            const marketId = String(bet.marketId?._id || bet.marketId);
            
            // Find existing session within window
            let sessionKey = null;
            for (const [key, session] of sessionsMap.entries()) {
                const [sUserId, sMarketId, sTime] = key.split('|');
                const sessionTime = Number(sTime);
                if (sUserId === userId && sMarketId === marketId && Math.abs(betTime - sessionTime) <= SESSION_WINDOW_MS) {
                    sessionKey = key;
                    break;
                }
            }

            if (!sessionKey) {
                // Create new session
                sessionKey = `${userId}|${marketId}|${betTime}`;
                sessionsMap.set(sessionKey, {
                    sessionId: sessionKey,
                    userId: bet.userId?._id || bet.userId,
                    playerName: bet.userId?.username || '',
                    playerPhone: bet.userId?.phone || '',
                    marketId: bet.marketId?._id || bet.marketId,
                    marketName: bet.marketId?.marketName || '',
                    createdAt: bet.createdAt,
                    totalBets: 0,
                    totalAmount: 0,
                    bets: [],
                });
            }

            const session = sessionsMap.get(sessionKey);
            session.bets.push(bet);
            session.totalBets += 1;
            session.totalAmount += bet.amount || 0;
        });

        // Convert map to array and sort by createdAt (newest first)
        const sessions = Array.from(sessionsMap.values()).sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );

        res.status(200).json({ success: true, data: sessions });
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

/**
 * Download bet statement for a player (PDF format)
 * Query params: userId (required), startDate (optional), endDate (optional)
 * Shows all bets for the player (both placed by bookie and directly by player)
 */
export const downloadBetStatement = async (req, res) => {
    try {
        const { userId, startDate, endDate } = req.query;

        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: 'Valid userId is required' });
        }

        // Verify user exists and get bookie filter
        const user = await User.findById(userId).select('username email phone').lean();
        if (!user) {
            return res.status(404).json({ success: false, message: 'Player not found' });
        }

        // Check if bookie can access this player
        const bookieUserIds = await getBookieUserIds(req.admin);
        if (bookieUserIds !== null && !bookieUserIds.some(id => id.toString() === userId)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // Build query for bets - show all bets for the player
        const query = {
            userId,
            // Show all bets (both placed by bookie and directly by player)
        };

        // Date filter
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                query.createdAt.$gte = start;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.createdAt.$lte = end;
            }
        }

        // Fetch bets
        const bets = await Bet.find(query)
            .populate('marketId', 'marketName')
            .populate('placedByBookieId', 'username')
            .sort({ createdAt: -1 })
            .lean();

        // Calculate totals
        const totalBetAmount = bets.reduce((sum, b) => sum + (b.amount || 0), 0);
        const totalWinAmount = bets.filter(b => b.status === 'won').reduce((sum, b) => sum + (b.payout || 0), 0);
        const totalLossAmount = bets.filter(b => b.status === 'lost').reduce((sum, b) => sum + (b.amount || 0), 0);
        // Total = Amount on bet - Win amount
        // This represents the net amount the player owes to the bookie
        const total = totalBetAmount - totalWinAmount;

        // Create PDF
        const doc = new PDFDocument({ margin: 50 });
        
        // Set response headers
        const filename = `bet-statement-${user.username}-${Date.now()}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Pipe PDF to response
        doc.pipe(res);

        // Header
        doc.fontSize(20).text('Bet Statement', { align: 'center' });
        doc.moveDown();
        
        // Player Information
        doc.fontSize(14).text('Player Information', { underline: true });
        doc.fontSize(12);
        doc.text(`Name: ${user.username || 'N/A'}`);
        doc.text(`Email: ${user.email || 'N/A'}`);
        doc.text(`Phone: ${user.phone || 'N/A'}`);
        if (startDate || endDate) {
            doc.text(`Period: ${startDate ? new Date(startDate).toLocaleDateString() : 'Start'} - ${endDate ? new Date(endDate).toLocaleDateString() : 'End'}`);
        } else {
            doc.text(`Period: All Time`);
        }
        doc.moveDown();

        // Summary Section
        doc.fontSize(14).text('Summary', { underline: true });
        doc.fontSize(12);
        doc.text(`Total Bet Amount: ₹${totalBetAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        doc.text(`Total Win Amount: ₹${totalWinAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        doc.text(`Total Loss Amount: ₹${totalLossAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        doc.moveDown();
        doc.fontSize(14).text(`Total (Bet Amount - Win Amount): ₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, { underline: true });
        doc.moveDown(2);

        // Bet Details Table Header
        doc.fontSize(12).text('Bet Details', { underline: true });
        doc.moveDown(0.5);
        
        // Table headers
        const tableTop = doc.y;
        doc.fontSize(10);
        doc.text('Date', 50, tableTop);
        doc.text('Market', 120, tableTop);
        doc.text('Type', 250, tableTop);
        doc.text('Number', 320, tableTop);
        doc.text('Amount', 400, tableTop);
        doc.text('Status', 480, tableTop);
        doc.text('Payout', 540, tableTop);
        doc.text('Placed By', 600, tableTop);
        
        // Draw line under header
        doc.moveTo(50, doc.y + 5).lineTo(650, doc.y + 5).stroke();
        doc.moveDown();

        // Bet rows
        let yPos = doc.y;
        bets.forEach((bet, index) => {
            // Check if we need a new page
            if (yPos > 700) {
                doc.addPage();
                yPos = 50;
            }

            const date = new Date(bet.createdAt).toLocaleDateString('en-IN');
            const marketName = bet.marketId?.marketName || 'N/A';
            const betType = (bet.betType || '').toUpperCase();
            const betNumber = bet.betNumber || 'N/A';
            const amount = `₹${(bet.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            const status = (bet.status || 'pending').toUpperCase();
            const payout = bet.status === 'won' ? `₹${(bet.payout || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
            const placedBy = bet.placedByBookie ? (bet.placedByBookieId?.username || 'Bookie') : 'Player';

            doc.text(date, 50, yPos);
            doc.text(marketName.substring(0, 15), 120, yPos);
            doc.text(betType, 250, yPos);
            doc.text(betNumber, 320, yPos);
            doc.text(amount, 400, yPos);
            doc.text(status, 480, yPos);
            doc.text(payout, 540, yPos);
            doc.text(placedBy, 600, yPos);

            yPos += 20;
        });

        // Footer
        doc.fontSize(8).text(`Generated on: ${new Date().toLocaleString('en-IN')}`, 50, doc.page.height - 50, { align: 'center' });
        doc.text('This is a computer-generated statement', 50, doc.page.height - 35, { align: 'center' });

        // Finalize PDF
        doc.end();
    } catch (error) {
        console.error('[downloadBetStatement]', error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: error.message || 'Failed to generate statement' });
        }
    }
};

/**
 * Download bet statement for current player (PDF format) - Player accessible
 * Query params: startDate (optional), endDate (optional)
 * Body or Query: userId (required) - player can only access their own statement
 * Shows all bets for the player (both placed by bookie and directly by player)
 */
export const downloadMyBetStatement = async (req, res) => {
    try {
        const { userId, startDate, endDate } = req.body.userId ? req.body : req.query;

        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: 'Valid userId is required' });
        }

        // Verify user exists
        const user = await User.findById(userId).select('username email phone').lean();
        if (!user) {
            return res.status(404).json({ success: false, message: 'Player not found' });
        }

        // Build query for bets - show all bets for the player
        const query = {
            userId,
            // Show all bets (both placed by bookie and directly by player)
        };

        // Date filter
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                query.createdAt.$gte = start;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.createdAt.$lte = end;
            }
        }

        // Fetch bets
        const bets = await Bet.find(query)
            .populate('marketId', 'marketName')
            .populate('placedByBookieId', 'username')
            .sort({ createdAt: -1 })
            .lean();

        // Calculate totals
        const totalBetAmount = bets.reduce((sum, b) => sum + (b.amount || 0), 0);
        const totalWinAmount = bets.filter(b => b.status === 'won').reduce((sum, b) => sum + (b.payout || 0), 0);
        const totalLossAmount = bets.filter(b => b.status === 'lost').reduce((sum, b) => sum + (b.amount || 0), 0);
        // Total = Amount on bet - Win amount
        const total = totalBetAmount - totalWinAmount;

        // Create PDF
        const doc = new PDFDocument({ margin: 50 });
        
        // Set response headers
        const filename = `bet-statement-${user.username}-${Date.now()}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Pipe PDF to response
        doc.pipe(res);

        // Header
        doc.fontSize(20).text('Bet Statement', { align: 'center' });
        doc.moveDown();
        
        // Player Information
        doc.fontSize(14).text('Player Information', { underline: true });
        doc.fontSize(12);
        doc.text(`Name: ${user.username || 'N/A'}`);
        doc.text(`Email: ${user.email || 'N/A'}`);
        doc.text(`Phone: ${user.phone || 'N/A'}`);
        if (startDate || endDate) {
            doc.text(`Period: ${startDate ? new Date(startDate).toLocaleDateString() : 'Start'} - ${endDate ? new Date(endDate).toLocaleDateString() : 'End'}`);
        } else {
            doc.text(`Period: All Time`);
        }
        doc.moveDown();

        // Summary Section
        doc.fontSize(14).text('Summary', { underline: true });
        doc.fontSize(12);
        doc.text(`Total Bet Amount: ₹${totalBetAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        doc.text(`Total Win Amount: ₹${totalWinAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        doc.text(`Total Loss Amount: ₹${totalLossAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        doc.moveDown();
        doc.fontSize(14).text(`Total (Bet Amount - Win Amount): ₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, { underline: true });
        doc.moveDown(2);

        // Bet Details Table Header
        doc.fontSize(12).text('Bet Details', { underline: true });
        doc.moveDown(0.5);
        
        // Table headers
        const tableTop = doc.y;
        doc.fontSize(10);
        doc.text('Date', 50, tableTop);
        doc.text('Market', 120, tableTop);
        doc.text('Type', 250, tableTop);
        doc.text('Number', 320, tableTop);
        doc.text('Amount', 400, tableTop);
        doc.text('Status', 480, tableTop);
        doc.text('Payout', 540, tableTop);
        doc.text('Placed By', 600, tableTop);
        
        // Draw line under header
        doc.moveTo(50, doc.y + 5).lineTo(650, doc.y + 5).stroke();
        doc.moveDown();

        // Bet rows
        let yPos = doc.y;
        bets.forEach((bet, index) => {
            // Check if we need a new page
            if (yPos > 700) {
                doc.addPage();
                yPos = 50;
            }

            const date = new Date(bet.createdAt).toLocaleDateString('en-IN');
            const marketName = bet.marketId?.marketName || 'N/A';
            const betType = (bet.betType || '').toUpperCase();
            const betNumber = bet.betNumber || 'N/A';
            const amount = `₹${(bet.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            const status = (bet.status || 'pending').toUpperCase();
            const payout = bet.status === 'won' ? `₹${(bet.payout || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
            const placedBy = bet.placedByBookie ? (bet.placedByBookieId?.username || 'Bookie') : 'Player';

            doc.text(date, 50, yPos);
            doc.text(marketName.substring(0, 15), 120, yPos);
            doc.text(betType, 250, yPos);
            doc.text(betNumber, 320, yPos);
            doc.text(amount, 400, yPos);
            doc.text(status, 480, yPos);
            doc.text(payout, 540, yPos);
            doc.text(placedBy, 600, yPos);

            yPos += 20;
        });

        // Footer
        doc.fontSize(8).text(`Generated on: ${new Date().toLocaleString('en-IN')}`, 50, doc.page.height - 50, { align: 'center' });
        doc.text('This is a computer-generated statement', 50, doc.page.height - 35, { align: 'center' });

        // Finalize PDF
        doc.end();
    } catch (error) {
        console.error('[downloadMyBetStatement]', error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: error.message || 'Failed to generate statement' });
        }
    }
};
