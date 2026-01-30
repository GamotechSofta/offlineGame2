import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const admin = localStorage.getItem('admin');
        if (!admin) {
            navigate('/');
            return;
        }
        fetchDashboardStats();
    }, [navigate]);

    const fetchDashboardStats = async () => {
        try {
            setLoading(true);
            const admin = JSON.parse(localStorage.getItem('admin'));
            const password = sessionStorage.getItem('adminPassword') || '';
            const response = await fetch(`${API_BASE_URL}/dashboard/stats`, {
                headers: {
                    'Authorization': `Basic ${btoa(`${admin.username}:${password}`)}`,
                },
            });
            const data = await response.json();
            if (data.success) {
                setStats(data.data);
            } else {
                setError('Failed to fetch dashboard stats');
            }
        } catch (err) {
            setError('Network error. Please check if the server is running.');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('admin');
        sessionStorage.removeItem('adminPassword');
        navigate('/');
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 text-white flex">
                <Sidebar onLogout={handleLogout} />
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-gray-400">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-900 text-white flex">
                <Sidebar onLogout={handleLogout} />
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-red-400">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            <Sidebar onLogout={handleLogout} />
            <div className="ml-64 overflow-y-auto">
                <div className="p-8">
                    <h1 className="text-3xl font-bold mb-8">Dashboard Overview</h1>

                    {/* Revenue Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-lg p-6 shadow-lg">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-gray-200 text-sm font-medium">Total Revenue</h3>
                                <svg className="w-6 h-6 text-green-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <p className="text-3xl font-bold text-white">{formatCurrency(stats?.revenue?.total || 0)}</p>
                            <div className="mt-4 flex gap-4 text-xs text-green-100">
                                <div>
                                    <span className="text-green-200">Today: </span>
                                    <span className="font-semibold">{formatCurrency(stats?.revenue?.today || 0)}</span>
                                </div>
                                <div>
                                    <span className="text-green-200">This Week: </span>
                                    <span className="font-semibold">{formatCurrency(stats?.revenue?.thisWeek || 0)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-6 shadow-lg">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-gray-200 text-sm font-medium">Net Profit</h3>
                                <svg className="w-6 h-6 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                            </div>
                            <p className="text-3xl font-bold text-white">{formatCurrency(stats?.revenue?.netProfit || 0)}</p>
                            <div className="mt-4 text-xs text-blue-100">
                                <span className="text-blue-200">Payouts: </span>
                                <span className="font-semibold">{formatCurrency(stats?.revenue?.payouts || 0)}</span>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg p-6 shadow-lg">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-gray-200 text-sm font-medium">Total Users</h3>
                                <svg className="w-6 h-6 text-purple-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                            </div>
                            <p className="text-3xl font-bold text-white">{stats?.users?.total || 0}</p>
                            <div className="mt-4 flex gap-4 text-xs text-purple-100">
                                <div>
                                    <span className="text-purple-200">Active: </span>
                                    <span className="font-semibold">{stats?.users?.active || 0}</span>
                                </div>
                                <div>
                                    <span className="text-purple-200">New Today: </span>
                                    <span className="font-semibold">{stats?.users?.newToday || 0}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-lg p-6 shadow-lg">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-gray-200 text-sm font-medium">Total Bets</h3>
                                <svg className="w-6 h-6 text-yellow-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <p className="text-3xl font-bold text-white">{stats?.bets?.total || 0}</p>
                            <div className="mt-4 flex gap-4 text-xs text-yellow-100">
                                <div>
                                    <span className="text-yellow-200">Win Rate: </span>
                                    <span className="font-semibold">{stats?.bets?.winRate || 0}%</span>
                                </div>
                                <div>
                                    <span className="text-yellow-200">Today: </span>
                                    <span className="font-semibold">{stats?.bets?.today || 0}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Secondary Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                        {/* Markets Card */}
                        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                            <h3 className="text-lg font-semibold mb-4 text-gray-300">Markets</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Total Markets</span>
                                    <span className="text-white font-bold">{stats?.markets?.total || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Open Now</span>
                                    <span className="text-green-400 font-bold">{stats?.markets?.open || 0}</span>
                                </div>
                            </div>
                        </div>

                        {/* Bet Status Card */}
                        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                            <h3 className="text-lg font-semibold mb-4 text-gray-300">Bet Status</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Winning</span>
                                    <span className="text-green-400 font-bold">{stats?.bets?.winning || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Losing</span>
                                    <span className="text-red-400 font-bold">{stats?.bets?.losing || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Pending</span>
                                    <span className="text-yellow-400 font-bold">{stats?.bets?.pending || 0}</span>
                                </div>
                            </div>
                        </div>

                        {/* Payments Card */}
                        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                            <h3 className="text-lg font-semibold mb-4 text-gray-300">Payments</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Total Deposits</span>
                                    <span className="text-green-400 font-bold">{formatCurrency(stats?.payments?.totalDeposits || 0)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Total Withdrawals</span>
                                    <span className="text-red-400 font-bold">{formatCurrency(stats?.payments?.totalWithdrawals || 0)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Pending</span>
                                    <span className="text-yellow-400 font-bold">{stats?.payments?.pending || 0}</span>
                                </div>
                            </div>
                        </div>

                        {/* Wallet Card */}
                        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                            <h3 className="text-lg font-semibold mb-4 text-gray-300">Wallet</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Total Balance</span>
                                    <span className="text-yellow-400 font-bold text-xl">{formatCurrency(stats?.wallet?.totalBalance || 0)}</span>
                                </div>
                            </div>
                        </div>

                        {/* User Growth Card */}
                        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                            <h3 className="text-lg font-semibold mb-4 text-gray-300">User Growth</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">This Week</span>
                                    <span className="text-green-400 font-bold">{stats?.users?.newThisWeek || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">This Month</span>
                                    <span className="text-green-400 font-bold">{stats?.users?.newThisMonth || 0}</span>
                                </div>
                            </div>
                        </div>

                        {/* Help Desk Card */}
                        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                            <h3 className="text-lg font-semibold mb-4 text-gray-300">Help Desk</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Total Tickets</span>
                                    <span className="text-white font-bold">{stats?.helpDesk?.total || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Open</span>
                                    <span className="text-yellow-400 font-bold">{stats?.helpDesk?.open || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">In Progress</span>
                                    <span className="text-blue-400 font-bold">{stats?.helpDesk?.inProgress || 0}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Revenue Timeline */}
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                        <h3 className="text-lg font-semibold mb-4 text-gray-300">Revenue Timeline</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-gray-700 rounded-lg p-4">
                                <p className="text-gray-400 text-sm mb-2">Today</p>
                                <p className="text-2xl font-bold text-green-400">{formatCurrency(stats?.revenue?.today || 0)}</p>
                            </div>
                            <div className="bg-gray-700 rounded-lg p-4">
                                <p className="text-gray-400 text-sm mb-2">This Week</p>
                                <p className="text-2xl font-bold text-green-400">{formatCurrency(stats?.revenue?.thisWeek || 0)}</p>
                            </div>
                            <div className="bg-gray-700 rounded-lg p-4">
                                <p className="text-gray-400 text-sm mb-2">This Month</p>
                                <p className="text-2xl font-bold text-green-400">{formatCurrency(stats?.revenue?.thisMonth || 0)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
