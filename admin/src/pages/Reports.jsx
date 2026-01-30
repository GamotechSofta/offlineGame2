import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const Reports = () => {
    const navigate = useNavigate();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
    });

    useEffect(() => {
        fetchReport();
    }, [dateRange]);

    const fetchReport = async () => {
        try {
            setLoading(true);
            const admin = JSON.parse(localStorage.getItem('admin'));
            const password = sessionStorage.getItem('adminPassword') || '';
            const response = await fetch(
                `${API_BASE_URL}/reports?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
                {
                    headers: {
                        'Authorization': `Basic ${btoa(`${admin.username}:${password}`)}`,
                    },
                }
            );
            const data = await response.json();
            if (data.success) {
                setReport(data.data);
            }
        } catch (err) {
            console.error('Error fetching report:', err);
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
                    <h1 className="text-3xl font-bold mb-6">Reports</h1>

                    {/* Date Range Selector */}
                    <div className="bg-gray-800 rounded-lg p-4 mb-6 flex gap-4">
                        <input
                            type="date"
                            value={dateRange.startDate}
                            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                            className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        />
                        <input
                            type="date"
                            value={dateRange.endDate}
                            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                            className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        />
                    </div>

                    {loading ? (
                        <div className="text-center py-12">
                            <p className="text-gray-400">Loading report...</p>
                        </div>
                    ) : report ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                                <h3 className="text-gray-400 text-sm mb-2">Total Revenue</h3>
                                <p className="text-2xl font-bold text-green-400">₹{report.totalRevenue}</p>
                            </div>
                            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                                <h3 className="text-gray-400 text-sm mb-2">Total Payouts</h3>
                                <p className="text-2xl font-bold text-red-400">₹{report.totalPayouts}</p>
                            </div>
                            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                                <h3 className="text-gray-400 text-sm mb-2">Net Profit</h3>
                                <p className="text-2xl font-bold text-yellow-400">₹{report.netProfit}</p>
                            </div>
                            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                                <h3 className="text-gray-400 text-sm mb-2">Total Bets</h3>
                                <p className="text-2xl font-bold">{report.totalBets}</p>
                            </div>
                            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                                <h3 className="text-gray-400 text-sm mb-2">Active Users</h3>
                                <p className="text-2xl font-bold">{report.activeUsers}</p>
                            </div>
                            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                                <h3 className="text-gray-400 text-sm mb-2">Winning Bets</h3>
                                <p className="text-2xl font-bold text-green-400">{report.winningBets}</p>
                            </div>
                            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                                <h3 className="text-gray-400 text-sm mb-2">Losing Bets</h3>
                                <p className="text-2xl font-bold text-red-400">{report.losingBets}</p>
                            </div>
                            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                                <h3 className="text-gray-400 text-sm mb-2">Win Rate</h3>
                                <p className="text-2xl font-bold">{report.winRate}%</p>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <p className="text-gray-400">No report data available</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Reports;
