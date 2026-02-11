import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { API_BASE_URL, getBookieAuthHeaders } from '../utils/api';

const BetHistory = () => {
    const [bets, setBets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ userId: '', marketId: '', status: '', startDate: '', endDate: '' });

    useEffect(() => {
        fetchBets();
    }, [filters]);

    const fetchBets = async () => {
        try {
            setLoading(true);
            const q = new URLSearchParams();
            if (filters.userId) q.append('userId', filters.userId);
            if (filters.marketId) q.append('marketId', filters.marketId);
            if (filters.status) q.append('status', filters.status);
            if (filters.startDate) q.append('startDate', filters.startDate);
            if (filters.endDate) q.append('endDate', filters.endDate);
            const response = await fetch(`${API_BASE_URL}/bets/history?${q}`, { headers: getBookieAuthHeaders() });
            const data = await response.json();
            if (data.success) setBets(data.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout title="Bet History">
            <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Bet History</h1>
            <div className="bg-white rounded-lg p-4 mb-4 sm:mb-6 flex flex-wrap gap-3 items-center border border-gray-200">
                <input type="text" placeholder="Player ID" value={filters.userId} onChange={(e) => setFilters({ ...filters, userId: e.target.value })} className="px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-800" />
                <input type="text" placeholder="Market ID" value={filters.marketId} onChange={(e) => setFilters({ ...filters, marketId: e.target.value })} className="px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-800" />
                <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-800">
                    <option value="">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                    <option value="cancelled">Cancelled</option>
                </select>
                <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-800" />
                <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-800" />
            </div>
            {loading ? (
                <p className="text-gray-400 py-12 text-center">Loading...</p>
            ) : (
                <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
                    <table className="w-full">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Player</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Market</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Bet Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Amount</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {bets.length === 0 ? (
                                <tr><td colSpan="7" className="px-6 py-4 text-center text-gray-400">No bets found</td></tr>
                            ) : (
                                bets.map((bet) => (
                                    <tr key={bet._id} className="hover:bg-gray-100">
                                        <td className="px-6 py-4 text-sm">{bet._id?.slice(-8)}</td>
                                        <td className="px-6 py-4 text-sm">{bet.userId?.username || bet.userId}</td>
                                        <td className="px-6 py-4 text-sm">
                                            {typeof bet.marketId === 'object' && bet.marketId !== null
                                                ? (bet.marketId.marketName || '—')
                                                : (bet.marketId ? String(bet.marketId) : '—')}
                                        </td>
                                        <td className="px-6 py-4 text-sm">{bet.betType}</td>
                                        <td className="px-6 py-4 text-sm">₹{bet.amount}</td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`px-2 py-1 rounded text-xs ${bet.status === 'won' ? 'bg-green-600' : bet.status === 'lost' ? 'bg-red-600' : bet.status === 'pending' ? 'bg-orange-600' : 'bg-gray-200'}`}>{bet.status}</span>
                                        </td>
                                        <td className="px-6 py-4 text-sm">{new Date(bet.createdAt).toLocaleString()}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </Layout>
    );
};

export default BetHistory;
