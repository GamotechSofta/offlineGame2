import {
    FaTachometerAlt,
    FaChartBar,
    FaChartLine,
    FaCreditCard,
    FaWallet,
    FaUsers,
    FaUserFriends,
    FaEdit,
    FaClipboardList,
    FaCoins,
    FaCog,
    FaMoneyBillWave,
    FaLifeRing,
    FaDice,
    FaImage,
    FaBullhorn,
    FaGamepad,
    FaUserShield,
} from 'react-icons/fa';

/** Full sidebar menu (super_admin base). Specific items added in Sidebar by role. */
export const ALL_MENU_ITEMS = [
    { path: '/dashboard', label: 'Dashboard', icon: FaTachometerAlt },
    { path: '/all-users', label: 'All Players', icon: FaUserFriends },
    { path: '/bookie-management', label: 'SuperBookie Accounts', icon: FaUsers },
    { path: '/markets', label: 'Markets', icon: FaChartBar },
    {
        path: '/2d-management',
        label: '2D Management',
        icon: FaDice,
        children: [
            { path: '/2d-management/current-slot-players', label: '2D players' },
            { path: '/2d-management/result-control', label: 'Result Control' },
            { path: '/2d-management/slot-history', label: 'Slot History' },
            { path: '/2d-management/tickets', label: 'All User Tickets' },
            { path: '/2d-management/old-slots', label: 'Old Slots Stats' },
        ],
    },
    {
        path: '/3d-management',
        label: '3D Management',
        icon: FaDice,
        children: [
            { path: '/3d-management/current-slot-players', label: '3D players' },
            { path: '/3d-management/result-control', label: 'Result Control' },
            { path: '/3d-management/slot-history', label: 'Slot History' },
            { path: '/3d-management/tickets', label: 'All User Tickets' },
            { path: '/3d-management/old-slots', label: 'Old Slots Stats' },
        ],
    },
    { path: '/games-revenue', label: 'Games Revenue', icon: FaGamepad },
    { path: '/add-result', label: 'Add Result', icon: FaEdit },
    { path: '/update-rate', label: 'Update Rate', icon: FaCoins },
    { path: '/reports', label: 'Report', icon: FaChartLine },
    { path: '/revenue', label: 'Revenue', icon: FaMoneyBillWave },
    { path: '/payment-management', label: 'Payments', icon: FaCreditCard },
    { path: '/wallet', label: 'Wallet', icon: FaWallet },
    { path: '/logs', label: 'Logs', icon: FaClipboardList },
    { path: '/banner', label: 'Banner', icon: FaImage },
    { path: '/lottery-news', label: 'Lottery News', icon: FaBullhorn },
    { path: '/settings', label: 'Settings', icon: FaCog },
];

export const SUPER_ADMIN_ONLY_ITEMS = [
    { path: '/bookie-commissions', label: 'SuperBookie Commissions', icon: FaMoneyBillWave },
    { path: '/help-desk', label: 'Help Desk Issues', icon: FaLifeRing },
];

export const SPECIFIC_ADMIN_MANAGEMENT_ITEM = {
    path: '/specific-admin',
    label: 'Specific Admin',
    icon: FaUserShield,
};

/**
 * Build visible menu for current admin.
 */
export function buildMenuForAdmin(admin) {
    const role = admin?.role || '';
    const allowedTabs = admin?.allowedTabs || [];

    if (role === 'specific_admin') {
        return ALL_MENU_ITEMS.map((item) => {
            if (item.children) {
                const parentAllowed = allowedTabs.includes(item.path);
                const children = parentAllowed
                    ? item.children
                    : item.children.filter((c) => allowedTabs.includes(c.path));
                if (!parentAllowed && children.length === 0) return null;
                return { ...item, children };
            }
            return allowedTabs.includes(item.path) ? item : null;
        }).filter(Boolean);
    }

    const items = [...ALL_MENU_ITEMS];
    const revenueIdx = items.findIndex((item) => item.path === '/revenue');
    const insertAt = revenueIdx >= 0 ? revenueIdx : items.length;
    items.splice(insertAt, 0, ...SUPER_ADMIN_ONLY_ITEMS);

    if (role === 'super_admin') {
        items.push(SPECIFIC_ADMIN_MANAGEMENT_ITEM);
    }

    return items;
}

export function getSidebarTitle(role) {
    if (role === 'specific_admin') return 'Specific Admin';
    if (role === 'super_admin') return 'Super Admin';
    return 'Admin';
}

export function getSidebarAbbrev(role) {
    if (role === 'specific_admin') return 'Sp';
    if (role === 'super_admin') return 'SA';
    return 'AD';
}
