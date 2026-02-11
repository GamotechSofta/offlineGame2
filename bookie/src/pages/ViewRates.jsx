import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const GAME_LABELS = {
    single: 'Single Digit',
    jodi: 'Jodi',
    singlePatti: 'Single Patti',
    doublePatti: 'Double Patti',
    triplePatti: 'Triple Patti',
    halfSangam: 'Half Sangam',
    fullSangam: 'Full Sangam',
};

const ViewRates = () => {
    const [rates, setRates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchRates();
    }, []);

    const GAME_ORDER = ['single', 'jodi', 'singlePatti', 'doublePatti', 'triplePatti', 'halfSangam', 'fullSangam'];

    const fetchRates = async () => {
        try {
            setLoading(true);
            setError('');
            const res = await fetch(`${API_BASE_URL}/rates/current`);
            const data = await res.json();
            if (data.success && data.data) {
                const map = data.data;
                const list = GAME_ORDER
                    .filter((key) => map[key] != null)
                    .map((key) => ({ gameType: key, rate: map[key] }));
                setRates(list);
            } else {
                setError(data.message || 'Failed to fetch rates');
            }
        } catch (err) {
            setError('Network error.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout title="Payout Rates">
            <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-center text-white">Payout Rates</h1>
            <p className="text-gray-400 mb-6 text-center">Payout rate per 1 unit bet (1 =)</p>

            {error && (
                <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm max-w-2xl mx-auto">{error}</div>
            )}

            {loading ? (
                <div className="text-center py-12 text-gray-400">Loading...</div>
            ) : (
                <div className="overflow-x-auto max-w-2xl mx-auto rounded-lg border-2 border-gray-700 bg-gray-800/50">
                    <table className="w-full border-collapse text-sm sm:text-base">
                        <thead>
                            <tr className="bg-gray-800 border-b-2 border-black">
                                <th className="text-left py-3 px-4 font-bold text-amber-400 border-r border-gray-600">Sr No</th>
                                <th className="text-left py-3 px-4 font-bold text-amber-400 border-r border-gray-600">Game</th>
                                <th className="text-left py-3 px-4 font-bold text-amber-400">Rate (1 =)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rates.map((item, idx) => (
                                <tr key={item.gameType} className="border-b border-gray-700 hover:bg-gray-800/70">
                                    <td className="py-2 sm:py-3 px-4 text-gray-300 border-r border-gray-600">{idx + 1}</td>
                                    <td className="py-2 sm:py-3 px-4 font-medium text-white border-r border-gray-600">
                                        {GAME_LABELS[item.gameType] || item.gameType}
                                    </td>
                                    <td className="py-2 sm:py-3 px-4">
                                        <span className="font-mono text-yellow-400">{item.rate}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </Layout>
    );
};

export default ViewRates;
