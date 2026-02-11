import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { FaBars, FaSignOutAlt } from 'react-icons/fa';

const AdminLayout = ({ children, onLogout, title }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

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

export default AdminLayout;
