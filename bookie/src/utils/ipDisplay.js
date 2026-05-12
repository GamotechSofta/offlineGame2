const IPV4_DOTTED = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Display IP in IPv6-friendly form (::ffff:x.x.x.x for IPv4 / mapped; lowercase for real IPv6).
 * @param {string|null|undefined} ip
 * @returns {string}
 */
export function formatPlayerIp(ip) {
    if (ip == null || ip === '') return '—';
    let s = String(ip).trim();
    if (!s) return '—';
    const zi = s.indexOf('%');
    if (zi !== -1) s = s.slice(0, zi);
    if (IPV4_DOTTED.test(s)) return `::ffff:${s}`;
    const lower = s.toLowerCase();
    if (lower.startsWith('::ffff:')) {
        const tail = s.slice(7);
        if (IPV4_DOTTED.test(tail)) return `::ffff:${tail}`;
    }
    return s.includes(':') ? lower : s;
}
