import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import { FaBars, FaSignOutAlt } from 'react-icons/fa';

const SIDEBAR_COLLAPSED_KEY = 'admin-sidebar-collapsed';

const AdminLayout = ({ children, onLogout, title }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        try {
            return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
        } catch {
            return false;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0');
        } catch {
            /* ignore */
        }
    }, [sidebarCollapsed]);

    return (
        <div className="min-h-screen min-h-[100dvh] bg-gray-50 text-gray-800 flex flex-col">
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
                <h1 className="text-lg font-bold text-orange-600 truncate mx-2">{title || 'Admin'}</h1>
                <button
                    type="button"
                    onClick={onLogout}
                    className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                    aria-label="Logout"
                >
                    <FaSignOutAlt className="w-5 h-5 text-red-500" />
                </button>
            </header>

            {/* Sidebar */}
            <Sidebar
                onLogout={onLogout}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                collapsed={sidebarCollapsed}
                onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
                onExpandSidebar={() => setSidebarCollapsed(false)}
            />

            {/* Backdrop for mobile */}
            {sidebarOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/30 z-30"
                    onClick={() => setSidebarOpen(false)}
                    aria-hidden
                />
            )}

            {/* Main content — margin tracks --admin-sidebar-w (see index.css) */}
            <main
                className={`flex-1 min-h-0 min-w-0 pt-14 lg:pt-0 overflow-x-hidden lg:min-h-screen transition-[margin] duration-200 ease-in-out ${
                    sidebarCollapsed ? 'lg:ml-[var(--admin-sidebar-collapsed-w)]' : 'lg:ml-[var(--admin-sidebar-w)]'
                }`}
            >
                <div className="w-full min-w-0 max-w-full box-border px-4 py-4 sm:px-4 sm:py-5 md:px-5 md:py-5 lg:px-6 lg:py-6 xl:px-8 xl:py-7 2xl:px-10 2xl:py-8">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;
