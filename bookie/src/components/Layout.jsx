import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import Header from './Header';

const Layout = ({ children, title }) => {
    const navigate = useNavigate();
    const { bookie, logout } = useAuth();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white flex">
            <Sidebar onLogout={handleLogout} />
            <div className="flex-1 flex flex-col">
                <Header title={title} user={bookie} />
                <main className="flex-1 p-6 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default Layout;
