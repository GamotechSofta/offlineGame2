import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    FaArrowLeft,
    FaMoneyBillWave,
    FaSyncAlt,
    FaSearch,
    FaWallet,
    FaUsers,
    FaChartLine,
    FaCheckCircle,
    FaList,
    FaArrowUp,
    FaArrowDown,
} from 'react-icons/fa';
import AdminLayout from '../components/AdminLayout';
import { TOP_LEVEL_LABEL, SUB_LEVEL_LABEL } from '../config/roleLabels';
import { clearAdminSession, fetchWithAuth } from '../lib/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const TABS = [
    { id: 'players', label: 'Players', icon: FaUsers },
    { id: 'commission', label: 'Commission', icon: FaMoneyBillWave },
    { id: 'wallet', label: 'Wallet transactions', icon: FaList },
];

const formatCurrency = (value) => {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(amount);
};

const formatDateTime = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const StatCard = ({ icon: Icon, label, value, accent }) => (
    <div className={`rounded-xl border p-4 ${accent}`}>
        <p className="text-[10px] sm:text-xs uppercase tracking-wide text-gray-500 flex items-center gap-1.5">
            <Icon className="w-3.5 h-3.5 shrink-0" />
            {label}
        </p>
        <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
);

const SuperBookieCommissionDashboard = () => {
    const { bookieId, superBookieId } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [playerList, setPlayerList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [playersLoading, setPlayersLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('players');
    const [searchText, setSearchText] = useState('');

    const handleLogout = () => {
        clearAdminSession();
        navigate('/');
    };

    const fetchDashboard = useCallback(async () => {
        if (!bookieId || !superBookieId) return;
        setLoading(true);
        setError('');
        try {
            const response = await fetchWithAuth(
                `${API_BASE_URL}/admin/bookies/${bookieId}/super-bookies/${superBookieId}/commission-dashboard`,
            );
            if (response.status === 401) return;
            const json = await response.json();
            if (json.success) {
                setData(json.data);
            } else {
                setError(json.message || 'Failed to load');
            }
        } catch {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    }, [bookieId, superBookieId]);

    const loadPlayers = useCallback(async () => {
        if (!bookieId || !superBookieId || playerList.length > 0) return;
        setPlayersLoading(true);
        try {
            const res = await fetchWithAuth(
                `${API_BASE_URL}/admin/bookies/${bookieId}/super-bookies/${superBookieId}/players`,
            );
            const json = await res.json();
            if (json.success) setPlayerList(json.data || []);
        } catch {
            /* ignore */
        } finally {
            setPlayersLoading(false);
        }
    }, [bookieId, superBookieId, playerList.length]);

    useEffect(() => {
        if (!localStorage.getItem('admin')) {
            navigate('/');
            return;
        }
        fetchDashboard();
    }, [fetchDashboard, navigate]);

    useEffect(() => {
        if (activeTab === 'players') loadPlayers();
    }, [activeTab, loadPlayers]);

    const top = data?.topDashboard || {};
    const rev = data?.revenueKpis || {};
    const walletTxs = data?.walletTransactions || [];
    const payments = data?.payments || [];
    const summary = data?.summary || {};

    const filteredPlayerList = useMemo(() => {
        const q = searchText.trim().toLowerCase();
        if (!q) return playerList;
        return playerList.filter(
            (p) =>
                String(p.username || '').toLowerCase().includes(q)
                || String(p.phone || '').toLowerCase().includes(q),
        );
    }, [playerList, searchText]);

    const sbName = data?.superBookie?.username || SUB_LEVEL_LABEL;
    const parentName = data?.parentBookie?.username || TOP_LEVEL_LABEL;

    return (
        <AdminLayout onLogout={handleLogout} title={`${SUB_LEVEL_LABEL} dashboard`}>
            <div className="min-w-0 max-w-6xl mx-auto space-y-4">
                <div>
                    <Link
                        to={`/bookie-management/${bookieId}`}
                        className="text-gray-500 hover:text-orange-600 text-sm inline-flex items-center gap-1 mb-2"
                    >
                        <FaArrowLeft className="w-3 h-3" />
                        Back to {parentName}
                    </Link>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">{sbName}</h1>
                            <p className="text-sm text-gray-500">
                                {SUB_LEVEL_LABEL} · {Number(data?.superBookie?.commissionPercentage ?? 0)}% commission
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={fetchDashboard}
                            disabled={loading}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
                        >
                            <FaSyncAlt className={loading ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {loading && !data ? (
                    <div className="py-16 text-center text-gray-500 flex justify-center gap-2">
                        <FaSyncAlt className="animate-spin" /> Loading...
                    </div>
                ) : data ? (
                    <>
                        <section className="space-y-2">
                            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                <FaChartLine className="text-green-600" />
                                Revenue ({data?.dateRange?.periodLabel || rev.periodLabel || 'Today'})
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                                <div className="rounded-xl p-4 border border-green-200 bg-gradient-to-br from-green-50 to-transparent">
                                    <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">
                                        Total bet amount
                                    </p>
                                    <p className="text-2xl font-bold text-green-600 font-mono">
                                        {formatCurrency(rev.totalBetAmount)}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">Total bet amount collected</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Matka: <span className="font-medium">{formatCurrency(rev.matkaBetAmount)}</span>
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        2D & 3D: <span className="font-medium">{formatCurrency(rev.lotteryBetAmount)}</span>
                                    </p>
                                </div>
                                <div className="rounded-xl p-4 border border-red-200 bg-gradient-to-br from-red-50 to-transparent">
                                    <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">To received</p>
                                    <p className="text-2xl font-bold text-red-600 font-mono">{formatCurrency(rev.toTake)}</p>
                                    <p className="text-xs text-gray-500 mt-1">Money to take from players</p>
                                </div>
                                <div className="rounded-xl p-4 border border-blue-200 bg-gradient-to-br from-blue-50 to-transparent">
                                    <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">To give</p>
                                    <p className="text-2xl font-bold text-blue-600 font-mono">{formatCurrency(rev.toGive)}</p>
                                    <p className="text-xs text-gray-500 mt-1">Money to give to players</p>
                                </div>
                                <div className="rounded-xl p-4 border border-[#1B3150]/20 bg-gradient-to-br from-[#1B3150]/5 to-transparent">
                                    <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Pending</p>
                                    <p className="text-2xl font-bold text-[#1B3150] font-mono">
                                        {formatCurrency(rev.pendingAmount)}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">Pending bets amount</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        2D net: <span className="font-medium">{formatCurrency(rev.twoDNet)}</span> · 3D
                                        net: <span className="font-medium">{formatCurrency(rev.threeDNet)}</span>
                                    </p>
                                </div>
                                <div className="rounded-xl p-4 border border-purple-200 bg-gradient-to-br from-purple-50 to-transparent">
                                    <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Total profit</p>
                                    <p className="text-2xl font-bold text-purple-600 font-mono">
                                        {formatCurrency(rev.totalProfit)}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Matka net + lottery net + (to take − to give)
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Lottery — 2D: <span className="font-medium">{formatCurrency(rev.twoDNet)}</span>{' '}
                                        · 3D: <span className="font-medium">{formatCurrency(rev.threeDNet)}</span>
                                    </p>
                                </div>
                            </div>
                        </section>

                        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <StatCard
                                icon={FaChartLine}
                                label="All bookie revenue (bets)"
                                value={formatCurrency(top.totalRevenue)}
                                accent="bg-blue-50 border-blue-100"
                            />
                            <StatCard
                                icon={FaWallet}
                                label="Bookie wallet balance"
                                value={formatCurrency(top.walletBalance)}
                                accent="bg-emerald-50 border-emerald-100"
                            />
                            <StatCard
                                icon={FaCheckCircle}
                                label="Commission settled"
                                value={formatCurrency(top.commissionSettled)}
                                accent="bg-violet-50 border-violet-100"
                            />
                            <StatCard
                                icon={FaUsers}
                                label="Total players"
                                value={String(top.totalPlayers ?? 0)}
                                accent="bg-orange-50 border-orange-100"
                            />
                        </section>

                        <div className="flex flex-wrap gap-2">
                            {TABS.map((tab) => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => {
                                            setActiveTab(isActive ? '' : tab.id);
                                            setSearchText('');
                                        }}
                                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                                            isActive
                                                ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                                                : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300 hover:bg-orange-50'
                                        }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>

                        {!activeTab && (
                            <p className="text-sm text-gray-500 text-center py-8 rounded-xl border border-dashed border-gray-200 bg-gray-50/80">
                                Select Players, Commission, or Wallet transactions to view details.
                            </p>
                        )}

                        {activeTab === 'players' && (
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2">
                                    <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                                        <FaUsers className="text-indigo-600" />
                                        Players ({filteredPlayerList.length})
                                    </h2>
                                    <div className="relative w-full sm:max-w-xs">
                                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3 h-3" />
                                        <input
                                            value={searchText}
                                            onChange={(e) => setSearchText(e.target.value)}
                                            placeholder="Search player..."
                                            className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 text-sm"
                                        />
                                    </div>
                                </div>
                                {playersLoading ? (
                                    <p className="p-8 text-center text-gray-500 text-sm">Loading players...</p>
                                ) : filteredPlayerList.length === 0 ? (
                                    <p className="p-8 text-center text-gray-500 text-sm">No players found.</p>
                                ) : (
                                    <ul className="divide-y divide-gray-100 max-h-[28rem] overflow-y-auto">
                                        {filteredPlayerList.map((p) => (
                                            <li
                                                key={p._id}
                                                className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm hover:bg-gray-50"
                                            >
                                                <Link
                                                    to={`/all-users/${p._id}`}
                                                    className="font-medium text-orange-600 hover:underline"
                                                >
                                                    {p.username}
                                                </Link>
                                                <span className="text-gray-500 text-xs">{p.phone || '—'}</span>
                                                <span className="font-mono text-green-700 text-xs">
                                                    ₹{Math.floor(Number(p.walletBalance ?? 0)).toLocaleString('en-IN')}
                                                </span>
                                                <span
                                                    className={`text-xs px-2 py-0.5 rounded-full ${
                                                        p.isActive !== false
                                                            ? 'bg-emerald-50 text-emerald-700'
                                                            : 'bg-rose-50 text-rose-600'
                                                    }`}
                                                >
                                                    {p.isActive !== false ? 'Active' : 'Suspended'}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}

                        {activeTab === 'commission' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                                    <div className="rounded-lg bg-slate-50 border p-3">
                                        <p className="text-xs text-gray-500">Total commission</p>
                                        <p className="font-bold">{formatCurrency(top.totalCommission)}</p>
                                    </div>
                                    <div className="rounded-lg bg-green-50 border border-green-100 p-3">
                                        <p className="text-xs text-gray-500">Settled</p>
                                        <p className="font-bold text-green-700">
                                            {formatCurrency(top.commissionSettled)}
                                        </p>
                                    </div>
                                    <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
                                        <p className="text-xs text-gray-500">Pending</p>
                                        <p className="font-bold text-amber-700">
                                            {formatCurrency(top.commissionPending)}
                                        </p>
                                    </div>
                                    <div className="rounded-lg bg-violet-50 border border-violet-100 p-3">
                                        <p className="text-xs text-gray-500">Advance remaining</p>
                                        <p className="font-bold text-violet-800">
                                            {formatCurrency(summary.advanceOutstanding ?? 0)}
                                        </p>
                                    </div>
                                </div>

                                {payments.length > 0 && (
                                    <div className="bg-white rounded-xl border p-4">
                                        <h3 className="font-semibold text-gray-800 mb-2">Payment history</h3>
                                        <ul className="divide-y text-sm max-h-40 overflow-y-auto">
                                            {payments.map((p) => (
                                                <li key={p._id} className="py-2 flex justify-between">
                                                    <span className="text-gray-600">
                                                        {formatDateTime(p.createdAt)} · {p.paymentType}
                                                    </span>
                                                    <span className="font-semibold text-green-700">
                                                        {formatCurrency(p.amount)}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'wallet' && (
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                <div className="px-4 py-3 border-b">
                                    <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                                        <FaList className="text-gray-600" />
                                        Wallet transactions ({walletTxs.length})
                                    </h2>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Current balance: {formatCurrency(top.walletBalance)}
                                    </p>
                                </div>
                                {walletTxs.length === 0 ? (
                                    <p className="p-8 text-center text-gray-500 text-sm">No wallet transactions yet.</p>
                                ) : (
                                    <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50 text-xs uppercase text-gray-500 sticky top-0">
                                                <tr>
                                                    <th className="text-left px-3 py-2">Date</th>
                                                    <th className="text-left px-3 py-2">Type</th>
                                                    <th className="text-right px-3 py-2">Amount</th>
                                                    <th className="text-right px-3 py-2">Balance after</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {walletTxs.map((tx) => (
                                                    <tr key={tx._id} className="hover:bg-gray-50">
                                                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">
                                                            {formatDateTime(tx.createdAt)}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <p className="font-medium text-gray-800">{tx.label}</p>
                                                            {tx.description && (
                                                                <p className="text-[10px] text-gray-500 truncate max-w-[200px]">
                                                                    {tx.description}
                                                                </p>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2 text-right">
                                                            <span
                                                                className={`inline-flex items-center gap-0.5 font-semibold ${
                                                                    tx.direction === 'credit'
                                                                        ? 'text-green-600'
                                                                        : 'text-red-600'
                                                                }`}
                                                            >
                                                                {tx.direction === 'credit' ? (
                                                                    <FaArrowUp className="w-3 h-3" />
                                                                ) : (
                                                                    <FaArrowDown className="w-3 h-3" />
                                                                )}
                                                                {tx.direction === 'credit' ? '+' : '-'}
                                                                {formatCurrency(tx.amount)}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-medium">
                                                            {formatCurrency(tx.balanceAfter)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                ) : null}
            </div>
        </AdminLayout>
    );
};

export default SuperBookieCommissionDashboard;
