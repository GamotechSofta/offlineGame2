import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import { useNavigate, Link } from 'react-router-dom';
import {
    FaChartLine,
    FaMoneyBillWave,
    FaCoins,
    FaChartBar,
    FaSyncAlt,
    FaCalendarAlt,
    FaFileExport,
    FaHistory,
    FaTrophy,
    FaUsers,
    FaWallet,
    FaPrint,
} from 'react-icons/fa';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const PRESETS = [
    { id: 'today', label: 'Today', getRange: () => {
        const d = new Date();
        const y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
        const from = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return { from, to: from };
    }},
    { id: 'yesterday', label: 'Yesterday', getRange: () => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
        const from = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return { from, to: from };
    }},
    { id: 'this_week', label: 'This Week', getRange: () => {
        const d = new Date();
        const day = d.getDay();
        const sun = new Date(d);
        sun.setDate(d.getDate() - day);
        const sat = new Date(sun);
        sat.setDate(sun.getDate() + 6);
        const fmt = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
        return { from: fmt(sun), to: fmt(sat) };
    }},
    { id: 'last_week', label: 'Last Week', getRange: () => {
        const d = new Date();
        const day = d.getDay();
        const sun = new Date(d);
        sun.setDate(d.getDate() - day - 7);
        const sat = new Date(sun);
        sat.setDate(sun.getDate() + 6);
        const fmt = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
        return { from: fmt(sun), to: fmt(sat) };
    }},
    { id: 'this_month', label: 'This Month', getRange: () => {
        const d = new Date();
        const y = d.getFullYear(), m = d.getMonth();
        const last = new Date(y, m + 1, 0);
        const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
        const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
        return { from, to };
    }},
    { id: 'last_month', label: 'Last Month', getRange: () => {
        const d = new Date();
        const y = d.getFullYear(), m = d.getMonth() - 1;
        const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
        const last = new Date(y, m + 1, 0);
        const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
        return { from, to };
    }},
];

const formatCurrency = (n) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return '₹0';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(num);
};

const formatNumber = (n) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return '0';
    return new Intl.NumberFormat('en-IN').format(num);
};

