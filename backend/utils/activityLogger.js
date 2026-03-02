import ActivityLog from '../models/activityLog/activityLog.js';

/**
 * Extract real client IP; safe behind Render/reverse proxy.
 * Priority: (a) X-Forwarded-For first IP, (b) req.ip, (c) req.socket.remoteAddress.
 */
export const getClientIp = (req) => {
    if (!req) return null;
    const xForwardedFor = req.headers?.['x-forwarded-for'];
    if (xForwardedFor) {
        const first = String(xForwardedFor).split(',')[0]?.trim();
        if (first) return first;
    }
    if (req.ip) return req.ip;
    if (req.socket?.remoteAddress) return req.socket.remoteAddress;
    return null;
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
