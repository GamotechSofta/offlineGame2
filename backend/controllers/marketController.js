import Market from '../models/market/market.js';
import Bet from '../models/bet/bet.js';
import User from '../models/user/user.js';
import MarketResult from '../models/marketResult/marketResult.js';
import { logActivity, getClientIp } from '../utils/activityLogger.js';
import { getBookieUserIds } from '../utils/bookieFilter.js';
import { isSinglePatti, buildSinglePattiFirstDigitSummary } from '../utils/singlePattiUtils.js';
import { previewDeclareOpen, previewDeclareClose, settleOpening, settleClosing, getWinningBetsForOpen, getWinningBetsForClose } from '../utils/settleBets.js';
import { ensureResultsResetForNewDay } from '../utils/resultReset.js';

const toDateKeyIST = (d = new Date()) => {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(d); // YYYY-MM-DD
};

const computeDisplayResultFromNumbers = (openingNumber, closingNumber) => {
    const opening = openingNumber && /^\d{3}$/.test(String(openingNumber)) ? String(openingNumber) : null;
    const closing = closingNumber && /^\d{3}$/.test(String(closingNumber)) ? String(closingNumber) : null;
    const openingDisplay = opening ? opening : '***';
    const closingDisplay = closing ? closing : '***';
    const sumDigits = (s) => [...s].reduce((acc, c) => acc + parseInt(c, 10), 0);
    let displayResult = '***-**-***';
    if (opening) {
        const first = sumDigits(opening) % 10;
        if (!closing) {
            displayResult = `${openingDisplay}-${first}*-${closingDisplay}`;
        } else {
            const second = sumDigits(closing) % 10;
            displayResult = `${openingDisplay}-${first}${second}-${closingDisplay}`;
        }
    }
    return displayResult;
};

const upsertMarketResultSnapshot = async (marketDoc, dateKey) => {
    if (!marketDoc?._id || !dateKey) return;
    const displayResult = computeDisplayResultFromNumbers(marketDoc.openingNumber, marketDoc.closingNumber);
    await MarketResult.findOneAndUpdate(
        { marketId: marketDoc._id, dateKey },
        {
            $set: {
                marketName: marketDoc.marketName,
                openingNumber: marketDoc.openingNumber || null,
                closingNumber: marketDoc.closingNumber || null,
                displayResult: displayResult || '***-**-***',
            },
        },
        { upsert: true, new: true }
    );
};

/**
 * Create a new market.
 * Body: { marketName, startingTime, closingTime, betClosureTime? }
 */
export const createMarket = async (req, res) => {
    try {
        const { marketName, startingTime, closingTime, betClosureTime, marketType } = req.body;
        if (!marketName || !startingTime || !closingTime) {
            return res.status(400).json({
                success: false,
                message: 'marketName, startingTime and closingTime are required',
            });
        }
        const betClosureSec = betClosureTime != null && betClosureTime !== '' ? Number(betClosureTime) : null;
        const type = marketType === 'startline' ? 'startline' : 'main';
        const market = new Market({ marketName, startingTime, closingTime, betClosureTime: betClosureSec, marketType: type });
        await market.save();

        if (req.admin) {
            await logActivity({
                action: 'create_market',
                performedBy: req.admin.username,
                performedByType: req.admin.role || 'super_admin',
                targetType: 'market',
                targetId: market._id.toString(),
                details: `Market "${marketName}" created`,
                ip: getClientIp(req),
            });
        }

        const response = market.toObject();
        response.displayResult = market.getDisplayResult();
        res.status(201).json({ success: true, data: response });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Market with this name already exists',
            });
        }
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: error.message,
                errors: error.errors,
            });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

/** Default startline markets (fixed). Only created if none exist. */
const DEFAULT_STARTLINE_MARKETS = [
    { name: 'STARLINE 01:00 AM', time: '01:00' },
    { name: 'STARLINE 06:00 PM', time: '18:00' },
    { name: 'STARLINE 07:00 PM', time: '19:00' },
    { name: 'STARLINE 08:00 PM', time: '20:00' },
    { name: 'STARLINE 09:00 PM', time: '21:00' },
    { name: 'STARLINE 10:00 PM', time: '22:00' },
    { name: 'STARLINE 11:00 PM', time: '23:00' },
];

/**
 * POST /markets/seed-startline – create default fixed startline markets if none exist (super admin only).
 */
