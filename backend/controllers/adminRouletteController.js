import RouletteGame from '../models/rouletteGame/rouletteGame.js';
import { getConfig } from '../models/rouletteGame/rouletteConfig.js';
import RouletteConfig from '../models/rouletteGame/rouletteConfig.js';
import { getBookieUserIds } from '../utils/bookieFilter.js';

/**
 * GET /api/v1/admin/roulette/records
 * Super admin: all records. Bookie: only referred users. Query: userId, startDate, endDate, limit, page.
 */
export async function getRouletteRecords(req, res) {
    try {
        const { userId, startDate, endDate } = req.query;
        const limit = Math.min(Number(req.query?.limit) || 50, 200);
        const page = Math.max(1, Number(req.query?.page) || 1);
        const skip = (page - 1) * limit;

        const query = {};
        const bookieUserIds = await getBookieUserIds(req.admin);
        if (bookieUserIds !== null) {
            if (bookieUserIds.length === 0) {
                return res.status(200).json({ success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
            }
            query.user = { $in: bookieUserIds };
            if (userId) {
                const ids = bookieUserIds.map((id) => id.toString());
                if (ids.includes(userId)) query.user = userId;
            }
        } else if (userId) {
            query.user = userId;
        }

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

        const [list, total] = await Promise.all([
            RouletteGame.find(query)
                .populate('user', 'username email phone')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .select('spinId user winningNumber totalBet payout profit createdAt')
                .lean(),
            RouletteGame.countDocuments(query),
        ]);

        return res.status(200).json({
            success: true,
            data: list,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message || 'Failed to get roulette records' });
    }
}

/**
 * GET /api/v1/admin/roulette/config - same as public config, for admin UI
 */
export async function getAdminRouletteConfig(req, res) {
    try {
        const config = await getConfig();
        return res.status(200).json({ success: true, data: config || {} });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message || 'Failed to get config' });
    }
}

/**
 * PATCH /api/v1/admin/roulette/config - super admin only. Body: { targetWinRatePercent }
 */
export async function updateRouletteConfig(req, res) {
    try {
        const { targetWinRatePercent } = req.body || {};
        const updates = {};
        if (typeof targetWinRatePercent === 'number' && targetWinRatePercent >= 0 && targetWinRatePercent <= 100) {
            updates.targetWinRatePercent = targetWinRatePercent;
        }
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, message: 'No valid fields to update (e.g. targetWinRatePercent 0-100)' });
        }
        const doc = await RouletteConfig.findOneAndUpdate(
            { key: 'main' },
            { $set: updates },
            { new: true, runValidators: true }
        ).lean();
        if (!doc) {
            return res.status(404).json({ success: false, message: 'Roulette config not found' });
        }
        return res.status(200).json({ success: true, data: doc, message: 'Roulette config updated' });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message || 'Failed to update config' });
    }
}
