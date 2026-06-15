import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    FaSearch,
    FaWallet,
    FaUsers,
    FaExchangeAlt,
    FaPlus,
    FaMinus,
    FaSyncAlt,
} from 'react-icons/fa';
import AdminLayout from '../components/AdminLayout';
import AdminTableFrame from '../components/AdminTableFrame';
import useModalBackHandler from '../hooks/useModalBackHandler';
import { clearAdminSession, fetchWithAuth } from '../lib/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const formatCurrency = (value) => {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

const formatDateTime = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${date} · ${time}`;
};

const getPlayerLabel = (user) => {
    if (!user) return '—';
    if (typeof user === 'string') return user;
    return user.username || user.email || '—';
};

const getPlayerPhone = (user) => {
    if (!user || typeof user !== 'object') return '—';
    if (user.phone) return user.phone;
    const email = String(user.email || '');
    const match = email.match(/^(\d{10})@/);
    return match ? match[1] : '—';
};

const getPlayerId = (user) => {
    if (!user) return null;
    if (typeof user === 'string') return user;
    return user._id || null;
};

const TableHeader = ({ label, align = 'left' }) => (
    <th className={`px-4 py-3 align-middle text-[11px] font-semibold text-slate-600 uppercase tracking-wide ${align === 'right' ? 'text-right' : 'text-left'}`}>
        {label}
    </th>
);

const Wallet = () => {
    const navigate = useNavigate();
    const [wallets, setWallets] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('wallets');
    const [searchTerm, setSearchTerm] = useState('');
    const [txTypeFilter, setTxTypeFilter] = useState('all');
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    const [adjustModalOpen, setAdjustModalOpen] = useState(false);
    const [adjustTarget, setAdjustTarget] = useState(null);
    const [adjustAmount, setAdjustAmount] = useState('');
    const [adjustType, setAdjustType] = useState('credit');
    const [adjustLoading, setAdjustLoading] = useState(false);
    const [adjustError, setAdjustError] = useState('');

    const closeAdjustModal = useModalBackHandler(adjustModalOpen, () => {
        setAdjustModalOpen(false);
        setAdjustTarget(null);
        setAdjustAmount('');
        setAdjustType('credit');
        setAdjustError('');
    });

    useEffect(() => {
        if (activeTab === 'wallets') {
            fetchWallets();
        } else {
            fetchTransactions();
        }
    }, [activeTab]);

    useEffect(() => {
        if (!success) return undefined;
        const timer = setTimeout(() => setSuccess(''), 4000);
        return () => clearTimeout(timer);
    }, [success]);

    const fetchWallets = async (options = {}) => {
        const isSilent = options.silent === true;
        try {
            if (!isSilent) setLoading(true);
            else setRefreshing(true);
            const response = await fetchWithAuth(`${API_BASE_URL}/wallet/all`);
            if (response.status === 401) return;
            const data = await response.json();
            if (data.success) {
                setWallets(data.data || []);
            } else {
                setError(data.message || 'Failed to load wallets');
            }
        } catch (err) {
            console.error('Error fetching wallets:', err);
            setError('Failed to load wallets');
        } finally {
            if (!isSilent) setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchTransactions = async (options = {}) => {
        const isSilent = options.silent === true;
        try {
            if (!isSilent) setLoading(true);
            else setRefreshing(true);
            const response = await fetchWithAuth(`${API_BASE_URL}/wallet/transactions`);
            if (response.status === 401) return;
            const data = await response.json();
            if (data.success) {
                setTransactions(data.data || []);
            } else {
                setError(data.message || 'Failed to load transactions');
            }
        } catch (err) {
            console.error('Error fetching transactions:', err);
            setError('Failed to load transactions');
        } finally {
            if (!isSilent) setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setError('');
        if (activeTab === 'wallets') fetchWallets({ silent: true });
        else fetchTransactions({ silent: true });
    };

    const openAdjustModal = (wallet, type) => {
        setAdjustTarget(wallet);
        setAdjustType(type);
        setAdjustAmount('');
        setAdjustError('');
        setAdjustModalOpen(true);
    };

    const handleAdjustBalance = async () => {
        const userId = getPlayerId(adjustTarget?.userId);
        const amount = Number(adjustAmount);
        if (!userId) {
            setAdjustError('Player not found');
            return;
        }
        if (!Number.isFinite(amount) || amount <= 0) {
            setAdjustError('Enter a valid amount greater than 0');
            return;
        }
        if (adjustType === 'debit' && Number(adjustTarget?.balance || 0) < amount) {
            setAdjustError('Insufficient balance for deduction');
            return;
        }

        setAdjustLoading(true);
        setAdjustError('');
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/wallet/adjust`, {
                method: 'POST',
                body: JSON.stringify({ userId, amount, type: adjustType }),
            });
            if (response.status === 401) return;
            const data = await response.json();
            if (data.success) {
                const actionLabel = adjustType === 'credit' ? 'added to' : 'deducted from';
                setSuccess(`${formatCurrency(amount)} ${actionLabel} ${getPlayerLabel(adjustTarget?.userId)}`);
                closeAdjustModal();
                fetchWallets({ silent: true });
                if (activeTab === 'transactions') fetchTransactions({ silent: true });
            } else {
                setAdjustError(data.message || 'Failed to update wallet');
            }
        } catch (err) {
            console.error('Error adjusting balance:', err);
            setAdjustError('Network error. Please try again.');
        } finally {
            setAdjustLoading(false);
        }
    };

    const walletStats = useMemo(() => {
        const totalBalance = wallets.reduce((sum, w) => sum + Number(w.balance || 0), 0);
        const withBalance = wallets.filter((w) => Number(w.balance || 0) > 0).length;
        return {
            playerCount: wallets.length,
            totalBalance,
            withBalance,
        };
    }, [wallets]);

    const filteredWallets = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return wallets;
        return wallets.filter((wallet) => {
            const user = wallet.userId;
            const username = String(user?.username || '').toLowerCase();
            const email = String(user?.email || '').toLowerCase();
            const phone = String(getPlayerPhone(user)).toLowerCase();
            return username.includes(q) || email.includes(q) || phone.includes(q);
        });
    }, [wallets, searchTerm]);

    const filteredTransactions = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        return transactions.filter((tx) => {
            if (txTypeFilter !== 'all' && tx.type !== txTypeFilter) return false;
            if (!q) return true;
            const username = String(tx.userId?.username || '').toLowerCase();
            const email = String(tx.userId?.email || '').toLowerCase();
            const phone = String(getPlayerPhone(tx.userId)).toLowerCase();
            const desc = String(tx.description || '').toLowerCase();
            return username.includes(q) || email.includes(q) || phone.includes(q) || desc.includes(q);
        });
    }, [transactions, searchTerm, txTypeFilter]);

    const handleLogout = () => {
        clearAdminSession();
        navigate('/');
    };

    return (
        <AdminLayout onLogout={handleLogout} title="Wallet">
            <div className="space-y-4 sm:space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Wallet Management</h1>
                        <p className="text-sm text-slate-500 mt-0.5">View player balances and add or deduct funds</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                    >
                        <FaSyncAlt className={refreshing ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>

                {success && (
                    <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                        {success}
                    </div>
                )}
                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                                <FaUsers />
                            </span>
                            <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Players</p>
                                <p className="text-xl font-bold text-slate-900 tabular-nums">{walletStats.playerCount}</p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                                <FaWallet />
                            </span>
                            <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total balance</p>
                                <p className="text-xl font-bold text-emerald-700 tabular-nums">{formatCurrency(walletStats.totalBalance)}</p>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                <FaExchangeAlt />
                            </span>
                            <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">With balance</p>
                                <p className="text-xl font-bold text-slate-900 tabular-nums">{walletStats.withBalance}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                        <button
                            type="button"
                            onClick={() => { setActiveTab('wallets'); setSearchTerm(''); }}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                activeTab === 'wallets'
                                    ? 'bg-white text-orange-600 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Player Wallets
                        </button>
                        <button
                            type="button"
                            onClick={() => { setActiveTab('transactions'); setSearchTerm(''); }}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                activeTab === 'transactions'
                                    ? 'bg-white text-orange-600 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Transactions
                        </button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                        {activeTab === 'transactions' && (
                            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
                                {['all', 'credit', 'debit'].map((type) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setTxTypeFilter(type)}
                                        className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize ${
                                            txTypeFilter === type
                                                ? 'bg-slate-900 text-white'
                                                : 'text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        {type === 'all' ? 'All' : type}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="relative">
                            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder={activeTab === 'wallets' ? 'Search player or phone…' : 'Search player or description…'}
                                className="w-full sm:w-64 pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
                            />
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
                        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                        <p className="mt-3 text-sm text-slate-500">Loading…</p>
                    </div>
                ) : activeTab === 'wallets' ? (
                    <div className="-mx-4 sm:mx-0">
                        <AdminTableFrame className="rounded-xl border border-slate-200 bg-white shadow-sm">
                            <table className="w-full min-w-[40rem] text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <TableHeader label="Player" />
                                        <TableHeader label="Phone" />
                                        <TableHeader label="Balance" align="right" />
                                        <TableHeader label="Actions" align="right" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredWallets.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="px-4 py-12 text-center text-slate-500">
                                                {searchTerm ? 'No players match your search.' : 'No wallets found.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredWallets.map((wallet) => {
                                            const playerId = getPlayerId(wallet.userId);
                                            return (
                                                <tr key={wallet._id} className="hover:bg-slate-50/80">
                                                    <td className="px-4 py-3">
                                                        {playerId ? (
                                                            <Link
                                                                to={`/all-users/${playerId}`}
                                                                className="font-medium text-orange-600 hover:text-orange-700 hover:underline"
                                                            >
                                                                {getPlayerLabel(wallet.userId)}
                                                            </Link>
                                                        ) : (
                                                            <span className="font-medium text-slate-800">{getPlayerLabel(wallet.userId)}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-600 tabular-nums">{getPlayerPhone(wallet.userId)}</td>
                                                    <td className="px-4 py-3 text-right font-semibold text-emerald-700 tabular-nums">
                                                        {formatCurrency(wallet.balance)}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex justify-end gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => openAdjustModal(wallet, 'credit')}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                                                            >
                                                                <FaPlus className="text-[10px]" />
                                                                Add
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => openAdjustModal(wallet, 'debit')}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
                                                            >
                                                                <FaMinus className="text-[10px]" />
                                                                Deduct
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </AdminTableFrame>
                    </div>
                ) : (
                    <div className="-mx-4 sm:mx-0">
                        <AdminTableFrame className="rounded-xl border border-slate-200 bg-white shadow-sm">
                            <table className="w-full min-w-[48rem] text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <TableHeader label="Date" />
                                        <TableHeader label="Player" />
                                        <TableHeader label="Type" />
                                        <TableHeader label="Amount" align="right" />
                                        <TableHeader label="Description" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredTransactions.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="px-4 py-12 text-center text-slate-500">
                                                {searchTerm || txTypeFilter !== 'all'
                                                    ? 'No transactions match your filters.'
                                                    : 'No transactions found.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredTransactions.map((transaction) => {
                                            const isCredit = transaction.type === 'credit';
                                            const playerId = getPlayerId(transaction.userId);
                                            return (
                                                <tr key={transaction._id} className="hover:bg-slate-50/80">
                                                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                                        {formatDateTime(transaction.createdAt)}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {playerId ? (
                                                            <Link
                                                                to={`/all-users/${playerId}`}
                                                                className="font-medium text-orange-600 hover:text-orange-700 hover:underline"
                                                            >
                                                                {getPlayerLabel(transaction.userId)}
                                                            </Link>
                                                        ) : (
                                                            <span className="text-slate-800">{getPlayerLabel(transaction.userId)}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
                                                            isCredit
                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                : 'bg-rose-100 text-rose-700'
                                                        }`}>
                                                            {isCredit ? 'Credit' : 'Debit'}
                                                        </span>
                                                    </td>
                                                    <td className={`px-4 py-3 text-right font-semibold tabular-nums ${
                                                        isCredit ? 'text-emerald-700' : 'text-rose-700'
                                                    }`}>
                                                        {isCredit ? '+' : '−'}{formatCurrency(transaction.amount)}
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={transaction.description || ''}>
                                                        {transaction.description || '—'}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </AdminTableFrame>
                    </div>
                )}
            </div>

            {adjustModalOpen && adjustTarget && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md">
                        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="text-base font-semibold text-slate-900">
                                {adjustType === 'credit' ? 'Add funds' : 'Deduct funds'}
                            </h3>
                            <button
                                type="button"
                                onClick={closeAdjustModal}
                                className="text-slate-400 hover:text-slate-700 text-xl leading-none p-1"
                                aria-label="Close"
                            >
                                ×
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="rounded-lg bg-slate-50 border border-slate-100 px-4 py-3">
                                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Player</p>
                                <p className="font-semibold text-slate-900">{getPlayerLabel(adjustTarget.userId)}</p>
                                <p className="text-sm text-slate-500 mt-0.5">{getPlayerPhone(adjustTarget.userId)}</p>
                            </div>
                            <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3">
                                <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Current balance</p>
                                <p className="text-lg font-bold text-emerald-800 tabular-nums">{formatCurrency(adjustTarget.balance)}</p>
                            </div>
                            {adjustError && (
                                <div className="rounded-lg border border-red-200 bg-red-50 text-red-600 text-sm px-3 py-2">
                                    {adjustError}
                                </div>
                            )}
                            <div>
                                <label htmlFor="adjust-amount" className="block text-sm font-medium text-slate-700 mb-1.5">
                                    Amount (₹)
                                </label>
                                <input
                                    id="adjust-amount"
                                    type="number"
                                    min="1"
                                    step="1"
                                    placeholder="Enter amount"
                                    value={adjustAmount}
                                    onChange={(e) => setAdjustAmount(e.target.value.replace(/[^\d.]/g, ''))}
                                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={closeAdjustModal}
                                    className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 font-medium hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAdjustBalance}
                                    disabled={adjustLoading}
                                    className={`flex-1 px-4 py-2.5 rounded-lg text-white font-semibold disabled:opacity-50 ${
                                        adjustType === 'credit'
                                            ? 'bg-emerald-600 hover:bg-emerald-500'
                                            : 'bg-rose-600 hover:bg-rose-500'
                                    }`}
                                >
                                    {adjustLoading ? 'Saving…' : adjustType === 'credit' ? 'Add to wallet' : 'Deduct from wallet'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default Wallet;
