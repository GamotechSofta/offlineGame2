/**
 * Tab-based access for Super Bookie (specific_admin) accounts.
 * super_admin always has full access; specific_admin only when path is in allowedTabs.
 */

export const ADMIN_TAB = {
    DASHBOARD: '/dashboard',
    ALL_USERS: '/all-users',
    BOOKIE_MANAGEMENT: '/bookie-management',
    MARKETS: '/markets',
    GAMES_REVENUE: '/games-revenue',
    ADD_RESULT: '/add-result',
    UPDATE_RATE: '/update-rate',
    REPORTS: '/reports',
    REVENUE: '/revenue',
    BOOKIE_COMMISSIONS: '/bookie-commissions',
    PAYMENT_MANAGEMENT: '/payment-management',
    WALLET: '/wallet',
    LOGS: '/logs',
    BANNER: '/banner',
    LOTTERY_NEWS: '/lottery-news',
    SETTINGS: '/settings',
    HELP_DESK: '/help-desk',
    TWO_D_MANAGEMENT: '/2d-management',
    THREE_D_MANAGEMENT: '/3d-management',
};

export function isSuperAdmin(admin) {
    return admin?.role === 'super_admin';
}

export function isSuperBookie(admin) {
    return admin?.role === 'specific_admin';
}

export function hasAdminTabAccess(admin, tabPath) {
    if (!admin) return false;
    if (isSuperAdmin(admin)) return true;
    if (isSuperBookie(admin)) {
        const tabs = admin.allowedTabs || [];
        return Array.isArray(tabs) && tabs.includes(tabPath);
    }
    return false;
}

/** Send 403 and return true if access denied. */
export function denyUnlessTabAccess(res, admin, tabPath, message = 'You do not have access to this resource') {
    if (hasAdminTabAccess(admin, tabPath)) return false;
    res.status(403).json({ success: false, message });
    return true;
}

/** Send 403 and return true if not super_admin. */
export function denyUnlessSuperAdmin(res, admin, message = 'Only Super Admin can perform this action') {
    if (isSuperAdmin(admin)) return false;
    res.status(403).json({ success: false, message });
    return true;
}

export function canAccessBookieManagement(admin) {
    return hasAdminTabAccess(admin, ADMIN_TAB.BOOKIE_MANAGEMENT);
}

export function canAccessAllUsers(admin) {
    return hasAdminTabAccess(admin, ADMIN_TAB.ALL_USERS);
}

export function canAccessLogs(admin) {
    return hasAdminTabAccess(admin, ADMIN_TAB.LOGS);
}

export function canAccessReports(admin) {
    return hasAdminTabAccess(admin, ADMIN_TAB.REPORTS);
}

export function canAccessRevenue(admin) {
    return hasAdminTabAccess(admin, ADMIN_TAB.REVENUE);
}

export function canAccessBookieCommissions(admin) {
    return hasAdminTabAccess(admin, ADMIN_TAB.BOOKIE_COMMISSIONS);
}

export function canAccessHelpDesk(admin) {
    return hasAdminTabAccess(admin, ADMIN_TAB.HELP_DESK);
}

/** Super Bookie with player tabs sees all users (same scope as super_admin for reads). */
export function hasFullPlayerListScope(admin) {
    return isSuperAdmin(admin) || (isSuperBookie(admin) && canAccessAllUsers(admin));
}
