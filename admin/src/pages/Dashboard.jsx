import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MarketList from '../components/MarketList';
import MarketForm from '../components/MarketForm';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const Dashboard = () => {
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
        // Store password temporarily in sessionStorage after login for API calls
        // In production, use JWT tokens instead
        const password = sessionStorage.getItem('adminPassword') || '';
        return {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${btoa(`${admin.username}:${password}`)}`,
        };
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            {/* Header */}
            <header className="bg-gray-800 border-b border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex justify-between items-center">
                        <h1 className="text-2xl font-bold text-yellow-500">Super Admin Panel</h1>
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {error && (
                    <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
                        {error}
                    </div>
                )}

                <div className="mb-6 flex justify-between items-center">
                    <h2 className="text-xl font-semibold">Markets Management</h2>
                    <button
                        onClick={handleCreate}
                        className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-lg transition-colors"
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
            </main>
        </div>
    );
};

export default Dashboard;
