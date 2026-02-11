import React from 'react';

const Header = ({ title, user }) => {
    return (
        <header className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold text-gray-800">{title || 'Dashboard'}</h1>
                <div className="flex items-center gap-4">
                    <span className="text-gray-500 text-sm">
                        {user?.username && (
                            <span className="text-orange-500 font-medium">{user.username}</span>
                        )}
                    </span>
                </div>
            </div>
        </header>
    );
};

export default Header;
