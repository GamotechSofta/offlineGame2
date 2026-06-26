import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { API_BASE_URL, getBookieAuthHeaders } from '../utils/api';
import { useLanguage } from '../context/LanguageContext';
import {
    FaMoneyBillWave,
    FaSyncAlt,
    FaCalendarAlt,
    FaChevronRight,
    FaUsers,
} from 'react-icons/fa';

const getPresets = (t) => [
    { id: 'all', label: t('all'), getRange: () => ({ from: '', to: '' }) },
    { id: 'today', label: t('today'), getRange: () => {
        const d = new Date();
        const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return { from, to: from };
    }},
    { id: 'yesterday', label: t('yesterday'), getRange: () => {
        const d = new Date(); d.setDate(d.getDate() - 1);
        const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return { from, to: from };
    }},
    { id: 'this_week', label: t('thisWeek'), getRange: () => {
        const d = new Date(); const day = d.getDay();
        const sun = new Date(d); sun.setDate(d.getDate() - day);
        const sat = new Date(sun); sat.setDate(sun.getDate() + 6);
        const fmt = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
        return { from: fmt(sun), to: fmt(sat) };
    }},
    { id: 'this_month', label: t('thisMonth'), getRange: () => {
        const d = new Date(); const y = d.getFullYear(), m = d.getMonth();
        const last = new Date(y, m + 1, 0);
        return { from: `${y}-${String(m + 1).padStart(2, '0')}-01`, to: `${y}-${String(m + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}` };
    }},
    { id: 'last_month', label: t('lastMonth'), getRange: () => {
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

const Revenue = () => {
    const { t } = useLanguage();
    const PRESETS = getPresets(t);
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState(() => {
        const d = new Date();
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return { startDate: today, endDate: today };
    });
    const [activePreset, setActivePreset] = useState('today');

    useEffect(() => { fetchRevenue(); }, [dateRange]);

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
        <Layout title="Commission">
            <div className="space-y-4 sm:space-y-5">
                {/* Header */}
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FaMoneyBillWave className="w-6 h-6 text-emerald-500 shrink-0" />
                        Commission
                    </h1>
                    <p className="text-gray-400 text-xs sm:text-sm mt-1">Your commission earnings from user bets</p>
                </div>

                {/* Date filters */}
                <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
                    <div className="flex flex-wrap items-center gap-2 mb-2.5">
                        <FaCalendarAlt className="w-4 h-4 text-sb-primary shrink-0" />
                        <span className="text-sm font-medium text-gray-600">Period</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3">
                        {PRESETS.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                            onClick={() => applyPreset(p.id)}
                            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                                activePreset === p.id ? 'bg-sb-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                        <button type="button" onClick={fetchRevenue} disabled={loading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sb-primary hover:bg-sb-primary-dark text-white font-semibold rounded-lg transition-colors disabled:opacity-50 text-xs sm:text-sm"
                        >
                            <FaSyncAlt className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="bg-white rounded-xl h-28 animate-pulse border border-gray-200" />
                        <div className="bg-white rounded-xl h-28 animate-pulse border border-gray-200" />
                        <div className="bg-white rounded-xl h-28 animate-pulse border border-gray-200" />
                        <div className="bg-white rounded-xl h-28 animate-pulse border border-gray-200" />
                    </div>
                ) : data ? (
                    <>
                        {/* Top KPI cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="bg-white rounded-xl border border-gray-200 p-4">
                                <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Total Sale</p>
                                <p className="mt-2 text-2xl font-bold text-gray-800">{formatCurrency(data.totalBetAmount)}</p>
                                <p className="mt-1 text-xs text-gray-500">Total bet amount</p>
                            </div>
                            <div className="bg-white rounded-xl border border-gray-200 p-4">
                                <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Payouts</p>
                                <p className="mt-2 text-2xl font-bold text-red-500">{formatCurrency(data.totalPayouts || 0)}</p>
                                <p className="mt-1 text-xs text-gray-500">Winner payouts</p>
                            </div>
                            <div className="bg-white rounded-xl border border-gray-200 p-4">
                                <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Gross Profit</p>
                                <p className="mt-2 text-2xl font-bold text-emerald-600">{formatCurrency(data.grossProfit ?? (data.totalBetAmount - (data.totalPayouts || 0)))}</p>
                                <p className="mt-1 text-xs text-gray-500">Sale minus payouts</p>
                            </div>
                            <div className="bg-sb-primary rounded-xl border border-sb-primary p-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs uppercase tracking-wide text-blue-100 font-semibold">Your Commission</p>
                                    <span className="text-[11px] bg-white/20 text-white px-2 py-0.5 rounded-full">
                                        {data.commissionPercentage ?? data.parentCommissionPercentage ?? 0}%
                                    </span>
                                </div>
                                <p className="mt-2 text-2xl font-bold text-white">{formatCurrency(data.bookieRevenue)}</p>
                                <p className="mt-1 text-xs text-blue-100">Actual (profit-capped) for period</p>
                            </div>
                        </div>

                        {/* Details panel */}
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                                <h2 className="text-sm font-semibold text-gray-700">Commission Summary</h2>
                            </div>
                            <div className="divide-y divide-gray-200">
                                <div className="px-4 py-3 flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Gross Profit</span>
                                    <span className="text-sm font-semibold text-emerald-600">
                                        {formatCurrency(data.grossProfit ?? (data.totalBetAmount - (data.totalPayouts || 0)))}
                                    </span>
                                </div>
                                <div className="px-4 py-3 flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Calculated at {data.commissionPercentage ?? data.parentCommissionPercentage ?? 0}%</span>
                                    <span className="text-sm font-semibold text-gray-800">
                                        {formatCurrency(data.calculatedCommission ?? data.bookieRevenue)}
                                    </span>
                                </div>
                                <div className="px-4 py-3 flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Actual Commission</span>
                                    <span className="text-sm font-semibold text-sb-primary">
                                        {formatCurrency(data.bookieRevenue)}
                                    </span>
                                </div>
                                {data.calculatedCommission != null && data.calculatedCommission !== data.bookieRevenue && (
                                    <div className="px-4 py-3 bg-amber-50 text-xs text-amber-800">
                                        Commission capped at gross profit — calculated {formatCurrency(data.calculatedCommission)} exceeds available profit.
                                    </div>
                                )}
                                <div className="px-4 py-3 flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Total Bets</span>
                                    <span className="text-sm font-semibold text-gray-800">{formatNumber(data.totalBets)} bets</span>
                                </div>
                                <div className="px-4 py-3 flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Win/Loss Bets</span>
                                    <span className="text-sm font-semibold text-gray-800">
                                        {formatNumber(data.winningBets || 0)} W / {formatNumber(data.losingBets || 0)} L
                                    </span>
                                </div>
                                <div className="px-4 py-3 flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Paid (all-time)</span>
                                    <span className="text-sm font-semibold text-green-600">
                                        {formatCurrency(data.paidAmount || 0)}
                                    </span>
                                </div>
                                <div className="px-4 py-3 flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Pending (all-time)</span>
                                    <span className="text-sm font-semibold text-orange-500">
                                        {formatCurrency(data.pendingAmount || 0)}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => navigate('/my-users')}
                                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-cyan-50 transition-colors"
                                >
                                    <span className="inline-flex items-center gap-2 text-sm font-medium text-cyan-700">
                                        <FaUsers className="w-3.5 h-3.5" />
                                        My Users
                                    </span>
                                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
                                        {formatNumber(data.totalUsers)} players
                                        <FaChevronRight className="w-3 h-3 text-gray-500" />
                                    </span>
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="bg-white rounded-xl border border-gray-200 p-8 sm:p-12 text-center">
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
