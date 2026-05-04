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
} from 'react-icons/fa';

const Sidebar = ({ onLogout, isOpen = true, onClose }) => {
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
                { path: '/2d-management/current-slot-players', label: 'Current Slot Players' },
                { path: '/2d-management/result-control', label: 'Result Control' },
                { path: '/2d-management/tickets', label: 'All User Tickets' },
                { path: '/2d-management/old-slots', label: 'Old Slots Stats' },
            ],
        },
        {
            path: '/3d-management',
            label: '3D Management',
            icon: FaDice,
            children: [
                { path: '/3d-management/current-slot-players', label: 'Current Slot Players' },
                { path: '/3d-management/result-control', label: 'Result Control' },
                { path: '/3d-management/tickets', label: 'All User Tickets' },
                { path: '/3d-management/old-slots', label: 'Old Slots Stats' },
            ],
        },
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
        menuItems.splice(9, 0, { path: '/bookie-commissions', label: 'Bookie Commissions', icon: FaMoneyBillWave });
        menuItems.splice(10, 0, { path: '/help-desk', label: 'Help Desk Issues', icon: FaLifeRing });
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
            className={`fixed left-0 top-0 h-screen w-64 sm:w-72 bg-white border-r border-gray-200 flex flex-col z-50 overflow-y-auto shadow-lg
                transform transition-transform duration-200 ease-in-out
                lg:translate-x-0
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
            `}
        >
            {/* Logo + Close (mobile) */}
            <div className="p-4 sm:p-6 border-b border-gray-200 shrink-0 flex items-center justify-between">
                <h2 className="text-lg sm:text-xl font-bold text-orange-500">Super Admin</h2>
                <button
                    type="button"
                    onClick={onClose}
                    className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-400"
                    aria-label="Close menu"
                >
                    <FaTimes className="w-5 h-5" />
                </button>
            </div>

            {/* Menu Items */}
            <nav ref={navRef} className="flex-1 p-3 sm:p-4 space-y-1 overflow-y-auto">
                {menuItems.map((item) => {
                    const hasChildren = Array.isArray(item.children) && item.children.length > 0;
                    const expanded = Boolean(expandedMenus[item.path]);
                    return (
                        <div key={item.path}>
                            <button
                                onClick={() => handleNav(item.path, hasChildren)}
                                className={`w-full flex items-center justify-between gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all duration-200 text-sm sm:text-base ${isActive(item.path)
                                    ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold shadow-lg shadow-orange-500/20'
                                    : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600 hover:-translate-y-0.5'
                                    }`}
                            >
                                <span className="flex items-center gap-3 min-w-0">
                                    <item.icon className="w-5 h-5 sm:text-xl shrink-0" />
                                    <span className="truncate">{item.label}</span>
                                </span>
                                {hasChildren ? (
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        className="text-xs opacity-80 px-1"
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
                                <div className="mt-1 space-y-1">
                                    {item.children.map((child) => (
                                        <button
                                            key={child.path}
                                            onClick={() => handleNav(child.path)}
                                            className={`w-full flex items-center gap-2 text-left pl-12 pr-3 py-2 rounded-lg text-sm transition ${isChildActive(child.path)
                                                ? 'bg-orange-100 text-orange-700 font-semibold'
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
            <div className="p-3 sm:p-4 border-t border-gray-200 shrink-0">
                <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold transition-all duration-200 text-sm sm:text-base glow-red hover:-translate-y-0.5"
                >
                    <FaSignOutAlt className="w-5 h-5 sm:text-xl shrink-0" />
                    <span>Logout</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
