/**
 * Shared admin menu paths, labels, and route-guard helpers.
 * Keep SPECIFIC_ADMIN_TABS in sync with backend/config/specificAdminTabs.js
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

/** Checkbox options for Specific Admin management (path + label). */
export const TAB_OPTIONS = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/all-users', label: 'All Players' },
    { path: '/bookie-management', label: 'Bookie Accounts' },
    { path: '/markets', label: 'Markets' },
    { path: '/2d-management', label: '2D Management (hub)' },
    { path: '/2d-management/current-slot-players', label: '2D — Players' },
    { path: '/2d-management/result-control', label: '2D — Result Control' },
    { path: '/2d-management/slot-history', label: '2D — Slot History' },
    { path: '/2d-management/tickets', label: '2D — All User Tickets' },
    { path: '/2d-management/old-slots', label: '2D — Old Slots Stats' },
    { path: '/3d-management', label: '3D Management (hub)' },
    { path: '/3d-management/current-slot-players', label: '3D — Players' },
    { path: '/3d-management/result-control', label: '3D — Result Control' },
    { path: '/3d-management/slot-history', label: '3D — Slot History' },
    { path: '/3d-management/tickets', label: '3D — All User Tickets' },
    { path: '/3d-management/old-slots', label: '3D — Old Slots Stats' },
    { path: '/games-revenue', label: 'Games Revenue' },
    { path: '/add-result', label: 'Add Result' },
    { path: '/update-rate', label: 'Update Rate' },
    { path: '/reports', label: 'Report' },
    { path: '/revenue', label: 'Revenue' },
    { path: '/payment-management', label: 'Payments' },
    { path: '/wallet', label: 'Wallet' },
    { path: '/logs', label: 'Logs' },
    { path: '/banner', label: 'Banner' },
    { path: '/lottery-news', label: 'Lottery News' },
    { path: '/settings', label: 'Settings' },
];

const TAB_LABEL_BY_PATH = Object.fromEntries(TAB_OPTIONS.map((t) => [t.path, t.label]));

export function getTabLabel(path) {
    return TAB_LABEL_BY_PATH[path] || path;
}

/** Routes allowed when a parent tab is allowed (not in sidebar). */
const RELATED_ROUTES = [
    { prefix: '/add-result', paths: ['/declare-confirm', '/declare-success'] },
    { prefix: '/all-users', paths: ['/add-user'] },
    { prefix: '/markets', paths: ['/add-market'] },
    { prefix: '/revenue', paths: ['/top-winners'] },
];

function normalizePath(pathname) {
    if (!pathname) return '/';
    const p = pathname.split('?')[0].replace(/\/+$/, '') || '/';
    return p;
}

/**
 * Whether pathname is allowed for specific_admin with given allowedTabs.
 */
export function isPathAllowedForSpecificAdmin(pathname, allowedTabs) {
    const tabs = Array.isArray(allowedTabs) ? allowedTabs.filter(Boolean) : [];
    if (tabs.length === 0) return false;

    const path = normalizePath(pathname);

    if (tabs.some((tab) => normalizePath(tab) === path)) return true;

    for (const tab of tabs) {
        const prefix = normalizePath(tab);
        if (prefix !== '/' && (path === prefix || path.startsWith(`${prefix}/`))) {
            return true;
        }
    }

    for (const { prefix, paths } of RELATED_ROUTES) {
        if (!tabs.includes(prefix)) continue;
        if (paths.some((p) => path === p || path.startsWith(`${p}/`))) return true;
    }

    if (tabs.includes('/add-result') && (path === '/declare-confirm' || path === '/declare-success')) {
        return true;
    }

    if (tabs.includes('/2d-management/result-control') && path.startsWith('/2d-management/quiz/')) {
        return true;
    }
    if (tabs.includes('/2d-management') && path.startsWith('/2d-management/quiz/')) {
        return true;
    }
    if (tabs.includes('/3d-management/result-control') && path.startsWith('/3d-management/set/')) {
        return true;
    }
    if (tabs.includes('/3d-management') && path.startsWith('/3d-management/set/')) {
        return true;
    }
    if (tabs.some((t) => t.startsWith('/3d-management')) && path === '/3d-management/slot-wise-bets') {
        return true;
    }

    return false;
}

export function getDefaultRouteForAdmin(admin) {
    if (!admin) return '/dashboard';
    if (admin.role === 'specific_admin') {
        const tabs = admin.allowedTabs || [];
        return tabs.length > 0 ? tabs[0] : '/dashboard';
    }
    return '/dashboard';
}
