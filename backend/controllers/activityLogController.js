import ActivityLog from '../models/activityLog/activityLog.js';

/**
 * Get activity logs - super_admin only
 */
export const getLogs = async (req, res) => {
    try {
        if (req.admin?.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Only Super Admin can view logs',
            });
        }

        const { page = 1, limit = 100, action, performedBy, performedByType, sort = 'desc' } = req.query;
        const normalizedPage = Math.max(1, parseInt(page, 10) || 1);
        const normalizedLimit = Math.min(200, Math.max(20, parseInt(limit, 10) || 100));
        const skip = (normalizedPage - 1) * normalizedLimit;

        const query = {};
        if (action) query.action = new RegExp(action, 'i');
        if (performedBy) query.performedBy = new RegExp(performedBy, 'i');
        if (performedByType && ['admin', 'super_admin', 'bookie', 'user', 'system'].includes(performedByType)) {
            query.performedByType = performedByType;
        }

        const [logs, total] = await Promise.all([
            ActivityLog.find(query)
                .select('action performedBy performedByType details targetType targetId createdAt')
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
