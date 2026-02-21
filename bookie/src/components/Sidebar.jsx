import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    FaTachometerAlt,
    FaUserPlus,
    FaHistory,
    FaChartLine,
    FaWallet,
    FaSignOutAlt,
    FaUsers,
    FaTimes,
    FaMoneyBillWave,
    FaKeyboard,
    FaFileInvoiceDollar,
    FaGlobe,
    FaChevronDown,
    FaUserCheck,
    FaCreditCard,
    FaCog,
} from 'react-icons/fa';
import { useLanguage } from '../context/LanguageContext';

const Sidebar = ({ user, onLogout, isOpen = true, onClose }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t, language, changeLanguage } = useLanguage();
    const [languageMenuOpen, setLanguageMenuOpen] = useState(false);

    const menuItems = [
        { path: '/dashboard', label: t('dashboard'), icon: FaTachometerAlt, key: 'dashboard' },
        { path: '/my-users', label: t('myPlayers'), icon: FaUsers, key: 'myPlayers' },
        { path: '/add-user', label: t('addPlayer'), icon: FaUserPlus, key: 'addPlayer' },
        { path: '/bet-history', label: t('betHistory'), icon: FaHistory, key: 'betHistory' },
        { path: '/bets-by-user', label: t('betsByUser'), icon: FaUserCheck, key: 'betsByUser' },
        { path: '/reports', label: t('report'), icon: FaChartLine, key: 'report' },
        { path: '/revenue', label: t('revenue'), icon: FaMoneyBillWave, key: 'revenue' },
        { path: '/payments', label: t('payments'), icon: FaCreditCard, key: 'payments' },
        { path: '/wallet', label: t('wallet'), icon: FaWallet, key: 'wallet' },
        { path: '/receipt', label: t('receipt'), icon: FaFileInvoiceDollar, key: 'receipt' },
        { path: '/shortcuts', label: t('shortcuts'), icon: FaKeyboard, key: 'shortcuts' },
        { path: '/settings', label: t('settings'), icon: FaCog, key: 'settings' },
    ];

    const isActive = (path) => {
        if (path === '/my-users' || path === '/receipt') {
            return location.pathname === path || location.pathname.startsWith(path + '/');
        }
        if (path === '/settings') return location.pathname === '/settings';
        return location.pathname === path;
    };

    const handleNav = (path) => {
        navigate(path);
        onClose?.();
    };

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
                <div>
                    <h2 className="text-lg sm:text-xl font-bold text-orange-500">{t('bookiePanel')}</h2>
                    {user?.username && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{user.username}</p>
                    )}
                </div>
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
            <nav className="flex-1 p-3 sm:p-4 space-y-1 overflow-y-auto">
                {menuItems.map((item) => (
                    <button
                        key={item.path}
                        onClick={() => handleNav(item.path)}
                        className={`w-full flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all duration-200 text-sm sm:text-base ${
                            isActive(item.path)
                                ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold shadow-lg shadow-orange-500/20'
                                : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600 hover:-translate-y-0.5'
                        }`}
                    >
                        <item.icon className="w-5 h-5 sm:text-xl shrink-0" />
                        <span className="truncate">{item.label}</span>
                    </button>
                ))}
            </nav>

            {/* Language Selector & Logout */}
            <div className="p-3 sm:p-4 border-t border-gray-200 shrink-0">
                <div className="flex items-center gap-2">
                    {/* Language Selector */}
                    <div className="relative flex-1">
                        <button
                            type="button"
                            onClick={() => setLanguageMenuOpen(!languageMenuOpen)}
                            className="w-full flex items-center justify-center gap-2 px-2 sm:px-3 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold transition-all duration-200 text-xs sm:text-sm hover:-translate-y-0.5"
                        >
                            <FaGlobe className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                            <span className="hidden sm:inline">{t('changeLanguage')}</span>
                            <FaChevronDown className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform ${languageMenuOpen ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {/* Language Dropdown */}
                        {languageMenuOpen && (
                            <>
                                <div 
                                    className="fixed inset-0 z-40" 
                                    onClick={() => setLanguageMenuOpen(false)}
                                />
                                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            changeLanguage('en');
                                            setLanguageMenuOpen(false);
                                        }}
                                        className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                                            language === 'en' ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-700'
                                        }`}
                                    >
                                        <span className="text-sm">English</span>
                                        {language === 'en' && <span className="ml-auto text-blue-600">✓</span>}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            changeLanguage('hi');
                                            setLanguageMenuOpen(false);
                                        }}
                                        className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors border-t border-gray-200 ${
                                            language === 'hi' ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-700'
                                        }`}
                                    >
                                        <span className="text-sm">हिंदी</span>
                                        {language === 'hi' && <span className="ml-auto text-blue-600">✓</span>}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            changeLanguage('mr');
                                            setLanguageMenuOpen(false);
                                        }}
                                        className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors border-t border-gray-200 ${
                                            language === 'mr' ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-700'
                                        }`}
                                    >
                                        <span className="text-sm">मराठी</span>
                                        {language === 'mr' && <span className="ml-auto text-blue-600">✓</span>}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                    
                    {/* Logout */}
                    <button
                        onClick={onLogout}
                        className="flex-1 flex items-center justify-center gap-2 px-2 sm:px-3 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold transition-all duration-200 text-xs sm:text-sm glow-red hover:-translate-y-0.5"
                    >
                        <FaSignOutAlt className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                        <span className="hidden sm:inline">{t('logout')}</span>
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
