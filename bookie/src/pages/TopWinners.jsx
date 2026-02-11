import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { API_BASE_URL, getBookieAuthHeaders } from '../utils/api';

const TopWinners = () => {
    const [winners, setWinners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('all');

    useEffect(() => {
        fetchTopWinners();
    }, [timeRange]);

    const fetchTopWinners = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/bets/top-winners?timeRange=${timeRange}`, { headers: getBookieAuthHeaders() });
            const data = await response.json();
            if (data.success) setWinners(data.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout title="Top Winners">
            <div className="flex flex-wrap justify-between items-center gap-4 mb-4 sm:mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold">Top Winners</h1>
                <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} className="px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-800">
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                </select>
            </div>
            {loading ? (
                <p className="text-gray-400 py-12 text-center">Loading...</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {winners.length === 0 ? (
                        <div className="col-span-full text-center py-12 text-gray-400">No winners found</div>
                    ) : (
                        winners.map((winner, i) => (
                            <div key={winner._id} className="bg-white rounded-lg p-4 sm:p-6 border border-gray-200">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${i === 0 ? 'bg-orange-500 text-gray-800' : i === 1 ? 'bg-gray-400 text-gray-800' : i === 2 ? 'bg-orange-600 text-gray-800' : 'bg-gray-100 text-gray-800'}`}>{i + 1}</div>
                                    <div>
                                        <h3 className="font-semibold">{winner.userId?.username || 'Unknown'}</h3>
                                        <p className="text-sm text-gray-400">{winner.userId?.email || ''}</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between"><span className="text-gray-400">Total Wins:</span><span className="font-semibold text-green-600">{winner.totalWins}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-400">Total Winnings:</span><span className="font-semibold text-orange-500">₹{winner.totalWinnings}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-400">Win Rate:</span><span className="font-semibold">{winner.winRate}%</span></div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </Layout>
    );
};

export default TopWinners;
