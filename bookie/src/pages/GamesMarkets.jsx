import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { API_BASE_URL } from '../utils/api';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useRefreshOnMarketReset } from '../hooks/useRefreshOnMarketReset';
import { FaDice, FaClock, FaChevronRight } from 'react-icons/fa';

const GamesMarkets = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const playerId = searchParams.get('playerId') || '';

    const [markets, setMarkets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchMarkets = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/markets/get-markets`);
            const data = await response.json();
            if (data.success) setMarkets(data.data || []);
            else setError('Failed to fetch markets');
        } catch (err) {
            setError('Network error. Please check if the server is running.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMarkets();
    }, []);

    useRefreshOnMarketReset(fetchMarkets);

    const getMarketStatus = (market) => {
        const hasOpening = market.openingNumber && /^\d{3}$/.test(String(market.openingNumber));
        const hasClosing = market.closingNumber && /^\d{3}$/.test(String(market.closingNumber));
        if (hasOpening && hasClosing) return { status: 'closed', label: 'CLOSED', color: 'bg-red-500', textColor: 'text-red-400', borderColor: 'border-red-500/30' };
        if (hasOpening && !hasClosing) return { status: 'running', label: 'RUNNING', color: 'bg-yellow-500', textColor: 'text-yellow-400', borderColor: 'border-yellow-500/30' };
        return { status: 'open', label: 'OPEN', color: 'bg-green-500', textColor: 'text-green-400', borderColor: 'border-green-500/30' };
    };

    // Only show markets that are open or running (not fully closed)
    const availableMarkets = markets.filter((m) => {
        const hasOpening = m.openingNumber && /^\d{3}$/.test(String(m.openingNumber));
        const hasClosing = m.closingNumber && /^\d{3}$/.test(String(m.closingNumber));
        return !(hasOpening && hasClosing);
    });

    const closedMarkets = markets.filter((m) => {
        const hasOpening = m.openingNumber && /^\d{3}$/.test(String(m.openingNumber));
        const hasClosing = m.closingNumber && /^\d{3}$/.test(String(m.closingNumber));
        return hasOpening && hasClosing;
    });

    const handleMarketClick = (marketId) => {
        const query = playerId ? `?playerId=${playerId}` : '';
        navigate(`/games/${marketId}${query}`);
    };

    return (
        <Layout title="Games">
            <div className="min-w-0 max-w-full">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
                        <FaDice className="text-yellow-500" />
                        Games
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">Select a market to place bets for your players</p>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-xl text-red-200">{error}</div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
                    </div>
                ) : (
                    <>
                        {/* Open / Running Markets */}
                        {availableMarkets.length === 0 ? (
                            <div className="text-center py-12">
                                <FaClock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                                <p className="text-gray-400 text-lg">No open markets available right now</p>
                                <p className="text-gray-500 text-sm mt-1">Markets will appear here when they open for betting</p>
                            </div>
                        ) : (
                            <>
                                <h2 className="text-lg font-semibold text-green-400 mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                                    Open Markets ({availableMarkets.length})
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                                    {availableMarkets.map((market) => {
                                        const { label, color, textColor, borderColor } = getMarketStatus(market);
                                        return (
                                            <button
                                                key={market._id}
                                                type="button"
                                                onClick={() => handleMarketClick(market._id)}
                                                className={`group text-left bg-gray-800 hover:bg-gray-750 rounded-xl border ${borderColor} hover:border-yellow-500/50 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-yellow-500/10`}
                                            >
                                                <div className="flex items-start justify-between mb-3">
                                                    <span className={`${color} text-white text-xs font-bold px-2.5 py-1 rounded-full`}>
                                                        {label}
                                                    </span>
                                                    <FaChevronRight className="w-4 h-4 text-gray-600 group-hover:text-yellow-500 transition-colors" />
                                                </div>
                                                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-yellow-400 transition-colors">
                                                    {market.marketName}
                                                </h3>
                                                <div className="space-y-1.5 text-sm">
                                                    <div className="flex items-center justify-between text-gray-400">
                                                        <span>Timing</span>
                                                        <span className="text-gray-300 font-medium">{market.startingTime} - {market.closingTime}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-gray-400">
                                                        <span>Result</span>
                                                        <span className="text-yellow-400 font-mono font-bold">{market.displayResult || '***-**-***'}</span>
                                                    </div>
                                                </div>
                                                <div className="mt-3 pt-3 border-t border-gray-700/50">
                                                    <span className="text-xs text-yellow-500 font-semibold group-hover:text-yellow-400">
                                                        Click to play games →
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </>
                        )}

                        {/* Closed Markets */}
                        {closedMarkets.length > 0 && (
                            <>
                                <h2 className="text-lg font-semibold text-red-400 mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-red-400"></span>
                                    Closed Markets ({closedMarkets.length})
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
                                    {closedMarkets.map((market) => (
                                        <div
                                            key={market._id}
                                            className="text-left bg-gray-800/50 rounded-xl border border-red-500/20 p-5 cursor-not-allowed"
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                                                    CLOSED
                                                </span>
                                            </div>
                                            <h3 className="text-lg font-bold text-gray-400 mb-2">{market.marketName}</h3>
                                            <div className="space-y-1.5 text-sm">
                                                <div className="flex items-center justify-between text-gray-500">
                                                    <span>Timing</span>
                                                    <span className="text-gray-400 font-medium">{market.startingTime} - {market.closingTime}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-gray-500">
                                                    <span>Result</span>
                                                    <span className="text-yellow-400/60 font-mono font-bold">{market.displayResult || '***-**-***'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>
        </Layout>
    );
};

export default GamesMarkets;
