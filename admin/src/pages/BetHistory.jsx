import React, { useState, useEffect, useMemo } from 'react';
import AdminLayout from '../components/AdminLayout';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const formatNum = (num) => {
    if (!num && num !== 0) return '0';
    return Number(num).toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

const BetHistory = () => {
    const navigate = useNavigate();
    const [bets, setBets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        userId: '',
        marketId: '',
        status: '',
        startDate: '',
        endDate: '',
    });

    useEffect(() => {
        fetchBets();
    }, [filters]);

    const fetchBets = async () => {
        try {
            setLoading(true);
            const admin = JSON.parse(localStorage.getItem('admin'));
            const password = sessionStorage.getItem('adminPassword') || '';
            const queryParams = new URLSearchParams();
            if (filters.userId) queryParams.append('userId', filters.userId);
            if (filters.marketId) queryParams.append('marketId', filters.marketId);
            if (filters.status) queryParams.append('status', filters.status);
            if (filters.startDate) queryParams.append('startDate', filters.startDate);
            if (filters.endDate) queryParams.append('endDate', filters.endDate);

            const response = await fetch(`${API_BASE_URL}/bets/history?${queryParams}`, {
                headers: {
                    'Authorization': `Basic ${btoa(`${admin.username}:${password}`)}`,
                },
            });
            const data = await response.json();
            if (data.success) {
                setBets(data.data);
            }
        } catch (err) {
            console.error('Error fetching bets:', err);
        } finally {
            setLoading(false);
        }
    };

    // Group bets by market and then by open/close
    const betsByMarket = useMemo(() => {
        const marketMap = new Map();

        bets.forEach((bet) => {
            const marketId = bet.marketId?._id || bet.marketId || 'unknown';
            const marketName = bet.marketId?.marketName || 'Unknown Market';
            
            if (!marketMap.has(marketId)) {
                marketMap.set(marketId, {
                    marketId,
                    marketName,
                    open: [],
                    close: [],
                    total: 0,
                    totalOpen: 0,
                    totalClose: 0,
                    totalAmount: 0,
                    totalOpenAmount: 0,
                    totalCloseAmount: 0,
                });
            }

            const marketData = marketMap.get(marketId);
            const betOn = bet.betOn || 'open'; // Default to open if not specified
            
            if (betOn === 'close') {
                marketData.close.push(bet);
                marketData.totalClose++;
                marketData.totalCloseAmount += bet.amount || 0;
            } else {
                marketData.open.push(bet);
                marketData.totalOpen++;
                marketData.totalOpenAmount += bet.amount || 0;
            }
            
            marketData.total++;
            marketData.totalAmount += bet.amount || 0;
        });

        // Convert to array and sort by market name
        return Array.from(marketMap.values()).sort((a, b) => 
            a.marketName.localeCompare(b.marketName)
        );
    }, [bets]);

    const handleLogout = () => {
        localStorage.removeItem('admin');
        sessionStorage.removeItem('adminPassword');
        navigate('/');
    };

    return (
        <AdminLayout onLogout={handleLogout} title="Bet History">
                    <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Bet History</h1>

                    {/* Filters */}
                    <div className="bg-white rounded-lg p-4 mb-4 sm:mb-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                        <input
                            type="text"
                            placeholder="Player ID"
                            value={filters.userId}
                            onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
                            className="px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-800"
                        />
                        <input
                            type="text"
                            placeholder="Market ID"
                            value={filters.marketId}
                            onChange={(e) => setFilters({ ...filters, marketId: e.target.value })}
                            className="px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-800"
                        />
                        <select
                            value={filters.status}
                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                            className="px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-800"
                        >
                            <option value="">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="won">Won</option>
                            <option value="lost">Lost</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                        <input
                            type="date"
                            value={filters.startDate}
                            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                            className="px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-800"
                        />
                        <input
                            type="date"
                            value={filters.endDate}
                            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                            className="px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-800"
                        />
                    </div>

                    {/* Bets Grouped by Market */}
                    {loading ? (
                        <div className="text-center py-12">
                            <p className="text-gray-400">Loading bets...</p>
                        </div>
                    ) : betsByMarket.length === 0 ? (
                        <div className="bg-white rounded-lg p-8 text-center">
                            <p className="text-gray-500">No bets found</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {betsByMarket.map((marketData) => (
                                <div key={marketData.marketId} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                    {/* Market Header */}
                                    <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 border-b border-orange-300">
                                        <div className="flex items-center justify-between">
                                            <h2 className="text-xl font-bold text-white">{marketData.marketName}</h2>
                                            <div className="text-right text-white/90">
                                                <div className="text-sm">Total Bets: {marketData.total}</div>
                                                <div className="text-sm font-semibold">Total Amount: ₹{formatNum(marketData.totalAmount)}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-6 space-y-6">
                                        {/* Opening Bets Section */}
                                        <div>
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-lg font-bold text-orange-600 flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                                    Opening Bets ({marketData.totalOpen})
                                                </h3>
                                                <span className="text-sm text-gray-600">
                                                    Total: ₹{formatNum(marketData.totalOpenAmount)}
                                                </span>
                                            </div>
                                            {marketData.open.length === 0 ? (
                                                <p className="text-gray-500 text-center py-4 bg-gray-50 rounded-lg">No opening bets found</p>
                                            ) : (
                                                <div className="overflow-x-auto rounded-lg border border-gray-200">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-gray-50">
                                                            <tr>
                                                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Time</th>
                                                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Player</th>
                                                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Phone</th>
                                                                <th className="px-3 py-2 text-center font-semibold text-gray-700">Bet Type</th>
                                                                <th className="px-3 py-2 text-center font-semibold text-gray-700">Number</th>
                                                                <th className="px-3 py-2 text-right font-semibold text-gray-700">Amount</th>
                                                                <th className="px-3 py-2 text-center font-semibold text-gray-700">Status</th>
                                                                <th className="px-3 py-2 text-center font-semibold text-gray-700">Placed By</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-200">
                                                            {marketData.open.map((bet) => (
                                                                <tr key={bet._id} className="hover:bg-gray-50">
                                                                    <td className="px-3 py-2 text-gray-600 font-mono text-xs">
                                                                        {new Date(bet.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-gray-800 font-medium">{bet.userId?.username || 'N/A'}</td>
                                                                    <td className="px-3 py-2 text-gray-600 text-xs">{bet.userId?.phone || bet.userId?.email || '—'}</td>
                                                                    <td className="px-3 py-2 text-center">
                                                                        <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700">
                                                                            {bet.betType?.toUpperCase() || 'N/A'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-3 py-2 text-center font-mono font-bold text-orange-600">{bet.betNumber || '—'}</td>
                                                                    <td className="px-3 py-2 text-right font-semibold text-gray-800">₹{formatNum(bet.amount)}</td>
                                                                    <td className="px-3 py-2 text-center">
                                                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                                                            bet.status === 'won' ? 'bg-green-100 text-green-700' :
                                                                            bet.status === 'lost' ? 'bg-red-100 text-red-700' :
                                                                            'bg-yellow-100 text-yellow-700'
                                                                        }`}>
                                                                            {bet.status?.toUpperCase() || 'PENDING'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-3 py-2 text-center text-xs text-gray-600">
                                                                        {bet.placedByBookie ? (bet.placedByBookieId?.username || 'Bookie') : 'Player'}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>

                                        {/* Closing Bets Section */}
                                        <div className="pt-6 border-t border-gray-200">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-lg font-bold text-orange-600 flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                                    Closing Bets ({marketData.totalClose})
                                                </h3>
                                                <span className="text-sm text-gray-600">
                                                    Total: ₹{formatNum(marketData.totalCloseAmount)}
                                                </span>
                                            </div>
                                            {marketData.close.length === 0 ? (
                                                <p className="text-gray-500 text-center py-4 bg-gray-50 rounded-lg">No closing bets found</p>
                                            ) : (
                                                <div className="overflow-x-auto rounded-lg border border-gray-200">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-gray-50">
                                                            <tr>
                                                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Time</th>
                                                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Player</th>
                                                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Phone</th>
                                                                <th className="px-3 py-2 text-center font-semibold text-gray-700">Bet Type</th>
                                                                <th className="px-3 py-2 text-center font-semibold text-gray-700">Number</th>
                                                                <th className="px-3 py-2 text-right font-semibold text-gray-700">Amount</th>
                                                                <th className="px-3 py-2 text-center font-semibold text-gray-700">Status</th>
                                                                <th className="px-3 py-2 text-center font-semibold text-gray-700">Placed By</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-200">
                                                            {marketData.close.map((bet) => (
                                                                <tr key={bet._id} className="hover:bg-gray-50">
                                                                    <td className="px-3 py-2 text-gray-600 font-mono text-xs">
                                                                        {new Date(bet.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-gray-800 font-medium">{bet.userId?.username || 'N/A'}</td>
                                                                    <td className="px-3 py-2 text-gray-600 text-xs">{bet.userId?.phone || bet.userId?.email || '—'}</td>
                                                                    <td className="px-3 py-2 text-center">
                                                                        <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700">
                                                                            {bet.betType?.toUpperCase() || 'N/A'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-3 py-2 text-center font-mono font-bold text-orange-600">{bet.betNumber || '—'}</td>
                                                                    <td className="px-3 py-2 text-right font-semibold text-gray-800">₹{formatNum(bet.amount)}</td>
                                                                    <td className="px-3 py-2 text-center">
                                                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                                                            bet.status === 'won' ? 'bg-green-100 text-green-700' :
                                                                            bet.status === 'lost' ? 'bg-red-100 text-red-700' :
                                                                            'bg-yellow-100 text-yellow-700'
                                                                        }`}>
                                                                            {bet.status?.toUpperCase() || 'PENDING'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-3 py-2 text-center text-xs text-gray-600">
                                                                        {bet.placedByBookie ? (bet.placedByBookieId?.username || 'Bookie') : 'Player'}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
        </AdminLayout>
    );
};

export default BetHistory;
