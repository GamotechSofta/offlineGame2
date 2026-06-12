import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { API_BASE_URL, getBookieAuthHeaders } from '../utils/api';
import { getIstTodayKey } from '../utils/istDate';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
    FaChartLine,
    FaMoneyBillWave,
    FaChartBar,
    FaSyncAlt,
    FaWallet,
    FaCreditCard,
    FaUserFriends,
    FaLifeRing,
    FaClipboardList,
    FaArrowRight,
    FaExclamationTriangle,
    FaDice,
} from 'react-icons/fa';

const LOTTERY_LIVE_REFRESH_MS = 10000;

const getPresets = (t) => [
    { id: 'all', label: t('all'), getRange: () => {
        return { from: null, to: null };
    }},
    { id: 'today', label: t('today'), getRange: () => {
        const from = getIstTodayKey();
        return { from, to: from };
    }},
    { id: 'yesterday', label: t('yesterday'), getRange: () => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
        const from = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return { from, to: from };
    }},
    { id: 'this_week', label: t('thisWeek'), getRange: () => {
        const d = new Date();
        const day = d.getDay();
        const sun = new Date(d);
        sun.setDate(d.getDate() - day);
        const sat = new Date(sun);
        sat.setDate(sun.getDate() + 6);
        const fmt = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
        return { from: fmt(sun), to: fmt(sat) };
    }},
    { id: 'last_week', label: t('lastWeek'), getRange: () => {
        const d = new Date();
        const day = d.getDay();
        const sun = new Date(d);
        sun.setDate(d.getDate() - day - 7);
        const sat = new Date(sun);
        sat.setDate(sun.getDate() + 6);
        const fmt = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
        return { from: fmt(sun), to: fmt(sat) };
    }},
    { id: 'this_month', label: t('thisMonth'), getRange: () => {
        const d = new Date();
        const y = d.getFullYear(), m = d.getMonth();
        const last = new Date(y, m + 1, 0);
        const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
        const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
        return { from, to };
    }},
    { id: 'last_month', label: t('lastMonth'), getRange: () => {
        const d = new Date();
        const y = d.getFullYear(), m = d.getMonth() - 1;
        const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
        const last = new Date(y, m + 1, 0);
        const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
        return { from, to };
    }},
];

