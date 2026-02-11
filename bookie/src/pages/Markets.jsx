import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { API_BASE_URL } from '../utils/api';
import { useRefreshOnMarketReset } from '../hooks/useRefreshOnMarketReset';

const Markets = () => {
    const [markets, setMarkets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

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

    useRefreshOnMarketReset(fetchMarkets);

    // ***-**-*** → Open (green), 156-2*-*** → Running (green), 987-45-456 → Closed (red)
    const getMarketStatus = (market) => {
        const hasOpening = market.openingNumber && /^\d{3}$/.test(String(market.openingNumber));
        const hasClosing = market.closingNumber && /^\d{3}$/.test(String(market.closingNumber));
        if (hasOpening && hasClosing) return { status: 'closed', color: 'bg-red-600' };
        if (hasOpening && !hasClosing) return { status: 'running', color: 'bg-green-600' };
        return { status: 'open', color: 'bg-green-600' };
    };

    return (
        <Layout title="Markets">
            <>
                <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Markets (View Only)</h1>
                {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">{error}</div>}
                {loading ? (
                    <p className="text-gray-400 py-12 text-center">Loading markets...</p>
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
                                    <h3 className="text-xl font-bold text-gray-800 mb-2">{market.marketName}</h3>
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
