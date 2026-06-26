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

import { TOP_LEVEL_LABEL, SUB_LEVEL_LABEL } from '../config/roleLabels';

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

const formatPaymentDateTime = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    const date = d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
    const time = d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
    return `${date} · ${time}`;
};

const renderPaymentHistorySection = (items, { loading = false } = {}) => (
    <div className="w-full bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-800 mb-3">Payment history</p>
        <div className="rounded-lg border border-slate-100 overflow-hidden">
            {loading ? (
                <p className="text-sm text-slate-500 py-4 text-center">Loading payment history...</p>
            ) : !items?.length ? (
                <p className="text-sm text-slate-500 py-4 text-center">No payment history found.</p>
            ) : (
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 font-medium">
                            <th className="text-left px-3 py-2 w-[28%]">Amount</th>
                            <th className="text-left px-3 py-2 w-[32%]">From</th>
                            <th className="text-left px-3 py-2">Date</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {items.map((item) => (
                            <tr key={item._id} className="hover:bg-slate-50/80">
                                <td className="px-3 py-2.5 font-semibold text-green-700 tabular-nums whitespace-nowrap">
                                    {formatCurrency(item.amount)}
                                </td>
                                <td className="px-3 py-2.5 text-slate-800 font-medium truncate max-w-[10rem] sm:max-w-none">
                                    {item.createdBy || 'Admin'}
                                </td>
                                <td className="px-3 py-2.5 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                                    {formatPaymentDateTime(item.createdAt)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    </div>
);

const renderRatesCell = (row) => {
    if (row.accountLabel === 'sub') {
        return (
            <span className="font-medium text-slate-800 tabular-nums">
                {Number(row.parentCommissionPercentage || 0)}%
            </span>
        );
    }
    const rate = Number(row.commissionPercentage || 0);
    return (
        <span className="font-medium text-slate-800 tabular-nums">
            {rate}%
        </span>
    );
};

const renderAdminShareCell = (row) => {
    if (row.accountLabel === 'sub') {
        return <span className="text-slate-400">—</span>;
    }
    return (
        <p className="font-semibold text-slate-800 tabular-nums">{formatCurrency(row.adminCommissionAmount ?? 0)}</p>
    );
};

const getRowPending = (row) => {
    if (row.accountLabel === 'parent') {
        return Number(row.adminCommissionPending ?? row.totalPending ?? 0);
    }
    return Number(row.totalPending ?? 0);
};

const getRowSettled = (row) => {
    if (row.accountLabel === 'parent') {
        return Number(row.adminCommissionPaid ?? row.totalPaid ?? 0);
    }
    return Number(row.totalPaid ?? 0);
};

const renderSettledCell = (row) => (
    <span className="font-semibold text-green-700 tabular-nums">{formatCurrency(getRowSettled(row))}</span>
);

const renderPlayerBetsCell = (row) => {
    if (row.accountLabel === 'sub') {
        return <span className="text-slate-400">—</span>;
    }
    return (
        <span className="font-medium text-slate-800 tabular-nums">
            {formatCurrency(Number(row.directBetAmount ?? 0))}
        </span>
    );
};

const TableHeader = ({ label, align = 'left' }) => (
    <th className={`px-4 py-3 align-middle text-[11px] font-semibold text-slate-600 uppercase tracking-wide ${align === 'right' ? 'text-right' : 'text-left'}`}>
        {label}
    </th>
);

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
            if (sortBy === 'pending_desc') return getRowPending(b) - getRowPending(a);
            if (sortBy === 'pending_asc') return getRowPending(a) - getRowPending(b);
            if (sortBy === 'last_payment_desc') return new Date(b.lastPaidAt || 0) - new Date(a.lastPaidAt || 0);
            if (sortBy === 'last_payment_asc') return new Date(a.lastPaidAt || 0) - new Date(b.lastPaidAt || 0);
            return String(a.username || '').localeCompare(String(b.username || ''));
        });

        return rows;
    }, [allRows, searchText, sortBy, statusFilter]);

    const totals = useMemo(() => {
        return filteredRows.reduce((acc, row) => {
            if (row.accountLabel === 'parent') {
                acc.adminCommission += Number(row.adminCommissionAmount || 0);
                acc.totalPaid += getRowSettled(row);
                acc.totalPending += getRowPending(row);
            }
            return acc;
        }, { adminCommission: 0, totalPaid: 0, totalPending: 0 });
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
            ? String(getRowPending(row).toFixed(2))
            : (payStateByBookie[bookieId]?.amount || '');
        const amount = Number(amountRaw);
        if (!Number.isFinite(amount) || amount <= 0) {
            alert('Please enter a valid paid amount.');
            return;
        }
        const rowPending = getRowPending(row);
        if (amount > rowPending) {
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 sm:p-5 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-blue-700/80 flex items-center gap-2">
                            <FaMoneyBillWave className="text-blue-600" />
                            Total admin profit
                        </p>
                        <p className="text-2xl sm:text-3xl font-bold text-blue-800 mt-1">{formatCurrency(totals.adminCommission)}</p>
                    </div>
                    <div className="bg-green-50 border border-green-100 rounded-xl p-4 sm:p-5 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-green-700/80 flex items-center gap-2">
                            <FaCheckCircle className="text-green-600" />
                            Settled
                        </p>
                        <p className="text-2xl font-bold text-green-700 mt-1">{formatCurrency(totals.totalPaid)}</p>
                    </div>
                    <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 sm:p-5 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-orange-700/80 flex items-center gap-2">
                            <FaWallet className="text-orange-600" />
                            Admin remainder pending
                        </p>
                        <p className="text-2xl font-bold text-orange-700 mt-1">{formatCurrency(totals.totalPending)}</p>
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-sm">
                    <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-0.5">
                        <FaFilter className="text-slate-500 shrink-0" />
                        {[
                            { id: 'all', label: 'All', count: tabCounts.all },
                            { id: 'pending', label: 'Pending', count: tabCounts.pending },
                            { id: 'paid', label: 'Paid', count: tabCounts.paid },
                        ].map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setStatusFilter(item.id)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs sm:text-sm border whitespace-nowrap shrink-0 transition-colors ${
                                    statusFilter === item.id
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                {item.label} ({item.count})
                            </button>
                        ))}
                        <span className="hidden sm:inline w-px h-6 bg-slate-200 shrink-0" aria-hidden />
                        <FaSearch className="text-slate-400 shrink-0" />
                        <input
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            placeholder={`Search ${TOP_LEVEL_LABEL.toLowerCase()} by name or phone`}
                            className="min-w-[10rem] sm:min-w-[14rem] flex-1 max-w-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-sm shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        />
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs sm:text-sm shrink-0"
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
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50">
                                    <TableHeader label="Account" />
                                    <TableHeader label="Rates" align="right" />
                                    <TableHeader label={`${TOP_LEVEL_LABEL} direct player bets`} align="right" />
                                    <TableHeader label="Admin remainder" align="right" />
                                    <TableHeader label="Settled" align="right" />
                                    <TableHeader label="Pending" align="right" />
                                    <TableHeader label="Status" />
                                    <TableHeader label="Pay" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td className="px-5 py-8 text-center text-slate-500" colSpan={8}>Loading commissions...</td>
                                    </tr>
                                ) : filteredRows.length === 0 ? (
                                    <tr>
                                        <td className="px-5 py-8 text-center text-slate-500" colSpan={8}>No commission records found.</td>
                                    </tr>
                                ) : (
                                    filteredRows.map((row) => {
                                        const bookieId = String(row.bookieId);
                                        const rowPending = getRowPending(row);
                                        const isExpanded = expandedBookieId === bookieId;
                                        const paymentMode = payStateByBookie[bookieId]?.mode || 'partial';
                                        const paymentAmount = paymentMode === 'full'
                                            ? String(rowPending.toFixed(2))
                                            : (payStateByBookie[bookieId]?.amount || '');
                                        return (
                                            <React.Fragment key={bookieId}>
                                                <tr className="hover:bg-slate-50/80 transition-colors align-top">
                                                    <td className="px-4 py-3.5">
                                                        <p className="font-semibold text-slate-800">{row.username || 'Unknown'}</p>
                                                        <p className="text-xs text-slate-500 mt-0.5">{row.phone || '-'}</p>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right text-slate-700">
                                                        {renderRatesCell(row)}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right">
                                                        {renderPlayerBetsCell(row)}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right">
                                                        {renderAdminShareCell(row)}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right">
                                                        {renderSettledCell(row)}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right font-semibold text-orange-700 tabular-nums">
                                                        {formatCurrency(rowPending)}
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getBadge(row.paymentStatus)}`}>
                                                            {row.paymentStatus === 'paid' ? <FaCheckCircle className="w-3 h-3" /> : <FaClock className="w-3 h-3" />}
                                                            {getStatusLabel(row.paymentStatus)}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3.5 min-w-[11rem]">
                                                        {rowPending > 0 ? (
                                                            <div className="space-y-2">
                                                                <div className="flex items-center gap-2">
                                                                    <select
                                                                        value={paymentMode}
                                                                        onChange={(e) => handlePayModeChange(bookieId, e.target.value, rowPending)}
                                                                        className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px]"
                                                                    >
                                                                        <option value="partial">Partial</option>
                                                                        <option value="full">Pay Full</option>
                                                                    </select>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        max={rowPending}
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
                                                        <td colSpan={8} className="px-4 py-3 bg-slate-50/70">
                                                            {renderPaymentHistorySection(historyByBookie[bookieId], {
                                                                loading: historyLoadingByBookie[bookieId],
                                                            })}
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
                        const rowPending = getRowPending(row);
                        const isExpanded = expandedBookieId === bookieId;
                        const paymentMode = payStateByBookie[bookieId]?.mode || 'partial';
                        const paymentAmount = paymentMode === 'full'
                            ? String(rowPending.toFixed(2))
                            : (payStateByBookie[bookieId]?.amount || '');
                        return (
                            <div key={bookieId} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <p className="font-semibold text-slate-800">{row.username || 'Unknown'}</p>
                                        <p className="text-xs text-slate-500">{row.phone || '-'}</p>
                                    </div>
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${getBadge(row.paymentStatus)}`}>
                                        {getStatusLabel(row.paymentStatus)}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                                    <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5">
                                        <p className="text-[10px] uppercase text-slate-500">Rates</p>
                                        <div className="mt-1">{renderRatesCell(row)}</div>
                                    </div>
                                    <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5 text-right">
                                        <p className="text-[10px] uppercase text-slate-500">{TOP_LEVEL_LABEL} direct player bets</p>
                                        <div className="mt-1 text-right">{renderPlayerBetsCell(row)}</div>
                                    </div>
                                    <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5">
                                        <p className="text-[10px] uppercase text-slate-500">Admin profit</p>
                                        <div className="mt-1">{renderAdminShareCell(row)}</div>
                                    </div>
                                    <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5 text-right">
                                        <p className="text-[10px] uppercase text-slate-500">Pending</p>
                                        <p className="font-semibold text-orange-700 mt-1 tabular-nums">{formatCurrency(rowPending)}</p>
                                    </div>
                                    <div className="rounded-lg bg-green-50 border border-green-100 p-2.5 col-span-2">
                                        <p className="text-[10px] uppercase text-green-700/80">Settled</p>
                                        <div className="mt-1">{renderSettledCell(row)}</div>
                                    </div>
                                </div>

                                {rowPending > 0 && (
                                    <div className="mt-3 space-y-2">
                                        <div className="flex gap-2">
                                            <select
                                                value={paymentMode}
                                                onChange={(e) => handlePayModeChange(bookieId, e.target.value, rowPending)}
                                                className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs"
                                            >
                                                <option value="partial">Partial</option>
                                                <option value="full">Pay Full</option>
                                            </select>
                                            <input
                                                type="number"
                                                min="0"
                                                max={rowPending}
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
                                    <div className="mt-3">
                                        {renderPaymentHistorySection(historyByBookie[bookieId], {
                                            loading: historyLoadingByBookie[bookieId],
                                        })}
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
