import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
    FaTachometerAlt,
    FaChartBar, 
    FaUserPlus, 
    FaUserTie,
    FaPlusCircle, 
    FaHistory, 
    FaTrophy, 
    FaChartLine, 
    FaCreditCard, 
    FaWallet, 
    FaLifeRing,
    FaSignOutAlt
} from 'react-icons/fa';

const Sidebar = ({ onLogout }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const menuItems = [
        { path: '/dashboard', label: 'Dashboard', icon: FaTachometerAlt },
        { path: '/markets', label: 'Markets', icon: FaChartBar },
        { path: '/add-user', label: 'Add User', icon: FaUserPlus },
        { path: '/create-bookie', label: 'Create Bookie', icon: FaUserTie },
        { path: '/add-market', label: 'Add New Market', icon: FaPlusCircle },
        { path: '/bet-history', label: 'Bet History', icon: FaHistory },
        { path: '/top-winners', label: 'Top Winners', icon: FaTrophy },
        { path: '/reports', label: 'Report', icon: FaChartLine },
        { path: '/payment-management', label: 'Payments', icon: FaCreditCard },
        { path: '/wallet', label: 'Wallet', icon: FaWallet },
        { path: '/help-desk', label: 'Help Desk', icon: FaLifeRing },
    ];

    const isActive = (path) => {
        return location.pathname === path;
    };

    return (
        <div className="fixed left-0 top-0 h-screen w-64 bg-gray-800 border-r border-gray-700 flex flex-col z-50 overflow-y-auto">
            {/* Logo/Header */}
            <div className="p-6 border-b border-gray-700 shrink-0">
                <h2 className="text-xl font-bold text-yellow-500">Super Admin</h2>
            </div>

            {/* Menu Items */}
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                {menuItems.map((item) => (
                    <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                            isActive(item.path)
                                ? 'bg-yellow-500 text-black font-semibold'
                                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                        }`}
                    >
                        <item.icon className="text-xl" />
                        <span>{item.label}</span>
                    </button>
                ))}
            </nav>

            {/* Logout Button */}
            <div className="p-4 border-t border-gray-700 shrink-0">
                <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
                >
                    <FaSignOutAlt className="text-xl" />
                    <span>Logout</span>
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
