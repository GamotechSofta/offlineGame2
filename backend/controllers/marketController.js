import Market from '../models/market/market.js';
import Bet from '../models/bet/bet.js';
import User from '../models/user/user.js';
import Admin from '../models/admin/admin.js';
import MarketResult from '../models/marketResult/marketResult.js';
import { logActivity, getClientIp } from '../utils/activityLogger.js';
import { getBookieUserIds } from '../utils/bookieFilter.js';
import { isSinglePatti, buildSinglePattiFirstDigitSummary } from '../utils/singlePattiUtils.js';
import { previewDeclareOpen, previewDeclareClose, settleOpening, settleClosing, getWinningBetsForOpen, getWinningBetsForClose } from '../utils/settleBets.js';
import { ensureResultsResetForNewDay } from '../utils/resultReset.js';
import { getRatesMap } from '../models/rate/rate.js';
import bcrypt from 'bcryptjs';

/** Last digit of sum of 3 digits (0–9). e.g. "156" → "2" */
function digitFromPatti(threeDigitStr) {
    const s = String(threeDigitStr || '').trim();
    if (!/^\d{3}$/.test(s)) return null;
    const sum = Number(s[0]) + Number(s[1]) + Number(s[2]);
    return String(sum % 10);
}

/** Panna type rate key for 3-digit string */
function getPannaRateKey(threeDigitStr) {
    if (!threeDigitStr || threeDigitStr.length !== 3) return 'singlePatti';
    const a = threeDigitStr[0], b = threeDigitStr[1], c = threeDigitStr[2];
    if (a === b && b === c) return 'triplePatti';
    if (a === b || b === c || a === c) return 'doublePatti';
    return 'singlePatti';
}

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
 * Body: { marketName, startingTime, closingTime, betClosureTime?, marketType? }
 */
