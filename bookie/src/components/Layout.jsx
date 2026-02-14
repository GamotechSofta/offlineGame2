import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import { FaBars } from 'react-icons/fa';

const Layout = ({ children, title }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { bookie, logout } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    // Global keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Don't trigger shortcuts when typing in inputs, textareas, or contenteditable elements
            const target = e.target;
            if (
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable ||
                (target.tagName === 'SELECT')
            ) {
                return;
            }

            // Alt + key shortcuts for navigation
            if (e.altKey && !e.ctrlKey && !e.shiftKey) {
                e.preventDefault();
                switch (e.key.toLowerCase()) {
                    case 'd':
                        navigate('/dashboard');
                        break;
                    case 'p':
                        navigate('/my-users');
                        break;
                    case 'a':
                        navigate('/add-user');
                        break;
                    case 'b':
                        navigate('/bet-history');
                        break;
                    case 'm':
                        navigate('/markets');
                        break;
                    case 'g':
                        navigate('/games');
                        break;
                    case 'r':
                        navigate('/reports');
                        break;
                    case 'w':
                        navigate('/wallet');
                        break;
                    case 'h':
                        navigate('/help-desk');
                        break;
                    case '?':
                    case '/':
                        navigate('/shortcuts');
                        break;
                    default:
                        return; // Don't prevent default for other keys
                }
            }

            // Esc key to close sidebar or modals
            if (e.key === 'Escape' && sidebarOpen) {
                setSidebarOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [navigate, sidebarOpen]);

    return (
        <div className="min-h-screen bg-gray-50 text-gray-800">
            {/* Mobile header */}
            <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white/95 backdrop-blur-sm border-b border-gray-200 flex items-center justify-between px-4 z-40 shadow-sm">
                <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    aria-label="Open menu"
                >
                    <FaBars className="w-6 h-6 text-orange-500" />
                </button>
                <h1 className="text-lg font-bold text-orange-600 truncate mx-2">
                    {title || 'Bookie Panel'}
                </h1>
                <div className="w-10" />
            </header>

            {/* Sidebar */}
            <Sidebar
                user={bookie}
                onLogout={handleLogout}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            {/* Backdrop for mobile */}
            {sidebarOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/30 z-30"
                    onClick={() => setSidebarOpen(false)}
                    aria-hidden
                />
            )}

            {/* Main content */}
            <main className="pt-14 lg:pt-0 lg:ml-72 min-h-screen overflow-x-hidden">
                <div className="p-3 sm:p-4 md:p-6 lg:p-8 lg:pl-10 min-w-0 max-w-full box-border">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default Layout;
