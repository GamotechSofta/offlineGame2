/** Strict dotted IPv4 (octets 0–255). */
const IPV4_DOTTED =
    /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

const stripZoneIndex = (s) => {
    const i = s.indexOf('%');
    return i === -1 ? s : s.slice(0, i);
};

/**
 * Show dotted IPv4 (X.X.X.X): map ::ffff:x.x.x.x, ::1, and strip IPv6 zone index.
 * @param {string|null|undefined} ip
 * @returns {string}
 */
export function formatPlayerIp(ip) {
    if (ip == null || ip === '') return '—';
    let s = stripZoneIndex(String(ip).trim());
    if (!s) return '—';
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
}
