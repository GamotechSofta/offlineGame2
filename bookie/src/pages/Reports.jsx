import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { API_BASE_URL, getBookieAuthHeaders } from '../utils/api';
import {
    FaChartLine,
    FaMoneyBillWave,
    FaCoins,
    FaChartBar,
    FaSyncAlt,
    FaCalendarAlt,
    FaChevronRight,
    FaHistory,
    FaTrophy,
    FaUsers,
    FaPrint,
} from 'react-icons/fa';

const PRESETS = [
    { id: 'today', label: 'Today', getRange: () => {
        const d = new Date();
        const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return { from, to: from };
    }},
    { id: 'yesterday', label: 'Yesterday', getRange: () => {
        const d = new Date(); d.setDate(d.getDate() - 1);
        const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return { from, to: from };
    }},
    { id: 'this_week', label: 'This Week', getRange: () => {
        const d = new Date(); const day = d.getDay();
        const sun = new Date(d); sun.setDate(d.getDate() - day);
        const sat = new Date(sun); sat.setDate(sun.getDate() + 6);
        const fmt = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
        return { from: fmt(sun), to: fmt(sat) };
    }},
    { id: 'this_month', label: 'This Month', getRange: () => {
        const d = new Date(); const y = d.getFullYear(), m = d.getMonth();
        const last = new Date(y, m + 1, 0);
        return { from: `${y}-${String(m + 1).padStart(2, '0')}-01`, to: `${y}-${String(m + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}` };
    }},
    { id: 'last_month', label: 'Last Month', getRange: () => {
        const d = new Date(); const y = d.getFullYear(), m = d.getMonth() - 1;
        const last = new Date(y, m + 1, 0);
        return { from: `${y}-${String(m + 1).padStart(2, '0')}-01`, to: `${y}-${String(m + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}` };
    }},
];

