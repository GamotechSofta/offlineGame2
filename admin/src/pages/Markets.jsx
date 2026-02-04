import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import MarketList from '../components/MarketList';
import MarketForm from '../components/MarketForm';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const Markets = () => {
    const [markets, setMarkets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingMarket, setEditingMarket] = useState(null);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const admin = localStorage.getItem('admin');
        if (!admin) {
            navigate('/');
            return;
        }
        fetchMarkets();
    }, [navigate]);

    const fetchMarkets = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/markets/get-markets`);
            const data = await response.json();
            if (data.success) {
                setMarkets(data.data);
            } else {
                setError('Failed to fetch markets');
            }
        } catch (err) {
            setError('Network error. Please check if the server is running.');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('admin');
        sessionStorage.removeItem('adminPassword');
        navigate('/');
    };

    const handleCreate = () => {
        setEditingMarket(null);
        setShowForm(true);
    };

    const handleEdit = (market) => {
        setEditingMarket(market);
        setShowForm(true);
    };

    const handleFormClose = () => {
        setShowForm(false);
        setEditingMarket(null);
        fetchMarkets();
    };

    const getAuthHeaders = () => {
        const admin = JSON.parse(localStorage.getItem('admin'));
        const password = sessionStorage.getItem('adminPassword') || '';
        return {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${btoa(`${admin.username}:${password}`)}`,
        };
    };

    return (
        <AdminLayout onLogout={handleLogout} title="Markets">
                <div className="min-w-0">
                {error && (
                    <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm sm:text-base">
                        {error}
                    </div>
                )}

                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-3 sm:mb-6 truncate">Markets Management</h1>
                
                <div className="mb-3 sm:mb-6">
                    <button
                        onClick={handleCreate}
                        className="w-full sm:w-auto px-4 py-3 sm:py-2.5 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-xl transition-colors text-sm sm:text-base touch-manipulation"
                    >
                        + Add New Market
                    </button>
                </div>

                {showForm && (
                    <MarketForm
                        market={editingMarket}
                        onClose={handleFormClose}
                        onSuccess={handleFormClose}
                        apiBaseUrl={API_BASE_URL}
                        getAuthHeaders={getAuthHeaders}
                    />
                )}

                {loading ? (
                    <div className="text-center py-8 sm:py-12">
                        <p className="text-gray-400 text-sm sm:text-base">Loading markets...</p>
                    </div>
                ) : (
                    <MarketList
                        markets={markets}
                        onEdit={handleEdit}
                        onDelete={fetchMarkets}
                        apiBaseUrl={API_BASE_URL}
                        getAuthHeaders={getAuthHeaders}
                    />
                )}
                </div>
        </AdminLayout>
    );
};

export default Markets;
