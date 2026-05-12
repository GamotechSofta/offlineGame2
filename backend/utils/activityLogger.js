import ActivityLog from '../models/activityLog/activityLog.js';

const IPV4_DOTTED = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Normalize client IP for storage: prefer IPv6 textual form.
 * - Strips zone id (e.g. fe80::1%eth0).
 * - Keeps IPv4-mapped IPv6 as ::ffff:x.x.x.x (does not collapse to IPv4).
 * - Plain dotted IPv4 becomes ::ffff:x.x.x.x so DB shows an IPv6-style address.
 */
export const normalizeClientIp = (ip) => {
    if (ip == null) return null;
    let s = String(ip).trim();
    if (!s) return null;
    const zi = s.indexOf('%');
    if (zi !== -1) s = s.slice(0, zi);
    const lower = s.toLowerCase();
    if (lower.startsWith('::ffff:')) {
        const tail = s.slice(7);
        if (IPV4_DOTTED.test(tail)) return `::ffff:${tail}`;
        return s;
    }
    if (IPV4_DOTTED.test(s)) return `::ffff:${s}`;
    return s.includes(':') ? lower : s;
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
