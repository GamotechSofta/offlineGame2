import ActivityLog from '../models/activityLog/activityLog.js';

/** Strict dotted IPv4 (octets 0–255). */
const IPV4_DOTTED =
    /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

const stripZoneIndex = (s) => {
    const i = s.indexOf('%');
    return i === -1 ? s : s.slice(0, i);
};

/**
 * Map IPv4-mapped IPv6 (::ffff:x.x.x.x), loopback ::1, and zone indexes to dotted IPv4 where possible.
 * Leaves true IPv6 and plain IPv4 unchanged.
 */
export const normalizeClientIp = (ip) => {
    if (ip == null) return null;
    let s = stripZoneIndex(String(ip).trim());
    if (!s) return null;
    if (s.startsWith('[') && s.includes(']')) {
        s = stripZoneIndex(s.slice(1, s.indexOf(']')));
    }
    const lower = s.toLowerCase();
    if (lower === '::1') return '127.0.0.1';
    if (IPV4_DOTTED.test(lower)) return lower;
    if (lower.startsWith('::ffff:')) {
        const tail = stripZoneIndex(s.slice(7));
        if (IPV4_DOTTED.test(tail)) return tail;
    }
    return s;
};

const SINGLE_CLIENT_IP_HEADERS = ['cf-connecting-ip', 'true-client-ip', 'x-real-ip'];

/**
 * Extract real client IP; safe behind reverse proxy / CDN.
 * Priority: CF-Connecting-IP, True-Client-IP, X-Real-IP, X-Forwarded-For (first hop), req.ip, socket.
 */
export const getClientIp = (req) => {
    if (!req) return null;
    for (const h of SINGLE_CLIENT_IP_HEADERS) {
        const raw = req.headers?.[h];
        const v = Array.isArray(raw) ? raw[0] : raw;
        if (v && String(v).trim()) {
            const n = normalizeClientIp(String(v).trim());
            if (n) return n;
        }
    }
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
