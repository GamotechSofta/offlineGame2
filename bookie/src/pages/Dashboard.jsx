import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { API_BASE_URL, getBookieAuthHeaders } from '../utils/api';

const Dashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchDashboardStats();
    }, []);

    const fetchDashboardStats = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/dashboard/stats`, {
                headers: getBookieAuthHeaders(),
            });
            const data = await response.json();
            if (data.success) {
                setStats(data.data);
            } else {
                setError(data.message || 'Failed to fetch dashboard stats');
            }
        } catch (err) {
            setError('Network error. Please check if the server is running.');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

    if (loading) {
        return (
            <Layout title="Dashboard">
                <p className="text-gray-400">Loading dashboard...</p>
            </Layout>
        );
    }

    if (error) {
        return (
            <Layout title="Dashboard">
                <p className="text-red-400">{error}</p>
            </Layout>
        );
    }

    return (
        <Layout title="Dashboard Overview">
            <div className="space-y-8">
                <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Dashboard</h1>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-lg p-6 shadow-lg">
                        <h3 className="text-gray-200 text-sm font-medium mb-2">Total Revenue</h3>
                        <p className="text-3xl font-bold text-white">{formatCurrency(stats?.revenue?.total)}</p>
                        <div className="mt-4 flex gap-4 text-xs text-green-100">
                            <span>Today: {formatCurrency(stats?.revenue?.today)}</span>
                            <span>This Week: {formatCurrency(stats?.revenue?.thisWeek)}</span>
                        </div>
                    </div>
                    <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-6 shadow-lg">
                        <h3 className="text-gray-200 text-sm font-medium mb-2">Net Profit</h3>
                        <p className="text-3xl font-bold text-white">{formatCurrency(stats?.revenue?.netProfit)}</p>
                        <p className="mt-4 text-xs text-blue-100">Payouts: {formatCurrency(stats?.revenue?.payouts)}</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg p-6 shadow-lg">
                        <h3 className="text-gray-200 text-sm font-medium mb-2">My Players</h3>
                        <p className="text-3xl font-bold text-white">{stats?.users?.total || 0}</p>
                        <div className="mt-4 flex gap-4 text-xs text-purple-100">
                            <span>Active: {stats?.users?.active || 0}</span>
                            <span>New Today: {stats?.users?.newToday || 0}</span>
                        </div>
                    </div>
                    <div className="bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-lg p-6 shadow-lg">
                        <h3 className="text-gray-200 text-sm font-medium mb-2">Total Bets</h3>
                        <p className="text-3xl font-bold text-white">{stats?.bets?.total || 0}</p>
                        <div className="mt-4 flex gap-4 text-xs text-yellow-100">
                            <span>Win Rate: {stats?.bets?.winRate || 0}%</span>
                            <span>Today: {stats?.bets?.today || 0}</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                    <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700/50">
                        <h3 className="text-lg font-semibold mb-4 text-gray-300">Bet Status</h3>
                        <div className="space-y-2">
                            <div className="flex justify-between"><span className="text-gray-400">Winning</span><span className="text-green-400 font-bold">{stats?.bets?.winning || 0}</span></div>
                            <div className="flex justify-between"><span className="text-gray-400">Losing</span><span className="text-red-400 font-bold">{stats?.bets?.losing || 0}</span></div>
                            <div className="flex justify-between"><span className="text-gray-400">Pending</span><span className="text-yellow-400 font-bold">{stats?.bets?.pending || 0}</span></div>
                        </div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700/50">
                        <h3 className="text-lg font-semibold mb-4 text-gray-300">Payments</h3>
                        <div className="space-y-2">
                            <div className="flex justify-between"><span className="text-gray-400">Deposits</span><span className="text-green-400 font-bold">{formatCurrency(stats?.payments?.totalDeposits)}</span></div>
                            <div className="flex justify-between"><span className="text-gray-400">Withdrawals</span><span className="text-red-400 font-bold">{formatCurrency(stats?.payments?.totalWithdrawals)}</span></div>
                            <div className="flex justify-between"><span className="text-gray-400">Pending</span><span className="text-yellow-400 font-bold">{stats?.payments?.pending || 0}</span></div>
                        </div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700/50">
                        <h3 className="text-lg font-semibold mb-4 text-gray-300">Help Desk</h3>
                        <div className="space-y-2">
                            <div className="flex justify-between"><span className="text-gray-400">Total</span><span className="font-bold">{stats?.helpDesk?.total || 0}</span></div>
                            <div className="flex justify-between"><span className="text-gray-400">Open</span><span className="text-yellow-400 font-bold">{stats?.helpDesk?.open || 0}</span></div>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Dashboard;
