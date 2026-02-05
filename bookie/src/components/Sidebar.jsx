import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    FaTachometerAlt,
    FaChartBar,
    FaUserPlus,
    FaHistory,
    FaTrophy,
    FaChartLine,
    FaCreditCard,
    FaWallet,
    FaLifeRing,
    FaLink,
    FaSignOutAlt,
    FaUsers,
    FaTimes,
    FaPercent,
} from 'react-icons/fa';

const Sidebar = ({ user, onLogout, isOpen = true, onClose }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const menuItems = [
        { path: '/dashboard', label: 'Dashboard', icon: FaTachometerAlt },
        { path: '/my-users', label: 'My Players', icon: FaUsers },
        { path: '/markets', label: 'Markets', icon: FaChartBar },
        { path: '/add-user', label: 'Add Player', icon: FaUserPlus },
        { path: '/referral-link', label: 'My Referral Link', icon: FaLink },
        { path: '/bet-history', label: 'Bet History', icon: FaHistory },
        { path: '/top-winners', label: 'Top Winners', icon: FaTrophy },
        { path: '/reports', label: 'Report', icon: FaChartLine },
        { path: '/payments', label: 'Payments', icon: FaCreditCard },
        { path: '/wallet', label: 'Wallet', icon: FaWallet },
        { path: '/commission', label: 'Commission', icon: FaPercent },
        { path: '/help-desk', label: 'Help Desk', icon: FaLifeRing },
    ];

    const isActive = (path) => {
        if (path === '/my-users' || path === '/markets') {
            return location.pathname === path || location.pathname.startsWith(path + '/');
        }
        return location.pathname === path;
    };

    const handleNav = (path) => {
        navigate(path);
        onClose?.();
    };

    return (
        <aside
            className={`fixed left-0 top-0 h-screen w-64 sm:w-72 bg-gray-800/95 backdrop-blur-sm border-r border-gray-700/50 flex flex-col z-50 overflow-y-auto shadow-2xl
                transform transition-transform duration-200 ease-in-out
                lg:translate-x-0
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
            `}
        >
            {/* Logo + Close (mobile) */}
            <div className="p-4 sm:p-6 border-b border-gray-700 shrink-0 flex items-center justify-between">
                <div>
                    <h2 className="text-lg sm:text-xl font-bold text-yellow-500">Bookie Panel</h2>
                    {user?.username && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{user.username}</p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="lg:hidden p-2 rounded-lg hover:bg-gray-700 text-gray-400"
                    aria-label="Close menu"
                >
                    <FaTimes className="w-5 h-5" />
                </button>
            </div>

            {/* Menu Items */}
            <nav className="flex-1 p-3 sm:p-4 space-y-1 overflow-y-auto">
                {menuItems.map((item) => (
                    <button
                        key={item.path}
                        onClick={() => handleNav(item.path)}
                        className={`w-full flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all duration-200 text-sm sm:text-base ${
                            isActive(item.path)
                                ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-semibold shadow-lg shadow-yellow-500/20'
                                : 'text-gray-300 hover:bg-gray-700/50 hover:text-white hover:-translate-y-0.5'
                        }`}
                    >
                        <item.icon className="w-5 h-5 sm:text-xl shrink-0" />
                        <span className="truncate">{item.label}</span>
                    </button>
                ))}
            </nav>

            {/* Logout */}
            <div className="p-3 sm:p-4 border-t border-gray-700/50 shrink-0">
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
