export const getPlayerOwnership = (u) => {
    if (!u) return { pool: 'super_admin', bookie: null, superBookie: null };
    if (u.referrerChain?.superBookie) {
        return {
            pool: 'super_bookie',
            bookie: u.referrerChain.bookie?.username || null,
            superBookie: u.referrerChain.superBookie?.username || null,
        };
    }
    if (u.referrerChain?.bookie || (u.referredBy && u.referredBy.role !== 'super_bookie')) {
        return {
            pool: 'bookie',
            bookie: u.referrerChain?.bookie?.username || u.referredBy?.username || null,
            superBookie: null,
        };
    }
    if (u.referredBy?.role === 'super_bookie') {
        return { pool: 'super_bookie', bookie: null, superBookie: u.referredBy?.username || null };
    }
    if (u.referredBy) {
        return { pool: 'bookie', bookie: u.referredBy?.username || null, superBookie: null };
    }
    if (u.source === 'super_bookie') {
        return { pool: 'super_bookie', bookie: null, superBookie: null };
    }
    if (u.source === 'bookie') {
        return { pool: 'bookie', bookie: null, superBookie: null };
    }
    return { pool: 'super_admin', bookie: null, superBookie: null };
};

export const getBelongsToLabel = (u) => {
    const o = getPlayerOwnership(u);
    if (o.pool === 'super_admin') return 'Super Admin';
    if (o.superBookie && o.bookie) return `${o.bookie} › ${o.superBookie}`;
    if (o.superBookie) return o.superBookie;
    return o.bookie || '—';
};