const formatRangeLabel = (from, to, t) => {
    if (!from || !to) return t('today');
    if (from === to) {
        const d = new Date(from + 'T12:00:00');
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    const a = new Date(from + 'T12:00:00');
    const b = new Date(to + 'T12:00:00');
    return `${a.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${b.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
};

/** Section card wrapper */
const SectionCard = ({ title, description, icon: Icon, children, linkTo, linkLabel, t }) => (
    <div className="bg-white rounded-xl p-5 sm:p-6 border border-gray-200 hover:border-gray-200/80 transition-all">
        <div className="flex items-start justify-between mb-4">
            <div>
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    {Icon && <Icon className="w-5 h-5 text-sb-primary" />}
                    {title}
                </h3>
                {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
            </div>
            {linkTo && (
                <Link to={linkTo} className="text-xs font-medium text-sb-primary hover:text-sb-primary-dark flex items-center gap-1">
                    {linkLabel || t('view')} <FaArrowRight className="w-3 h-3" />
                </Link>
            )}
        </div>
        {children}
    </div>
);

/** Stat row */
const StatRow = ({ label, value, subValue, colorClass = 'text-gray-800' }) => (
    <div className="flex justify-between items-center py-2.5 border-b border-gray-200 last:border-0">
        <span className="text-sm text-gray-500">{label}</span>
        <div className="text-right">
            <span className={`font-semibold font-mono ${colorClass}`}>{value}</span>
            {subValue && <span className="text-xs text-gray-500 ml-2">{subValue}</span>}
        </div>
    </div>
);

/** Skeleton placeholder */
const SkeletonCard = () => (
    <div className="bg-white rounded-xl p-5 border border-gray-200 animate-pulse">
        <div className="h-3 w-24 bg-gray-100 rounded mb-3" />
        <div className="h-7 w-32 bg-gray-100 rounded mb-2" />
        <div className="h-3 w-40 bg-gray-100 rounded" />
    </div>
);

const Dashboard = () => {
    const { t } = useLanguage();
    const { updateBookie } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [datePreset, setDatePreset] = useState('today');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [customMode, setCustomMode] = useState(false);
    const [customOpen, setCustomOpen] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [topWalletPlayers, setTopWalletPlayers] = useState([]);
    const [commissionSummary, setCommissionSummary] = useState(null);
    const [lotteryStats, setLotteryStats] = useState({
        twoD: { current: null, latest: null, nextUpcoming: null, allSlots: null, error: '' },
        threeD: { current: null, latest: null, nextUpcoming: null, allSlots: null, error: '' },
    });

    const PRESETS = getPresets(t);

    const getFromTo = () => {
        if (customMode && customFrom && customTo) return { from: customFrom, to: customTo };
        const preset = PRESETS.find((p) => p.id === datePreset);
        const range = preset ? preset.getRange() : PRESETS[0].getRange();
        if (range.from === null && range.to === null) {
            return { from: null, to: null };
        }
        return range;
    };

    const refreshBookieProfile = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/super-bookie/profile`, { headers: getBookieAuthHeaders() });
            const data = await response.json();
            if (data.success && data.data) {
                updateBookie(data.data);
            }
        } catch (err) {
            console.error('Failed to refresh bookie profile:', err);
        }
    };

    useEffect(() => {
        fetchDashboardStats();
        refreshBookieProfile();
    }, []);

    const fetchLotteryModeStats = async (mode, rangeOverride) => {
        const modeKey = mode === '2d' ? 'twoD' : 'threeD';
        const nonce = Date.now();
        const headers = getBookieAuthHeaders();
        const currentEndpoint = `${API_BASE_URL}/admin/lottery${mode}/current-slot?_=${nonce}`;
        const effectiveRange = rangeOverride || getFromTo();
        const aggParams = new URLSearchParams();
        if (effectiveRange?.from) aggParams.set('dateFrom', effectiveRange.from);
        if (effectiveRange?.to) aggParams.set('dateTo', effectiveRange.to);
        aggParams.set('_', String(nonce));

        const [currentRes, aggRes] = await Promise.all([
            fetch(currentEndpoint, { headers, cache: 'no-store' }),
            fetch(`${API_BASE_URL}/admin/lottery${mode}/aggregate-stats?${aggParams.toString()}`, {
                headers,
                cache: 'no-store',
            }),
        ]);
        const [currentJson, aggJson] = await Promise.all([currentRes.json(), aggRes.json()]);
        if (!currentJson?.success) {
            throw new Error(currentJson?.message || `Failed to load ${mode.toUpperCase()} current slot`);
        }
        const currentSummary = currentJson?.data?.summary || {};
        const aggregate = aggJson?.success ? (aggJson?.data || {}) : {};
        const aggregateHasSignal = (
            Number(aggregate?.slotCount || 0) > 0 ||
            Number(aggregate?.totalTickets || 0) > 0 ||
            Number(aggregate?.totalBets || 0) > 0 ||
            Number(aggregate?.totalStake || 0) > 0 ||
            Number(aggregate?.totalPayout || 0) > 0
        );
        const currentHasSignal = (
            Number(currentSummary?.totalTickets || 0) > 0 ||
            Number(currentSummary?.totalBets || 0) > 0 ||
            Number(currentSummary?.revenue || 0) > 0 ||
            Number(currentSummary?.winnerPayout || 0) > 0
        );
        const allSlots = aggregateHasSignal ? {
            tickets: Number(aggregate?.totalTickets || 0),
            bets: Number(aggregate?.totalBets || aggregate?.totalTickets || 0),
            revenue: Number(aggregate?.totalStake || 0),
            payout: Number(aggregate?.totalPayout || 0),
            net: Number(aggregate?.adminNet || 0),
        } : currentHasSignal ? {
            tickets: Number(currentSummary?.totalTickets || 0),
            bets: Number(currentSummary?.totalBets || currentSummary?.totalTickets || 0),
            revenue: Number(currentSummary?.revenue || 0),
            payout: Number(currentSummary?.winnerPayout || 0),
            net: Number(currentSummary?.amountRemaining || 0),
        } : {
            tickets: 0,
            bets: 0,
            revenue: 0,
            payout: 0,
            net: 0,
        };

        return {
            modeKey,
            current: currentJson?.data || null,
            latest: null,
            nextUpcoming: null,
            allSlots,
            error: '',
        };
    };

    const fetchLotteryDashboardStats = async (rangeOverride) => {
        try {
            const [twoD, threeD] = await Promise.all([
                fetchLotteryModeStats('2d', rangeOverride),
                fetchLotteryModeStats('3d', rangeOverride),
            ]);
            setLotteryStats({
                twoD: twoD || { current: null, latest: null, nextUpcoming: null, allSlots: null, error: '' },
                threeD: threeD || { current: null, latest: null, nextUpcoming: null, allSlots: null, error: '' },
            });
        } catch (err) {
            const message = err?.message || 'Failed to load lottery stats';
            setLotteryStats((prev) => ({
                twoD: prev.twoD.current || prev.twoD.latest ? prev.twoD : { ...prev.twoD, error: message },
                threeD: prev.threeD.current || prev.threeD.latest ? prev.threeD : { ...prev.threeD, error: message },
            }));
        }
    };

    const fetchCommissionSummary = async (rangeOverride) => {
        try {
            const { from, to } = rangeOverride || getFromTo();
            const params = new URLSearchParams();
            if (from && to) {
                params.set('startDate', from);
                params.set('endDate', to);
            }
            const query = params.toString();
            const res = await fetch(
                `${API_BASE_URL}/daily-commission/my-summary${query ? `?${query}` : ''}`,
                { headers: getBookieAuthHeaders() },
            );
            const data = await res.json();
            setCommissionSummary(data.success ? data.data : null);
        } catch {
            setCommissionSummary(null);
        }
    };

    const fetchDashboardStats = async (rangeOverride, options = {}) => {
        const isRefresh = options.refresh === true;
        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);
            setError('');
            const { from, to } = rangeOverride || getFromTo();
            const params = new URLSearchParams();
            // Only add date params if they are provided (not null for "all" option)
            if (from && to) { 
                params.set('from', from); 
                params.set('to', to); 
            }
            if (isRefresh) params.set('_', String(Date.now()));
            const query = params.toString();
            const url = `${API_BASE_URL}/dashboard/stats${query ? `?${query}` : ''}`;
            const headers = getBookieAuthHeaders();
            const [statsRes, usersRes] = await Promise.all([
                fetch(url, {
                    headers,
                    cache: isRefresh ? 'no-store' : 'default',
                }),
                fetch(`${API_BASE_URL}/users`, {
                    headers,
                    cache: isRefresh ? 'no-store' : 'default',
                }),
            ]);
            const [statsData, usersData] = await Promise.all([statsRes.json(), usersRes.json()]);
            if (statsData.success) {
                setStats(statsData.data);
                const allUsers = usersData?.success && Array.isArray(usersData?.data) ? usersData.data : [];
                const topPlayers = [...allUsers]
                    .sort((a, b) => (Number(b?.walletBalance ?? 0) || 0) - (Number(a?.walletBalance ?? 0) || 0))
                    .slice(0, 3);
                setTopWalletPlayers(topPlayers);
                void fetchCommissionSummary(rangeOverride);
                void fetchLotteryDashboardStats(rangeOverride);
            }
            else setError(statsData.message || 'Failed to fetch dashboard stats');
        } catch (err) {
            setError(t('error') + ': Network error. Please check if the server is running.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => fetchDashboardStats(undefined, { refresh: true });
    const handlePresetSelect = (presetId) => {
        setDatePreset(presetId);
        setCustomMode(false);
        setCustomOpen(false);
        const preset = PRESETS.find((p) => p.id === presetId);
        const range = preset ? preset.getRange() : PRESETS[0].getRange();
        fetchDashboardStats(range);
    };
    const handleCustomToggle = () => { setCustomMode(true); setCustomOpen((o) => !o); };
    const handleCustomApply = () => {
        if (!customFrom || !customTo) return;
        if (new Date(customFrom) > new Date(customTo)) return;
        setCustomMode(true);
        setCustomOpen(false);
        fetchDashboardStats({ from: customFrom, to: customTo });
    };

    useEffect(() => {
        if (loading) return undefined;
        const timer = setInterval(() => {
            if (document.visibilityState !== 'visible') return;
            const range = customMode && customFrom && customTo
                ? { from: customFrom, to: customTo }
                : getFromTo();
            fetchLotteryDashboardStats(range);
        }, LOTTERY_LIVE_REFRESH_MS);

        return () => clearInterval(timer);
    }, [loading, customMode, customFrom, customTo, datePreset]);

    const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
    const formatNumber = (value) => Number(value || 0).toLocaleString('en-IN');
    const formatDrawTime = (label) => {
        if (!label) return '-';
        return label;
    };
    const formatSlotWindow = (slot) => {
        const slotStartIso = String(slot?.slotStartIso || '').trim();
        if (!slotStartIso) return formatDrawTime(slot?.drawLabelEnd);
        const startDate = new Date(slotStartIso);
        if (Number.isNaN(startDate.getTime())) return formatDrawTime(slot?.drawLabelEnd);
        const start = new Intl.DateTimeFormat('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        }).format(startDate).replace(/\s?(am|pm)$/i, (m) => ` ${m.trim().toUpperCase()}`);
        const endFallback = new Date(startDate.getTime() + (15 * 60 * 1000));
        const end = String(slot?.drawLabelEnd || '').trim() || new Intl.DateTimeFormat('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        }).format(endFallback).replace(/\s?(am|pm)$/i, (m) => ` ${m.trim().toUpperCase()}`);
        return `${start} - ${end}`;
    };

    const pendingPayments = stats?.payments?.pending || 0;
    const pendingDeposits = stats?.payments?.pendingDeposits ?? stats?.payments?.pending ?? 0;
    const pendingWithdrawals = stats?.payments?.pendingWithdrawals ?? 0;
    const hasActionRequired = pendingPayments > 0;

    const { from: rangeFrom, to: rangeTo } = getFromTo();
    const hasDateFilter = Boolean(rangeFrom && rangeTo);
    const totalDeposit = Number(stats?.payments?.totalDeposits || 0);
    const totalWithdrawal = Number(stats?.payments?.totalWithdrawals || 0);
    const totalCommissionToGive = hasDateFilter
        ? Number(commissionSummary?.bookieRevenue ?? commissionSummary?.periodParentCommission ?? 0)
        : Number(commissionSummary?.allTimeParentCommission ?? 0);
    const dashboardTotalRevenue = totalDeposit - totalWithdrawal - totalCommissionToGive;

    if (loading) {
        return (
            <Layout title={t('dashboard')}>
                <div className="mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">{t('dashboardOverview')}</h1>
                    <p className="text-gray-400 text-sm mt-2">{t('loading')}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
                </div>
            </Layout>
        );
    }

    if (error) {
        return (
            <Layout title={t('dashboard')}>
                <div className="flex flex-col items-center justify-center min-h-[50vh]">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                        <FaExclamationTriangle className="w-8 h-8 text-red-500" />
                    </div>
                    <p className="text-red-500 text-lg font-medium mb-2">{error}</p>
                    <button onClick={() => fetchDashboardStats()} className="mt-4 px-6 py-2 bg-sb-primary hover:bg-sb-primary-dark text-white font-semibold rounded-xl">
                        {t('retry')}
                    </button>
                </div>
            </Layout>
        );
    }

    const displayLabel = customMode && customFrom && customTo 
        ? formatRangeLabel(customFrom, customTo, t) 
        : (PRESETS.find((p) => p.id === datePreset)?.label || t('all'));

    return (
        <Layout title={t('dashboard')}>
            {/* Header */}
            <div className="mb-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-sb-primary/20 flex items-center justify-center">
                                <FaChartLine className="w-5 h-5 text-sb-primary" />
                            </span>
                            {t('dashboardOverview')}
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">{t('dashboardDescription')}</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-sb-primary-dark/20 border border-gray-200 hover:border-orange-300 text-gray-600 hover:text-sb-primary transition-all disabled:opacity-60 text-sm font-medium"
                    >
                        <FaSyncAlt className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        {t('refresh')}
                    </button>
                </div>

                {/* Date Filter */}
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">{t('dateRange')}</p>
                    <div className="flex flex-wrap items-center gap-2">
                        {PRESETS.map((p) => {
                            const isActive = !customMode && datePreset === p.id;
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => handlePresetSelect(p.id)}
                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${isActive ? 'bg-sb-primary text-white' : 'bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200'}`}
                                >
                                    {p.label}
                                </button>
                            );
                        })}
                        <span className="text-xs text-gray-400 px-2">{t('showingDataFor')} <span className="text-sb-primary font-medium">{displayLabel}</span></span>
                        <button
                            type="button"
                            onClick={handleCustomToggle}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold ${customMode ? 'bg-sb-primary text-white' : 'bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200'}`}
                        >
                            {t('custom')}
                        </button>
                        {customOpen && (
                            <div className="flex flex-wrap items-end gap-3 w-full mt-3 p-3 rounded-lg bg-white border border-gray-200">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">{t('from')}</label>
                                    <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="px-3 py-2 rounded-lg bg-gray-100 border border-gray-200 text-sm text-gray-800" />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">{t('to')}</label>
                                    <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="px-3 py-2 rounded-lg bg-gray-100 border border-gray-200 text-sm text-gray-800" />
                                </div>
                                <button type="button" onClick={handleCustomApply} className="px-4 py-2 rounded-lg bg-sb-primary text-white font-semibold text-sm">
                                    {t('apply')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Action Required */}
            {hasActionRequired && (
                <div className="mb-6 p-4 rounded-xl bg-sb-primary/10 border border-sb-primary/20">
                    <h3 className="text-sm font-semibold text-sb-primary flex items-center gap-2 mb-3">
                        <FaExclamationTriangle className="w-4 h-4" />
                        {t('actionRequired')}
                    </h3>
                    <div className="flex flex-wrap gap-3">
                        {pendingPayments > 0 && (
                            <Link to="/payments" className="px-4 py-2 rounded-lg bg-sb-primary hover:bg-sb-primary-dark text-white font-medium text-sm">
                                {pendingPayments} {pendingPayments !== 1 ? t('pendingPayments') : t('pendingPayment')} →
                            </Link>
                        )}
                        {/*
                          Help Desk is handled via the super-admin Help Desk tab.
                          Bookie dashboard should not show help desk warnings here.
                        */}
                    </div>
                </div>
            )}

            {/* Primary KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-green-50 to-transparent rounded-xl p-5 border border-green-200">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('totalDeposit')}</p>
                    <p className="text-2xl font-bold text-green-600 font-mono">{formatCurrency(totalDeposit)}</p>
                    <p className="text-xs text-gray-500 mt-1">{hasDateFilter ? t('selectedPeriod') : t('all')}</p>
                </div>
                <div className="bg-gradient-to-br from-red-50 to-transparent rounded-xl p-5 border border-red-200">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('totalWithdrawal')}</p>
                    <p className="text-2xl font-bold text-red-600 font-mono">{formatCurrency(totalWithdrawal)}</p>
                    <p className="text-xs text-gray-500 mt-1">{hasDateFilter ? t('selectedPeriod') : t('all')}</p>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-transparent rounded-xl p-5 border border-orange-200">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('totalCommissionToGive')}</p>
                    <p className="text-2xl font-bold text-orange-600 font-mono">{formatCurrency(totalCommissionToGive)}</p>
                    <p className="text-xs text-gray-500 mt-1">
                        {hasDateFilter ? t('selectedPeriod') : t('all')}
                        {commissionSummary?.parentCommissionPercentage
                            ? ` · ${commissionSummary.parentCommissionPercentage}%`
                            : ''}
                    </p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-transparent rounded-xl p-5 border border-blue-200">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('totalRevenue')}</p>
                    <p className={`text-2xl font-bold font-mono ${dashboardTotalRevenue >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {formatCurrency(dashboardTotalRevenue)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{t('totalRevenueFormula')}</p>
                </div>
            </div>

            {/* Detailed Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5 mb-6">
                {/* Revenue Details */}
                <SectionCard title={t('revenueAndPayouts')} description={t('selectedPeriod')} icon={FaMoneyBillWave} linkTo="/reports" linkLabel={t('report')} t={t}>
                    <StatRow label={t('totalRevenue')} value={formatCurrency(stats?.revenue?.total)} colorClass="text-green-600" />
                    <StatRow label={t('totalPayouts')} value={formatCurrency(stats?.revenue?.payouts)} colorClass="text-red-500" />
                    <StatRow label={t('netProfit')} value={formatCurrency(stats?.revenue?.netProfit)} colorClass="text-blue-600" />
                </SectionCard>

                {/* Players */}
                <SectionCard title={t('players')} description={t('allTimeCounts')} icon={FaUserFriends} linkTo="/my-users" linkLabel={t('allPlayers')} t={t}>
                    <StatRow label={t('totalPlayers')} value={stats?.users?.total ?? 0} />
                    <StatRow label={t('activePlayers')} value={stats?.users?.active ?? 0} colorClass="text-green-600" />
                    <StatRow label={t('newInPeriod')} value={stats?.users?.newToday ?? 0} colorClass="text-sb-primary" />
                </SectionCard>

                {/* Bets */}
                <SectionCard title={t('bets')} description={t('selectedPeriod')} icon={FaChartBar} linkTo="/bet-history" linkLabel={t('betHistory')} t={t}>
                    <StatRow label={t('totalBets')} value={stats?.bets?.total ?? 0} />
                    <StatRow label={t('winningBets')} value={stats?.bets?.winning ?? 0} colorClass="text-green-600" />
                    <StatRow label={t('losingBets')} value={stats?.bets?.losing ?? 0} colorClass="text-red-500" />
                    <StatRow label={t('pendingBets')} value={stats?.bets?.pending ?? 0} colorClass="text-sb-primary" />
                    <StatRow label={t('winRate')} value={`${stats?.bets?.winRate ?? 0}%`} />
                </SectionCard>

                {/* Payments */}
                <SectionCard title={t('payments')} description={t('depositsAndWithdrawals')} icon={FaCreditCard} linkTo="/payments" linkLabel={t('managePayments')} t={t}>
                    <StatRow label={t('depositsPeriod')} value={formatCurrency(stats?.payments?.totalDeposits)} colorClass="text-green-600" />
                    <StatRow label={t('withdrawalsPeriod')} value={formatCurrency(stats?.payments?.totalWithdrawals)} colorClass="text-red-500" />
                    <StatRow label={t('pendingDeposits')} value={pendingDeposits} colorClass="text-sb-primary" />
                    <StatRow label={t('pendingWithdrawals')} value={pendingWithdrawals} colorClass="text-sb-primary" />
                    <StatRow label={t('totalPending')} value={pendingPayments} colorClass="text-sb-primary" />
                </SectionCard>

                {/* Wallet */}
                <SectionCard title={t('walletBalance')} description="Top 3 players with highest wallet balance" icon={FaWallet} linkTo="/my-users" linkLabel={t('allPlayers')} t={t}>
                    {topWalletPlayers.length > 0 ? (
                        topWalletPlayers.map((player, idx) => (
                            <StatRow
                                key={player?._id || `${player?.username || 'player'}-${idx}`}
                                label={`#${idx + 1} ${player?.username || player?.phone || 'Player'}`}
                                value={formatCurrency(Number(player?.walletBalance ?? 0) || 0)}
                                colorClass={idx === 0 ? 'text-green-600' : idx === 1 ? 'text-blue-600' : 'text-purple-600'}
                            />
                        ))
                    ) : (
                        <p className="text-sm text-gray-500 py-2">No players found.</p>
                    )}
                </SectionCard>

                {/* Help Desk (super admin only) */}
            </div>

            {/* Revenue Summary */}
            <div className="bg-white rounded-xl p-5 border border-gray-200 mb-6">
                <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <FaMoneyBillWave className="w-4 h-4 text-sb-primary" />
                    {t('revenueSummary')}
                </h3>
                <p className="text-xs text-gray-500 mb-4">{t('totalRevenueInRange')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <p className="text-gray-500 text-sm mb-1">{t('totalRevenue')}</p>
                        <p className="text-xl font-bold text-green-600 font-mono">{formatCurrency(stats?.revenue?.total)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <p className="text-gray-500 text-sm mb-1">{t('totalPayouts')}</p>
                        <p className="text-xl font-bold text-red-500 font-mono">{formatCurrency(stats?.revenue?.payouts)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <p className="text-gray-500 text-sm mb-1">{t('netProfit')}</p>
                        <p className="text-xl font-bold text-blue-600 font-mono">{formatCurrency(stats?.revenue?.netProfit)}</p>
                    </div>
                </div>
            </div>

            {/* Game-wise Revenue Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-xl p-5 border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Aviator</h3>
                    <StatRow label={t('totalRevenue')} value={formatCurrency(stats?.gameWiseRevenue?.aviator?.revenue)} colorClass="text-green-600" />
                    <StatRow label={t('totalPayouts')} value={formatCurrency(stats?.gameWiseRevenue?.aviator?.payout)} colorClass="text-red-500" />
                    <StatRow label={t('totalProfit')} value={formatCurrency(stats?.gameWiseRevenue?.aviator?.totalProfit)} colorClass="text-blue-600" />
                </div>
                <div className="bg-white rounded-xl p-5 border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">FunTimer</h3>
                    <StatRow label={t('totalRevenue')} value={formatCurrency(stats?.gameWiseRevenue?.funTimer?.revenue)} colorClass="text-green-600" />
                    <StatRow label={t('totalPayouts')} value={formatCurrency(stats?.gameWiseRevenue?.funTimer?.payout)} colorClass="text-red-500" />
                    <StatRow label={t('totalProfit')} value={formatCurrency(stats?.gameWiseRevenue?.funTimer?.totalProfit)} colorClass="text-blue-600" />
                </div>
                <div className="bg-white rounded-xl p-5 border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Roulette</h3>
                    <StatRow label={t('totalRevenue')} value={formatCurrency(stats?.gameWiseRevenue?.roulette?.revenue)} colorClass="text-green-600" />
                    <StatRow label={t('totalPayouts')} value={formatCurrency(stats?.gameWiseRevenue?.roulette?.payout)} colorClass="text-red-500" />
                    <StatRow label={t('totalProfit')} value={formatCurrency(stats?.gameWiseRevenue?.roulette?.totalProfit)} colorClass="text-blue-600" />
                </div>
            </div>

            {/* Lottery 2D + 3D */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-6">
                <SectionCard title="2D Lottery Overview" description="Current slot + previous slot + selected range total" icon={FaDice} t={t}>
                    {lotteryStats.twoD.error ? (
                        <p className="text-sm text-red-500">{lotteryStats.twoD.error}</p>
                    ) : (
                        <>
                            <div className="mb-2 mt-1">
                                <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Current Slot (Live)</p>
                                <p className="text-[11px] text-gray-500">Running slot stats updated in real-time.</p>
                            </div>
                            <StatRow label="Current Slot" value={formatDrawTime(lotteryStats.twoD.current?.slot?.drawLabelEnd)} />
                            <StatRow label="Slots tickets" value={formatNumber(lotteryStats.twoD.current?.summary?.totalTickets)} />
                            <StatRow label="Slots bets" value={formatNumber(lotteryStats.twoD.current?.summary?.totalBets)} />
                            <StatRow label="Current Revenue" value={formatCurrency(lotteryStats.twoD.current?.summary?.revenue)} colorClass="text-green-600" />
                            <StatRow label="Current Payout" value={formatCurrency(lotteryStats.twoD.current?.summary?.winnerPayout)} colorClass="text-red-500" />
                            <StatRow label="Current Net" value={formatCurrency(lotteryStats.twoD.current?.summary?.amountRemaining)} colorClass="text-blue-600" />

                            <div className="mb-2 mt-3">
                                <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Previous Slot (Last Closed)</p>
                                <p className="text-[11px] text-gray-500">Shows only the immediate previous closed slot.</p>
                            </div>
                            <StatRow label="Previous Slot" value={formatDrawTime(lotteryStats.twoD.latest?.drawLabelEnd)} />
                            <StatRow label="Slots tickets" value={formatNumber(lotteryStats.twoD.latest?.totalTickets)} />
                            <StatRow label="Slots bets" value={formatNumber(lotteryStats.twoD.latest?.totalBets)} />
                            <StatRow label="Previous Slot Revenue" value={formatCurrency(lotteryStats.twoD.latest?.revenue)} colorClass="text-green-600" />
                            <StatRow label="Previous Slot Payout" value={formatCurrency(lotteryStats.twoD.latest?.winnerPayout)} colorClass="text-red-500" />
                            <StatRow label="Previous Slot Net" value={formatCurrency(lotteryStats.twoD.latest?.amountRemaining)} colorClass="text-blue-600" />

                            <div className="mb-2 mt-3">
                                <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Selected Range Total</p>
                                <p className="text-[11px] text-gray-500">All bets in selected date range.</p>
                            </div>
                            <StatRow label="All slots tickets" value={formatNumber(lotteryStats.twoD?.allSlots?.tickets)} />
                            <StatRow label="All slots bets" value={formatNumber(lotteryStats.twoD?.allSlots?.bets)} />
                            <StatRow label="All Slots Revenue" value={formatCurrency(lotteryStats.twoD?.allSlots?.revenue)} colorClass="text-green-600" />
                            <StatRow label="All Slots Payout" value={formatCurrency(lotteryStats.twoD?.allSlots?.payout)} colorClass="text-red-500" />
                            <StatRow label="All Slots Net" value={formatCurrency(lotteryStats.twoD?.allSlots?.net)} colorClass="text-blue-600" />
                        </>
                    )}
                </SectionCard>

                <SectionCard title="3D Lottery Overview" description="Current slot + previous slot + selected range total" icon={FaDice} t={t}>
                    {lotteryStats.threeD.error ? (
                        <p className="text-sm text-red-500">{lotteryStats.threeD.error}</p>
                    ) : (
                        <>
                            <div className="mb-2 mt-1">
                                <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Current Slot (Live)</p>
                                <p className="text-[11px] text-gray-500">Running slot stats updated in real-time.</p>
                            </div>
                            <StatRow label="Current Slot" value={formatSlotWindow(lotteryStats.threeD.current?.slot)} />
                            <StatRow label="Current Tickets" value={formatNumber(lotteryStats.threeD.current?.summary?.totalTickets)} />
                            <StatRow label="Current Revenue" value={formatCurrency(lotteryStats.threeD.current?.summary?.revenue)} colorClass="text-green-600" />
                            <StatRow label="Current Payout" value={formatCurrency(lotteryStats.threeD.current?.summary?.winnerPayout)} colorClass="text-red-500" />
                            <StatRow label="Current Net" value={formatCurrency(lotteryStats.threeD.current?.summary?.amountRemaining)} colorClass="text-blue-600" />

                            <div className="mb-2 mt-3">
                                <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Previous Slot (Last Closed)</p>
                                <p className="text-[11px] text-gray-500">Shows only the immediate previous closed slot.</p>
                            </div>
                            <StatRow label="Previous Slot" value={formatSlotWindow(lotteryStats.threeD.latest)} />
                            <StatRow label="Previous Slot Tickets" value={formatNumber(lotteryStats.threeD.latest?.totalTickets)} />
                            <StatRow label="Previous Slot Revenue" value={formatCurrency(lotteryStats.threeD.latest?.revenue)} colorClass="text-green-600" />
                            <StatRow label="Previous Slot Payout" value={formatCurrency(lotteryStats.threeD.latest?.winnerPayout)} colorClass="text-red-500" />
                            <StatRow label="Previous Slot Net" value={formatCurrency(lotteryStats.threeD.latest?.amountRemaining)} colorClass="text-blue-600" />

                            <div className="mb-2 mt-3">
                                <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Selected Range Total</p>
                                <p className="text-[11px] text-gray-500">All bets in selected date range.</p>
                            </div>
                            <StatRow label="All Slots Tickets" value={formatNumber(lotteryStats.threeD?.allSlots?.tickets)} />
                            <StatRow label="All Slots Revenue" value={formatCurrency(lotteryStats.threeD?.allSlots?.revenue)} colorClass="text-green-600" />
                            <StatRow label="All Slots Payout" value={formatCurrency(lotteryStats.threeD?.allSlots?.payout)} colorClass="text-red-500" />
                            <StatRow label="All Slots Net" value={formatCurrency(lotteryStats.threeD?.allSlots?.net)} colorClass="text-blue-600" />
                        </>
                    )}
                </SectionCard>
            </div>

            {/* Quick Links */}
            <div className="bg-white rounded-xl p-5 border border-gray-200">
                <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <FaClipboardList className="w-4 h-4 text-sb-primary" />
                    {t('quickLinks')}
                </h3>
                <p className="text-xs text-gray-500 mb-4">{t('navigateToSections')}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    <Link to="/my-users" className="px-4 py-3 rounded-lg bg-gray-100 hover:bg-sb-primary-dark/20 border border-gray-200 hover:border-orange-300 text-gray-600 hover:text-sb-primary text-sm font-medium transition-all text-center">
                        {t('myPlayers')}
                    </Link>
                    <Link to="/add-user" className="px-4 py-3 rounded-lg bg-gray-100 hover:bg-sb-primary-dark/20 border border-gray-200 hover:border-orange-300 text-gray-600 hover:text-sb-primary text-sm font-medium transition-all text-center">
                        {t('addPlayer')}
                    </Link>
                    <Link to="/bet-history" className="px-4 py-3 rounded-lg bg-gray-100 hover:bg-sb-primary-dark/20 border border-gray-200 hover:border-orange-300 text-gray-600 hover:text-sb-primary text-sm font-medium transition-all text-center">
                        {t('betHistory')}
                    </Link>
                    <Link to="/reports" className="px-4 py-3 rounded-lg bg-gray-100 hover:bg-sb-primary-dark/20 border border-gray-200 hover:border-orange-300 text-gray-600 hover:text-sb-primary text-sm font-medium transition-all text-center">
                        {t('report')}
                    </Link>
                </div>
            </div>
        </Layout>
    );
};

export default Dashboard;
