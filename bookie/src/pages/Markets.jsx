import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { API_BASE_URL, getMarketDisplayName } from '../utils/api';
import { useRefreshOnMarketReset } from '../hooks/useRefreshOnMarketReset';
import { useLanguage } from '../context/LanguageContext';

const Markets = () => {
    const { t, language } = useLanguage();
    const [markets, setMarkets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());

    const fetchMarkets = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/markets/get-markets`);
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

    // Helper function to check if current time has passed closing time
    const isPastClosingTime = (market) => {
        const closeStr = (market?.closingTime || '').toString().trim();
        if (!closeStr) return false;

        // Get today's date in IST
        const todayIST = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(currentTime);

        // Normalize time string (handle HH:MM or HH:MM:SS)
        const normalizeTimeStr = (timeStr) => {
            const parts = String(timeStr).split(':');
            const h = parts[0] || '00';
            const m = parts[1] || '00';
            return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:00`;
        };

        const startStr = (market?.startingTime || '').toString().trim();
        
        // Use startingTime if provided, otherwise default to midnight
        const openAt = startStr 
            ? new Date(`${todayIST}T${normalizeTimeStr(startStr)}+05:30`).getTime()
            : new Date(`${todayIST}T00:00:00+05:30`).getTime();
        
        // Parse closing time in IST
        let closeAt = new Date(`${todayIST}T${normalizeTimeStr(closeStr)}+05:30`).getTime();

        // If closing time is before or equal to opening time, market spans midnight
        // Example: 11 PM (23:00) to 1 AM (01:00) - closing is next day
        if (closeAt <= openAt) {
            const baseDate = new Date(`${todayIST}T12:00:00+05:30`);
            baseDate.setDate(baseDate.getDate() + 1);
            const nextDayStr = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Kolkata',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            }).format(baseDate);
            closeAt = new Date(`${nextDayStr}T${normalizeTimeStr(closeStr)}+05:30`).getTime();
        }

        // Use > instead of >= so market is accessible until after closing time
        return currentTime.getTime() > closeAt;
    };

    // ***-**-*** → Open (green), 156-2*-*** → Running (green), 987-45-456 → Closed (red)
    // Also check if closing time has passed
    const getMarketStatus = (market) => {
        const hasOpening = market.openingNumber && /^\d{3}$/.test(String(market.openingNumber));
        const hasClosing = market.closingNumber && /^\d{3}$/.test(String(market.closingNumber));
        const pastClosingTime = isPastClosingTime(market);

        // If closing time has passed, show as closed
        if (pastClosingTime) return { status: 'closed', color: 'bg-red-600' };
        
        // Otherwise check based on declared results
        if (hasOpening && hasClosing) return { status: 'closed', color: 'bg-red-600' };
        if (hasOpening && !hasClosing) return { status: 'running', color: 'bg-green-600' };
        return { status: 'open', color: 'bg-green-600' };
    };

    return (
        <Layout title={t('markets')}>
            <>
                <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">{t('marketsTitle')}</h1>
                {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">{error}</div>}
                {loading ? (
                    <p className="text-gray-400 py-12 text-center">{t('loading')}</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                        {markets.map((market) => {
                            const { status, color } = getMarketStatus(market);
                            return (
                                <div key={market._id} className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
                                    <div className={`${color} text-gray-800 text-xs font-semibold px-3 py-1 rounded-full inline-block mb-4`}>
                                        {status === 'open' && 'OPEN'}
                                        {status === 'running' && 'CLOSED IS RUNNING'}
                                        {status === 'closed' && 'CLOSED'}
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-800 mb-2">{getMarketDisplayName(market, language)}</h3>
                                    <div className="space-y-2 text-sm text-gray-600">
                                        <p><span className="font-semibold">Opening:</span> {market.startingTime}</p>
                                        <p><span className="font-semibold">Closing:</span> {market.closingTime}</p>
                                        <p><span className="font-semibold">Result:</span> <span className="text-orange-500 font-mono">{market.displayResult || '***-**-***'}</span></p>
                                        {market.winNumber && <p><span className="font-semibold">Win Number:</span> <span className="text-green-600 font-mono">{market.winNumber}</span></p>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </>
        </Layout>
    );
};

export default Markets;
