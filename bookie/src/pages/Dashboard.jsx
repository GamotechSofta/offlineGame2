import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { API_BASE_URL, getBookieAuthHeaders } from '../utils/api';
import { useLanguage } from '../context/LanguageContext';
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
} from 'react-icons/fa';

const getPresets = (t) => [
    { id: 'all', label: t('all'), getRange: () => {
        return { from: null, to: null };
    }},
    { id: 'today', label: t('today'), getRange: () => {
        const d = new Date();
        const y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
        const from = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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
                    {Icon && <Icon className="w-5 h-5 text-orange-500" />}
                    {title}
                </h3>
                {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
            </div>
            {linkTo && (
                <Link to={linkTo} className="text-xs font-medium text-orange-500 hover:text-orange-600 flex items-center gap-1">
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
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [datePreset, setDatePreset] = useState('all');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [customMode, setCustomMode] = useState(false);
    const [customOpen, setCustomOpen] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const PRESETS = getPresets(t);

    const getFromTo = () => {
        if (customMode && customFrom && customTo) return { from: customFrom, to: customTo };
        const preset = PRESETS.find((p) => p.id === datePreset);
        const range = preset ? preset.getRange() : PRESETS[0].getRange();
        // If "all" is selected, return null values to fetch all data
        if (range.from === null && range.to === null) {
            return { from: null, to: null };
        }
        return range;
    };

    useEffect(() => {
        fetchDashboardStats();
    }, []);

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
            const response = await fetch(url, {
                headers: getBookieAuthHeaders(),
                cache: isRefresh ? 'no-store' : 'default',
            });
            const data = await response.json();
            if (data.success) setStats(data.data);
            else setError(data.message || 'Failed to fetch dashboard stats');
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

    const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

    const pendingPayments = stats?.payments?.pending || 0;
    const pendingDeposits = stats?.payments?.pendingDeposits ?? stats?.payments?.pending ?? 0;
    const pendingWithdrawals = stats?.payments?.pendingWithdrawals ?? 0;
    const helpDeskOpen = stats?.helpDesk?.open || 0;
    const hasActionRequired = pendingPayments > 0 || helpDeskOpen > 0;

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
                    <button onClick={() => fetchDashboardStats()} className="mt-4 px-6 py-2 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-xl">
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
                            <span className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                                <FaChartLine className="w-5 h-5 text-orange-500" />
                            </span>
                            {t('dashboardOverview')}
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">{t('dashboardDescription')}</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-orange-500/20 border border-gray-200 hover:border-orange-300 text-gray-600 hover:text-orange-500 transition-all disabled:opacity-60 text-sm font-medium"
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
                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${isActive ? 'bg-orange-500 text-white' : 'bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200'}`}
                                >
                                    {p.label}
                                </button>
                            );
                        })}
                        <span className="text-xs text-gray-400 px-2">{t('showingDataFor')} <span className="text-orange-500 font-medium">{displayLabel}</span></span>
                        <button
                            type="button"
                            onClick={handleCustomToggle}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold ${customMode ? 'bg-orange-500 text-white' : 'bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200'}`}
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
                                <button type="button" onClick={handleCustomApply} className="px-4 py-2 rounded-lg bg-orange-500 text-white font-semibold text-sm">
                                    {t('apply')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Action Required */}
            {hasActionRequired && (
                <div className="mb-6 p-4 rounded-xl bg-orange-500/10 border border-orange-200">
                    <h3 className="text-sm font-semibold text-orange-500 flex items-center gap-2 mb-3">
                        <FaExclamationTriangle className="w-4 h-4" />
                        {t('actionRequired')}
                    </h3>
                    <div className="flex flex-wrap gap-3">
                        {pendingPayments > 0 && (
                            <Link to="/payments" className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-medium text-sm">
                                {pendingPayments} {pendingPayments !== 1 ? t('pendingPayments') : t('pendingPayment')} →
                            </Link>
                        )}
                        {helpDeskOpen > 0 && (
                            <Link to="/help-desk" className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-medium text-sm">
                                {helpDeskOpen} {helpDeskOpen !== 1 ? t('openTickets') : t('openTicket')} →
                            </Link>
                        )}
                    </div>
                </div>
            )}

            {/* Primary KPIs - Related Financial Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                <div className="bg-gradient-to-br from-green-50 to-transparent rounded-xl p-5 border border-green-200">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('totalBetAmount')}</p>
                    <p className="text-2xl font-bold text-green-600 font-mono">{formatCurrency(stats?.revenue?.total || 0)}</p>
                    <p className="text-xs text-gray-500 mt-1">{t('totalBetAmountDescription')}</p>
                </div>
                <div className="bg-gradient-to-br from-red-50 to-transparent rounded-xl p-5 border border-red-200">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('toReceived')}</p>
                    <p className="text-2xl font-bold text-red-600 font-mono">{formatCurrency(stats?.toTake || 0)}</p>
                    <p className="text-xs text-gray-500 mt-1">{t('moneyToTakeFromPlayers')}</p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-transparent rounded-xl p-5 border border-blue-200">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('toGive')}</p>
                    <p className="text-2xl font-bold text-blue-600 font-mono">{formatCurrency(stats?.toGive || 0)}</p>
                    <p className="text-xs text-gray-500 mt-1">{t('moneyToGiveToPlayers')}</p>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-transparent rounded-xl p-5 border border-orange-200">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('pending')}</p>
                    <p className="text-2xl font-bold text-orange-600 font-mono">{formatCurrency(stats?.pending || 0)}</p>
                    <p className="text-xs text-gray-500 mt-1">{t('pendingBetsAmount')}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-transparent rounded-xl p-5 border border-purple-200">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('totalProfit')}</p>
                    <p className="text-2xl font-bold text-purple-600 font-mono">{formatCurrency(stats?.totalProfit || 0)}</p>
                    <p className="text-xs text-gray-500 mt-1">{t('totalProfitDescription')}</p>
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
                    <StatRow label={t('newInPeriod')} value={stats?.users?.newToday ?? 0} colorClass="text-orange-500" />
                </SectionCard>

                {/* Bets */}
                <SectionCard title={t('bets')} description={t('selectedPeriod')} icon={FaChartBar} linkTo="/bet-history" linkLabel={t('betHistory')} t={t}>
                    <StatRow label={t('totalBets')} value={stats?.bets?.total ?? 0} />
                    <StatRow label={t('winningBets')} value={stats?.bets?.winning ?? 0} colorClass="text-green-600" />
                    <StatRow label={t('losingBets')} value={stats?.bets?.losing ?? 0} colorClass="text-red-500" />
                    <StatRow label={t('pendingBets')} value={stats?.bets?.pending ?? 0} colorClass="text-orange-500" />
                    <StatRow label={t('winRate')} value={`${stats?.bets?.winRate ?? 0}%`} />
                </SectionCard>

                {/* Payments */}
                <SectionCard title={t('payments')} description={t('depositsAndWithdrawals')} icon={FaCreditCard} linkTo="/payments" linkLabel={t('managePayments')} t={t}>
                    <StatRow label={t('depositsPeriod')} value={formatCurrency(stats?.payments?.totalDeposits)} colorClass="text-green-600" />
                    <StatRow label={t('withdrawalsPeriod')} value={formatCurrency(stats?.payments?.totalWithdrawals)} colorClass="text-red-500" />
                    <StatRow label={t('pendingDeposits')} value={pendingDeposits} colorClass="text-orange-500" />
                    <StatRow label={t('pendingWithdrawals')} value={pendingWithdrawals} colorClass="text-orange-500" />
                    <StatRow label={t('totalPending')} value={pendingPayments} colorClass="text-orange-500" />
                </SectionCard>

                {/* Wallet */}
                <SectionCard title={t('walletBalance')} description={t('allPlayersCombined')} icon={FaWallet} linkTo="/wallet" linkLabel={t('wallet')} t={t}>
                    <StatRow label={t('totalBalance')} value={formatCurrency(stats?.wallet?.totalBalance)} colorClass="text-green-600" />
                    <StatRow label={t('toGiveWallet')} value={formatCurrency(stats?.wallet?.toGive)} colorClass="text-blue-600" />
                    <StatRow label={t('toReceiveWallet')} value={formatCurrency(stats?.wallet?.toReceive)} colorClass="text-red-600" />
                </SectionCard>

                {/* To Give & To Take */}
                <SectionCard title={`${t('toGive')} & ${t('toTake')}`} description={t('separateTracking')} icon={FaMoneyBillWave} linkTo="/my-users" linkLabel={t('myPlayers')} t={t}>
                    <StatRow label={t('toGive')} value={formatCurrency(stats?.toGive || 0)} colorClass="text-blue-600" />
                    <StatRow label={t('toTake')} value={formatCurrency(stats?.toTake || 0)} colorClass="text-red-600" />
                </SectionCard>

                {/* Advance & Loss */}
                <SectionCard title={t('advanceAndLoss')} description={t('allTimeTotals')} icon={FaMoneyBillWave} linkTo="/reports" linkLabel={t('report')} t={t}>
                    <StatRow label={t('totalAdvance')} value={formatCurrency(stats?.advance)} colorClass="text-purple-600" />
                    <StatRow label={t('totalLoss')} value={formatCurrency(stats?.loss)} colorClass="text-red-600" />
                </SectionCard>

                {/* Help Desk */}
                <SectionCard title={t('helpDesk')} description={t('helpDeskTickets')} icon={FaLifeRing} linkTo="/help-desk" linkLabel={t('helpDesk')} t={t}>
                    <StatRow label={t('totalTickets')} value={stats?.helpDesk?.total ?? 0} />
                    <StatRow label={t('open')} value={stats?.helpDesk?.open ?? 0} colorClass="text-orange-500" />
                    <StatRow label={t('inProgress')} value={stats?.helpDesk?.inProgress ?? 0} colorClass="text-blue-600" />
                </SectionCard>
            </div>

            {/* Revenue Summary */}
            <div className="bg-white rounded-xl p-5 border border-gray-200 mb-6">
                <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <FaMoneyBillWave className="w-4 h-4 text-orange-500" />
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

            {/* Quick Links */}
            <div className="bg-white rounded-xl p-5 border border-gray-200">
                <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <FaClipboardList className="w-4 h-4 text-orange-500" />
                    {t('quickLinks')}
                </h3>
                <p className="text-xs text-gray-500 mb-4">{t('navigateToSections')}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    <Link to="/my-users" className="px-4 py-3 rounded-lg bg-gray-100 hover:bg-orange-500/20 border border-gray-200 hover:border-orange-300 text-gray-600 hover:text-orange-500 text-sm font-medium transition-all text-center">
                        {t('myPlayers')}
                    </Link>
                    <Link to="/add-user" className="px-4 py-3 rounded-lg bg-gray-100 hover:bg-orange-500/20 border border-gray-200 hover:border-orange-300 text-gray-600 hover:text-orange-500 text-sm font-medium transition-all text-center">
                        {t('addPlayer')}
                    </Link>
                    <Link to="/bet-history" className="px-4 py-3 rounded-lg bg-gray-100 hover:bg-orange-500/20 border border-gray-200 hover:border-orange-300 text-gray-600 hover:text-orange-500 text-sm font-medium transition-all text-center">
                        {t('betHistory')}
                    </Link>
                    <Link to="/reports" className="px-4 py-3 rounded-lg bg-gray-100 hover:bg-orange-500/20 border border-gray-200 hover:border-orange-300 text-gray-600 hover:text-orange-500 text-sm font-medium transition-all text-center">
                        {t('report')}
                    </Link>
                </div>
            </div>
        </Layout>
    );
};

export default Dashboard;
