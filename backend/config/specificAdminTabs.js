/**
 * Whitelisted sidebar paths assignable to specific_admin accounts.
 * Keep in sync with admin/src/config/adminMenu.js
 */
export const SPECIFIC_ADMIN_TABS = [
    '/dashboard',
    '/all-users',
    '/bookie-management',
    '/markets',
    '/2d-management',
    '/2d-management/current-slot-players',
    '/2d-management/result-control',
    '/2d-management/slot-history',
    '/2d-management/tickets',
    '/2d-management/old-slots',
    '/3d-management',
    '/3d-management/current-slot-players',
    '/3d-management/result-control',
    '/3d-management/slot-history',
    '/3d-management/tickets',
    '/3d-management/old-slots',
    '/games-revenue',
    '/add-result',
    '/update-rate',
    '/reports',
    '/revenue',
    '/payment-management',
    '/wallet',
    '/logs',
    '/banner',
    '/lottery-news',
    '/settings',
];

/** Filter and dedupe tab paths against whitelist, preserving whitelist order. */
export function filterAllowedTabs(paths) {
    if (!Array.isArray(paths)) return [];
    const set = new Set(paths.map((p) => String(p).trim()).filter(Boolean));
    return SPECIFIC_ADMIN_TABS.filter((tab) => set.has(tab));
}
