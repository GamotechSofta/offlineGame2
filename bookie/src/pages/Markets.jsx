import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { API_BASE_URL } from '../utils/api';

const Markets = () => {
    const [markets, setMarkets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchMarkets();
    }, []);

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
            <div>
                <h1 className="text-3xl font-bold mb-6">Markets (View Only)</h1>
                {error && <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">{error}</div>}
                {loading ? (
                    <p className="text-gray-400 py-12 text-center">Loading markets...</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {markets.map((market) => {
                            const { status, color } = getMarketStatus(market);
                            return (
                                <div key={market._id} className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                                    <div className={`${color} text-white text-xs font-semibold px-3 py-1 rounded-full inline-block mb-4`}>
                                        {status === 'open' && 'OPEN'}
                                        {status === 'running' && 'CLOSED IS RUNNING'}
                                        {status === 'closed' && 'CLOSED'}
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-2">{market.marketName}</h3>
                                    <div className="space-y-2 text-sm text-gray-300">
                                        <p><span className="font-semibold">Opening:</span> {market.startingTime}</p>
                                        <p><span className="font-semibold">Closing:</span> {market.closingTime}</p>
                                        <p><span className="font-semibold">Result:</span> <span className="text-yellow-400 font-mono">{market.displayResult || '***-**-***'}</span></p>
                                        {market.winNumber && <p><span className="font-semibold">Win Number:</span> <span className="text-green-400 font-mono">{market.winNumber}</span></p>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default Markets;
