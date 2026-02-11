import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import MarketList from '../components/MarketList';
import MarketForm from '../components/MarketForm';
import StarlineManagement from './StarlineManagement';
import { useRefreshOnMarketReset } from '../hooks/useRefreshOnMarketReset';
import { FaChartBar, FaStar, FaCrown } from 'react-icons/fa';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const TABS = [
    { id: 'regular', label: 'Regular Market', icon: FaChartBar },
    { id: 'starline', label: 'Starline Market', icon: FaStar },
    { id: 'king', label: 'King Bazaar Market', icon: FaCrown },
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

    useEffect(() => {
        const type = (location.state?.marketType || '').toString().toLowerCase();
        if (type === 'starline') setActiveTab('starline');
    }, [location.state?.marketType]);

    const fetchMarkets = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/markets/get-markets?marketType=main`);
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
        localStorage.removeItem('admin');
        sessionStorage.removeItem('adminPassword');
        navigate('/');
    };

    const handleCreate = () => {
        setEditingMarket(null);
        setFormDefaultType('main');
        setShowForm(true);
    };

    const handleEdit = (market) => {
        setEditingMarket(market);
        setFormDefaultType(market.marketType === 'startline' ? 'startline' : 'main');
        setShowForm(true);
    };

    const handleFormClose = () => {
        setShowForm(false);
        setEditingMarket(null);
        fetchMarkets();
    };

    const getAuthHeaders = () => {
        const admin = JSON.parse(localStorage.getItem('admin') || '{}');
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
                    <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm sm:text-base">
                        {error}
                    </div>
                )}

                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-3 sm:mb-6 truncate">Markets Management</h1>

                {/* Top tabs: Regular | Starline | King Bazaar */}
                <div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
                    {TABS.map((tab) => {
                        const isActive = activeTab === tab.id;
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`inline-flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl font-semibold text-sm sm:text-base transition-all ${
                                    isActive
                                        ? 'bg-orange-500 text-gray-800 shadow-lg shadow-orange-500/20'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800 border border-gray-200'
                                }`}
                            >
                                <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

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

                {activeTab === 'starline' && (
                    <StarlineManagement embedded />
                )}

                {activeTab === 'king' && (
                    <section className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-orange-500/20 flex items-center justify-center mx-auto mb-4">
                            <FaCrown className="w-8 h-8 text-orange-500" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-800 mb-2">King Bazaar Market</h2>
                        <p className="text-gray-500 text-sm max-w-md mx-auto">King Bazaar market management. Configure and manage King Bazaar markets here.</p>
                    </section>
                )}

                {activeTab === 'regular' && (
                    loading ? (
                        <div className="text-center py-8 sm:py-12">
                            <p className="text-gray-400 text-sm sm:text-base">Loading markets...</p>
                        </div>
                    ) : (
                        <section>
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                <h2 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
                                    <span className="inline-block w-1 h-6 sm:h-7 bg-gray-500 rounded-full" />
                                    Main / Daily Markets
                                </h2>
                                <button
                                    onClick={handleCreate}
                                    className="w-full sm:w-auto px-4 py-3 sm:py-2.5 bg-orange-500 hover:bg-orange-600 text-gray-800 font-semibold rounded-xl transition-colors text-sm sm:text-base touch-manipulation"
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