export const seedStartlineMarkets = async (req, res) => {
    try {
        const existing = await Market.countDocuments({ marketType: 'startline' });
        if (existing > 0) {
            return res.status(200).json({
                success: true,
                message: 'Startline markets already exist.',
                data: { created: 0, existing },
            });
        }
        for (const { name, time } of DEFAULT_STARTLINE_MARKETS) {
            await Market.findOneAndUpdate(
                { marketName: name },
                { marketName: name, startingTime: time, closingTime: time, marketType: 'startline' },
                { upsert: true, new: true }
            );
        }
        if (req.admin) {
            await logActivity({
                action: 'seed_startline_markets',
                performedBy: req.admin.username,
                performedByType: req.admin.role || 'super_admin',
                targetType: 'market',
                targetId: '',
                details: `Created ${DEFAULT_STARTLINE_MARKETS.length} default startline markets`,
                ip: getClientIp(req),
            });
        }
        const list = await Market.find({ marketType: 'startline' }).sort({ startingTime: 1 });
        const data = list.map((m) => {
            const doc = m.toObject();
            doc.displayResult = m.getDisplayResult();
            return doc;
        });
        res.status(201).json({
            success: true,
            message: `Created ${DEFAULT_STARTLINE_MARKETS.length} startline markets.`,
            data: { created: DEFAULT_STARTLINE_MARKETS.length, markets: data },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get all markets.
 * Results (opening/closing numbers) are reset at midnight IST so each new day starts with no declared result.
 */
export const getMarkets = async (req, res) => {
    try {
        await ensureResultsResetForNewDay(Market);
        const markets = await Market.find().sort({ startingTime: 1 });
        const data = markets.map((m) => {
            const doc = m.toObject();
            doc.displayResult = m.getDisplayResult();
            return doc;
        });
        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get a single market by ID.
 */
export const getMarketById = async (req, res) => {
    try {
        const { id } = req.params;
        const market = await Market.findById(id);
        if (!market) {
            return res.status(404).json({ success: false, message: 'Market not found' });
        }
        const response = market.toObject();
        response.displayResult = market.getDisplayResult();
        res.status(200).json({ success: true, data: response });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: 'Invalid market ID' });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Update market (name, times). Does not set opening/closing numbers; use setOpeningNumber / setClosingNumber.
 * Body: { marketName?, startingTime?, closingTime?, betClosureTime? }
 */
export const updateMarket = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await Market.findById(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Market not found' });
        }
        const { marketName, startingTime, closingTime, betClosureTime, marketType } = req.body;
        const updates = {};
        if (existing.marketType === 'startline') {
            if (closingTime !== undefined) updates.closingTime = closingTime;
            if (betClosureTime !== undefined) updates.betClosureTime = betClosureTime != null && betClosureTime !== '' ? Number(betClosureTime) : null;
        } else {
            if (marketName !== undefined) updates.marketName = marketName;
            if (startingTime !== undefined) updates.startingTime = startingTime;
            if (closingTime !== undefined) updates.closingTime = closingTime;
            if (betClosureTime !== undefined) updates.betClosureTime = betClosureTime != null && betClosureTime !== '' ? Number(betClosureTime) : null;
            if (marketType !== undefined) updates.marketType = marketType === 'startline' ? 'startline' : 'main';
        }

        const market = await Market.findByIdAndUpdate(
            id,
            updates,
            { new: true, runValidators: true }
        );
        if (!market) {
            return res.status(404).json({ success: false, message: 'Market not found' });
        }

        if (req.admin) {
            await logActivity({
                action: 'update_market',
                performedBy: req.admin.username,
                performedByType: req.admin.role || 'super_admin',
                targetType: 'market',
                targetId: market._id.toString(),
                details: `Market "${market.marketName}" updated`,
                ip: getClientIp(req),
            });
        }

        const response = market.toObject();
        response.displayResult = market.getDisplayResult();
        res.status(200).json({ success: true, data: response });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: 'Invalid market ID' });
        }
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Market with this name already exists',
            });
        }
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: error.message,
                errors: error.errors,
            });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Set opening number (3 digits). Body: { openingNumber: "123" }
 * Send null or "" to clear (keep blank).
 */
