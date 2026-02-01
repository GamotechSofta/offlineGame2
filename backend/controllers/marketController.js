import Market from '../models/market/market.js';
import { logActivity, getClientIp } from '../utils/activityLogger.js';

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
