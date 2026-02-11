import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import MarketList from '../components/MarketList';
import MarketForm from '../components/MarketForm';
import { useRefreshOnMarketReset } from '../hooks/useRefreshOnMarketReset';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const Dashboard = () => {
    const [markets, setMarkets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingMarket, setEditingMarket] = useState(null);
    const [error, setError] = useState('');
    const navigate = useNavigate();

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

    useEffect(() => {
        const admin = localStorage.getItem('admin');
        if (!admin) {
            navigate('/');
            return;
        }
        fetchMarkets();
    }, [navigate]);

    useRefreshOnMarketReset(fetchMarkets);

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
        // Store password temporarily in sessionStorage after login for API calls
        // In production, use JWT tokens instead
        const password = sessionStorage.getItem('adminPassword') || '';
        return {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${btoa(`${admin.username}:${password}`)}`,
        };
    };

    return (
        <AdminLayout onLogout={handleLogout} title="Markets">
                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
                        {error}
                    </div>
                )}

                <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Markets Management</h1>
                
                <div className="mb-6">
                    <button
                        onClick={handleCreate}
                        className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-gray-800 font-semibold rounded-lg transition-colors"
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
                    <div className="text-center py-12">
                        <p className="text-gray-400">Loading markets...</p>
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
        </AdminLayout>
    );
};

export default Dashboard;
