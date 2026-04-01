import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import MarketList from '../components/MarketList';
import MarketForm from '../components/MarketForm';
import { useRefreshOnMarketReset } from '../hooks/useRefreshOnMarketReset';
import { FaChartBar } from 'react-icons/fa';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';
import { getAuthHeaders, clearAdminSession, fetchWithAuth } from '../lib/auth';

const TABS = [
    { id: 'regular', label: 'Regular Market', icon: FaChartBar },
];

const Markets = () => {
    const location = useLocation();
    const [markets, setMarkets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingMarket, setEditingMarket] = useState(null);
    const [formDefaultType, setFormDefaultType] = useState('main');
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('regular');
    const navigate = useNavigate();

    const mainMarkets = markets || [];


    const fetchMarkets = async () => {
        try {
            setLoading(true);
            const response = await fetchWithAuth(`${API_BASE_URL}/markets/get-markets?marketType=main`);
            if (response.status === 401) return;
            const data = await response.json();
            if (data.success) {
                setMarkets(data.data || []);
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
        clearAdminSession();
        navigate('/');
    };

    const handleCreate = () => {
        setEditingMarket(null);
        setFormDefaultType('main');
        setShowForm(true);
    };

    const handleEdit = (market) => {
        setEditingMarket(market);
        setFormDefaultType('main');
        setShowForm(true);
    };

    const handleFormClose = () => {
        setShowForm(false);
        setEditingMarket(null);
        fetchMarkets();
    };

    return (
        <AdminLayout onLogout={handleLogout} title="Markets">
            <div className="min-w-0 px-1 sm:px-0">
                {error && (
                    <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm sm:text-base">
                        {error}
                    </div>
                )}

                <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold mb-3 sm:mb-6 truncate">Markets Management</h1>

                {showForm && (
                    <MarketForm
                        market={editingMarket}
                        defaultMarketType={formDefaultType}
                        onClose={handleFormClose}
                        onSuccess={handleFormClose}
                        apiBaseUrl={API_BASE_URL}
                        getAuthHeaders={getAuthHeaders}
                    />
                )}

                {activeTab === 'regular' && (
                    loading ? (
                        <div className="text-center py-8 sm:py-12">
                            <p className="text-gray-400 text-sm sm:text-base">Loading markets...</p>
                        </div>
                    ) : (
                        <section>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 mb-4">
                                <h2 className="text-base sm:text-xl font-bold text-gray-800 flex items-center gap-2" />
                                <button
                                    onClick={handleCreate}
                                    className="w-full sm:w-auto px-4 py-2.5 sm:py-2.5 bg-orange-500 hover:bg-orange-600 text-gray-800 font-semibold rounded-xl transition-colors text-sm sm:text-base touch-manipulation"
                                >
                                    + Add Market
                                </button>
                            </div>
                            <MarketList
                                markets={mainMarkets}
                                onEdit={handleEdit}
                                onDelete={fetchMarkets}
                                apiBaseUrl={API_BASE_URL}
                                getAuthHeaders={getAuthHeaders}
                            />
                        </section>
                    )
                )}
            </div>
        </AdminLayout>
    );
};

export default Markets;
