import React from 'react';

const Header = ({ title, user }) => {
    return (
        <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold text-white">{title || 'Dashboard'}</h1>
                <div className="flex items-center gap-4">
                    <span className="text-gray-400 text-sm">
                        {user?.username && (
                            <span className="text-emerald-400 font-medium">{user.username}</span>
                        )}
                    </span>
                </div>
            </div>
        </header>
    );
};

export default Header;
