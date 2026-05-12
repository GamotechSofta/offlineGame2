import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { clearAdminSession, fetchWithAuth } from '../lib/auth';
import { FaMoneyBillWave, FaSyncAlt } from 'react-icons/fa';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const PRESETS = [
    { id: 'all', label: 'All', getRange: () => ({ from: '', to: '' }) },
    {
        id: 'today',
        label: 'Today',
        getRange: () => {
            const d = new Date();
            const y = d.getFullYear();
            const m = d.getMonth();
            const day = d.getDate();
            const from = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            return { from, to: from };
        },
    },
    {
        id: 'yesterday',
        label: 'Yesterday',
        getRange: () => {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            const y = d.getFullYear();
            const m = d.getMonth();
            const day = d.getDate();
            const from = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            return { from, to: from };
        },
    },
    {
        id: 'this_week',
        label: 'This Week',
        getRange: () => {
            const d = new Date();
            const day = d.getDay();
            const sun = new Date(d);
            sun.setDate(d.getDate() - day);
            const fmt = (x) =>
                `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
            return { from: fmt(sun), to: fmt(d) };
        },
    },
    {
        id: 'last_week',
        label: 'Last Week',
        getRange: () => {
            const d = new Date();
            const day = d.getDay();
            const sun = new Date(d);
            sun.setDate(d.getDate() - day - 7);
            const sat = new Date(sun);
            sat.setDate(sun.getDate() + 6);
            const fmt = (x) =>
                `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
            return { from: fmt(sun), to: fmt(sat) };
        },
    },
    {
        id: 'this_month',
        label: 'This Month',
        getRange: () => {
            const d = new Date();
            const y = d.getFullYear();
            const m = d.getMonth();
            const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
            const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            return { from, to };
        },
    },
    {
        id: 'last_month',
        label: 'Last Month',
        getRange: () => {
            const d = new Date();
            const y = d.getFullYear();
            const m = d.getMonth() - 1;
            const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
            const last = new Date(y, m + 1, 0);
            const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
            return { from, to };
        },
    },
];

