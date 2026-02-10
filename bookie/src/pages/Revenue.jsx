import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { API_BASE_URL, getBookieAuthHeaders } from '../utils/api';
import {
    FaMoneyBillWave,
    FaCoins,
    FaPercentage,
    FaChartLine,
    FaUsers,
    FaReceipt,
    FaSyncAlt,
    FaCalendarAlt,
    FaInfoCircle,
} from 'react-icons/fa';

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
        const sun = new Date(d); sun.setDate(d.getDate() - day);
        const sat = new Date(sun); sat.setDate(sun.getDate() + 6);
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
    if (!Number.isFinite(num)) return '\u20B90';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(num);
};

const formatNumber = (n) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return '0';
    return new Intl.NumberFormat('en-IN').format(num);
};

const Revenue = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState(() => {
        const d = new Date();
        const y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
        const today = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return { startDate: today, endDate: today };
    });
    const [activePreset, setActivePreset] = useState('today');

    useEffect(() => {
        fetchRevenue();
    }, [dateRange]);

    const fetchRevenue = async () => {
        try {
            setLoading(true);
            const response = await fetch(
                `${API_BASE_URL}/reports/revenue?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
                { headers: getBookieAuthHeaders() }
            );
            const result = await response.json();
            if (result.success) setData(result.data);
            else setData(null);
        } catch (err) {
            console.error('Error fetching revenue:', err);
            setData(null);
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

    return (
        <Layout title="Revenue">
            <div className="space-y-4 sm:space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                        <FaMoneyBillWave className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-500 shrink-0" />
                        My Revenue
                    </h1>
                    <p className="text-gray-400 text-xs sm:text-sm mt-1">Your commission earnings from user bets</p>
                </div>

                {/* Date filters */}
                <div className="bg-gray-800/80 rounded-xl border border-gray-700/80 p-3 sm:p-5">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                        <FaCalendarAlt className="w-4 h-4 text-yellow-500 shrink-0" />
                        <span className="text-sm font-medium text-gray-300">Period</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                        {PRESETS.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => applyPreset(p.id)}
                                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                                    activePreset === p.id
                                        ? 'bg-yellow-500 text-black'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <input
                            type="date"
                            value={dateRange.startDate}
                            onChange={(e) => { setDateRange((r) => ({ ...r, startDate: e.target.value })); setActivePreset(''); }}
                            className="px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-xs sm:text-sm focus:ring-2 focus:ring-yellow-500 focus:border-transparent w-[130px] sm:w-auto"
                        />
                        <span className="text-gray-500 text-sm">to</span>
                        <input
                            type="date"
                            value={dateRange.endDate}
                            onChange={(e) => { setDateRange((r) => ({ ...r, endDate: e.target.value })); setActivePreset(''); }}
                            className="px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-xs sm:text-sm focus:ring-2 focus:ring-yellow-500 focus:border-transparent w-[130px] sm:w-auto"
                        />
                        <button
                            type="button"
                            onClick={fetchRevenue}
                            disabled={loading}
                            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-semibold rounded-lg transition-colors disabled:opacity-50 text-xs sm:text-sm"
                        >
                            <FaSyncAlt className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="space-y-4">
                        <div className="bg-gray-800/60 rounded-2xl h-32 animate-pulse border border-gray-700/50" />
                        <div className="grid grid-cols-2 gap-3">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="bg-gray-800/60 rounded-xl h-20 animate-pulse border border-gray-700/50" />
                            ))}
                        </div>
                    </div>
                ) : data ? (
                    <>
                        {/* Hero - Your Revenue */}
                        <div className="bg-gradient-to-br from-emerald-500/15 to-emerald-700/5 rounded-2xl p-4 sm:p-6 md:p-8 border border-emerald-500/30 relative overflow-hidden">
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-xs sm:text-sm font-medium text-emerald-300 uppercase tracking-wider">Your Revenue</p>
                                    <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-emerald-400 mt-1 sm:mt-2 truncate">
                                        {formatCurrency(data.bookieRevenue)}
                                    </p>
                                    <p className="text-xs sm:text-sm text-gray-400 mt-1 sm:mt-2">
                                        <span className="text-emerald-300 font-medium">{data.commissionPercentage}%</span> of {formatCurrency(data.totalBetAmount)} total bets
                                    </p>
                                </div>
                                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                                    <FaMoneyBillWave className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-400" />
                                </div>
                            </div>
                        </div>

                        {/* Stats Grid - 2 cols always */}
                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                            <div className="bg-gray-800/80 rounded-xl p-3 sm:p-4 border border-gray-700/60 relative overflow-hidden">
                                <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500" />
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wider">Total Bets</p>
                                        <p className="text-sm sm:text-lg lg:text-xl font-bold text-white mt-1 truncate">{formatCurrency(data.totalBetAmount)}</p>
                                    </div>
                                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                                        <FaReceipt className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-800/80 rounded-xl p-3 sm:p-4 border border-gray-700/60 relative overflow-hidden">
                                <div className="absolute top-0 left-0 right-0 h-0.5 bg-red-500" />
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wider">Payouts</p>
                                        <p className="text-sm sm:text-lg lg:text-xl font-bold text-red-400 mt-1 truncate">{formatCurrency(data.totalPayouts)}</p>
                                    </div>
                                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
                                        <FaCoins className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-800/80 rounded-xl p-3 sm:p-4 border border-gray-700/60 relative overflow-hidden">
                                <div className="absolute top-0 left-0 right-0 h-0.5 bg-yellow-500" />
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wider">Commission</p>
                                        <p className="text-sm sm:text-lg lg:text-xl font-bold text-yellow-400 mt-1">{data.commissionPercentage}%</p>
                                    </div>
                                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-yellow-500/15 flex items-center justify-center shrink-0">
                                        <FaPercentage className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-400" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-800/80 rounded-xl p-3 sm:p-4 border border-gray-700/60 relative overflow-hidden">
                                <div className="absolute top-0 left-0 right-0 h-0.5 bg-purple-500" />
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wider">Bet Count</p>
                                        <p className="text-sm sm:text-lg lg:text-xl font-bold text-white mt-1">{formatNumber(data.totalBets)}</p>
                                    </div>
                                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-purple-500/15 flex items-center justify-center shrink-0">
                                        <FaChartLine className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* My Users */}
                        <div className="bg-gray-800/80 rounded-xl p-3 sm:p-4 border border-gray-700/60 relative overflow-hidden">
                            <div className="absolute top-0 left-0 right-0 h-0.5 bg-cyan-500" />
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-cyan-500/15 flex items-center justify-center shrink-0">
                                        <FaUsers className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wider">My Users</p>
                                        <p className="text-sm sm:text-lg font-bold text-white">{formatNumber(data.totalUsers)} players</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* How it works */}
                        <div className="bg-gray-800/50 rounded-xl border border-gray-700/40 p-3 sm:p-4">
                            <h3 className="text-xs sm:text-sm font-semibold text-gray-300 flex items-center gap-2 mb-2">
                                <FaInfoCircle className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                                How Revenue Works
                            </h3>
                            <div className="text-xs sm:text-sm text-gray-400 space-y-1">
                                <p>
                                    You earn <span className="text-yellow-400 font-medium">{data.commissionPercentage}%</span> of every bet placed by your users.
                                </p>
                                <p className="text-gray-500">
                                    {formatCurrency(data.totalBetAmount)} x {data.commissionPercentage}% = <span className="text-emerald-400 font-medium">{formatCurrency(data.bookieRevenue)}</span>
                                </p>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="bg-gray-800/60 rounded-xl border border-gray-700/80 p-8 sm:p-12 text-center">
                        <FaMoneyBillWave className="w-12 h-12 sm:w-16 sm:h-16 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400 text-sm sm:text-lg">No revenue data available</p>
                        <p className="text-gray-500 text-xs sm:text-sm mt-2">Try a different date range or refresh</p>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default Revenue;
