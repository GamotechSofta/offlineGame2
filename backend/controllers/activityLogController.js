import ActivityLog from '../models/activityLog/activityLog.js';
import { ADMIN_TAB, denyUnlessTabAccess } from '../utils/adminTabAccess.js';

/**
 * Get activity logs - super_admin or Super Bookie with /logs tab
 */
export const getLogs = async (req, res) => {
    try {
        if (denyUnlessTabAccess(res, req.admin, ADMIN_TAB.LOGS, 'You do not have access to logs')) {
            return;
        }

        const { page = 1, limit = 100, action, performedBy, performedByType, sort = 'desc' } = req.query;
        const normalizedPage = Math.max(1, parseInt(page, 10) || 1);
        const normalizedLimit = Math.min(500, Math.max(20, parseInt(limit, 10) || 100));
        const skip = (normalizedPage - 1) * normalizedLimit;

        const query = {};
        if (action) query.action = String(action).trim();
        if (performedBy) query.performedBy = new RegExp(performedBy, 'i');
        const allowedTypes = ['admin', 'super_admin', 'bookie', 'super_bookie', 'user', 'system'];
        if (performedByType && allowedTypes.includes(performedByType)) {
            query.performedByType = performedByType;
        }

        const [logs, total] = await Promise.all([
            ActivityLog.find(query)
                .select('action performedBy performedByType details targetType targetId ip meta createdAt updatedAt')
                .sort({ createdAt: sort === 'asc' ? 1 : -1 })
                .skip(skip)
                .limit(normalizedLimit)
                .lean(),
            ActivityLog.countDocuments(query),
        ]);

        res.status(200).json({
            success: true,
            data: logs,
            pagination: {
                page: normalizedPage,
                limit: normalizedLimit,
                total,
                totalPages: Math.max(1, Math.ceil(total / normalizedLimit)),
                hasNextPage: skip + logs.length < total,
                hasPrevPage: normalizedPage > 1,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