const formatRangeLabel = (from, to) => {
    if (!from || !to) return 'Select dates';
    if (from === to) {
        const d = new Date(from + 'T12:00:00');
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    const a = new Date(from + 'T12:00:00');
    const b = new Date(to + 'T12:00:00');
    return `${a.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${b.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
};

const RELATED_LINKS = [
    { to: '/bet-history', label: 'Bet History', icon: FaHistory, description: 'View all bets and filter by date' },
    { to: '/payment-management', label: 'Payment Management', icon: FaWallet, description: 'Add funds, withdrawals, transactions' },
    { to: '/top-winners', label: 'Top Winners', icon: FaTrophy, description: 'Leaderboard and winning players' },
    { to: '/all-users', label: 'All Users', icon: FaUsers, description: 'Active players and user list' },
];

const Reports = () => {
    const navigate = useNavigate();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState(() => {
        const d = new Date();
        const y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
        const today = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return { startDate: today, endDate: today };
    });
    const [activePreset, setActivePreset] = useState('today');

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
                        'Authorization': `Basic ${btoa(`${admin?.username}:${password}`)}`,
                    },
                }
            );
            const data = await response.json();
            if (data.success) {
                setReport(data.data);
            } else {
                setReport(null);
            }
        } catch (err) {
            console.error('Error fetching report:', err);
            setReport(null);
        } finally {
            setLoading(false);
        }
    };

    const applyPreset = (presetId) => {
        const preset = PRESETS.find((p) => p.id === presetId);
        if (preset) {
            const { from, to } = preset.getRange();
            setDateRange({ startDate: from, endDate: to });
            setActivePreset(presetId);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('admin');
        sessionStorage.removeItem('adminPassword');
        navigate('/');
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <AdminLayout onLogout={handleLogout} title="Reports">
            <div className="space-y-6 print:hidden">
                {/* Page header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
                            <FaChartLine className="w-8 h-8 text-amber-500" />
                            Reports
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">Financial and betting summary for the selected period</p>
                    </div>
                </div>

                {/* Date range & filters */}
                <div className="bg-gray-800/80 rounded-xl border border-gray-700/80 p-4 sm:p-5">
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        <FaCalendarAlt className="w-5 h-5 text-amber-500 shrink-0" />
                        <span className="text-sm font-medium text-gray-300">Period</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-4">
                        {PRESETS.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => applyPreset(p.id)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                    activePreset === p.id
                                        ? 'bg-amber-500 text-black'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <input
                            type="date"
                            value={dateRange.startDate}
                            onChange={(e) => {
                                setDateRange((r) => ({ ...r, startDate: e.target.value }));
                                setActivePreset('');
                            }}
                            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        />
                        <span className="text-gray-500">to</span>
                        <input
                            type="date"
                            value={dateRange.endDate}
                            onChange={(e) => {
                                setDateRange((r) => ({ ...r, endDate: e.target.value }));
                                setActivePreset('');
                            }}
                            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        />
                        <button
                            type="button"
                            onClick={fetchReport}
                            disabled={loading}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg transition-colors disabled:opacity-50"
                        >
                            <FaSyncAlt className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                        <span className="text-gray-500 text-sm">{formatRangeLabel(dateRange.startDate, dateRange.endDate)}</span>
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="bg-gray-800/60 rounded-xl h-28 animate-pulse border border-gray-700/50" />
                        ))}
                    </div>
                ) : report ? (
                    <>
                        {/* Summary strip - key metrics */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 rounded-xl p-5 border border-green-500/30">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-400">Total Revenue</p>
                                        <p className="text-2xl font-bold text-green-400 mt-1">{formatCurrency(report.totalRevenue)}</p>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                                        <FaMoneyBillWave className="w-6 h-6 text-green-400" />
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 rounded-xl p-5 border border-red-500/30">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-400">Total Payouts</p>
                                        <p className="text-2xl font-bold text-red-400 mt-1">{formatCurrency(report.totalPayouts)}</p>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                                        <FaCoins className="w-6 h-6 text-red-400" />
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 rounded-xl p-5 border border-amber-500/30">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-400">Net Profit</p>
                                        <p className="text-2xl font-bold text-amber-400 mt-1">{formatCurrency(report.netProfit)}</p>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                                        <FaChartBar className="w-6 h-6 text-amber-400" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Betting stats */}
                        <div className="bg-gray-800/80 rounded-xl border border-gray-700/80 p-5">
                            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <FaChartBar className="w-5 h-5 text-amber-500" />
                                Betting Summary
                            </h2>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600/50">
                                    <p className="text-xs text-gray-400 uppercase tracking-wider">Total Bets</p>
                                    <p className="text-xl font-bold text-white mt-1">{formatNumber(report.totalBets)}</p>
                                </div>
                                <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600/50">
                                    <p className="text-xs text-gray-400 uppercase tracking-wider">Active Players</p>
                                    <p className="text-xl font-bold text-white mt-1">{formatNumber(report.activeUsers)}</p>
                                </div>
                                <div className="bg-gray-700/50 rounded-lg p-4 border border-green-500/20">
                                    <p className="text-xs text-gray-400 uppercase tracking-wider">Winning Bets</p>
                                    <p className="text-xl font-bold text-green-400 mt-1">{formatNumber(report.winningBets)}</p>
                                </div>
                                <div className="bg-gray-700/50 rounded-lg p-4 border border-red-500/20">
                                    <p className="text-xs text-gray-400 uppercase tracking-wider">Losing Bets</p>
                                    <p className="text-xl font-bold text-red-400 mt-1">{formatNumber(report.losingBets)}</p>
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-700/80">
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700/50 rounded-lg">
                                    <span className="text-sm text-gray-400">Win Rate</span>
                                    <span className="text-lg font-bold text-white">{report.winRate}%</span>
                                </div>
                            </div>
                        </div>

                        {/* Related reports / quick links */}
                        <div className="bg-gray-800/80 rounded-xl border border-gray-700/80 p-5">
                            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <FaFileExport className="w-5 h-5 text-amber-500" />
                                Related Reports & Actions
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {RELATED_LINKS.map((item) => (
                                    <Link
                                        key={item.to}
                                        to={item.to}
                                        className="flex items-start gap-3 p-4 rounded-xl bg-gray-700/50 border border-gray-600/50 hover:border-amber-500/40 hover:bg-gray-700/80 transition-all group"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0 group-hover:bg-amber-500/30 transition-colors">
                                            <item.icon className="w-5 h-5 text-amber-400" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-white group-hover:text-amber-400 transition-colors">{item.label}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-700/80 flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    onClick={handlePrint}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors print:hidden"
                                >
                                    <FaPrint className="w-4 h-4" />
                                    Print Report
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="bg-gray-800/60 rounded-xl border border-gray-700/80 p-12 text-center">
                        <FaChartLine className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400 text-lg">No report data available for this period</p>
                        <p className="text-gray-500 text-sm mt-2">Try a different date range or refresh the page</p>
                        <button
                            type="button"
                            onClick={fetchReport}
                            className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg transition-colors"
                        >
                            Refresh
                        </button>
                    </div>
                )}
            </div>

            {/* Print-only summary */}
            {report && (
                <div className="hidden print:block mt-8 p-6 bg-white text-black rounded-lg">
                    <h2 className="text-xl font-bold mb-4">Report Summary</h2>
                    <p className="text-sm text-gray-600 mb-4">{formatRangeLabel(dateRange.startDate, dateRange.endDate)}</p>
                    <table className="w-full text-sm">
                        <tbody>
                            <tr><td className="py-1 font-medium">Total Revenue</td><td className="text-right">{formatCurrency(report.totalRevenue)}</td></tr>
                            <tr><td className="py-1 font-medium">Total Payouts</td><td className="text-right">{formatCurrency(report.totalPayouts)}</td></tr>
                            <tr><td className="py-1 font-medium">Net Profit</td><td className="text-right">{formatCurrency(report.netProfit)}</td></tr>
                            <tr><td className="py-1 font-medium">Total Bets</td><td className="text-right">{formatNumber(report.totalBets)}</td></tr>
                            <tr><td className="py-1 font-medium">Active Players</td><td className="text-right">{formatNumber(report.activeUsers)}</td></tr>
                            <tr><td className="py-1 font-medium">Winning Bets</td><td className="text-right">{formatNumber(report.winningBets)}</td></tr>
                            <tr><td className="py-1 font-medium">Losing Bets</td><td className="text-right">{formatNumber(report.losingBets)}</td></tr>
                            <tr><td className="py-1 font-medium">Win Rate</td><td className="text-right">{report.winRate}%</td></tr>
                        </tbody>
                    </table>
                </div>
            )}
        </AdminLayout>
    );
};

export default Reports;
