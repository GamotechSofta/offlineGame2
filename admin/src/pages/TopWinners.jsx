import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const TopWinners = () => {
    const navigate = useNavigate();
    const [winners, setWinners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('all'); // all, today, week, month

    useEffect(() => {
        fetchTopWinners();
    }, [timeRange]);

    const fetchTopWinners = async () => {
        try {
            setLoading(true);
            const admin = JSON.parse(localStorage.getItem('admin'));
            const password = sessionStorage.getItem('adminPassword') || '';
            const response = await fetch(`${API_BASE_URL}/bets/top-winners?timeRange=${timeRange}`, {
                headers: {
                    'Authorization': `Basic ${btoa(`${admin.username}:${password}`)}`,
                },
            });
            const data = await response.json();
            if (data.success) {
                setWinners(data.data);
            }
        } catch (err) {
            console.error('Error fetching top winners:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('admin');
        sessionStorage.removeItem('adminPassword');
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            <Sidebar onLogout={handleLogout} />
            <div className="ml-64">
                <div className="p-8">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-3xl font-bold">Top Winners</h1>
                        <select
                            value={timeRange}
                            onChange={(e) => setTimeRange(e.target.value)}
                            className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        >
                            <option value="all">All Time</option>
                            <option value="today">Today</option>
                            <option value="week">This Week</option>
                            <option value="month">This Month</option>
                        </select>
                    </div>

                    {loading ? (
                        <div className="text-center py-12">
                            <p className="text-gray-400">Loading winners...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {winners.length === 0 ? (
                                <div className="col-span-full text-center py-12">
                                    <p className="text-gray-400">No winners found</p>
                                </div>
                            ) : (
                                winners.map((winner, index) => (
                                    <div
                                        key={winner._id}
                                        className="bg-gray-800 rounded-lg p-6 border border-gray-700"
                                    >
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
                                                    index === 0 ? 'bg-yellow-500 text-black' :
                                                    index === 1 ? 'bg-gray-400 text-black' :
                                                    index === 2 ? 'bg-orange-600 text-white' :
                                                    'bg-gray-700 text-white'
                                                }`}>
                                                    {index + 1}
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold">{winner.userId?.username || 'Unknown'}</h3>
                                                    <p className="text-sm text-gray-400">{winner.userId?.email || ''}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <span className="text-gray-400">Total Wins:</span>
                                                <span className="font-semibold text-green-400">{winner.totalWins}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-400">Total Winnings:</span>
                                                <span className="font-semibold text-yellow-400">₹{winner.totalWinnings}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-400">Win Rate:</span>
                                                <span className="font-semibold">{winner.winRate}%</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TopWinners;
