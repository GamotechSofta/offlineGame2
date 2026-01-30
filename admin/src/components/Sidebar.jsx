import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const Sidebar = ({ onLogout }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const menuItems = [
        { path: '/dashboard', label: 'Markets', icon: '📊' },
        { path: '/add-user', label: 'Add User', icon: '👤' },
        { path: '/add-market', label: 'Add New Market', icon: '➕' },
        { path: '/bet-history', label: 'Bet History', icon: '📜' },
        { path: '/top-winners', label: 'Top Winners', icon: '🏆' },
        { path: '/reports', label: 'Report', icon: '📈' },
        { path: '/payment-management', label: 'Payment Management', icon: '💳' },
        { path: '/wallet', label: 'Wallet', icon: '💰' },
        { path: '/help-desk', label: 'Help Desk', icon: '🆘' },
    ];

    const isActive = (path) => {
        return location.pathname === path;
    };

    return (
        <div className="w-64 bg-gray-800 min-h-screen border-r border-gray-700 flex flex-col">
            {/* Logo/Header */}
            <div className="p-6 border-b border-gray-700">
                <h2 className="text-xl font-bold text-yellow-500">Super Admin</h2>
            </div>

            {/* Menu Items */}
            <nav className="flex-1 p-4 space-y-2">
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
                        <span className="text-xl">{item.icon}</span>
                        <span>{item.label}</span>
                    </button>
                ))}
            </nav>

            {/* Logout Button */}
            <div className="p-4 border-t border-gray-700">
                <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
                >
                    <span>🚪</span>
                    <span>Logout</span>
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
