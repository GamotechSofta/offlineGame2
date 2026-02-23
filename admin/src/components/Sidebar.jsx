import React, { useRef, useEffect } from 'react';
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
} from 'react-icons/fa';

const Sidebar = ({ onLogout, isOpen = true, onClose }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const navRef = useRef(null);
    const savedScrollTop = useRef(0);

    const menuItems = [
        { path: '/dashboard', label: 'Dashboard', icon: FaTachometerAlt },
        { path: '/all-users', label: 'All Players', icon: FaUserFriends },
        { path: '/bookie-management', label: 'Bookie Accounts', icon: FaUsers },
        { path: '/markets', label: 'Markets', icon: FaChartBar },
        { path: '/add-result', label: 'Add Result', icon: FaEdit },
        { path: '/update-rate', label: 'Update Rate', icon: FaCoins },
        { path: '/reports', label: 'Report', icon: FaChartLine },
        { path: '/revenue', label: 'Revenue', icon: FaMoneyBillWave },
        { path: '/payment-management', label: 'Payments', icon: FaCreditCard },
        { path: '/wallet', label: 'Wallet', icon: FaWallet },
        { path: '/logs', label: 'Logs', icon: FaClipboardList },
        { path: '/settings', label: 'Settings', icon: FaCog },
    ];

    const isActive = (path) => {
        if (path === '/all-users' || path === '/markets') {
            return location.pathname === path || location.pathname.startsWith(path + '/');
        }
        if (path === '/revenue') {
            return location.pathname === '/revenue' || location.pathname.startsWith('/revenue/');
        }
        if (path === '/reports') {
            return location.pathname === '/reports';
        }
        return location.pathname === path;
    };

    const handleNav = (path) => {
        savedScrollTop.current = navRef.current?.scrollTop ?? 0;
        navigate(path);
        onClose?.();
    };

    useEffect(() => {
        if (navRef.current != null && savedScrollTop.current > 0) {
            navRef.current.scrollTop = savedScrollTop.current;
            savedScrollTop.current = 0;
        }
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
                {menuItems.map((item) => (
                    <button
                        key={item.path}
                        onClick={() => handleNav(item.path)}
                        className={`w-full flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all duration-200 text-sm sm:text-base ${isActive(item.path)
                            ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold shadow-lg shadow-orange-500/20'
                            : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600 hover:-translate-y-0.5'
                            }`}
                    >
                        <item.icon className="w-5 h-5 sm:text-xl shrink-0" />
                        <span className="truncate">{item.label}</span>
                    </button>
                ))}
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
