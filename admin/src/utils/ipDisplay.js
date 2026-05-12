/**
 * Show IPv4 when the address is IPv4-mapped IPv6 (::ffff:x.x.x.x).
 * @param {string|null|undefined} ip
 * @returns {string}
 */
export function formatPlayerIp(ip) {
    if (ip == null || ip === '') return '—';
    const s = String(ip).trim();
    if (!s) return '—';
    if (s === '::1' || s === '127.0.0.1') return 'localhost';
    const lower = s.toLowerCase();
    if (lower.startsWith('::ffff:')) {
        const tail = s.slice(7).split('%')[0];
        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(tail)) return tail;
    }
    return s;
}
