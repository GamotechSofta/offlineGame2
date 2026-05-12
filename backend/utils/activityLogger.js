import ActivityLog from '../models/activityLog/activityLog.js';

/**
 * Map IPv4-mapped IPv6 (::ffff:x.x.x.x) to dotted IPv4 for storage/display.
 * Leaves true IPv6 and plain IPv4 unchanged.
 */
export const normalizeClientIp = (ip) => {
    if (ip == null) return null;
    const s = String(ip).trim();
    if (!s) return null;
    const lower = s.toLowerCase();
    if (lower.startsWith('::ffff:')) {
        const tail = s.slice(7).split('%')[0];
        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(tail)) return tail;
    }
    return s;
};

/**
 * Extract real client IP; safe behind Render/reverse proxy.
 * Priority: (a) X-Forwarded-For first IP, (b) req.ip, (c) req.socket.remoteAddress.
 */
export const getClientIp = (req) => {
    if (!req) return null;
    const xForwardedFor = req.headers?.['x-forwarded-for'];
    if (xForwardedFor) {
        const first = String(xForwardedFor).split(',')[0]?.trim();
        if (first) return normalizeClientIp(first);
    }
    if (req.ip) return normalizeClientIp(req.ip);
    if (req.socket?.remoteAddress) return normalizeClientIp(req.socket.remoteAddress);
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
