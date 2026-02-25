import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { API_BASE_URL, getMarketDisplayName, fetchWithAuth } from '../utils/api';
import { useRefreshOnMarketReset } from '../hooks/useRefreshOnMarketReset';
import { useLanguage } from '../context/LanguageContext';
import { getMarketSession, isPastClosingTime } from '../utils/marketTiming';

/** Format "13:00" / "15:10" to "1pm" / "3:10pm" */
function formatTimeLabel(timeStr) {
    if (!timeStr) return '—';
    const parts = String(timeStr).trim().split(':');
    const h = parseInt(parts[0], 10) || 0;
    const m = parts[1] ? parseInt(parts[1], 10) : 0;
    if (h === 12 && m === 0) return '12pm';
    if (h === 0 && m === 0) return '12am';
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    const ampm = h >= 12 ? 'pm' : 'am';
    const minStr = m > 0 ? `:${String(m).padStart(2, '0')}` : '';
    return `${hour}${minStr}${ampm}`;
}

const Markets = () => {
    const { t, language } = useLanguage();
    const [markets, setMarkets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());

    const fetchMarkets = async () => {
        try {
            setLoading(true);
            const response = await fetchWithAuth(`${API_BASE_URL}/markets/get-markets`);
            if (response.status === 401) return;
            const data = await response.json();
            if (data.success) setMarkets(data.data);
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

    // Update current time every minute to check if markets have closed
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000); // Update every minute
        return () => clearInterval(interval);
    }, []);

    useRefreshOnMarketReset(fetchMarkets);

    // ***-**-*** → Open (green), 156-2*-*** → Running (green), 987-45-456 → Closed (red)
    const getMarketStatus = (market) => {
        const hasOpening = market.openingNumber && /^\d{3}$/.test(String(market.openingNumber));
        const hasClosing = market.closingNumber && /^\d{3}$/.test(String(market.closingNumber));
        const pastClosingTime = isPastClosingTime(market, currentTime);

        if (pastClosingTime) return { status: 'closed' };
        if (hasOpening && hasClosing) return { status: 'closed' };
        if (hasOpening && !hasClosing) return { status: 'running' };
        return { status: 'open' };
    };

    return (
        <Layout title={t('markets')}>
            <div className="min-w-0 max-w-full" style={{ backgroundColor: 'rgb(248, 249, 250)' }}>
                <div className="mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                            <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </span>
                        {t('marketsTitle')}
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">View market status, timings and results</p>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-600 text-sm">{error}</div>
                )}

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-orange-500" />
                        <p className="mt-4 text-gray-500 text-sm">{t('loading')}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {markets.map((market) => {
                            const { status } = getMarketStatus(market);
                            const session = getMarketSession(market, currentTime);
                            const isClosed = status === 'closed';
                            const resultDisplay = market.displayResult || '***-**-***';
                            const openActive = session === 'open';
                            const closeActive = session === 'close';

                            return (
                                <div
                                    key={market._id}
                                    className="text-left w-full bg-white rounded-xl border border-gray-300 p-3 shadow-sm"
                                >
                                    {/* Top: Open for bets / Closed */}
                                    <div className="flex justify-center mb-1.5">
                                        {isClosed ? (
                                            <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold bg-gray-200 text-gray-600">
                                                Closed
                                            </span>
                                        ) : (
                                            <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold bg-green-500 text-white">
                                                Open for bets
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between gap-2 sm:gap-3">
                                        {/* Left: open pill + opening time + description */}
                                        <div className="flex flex-col items-start shrink-0 w-[72px] sm:w-[80px]">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                                isClosed ? 'bg-gray-100 text-gray-400' : openActive ? 'bg-green-500 text-white' : 'bg-green-100 text-green-600'
                                            }`}>
                                                open
                                            </span>
                                            <span className="text-xs text-black mt-0.5 font-normal font-semibold">
                                                {formatTimeLabel(market.startingTime)}
                                            </span>
                                            <span className="text-[9px] text-gray-500 mt-0.5 max-w-[72px] leading-tight">
                                                Open bets until this time
                                            </span>
                                        </div>
                                        {/* Center: market name + Bets on + time range + result */}
                                        <div className="flex-1 flex flex-col items-center justify-center min-w-0 px-1 sm:px-2 overflow-hidden">
                                            <h3 className="text-sm sm:text-base font-bold text-black w-full min-w-0 overflow-x-auto overflow-y-hidden scrollbar-hidden text-center leading-tight uppercase">
                                                {getMarketDisplayName(market, language)}
                                            </h3>
                                            {!isClosed ? (
                                                <>
                                                    <p className="text-[10px] font-medium text-orange-600 mt-0.5">
                                                        Bets on: {openActive ? 'Open' : 'Close'}
                                                    </p>
                                                    <p className="text-[9px] text-gray-500 mt-0.5 text-center leading-tight">
                                                        Open until {formatTimeLabel(market.startingTime)} · Close until {formatTimeLabel(market.closingTime)}
                                                    </p>
                                                </>
                                            ) : null}
                                            <p className="text-xs text-black font-mono font-normal tracking-wide mt-0.5">
                                                {resultDisplay}
                                            </p>
                                        </div>
                                        {/* Right: close pill + closing time + description */}
                                        <div className="flex flex-col items-end shrink-0 w-[72px] sm:w-[80px]">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                                isClosed ? 'bg-gray-100 text-gray-400' : closeActive ? 'bg-red-500 text-white' : 'bg-red-100 text-red-600'
                                            }`}>
                                                close
                                            </span>
                                            <span className="text-xs text-black mt-0.5 font-normal font-semibold">
                                                {formatTimeLabel(market.closingTime)}
                                            </span>
                                            <span className="text-[9px] text-gray-500 mt-0.5 text-right max-w-[72px] leading-tight">
                                                Close bets until this time
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {!loading && !error && markets.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-xl border-2 border-gray-200">
                        <p className="text-gray-500">No markets available</p>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default Markets;
