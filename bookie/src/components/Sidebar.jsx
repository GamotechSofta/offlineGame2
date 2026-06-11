import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    FaTachometerAlt,
    FaUserPlus,
    FaSignOutAlt,
    FaUsers,
    FaTimes,
    FaGlobe,
    FaChevronDown,
    FaCog,
    FaMoneyBillWave,
    FaChartBar,
    FaCreditCard,
} from 'react-icons/fa';
import { useLanguage } from '../context/useLanguage';

const Sidebar = ({ user, onLogout, isOpen = true, onClose }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t, language, changeLanguage } = useLanguage();
    const [languageMenuOpen, setLanguageMenuOpen] = useState(false);

    const menuItems = [
        { path: '/dashboard', label: t('dashboard'), icon: FaTachometerAlt },
        { path: '/my-users', label: t('myPlayers'), icon: FaUsers },
        { path: '/markets', label: t('markets'), icon: FaChartBar },
        { path: '/add-user', label: t('addPlayer'), icon: FaUserPlus },
        { path: '/commission', label: 'Commission', icon: FaMoneyBillWave },
        { path: '/payments', label: t('payments'), icon: FaCreditCard },
        { path: '/settings', label: t('settings'), icon: FaCog },
    ];

    const isActive = (path) => {
        if (path === '/my-users' || path === '/games' || path === '/markets') {
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
            className={`fixed left-0 top-0 h-screen w-64 sm:w-72 bg-white border-r border-violet-100 flex flex-col z-50 overflow-y-auto shadow-lg shadow-violet-900/5
                transform transition-transform duration-200 ease-in-out lg:translate-x-0
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
            <div className="p-4 sm:p-6 border-b border-violet-100 shrink-0 flex items-center justify-between bg-gradient-to-br from-violet-50 to-white">
                <div>
                    <h2 className="text-lg sm:text-xl font-bold text-sb-primary">{t('bookiePanel')}</h2>
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

            <nav className="flex-1 p-3 sm:p-4 space-y-1 overflow-y-auto">
                {menuItems.map((item) => (
                    <button
                        key={item.path}
                        type="button"
                        onClick={() => handleNav(item.path)}
                        className={`w-full flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all text-sm sm:text-base ${
                            isActive(item.path)
                                ? 'bg-sb-primary text-white font-semibold shadow-lg shadow-sb-primary/20'
                                : 'text-gray-600 hover:bg-sb-primary/5 hover:text-sb-primary'
                        }`}
                    >
                        <item.icon className="w-5 h-5 shrink-0" />
                        <span className="truncate">{item.label}</span>
                    </button>
                ))}
            </nav>

            <div className="p-3 sm:p-4 border-t border-gray-200 shrink-0">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <button
                            type="button"
                            onClick={() => setLanguageMenuOpen(!languageMenuOpen)}
                            className="w-full flex items-center justify-center gap-2 px-2 py-2.5 rounded-xl bg-sb-primary hover:bg-sb-primary-dark text-white font-semibold text-xs sm:text-sm transition-colors"
                        >
                            <FaGlobe className="w-4 h-4" />
                            <FaChevronDown className={`w-3 h-3 ${languageMenuOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {languageMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setLanguageMenuOpen(false)} />
                                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-lg border z-50">
                                    {['en', 'hi', 'mr'].map((lang, i) => (
                                        <button
                                            key={lang}
                                            type="button"
                                            onClick={() => {
                                                changeLanguage(lang);
                                                setLanguageMenuOpen(false);
                                            }}
                                            className={`w-full px-4 py-3 text-left text-sm ${i > 0 ? 'border-t' : ''} ${
                                                language === lang ? 'bg-violet-50 text-sb-primary font-semibold' : ''
                                            }`}
                                        >
                                            {lang === 'en' ? 'English' : lang === 'hi' ? 'हिंदी' : 'मराठी'}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onLogout}
                        className="flex-1 flex items-center justify-center gap-2 px-2 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-xs sm:text-sm"
                    >
                        <FaSignOutAlt className="w-4 h-4" />
                        <span className="hidden sm:inline">{t('logout')}</span>
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