export const setOpeningNumber = async (req, res) => {
    try {
        const { id } = req.params;
        const { openingNumber } = req.body;
        const value = openingNumber == null || openingNumber === '' ? null : openingNumber;
        if (value !== null && !/^\d{3}$/.test(value)) {
            return res.status(400).json({
                success: false,
                message: 'openingNumber must be exactly 3 digits or empty to clear',
            });
        }
        const market = await Market.findByIdAndUpdate(
            id,
            { openingNumber: value },
            { new: true, runValidators: true }
        );
        if (!market) {
            return res.status(404).json({ success: false, message: 'Market not found' });
        }

        if (req.admin) {
            await logActivity({
                action: 'set_opening_number',
                performedBy: req.admin.username,
                performedByType: req.admin.role || 'super_admin',
                targetType: 'market',
                targetId: market._id.toString(),
                details: `Market "${market.marketName}" – opening number set to ${value || '(cleared)'}`,
                ip: getClientIp(req),
            });
        }

        const response = market.toObject();
        response.displayResult = market.getDisplayResult();

        // Store snapshot for history when setting opening (do not overwrite history on clear)
        if (value) {
            try {
                await upsertMarketResultSnapshot(market, toDateKeyIST(new Date()));
            } catch (_) {}
        }
        res.status(200).json({ success: true, data: response });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: 'Invalid market ID' });
        }
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: error.message,
                errors: error.errors,
            });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Set closing number (3 digits). Body: { closingNumber: "456" }
 * Send null or "" to clear (keep blank).
 * Result (e.g. 123-65-456) is computed when both opening and closing are set.
 */
export const setClosingNumber = async (req, res) => {
    try {
        const { id } = req.params;
        const { closingNumber } = req.body;
        const value = closingNumber == null || closingNumber === '' ? null : closingNumber;
        if (value !== null && !/^\d{3}$/.test(value)) {
            return res.status(400).json({
                success: false,
                message: 'closingNumber must be exactly 3 digits or empty to clear',
            });
        }
        const market = await Market.findByIdAndUpdate(
            id,
            { closingNumber: value },
            { new: true, runValidators: true }
        );
        if (!market) {
            return res.status(404).json({ success: false, message: 'Market not found' });
        }

        if (req.admin) {
            await logActivity({
                action: 'set_closing_number',
                performedBy: req.admin.username,
                performedByType: req.admin.role || 'super_admin',
                targetType: 'market',
                targetId: market._id.toString(),
                details: `Market "${market.marketName}" – closing number set to ${value || '(cleared)'}`,
                ip: getClientIp(req),
            });
        }

        const response = market.toObject();
        response.displayResult = market.getDisplayResult();

        // Store snapshot for history when setting closing (do not overwrite history on clear)
        if (value) {
            try {
                await upsertMarketResultSnapshot(market, toDateKeyIST(new Date()));
            } catch (_) {}
        }
        res.status(200).json({ success: true, data: response });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: 'Invalid market ID' });
        }
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: error.message,
                errors: error.errors,
            });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Set win number. Body: { winNumber: "123" or "123-65-456" }
 */
export const setWinNumber = async (req, res) => {
    try {
        const { id } = req.params;
        const { winNumber } = req.body;
        if (!winNumber || winNumber.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'winNumber is required',
            });
        }
        const market = await Market.findByIdAndUpdate(
            id,
            { winNumber: winNumber.trim() },
            { new: true, runValidators: true }
        );
        if (!market) {
            return res.status(404).json({ success: false, message: 'Market not found' });
        }
        const response = market.toObject();
        response.displayResult = market.getDisplayResult();
        res.status(200).json({ success: true, data: response });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: 'Invalid market ID' });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Preview declare open: ?openingNumber=156 returns totalBetAmount, totalWinAmount, noOfPlayers, profit,
 * totalBetAmountOnPatti, totalPlayersBetOnPatti, totalPlayersInMarket.
 */
