import React, { useState, useEffect, useRef } from 'react';
import AdminLayout from '../components/AdminLayout';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
    FaArrowLeft,
    FaCalendarAlt,
    FaMoneyBillWave,
    FaCoins,
    FaUserTie,
    FaArrowUp,
    FaArrowDown,
    FaChartBar,
    FaPercent,
    FaUsers,
    FaPhone,
    FaEnvelope,
    FaClock,
} from 'react-icons/fa';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'users', label: 'Users' },
    { id: 'bets', label: 'Bet History' },
    { id: 'profile', label: 'Profile' },
];

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

const getAuthHeaders = () => {
    const admin = JSON.parse(localStorage.getItem('admin') || '{}');
    const password = sessionStorage.getItem('adminPassword') || '';
    return { 'Content-Type': 'application/json', Authorization: `Basic ${btoa(`${admin.username}:${password}`)}` };
};

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

const BookieDetail = () => {
    const { bookieId } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [dateRange, setDateRange] = useState(() => {
        const d = new Date();
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return { startDate: today, endDate: today };
    });
    const [activePreset, setActivePreset] = useState('today');

    useEffect(() => {
        if (!localStorage.getItem('admin')) { navigate('/'); return; }
        fetchDetail();
    }, [bookieId, dateRange]);

    const fetchDetail = async () => {
        try {
            setLoading(true);
            setError('');
            const res = await fetch(
                `${API_BASE_URL}/reports/revenue/${bookieId}?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
                { headers: getAuthHeaders() }
            );
            const json = await res.json();
            if (json.success) setData(json.data);
            else setError(json.message || 'Failed to load');
        } catch (err) {
            setError('Network error');
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

    if (loading && !data) {
        return (
            <AdminLayout onLogout={handleLogout} title="Bookie Detail">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 w-48 bg-gray-700 rounded" />
                    <div className="h-24 bg-gray-700 rounded-xl" />
                    <div className="h-10 w-full bg-gray-700 rounded" />
                </div>
            </AdminLayout>
        );
    }

    if (error && !data) {
        return (
            <AdminLayout onLogout={handleLogout} title="Bookie Detail">
                <div className="flex flex-col items-center justify-center min-h-[40vh]">
                    <p className="text-red-400 mb-4">{error}</p>
                    <Link to="/revenue" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-black font-semibold">
                        <FaArrowLeft /> Back to Revenue
                    </Link>
                </div>
            </AdminLayout>
        );
    }

    const bookie = data?.bookie;
    const revenue = data?.revenue;
    const users = data?.users || [];
    const bets = data?.recentBets || [];

    return (
        <AdminLayout onLogout={handleLogout} title="Bookie Detail">
            <div className="min-w-0 max-w-full space-y-4 sm:space-y-6">
                {/* Back + Header */}
                <div>
                    <Link to="/revenue" className="text-gray-400 hover:text-amber-500 text-sm inline-flex items-center gap-1 mb-2">
                        <FaArrowLeft className="w-3 h-3" /> Revenue
                    </Link>
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">{bookie?.username || 'Bookie'}</h1>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${bookie?.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                            {bookie?.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400">
                            {bookie?.commissionPercentage || 0}% Commission
                        </span>
                    </div>
                    {bookie?.phone && <p className="text-gray-500 text-sm mt-0.5">{bookie.phone}</p>}
                </div>

                {/* Date filters */}
                <div className="bg-gray-800/80 rounded-xl border border-gray-700/80 p-3 sm:p-4">
                    <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3">
                        {PRESETS.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => applyPreset(p.id)}
                                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                                    activePreset === p.id ? 'bg-amber-500 text-black' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <input type="date" value={dateRange.startDate}
                            onChange={(e) => { setDateRange((r) => ({ ...r, startDate: e.target.value })); setActivePreset(''); }}
                            className="px-2 sm:px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-xs sm:text-sm w-[130px] sm:w-auto"
                        />
                        <span className="text-gray-500 text-sm">to</span>
                        <input type="date" value={dateRange.endDate}
                            onChange={(e) => { setDateRange((r) => ({ ...r, endDate: e.target.value })); setActivePreset(''); }}
                            className="px-2 sm:px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-xs sm:text-sm w-[130px] sm:w-auto"
                        />
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex flex-wrap gap-1.5 sm:gap-2 border-b border-gray-700 pb-2">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold text-xs sm:text-sm transition-colors ${
                                activeTab === tab.id ? 'bg-amber-500 text-black' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                {activeTab === 'overview' && revenue && (
                    <div className="space-y-4">
                        {/* Revenue Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="bg-gray-800/80 rounded-xl p-3 sm:p-4 border border-gray-700/60 relative overflow-hidden">
                                <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
                                <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider">Total Bets</p>
                                <p className="text-sm sm:text-lg lg:text-xl font-bold text-white mt-1 truncate">{formatCurrency(revenue.totalBetAmount)}</p>
                                <p className="text-[10px] text-gray-500 mt-0.5">{formatNumber(revenue.totalBetCount)} bets</p>
                            </div>
                            <div className="bg-gray-800/80 rounded-xl p-3 sm:p-4 border border-gray-700/60 relative overflow-hidden">
                                <div className="absolute top-0 left-0 right-0 h-1 bg-red-500" />
                                <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider">Payouts</p>
                                <p className="text-sm sm:text-lg lg:text-xl font-bold text-red-400 mt-1 truncate">{formatCurrency(revenue.totalPayouts)}</p>
                                <p className="text-[10px] text-gray-500 mt-0.5">{formatNumber(revenue.winningBets)} wins, {formatNumber(revenue.losingBets)} losses</p>
                            </div>
                            <div className="bg-gray-800/80 rounded-xl p-3 sm:p-4 border border-gray-700/60 relative overflow-hidden">
                                <div className="absolute top-0 left-0 right-0 h-1 bg-orange-500" />
                                <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider">Bookie Share ({bookie?.commissionPercentage}%)</p>
                                <p className="text-sm sm:text-lg lg:text-xl font-bold text-orange-400 mt-1 truncate">{formatCurrency(revenue.bookieShare)}</p>
                            </div>
                            <div className={`bg-gray-800/80 rounded-xl p-3 sm:p-4 border relative overflow-hidden ${revenue.adminProfit >= 0 ? 'border-emerald-500/40' : 'border-red-500/40'}`}>
                                <div className={`absolute top-0 left-0 right-0 h-1 ${revenue.adminProfit >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider">Admin Profit</p>
                                <p className={`text-sm sm:text-lg lg:text-xl font-bold mt-1 truncate ${revenue.adminProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {formatCurrency(revenue.adminProfit)}
                                </p>
                            </div>
                        </div>

                        {/* Breakdown */}
                        <div className="bg-gray-800/80 rounded-xl border border-gray-700/60 p-3 sm:p-5">
                            <h3 className="text-sm font-semibold text-white mb-3">Revenue Breakdown</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between py-1.5 border-b border-gray-700/40">
                                    <span className="text-gray-400">Total Bet Amount</span>
                                    <span className="text-white font-medium">{formatCurrency(revenue.totalBetAmount)}</span>
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-gray-700/40">
                                    <span className="text-gray-400">Bookie Commission ({bookie?.commissionPercentage}%)</span>
                                    <span className="text-orange-400 font-medium">- {formatCurrency(revenue.bookieShare)}</span>
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-gray-700/40">
                                    <span className="text-gray-400">Admin Pool ({100 - (bookie?.commissionPercentage || 0)}%)</span>
                                    <span className="text-white font-medium">{formatCurrency(revenue.adminPool)}</span>
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-gray-700/40">
                                    <span className="text-gray-400">Winner Payouts</span>
                                    <span className="text-red-400 font-medium">- {formatCurrency(revenue.totalPayouts)}</span>
                                </div>
                                <div className="flex justify-between py-2 font-bold">
                                    <span className="text-amber-400">Admin Profit</span>
                                    <span className={revenue.adminProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}>{formatCurrency(revenue.adminProfit)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Quick stats */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-gray-800/60 rounded-lg p-3 text-center border border-gray-700/40">
                                <p className="text-[10px] sm:text-xs text-gray-500 uppercase">Total Users</p>
                                <p className="text-lg sm:text-xl font-bold text-white">{formatNumber(data?.totalUsers)}</p>
                            </div>
                            <div className="bg-gray-800/60 rounded-lg p-3 text-center border border-gray-700/40">
                                <p className="text-[10px] sm:text-xs text-gray-500 uppercase">Win Rate</p>
                                <p className="text-lg sm:text-xl font-bold text-white">{revenue.winRate}%</p>
                            </div>
                            <div className="bg-gray-800/60 rounded-lg p-3 text-center border border-gray-700/40">
                                <p className="text-[10px] sm:text-xs text-gray-500 uppercase">Total Bets</p>
                                <p className="text-lg sm:text-xl font-bold text-white">{formatNumber(revenue.totalBetCount)}</p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className="bg-gray-800/80 rounded-xl border border-gray-700/80 overflow-hidden">
                        <div className="px-3 sm:px-5 py-3 border-b border-gray-700/80">
                            <h3 className="text-sm sm:text-base font-semibold text-white">Users ({formatNumber(users.length)})</h3>
                        </div>

                        {/* Desktop table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-700/40 text-gray-400 text-[11px] uppercase tracking-wider">
                                        <th className="text-left px-4 py-2.5 font-medium">Player</th>
                                        <th className="text-right px-3 py-2.5 font-medium">Bets</th>
                                        <th className="text-right px-3 py-2.5 font-medium">Amount</th>
                                        <th className="text-right px-3 py-2.5 font-medium">Payouts</th>
                                        <th className="text-right px-3 py-2.5 font-medium">W/L</th>
                                        <th className="text-right px-4 py-2.5 font-medium">Profit</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700/40">
                                    {users.map((u) => (
                                        <tr key={u.userId} className="hover:bg-gray-700/20 transition-colors">
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full shrink-0 ${u.isActive ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                                    <Link to={`/all-users/${u.userId}`} className="font-medium text-white hover:text-amber-400 transition-colors">{u.username}</Link>
                                                </div>
                                                {u.phone && <p className="text-[11px] text-gray-500 ml-4">{u.phone}</p>}
                                            </td>
                                            <td className="text-right px-3 py-2.5 text-gray-300">{formatNumber(u.totalBets)}</td>
                                            <td className="text-right px-3 py-2.5 text-white font-medium">{formatCurrency(u.totalAmount)}</td>
                                            <td className="text-right px-3 py-2.5 text-red-400">{formatCurrency(u.totalPayout)}</td>
                                            <td className="text-right px-3 py-2.5 text-xs">
                                                <span className="text-emerald-400">{u.wins}</span>
                                                <span className="text-gray-600 mx-0.5">/</span>
                                                <span className="text-red-400">{u.losses}</span>
                                            </td>
                                            <td className={`text-right px-4 py-2.5 font-semibold ${u.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {formatCurrency(u.profit)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile cards */}
                        <div className="md:hidden divide-y divide-gray-700/40">
                            {users.map((u) => (
                                <div key={u.userId} className="p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className={`w-2 h-2 rounded-full shrink-0 ${u.isActive ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                            <Link to={`/all-users/${u.userId}`} className="font-medium text-white text-sm hover:text-amber-400 truncate">{u.username}</Link>
                                        </div>
                                        <span className={`text-xs font-semibold ${u.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {formatCurrency(u.profit)}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                                        <div>
                                            <span className="text-gray-500">Bets: </span>
                                            <span className="text-white">{formatCurrency(u.totalAmount)}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Pay: </span>
                                            <span className="text-red-400">{formatCurrency(u.totalPayout)}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">W/L: </span>
                                            <span className="text-emerald-400">{u.wins}</span>
                                            <span className="text-gray-600">/</span>
                                            <span className="text-red-400">{u.losses}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {users.length === 0 && (
                            <div className="p-8 text-center text-gray-500 text-sm">No users found for this bookie</div>
                        )}
                    </div>
                )}

                {activeTab === 'bets' && (
                    <div className="bg-gray-800/80 rounded-xl border border-gray-700/80 overflow-hidden">
                        <div className="px-3 sm:px-5 py-3 border-b border-gray-700/80">
                            <h3 className="text-sm sm:text-base font-semibold text-white">Recent Bets ({formatNumber(bets.length)})</h3>
                        </div>

                        <div className="divide-y divide-gray-700/40">
                            {bets.map((b) => (
                                <div key={b._id} className="p-3 sm:p-4 hover:bg-gray-700/20 transition-colors">
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-amber-400 font-mono font-medium text-sm">{b.betNumber}</span>
                                            <span className="text-gray-500 text-xs">{b.betType}</span>
                                            {b.betOn && <span className="text-gray-600 text-[10px] uppercase">({b.betOn})</span>}
                                        </div>
                                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                            b.status === 'won' ? 'bg-emerald-900/50 text-emerald-400' :
                                            b.status === 'lost' ? 'bg-red-900/50 text-red-400' :
                                            'bg-gray-600/50 text-gray-300'
                                        }`}>{b.status}</span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                                        <span><span className="text-gray-500">Player:</span> <span className="text-white">{b.username}</span></span>
                                        <span><span className="text-gray-500">Market:</span> <span className="text-gray-300">{b.marketName}</span></span>
                                        <span><span className="text-gray-500">Amt:</span> <span className="text-white font-mono">{formatCurrency(b.amount)}</span></span>
                                        {b.payout > 0 && (
                                            <span><span className="text-gray-500">Pay:</span> <span className="text-emerald-400 font-mono">{formatCurrency(b.payout)}</span></span>
                                        )}
                                        <span className="text-gray-600">{new Date(b.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {bets.length === 0 && (
                            <div className="p-8 text-center text-gray-500 text-sm">No bets found for this period</div>
                        )}
                    </div>
                )}

                {activeTab === 'profile' && bookie && (
                    <div className="bg-gray-800/80 rounded-xl border border-gray-700/80 p-4 sm:p-6">
                        <h3 className="text-sm sm:text-base font-semibold text-white mb-4">Bookie Profile</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                                    <FaUserTie className="w-4 h-4 text-amber-400" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Username</p>
                                    <p className="text-white text-sm font-medium truncate">{bookie.username}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                                    <FaPhone className="w-4 h-4 text-blue-400" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Phone</p>
                                    <p className="text-white text-sm font-medium">{bookie.phone || '—'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-purple-500/15 flex items-center justify-center shrink-0">
                                    <FaEnvelope className="w-4 h-4 text-purple-400" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Email</p>
                                    <p className="text-white text-sm font-medium truncate">{bookie.email || '—'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-orange-500/15 flex items-center justify-center shrink-0">
                                    <FaPercent className="w-4 h-4 text-orange-400" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Commission</p>
                                    <p className="text-orange-400 text-sm font-bold">{bookie.commissionPercentage}%</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                                    <FaUsers className="w-4 h-4 text-emerald-400" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Total Users</p>
                                    <p className="text-white text-sm font-medium">{formatNumber(data?.totalUsers)}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-cyan-500/15 flex items-center justify-center shrink-0">
                                    <FaClock className="w-4 h-4 text-cyan-400" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Created</p>
                                    <p className="text-white text-sm font-medium">{bookie.createdAt ? new Date(bookie.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${bookie.status === 'active' ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
                                    <div className={`w-3 h-3 rounded-full ${bookie.status === 'active' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Status</p>
                                    <p className={`text-sm font-medium capitalize ${bookie.status === 'active' ? 'text-emerald-400' : 'text-red-400'}`}>{bookie.status}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
};

export default BookieDetail;