export const createMarket = async (req, res) => {
    try {
        const { marketName, marketNameHi, startingTime, closingTime, betClosureTime, marketType } = req.body;
        if (!marketName || !startingTime || !closingTime) {
            return res.status(400).json({
                success: false,
                message: 'marketName, startingTime and closingTime are required',
            });
        }
        const betClosureSec = betClosureTime != null && betClosureTime !== '' ? Number(betClosureTime) : null;
        const payload = { marketName, startingTime, closingTime, betClosureTime: betClosureSec, marketType: 'main' };
        if (marketNameHi !== undefined) payload.marketNameHi = marketNameHi && String(marketNameHi).trim() ? String(marketNameHi).trim() : null;
        const market = new Market(payload);
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

/**
 * Get all markets.
 * Results (opening/closing numbers) are reset at midnight IST so each new day starts with no declared result.
 */
export const getMarkets = async (req, res) => {
    try {
        await ensureResultsResetForNewDay(Market);
        const markets = await Market.find().sort({ startingTime: 1 });
        const lang = (req.query.lang || req.get('x-lang') || '').toString().toLowerCase();
        const useHi = lang === 'hi' || lang.includes('hi');
        let data = markets.map((m) => {
            const doc = m.toObject();
            doc.displayResult = m.getDisplayResult();
            doc.name = doc.marketName || '';
            doc.name_hi = doc.marketNameHi || '';
            if (useHi && doc.marketNameHi) doc.name = doc.marketNameHi;
            return doc;
        });
        data = data.filter((m) => (m.marketType || '').toString().toLowerCase() !== 'startline');
        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get a single market by ID.
 * Ensures result reset at midnight IST so today's market shows cleared results after midnight.
 */
export const getMarketById = async (req, res) => {
    try {
        await ensureResultsResetForNewDay(Market);
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
        const { marketName, marketNameHi, startingTime, closingTime, betClosureTime, marketType } = req.body;
        const updates = {};
        if (marketName !== undefined) updates.marketName = marketName;
        if (marketNameHi !== undefined) updates.marketNameHi = marketNameHi && String(marketNameHi).trim() ? String(marketNameHi).trim() : null;
        if (startingTime !== undefined) updates.startingTime = startingTime;
        if (closingTime !== undefined) updates.closingTime = closingTime;
        if (betClosureTime !== undefined) updates.betClosureTime = betClosureTime != null && betClosureTime !== '' ? Number(betClosureTime) : null;
        if (marketType !== undefined) updates.marketType = 'main';

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
        
        // Check if market is already closed (has closing number)
        const existingMarket = await Market.findById(id);
        if (!existingMarket) {
            return res.status(404).json({ success: false, message: 'Market not found' });
        }
        
        // If trying to set opening number and market is already closed, prevent it
        if (value !== null && existingMarket.closingNumber && /^\d{3}$/.test(String(existingMarket.closingNumber))) {
            return res.status(400).json({
                success: false,
                message: 'Cannot open a market that is already closed. The closing number has already been declared.',
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
        const raw = (req.query.openingNumber || req.body?.openingNumber || '').toString().trim().replace(/\D/g, '').slice(0, 3);
        const openingNumber = raw.length === 3 ? raw.padStart(3, '0') : null;
        const market = await Market.findById(marketIdParam);
        if (!market) {
            return res.status(404).json({ success: false, message: 'Market not found' });
        }
        const marketId = market._id.toString();
        const bookieUserIds = await getBookieUserIds(req.admin);
        const stats = await previewDeclareOpen(marketId, openingNumber, {
            bookieUserIds: bookieUserIds ?? undefined,
        });
        res.status(200).json({
            success: true,
            data: stats,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Declare open result: set opening number and settle single + panna bets.
 * Body: { openingNumber: "156", secretDeclarePassword?: string } – secret required if admin has it set
 */
export const declareOpenResult = async (req, res) => {
    try {
        const adminWithSecret = await Admin.findById(req.admin._id).select('+secretDeclarePassword').lean();
        if (adminWithSecret?.secretDeclarePassword) {
            const provided = (req.body.secretDeclarePassword ?? '').toString().trim();
            const isValid = await bcrypt.compare(provided, adminWithSecret.secretDeclarePassword);
            if (!isValid) {
                return res.status(403).json({
                    success: false,
                    message: 'Invalid secret declare password. Please enter the correct password to declare.',
                    code: 'INVALID_SECRET_DECLARE_PASSWORD',
                });
            }
        }
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
        
        // Check if market is already closed (has closing number)
        if (market.closingNumber && /^\d{3}$/.test(String(market.closingNumber))) {
            return res.status(400).json({
                success: false,
                message: 'Cannot declare open result for a market that is already closed. The closing number has already been declared.',
            });
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
        const bookieUserIds = await getBookieUserIds(req.admin);
        const stats = await previewDeclareClose(marketId, closingNumber || null, {
            bookieUserIds: bookieUserIds ?? undefined,
        });
        res.status(200).json({
            success: true,
            data: stats,
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
            const result = await getWinningBetsForClose(marketId, closingNumber, { bookieUserIds: bookieUserIds ?? undefined });
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
 * Body: { closingNumber: "456", secretDeclarePassword?: string } – secret required if admin has it set
 */
export const declareCloseResult = async (req, res) => {
    try {
        const adminWithSecret = await Admin.findById(req.admin._id).select('+secretDeclarePassword').lean();
        if (adminWithSecret?.secretDeclarePassword) {
            const provided = (req.body.secretDeclarePassword ?? '').toString().trim();
            const isValid = await bcrypt.compare(provided, adminWithSecret.secretDeclarePassword);
            if (!isValid) {
                return res.status(403).json({
                    success: false,
                    message: 'Invalid secret declare password. Please enter the correct password to declare.',
                    code: 'INVALID_SECRET_DECLARE_PASSWORD',
                });
            }
        }
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
 * Ensures result reset at midnight IST so today's data shows cleared results after midnight.
 */
export const getMarketResultHistory = async (req, res) => {
    try {
        await ensureResultsResetForNewDay(Market);
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
 * Ensures result reset at midnight IST so Market overview & result screen shows cleared data after midnight.
 */
export const getMarketStats = async (req, res) => {
    try {
        await ensureResultsResetForNewDay(Market);
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

        // Filter bets by today IST – Market overview shows only today's bets; resets after midnight
        const todayKey = toDateKeyIST(new Date());
        const startOfTodayIST = new Date(`${todayKey}T00:00:00+05:30`);
        const endOfTodayIST = new Date(`${todayKey}T23:59:59.999+05:30`);
        matchFilter.createdAt = { $gte: startOfTodayIST, $lte: endOfTodayIST };

        const bets = await Bet.find(matchFilter).lean();

        const makeEmpty = () => ({
            singleDigit: { digits: {}, totalAmount: 0, totalBets: 0 },
            jodi: { items: {}, totalAmount: 0, totalBets: 0 },
            singlePatti: { items: {}, totalAmount: 0, totalBets: 0 },
            doublePatti: { items: {}, totalAmount: 0, totalBets: 0 },
            triplePatti: { items: {}, totalAmount: 0, totalBets: 0 },
            halfSangam: { items: {}, totalAmount: 0, totalBets: 0 },
            fullSangam: { items: {}, totalAmount: 0, totalBets: 0 },
        });

        const applyBet = (stats, bet) => {
            const amount = Number(bet.amount) || 0;
            const num = (bet.betNumber || '').toString().trim();
            const type = (bet.betType || '').toLowerCase();

            if (type === 'single' && /^[0-9]$/.test(num)) {
                if (!stats.singleDigit.digits[num]) stats.singleDigit.digits[num] = { amount: 0, count: 0 };
                stats.singleDigit.digits[num].amount += amount;
                stats.singleDigit.digits[num].count += 1;
                stats.singleDigit.totalAmount += amount;
                stats.singleDigit.totalBets += 1;
                return;
            }

            if (type === 'jodi' && /^[0-9]{2}$/.test(num)) {
                if (!stats.jodi.items[num]) stats.jodi.items[num] = { amount: 0, count: 0 };
                stats.jodi.items[num].amount += amount;
                stats.jodi.items[num].count += 1;
                stats.jodi.totalAmount += amount;
                stats.jodi.totalBets += 1;
                return;
            }

            if (type === 'panna' && /^[0-9]{3}$/.test(num)) {
                const a = num[0], b_ = num[1], c = num[2];
                const allSame = a === b_ && b_ === c;
                const twoSame = a === b_ || b_ === c || a === c;
                if (allSame) {
                    if (!stats.triplePatti.items[num]) stats.triplePatti.items[num] = { amount: 0, count: 0 };
                    stats.triplePatti.items[num].amount += amount;
                    stats.triplePatti.items[num].count += 1;
                    stats.triplePatti.totalAmount += amount;
                    stats.triplePatti.totalBets += 1;
                    return;
                }
                if (twoSame) {
                    if (!stats.doublePatti.items[num]) stats.doublePatti.items[num] = { amount: 0, count: 0 };
                    stats.doublePatti.items[num].amount += amount;
                    stats.doublePatti.items[num].count += 1;
                    stats.doublePatti.totalAmount += amount;
                    stats.doublePatti.totalBets += 1;
                    return;
                }
                if (isSinglePatti(num)) {
                    if (!stats.singlePatti.items[num]) stats.singlePatti.items[num] = { amount: 0, count: 0 };
                    stats.singlePatti.items[num].amount += amount;
                    stats.singlePatti.items[num].count += 1;
                    stats.singlePatti.totalAmount += amount;
                    stats.singlePatti.totalBets += 1;
                }
                return;
            }

            if (type === 'half-sangam') {
                const parts = num.split('-').map((p) => (p || '').trim()).filter(Boolean);
                const a = parts[0] || '';
                const b = parts[1] || '';
                const isFormatA = /^[0-9]{3}$/.test(a) && /^[0-9]$/.test(b);
                const isFormatB = /^[0-9]$/.test(a) && /^[0-9]{3}$/.test(b);
                if (isFormatA || isFormatB) {
                    const key = `${a}-${b}`;
                    if (!stats.halfSangam.items[key]) stats.halfSangam.items[key] = { amount: 0, count: 0 };
                    stats.halfSangam.items[key].amount += amount;
                    stats.halfSangam.items[key].count += 1;
                    stats.halfSangam.totalAmount += amount;
                    stats.halfSangam.totalBets += 1;
                }
                return;
            }

            if (type === 'full-sangam') {
                const parts = num.split('-').map((p) => (p || '').trim()).filter(Boolean);
                const a = parts[0] || '';
                const b = parts[1] || '';
                if (/^[0-9]{3}$/.test(a) && /^[0-9]{3}$/.test(b)) {
                    const key = `${a}-${b}`;
                    if (!stats.fullSangam.items[key]) stats.fullSangam.items[key] = { amount: 0, count: 0 };
                    stats.fullSangam.items[key].amount += amount;
                    stats.fullSangam.items[key].count += 1;
                    stats.fullSangam.totalAmount += amount;
                    stats.fullSangam.totalBets += 1;
                }
            }
        };

        const allStats = makeEmpty();
        const openStats = makeEmpty();
        const closeStats = makeEmpty();

        const parseHHMM = (t) => {
            const s = String(t || '').trim();
            const m = s.match(/^(\d{1,2}):(\d{2})/);
            if (!m) return null;
            const hh = Number(m[1]);
            const mm = Number(m[2]);
            if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
            return hh * 60 + mm;
        };

        const minutesIST = (dt) => {
            try {
                const hhmm = new Date(dt).toLocaleTimeString('en-GB', {
                    timeZone: 'Asia/Kolkata',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                });
                const [hh, mm] = String(hhmm).split(':');
                const h = Number(hh);
                const m = Number(mm);
                if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
                return h * 60 + m;
            } catch {
                return null;
            }
        };

        const startMin = parseHHMM(market.startingTime);

        for (const b of bets) {
            applyBet(allStats, b);
            const betType = (b?.betType || '').toString().trim().toLowerCase();

            // Jodi / Full Sangam are "close" category (settled on closing). Half Sangam is open-only.
            let session =
                (betType === 'jodi' || betType === 'full-sangam')
                    ? 'close'
                    : ((b?.betOn === 'close') ? 'close' : (b?.betOn === 'open' ? 'open' : null));
            if (betType === 'half-sangam') session = 'open';
            // Backfill for older bets: infer from bet time (IST) vs market starting time
            if (!session && startMin != null && b?.createdAt) {
                const betMin = minutesIST(b.createdAt);
                if (betMin != null) {
                    session = betMin < startMin ? 'open' : 'close';
                }
            }
            if (!session) session = 'open';
            applyBet(session === 'close' ? closeStats : openStats, b);
        }

        // Result-on-patti stats: Total Bet Amount / Win Amount / Players on the declared result (for display in Market Detail).
        // Computed by iterating bets with same session + normalization as previewDeclareOpen/previewDeclareClose so values match.
        const norm3 = (s) => (String(s || '').replace(/\D/g, '').slice(0, 3).padStart(3, '0'));
        const resultOnPatti = { open: null, close: null };
        const open3Raw = (market.openingNumber || '').toString().replace(/\D/g, '').slice(0, 3);
        const close3Raw = (market.closingNumber || '').toString().replace(/\D/g, '').slice(0, 3);
        const open3 = open3Raw.length === 3 ? open3Raw.padStart(3, '0') : null;
        const close3 = close3Raw.length === 3 ? close3Raw.padStart(3, '0') : null;
        const hasOpen3 = open3 != null;
        const hasClose3 = close3 != null;
        const lastDigitOpen = hasOpen3 ? digitFromPatti(open3) : null;
        const lastDigitClose = hasClose3 ? digitFromPatti(close3) : null;
        const jodiKey = (lastDigitOpen != null && lastDigitClose != null) ? (lastDigitOpen + lastDigitClose) : null;

        let rates = {};
        try {
            rates = await getRatesMap();
        } catch (_) {}
        const singleRate = Number(rates.single) || 0;
        const jodiRate = Number(rates.jodi) || 0;

        if (hasOpen3 && lastDigitOpen != null) {
            let totalBetAmountOnOpenPatti = 0;
            let totalWinAmountOnOpenPatti = 0;
            const playersOnOpenPatti = new Set();
            const pannaRateOpen = Number(rates[getPannaRateKey(open3)]) || 0;
            const halfSangamRate = Number(rates.halfSangam) || 0;
            for (const b of bets) {
                const betType = (b?.betType || '').toString().trim().toLowerCase();
                let session = (betType === 'jodi' || betType === 'full-sangam') ? 'close' : ((b?.betOn === 'close') ? 'close' : (b?.betOn === 'open' ? 'open' : null));
                if (betType === 'half-sangam') session = 'open';
                if (!session && startMin != null && b?.createdAt) {
                    const betMin = minutesIST(b.createdAt);
                    if (betMin != null) session = betMin < startMin ? 'open' : 'close';
                }
                if (!session) session = 'open';
                if (session !== 'open') continue;
                const num = (b.betNumber || '').toString().trim();
                const amount = Number(b.amount) || 0;
                if (betType === 'single' && /^[0-9]$/.test(num) && num === lastDigitOpen) {
                    totalBetAmountOnOpenPatti += amount;
                    totalWinAmountOnOpenPatti += amount * singleRate;
                    playersOnOpenPatti.add(b.userId.toString());
                } else if (betType === 'panna') {
                    const panna3 = norm3(num);
                    if (panna3.length === 3 && panna3 === open3) {
                        totalBetAmountOnOpenPatti += amount;
                        totalWinAmountOnOpenPatti += amount * pannaRateOpen;
                        playersOnOpenPatti.add(b.userId.toString());
                    }
                } else if (betType === 'half-sangam') {
                    const parts = num.split('-').map((p) => (p || '').trim());
                    const first = parts[0] || '';
                    const second = parts[1] || '';
                    if (/^[0-9]{3}$/.test(first) && /^[0-9]$/.test(second) && first === open3 && second === lastDigitOpen) {
                        totalBetAmountOnOpenPatti += amount;
                        totalWinAmountOnOpenPatti += amount * halfSangamRate;
                        playersOnOpenPatti.add(b.userId.toString());
                    }
                }
            }
            totalWinAmountOnOpenPatti = Math.round(totalWinAmountOnOpenPatti * 100) / 100;
            resultOnPatti.open = {
                totalBetAmountOnPatti: Math.round(totalBetAmountOnOpenPatti * 100) / 100,
                totalWinAmountOnPatti: totalWinAmountOnOpenPatti,
                totalBetsOnPatti: 0,
                totalPlayersBetOnPatti: playersOnOpenPatti.size,
            };
        }

        if (hasClose3 && lastDigitClose != null) {
            let totalBetAmountOnClosePatti = 0;
            let totalWinAmountOnClosePatti = 0;
            const playersOnClosePatti = new Set();
            const pannaRateClose = Number(rates[getPannaRateKey(close3)]) || 0;
            for (const b of bets) {
                const betType = (b?.betType || '').toString().trim().toLowerCase();
                const isCloseSession = (b?.betOn || '').toString().toLowerCase() === 'close';
                const isCloseSettleType = betType === 'jodi' || betType === 'full-sangam' || (betType === 'single' && isCloseSession) || (betType === 'panna' && isCloseSession);
                if (!isCloseSettleType) continue;
                const num = (b.betNumber || '').toString().trim();
                const amount = Number(b.amount) || 0;
                if (betType === 'single' && isCloseSession && /^[0-9]$/.test(num) && num === lastDigitClose) {
                    totalBetAmountOnClosePatti += amount;
                    totalWinAmountOnClosePatti += amount * singleRate;
                    playersOnClosePatti.add(b.userId.toString());
                } else if (betType === 'panna' && isCloseSession) {
                    const panna3 = norm3(num);
                    if (panna3.length === 3 && panna3 === close3) {
                        totalBetAmountOnClosePatti += amount;
                        totalWinAmountOnClosePatti += amount * pannaRateClose;
                        playersOnClosePatti.add(b.userId.toString());
                    }
                } else if (betType === 'jodi' && /^[0-9]{2}$/.test(num) && num === jodiKey) {
                    totalBetAmountOnClosePatti += amount;
                    totalWinAmountOnClosePatti += amount * jodiRate;
                    playersOnClosePatti.add(b.userId.toString());
                }
            }
            totalWinAmountOnClosePatti = Math.round(totalWinAmountOnClosePatti * 100) / 100;
            resultOnPatti.close = {
                totalBetAmountOnPatti: Math.round(totalBetAmountOnClosePatti * 100) / 100,
                totalWinAmountOnPatti: totalWinAmountOnClosePatti,
                totalBetsOnPatti: 0,
                totalPlayersBetOnPatti: playersOnClosePatti.size,
            };
        }

        res.status(200).json({
            success: true,
            data: {
                market: {
                    id: market._id,
                    marketName: market.marketName,
                    marketType: market.marketType,
                    displayResult: market.getDisplayResult(),
                    openingNumber: market.openingNumber,
                    closingNumber: market.closingNumber,
                    startingTime: market.startingTime,
                    closingTime: market.closingTime,
                },
                ...allStats,
                bySession: {
                    open: openStats,
                    close: closeStats,
                },
                resultOnPatti,
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
        await ensureResultsResetForNewDay(Market);
        const { id: marketId } = req.params;
        const { date, session } = req.query;
        const market = await Market.findById(marketId);
        if (!market) return res.status(404).json({ success: false, message: 'Market not found' });

        const bookieUserIds = await getBookieUserIds(req.admin);
        const matchFilter = { marketId };
        if (bookieUserIds !== null) matchFilter.userId = { $in: bookieUserIds };
        const dateKey = date || toDateKeyIST(new Date());
        const startOfDay = new Date(`${dateKey}T00:00:00+05:30`);
        const endOfDay = new Date(`${dateKey}T23:59:59.999+05:30`);
        matchFilter.createdAt = { $gte: startOfDay, $lte: endOfDay };
        // Back-compat: older callers used `session=`; bets store `betOn` ('open' | 'close')
        if (session) matchFilter.betOn = session;

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
 * Body: { secretDeclarePassword?: string } – required if admin has it set
 */
export const deleteMarket = async (req, res) => {
    try {
        const adminWithSecret = await Admin.findById(req.admin._id).select('+secretDeclarePassword').lean();
        if (adminWithSecret?.secretDeclarePassword) {
            const provided = (req.body.secretDeclarePassword ?? '').toString().trim();
            const isValid = await bcrypt.compare(provided, adminWithSecret.secretDeclarePassword);
            if (!isValid) {
                return res.status(403).json({
                    success: false,
                    message: 'Invalid secret declare password. Please enter the correct password to delete the market.',
                    code: 'INVALID_SECRET_DECLARE_PASSWORD',
                });
            }
        }
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

/**
 * Get all bets for a market with user details - separated by opening/closing
 * GET /api/v1/markets/get-market-bets/:id
 * Returns all bets with user information, separated by betOn (open/close)
 */
export const getMarketBets = async (req, res) => {
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

        // Filter bets by today IST
        const todayKey = toDateKeyIST(new Date());
        const startOfTodayIST = new Date(`${todayKey}T00:00:00+05:30`);
        const endOfTodayIST = new Date(`${todayKey}T23:59:59.999+05:30`);
        matchFilter.createdAt = { $gte: startOfTodayIST, $lte: endOfTodayIST };

        const bets = await Bet.find(matchFilter)
            .populate('userId', 'username phone email')
            .populate('placedByBookieId', 'username')
            .sort({ createdAt: -1 })
            .lean();

        // Separate bets by betOn (open/close)
        const openBets = bets.filter(b => b.betOn === 'open' || !b.betOn);
        const closeBets = bets.filter(b => b.betOn === 'close');

        res.status(200).json({
            success: true,
            data: {
                open: openBets,
                close: closeBets,
                total: bets.length,
                totalOpen: openBets.length,
                totalClose: closeBets.length,
            },
        });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: 'Invalid market ID' });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};