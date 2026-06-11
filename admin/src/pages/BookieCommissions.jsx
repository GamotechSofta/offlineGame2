import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaMoneyBillWave,
    FaCheckCircle,
    FaClock,
    FaSyncAlt,
    FaSearch,
    FaFilter,
    FaHistory,
    FaChevronDown,
    FaChevronUp,
    FaWallet,
} from 'react-icons/fa';
import AdminLayout from '../components/AdminLayout';
import { clearAdminSession, fetchWithAuth } from '../lib/auth';

import { TOP_LEVEL_LABEL, TOP_LEVEL_LABEL_PLURAL, SUB_LEVEL_LABEL, SUB_LEVEL_LABEL_PLURAL } from '../config/roleLabels';

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

const formatDate = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

const BookieCommissions = () => {
    const navigate = useNavigate();
    const [allRows, setAllRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortBy, setSortBy] = useState('pending_desc');
    const [payStateByBookie, setPayStateByBookie] = useState({});
    const [submittingBookieId, setSubmittingBookieId] = useState('');
    const [expandedBookieId, setExpandedBookieId] = useState('');
    const [historyByBookie, setHistoryByBookie] = useState({});
    const [historyLoadingByBookie, setHistoryLoadingByBookie] = useState({});
    const [toast, setToast] = useState({ show: false, message: '' });

    const handleLogout = () => {
        clearAdminSession();
        navigate('/');
    };

    const loadCommissions = async () => {
        try {
            setLoading(true);
            const response = await fetchWithAuth(`${API_BASE_URL}/daily-commission/all-summary`);
            if (response.status === 401) return;
            const result = await response.json();
            if (result.success) {
                setAllRows(result.data?.commissions || []);
            }
        } catch (error) {
            console.error('Error loading commissions:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCommissions();
    }, []);

    useEffect(() => {
        if (!toast.show) return undefined;
        const timer = setTimeout(() => setToast({ show: false, message: '' }), 2200);
        return () => clearTimeout(timer);
    }, [toast]);

    const tabCounts = useMemo(() => {
        const pending = allRows.filter((row) => row.paymentStatus === 'pending' || row.paymentStatus === 'partial').length;
        const paid = allRows.filter((row) => row.paymentStatus === 'paid').length;
        return { all: allRows.length, pending, paid };
    }, [allRows]);

    const filteredRows = useMemo(() => {
        const normalizedSearch = searchText.trim().toLowerCase();
        let rows = [...allRows];

        if (statusFilter === 'pending') {
            rows = rows.filter((row) => row.paymentStatus === 'pending' || row.paymentStatus === 'partial');
        } else if (statusFilter === 'paid') {
            rows = rows.filter((row) => row.paymentStatus === 'paid');
        }

        if (normalizedSearch) {
            rows = rows.filter((row) =>
                String(row.username || '').toLowerCase().includes(normalizedSearch)
                || String(row.phone || '').toLowerCase().includes(normalizedSearch)
            );
        }

        rows.sort((a, b) => {
            if (sortBy === 'pending_desc') return Number(b.totalPending || 0) - Number(a.totalPending || 0);
            if (sortBy === 'pending_asc') return Number(a.totalPending || 0) - Number(b.totalPending || 0);
            if (sortBy === 'last_payment_desc') return new Date(b.lastPaidAt || 0) - new Date(a.lastPaidAt || 0);
            if (sortBy === 'last_payment_asc') return new Date(a.lastPaidAt || 0) - new Date(b.lastPaidAt || 0);
            return String(a.username || '').localeCompare(String(b.username || ''));
        });

        return rows;
    }, [allRows, searchText, sortBy, statusFilter]);

    const totals = useMemo(() => {
        return filteredRows.reduce((acc, row) => {
            acc.totalCommission += Number(row.totalCommission || 0);
            acc.totalPaid += Number(row.totalPaid || 0);
            acc.totalPending += Number(row.totalPending || 0);
            return acc;
        }, { totalCommission: 0, totalPaid: 0, totalPending: 0 });
    }, [filteredRows]);

    const handlePayModeChange = (bookieId, mode, pendingAmount) => {
        setPayStateByBookie((prev) => ({
            ...prev,
            [String(bookieId)]: {
                mode,
                amount: mode === 'full' ? String(Number(pendingAmount || 0).toFixed(2)) : (prev[String(bookieId)]?.amount || ''),
            },
        }));
    };

    const handleAmountChange = (bookieId, value) => {
        setPayStateByBookie((prev) => ({
            ...prev,
            [String(bookieId)]: {
                mode: prev[String(bookieId)]?.mode || 'partial',
                amount: value,
            },
        }));
    };

    const submitPayment = async (row) => {
        const bookieId = String(row.bookieId);
        const mode = payStateByBookie[bookieId]?.mode || 'partial';
        const amountRaw = mode === 'full'
            ? String(Number(row.totalPending || 0).toFixed(2))
            : (payStateByBookie[bookieId]?.amount || '');
        const amount = Number(amountRaw);
        if (!Number.isFinite(amount) || amount <= 0) {
            alert('Please enter a valid paid amount.');
            return;
        }
        if (amount > Number(row.totalPending || 0)) {
            alert('Paid amount cannot be more than pending amount.');
            return;
        }

        setSubmittingBookieId(bookieId);
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/daily-commission/bookie/${bookieId}/pay`, {
                method: 'POST',
                body: JSON.stringify({
                    paidAmount: amount,
                }),
            });
            if (response.status === 401) return;
            const result = await response.json();
            if (result.success) {
                setPayStateByBookie((prev) => ({
                    ...prev,
                    [bookieId]: { mode: 'partial', amount: '' },
                }));
                loadCommissions();
                if (expandedBookieId === bookieId) {
                    setHistoryByBookie((prev) => ({ ...prev, [bookieId]: [] }));
                    loadPaymentHistory(bookieId, true);
                }
                setToast({ show: true, message: `Payment of ${formatCurrency(amount)} recorded for ${row.username}.` });
                return;
            }
            alert(result.message || 'Failed to record payment.');
        } catch (error) {
            console.error('Error recording payment:', error);
            alert('Failed to record payment.');
        } finally {
            setSubmittingBookieId('');
        }
    };

    const loadPaymentHistory = async (bookieId, force = false) => {
        if (!force && historyByBookie[bookieId]) return;
        setHistoryLoadingByBookie((prev) => ({ ...prev, [bookieId]: true }));
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/daily-commission/bookie/${bookieId}/payments`);
            if (response.status === 401) return;
            const result = await response.json();
            if (result.success) {
                setHistoryByBookie((prev) => ({ ...prev, [bookieId]: result.data || [] }));
            }
        } catch (error) {
            console.error('Error fetching payment history:', error);
        } finally {
            setHistoryLoadingByBookie((prev) => ({ ...prev, [bookieId]: false }));
        }
    };

    const toggleExpanded = (bookieId) => {
        const id = String(bookieId);
        const isOpen = expandedBookieId === id;
        setExpandedBookieId(isOpen ? '' : id);
        if (!isOpen) {
            loadPaymentHistory(id);
        }
    };

    const getBadge = (status) => {
        if (status === 'paid') return 'bg-green-100 text-green-700';
        if (status === 'partial') return 'bg-yellow-100 text-yellow-700';
        if (status === 'none') return 'bg-slate-100 text-slate-600';
        return 'bg-orange-100 text-orange-700';
    };

    const getStatusLabel = (status) => {
        if (status === 'paid') return 'Paid';
        if (status === 'partial') return 'Partial';
        if (status === 'none') return 'No earnings';
        return 'Pending';
    };

    return (
        <AdminLayout onLogout={handleLogout} title={`${TOP_LEVEL_LABEL} Commissions`}>
            <div className="space-y-4 sm:space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 flex items-center gap-2">
                            <FaMoneyBillWave className="text-blue-600" />
                            {TOP_LEVEL_LABEL} Commissions
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">
                            {TOP_LEVEL_LABEL}: gross = direct commission (your rate) + bookie commission (rates they set). Admin share = % of gross, not bets.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={loadCommissions}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm shadow-sm transition-colors"
                    >
                        <FaSyncAlt className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>

                <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm text-blue-900">
                    <p className="font-semibold mb-1">How commission is calculated</p>
                    <p><span className="font-medium">{TOP_LEVEL_LABEL}</span> — Direct player bets × admin rate + each {SUB_LEVEL_LABEL}&apos;s bets × rate {TOP_LEVEL_LABEL} set on that account. Admin share = gross × admin %.</p>
                    <p className="mt-1"><span className="font-medium">{SUB_LEVEL_LABEL}</span> — Player bets × rate {TOP_LEVEL_LABEL} set on that account (flows to parent).</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 sm:p-5 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-blue-700/80 flex items-center gap-2">
                            <FaMoneyBillWave className="text-blue-600" />
                            {TOP_LEVEL_LABEL} gross commission
                        </p>
                        <p className="text-2xl sm:text-3xl font-bold text-blue-800 mt-1">{formatCurrency(totals.totalCommission)}</p>
                    </div>
                    <div className="bg-green-50 border border-green-100 rounded-xl p-4 sm:p-5 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-green-700/80 flex items-center gap-2">
                            <FaCheckCircle className="text-green-600" />
                            Admin share paid
                        </p>
                        <p className="text-2xl font-bold text-green-700 mt-1">{formatCurrency(totals.totalPaid)}</p>
                    </div>
                    <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 sm:p-5 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-orange-700/80 flex items-center gap-2">
                            <FaWallet className="text-orange-600" />
                            Admin share pending
                        </p>
                        <p className="text-2xl font-bold text-orange-700 mt-1">{formatCurrency(totals.totalPending)}</p>
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <FaFilter className="text-slate-500" />
                        {[
                            { id: 'all', label: 'All', count: tabCounts.all },
                            { id: 'pending', label: 'Pending', count: tabCounts.pending },
                            { id: 'paid', label: 'Paid', count: tabCounts.paid },
                        ].map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setStatusFilter(item.id)}
                                className={`px-3 py-1.5 rounded-xl text-sm border transition-colors ${
                                    statusFilter === item.id
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                {item.label} ({item.count})
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                        <div className="relative w-full sm:max-w-sm">
                            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                placeholder={`Search ${TOP_LEVEL_LABEL.toLowerCase()} by name or phone`}
                                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                            />
                        </div>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700"
                        >
                            <option value="pending_desc">Sort: Pending (High to Low)</option>
                            <option value="pending_asc">Sort: Pending (Low to High)</option>
                            <option value="last_payment_desc">Sort: Last Payment (Newest)</option>
                            <option value="last_payment_asc">Sort: Last Payment (Oldest)</option>
                            <option value="name_asc">Sort: Name (A-Z)</option>
                        </select>
                    </div>
                </div>

                {/* Desktop table */}
                <div className="hidden lg:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wide text-slate-500" colSpan={2}>{TOP_LEVEL_LABEL} Info</th>
                                    <th className="text-right px-4 py-2.5 text-[10px] uppercase tracking-wide text-slate-500" colSpan={5}>Financials (all-time)</th>
                                    <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wide text-slate-500" colSpan={2}>Actions</th>
                                </tr>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="text-left px-4 py-2.5 text-[10px] uppercase text-slate-500">{TOP_LEVEL_LABEL}</th>
                                    <th className="text-right px-4 py-2.5 text-[10px] uppercase text-slate-500">Rate %</th>
                                    <th className="text-right px-4 py-2.5 text-[10px] uppercase text-slate-500">Total Sales</th>
                                    <th className="text-left px-4 py-2.5 text-[10px] uppercase text-slate-500">Last Payment</th>
                                    <th className="text-right px-4 py-2.5 text-[10px] uppercase text-slate-500">Commission</th>
                                    <th className="text-right px-4 py-2.5 text-[10px] uppercase text-slate-500">Admin paid</th>
                                    <th className="text-right px-4 py-2.5 text-[10px] uppercase text-slate-500">Admin pending</th>
                                    <th className="text-left px-4 py-2.5 text-[10px] uppercase text-slate-500">Status</th>
                                    <th className="text-left px-4 py-2.5 text-[10px] uppercase text-slate-500">Record Payment</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {loading ? (
                                    <tr>
                                        <td className="px-5 py-8 text-center text-slate-500" colSpan={9}>Loading commissions...</td>
                                    </tr>
                                ) : filteredRows.length === 0 ? (
                                    <tr>
                                        <td className="px-5 py-8 text-center text-slate-500" colSpan={9}>No commission records found.</td>
                                    </tr>
                                ) : (
                                    filteredRows.map((row) => {
                                        const bookieId = String(row.bookieId);
                                        const isExpanded = expandedBookieId === bookieId;
                                        const paymentMode = payStateByBookie[bookieId]?.mode || 'partial';
                                        const paymentAmount = paymentMode === 'full'
                                            ? String(Number(row.totalPending || 0).toFixed(2))
                                            : (payStateByBookie[bookieId]?.amount || '');
                                        return (
                                            <React.Fragment key={bookieId}>
                                                <tr className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-4 py-3.5 align-top">
                                                        <p className="font-semibold text-slate-800 text-sm">{row.username || 'Unknown'}</p>
                                                        <p className="text-xs text-slate-500 mt-1">{row.phone || '-'}</p>
                                                        {row.accountLabel === 'sub' && row.parentBookieUsername && (
                                                            <p className="text-[10px] text-indigo-600 mt-0.5">
                                                                {SUB_LEVEL_LABEL} · under {row.parentBookieUsername}
                                                            </p>
                                                        )}
                                                        {row.accountLabel === 'parent' && (
                                                            <p className="text-[10px] text-slate-400 mt-0.5">{TOP_LEVEL_LABEL}</p>
                                                        )}
                                                        <p className="text-xs text-slate-400 mt-0.5">
                                                            {Number(row.playerCount || 0)} players · {Number(row.betCount || 0)} bets
                                                        </p>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right text-slate-700">
                                                        {row.accountLabel === 'sub' ? (
                                                            <>
                                                                {Number(row.parentCommissionPercentage || 0)}%
                                                                <p className="text-[10px] text-indigo-600 font-normal">to {TOP_LEVEL_LABEL}</p>
                                                            </>
                                                        ) : (
                                                            <>
                                                                {Number(row.commissionPercentage || 0)}%
                                                                <p className="text-[10px] text-slate-400 font-normal">admin on direct</p>
                                                            </>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right text-slate-700">{formatCurrency(row.totalBetAmount)}</td>
                                                    <td className="px-4 py-3.5 text-slate-700">{formatDate(row.lastPaidAt)}</td>
                                                    <td className="px-4 py-3.5 text-right">
                                                        {row.accountLabel === 'sub' ? (
                                                            <>
                                                                <p className="font-semibold text-indigo-700">
                                                                    {formatCurrency(row.parentCommissionAmount ?? 0)}
                                                                </p>
                                                                <p className="text-[10px] text-slate-400 mt-0.5">
                                                                    to {TOP_LEVEL_LABEL}: {formatCurrency(row.totalBetAmount)} × {Number(row.parentCommissionPercentage || 0)}%
                                                                </p>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <p className="font-semibold text-slate-800">
                                                                    Gross {formatCurrency(row.totalCommission)}
                                                                </p>
                                                                {(Number(row.directCommission || 0) > 0 || Number(row.subCommission || 0) > 0) && (
                                                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                                                        Direct {formatCurrency(row.directCommission)} + Bookies {formatCurrency(row.subCommission)}
                                                                    </p>
                                                                )}
                                                                {Number(row.adminCommissionAmount || 0) > 0 && (
                                                                    <p className="text-[10px] text-amber-600 mt-0.5">
                                                                        Admin: {formatCurrency(row.adminCommissionAmount)} ({Number(row.adminCommissionPercentage || 0)}% of gross)
                                                                    </p>
                                                                )}
                                                                {Number(row.netCommissionAfterAdmin || 0) > 0 && (
                                                                    <p className="text-[10px] text-emerald-700 mt-0.5">
                                                                        Net: {formatCurrency(row.netCommissionAfterAdmin)}
                                                                    </p>
                                                                )}
                                                            </>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right font-semibold text-green-700">{formatCurrency(row.totalPaid)}</td>
                                                    <td className="px-4 py-3.5 text-right font-semibold text-orange-700">{formatCurrency(row.totalPending)}</td>
                                                    <td className="px-4 py-3.5">
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${getBadge(row.paymentStatus)}`}>
                                                            {row.paymentStatus === 'paid' ? <FaCheckCircle /> : <FaClock />}
                                                            {getStatusLabel(row.paymentStatus)}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        {Number(row.totalPending || 0) > 0 ? (
                                                            <div className="space-y-2">
                                                                <div className="flex items-center gap-2">
                                                                    <select
                                                                        value={paymentMode}
                                                                        onChange={(e) => handlePayModeChange(bookieId, e.target.value, row.totalPending)}
                                                                        className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px]"
                                                                    >
                                                                        <option value="partial">Partial</option>
                                                                        <option value="full">Pay Full</option>
                                                                    </select>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        max={Number(row.totalPending || 0)}
                                                                        step="0.01"
                                                                        disabled={paymentMode === 'full'}
                                                                        value={paymentAmount}
                                                                        onChange={(e) => handleAmountChange(bookieId, e.target.value)}
                                                                        className="w-24 px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-[11px] disabled:opacity-60"
                                                                        placeholder="Amount"
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        disabled={submittingBookieId === bookieId}
                                                                        onClick={() => submitPayment(row)}
                                                                        className="px-2.5 py-1.5 rounded-lg text-[11px] bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors"
                                                                    >
                                                                        {submittingBookieId === bookieId ? 'Paying...' : 'Pay'}
                                                                    </button>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleExpanded(bookieId)}
                                                                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                                                                >
                                                                    <FaHistory />
                                                                    Payment history
                                                                    {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleExpanded(bookieId)}
                                                                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                                                            >
                                                                <FaHistory />
                                                                View history
                                                                {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr>
                                                        <td colSpan={9} className="px-5 py-4 bg-slate-50">
                                                            <p className="text-sm font-semibold text-slate-700 mb-2">Payment History</p>
                                                            {historyLoadingByBookie[bookieId] ? (
                                                                <p className="text-xs text-slate-500">Loading payment history...</p>
                                                            ) : (historyByBookie[bookieId]?.length ? (
                                                                <div className="space-y-2">
                                                                    {historyByBookie[bookieId].map((item) => (
                                                                        <div key={item._id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                                                                            <div>
                                                                                <p className="text-sm font-medium text-slate-800">{formatCurrency(item.amount)}</p>
                                                                                <p className="text-xs text-slate-500">
                                                                                    {formatDate(item.createdAt)} • by {item.createdBy}
                                                                                </p>
                                                                                {item.notes ? <p className="text-xs text-slate-500 mt-0.5">{item.notes}</p> : null}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs text-slate-500">No payment history found.</p>
                                                            ))}
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Mobile cards */}
                <div className="lg:hidden space-y-3">
                    {[
                        loading ? { _id: 'loading' } : null,
                    ].filter(Boolean).map(() => (
                        <div key="loading-placeholder" className="bg-white border border-slate-200 rounded-xl p-5 text-sm text-slate-500">
                            Loading commissions...
                        </div>
                    ))}
                    {!loading && filteredRows.length === 0 && (
                        <div className="bg-white border border-slate-200 rounded-xl p-5 text-sm text-slate-500">
                            No commission records found.
                        </div>
                    )}
                    {!loading && filteredRows.map((row) => {
                        const bookieId = String(row.bookieId);
                        const isExpanded = expandedBookieId === bookieId;
                        const paymentMode = payStateByBookie[bookieId]?.mode || 'partial';
                        const paymentAmount = paymentMode === 'full'
                            ? String(Number(row.totalPending || 0).toFixed(2))
                            : (payStateByBookie[bookieId]?.amount || '');
                        return (
                            <div key={bookieId} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <p className="font-semibold text-slate-800">{row.username || 'Unknown'}</p>
                                        <p className="text-xs text-slate-500">{row.phone || '-'}</p>
                                        <p className="text-xs text-slate-500 mt-1">Last payment: {formatDate(row.lastPaidAt)}</p>
                                    </div>
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${getBadge(row.paymentStatus)}`}>
                                        {getStatusLabel(row.paymentStatus)}
                                    </span>
                                </div>

                                <div className="grid grid-cols-3 gap-2 mt-3 text-right">
                                    <div>
                                        <p className="text-[11px] text-slate-500">Commission</p>
                                        {row.accountLabel === 'sub' ? (
                                            <>
                                                <p className="text-sm font-semibold text-indigo-700">
                                                    {formatCurrency(row.parentCommissionAmount ?? 0)}
                                                </p>
                                                <p className="text-[10px] text-slate-400">
                                                    to {TOP_LEVEL_LABEL} · {Number(row.parentCommissionPercentage || 0)}%
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                <p className="text-sm font-semibold text-slate-800">
                                                    {formatCurrency(row.totalCommission)}
                                                </p>
                                                <p className="text-[10px] text-slate-400">
                                                    Direct {formatCurrency(row.directCommission)} + Bookies {formatCurrency(row.subCommission)}
                                                </p>
                                                {Number(row.adminCommissionAmount || 0) > 0 && (
                                                    <p className="text-[10px] text-amber-600">
                                                        Admin {formatCurrency(row.adminCommissionAmount)}
                                                    </p>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-[11px] text-slate-500">Admin paid</p>
                                        <p className="text-sm font-semibold text-green-700">{formatCurrency(row.totalPaid)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] text-slate-500">Admin pending</p>
                                        <p className="text-sm font-semibold text-orange-700">{formatCurrency(row.totalPending)}</p>
                                    </div>
                                </div>

                                {Number(row.totalPending || 0) > 0 && (
                                    <div className="mt-3 space-y-2">
                                        <div className="flex gap-2">
                                            <select
                                                value={paymentMode}
                                                onChange={(e) => handlePayModeChange(bookieId, e.target.value, row.totalPending)}
                                                className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs"
                                            >
                                                <option value="partial">Partial</option>
                                                <option value="full">Pay Full</option>
                                            </select>
                                            <input
                                                type="number"
                                                min="0"
                                                max={Number(row.totalPending || 0)}
                                                step="0.01"
                                                disabled={paymentMode === 'full'}
                                                value={paymentAmount}
                                                onChange={(e) => handleAmountChange(bookieId, e.target.value)}
                                                className="flex-1 px-2.5 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs disabled:opacity-60"
                                                placeholder="Enter amount"
                                            />
                                            <button
                                                type="button"
                                                disabled={submittingBookieId === bookieId}
                                                onClick={() => submitPayment(row)}
                                                className="px-3 py-2 rounded-lg text-xs bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                                            >
                                                {submittingBookieId === bookieId ? 'Paying...' : 'Pay'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={() => toggleExpanded(bookieId)}
                                    className="mt-3 inline-flex items-center gap-1 text-xs text-blue-600"
                                >
                                    <FaHistory />
                                    Payment history
                                    {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                                </button>

                                {isExpanded && (
                                    <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-3">
                                        {historyLoadingByBookie[bookieId] ? (
                                            <p className="text-xs text-slate-500">Loading payment history...</p>
                                        ) : (historyByBookie[bookieId]?.length ? (
                                            <div className="space-y-2">
                                                {historyByBookie[bookieId].map((item) => (
                                                    <div key={item._id} className="rounded-lg bg-white border border-slate-200 p-2.5">
                                                        <p className="text-sm font-medium text-slate-800">{formatCurrency(item.amount)}</p>
                                                        <p className="text-xs text-slate-500">{formatDate(item.createdAt)} • by {item.createdBy}</p>
                                                        {item.notes ? <p className="text-xs text-slate-500 mt-0.5">{item.notes}</p> : null}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-slate-500">No payment history found.</p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {toast.show && (
                <div className="fixed right-4 bottom-4 z-50 bg-green-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm">
                    {toast.message}
                </div>
            )}
        </AdminLayout>
    );
};

export default BookieCommissions;
