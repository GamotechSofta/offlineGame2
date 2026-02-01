import ActivityLog from '../models/activityLog/activityLog.js';

/** Extract client IP from request */
export const getClientIp = (req) => {
    if (!req) return null;
    const forwarded = req.headers?.['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0]?.trim();
    return req.ip || req.connection?.remoteAddress || null;
};

/**
 * Log an activity. Does not throw - logs errors silently.
 * Pass req for IP: logActivity({ ..., ip: getClientIp(req) })
 */
export const logActivity = async ({
    action,
    performedBy = 'System',
    performedByType = 'system',
    targetType = null,
    targetId = null,
    details = null,
    meta = null,
    ip = null,
}) => {
    try {
        await ActivityLog.create({
            action,
            performedBy: String(performedBy),
            performedByType,
            targetType,
            targetId: targetId ? String(targetId) : null,
            details,
            meta,
            ip,
        });
    } catch (err) {
        console.error('[ActivityLog] Failed to log:', err.message);
    }
};