const formatRangeLabel = (from, to) => {
    if (!from || !to) return 'All time';
    if (from === to) {
        const d = new Date(`${from}T12:00:00`);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    const a = new Date(`${from}T12:00:00`);
    const b = new Date(`${to}T12:00:00`);
    return `${a.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${b.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
};

const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
        Number(amount) || 0,
    );

const TotalMetricCard = ({ label, value, valueClass }) => (
    <div className="flex min-h-0 min-w-0 max-w-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white p-3 text-center shadow-sm sm:p-5">
        <p className="mb-1.5 line-clamp-2 text-xs font-medium leading-snug text-gray-500 sm:mb-2 sm:text-sm">{label}</p>
        <p
            className={`min-w-0 max-w-full break-words text-xl font-bold leading-tight sm:text-2xl md:text-2xl ${valueClass}`}
            style={{ fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}
        >
            {value}
        </p>
    </div>
);

const StatRow = ({ label, value, colorClass = 'text-gray-800' }) => (
    <div className="flex min-w-0 flex-col gap-0.5 border-b border-gray-200 py-2 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:py-2.5">
        <span className="shrink-0 text-xs text-gray-500 sm:text-sm">{label}</span>
        <span
            className={`min-w-0 max-w-full break-words text-left text-sm font-semibold sm:text-right sm:text-sm ${colorClass}`}
            style={{ fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}
        >
            {value}
        </span>
    </div>
);

const GameCard = ({ title, revenue, payout, profit, linkTo }) => (
    <Link
        to={linkTo}
        className="block min-w-0 max-w-full overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-orange-300 hover:shadow-md focus-visible:outline focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 sm:p-5"
    >
        <h2 className="mb-3 text-lg font-semibold text-gray-800 sm:mb-4">{title}</h2>
        <StatRow label="Total Revenue" value={formatCurrency(revenue)} colorClass="text-green-600" />
        <StatRow label="Total Payout" value={formatCurrency(payout)} colorClass="text-red-500" />
        <StatRow label="Total Profit" value={formatCurrency(profit)} colorClass="text-blue-600" />
    </Link>
);

const GamesRevenue = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [datePreset, setDatePreset] = useState('today');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [customMode, setCustomMode] = useState(false);
    const [customOpen, setCustomOpen] = useState(false);
    const [gameWise, setGameWise] = useState({
        aviator: { revenue: 0, payout: 0, totalProfit: 0 },
        funTimer: { revenue: 0, payout: 0, totalProfit: 0 },
        roulette: { revenue: 0, payout: 0, totalProfit: 0 },
    });
    const [allGames, setAllGames] = useState({ revenue: 0, payout: 0, totalProfit: 0 });

    const getFromTo = useCallback(() => {
        if (customMode && customFrom && customTo) return { from: customFrom, to: customTo };
        const preset = PRESETS.find((p) => p.id === datePreset);
        const todayPreset = PRESETS.find((p) => p.id === 'today') || PRESETS[1];
        return preset ? preset.getRange() : todayPreset.getRange();
    }, [customMode, customFrom, customTo, datePreset]);

    const effectiveRange = useMemo(() => getFromTo(), [getFromTo]);

    const handleLogout = useCallback(() => {
        clearAdminSession();
        navigate('/');
    }, [navigate]);

    const load = useCallback(async (opts = {}) => {
        const soft = Boolean(opts.soft);
        if (!soft) setLoading(true);
        setError('');
        try {
            const { from, to } = getFromTo();
            const params = new URLSearchParams();
            if (from && to) {
                params.set('from', from);
                params.set('to', to);
            }
            params.set('_', String(Date.now()));
            const query = params.toString();
            const url = `${API_BASE_URL}/dashboard/stats${query ? `?${query}` : ''}`;
            const res = await fetchWithAuth(url, { cache: 'no-store' });
            if (res.status === 401) {
                navigate('/');
                return;
            }
            const data = await res.json();
            if (!data?.success) {
                setError(data?.message || 'Failed to load games revenue.');
                return;
            }
            const g = data.data?.gameWiseRevenue || {};
            const aviator = {
                revenue: Number(g.aviator?.revenue || 0),
                payout: Number(g.aviator?.payout || 0),
                totalProfit: Number(g.aviator?.totalProfit ?? (g.aviator?.revenue || 0) - (g.aviator?.payout || 0)),
            };
            const funTimer = {
                revenue: Number(g.funTimer?.revenue || 0),
                payout: Number(g.funTimer?.payout || 0),
                totalProfit: Number(g.funTimer?.totalProfit ?? (g.funTimer?.revenue || 0) - (g.funTimer?.payout || 0)),
            };
            const roulette = {
                revenue: Number(g.roulette?.revenue || 0),
                payout: Number(g.roulette?.payout || 0),
                totalProfit: Number(
                    g.roulette?.totalProfit ?? (g.roulette?.revenue || 0) - (g.roulette?.payout || 0),
                ),
            };
            setGameWise({ aviator, funTimer, roulette });

            if (g.total && typeof g.total === 'object') {
                setAllGames({
                    revenue: Number(g.total.revenue || 0),
                    payout: Number(g.total.payout || 0),
                    totalProfit: Number(
                        g.total.totalProfit ?? Number(g.total.revenue || 0) - Number(g.total.payout || 0),
                    ),
                });
            } else {
                setAllGames({
                    revenue: aviator.revenue + funTimer.revenue + roulette.revenue,
                    payout: aviator.payout + funTimer.payout + roulette.payout,
                    totalProfit: aviator.totalProfit + funTimer.totalProfit + roulette.totalProfit,
                });
            }
        } catch {
            setError('Network error. Please try again.');
        } finally {
            if (!soft) setLoading(false);
        }
    }, [getFromTo, navigate]);

    useEffect(() => {
        load();
    }, [load]);

    const handleRefresh = () => {
        setRefreshing(true);
        load({ soft: true }).finally(() => setRefreshing(false));
    };

    const handlePresetSelect = (presetId) => {
        if (!customMode && datePreset === presetId) {
            handleRefresh();
            return;
        }
        setDatePreset(presetId);
        setCustomMode(false);
        setCustomOpen(false);
    };

    const handleCustomToggle = () => {
        setCustomMode(true);
        setCustomOpen((o) => !o);
    };

    const handleCustomApply = () => {
        if (!customFrom || !customTo) return;
        if (new Date(customFrom) > new Date(customTo)) return;
        setCustomMode(true);
        setCustomOpen(false);
    };

    const displayLabel =
        customMode && customFrom && customTo
            ? formatRangeLabel(customFrom, customTo)
            : PRESETS.find((p) => p.id === datePreset)?.label || 'Today';

    return (
        <AdminLayout onLogout={handleLogout} title="Games Revenue">
            <div className="mx-auto min-w-0 w-full max-w-6xl">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <FaMoneyBillWave className="text-orange-500" />
                            Games Revenue
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Aviator, FunTimer, and Roulette from wallet activity for the selected range.
                        </p>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-4 border border-gray-200 mb-6">
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Date Range</p>
                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={loading || refreshing}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-orange-500/20 border border-gray-200 hover:border-orange-300 text-gray-600 hover:text-orange-600 transition-all disabled:opacity-60 text-xs font-medium"
                        >
                            <FaSyncAlt className={`w-3.5 h-3.5 ${loading || refreshing ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>
                    <div className="grid grid-cols-4 gap-x-1.5 gap-y-1.5 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
                        {PRESETS.map((p) => {
                            const isActive = !customMode && datePreset === p.id;
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => handlePresetSelect(p.id)}
                                    className={`min-w-0 px-1 py-1.5 text-[10px] sm:px-4 sm:py-2 sm:text-sm font-semibold leading-snug text-center rounded-md transition-all sm:rounded-lg ${
                                        isActive
                                            ? 'bg-orange-500 text-white'
                                            : 'bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    {p.label}
                                </button>
                            );
                        })}
                        <button
                            type="button"
                            onClick={handleCustomToggle}
                            className={`min-w-0 px-1 py-1.5 text-[10px] sm:px-4 sm:py-2 sm:text-sm font-semibold leading-snug text-center rounded-md transition-all sm:rounded-lg ${
                                customMode
                                    ? 'bg-orange-500 text-white'
                                    : 'bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            Custom
                        </button>
                        {customOpen && (
                            <div className="col-span-4 w-full flex flex-wrap items-end gap-2 sm:gap-3 mt-1 p-2 sm:mt-3 sm:p-3 rounded-lg bg-gray-50 border border-gray-200 sm:basis-full">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">From</label>
                                    <input
                                        type="date"
                                        value={customFrom}
                                        onChange={(e) => setCustomFrom(e.target.value)}
                                        className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-800"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">To</label>
                                    <input
                                        type="date"
                                        value={customTo}
                                        onChange={(e) => setCustomTo(e.target.value)}
                                        className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-800"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleCustomApply}
                                    className="px-4 py-2 rounded-lg bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600"
                                >
                                    Apply
                                </button>
                            </div>
                        )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                        Showing data for: <span className="text-orange-600 font-medium">{displayLabel}</span>
                    </p>
                </div>

                {error ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
                ) : null}

                {loading && !error ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">Loading…</div>
                ) : (
                    <div className="min-w-0 space-y-6">
                        <section className="min-w-0">
                            <h2 className="mb-3 text-lg font-semibold text-gray-800 sm:mb-4 sm:text-xl">Total Games Revenue</h2>
                            <div className="grid min-w-0 w-full max-w-full grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-4">
                                <TotalMetricCard
                                    label="Total Revenue"
                                    value={formatCurrency(allGames.revenue)}
                                    valueClass="text-green-600"
                                />
                                <TotalMetricCard
                                    label="Total Payout"
                                    value={formatCurrency(allGames.payout)}
                                    valueClass="text-red-500"
                                />
                                <TotalMetricCard
                                    label="Total Profit"
                                    value={formatCurrency(allGames.totalProfit)}
                                    valueClass="text-blue-600"
                                />
                            </div>
                        </section>
                        <div className="grid min-w-0 w-full max-w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <GameCard
                                title="Aviator"
                                revenue={gameWise.aviator.revenue}
                                payout={gameWise.aviator.payout}
                                profit={gameWise.aviator.totalProfit}
                                linkTo="/all-users?playedGame=Aviator"
                            />
                            <GameCard
                                title="FunTimer"
                                revenue={gameWise.funTimer.revenue}
                                payout={gameWise.funTimer.payout}
                                profit={gameWise.funTimer.totalProfit}
                                linkTo="/all-users?playedGame=FunTimer"
                            />
                            <GameCard
                                title="Roulette"
                                revenue={gameWise.roulette.revenue}
                                payout={gameWise.roulette.payout}
                                profit={gameWise.roulette.totalProfit}
                                linkTo="/all-users?playedGame=Roulette"
                            />
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
};

export default GamesRevenue;
