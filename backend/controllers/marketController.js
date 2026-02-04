import Market from '../models/market/market.js';
import Bet from '../models/bet/bet.js';
import MarketResult from '../models/marketResult/marketResult.js';
import { logActivity, getClientIp } from '../utils/activityLogger.js';
import { getBookieUserIds } from '../utils/bookieFilter.js';
import { previewDeclareOpen, previewDeclareClose, settleOpening, settleClosing } from '../utils/settleBets.js';

/**
 * Create a new market.
 * Body: { marketName, startingTime, closingTime, betClosureTime? }
 */
export const createMarket = async (req, res) => {
    try {
        const { marketName, startingTime, closingTime, betClosureTime } = req.body;
        if (!marketName || !startingTime || !closingTime) {
            return res.status(400).json({
                success: false,
                message: 'marketName, startingTime and closingTime are required',
            });
        }
        const betClosureSec = betClosureTime != null && betClosureTime !== '' ? Number(betClosureTime) : null;
        const market = new Market({ marketName, startingTime, closingTime, betClosureTime: betClosureSec });
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
 */
export const getMarkets = async (req, res) => {
    try {
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
        const { marketName, startingTime, closingTime, betClosureTime } = req.body;
        const updates = {};
        if (marketName !== undefined) updates.marketName = marketName;
        if (startingTime !== undefined) updates.startingTime = startingTime;
        if (closingTime !== undefined) updates.closingTime = closingTime;
        if (betClosureTime !== undefined) updates.betClosureTime = betClosureTime != null && betClosureTime !== '' ? Number(betClosureTime) : null;

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
 * Preview declare open: ?openingNumber=156 returns totalBetAmount, totalWinAmount, noOfPlayers, profit.
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
        const stats = await previewDeclareOpen(marketId, openingNumber || null);
        res.status(200).json({ success: true, data: stats });
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
        try {
            const dateKey = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Kolkata',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            }).format(new Date()); // YYYY-MM-DD

            await MarketResult.findOneAndUpdate(
                { marketId: updated._id, dateKey },
                {
                    $set: {
                        marketName: updated.marketName,
                        openingNumber: updated.openingNumber || null,
                        closingNumber: updated.closingNumber || null,
                        displayResult: response.displayResult || '***-**-***',
                    },
                },
                { upsert: true, new: true }
            );
        } catch (_) {
            // ignore history storage failures
        }

        res.status(200).json({ success: true, message: 'Open result declared', data: response });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Preview declare close: ?closingNumber=456 returns totalBetAmount, totalWinAmount, noOfPlayers, profit (for jodi/half-sangam/full-sangam pending bets).
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
        const stats = await previewDeclareClose(marketId, closingNumber || null);
        res.status(200).json({ success: true, data: stats });
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
        try {
            const dateKey = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Kolkata',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            }).format(new Date()); // YYYY-MM-DD

            await MarketResult.findOneAndUpdate(
                { marketId: updated._id, dateKey },
                {
                    $set: {
                        marketName: updated.marketName,
                        openingNumber: updated.openingNumber || null,
                        closingNumber: updated.closingNumber || null,
                        displayResult: response.displayResult || '***-**-***',
                    },
                },
                { upsert: true, new: true }
            );
        } catch (_) {
            // ignore history storage failures
        }

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
        const todayKey = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(new Date());

        const dateKey = (req.query.date || todayKey).toString().trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
            return res.status(400).json({ success: false, message: 'date must be YYYY-MM-DD' });
        }

        // Do not allow future date
        if (dateKey > todayKey) {
            return res.status(200).json({ success: true, data: [] });
        }

        // For today's date: show all markets with current displayResult (past/present), even if not declared yet.
        // This matches the expected UI where current-date list is always visible.
        if (dateKey === todayKey) {
            const markets = await Market.find().sort({ startingTime: 1 }).lean();
            const data = markets.map((m) => {
                const doc = { ...m };
                // Mongoose lean() doesn't include instance methods; compute displayResult using schema helper via Market model instance.
                // We'll reconstruct displayResult similar to Market.getDisplayResult() logic:
                const opening = doc.openingNumber && /^\d{3}$/.test(String(doc.openingNumber)) ? String(doc.openingNumber) : null;
                const closing = doc.closingNumber && /^\d{3}$/.test(String(doc.closingNumber)) ? String(doc.closingNumber) : null;
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

                return {
                    marketId: doc._id,
                    marketName: doc.marketName,
                    dateKey,
                    displayResult,
                    openingNumber: doc.openingNumber || null,
                    closingNumber: doc.closingNumber || null,
                    startingTime: doc.startingTime,
                    closingTime: doc.closingTime,
                };
            });
            return res.status(200).json({ success: true, data });
        }

        const results = await MarketResult.find({ dateKey })
            .select('marketId marketName dateKey displayResult openingNumber closingNumber createdAt updatedAt')
            .sort({ marketName: 1 })
            .lean();

        res.status(200).json({ success: true, data: results });
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
                } else {
                    if (!singlePatti.items[num]) singlePatti.items[num] = { amount: 0, count: 0 };
                    singlePatti.items[num].amount += amount;
                    singlePatti.items[num].count += 1;
                    singlePatti.totalAmount += amount;
                    singlePatti.totalBets += 1;
                }
            } else if (type === 'half-sangam' && num.length > 0) {
                if (!halfSangam.items[num]) halfSangam.items[num] = { amount: 0, count: 0 };
                halfSangam.items[num].amount += amount;
                halfSangam.items[num].count += 1;
                halfSangam.totalAmount += amount;
                halfSangam.totalBets += 1;
            } else if (type === 'full-sangam' && num.length > 0) {
                if (!fullSangam.items[num]) fullSangam.items[num] = { amount: 0, count: 0 };
                fullSangam.items[num].amount += amount;
                fullSangam.items[num].count += 1;
                fullSangam.totalAmount += amount;
                fullSangam.totalBets += 1;
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
