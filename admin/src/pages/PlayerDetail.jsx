import React, { useState, useEffect, useRef } from 'react';
import AdminLayout from '../components/AdminLayout';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { FaArrowLeft, FaCalendarAlt, FaUserSlash, FaUserCheck, FaTrash } from 'react-icons/fa';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const TABS = [
    { id: 'statement', label: 'Account Statement' },
    { id: 'wallet', label: 'Wallet Statement' },
    { id: 'bets', label: 'Bet History' },
    { id: 'profile', label: 'Profile' },
    { id: 'exposure', label: 'Exposure' },
];

const getAuthHeaders = () => {
    const admin = JSON.parse(localStorage.getItem('admin') || '{}');
    const password = sessionStorage.getItem('adminPassword') || '';
    return {
        'Content-Type': 'application/json',
        Authorization: `Basic ${btoa(`${admin.username}:${password}`)}`,
    };
};

const formatDateRange = (from, to) => {
    if (!from || !to) return '';
    const a = new Date(from);
    const b = new Date(to);
    return `${a.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' })} ~ ${b.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' })}`;
};

const STATEMENT_PRESETS = [
    { id: 'today', label: '1 Day (Today)', getRange: () => {
        const d = new Date();
        const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return { from, to: from };
    }},
    { id: 'tomorrow', label: 'Tomorrow', getRange: () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

const PlayerDetail = () => {
    const { userId } = useParams();
    const navigate = useNavigate();
    const [player, setPlayer] = useState(null);
    const [activeTab, setActiveTab] = useState('statement');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [statementFrom, setStatementFrom] = useState('');
    const [statementTo, setStatementTo] = useState('');
    const [statementPreset, setStatementPreset] = useState('today');
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [statementData, setStatementData] = useState([]);
    const [walletTx, setWalletTx] = useState([]);
    const [bets, setBets] = useState([]);
    const [loadingTab, setLoadingTab] = useState(false);
    const [togglingStatus, setTogglingStatus] = useState(false);
    const [toggleMessage, setToggleMessage] = useState('');
    const [deletingPlayer, setDeletingPlayer] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const admin = localStorage.getItem('admin');
        if (!admin) {
            navigate('/');
            return;
        }
        fetchPlayer();
    }, [userId, navigate]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setCalendarOpen(false);
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!statementFrom || !statementTo) {
            const preset = STATEMENT_PRESETS.find((p) => p.id === 'today');
            const { from, to } = preset ? preset.getRange() : { from: '', to: '' };
            if (from) setStatementFrom(from);
            if (to) setStatementTo(to);
        }
    }, []);

    useEffect(() => {
        if (!userId || !player) return;
        if (activeTab === 'statement' && statementFrom && statementTo) fetchStatement();
        if (activeTab === 'wallet') fetchWalletTx();
        if (activeTab === 'bets') fetchBets();
    }, [activeTab, userId, player, statementFrom, statementTo]);

    const fetchPlayer = async () => {
        try {
            setLoading(true);
            setError('');
            const res = await fetch(`${API_BASE_URL}/users/${userId}`, { headers: getAuthHeaders() });
            const data = await res.json();
            if (data.success) {
                setPlayer(data.data);
            } else {
                setError(data.message || 'Player not found');
            }
        } catch (err) {
            setError('Failed to load player');
        } finally {
            setLoading(false);
        }
    };

    const fetchStatement = async () => {
        if (!userId) return;
        setLoadingTab(true);
        try {
            const [betsRes, txRes] = await Promise.all([
                fetch(`${API_BASE_URL}/bets/history?userId=${userId}&startDate=${statementFrom}&endDate=${statementTo}`, { headers: getAuthHeaders() }),
                fetch(`${API_BASE_URL}/wallet/transactions?userId=${userId}`, { headers: getAuthHeaders() }),
            ]);
            const betsData = await betsRes.json();
            const txData = await txRes.json();
            const betList = betsData.success ? betsData.data || [] : [];
            const txList = txData.success ? txData.data || [] : [];

            const start = new Date(statementFrom);
            start.setHours(0, 0, 0, 0);
            const end = new Date(statementTo);
            end.setHours(23, 59, 59, 999);

            const betRows = betList
                .filter((b) => {
                    const d = new Date(b.createdAt);
                    return d >= start && d <= end;
                })
                .map((b) => ({
                    date: new Date(b.createdAt),
                    type: b.marketId?.marketName || 'Bet',
                    name: b.betNumber || b._id?.slice(-6),
                    status: b.status === 'won' ? 'WIN' : b.status === 'lost' ? 'LOST' : 'BET',
                    credited: b.status === 'won' ? (b.payout || 0) : 0,
                    debited: b.status !== 'won' ? (b.amount || 0) : 0,
                    kind: 'bet',
                }));

            const txRows = txList
                .filter((t) => {
                    const d = new Date(t.createdAt);
                    return d >= start && d <= end;
                })
                .map((t) => ({
                    date: new Date(t.createdAt),
                    type: 'Wallet',
                    name: t.description || t._id?.slice(-6),
                    status: t.type === 'credit' ? 'CREDIT' : 'DEBIT',
                    credited: t.type === 'credit' ? (t.amount || 0) : 0,
                    debited: t.type === 'debit' ? (t.amount || 0) : 0,
                    kind: 'wallet',
                }));

            const merged = [...betRows, ...txRows].sort((a, b) => a.date - b.date);
            let running = 0;
            let runningBonus = 0;
            let runningExchange = 0;
            const withBalance = merged.map((r) => {
                const lastBalance = running;
                running = running + (r.credited || 0) - (r.debited || 0);
                return {
                    ...r,
                    lastBalance,
                    runningBalance: running,
                    lastBonusBalance: runningBonus,
                    runningBonusBalance: runningBonus,
                    lastExchangeBalance: runningExchange,
                    runningExchangeBalance: runningExchange,
                };
            });
            setStatementData(withBalance);
        } catch (err) {
            setStatementData([]);
        } finally {
            setLoadingTab(false);
        }
    };

    const fetchWalletTx = async () => {
        if (!userId) return;
        setLoadingTab(true);
        try {
            const res = await fetch(`${API_BASE_URL}/wallet/transactions?userId=${userId}`, { headers: getAuthHeaders() });
            const data = await res.json();
            setWalletTx(data.success ? (data.data || []).reverse() : []);
        } catch (err) {
            setWalletTx([]);
        } finally {
            setLoadingTab(false);
        }
    };

    const fetchBets = async () => {
        if (!userId) return;
        setLoadingTab(true);
        try {
            const res = await fetch(`${API_BASE_URL}/bets/history?userId=${userId}`, { headers: getAuthHeaders() });
            const data = await res.json();
            setBets(data.success ? data.data || [] : []);
        } catch (err) {
            setBets([]);
        } finally {
            setLoadingTab(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('admin');
        sessionStorage.removeItem('adminPassword');
        navigate('/');
    };

    const handleDateApply = () => {
        setStatementPreset('custom');
        setCalendarOpen(false);
        if (activeTab === 'statement') fetchStatement();
    };

    const handleTogglePlayerStatus = async () => {
        if (!userId) return;
        setTogglingStatus(true);
        setToggleMessage('');
        setError('');
        try {
            const res = await fetch(`${API_BASE_URL}/users/${userId}/toggle-status`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
            });
            const data = await res.json();
            if (data.success) {
                setToggleMessage(data.data.isActive ? 'Player unsuspended successfully' : 'Player suspended successfully');
                fetchPlayer();
                setTimeout(() => setToggleMessage(''), 3000);
            } else {
                setToggleMessage(data.message || 'Failed to update status');
            }
        } catch (err) {
            setToggleMessage('Network error. Please try again.');
        } finally {
            setTogglingStatus(false);
        }
    };

    const handlePresetSelect = (presetId) => {
        const preset = STATEMENT_PRESETS.find((p) => p.id === presetId);
        if (preset) {
            const { from, to } = preset.getRange();
            setStatementFrom(from);
            setStatementTo(to);
            setStatementPreset(presetId);
            setCalendarOpen(false);
            if (activeTab === 'statement') fetchStatement();
        }
    };

    const handleDeletePlayer = async () => {
        if (!userId || !player?.username) return;
        if (!window.confirm(`Delete player "${player.username}"? This will remove their account and wallet. This cannot be undone.`)) {
            return;
        }
        setDeletingPlayer(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE_URL}/users/${userId}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
            });
            const data = await res.json();
            if (data.success) {
                navigate('/all-users');
            } else {
                setError(data.message || 'Failed to delete player');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setDeletingPlayer(false);
        }
    };

    const formatCurrency = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

    const formatIpDisplay = (ip) => {
        if (!ip) return '—';
        const trimmed = String(ip).trim();
        if (trimmed === '::1' || trimmed === '127.0.0.1') return 'localhost';
        return trimmed;
    };

    if (loading) {
        return (
            <AdminLayout onLogout={handleLogout} title="Players">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 w-48 bg-gray-700 rounded" />
                    <div className="h-24 bg-gray-700 rounded-xl" />
                    <div className="h-10 w-full bg-gray-700 rounded" />
                </div>
            </AdminLayout>
        );
    }

    if (error || !player) {
        return (
            <AdminLayout onLogout={handleLogout} title="Players">
                <div className="flex flex-col items-center justify-center min-h-[40vh]">
                    <p className="text-red-400 mb-4">{error || 'Player not found'}</p>
                    <Link to="/all-users" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500 text-black font-semibold">
                        <FaArrowLeft /> Back to All Players
                    </Link>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout onLogout={handleLogout} title="Players">
            <div className="min-w-0 max-w-full">
            {/* Breadcrumb */}
            <div className="mb-4">
                <Link to="/all-users" className="text-gray-400 hover:text-yellow-500 text-sm inline-flex items-center gap-1 mb-2">
                    <FaArrowLeft className="w-4 h-4" /> All Players
                </Link>
                <h1 className="text-2xl sm:text-3xl font-bold">Players <span className="text-gray-400 font-normal">» {player.username}</span></h1>
            </div>

            {/* Player info card - responsive, no overflow */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden mb-6 min-w-0">
                <div className="px-4 sm:px-6 py-4 border-b border-gray-700 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-yellow-500">Player Information</h2>
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={handleTogglePlayerStatus}
                            disabled={togglingStatus}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                player.isActive !== false
                                    ? 'bg-red-600 hover:bg-red-500 text-white'
                                    : 'bg-green-600 hover:bg-green-500 text-white'
                            }`}
                        >
                            {togglingStatus ? (
                                <span className="animate-spin">⏳</span>
                            ) : player.isActive !== false ? (
                                <><FaUserSlash className="w-4 h-4" /> Suspend</>
                            ) : (
                                <><FaUserCheck className="w-4 h-4" /> Unsuspend</>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={handleDeletePlayer}
                            disabled={deletingPlayer}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-gray-600 hover:bg-red-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete player"
                        >
                            {deletingPlayer ? <span className="animate-spin">⏳</span> : <><FaTrash className="w-4 h-4" /> Delete</>}
                        </button>
                        {toggleMessage && (
                            <span className={`text-sm ${toggleMessage.includes('success') ? 'text-green-400' : 'text-red-400'}`}>
                                {toggleMessage}
                            </span>
                        )}
                    </div>
                </div>
                <div className="p-4 sm:p-6 min-w-0">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 text-sm">
                        <div className="min-w-0">
                            <p className="text-gray-500 uppercase tracking-wider text-xs">UserID</p>
                            <p className="text-white font-mono truncate" title={player.username}>{player.username}</p>
                        </div>
                        <div className="min-w-0">
                            <p className="text-gray-500 uppercase tracking-wider text-xs">First Name</p>
                            <p className="text-white truncate">{player.username || '—'}</p>
                        </div>
                        <div className="min-w-0">
                            <p className="text-gray-500 uppercase tracking-wider text-xs">Last Name</p>
                            <p className="text-white">—</p>
                        </div>
                        <div className="min-w-0">
                            <p className="text-gray-500 uppercase tracking-wider text-xs">Email</p>
                            <p className="text-white truncate" title={player.email}>{player.email || '—'}</p>
                        </div>
                        <div className="min-w-0">
                            <p className="text-gray-500 uppercase tracking-wider text-xs">Username</p>
                            <p className="text-white truncate">{player.username}</p>
                        </div>
                        <div className="min-w-0 col-span-2 sm:col-span-1">
                            <p className="text-gray-500 uppercase tracking-wider text-xs">Id</p>
                            <p className="text-gray-300 font-mono text-xs truncate break-all" title={player._id}>{player._id}</p>
                        </div>
                        <div className="min-w-0 col-span-2 sm:col-span-1">
                            <p className="text-gray-500 uppercase tracking-wider text-xs">Device ID</p>
                            <p className="text-gray-300 font-mono text-xs truncate break-all" title={player.lastLoginDeviceId || ''}>{player.lastLoginDeviceId || '—'}</p>
                        </div>
                        <div className="min-w-0">
                            <p className="text-gray-500 uppercase tracking-wider text-xs">IP Address</p>
                            <p className="text-gray-300 font-mono text-xs truncate" title={player.lastLoginIp || ''}>{formatIpDisplay(player.lastLoginIp)}</p>
                        </div>
                        <div className="min-w-0">
                            <p className="text-gray-500 uppercase tracking-wider text-xs">Status</p>
                            <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${player.isActive !== false ? 'bg-green-900/50 text-green-400 border border-green-700' : 'bg-red-900/50 text-red-400 border border-red-700'}`}>
                                {player.isActive !== false ? 'ALLOW' : 'SUSPENDED'}
                            </span>
                        </div>
                        <div className="min-w-0">
                            <p className="text-gray-500 uppercase tracking-wider text-xs">Balance</p>
                            <p className="text-green-400 font-mono font-semibold">{player.walletBalance ?? 0}</p>
                        </div>
                        <div className="min-w-0">
                            <p className="text-gray-500 uppercase tracking-wider text-xs">Exchange Balance</p>
                            <p className="text-gray-300">0</p>
                        </div>
                        <div className="min-w-0">
                            <p className="text-gray-500 uppercase tracking-wider text-xs">Bonus Balance</p>
                            <p className="text-gray-300">0</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Multiple devices warning + Devices list (admin-only) */}
            {Array.isArray(player.loginDevices) && player.loginDevices.length > 1 && (
                <div className="mb-6 min-w-0">
                    <div className="rounded-xl border border-amber-500/60 bg-amber-500/10 px-4 py-3 text-amber-200 text-sm font-medium">
                        ⚠️ User has logged in from multiple devices
                    </div>
                </div>
            )}
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden mb-6 min-w-0">
                <div className="px-4 sm:px-6 py-3 border-b border-gray-700">
                    <h2 className="text-base font-semibold text-yellow-500">Devices used</h2>
                </div>
                <div className="p-4 sm:p-6 min-w-0 overflow-x-auto">
                    {!player.loginDevices || player.loginDevices.length === 0 ? (
                        <p className="text-gray-500 text-sm">—</p>
                    ) : (
                        <table className="w-full text-sm min-w-[320px]">
                            <thead>
                                <tr className="border-b border-gray-600">
                                    <th className="text-left py-2.5 pr-4 text-xs font-medium text-gray-400 uppercase">Device ID</th>
                                    <th className="text-left py-2.5 pr-4 text-xs font-medium text-gray-400 uppercase">First Login Date</th>
                                    <th className="text-left py-2.5 pr-4 text-xs font-medium text-gray-400 uppercase">Last Login Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {player.loginDevices.map((d, i) => (
                                    <tr key={(d.deviceId || i).toString()} className="hover:bg-gray-700/30">
                                        <td className="py-2.5 pr-4 font-mono text-gray-300 truncate max-w-[200px] sm:max-w-none" title={d.deviceId}>{d.deviceId || '—'}</td>
                                        <td className="py-2.5 pr-4 text-gray-400">
                                            {d.firstLoginAt ? new Date(d.firstLoginAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                                        </td>
                                        <td className="py-2.5 pr-4 text-gray-400">
                                            {d.lastLoginAt ? new Date(d.lastLoginAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Date range - visible for all tabs (Statement, Wallet, Bet History, Profile, Exposure) */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-gray-400 text-sm">Date range:</span>
                    <div className="relative" ref={dropdownRef}>
                        <button
                            type="button"
                            onClick={() => setCalendarOpen((o) => !o)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-sm text-gray-200"
                        >
                            <FaCalendarAlt className="w-4 h-4 text-yellow-500" />
                            {statementFrom && statementTo ? formatDateRange(statementFrom, statementTo) : 'Select Date'}
                        </button>
                        {calendarOpen && (
                            <div className="absolute left-0 top-full mt-2 py-3 rounded-xl bg-gray-800 border border-gray-600 shadow-xl z-50 flex flex-col sm:flex-row gap-4 max-w-[100vw]">
                                <div className="min-w-0 sm:min-w-[200px] py-1">
                                    {STATEMENT_PRESETS.map((p) => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => handlePresetSelect(p.id)}
                                            className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
                                        >
                                            {statementPreset === p.id ? <span className="text-yellow-500">●</span> : <span className="w-2" />}
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="border-t sm:border-t-0 sm:border-l border-gray-600 pt-3 sm:pt-0 sm:pl-4 pr-4 min-w-0 sm:min-w-[200px]">
                                    <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Custom Date Range</div>
                                    <div className="space-y-2">
                                        <div>
                                            <label className="block text-xs text-gray-400 mb-1">From</label>
                                            <input type="date" value={statementFrom} onChange={(e) => setStatementFrom(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-sm text-white" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-400 mb-1">To</label>
                                            <input type="date" value={statementTo} onChange={(e) => setStatementTo(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-sm text-white" />
                                        </div>
                                        <button type="button" onClick={handleDateApply} className="w-full py-2 rounded-lg bg-yellow-500 text-black font-semibold text-sm">
                                            Apply
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-4 border-b border-gray-700 pb-2">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${activeTab === tab.id ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab content - no horizontal scroll, responsive */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden min-h-[200px] min-w-0 max-w-full">
                {activeTab === 'statement' && (
                    <>
                        {loadingTab ? (
                            <div className="p-8 text-center text-gray-400">Loading...</div>
                        ) : statementData.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">No transactions in this period.</div>
                        ) : (
                            <>
                                {/* Statement: cards with ALL detail - no side scroll */}
                                <div className="divide-y divide-gray-700">
                                    {statementData.map((row, i) => (
                                        <div key={i} className="p-4 sm:p-5 hover:bg-gray-700/20">
                                            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-gray-600/50">
                                                <span className="text-yellow-400 font-mono font-medium">{row.name}</span>
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${row.status === 'WIN' || row.status === 'CREDIT' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>{row.status}</span>
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs">
                                                <div className="min-w-0"><p className="text-gray-500 uppercase tracking-wider mb-0.5">Type</p><p className="text-gray-200 truncate">{row.type}</p></div>
                                                <div className="min-w-0"><p className="text-gray-500 uppercase tracking-wider mb-0.5">Name</p><p className="text-yellow-400 font-mono truncate">{row.name}</p></div>
                                                <div className="min-w-0"><p className="text-gray-500 uppercase tracking-wider mb-0.5">Status</p><p className="text-gray-200">{row.status}</p></div>
                                                <div className="min-w-0"><p className="text-gray-500 uppercase tracking-wider mb-0.5">Last Balance</p><p className="text-gray-300 font-mono">{row.lastBalance}</p></div>
                                                <div className="min-w-0"><p className="text-gray-500 uppercase tracking-wider mb-0.5">Credited</p><p className="text-green-400 font-mono">{row.credited || '—'}</p></div>
                                                <div className="min-w-0"><p className="text-gray-500 uppercase tracking-wider mb-0.5">Debited</p><p className="text-red-400 font-mono">{row.debited || '—'}</p></div>
                                                <div className="min-w-0"><p className="text-gray-500 uppercase tracking-wider mb-0.5">Running Balance</p><p className="text-white font-mono font-medium">{row.runningBalance}</p></div>
                                                <div className="min-w-0"><p className="text-gray-500 uppercase tracking-wider mb-0.5">Last Bonus Balance</p><p className="text-gray-400 font-mono">{row.lastBonusBalance ?? 0}</p></div>
                                                <div className="min-w-0"><p className="text-gray-500 uppercase tracking-wider mb-0.5">Running Bonus Balance</p><p className="text-gray-400 font-mono">{row.runningBonusBalance ?? 0}</p></div>
                                                <div className="min-w-0"><p className="text-gray-500 uppercase tracking-wider mb-0.5">Last Exchange Balance</p><p className="text-gray-400 font-mono">{row.lastExchangeBalance ?? 0}</p></div>
                                                <div className="min-w-0"><p className="text-gray-500 uppercase tracking-wider mb-0.5">Running Exchange Balance</p><p className="text-gray-400 font-mono">{row.runningExchangeBalance ?? 0}</p></div>
                                                <div className="min-w-0 col-span-2 sm:col-span-1"><p className="text-gray-500 uppercase tracking-wider mb-0.5">Updated</p><p className="text-gray-400">{row.date.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</p></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </>
                )}

                {activeTab === 'wallet' && (
                    <>
                        {loadingTab ? (
                            <div className="p-8 text-center text-gray-400">Loading...</div>
                        ) : walletTx.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">No wallet transactions.</div>
                        ) : (
                            <div className="divide-y divide-gray-700 min-w-0">
                                {walletTx.map((t) => (
                                    <div key={t._id} className="p-4 hover:bg-gray-700/20 flex flex-wrap items-center justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mr-2 ${t.type === 'credit' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>{t.type}</span>
                                            <span className="text-gray-200 text-sm break-words">{t.description || '—'}</span>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <span className="font-mono font-medium text-sm">{t.type === 'credit' ? '+' : '-'}{formatCurrency(t.amount)}</span>
                                            <span className="text-gray-400 text-xs">{new Date(t.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'bets' && (
                    <>
                        {loadingTab ? (
                            <div className="p-8 text-center text-gray-400">Loading...</div>
                        ) : bets.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">No bets.</div>
                        ) : (
                            <div className="divide-y divide-gray-700 min-w-0">
                                {bets.map((b) => (
                                    <div key={b._id} className="p-4 hover:bg-gray-700/20">
                                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                            <span className="text-yellow-400 font-mono font-medium">{b.betNumber}</span>
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${b.status === 'won' ? 'bg-green-900/50 text-green-400' : b.status === 'lost' ? 'bg-red-900/50 text-red-400' : 'bg-gray-600 text-gray-300'}`}>{b.status}</span>
                                        </div>
                                        <p className="text-gray-400 text-xs mb-2">{b.marketId?.marketName || '—'} · {b.betType || '—'}</p>
                                        <div className="flex flex-wrap gap-4 text-sm">
                                            <span><span className="text-gray-500">Amount</span> <span className="text-white font-mono">{formatCurrency(b.amount)}</span></span>
                                            <span><span className="text-gray-500">Payout</span> <span className="text-green-400 font-mono">{formatCurrency(b.payout)}</span></span>
                                            <span className="text-gray-400 text-xs">{new Date(b.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'profile' && (
                    <div className="p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                            <div><p className="text-gray-500 text-sm">Username</p><p className="text-white">{player.username}</p></div>
                            <div><p className="text-gray-500 text-sm">Email</p><p className="text-white">{player.email}</p></div>
                            <div><p className="text-gray-500 text-sm">Phone</p><p className="text-white">{player.phone || '—'}</p></div>
                            <div><p className="text-gray-500 text-sm">Role</p><p className="text-white capitalize">{player.role || 'Player'}</p></div>
                            <div><p className="text-gray-500 text-sm">Source</p><p className="text-white">{player.source === 'bookie' ? 'Bookie' : 'Super Admin'}</p></div>
                            <div><p className="text-gray-500 text-sm">Created</p><p className="text-white">{player.createdAt ? new Date(player.createdAt).toLocaleString('en-IN') : '—'}</p></div>
                        </div>
                    </div>
                )}

                {activeTab === 'exposure' && (
                    <div className="p-8 text-center text-gray-500">
                        Exposure data will be shown here when available.
                    </div>
                )}
            </div>
            </div>
        </AdminLayout>
    );
};

export default PlayerDetail;