export const previewDeclareOpenResult = async (req, res) => {
    try {
        const { id: marketIdParam } = req.params;
        const openingNumber = (req.query.openingNumber || req.body?.openingNumber || '').toString().trim();
        const market = await Market.findById(marketIdParam);
        if (!market) {
            return res.status(404).json({ success: false, message: 'Market not found' });
        }
        const marketId = market._id.toString();
        const oid = market._id;
        const bookieUserIds = await getBookieUserIds(req.admin);
        const stats = await previewDeclareOpen(marketId, openingNumber || null, {
            bookieUserIds: bookieUserIds ?? undefined,
        });
        const matchFilter = { marketId: oid };
        if (bookieUserIds != null && Array.isArray(bookieUserIds) && bookieUserIds.length > 0) {
            matchFilter.userId = { $in: bookieUserIds };
        }
        const totalPlayersInMarket = await Bet.distinct('userId', matchFilter).then((ids) => ids.length);
        res.status(200).json({
            success: true,
            data: { ...stats, totalPlayersInMarket },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Declare open result: set opening number and settle single + panna bets.
 * Body: { openingNumber: "156" }
 */
export const declareOpenResult = async (req, res) => {
    try {
        const { id: marketId } = req.params;
        const { openingNumber } = req.body;
        const openVal = (openingNumber ?? '').toString().trim();
        if (!/^\d{3}$/.test(openVal)) {
            return res.status(400).json({ success: false, message: 'openingNumber must be exactly 3 digits' });
        }
        const market = await Market.findById(marketId);
        if (!market) {
            return res.status(404).json({ success: false, message: 'Market not found' });
        }
        await settleOpening(market._id.toString(), openVal);
        if (req.admin) {
            await logActivity({
                action: 'declare_open_result',
                performedBy: req.admin.username,
                performedByType: req.admin.role || 'super_admin',
                targetType: 'market',
                targetId: marketId,
                details: `Market "${market.marketName}" – open result declared: ${openVal}`,
                ip: getClientIp(req),
            });
        }
        const updated = await Market.findById(marketId);
        const response = updated.toObject();
        response.displayResult = updated.getDisplayResult();

        // Upsert today's result snapshot for history (IST date)
        try { await upsertMarketResultSnapshot(updated, toDateKeyIST(new Date())); } catch (_) {}

        res.status(200).json({ success: true, message: 'Open result declared', data: response });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Preview declare close: ?closingNumber=456 returns totalBetAmount, totalWinAmount, noOfPlayers, profit,
 * totalBetAmountOnPatti, totalPlayersBetOnPatti, totalPlayersInMarket (for jodi/half-sangam/full-sangam).
 * Close uses no bookie filter so preview matches actual settlement (settleClosing settles all pending close-type bets).
 */
export const previewDeclareCloseResult = async (req, res) => {
    try {
        const { id: marketIdParam } = req.params;
        const closingNumber = (req.query.closingNumber || req.body?.closingNumber || '').toString().trim();
        const market = await Market.findById(marketIdParam);
        if (!market) {
            return res.status(404).json({ success: false, message: 'Market not found' });
        }
        const marketId = market._id.toString();
        const oid = market._id;
        const stats = await previewDeclareClose(marketId, closingNumber || null, {});
        const matchFilter = { marketId: oid };
        const totalPlayersInMarket = await Bet.distinct('userId', matchFilter).then((ids) => ids.length);
        res.status(200).json({
            success: true,
            data: { ...stats, totalPlayersInMarket },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET winning bets preview for declare confirmation screen.
 * Query: ?openingNumber=123 (for open) or ?closingNumber=456 (for close).
 * Returns { winningBets: [{ userId, username, betType, betNumber, amount, payout }, ...], totalWinAmount, declareType, number }.
 */
export const getWinningBetsPreview = async (req, res) => {
    try {
        const { id: marketIdParam } = req.params;
        const openingNumber = (req.query.openingNumber || '').toString().trim();
        const closingNumber = (req.query.closingNumber || '').toString().trim();
        const market = await Market.findById(marketIdParam);
        if (!market) {
            return res.status(404).json({ success: false, message: 'Market not found' });
        }
        const marketId = market._id.toString();
        const bookieUserIds = await getBookieUserIds(req.admin);
        const optionsOpen = { bookieUserIds: bookieUserIds ?? undefined };

        let winningBets = [];
        let totalWinAmount = 0;
        let declareType = '';
        let number = '';

        if (openingNumber && /^\d{3}$/.test(openingNumber)) {
            const result = await getWinningBetsForOpen(marketId, openingNumber, optionsOpen);
            winningBets = result.winningBets;
            totalWinAmount = result.totalWinAmount;
            declareType = 'open';
            number = openingNumber;
        } else if (closingNumber && /^\d{3}$/.test(closingNumber)) {
            const result = await getWinningBetsForClose(marketId, closingNumber, {});
            winningBets = result.winningBets;
            totalWinAmount = result.totalWinAmount;
            declareType = 'close';
            number = closingNumber;
        } else {
            return res.status(400).json({ success: false, message: 'Provide openingNumber or closingNumber (3 digits)' });
        }

        const userIds = [...new Set(winningBets.map((w) => w.bet.userId.toString()))];
        const users = await User.find({ _id: { $in: userIds } }).select('username').lean();
        const userMap = new Map(users.map((u) => [u._id.toString(), u.username]));

        const list = winningBets.map((w) => ({
            userId: w.bet.userId,
            username: userMap.get(w.bet.userId.toString()) || '—',
            betType: w.bet.betType,
            betNumber: w.bet.betNumber,
            amount: w.bet.amount,
            payout: w.payout,
        }));

        res.status(200).json({
            success: true,
            data: {
                winningBets: list,
                totalWinAmount,
                declareType,
                number,
                marketName: market.marketName,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Declare close result: set closing number and settle jodi, half-sangam, full-sangam.
 * Body: { closingNumber: "456" }
 */
export const declareCloseResult = async (req, res) => {
    try {
        const { id: marketId } = req.params;
        const { closingNumber } = req.body;
        const closeVal = (closingNumber ?? '').toString().trim();
        if (!/^\d{3}$/.test(closeVal)) {
            return res.status(400).json({ success: false, message: 'closingNumber must be exactly 3 digits' });
        }
        const market = await Market.findById(marketId);
        if (!market) {
            return res.status(404).json({ success: false, message: 'Market not found' });
        }
        if (!market.openingNumber || !/^\d{3}$/.test(market.openingNumber)) {
            return res.status(400).json({ success: false, message: 'Opening number must be declared before closing' });
        }
        await settleClosing(market._id.toString(), closeVal);
        if (req.admin) {
            await logActivity({
                action: 'declare_close_result',
                performedBy: req.admin.username,
                performedByType: req.admin.role || 'super_admin',
                targetType: 'market',
                targetId: marketId,
                details: `Market "${market.marketName}" – close result declared: ${closeVal}`,
                ip: getClientIp(req),
            });
        }
        const updated = await Market.findById(marketId);
        const response = updated.toObject();
        response.displayResult = updated.getDisplayResult();

        // Upsert today's result snapshot for history (IST date)
        try { await upsertMarketResultSnapshot(updated, toDateKeyIST(new Date())); } catch (_) {}

        res.status(200).json({ success: true, message: 'Close result declared', data: response });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Clear result: set openingNumber and closingNumber to null for a market.
 * Does not reverse bet settlement or wallet – use only to reset result display (e.g. declared by mistake before closing).
 */
export const clearResult = async (req, res) => {
    try {
        const { id: marketId } = req.params;
        const market = await Market.findById(marketId);
        if (!market) {
            return res.status(404).json({ success: false, message: 'Market not found' });
        }
        await Market.findByIdAndUpdate(marketId, { openingNumber: null, closingNumber: null });
        if (req.admin) {
            await logActivity({
                action: 'clear_result',
                performedBy: req.admin.username,
                performedByType: req.admin.role || 'super_admin',
                targetType: 'market',
                targetId: marketId,
                details: `Market "${market.marketName}" – result cleared`,
                ip: getClientIp(req),
            });
        }
        const updated = await Market.findById(marketId);
        const response = updated.toObject();
        response.displayResult = updated.getDisplayResult();
        res.status(200).json({ success: true, message: 'Result cleared', data: response });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Public: Get market result history for a dateKey (YYYY-MM-DD IST).
 * Query: ?date=YYYY-MM-DD (optional, defaults to today IST)
 */
export const getMarketResultHistory = async (req, res) => {
    try {
        const todayKey = toDateKeyIST(new Date());

        const dateKey = (req.query.date || todayKey).toString().trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
            return res.status(400).json({ success: false, message: 'date must be YYYY-MM-DD' });
        }

        // Do not allow future date
        if (dateKey > todayKey) {
            return res.status(200).json({ success: true, data: [] });
        }

        // Always return a row for every market (today and past), merging stored snapshots if present.
        const markets = await Market.find().sort({ startingTime: 1 }).lean();

        let stored = [];
        if (dateKey !== todayKey) {
            stored = await MarketResult.find({ dateKey })
                .select('marketId marketName dateKey displayResult openingNumber closingNumber')
                .lean();
        }
        const storedByMarketId = new Map((stored || []).map((r) => [String(r.marketId), r]));

        const data = (markets || []).map((m) => {
            const key = String(m._id);
            const snap = dateKey === todayKey ? null : storedByMarketId.get(key);

            const openingNumber = dateKey === todayKey ? (m.openingNumber || null) : (snap?.openingNumber || null);
            const closingNumber = dateKey === todayKey ? (m.closingNumber || null) : (snap?.closingNumber || null);
            const displayResult =
                dateKey === todayKey
                    ? computeDisplayResultFromNumbers(m.openingNumber, m.closingNumber)
                    : (snap?.displayResult || computeDisplayResultFromNumbers(openingNumber, closingNumber));

            return {
                marketId: m._id,
                marketName: snap?.marketName || m.marketName,
                dateKey,
                displayResult: displayResult || '***-**-***',
                openingNumber,
                closingNumber,
                startingTime: m.startingTime,
                closingTime: m.closingTime,
            };
        });

        // Include snapshots for markets that were deleted later (optional, show at end)
        const extras = (dateKey === todayKey)
            ? []
            : (stored || []).filter((r) => !(markets || []).some((m) => String(m._id) === String(r.marketId)))
                .map((r) => ({
                    marketId: r.marketId,
                    marketName: r.marketName,
                    dateKey,
                    displayResult: r.displayResult || '***-**-***',
                    openingNumber: r.openingNumber || null,
                    closingNumber: r.closingNumber || null,
                }));

        res.status(200).json({ success: true, data: [...data, ...extras] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get market statistics (amount and no. of bets per option) for admin market detail view.
 * Returns: singleDigit, jodi, singlePatti, doublePatti, triplePatti with per-option amount/count and totals.
 */
export const getMarketStats = async (req, res) => {
    try {
        const { id: marketId } = req.params;
        const market = await Market.findById(marketId);
        if (!market) {
            return res.status(404).json({ success: false, message: 'Market not found' });
        }

        const bookieUserIds = await getBookieUserIds(req.admin);
        const matchFilter = { marketId };
        if (bookieUserIds !== null) {
            matchFilter.userId = { $in: bookieUserIds };
        }

        const bets = await Bet.find(matchFilter).lean();

        const singleDigit = { digits: {}, totalAmount: 0, totalBets: 0 };
        const jodi = { items: {}, totalAmount: 0, totalBets: 0 };
        const singlePatti = { items: {}, totalAmount: 0, totalBets: 0 };
        const doublePatti = { items: {}, totalAmount: 0, totalBets: 0 };
        const triplePatti = { items: {}, totalAmount: 0, totalBets: 0 };
        const halfSangam = { items: {}, totalAmount: 0, totalBets: 0 };
        const fullSangam = { items: {}, totalAmount: 0, totalBets: 0 };

        for (const b of bets) {
            const amount = Number(b.amount) || 0;
            const num = (b.betNumber || '').toString().trim();
            const type = (b.betType || '').toLowerCase();

            if (type === 'single' && /^[0-9]$/.test(num)) {
                if (!singleDigit.digits[num]) singleDigit.digits[num] = { amount: 0, count: 0 };
                singleDigit.digits[num].amount += amount;
                singleDigit.digits[num].count += 1;
                singleDigit.totalAmount += amount;
                singleDigit.totalBets += 1;
            } else if (type === 'jodi' && /^[0-9]{2}$/.test(num)) {
                if (!jodi.items[num]) jodi.items[num] = { amount: 0, count: 0 };
                jodi.items[num].amount += amount;
                jodi.items[num].count += 1;
                jodi.totalAmount += amount;
                jodi.totalBets += 1;
            } else if (type === 'panna' && /^[0-9]{3}$/.test(num)) {
                const a = num[0], b_ = num[1], c = num[2];
                const allSame = a === b_ && b_ === c;
                const twoSame = a === b_ || b_ === c || a === c;
                if (allSame) {
                    if (!triplePatti.items[num]) triplePatti.items[num] = { amount: 0, count: 0 };
                    triplePatti.items[num].amount += amount;
                    triplePatti.items[num].count += 1;
                    triplePatti.totalAmount += amount;
                    triplePatti.totalBets += 1;
                } else if (twoSame) {
                    if (!doublePatti.items[num]) doublePatti.items[num] = { amount: 0, count: 0 };
                    doublePatti.items[num].amount += amount;
                    doublePatti.items[num].count += 1;
                    doublePatti.totalAmount += amount;
                    doublePatti.totalBets += 1;
                } else if (isSinglePatti(num)) {
                    if (!singlePatti.items[num]) singlePatti.items[num] = { amount: 0, count: 0 };
                    singlePatti.items[num].amount += amount;
                    singlePatti.items[num].count += 1;
                    singlePatti.totalAmount += amount;
                    singlePatti.totalBets += 1;
                }
                /* Invalid panna not counted */
            } else if (type === 'half-sangam') {
                const parts = num.split('-').map((p) => (p || '').trim());
                const a = parts[0] || '';
                const b = parts[1] || '';
                const isFormatA = /^[0-9]{3}$/.test(a) && /^[0-9]$/.test(b);
                const isFormatB = /^[0-9]$/.test(a) && /^[0-9]{3}$/.test(b);
                if (isFormatA || isFormatB) {
                    if (!halfSangam.items[num]) halfSangam.items[num] = { amount: 0, count: 0 };
                    halfSangam.items[num].amount += amount;
                    halfSangam.items[num].count += 1;
                    halfSangam.totalAmount += amount;
                    halfSangam.totalBets += 1;
                }
            } else if (type === 'full-sangam') {
                const parts = num.split('-').map((p) => (p || '').trim());
                const a = parts[0] || '';
                const b = parts[1] || '';
                if (/^[0-9]{3}$/.test(a) && /^[0-9]{3}$/.test(b)) {
                    if (!fullSangam.items[num]) fullSangam.items[num] = { amount: 0, count: 0 };
                    fullSangam.items[num].amount += amount;
                    fullSangam.items[num].count += 1;
                    fullSangam.totalAmount += amount;
                    fullSangam.totalBets += 1;
                }
            }
        }

        res.status(200).json({
            success: true,
            data: {
                market: {
                    id: market._id,
                    marketName: market.marketName,
                    displayResult: market.getDisplayResult(),
                    openingNumber: market.openingNumber,
                    closingNumber: market.closingNumber,
                    startingTime: market.startingTime,
                    closingTime: market.closingTime,
                },
                singleDigit,
                jodi,
                singlePatti,
                doublePatti,
                triplePatti,
                halfSangam,
                fullSangam,
            },
        });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: 'Invalid market ID' });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/v1/markets/get-single-patti-summary/:id
 * Returns Single Patti aggregated by first digit (0–9): buckets, maxIndex, totalAmount, totalBets.
 * Query: date= (optional), session= (optional).
 */
export const getSinglePattiSummary = async (req, res) => {
    try {
        const { id: marketId } = req.params;
        const { date, session } = req.query;
        const market = await Market.findById(marketId);
        if (!market) return res.status(404).json({ success: false, message: 'Market not found' });

        const bookieUserIds = await getBookieUserIds(req.admin);
        const matchFilter = { marketId };
        if (bookieUserIds !== null) matchFilter.userId = { $in: bookieUserIds };
        if (date) {
            const start = new Date(date); start.setHours(0, 0, 0, 0);
            const end = new Date(date); end.setHours(23, 59, 59, 999);
            matchFilter.createdAt = { $gte: start, $lte: end };
        }
        if (session) matchFilter.session = session;

        const bets = await Bet.find(matchFilter).select('betType betNumber amount').lean();
        const summary = buildSinglePattiFirstDigitSummary(bets);
        res.status(200).json({
            success: true,
            data: {
                buckets: summary.buckets,
                maxIndex: summary.maxIndex,
                totalAmount: summary.totalAmount,
                totalBets: summary.totalBets,
            },
        });
    } catch (error) {
        if (error.name === 'CastError') return res.status(400).json({ success: false, message: 'Invalid market ID' });
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Delete a market.
 */
export const deleteMarket = async (req, res) => {
    try {
        const { id } = req.params;
        const market = await Market.findById(id);
        if (!market) {
            return res.status(404).json({ success: false, message: 'Market not found' });
        }
        const marketName = market.marketName;
        await Market.findByIdAndDelete(id);

        if (req.admin) {
            await logActivity({
                action: 'delete_market',
                performedBy: req.admin.username,
                performedByType: req.admin.role || 'super_admin',
                targetType: 'market',
                targetId: id,
                details: `Market "${marketName}" deleted`,
                ip: getClientIp(req),
            });
        }

        res.status(200).json({ success: true, message: 'Market deleted', data: { id } });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: 'Invalid market ID' });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};
