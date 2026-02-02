import React, { useState, useEffect, useRef } from 'react';
import AdminLayout from '../components/AdminLayout';
import { useNavigate } from 'react-router-dom';
import { SkeletonCard, LoadingOverlay } from '../components/Skeleton';
import StatCard from '../components/StatCard';
import { FaChartLine, FaUsers, FaMoneyBillWave, FaChartBar, FaCalendarAlt } from 'react-icons/fa';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const PRESETS = [
    { id: 'today', label: '1 Day (Today)', getRange: () => {
        const d = new Date();
        const y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
        const from = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return { from, to: from };
    }},
    { id: 'tomorrow', label: 'Tomorrow', getRange: () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
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

const formatRangeLabel = (from, to) => {
    if (!from || !to) return '1 Day (Today)';
    if (from === to) {
        const d = new Date(from + 'T12:00:00');
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    const a = new Date(from + 'T12:00:00');
    const b = new Date(to + 'T12:00:00');
    return `${a.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${b.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
};

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [datePreset, setDatePreset] = useState('today');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [customMode, setCustomMode] = useState(false);
    const dropdownRef = useRef(null);

    const getFromTo = () => {
        if (customMode && customFrom && customTo) return { from: customFrom, to: customTo };
        const preset = PRESETS.find((p) => p.id === datePreset);
        return preset ? preset.getRange() : PRESETS[0].getRange();
    };

    const getDisplayLabel = () => {
        if (customMode && customFrom && customTo) return formatRangeLabel(customFrom, customTo);
        const preset = PRESETS.find((p) => p.id === datePreset);
        return preset ? preset.label : '1 Day (Today)';
    };

    useEffect(() => {
        const admin = localStorage.getItem('admin');
        if (!admin) {
            navigate('/');
            return;
        }
        fetchDashboardStats();
    }, [navigate]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setCalendarOpen(false);
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const fetchDashboardStats = async (rangeOverride) => {
        try {
            setLoading(true);
            setError('');
            const { from, to } = rangeOverride || getFromTo();
            const admin = JSON.parse(localStorage.getItem('admin'));
            const password = sessionStorage.getItem('adminPassword') || '';
            const url = `${API_BASE_URL}/dashboard/stats${from && to ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` : ''}`;
            const response = await fetch(url, {
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

    const handlePresetSelect = (presetId) => {
        setDatePreset(presetId);
        setCustomMode(false);
        setCalendarOpen(false);
        const preset = PRESETS.find((p) => p.id === presetId);
        const range = preset ? preset.getRange() : PRESETS[0].getRange();
        fetchDashboardStats(range);
    };

    const handleCustomApply = () => {
        if (!customFrom || !customTo) return;
        if (new Date(customFrom) > new Date(customTo)) return;
        setCustomMode(true);
        setCalendarOpen(false);
        fetchDashboardStats({ from: customFrom, to: customTo });
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
            <AdminLayout onLogout={handleLogout} title="Dashboard">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
                    <h1 className="text-2xl sm:text-3xl font-bold animate-fadeIn">Dashboard Overview</h1>
                    <div className="relative shrink-0" ref={dropdownRef}>
                        <button
                            type="button"
                            onClick={() => setCalendarOpen((o) => !o)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-200 font-medium text-sm transition-colors"
                        >
                            <FaCalendarAlt className="w-4 h-4 text-yellow-500" />
                            {getDisplayLabel()}
                        </button>
                        {calendarOpen && (
                            <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-gray-800 border border-gray-600 shadow-xl z-50 py-2">
                                {PRESETS.map((p) => (
                                    <button key={p.id} type="button" onClick={() => handlePresetSelect(p.id)} className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2">
                                        {datePreset === p.id && !customMode ? <span className="text-yellow-500">●</span> : <span className="w-2" />}
                                        {p.label}
                                    </button>
                                ))}
                                <div className="border-t border-gray-600 my-2" />
                                <div className="px-4 py-2 text-xs text-gray-400 uppercase tracking-wider">Custom Date Range</div>
                                <div className="px-4 py-2 flex flex-col gap-2">
                                    <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-sm text-white" />
                                    <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-sm text-white" />
                                    <button type="button" onClick={handleCustomApply} disabled={!customFrom || !customTo} className="w-full py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold text-sm">
                                        Apply
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
                    {[...Array(4)].map((_, i) => (
                        <SkeletonCard key={i} />
                    ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {[...Array(3)].map((_, i) => (
                        <SkeletonCard key={i} />
                    ))}
                </div>
            </AdminLayout>
        );
    }

    if (error) {
        return (
            <AdminLayout onLogout={handleLogout} title="Dashboard">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
                    <h1 className="text-2xl sm:text-3xl font-bold animate-fadeIn">Dashboard Overview</h1>
                    <div className="relative shrink-0" ref={dropdownRef}>
                        <button
                            type="button"
                            onClick={() => setCalendarOpen((o) => !o)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-200 font-medium text-sm transition-colors"
                        >
                            <FaCalendarAlt className="w-4 h-4 text-yellow-500" />
                            {getDisplayLabel()}
                        </button>
                        {calendarOpen && (
                            <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-gray-800 border border-gray-600 shadow-xl z-50 py-2">
                                {PRESETS.map((p) => (
                                    <button key={p.id} type="button" onClick={() => handlePresetSelect(p.id)} className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2">
                                        {datePreset === p.id && !customMode ? <span className="text-yellow-500">●</span> : <span className="w-2" />}
                                        {p.label}
                                    </button>
                                ))}
                                <div className="border-t border-gray-600 my-2" />
                                <div className="px-4 py-2 text-xs text-gray-400 uppercase tracking-wider">Custom Date Range</div>
                                <div className="px-4 py-2 flex flex-col gap-2">
                                    <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-sm text-white" />
                                    <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-sm text-white" />
                                    <button type="button" onClick={handleCustomApply} disabled={!customFrom || !customTo} className="w-full py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold text-sm">
                                        Apply
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex flex-col items-center justify-center min-h-[50vh] animate-fadeIn">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <p className="text-red-400 text-lg font-medium mb-2">{error}</p>
                    <button
                        onClick={fetchDashboardStats}
                        className="mt-4 px-6 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-semibold rounded-xl transition-all duration-200 glow-yellow hover:-translate-y-0.5"
                    >
                        Retry
                    </button>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout onLogout={handleLogout} title="Dashboard">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold animate-fadeIn">Dashboard Overview</h1>
                <div className="relative shrink-0" ref={dropdownRef}>
                    <button
                        type="button"
                        onClick={() => setCalendarOpen((o) => !o)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-200 font-medium text-sm transition-colors"
                    >
                        <FaCalendarAlt className="w-4 h-4 text-yellow-500" />
                        {getDisplayLabel()}
                    </button>
                    {calendarOpen && (
                        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-gray-800 border border-gray-600 shadow-xl z-50 py-2">
                            {PRESETS.map((p) => (
                                <button key={p.id} type="button" onClick={() => handlePresetSelect(p.id)} className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2">
                                    {datePreset === p.id && !customMode ? <span className="text-yellow-500">●</span> : <span className="w-2" />}
                                    {p.label}
                                </button>
                            ))}
                            <div className="border-t border-gray-600 my-2" />
                            <div className="px-4 py-2 text-xs text-gray-400 uppercase tracking-wider">Custom Date Range</div>
                            <div className="px-4 py-2 flex flex-col gap-2">
                                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-sm text-white" />
                                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-sm text-white" />
                                <button type="button" onClick={handleCustomApply} disabled={!customFrom || !customTo} className="w-full py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold text-sm">
                                    Apply
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Revenue Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
                <StatCard
                    title="Total Revenue"
                    value={formatCurrency(stats?.revenue?.total || 0)}
                    icon={FaMoneyBillWave}
                    color="green"
                    delay={0}
                    details={[
                        { label: 'Today', value: formatCurrency(stats?.revenue?.today || 0) },
                        { label: 'Week', value: formatCurrency(stats?.revenue?.thisWeek || 0) }
                    ]}
                />

                <StatCard
                    title="Net Profit"
                    value={formatCurrency(stats?.revenue?.netProfit || 0)}
                    icon={FaChartLine}
                    color="blue"
                    delay={0.1}
                    details={[
                        { label: 'Payouts', value: formatCurrency(stats?.revenue?.payouts || 0) }
                    ]}
                />

                <StatCard
                    title="Total Players"
                    value={stats?.users?.total || 0}
                    icon={FaUsers}
                    color="purple"
                    delay={0.2}
                    details={[
                        { label: 'Active', value: stats?.users?.active || 0 },
                        { label: 'New', value: stats?.users?.newToday || 0 }
                    ]}
                />

                <StatCard
                    title="Total Bets"
                    value={stats?.bets?.total || 0}
                    icon={FaChartBar}
                    color="yellow"
                    delay={0.3}
                    details={[
                        { label: 'Win Rate', value: `${stats?.bets?.winRate || 0}%` },
                        { label: 'Today', value: stats?.bets?.today || 0 }
                    ]}
                />
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
                {/* Markets Card */}
                <div className="glass rounded-xl p-6 border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300 hover:-translate-y-0.5 animate-slideUp" style={{ animationDelay: '0.4s' }}>
                    <h3 className="text-lg font-semibold mb-4 text-white flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-400"></div>
                        Markets
                    </h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center p-2 rounded-lg hover:bg-gray-700/30 transition-colors">
                            <span className="text-gray-400 text-sm">Total Markets</span>
                            <span className="text-white font-bold font-mono">{stats?.markets?.total || 0}</span>
                        </div>
                        <div className="flex justify-between items-center p-2 rounded-lg hover:bg-gray-700/30 transition-colors">
                            <span className="text-gray-400 text-sm">Open Now</span>
                            <span className="text-green-400 font-bold font-mono">{stats?.markets?.open || 0}</span>
                        </div>
                    </div>
                </div>

                {/* Bet Status Card */}
                <div className="glass rounded-xl p-6 border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300 hover:-translate-y-0.5 animate-slideUp" style={{ animationDelay: '0.5s' }}>
                    <h3 className="text-lg font-semibold mb-4 text-white flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                        Bet Status
                    </h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center p-2 rounded-lg hover:bg-gray-700/30 transition-colors">
                            <span className="text-gray-400 text-sm">Winning</span>
                            <span className="text-green-400 font-bold font-mono">{stats?.bets?.winning || 0}</span>
                        </div>
                        <div className="flex justify-between items-center p-2 rounded-lg hover:bg-gray-700/30 transition-colors">
                            <span className="text-gray-400 text-sm">Losing</span>
                            <span className="text-red-400 font-bold font-mono">{stats?.bets?.losing || 0}</span>
                        </div>
                        <div className="flex justify-between items-center p-2 rounded-lg hover:bg-gray-700/30 transition-colors">
                            <span className="text-gray-400 text-sm">Pending</span>
                            <span className="text-yellow-400 font-bold font-mono">{stats?.bets?.pending || 0}</span>
                        </div>
                    </div>
                </div>

                {/* Payments Card */}
                <div className="glass rounded-xl p-6 border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300 hover:-translate-y-0.5 animate-slideUp" style={{ animationDelay: '0.6s' }}>
                    <h3 className="text-lg font-semibold mb-4 text-white flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                        Payments
                    </h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center p-2 rounded-lg hover:bg-gray-700/30 transition-colors">
                            <span className="text-gray-400 text-sm">Total Deposits</span>
                            <span className="text-green-400 font-bold font-mono text-sm">{formatCurrency(stats?.payments?.totalDeposits || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center p-2 rounded-lg hover:bg-gray-700/30 transition-colors">
                            <span className="text-gray-400 text-sm">Total Withdrawals</span>
                            <span className="text-red-400 font-bold font-mono text-sm">{formatCurrency(stats?.payments?.totalWithdrawals || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center p-2 rounded-lg hover:bg-gray-700/30 transition-colors">
                            <span className="text-gray-400 text-sm">Pending</span>
                            <span className="text-yellow-400 font-bold font-mono">{stats?.payments?.pending || 0}</span>
                        </div>
                    </div>
                </div>

                {/* Wallet Card */}
                <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold mb-4 text-gray-300">Wallet</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-gray-400">Total Balance</span>
                            <span className="text-yellow-400 font-bold text-xl">{formatCurrency(stats?.wallet?.totalBalance || 0)}</span>
                        </div>
                    </div>
                </div>

                {/* Player Growth Card */}
                <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold mb-4 text-gray-300">Player Growth</h3>
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
                <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700">
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
            <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700">
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
        </AdminLayout>
    );
};

export default AdminDashboard;
