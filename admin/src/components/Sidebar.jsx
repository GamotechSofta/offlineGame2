import React, { useRef, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    FaTachometerAlt,
    FaChartBar,
    FaChartLine,
    FaCreditCard,
    FaWallet,
    FaSignOutAlt,
    FaUsers,
    FaUserFriends,
    FaEdit,
    FaTimes,
    FaClipboardList,
    FaCoins,
    FaCog,
    FaMoneyBillWave,
    FaLifeRing,
    FaDice,
    FaImage,
    FaBullhorn,
    FaGamepad,
    FaChevronLeft,
    FaChevronRight,
} from 'react-icons/fa';

const Sidebar = ({
    onLogout,
    isOpen = true,
    onClose,
    collapsed = false,
    onToggleCollapsed,
    onExpandSidebar,
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const navRef = useRef(null);
    const savedScrollTop = useRef(0);
    const [expandedMenus, setExpandedMenus] = useState({});

    // Hide Help Desk issues from non-super-admin users.
    let adminRole = '';
    try {
        const adminRaw = localStorage.getItem('admin');
        const parsed = adminRaw ? JSON.parse(adminRaw) : null;
        adminRole = parsed?.role || '';
    } catch {
        adminRole = '';
    }

    const menuItems = [
        { path: '/dashboard', label: 'Dashboard', icon: FaTachometerAlt },
        { path: '/all-users', label: 'All Players', icon: FaUserFriends },
        { path: '/bookie-management', label: 'Bookie Accounts', icon: FaUsers },
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

    if (adminRole === 'super_admin') {
        // Insert before "Revenue" (index shifts when items are added above, e.g. Games Revenue).
        const revenueIdx = menuItems.findIndex((item) => item.path === '/revenue');
        const insertAt = revenueIdx >= 0 ? revenueIdx : 10;
        menuItems.splice(insertAt, 0, { path: '/bookie-commissions', label: 'Bookie Commissions', icon: FaMoneyBillWave });
        menuItems.splice(insertAt + 1, 0, { path: '/help-desk', label: 'Help Desk Issues', icon: FaLifeRing });
    }

    const isActive = (path) => {
        if (path === '/all-users' || path === '/markets') {
            return location.pathname === path || location.pathname.startsWith(path + '/');
        }
        if (path === '/revenue') {
            return location.pathname === '/revenue' || location.pathname.startsWith('/revenue/');
        }
        if (path === '/bookie-commissions') {
            return location.pathname === '/bookie-commissions';
        }
        if (path === '/reports') {
            return location.pathname === '/reports';
        }
        if (path === '/2d-management' || path === '/3d-management') {
            return location.pathname === path || location.pathname.startsWith(`${path}/`);
        }
        return location.pathname === path;
    };

    const isChildActive = (path) => {
        if (location.pathname === path) return true;
        // Treat 2D quiz stake detail as part of Result Control flow.
        if (
            path === '/2d-management/result-control' &&
            location.pathname.startsWith('/2d-management/quiz/')
        ) {
            return true;
        }
        // Treat 3D set stake detail as part of Result Control flow.
        if (
            path === '/3d-management/result-control' &&
            location.pathname.startsWith('/3d-management/set/')
        ) {
            return true;
        }
        return false;
    };

    const handleNav = (path, hasChildren = false) => {
        savedScrollTop.current = navRef.current?.scrollTop ?? 0;
        if (collapsed && hasChildren) {
            onExpandSidebar?.();
            setExpandedMenus((prev) => ({ ...prev, [path]: true }));
            navigate(path);
            onClose?.();
            return;
        }
        navigate(path);
        if (hasChildren) {
            setExpandedMenus((prev) => ({ ...prev, [path]: !prev[path] }));
        }
        onClose?.();
    };

    const handleToggleParent = (path) => {
        setExpandedMenus((prev) => ({ ...prev, [path]: !prev[path] }));
    };

    useEffect(() => {
        if (navRef.current != null && savedScrollTop.current > 0) {
            navRef.current.scrollTop = savedScrollTop.current;
            savedScrollTop.current = 0;
        }
    }, [location.pathname]);

    useEffect(() => {
        setExpandedMenus((prev) => ({
            ...prev,
            '/2d-management': prev['/2d-management'] ?? location.pathname.startsWith('/2d-management'),
            '/3d-management': prev['/3d-management'] ?? location.pathname.startsWith('/3d-management'),
        }));
    }, [location.pathname]);

    return (
        <aside
            className={`fixed left-0 top-0 z-50 flex h-[100dvh] max-h-[100dvh] w-64 min-h-0 flex-col overflow-y-auto overflow-x-hidden border-r border-gray-200 bg-white shadow-lg transition-all duration-200 ease-in-out sm:w-[var(--admin-sidebar-w)] lg:translate-x-0 ${
                collapsed ? 'lg:w-[var(--admin-sidebar-collapsed-w)]' : 'lg:w-[var(--admin-sidebar-w)]'
            } ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
            {/* Logo + collapse (desktop) + close (mobile) */}
            <div
                className={`flex shrink-0 items-center gap-2 border-b border-gray-200 p-4 sm:p-6 ${
                    collapsed
                        ? 'justify-between lg:flex-col lg:justify-center lg:gap-3 lg:px-2 lg:py-4'
                        : 'justify-between'
                }`}
            >
                <h2
                    className={`min-w-0 flex-1 truncate text-lg font-bold text-orange-500 sm:text-xl ${collapsed ? 'lg:hidden' : ''}`}
                >
                    Super Admin
                </h2>
                <span
                    className={`hidden text-center text-[10px] font-bold leading-tight tracking-tight text-orange-500 ${collapsed ? 'lg:block' : ''}`}
                >
                    SA
                </span>
                <div className="flex shrink-0 items-center gap-1">
                    <button
                        type="button"
                        onClick={() => onToggleCollapsed?.()}
                        className="hidden rounded-lg p-2 text-gray-600 hover:bg-gray-100 lg:inline-flex"
                        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        {collapsed ? (
                            <FaChevronRight className="h-5 w-5" />
                        ) : (
                            <FaChevronLeft className="h-5 w-5" />
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 lg:hidden"
                        aria-label="Close menu"
                    >
                        <FaTimes className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Menu Items */}
            <nav
                ref={navRef}
                className={`flex-1 space-y-1 overflow-y-auto p-3 sm:p-4 ${collapsed ? 'lg:px-1.5 lg:py-2' : ''}`}
            >
                {menuItems.map((item) => {
                    const hasChildren = Array.isArray(item.children) && item.children.length > 0;
                    const expanded = Boolean(expandedMenus[item.path]);
                    return (
                        <div key={item.path}>
                            <button
                                type="button"
                                title={item.label}
                                onClick={() => handleNav(item.path, hasChildren)}
                                className={`flex w-full items-center rounded-xl px-3 py-2.5 text-sm transition-all duration-200 sm:px-4 sm:py-3 sm:text-base ${
                                    collapsed ? 'lg:justify-center lg:gap-0 lg:px-2' : 'justify-between gap-3'
                                } ${
                                    isActive(item.path)
                                        ? 'bg-gradient-to-r from-orange-500 to-orange-600 font-semibold text-white shadow-lg shadow-orange-500/20'
                                        : 'text-gray-600 hover:-translate-y-0.5 hover:bg-orange-50 hover:text-orange-600'
                                }`}
                            >
                                <span
                                    className={`flex min-w-0 items-center gap-3 ${collapsed ? 'lg:justify-center' : ''}`}
                                >
                                    <item.icon className="h-5 w-5 shrink-0 sm:text-xl" />
                                    <span
                                        className={`truncate ${collapsed ? 'lg:sr-only' : ''}`}
                                    >
                                        {item.label}
                                    </span>
                                </span>
                                {hasChildren ? (
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        className={`px-1 text-xs opacity-80 ${collapsed ? 'lg:hidden' : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggleParent(item.path);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleToggleParent(item.path);
                                            }
                                        }}
                                    >
                                        {expanded ? '▼' : '▶'}
                                    </span>
                                ) : null}
                            </button>
                            {hasChildren && expanded ? (
                                <div className={`mt-1 space-y-1 ${collapsed ? 'lg:hidden' : ''}`}>
                                    {item.children.map((child) => (
                                        <button
                                            key={child.path}
                                            type="button"
                                            title={child.label}
                                            onClick={() => handleNav(child.path)}
                                            className={`flex w-full items-center gap-2 rounded-lg py-2 pr-3 text-left text-sm transition pl-12 ${
                                                isChildActive(child.path)
                                                    ? 'bg-orange-100 font-semibold text-orange-700'
                                                    : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                                            }`}
                                        >
                                            <span
                                                className={`inline-block h-1.5 w-1.5 rounded-full ${isChildActive(child.path) ? 'bg-orange-600' : 'bg-gray-400'}`}
                                                aria-hidden="true"
                                            />
                                            <span>{child.label}</span>
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </nav>

            {/* Logout */}
            <div className={`shrink-0 border-t border-gray-200 p-3 sm:p-4 ${collapsed ? 'lg:p-2' : ''}`}>
                <button
                    type="button"
                    title="Logout"
                    onClick={onLogout}
                    className={`flex w-full items-center gap-3 rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-3 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:from-red-600 hover:to-red-700 glow-red hover:-translate-y-0.5 sm:px-4 sm:py-3 sm:text-base ${
                        collapsed ? 'lg:justify-center lg:px-2' : ''
                    }`}
                >
                    <FaSignOutAlt className="h-5 w-5 shrink-0 sm:text-xl" />
                    <span className={collapsed ? 'lg:sr-only' : ''}>Logout</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