const formatCurrency = (n) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return '\u20B90';
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
    return `${a.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} \u2013 ${b.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
};

const QUICK_LINKS = [
    { to: '/revenue', label: 'Revenue', icon: FaMoneyBillWave, description: 'Your commission earnings & breakdown', color: 'emerald' },
    { to: '/bet-history', label: 'Bet History', icon: FaHistory, description: 'View all bets placed by your users' },
    { to: '/top-winners', label: 'Top Winners', icon: FaTrophy, description: 'Leaderboard of winning players' },
    { to: '/my-users', label: 'My Players', icon: FaUsers, description: 'Active players referred by you' },
];

const Reports = () => {
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState(() => {
        const d = new Date();
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return { startDate: today, endDate: today };
    });
    const [activePreset, setActivePreset] = useState('today');

    useEffect(() => {
        fetchReport();
    }, [dateRange]);

    const fetchReport = async () => {
        try {
            setLoading(true);
            const response = await fetch(
                `${API_BASE_URL}/reports?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
                { headers: getBookieAuthHeaders() }
            );
            const data = await response.json();
            if (data.success) setReport(data.data);
            else setReport(null);
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

    const handlePrint = () => {
        window.print();
    };

    return (
        <Layout title="Reports">
            <div className="space-y-4 sm:space-y-6 print:hidden">
                {/* Page header */}
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FaChartLine className="w-6 h-6 text-orange-500 shrink-0" />
                        Reports
                    </h1>
                    <p className="text-gray-400 text-xs sm:text-sm mt-1">Financial and betting summary for the selected period</p>
                </div>

                {/* Date filters */}
                <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
                    <div className="flex flex-wrap items-center gap-2 mb-2.5">
                        <FaCalendarAlt className="w-4 h-4 text-orange-500 shrink-0" />
                        <span className="text-sm font-medium text-gray-600">Period</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3">
                        {PRESETS.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => applyPreset(p.id)}
                                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                                    activePreset === p.id ? 'bg-orange-500 text-gray-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <input type="date" value={dateRange.startDate}
                            onChange={(e) => { setDateRange((r) => ({ ...r, startDate: e.target.value })); setActivePreset(''); }}
                            className="px-2 sm:px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-gray-800 text-xs sm:text-sm w-[130px] sm:w-auto"
                        />
                        <span className="text-gray-500 text-sm">to</span>
                        <input type="date" value={dateRange.endDate}
                            onChange={(e) => { setDateRange((r) => ({ ...r, endDate: e.target.value })); setActivePreset(''); }}
                            className="px-2 sm:px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-gray-800 text-xs sm:text-sm w-[130px] sm:w-auto"
                        />
                        <button type="button" onClick={fetchReport} disabled={loading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-amber-400 text-gray-800 font-semibold rounded-lg transition-colors disabled:opacity-50 text-xs sm:text-sm"
                        >
                            <FaSyncAlt className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                        <span className="text-gray-500 text-xs sm:text-sm hidden sm:inline">{formatRangeLabel(dateRange.startDate, dateRange.endDate)}</span>
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="bg-white rounded-xl h-24 animate-pulse border border-gray-200" />
                        ))}
                    </div>
                ) : report ? (
                    <>
                        {/* Summary strip */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                            <div className="bg-gradient-to-br from-green-50 to-green-600/5 rounded-xl p-4 sm:p-5 border border-green-200">
                                <div className="flex items-center justify-between">
                                    <div className="min-w-0">
                                        <p className="text-xs sm:text-sm font-medium text-gray-400">Total Revenue</p>
                                        <p className="text-lg sm:text-2xl font-bold text-green-600 mt-1 truncate">{formatCurrency(report.totalRevenue)}</p>
                                    </div>
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0 ml-2">
                                        <FaMoneyBillWave className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 rounded-xl p-4 sm:p-5 border border-red-500/30">
                                <div className="flex items-center justify-between">
                                    <div className="min-w-0">
                                        <p className="text-xs sm:text-sm font-medium text-gray-400">Total Payouts</p>
                                        <p className="text-lg sm:text-2xl font-bold text-red-500 mt-1 truncate">{formatCurrency(report.totalPayouts)}</p>
                                    </div>
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0 ml-2">
                                        <FaCoins className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" />
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gradient-to-br from-orange-50 to-amber-600/5 rounded-xl p-4 sm:p-5 border border-orange-200">
                                <div className="flex items-center justify-between">
                                    <div className="min-w-0">
                                        <p className="text-xs sm:text-sm font-medium text-gray-400">Net Profit</p>
                                        <p className={`text-lg sm:text-2xl font-bold mt-1 truncate ${report.netProfit >= 0 ? 'text-orange-500' : 'text-red-500'}`}>{formatCurrency(report.netProfit)}</p>
                                    </div>
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0 ml-2">
                                        <FaChartBar className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Betting stats */}
                        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
                            <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
                                <FaChartBar className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
                                Betting Summary
                            </h2>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                                <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
                                    <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider">Total Bets</p>
                                    <p className="text-lg sm:text-xl font-bold text-gray-800 mt-1">{formatNumber(report.totalBets)}</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
                                    <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider">Active Players</p>
                                    <p className="text-lg sm:text-xl font-bold text-gray-800 mt-1">{formatNumber(report.activeUsers)}</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-green-500/20">
                                    <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider">Winning Bets</p>
                                    <p className="text-lg sm:text-xl font-bold text-green-600 mt-1">{formatNumber(report.winningBets)}</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-red-500/20">
                                    <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider">Losing Bets</p>
                                    <p className="text-lg sm:text-xl font-bold text-red-500 mt-1">{formatNumber(report.losingBets)}</p>
                                </div>
                            </div>
                            <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200 flex flex-wrap items-center gap-3">
                                <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-50 rounded-lg">
                                    <span className="text-xs sm:text-sm text-gray-400">Win Rate</span>
                                    <span className="text-base sm:text-lg font-bold text-gray-800">{report.winRate}%</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={handlePrint}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                                >
                                    <FaPrint className="w-3.5 h-3.5" />
                                    Print
                                </button>
                            </div>
                        </div>

                        {/* Quick links */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            {QUICK_LINKS.map((item) => (
                                <Link
                                    key={item.to}
                                    to={item.to}
                                    className={`flex items-center justify-between p-3.5 sm:p-4 rounded-xl border transition-all group ${
                                        item.color === 'emerald'
                                            ? 'bg-gradient-to-r from-emerald-500/10 to-emerald-600/5 border-emerald-500/30 hover:border-emerald-400/50'
                                            : 'bg-gray-50 border-gray-200 hover:border-orange-200 hover:bg-gray-100/80'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                                            item.color === 'emerald'
                                                ? 'bg-orange-500/20 group-hover:bg-orange-500/30'
                                                : 'bg-orange-500/20 group-hover:bg-orange-500/30'
                                        }`}>
                                            <item.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${item.color === 'emerald' ? 'text-orange-500' : 'text-orange-500'}`} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className={`text-sm font-semibold transition-colors ${
                                                item.color === 'emerald' ? 'text-gray-800 group-hover:text-orange-500' : 'text-gray-800 group-hover:text-orange-500'
                                            }`}>{item.label}</p>
                                            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 truncate">{item.description}</p>
                                        </div>
                                    </div>
                                    <FaChevronRight className={`w-3.5 h-3.5 shrink-0 ml-2 transition-colors ${
                                        item.color === 'emerald' ? 'text-gray-600 group-hover:text-orange-500' : 'text-gray-600 group-hover:text-orange-500'
                                    }`} />
                                </Link>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="bg-white rounded-xl border border-gray-200 p-8 sm:p-12 text-center">
                        <FaChartLine className="w-12 h-12 sm:w-16 sm:h-16 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400 text-sm sm:text-lg">No report data available for this period</p>
                        <p className="text-gray-500 text-xs sm:text-sm mt-2">Try a different date range or refresh</p>
                        <button
                            type="button"
                            onClick={fetchReport}
                            className="mt-4 px-4 py-2 bg-orange-500 hover:bg-amber-400 text-gray-800 font-semibold rounded-lg transition-colors text-sm"
                        >
                            Refresh
                        </button>
                    </div>
                )}
            </div>

            {/* Print-only summary */}
            {report && (
                <div className="hidden print:block mt-8 p-6 bg-white text-gray-800 rounded-lg">
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
        </Layout>
    );
};

export default Reports;
