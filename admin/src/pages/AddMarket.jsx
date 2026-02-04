import React, { useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import MarketForm from '../components/MarketForm';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const AddMarket = () => {
    const navigate = useNavigate();
    const [showForm, setShowForm] = useState(true);

    const handleLogout = () => {
        localStorage.removeItem('admin');
        sessionStorage.removeItem('adminPassword');
        navigate('/');
    };

    const getAuthHeaders = () => {
        const admin = JSON.parse(localStorage.getItem('admin'));
        const password = sessionStorage.getItem('adminPassword') || '';
        return {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${btoa(`${admin.username}:${password}`)}`,
        };
    };

    const handleFormClose = () => {
        navigate('/dashboard');
    };

    return (
        <AdminLayout onLogout={handleLogout} title="Add Market">
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-3 sm:mb-6">Add New Market</h1>
                    {showForm && (
                        <MarketForm
                            market={null}
                            onClose={handleFormClose}
                            onSuccess={handleFormClose}
                            apiBaseUrl={API_BASE_URL}
                            getAuthHeaders={getAuthHeaders}
                        />
                    )}
        </AdminLayout>
    );
};

export default AddMarket;
