import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    FaArrowDown,
    FaArrowUp,
    FaClock,
    FaFilter,
    FaEye,
    FaCheck,
    FaTimes,
    FaImage,
    FaWallet,
    FaSearch,
    FaExclamationTriangle,
} from 'react-icons/fa';
import { API_BASE_URL, getBookieAuthHeaders } from '../utils/api';
import { subscribeBookiePanelPayments } from '../lib/panelSocket';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { DATE_PRESETS, formatRangeLabel } from '../utils/paymentDateUtils';
import { getBelongsToLabel } from '../utils/playerOwnership';

const PAGE_SIZE = 50;
const EMPTY_DASHBOARD_STATS = {
    pendingDeposits: { count: 0, totalAmount: 0 },
    pendingWithdrawals: { count: 0, totalAmount: 0 },
    totalPending: { count: 0, totalAmount: 0 },
    approvedDeposits: { count: 0, totalAmount: 0 },
    approvedWithdrawals: { count: 0, totalAmount: 0 },
    rejectedWithdrawals: { count: 0, totalAmount: 0 },
    failedDeposits: { count: 0, totalAmount: 0 },
};

const fmtInr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const applyPaymentPatch = (list, patch) => {
    if (!patch?.paymentId || !patch?.status) return list;
    const id = String(patch.paymentId);
    return list.map((row) => (
        String(row._id) === id
            ? {
                ...row,
                status: patch.status,
                adminRemarks: patch.adminRemarks ?? row.adminRemarks,
                processedAt: patch.processedAt ?? row.processedAt,
            }
            : row
    ));
};

const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const getStatusBadge = (status) => {
    const styles = {
        pending: 'bg-orange-50 text-orange-600 border-orange-200',
        approved: 'bg-green-50 text-green-700 border-green-200',
        rejected: 'bg-red-50 text-red-600 border-red-200',
        completed: 'bg-blue-50 text-blue-600 border-blue-200',
    };
    return styles[status] || 'bg-gray-100 text-gray-500 border-gray-200';
};

const getTypeBadge = (type) => (
    type === 'deposit'
        ? 'bg-green-50 text-green-700 border-green-200'
        : 'bg-purple-50 text-purple-700 border-purple-200'
);

const BookiePaymentsScreen = () => {
    const { t } = useLanguage();
    const { updateBookie } = useAuth();

    const [payments, setPayments] = useState([]);
    const [dash, setDash] = useState(EMPTY_DASHBOARD_STATS);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: PAGE_SIZE,
        total: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
    });
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ status: '', type: '' });
    const [playerSearch, setPlayerSearch] = useState('');
    const [amountSearch, setAmountSearch] = useState('');
    const [debouncedPlayerSearch, setDebouncedPlayerSearch] = useState('');
    const [debouncedAmountSearch, setDebouncedAmountSearch] = useState('');
    const [playerFilter, setPlayerFilter] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [datePreset, setDatePreset] = useState('all');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [customMode, setCustomMode] = useState(false);
    const [customOpen, setCustomOpen] = useState(false);
    const [actionModal, setActionModal] = useState({ show: false, payment: null, action: '' });
    const [adminRemarks, setAdminRemarks] = useState('');
    const [processing, setProcessing] = useState(false);
    const [imageModal, setImageModal] = useState({ show: false, url: '' });
    const [detailModal, setDetailModal] = useState({ show: false, payment: null });
    const [expandedPaymentId, setExpandedPaymentId] = useState(null);

    const effectiveDateRange = useMemo(() => {
        if (customMode && customFrom && customTo) return { from: customFrom, to: customTo };
        const preset = DATE_PRESETS.find((p) => p.id === datePreset);
        return preset ? preset.getRange() : DATE_PRESETS[0].getRange();
    }, [customMode, customFrom, customTo, datePreset]);

    const displayDateRangeLabel = useMemo(
        () => formatRangeLabel(effectiveDateRange?.from, effectiveDateRange?.to),
        [effectiveDateRange],
    );

    const hasDateRange = Boolean(effectiveDateRange?.from && effectiveDateRange?.to);
    const hasActiveFilters = Boolean(
        filters.status || filters.type || playerFilter?.userId || hasDateRange
        || debouncedPlayerSearch || debouncedAmountSearch,
    );
    const isAllPaymentsView = !playerFilter?.userId && !filters.status && !filters.type && !hasDateRange
        && !debouncedPlayerSearch && !debouncedAmountSearch;

    useEffect(() => {
        const id = window.setTimeout(() => setDebouncedPlayerSearch(playerSearch.trim()), 400);
        return () => window.clearTimeout(id);
    }, [playerSearch]);

    useEffect(() => {
        const id = window.setTimeout(() => setDebouncedAmountSearch(amountSearch.trim()), 400);
        return () => window.clearTimeout(id);
    }, [amountSearch]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filters.status, filters.type, playerFilter?.userId, datePreset, customMode, customFrom, customTo, debouncedPlayerSearch, debouncedAmountSearch]);

    const getPaymentUserId = (payment) => {
        if (payment?.playerId) return String(payment.playerId);
        const u = payment?.userId;
        if (!u) return '';
        if (typeof u === 'string') return u;
        if (u._id) return String(u._id);
        return '';
    };

    const getPaymentBelongsTo = (payment) => getBelongsToLabel(payment?.userId);

    const canApproveRejectPayment = (payment) => (
        payment?.status === 'pending' && Boolean(payment?.actionAccess?.canApproveReject)
    );

    const sortedPayments = useMemo(() => {
        const list = [...payments];
        list.sort((a, b) => {
            const aPending = a.status === 'pending' ? 0 : 1;
            const bPending = b.status === 'pending' ? 0 : 1;
            if (aPending !== bPending) return aPending - bPending;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        return list;
    }, [payments]);

    const pendingRequireAction = sortedPayments.some((p) => canApproveRejectPayment(p));
    const hasAnyPaymentAction = pendingRequireAction;

    const buildQueryParams = useCallback(() => {
        const queryParams = new URLSearchParams();
        if (filters.status) queryParams.append('status', filters.status);
        if (filters.type) queryParams.append('type', filters.type);
        if (playerFilter?.userId) queryParams.append('userId', playerFilter.userId);
        if (effectiveDateRange?.from && effectiveDateRange?.to) {
            queryParams.append('from', effectiveDateRange.from);
            queryParams.append('to', effectiveDateRange.to);
        }
        queryParams.append('page', String(currentPage));
        queryParams.append('limit', String(PAGE_SIZE));
        if (debouncedPlayerSearch) queryParams.append('playerSearch', debouncedPlayerSearch);
        if (debouncedAmountSearch !== '') {
            const n = Number(debouncedAmountSearch);
            if (Number.isFinite(n) && n >= 0) queryParams.append('amountEquals', String(n));
        }
        queryParams.append('_ts', String(Date.now()));
        return queryParams;
    }, [filters, playerFilter, effectiveDateRange, currentPage, debouncedPlayerSearch, debouncedAmountSearch]);

    const fetchPayments = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch(
                `${API_BASE_URL}/payments?${buildQueryParams()}`,
                { headers: getBookieAuthHeaders() },
            );
            const data = await response.json();
            if (data.success) {
                setPayments(data.data || []);
                setPagination(data.pagination || {
                    page: currentPage,
                    limit: PAGE_SIZE,
                    total: 0,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPrevPage: false,
                });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [buildQueryParams, currentPage]);

    const fetchDashboardStats = useCallback(async () => {
        try {
            const queryParams = new URLSearchParams();
            if (effectiveDateRange?.from && effectiveDateRange?.to) {
                queryParams.append('from', effectiveDateRange.from);
                queryParams.append('to', effectiveDateRange.to);
            }
            const qs = queryParams.toString();
            const response = await fetch(
                `${API_BASE_URL}/payments/dashboard-stats${qs ? `?${qs}` : ''}`,
                { headers: getBookieAuthHeaders() },
            );
            const data = await response.json();
            if (data.success && data.data) setDash(data.data);
            else setDash(EMPTY_DASHBOARD_STATS);
        } catch {
            setDash(EMPTY_DASHBOARD_STATS);
        }
    }, [effectiveDateRange]);

    useEffect(() => {
        fetchPayments();
        fetchDashboardStats();
    }, [fetchPayments, fetchDashboardStats]);

    useEffect(() => {
        const unsubscribe = subscribeBookiePanelPayments((payload) => {
            if (payload?.paymentId && payload?.status) {
                setPayments((prev) => applyPaymentPatch(prev, payload));
            } else {
                fetchPayments();
                fetchDashboardStats();
            }
        });
        return unsubscribe;
    }, [fetchPayments, fetchDashboardStats]);

    const clearAllFilters = () => {
        setFilters({ status: '', type: '' });
        setPlayerFilter(null);
        setPlayerSearch('');
        setAmountSearch('');
        setDatePreset('all');
        setCustomMode(false);
        setCustomOpen(false);
    };

    const selectPlayerFromPayment = (payment) => {
        const userId = getPaymentUserId(payment);
        if (!userId) return;
        const u = payment.userId;
        setPlayerFilter({
            userId,
            username: typeof u === 'object' && u?.username ? u.username : '',
            phone: typeof u === 'object' && u?.phone ? u.phone : '',
            belongsToLabel: getPaymentBelongsTo(payment),
        });
    };

    const openActionModal = (payment, action) => {
        if (!canApproveRejectPayment(payment)) {
            alert(payment?.actionAccess?.message || 'You can only view this request.');
            return;
        }
        setActionModal({ show: true, payment, action });
        setAdminRemarks('');
    };

    const closeActionModal = () => {
        setActionModal({ show: false, payment: null, action: '' });
        setAdminRemarks('');
    };

    const handleApprove = async () => {
        if (!actionModal.payment) return;
        setProcessing(true);
        try {
            const response = await fetch(`${API_BASE_URL}/payments/${actionModal.payment._id}/approve`, {
                method: 'POST',
                headers: getBookieAuthHeaders(),
                body: JSON.stringify({ adminRemarks }),
            });
            const data = await response.json();
            if (data.success) {
                const pid = String(actionModal.payment._id);
                setPayments((prev) => applyPaymentPatch(prev, {
                    paymentId: pid,
                    status: data.data?.status || 'approved',
                    adminRemarks: data.data?.adminRemarks ?? adminRemarks,
                    processedAt: data.data?.processedAt,
                }));
                if (data.bookieBalance != null) updateBookie({ balance: Number(data.bookieBalance) });
                closeActionModal();
                fetchPayments();
                fetchDashboardStats();
            } else {
                alert(data.message || 'Failed to approve payment');
            }
        } catch {
            alert('Failed to approve payment');
        } finally {
            setProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!actionModal.payment) return;
        if (!adminRemarks.trim()) {
            alert('Please enter a reason for rejection');
            return;
        }
        setProcessing(true);
        try {
            const response = await fetch(`${API_BASE_URL}/payments/${actionModal.payment._id}/reject`, {
                method: 'POST',
                headers: getBookieAuthHeaders(),
                body: JSON.stringify({ adminRemarks }),
            });
            const data = await response.json();
            if (data.success) {
                const pid = String(actionModal.payment._id);
                setPayments((prev) => applyPaymentPatch(prev, {
                    paymentId: pid,
                    status: data.data?.status || 'rejected',
                    adminRemarks: data.data?.adminRemarks ?? adminRemarks,
                    processedAt: data.data?.processedAt,
                }));
                closeActionModal();
                fetchPayments();
                fetchDashboardStats();
            } else {
                alert(data.message || 'Failed to reject payment');
            }
        } catch {
            alert('Failed to reject payment');
        } finally {
            setProcessing(false);
        }
    };

    const openScreenshot = (payment) => {
        if (!payment?.screenshotUrl) return;
        const url = payment.screenshotUrl.startsWith('http')
            ? payment.screenshotUrl
            : `${API_BASE_URL}${payment.screenshotUrl}`;
        setImageModal({ show: true, url });
    };

    const pageTitle = hasAnyPaymentAction ? (t('payments') || 'Payments') : (t('paymentsViewOnly') || 'Payments (View only)');

    return (
        <div className="w-full min-w-0 max-w-full overflow-x-hidden pb-6 sm:pb-10 space-y-4 sm:space-y-6">
            <div>
                <h1 className="text-xl min-[380px]:text-2xl sm:text-3xl font-bold text-gray-800 flex flex-wrap items-center gap-2 sm:gap-3">
                    <FaWallet className="text-orange-500 shrink-0 text-2xl sm:text-3xl" />
                    <span className="min-w-0 leading-tight">{pageTitle}</span>
                </h1>
            </div>

            {/* Date range */}
            <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-200 shadow-sm">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Date range</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:flex md:flex-wrap">
                    {DATE_PRESETS.map((p) => {
                        const isActive = !customMode && datePreset === p.id;
                        return (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => { setDatePreset(p.id); setCustomMode(false); setCustomOpen(false); }}
                                className={`min-h-[44px] px-2 py-2 text-[11px] sm:text-sm font-semibold rounded-lg transition-all ${
                                    isActive ? 'bg-orange-500 text-white' : 'bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {p.label}
                            </button>
                        );
                    })}
                    <button
                        type="button"
                        onClick={() => { setCustomMode(true); setCustomOpen((o) => !o); }}
                        className={`min-h-[44px] px-2 py-2 text-[11px] sm:text-sm font-semibold rounded-lg transition-all ${
                            customMode && ((customFrom && customTo) || customOpen) ? 'bg-orange-500 text-white' : 'bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        Custom
                    </button>
                </div>
                {customOpen && (
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end p-3 rounded-lg bg-gray-50 border border-gray-200">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">From</label>
                            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">To</label>
                            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                        </div>
                        <button type="button" onClick={() => { if (customFrom && customTo) { setCustomMode(true); setCustomOpen(false); } }} className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white">Apply</button>
                    </div>
                )}
                <p className="text-xs text-gray-500 mt-2">
                    Showing: <span className="text-orange-500 font-medium">{displayDateRangeLabel}</span>
                    {hasDateRange && <span className="text-gray-400"> (IST)</span>}
                </p>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 2xl:grid-cols-4">
                {[
                    { key: 'approved-deposit', label: 'Approved Deposits', count: dash.approvedDeposits.count, amt: dash.approvedDeposits.totalAmount, active: filters.status === 'approved' && filters.type === 'deposit', onClick: () => setFilters({ status: 'approved', type: 'deposit' }), color: 'text-green-600', border: 'border-green-500', icon: FaCheck },
                    { key: 'pending-deposit', label: 'Pending Deposits', count: dash.pendingDeposits.count, amt: dash.pendingDeposits.totalAmount, active: filters.status === 'pending' && filters.type === 'deposit', onClick: () => setFilters({ status: 'pending', type: 'deposit' }), color: 'text-orange-500', border: 'border-amber-500', icon: FaArrowDown },
                    { key: 'approved-withdraw', label: 'Approved Withdrawals', count: dash.approvedWithdrawals.count, amt: dash.approvedWithdrawals.totalAmount, active: filters.status === 'approved' && filters.type === 'withdrawal', onClick: () => setFilters({ status: 'approved', type: 'withdrawal' }), color: 'text-purple-600', border: 'border-purple-500', icon: FaCheck },
                    { key: 'pending-withdraw', label: 'Pending Withdrawals', count: dash.pendingWithdrawals.count, amt: dash.pendingWithdrawals.totalAmount, active: filters.status === 'pending' && filters.type === 'withdrawal', onClick: () => setFilters({ status: 'pending', type: 'withdrawal' }), color: 'text-orange-500', border: 'border-amber-500', icon: FaArrowUp },
                    { key: 'rejected-withdraw', label: 'Rejected Withdrawals', count: dash.rejectedWithdrawals.count, amt: dash.rejectedWithdrawals.totalAmount, active: filters.status === 'rejected' && filters.type === 'withdrawal', onClick: () => setFilters({ status: 'rejected', type: 'withdrawal' }), color: 'text-red-500', border: 'border-red-400', icon: FaTimes },
                    { key: 'failed-deposit', label: 'Failed Deposits', count: dash.failedDeposits.count, amt: dash.failedDeposits.totalAmount, active: filters.status === 'rejected' && filters.type === 'deposit', onClick: () => setFilters({ status: 'rejected', type: 'deposit' }), color: 'text-amber-700', border: 'border-amber-600', icon: FaExclamationTriangle },
                    { key: 'total-pending', label: 'Total Pending', count: dash.totalPending.count, amt: dash.totalPending.totalAmount, active: isAllPaymentsView, onClick: clearAllFilters, color: 'text-blue-600', border: 'border-blue-500', icon: FaClock, colSpan: true },
                ].map((card) => {
                    const Icon = card.icon;
                    return (
                        <div
                            key={card.key}
                            role="button"
                            tabIndex={0}
                            onClick={card.onClick}
                            onKeyDown={(e) => e.key === 'Enter' && card.onClick()}
                            className={`rounded-xl p-3 sm:p-4 border-2 cursor-pointer transition-all ${card.active ? `${card.border} bg-orange-50` : 'border-gray-200 bg-white hover:border-gray-300'} ${card.colSpan ? 'col-span-2 md:col-span-1' : ''}`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase">{card.label}</p>
                                    <p className={`text-lg sm:text-2xl font-bold mt-0.5 ${card.color}`}>{card.count}</p>
                                    <p className="text-[10px] sm:text-xs text-gray-600 font-medium">{fmtInr(card.amt)}</p>
                                </div>
                                <Icon className={`w-7 h-7 sm:w-9 sm:h-9 shrink-0 opacity-40 ${card.color}`} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl p-3 sm:p-5 border border-gray-200 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                    <FaFilter className="text-gray-500 w-4 h-4" />
                    <span className="text-sm font-medium text-gray-600">Filter Payments</span>
                    {hasActiveFilters && (
                        <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 text-xs">Filters active</span>
                    )}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Status</label>
                        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm">
                            <option value="">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Type</label>
                        <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm">
                            <option value="">All Types</option>
                            <option value="deposit">Deposit</option>
                            <option value="withdrawal">Withdrawal</option>
                        </select>
                    </div>
                    <div className="sm:col-span-2 lg:col-span-1">
                        <label className="block text-xs text-gray-500 mb-1">Search by player</label>
                        <div className="relative">
                            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                            <input type="search" value={playerSearch} onChange={(e) => setPlayerSearch(e.target.value)} placeholder="Username or phone" className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 bg-gray-100 text-sm" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Search by amount</label>
                        <input type="text" inputMode="decimal" value={amountSearch} onChange={(e) => setAmountSearch(e.target.value.replace(/[^\d.]/g, ''))} placeholder="Exact match (₹)" className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-100 text-sm" />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-1">
                        <button type="button" onClick={clearAllFilters} className="w-full rounded-lg bg-gray-200 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-300">Clear Filters</button>
                    </div>
                </div>
            </div>

            {playerFilter?.userId && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5">
                    <p className="text-sm text-gray-700">
                        <span className="font-semibold">Player:</span> {playerFilter.username || 'Unknown'}
                        {playerFilter.phone ? ` · ${playerFilter.phone}` : ''}
                        {playerFilter.belongsToLabel ? ` · ${playerFilter.belongsToLabel}` : ''}
                    </p>
                    <button type="button" onClick={() => setPlayerFilter(null)} className="rounded-lg border border-orange-300 bg-white px-3 py-1.5 text-xs font-semibold text-orange-700">Show all players</button>
                </div>
            )}

            {!loading && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="text-sm text-gray-500">
                        Showing <span className="font-semibold text-gray-800">{payments.length}</span> of{' '}
                        <span className="font-semibold text-gray-800">{pagination.total}</span> payments
                        {hasActiveFilters && <span className="ml-2 text-orange-500">(filtered)</span>}
                        {pendingRequireAction && (
                            <p className="text-xs text-orange-500 flex items-center gap-2 mt-1">
                                <FaClock className="w-3.5 h-3.5" /> Some payments need your approval
                            </p>
                        )}
                    </div>
                    <div className="flex gap-1">
                        <button type="button" onClick={() => setFilters((prev) => ({ ...prev, type: prev.type === 'deposit' ? '' : 'deposit' }))} className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold ${filters.type === 'deposit' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'}`}>
                            <FaArrowDown className="w-3 h-3" /> Deposits
                        </button>
                        <button type="button" onClick={() => setFilters((prev) => ({ ...prev, type: prev.type === 'withdrawal' ? '' : 'withdrawal' }))} className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold ${filters.type === 'withdrawal' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-600'}`}>
                            <FaArrowUp className="w-3 h-3" /> Withdrawals
                        </button>
                    </div>
                </div>
            )}

            {!loading && pagination.totalPages > 1 && (
                <div className="flex justify-center gap-2">
                    <button type="button" disabled={!pagination.hasPrevPage} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">Prev</button>
                    <span className="text-sm text-gray-500 self-center">Page {pagination.page} / {pagination.totalPages}</span>
                    <button type="button" disabled={!pagination.hasNextPage} onClick={() => setCurrentPage((p) => p + 1)} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">Next</button>
                </div>
            )}

            {loading ? (
                <div className="rounded-xl border border-gray-200 bg-white py-16 text-center shadow-sm">
                    <div className="animate-spin rounded-full h-12 w-12 border-2 border-orange-500 border-t-transparent mx-auto mb-4" />
                    <p className="text-gray-500">{t('loading') || 'Loading payments...'}</p>
                </div>
            ) : (
                <>
                    {/* Mobile cards */}
                    <div className="md:hidden space-y-3">
                        {sortedPayments.length === 0 ? (
                            <div className="bg-white rounded-xl border p-6 text-center text-gray-500">{t('noPaymentsFound') || 'No payments found'}</div>
                        ) : sortedPayments.map((payment) => {
                            const isExpanded = expandedPaymentId === payment._id;
                            const needsAction = canApproveRejectPayment(payment);
                            return (
                                <div key={payment._id} className={`bg-white rounded-xl border overflow-hidden shadow-sm ${needsAction ? 'border-orange-300 ring-1 ring-orange-200' : 'border-gray-200'}`}>
                                    <button type="button" onClick={() => setExpandedPaymentId(isExpanded ? null : payment._id)} className="w-full p-4 text-left">
                                        <div className="flex justify-between gap-3">
                                            <div className="min-w-0">
                                                <button type="button" onClick={(e) => { e.stopPropagation(); selectPlayerFromPayment(payment); }} className="font-semibold text-gray-800 hover:text-orange-600">{payment.userId?.username || 'Unknown'}</button>
                                                <p className="text-[11px] text-indigo-700">{getPaymentBelongsTo(payment)}</p>
                                                <p className="text-xs text-gray-500">{formatDate(payment.createdAt)}</p>
                                                <div className="mt-1 flex gap-2">
                                                    <span className={`px-2 py-0.5 rounded-full text-[11px] border ${getTypeBadge(payment.type)}`}>{payment.type}</span>
                                                    <span className={`px-2 py-0.5 rounded-full text-[11px] border ${getStatusBadge(payment.status)}`}>{payment.status}</span>
                                                </div>
                                            </div>
                                            <p className={`font-semibold shrink-0 ${payment.type === 'deposit' ? 'text-green-600' : 'text-purple-600'}`}>
                                                {payment.type === 'deposit' ? '+' : '-'}₹{payment.amount?.toLocaleString('en-IN')}
                                            </p>
                                        </div>
                                    </button>
                                    {isExpanded && (
                                        <div className="border-t px-4 pb-4 pt-3 space-y-2 text-xs">
                                            <p className="text-gray-500">Ref: #{payment._id?.slice(-6).toUpperCase()}</p>
                                            {payment.screenshotUrl && (
                                                <button type="button" onClick={() => openScreenshot(payment)} className="inline-flex items-center gap-1 text-blue-600"><FaImage /> Screenshot</button>
                                            )}
                                            <div className="flex flex-wrap gap-2">
                                                <button type="button" onClick={() => setDetailModal({ show: true, payment })} className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-xs"><FaEye className="inline mr-1" />View</button>
                                                {canApproveRejectPayment(payment) && (
                                                    <>
                                                        <button type="button" onClick={() => openActionModal(payment, 'approve')} className="px-3 py-2 rounded-lg bg-green-600 text-white text-xs">Approve</button>
                                                        <button type="button" onClick={() => openActionModal(payment, 'reject')} className="px-3 py-2 rounded-lg bg-red-600 text-white text-xs">Reject</button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden md:block rounded-xl border border-gray-200 bg-white shadow-sm overflow-x-auto">
                        <table className="w-full min-w-[920px] text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-2.5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase">Ref ID</th>
                                    <th className="px-2.5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase">Player</th>
                                    <th className="px-2.5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase">Type</th>
                                    <th className="px-2.5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase">Amount</th>
                                    <th className="px-2.5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase">Payment Info</th>
                                    <th className="px-2.5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase">Status</th>
                                    <th className="px-2.5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase">Date</th>
                                    <th className="px-2.5 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {sortedPayments.length === 0 ? (
                                    <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-500">{t('noPaymentsFound') || 'No payments found'}</td></tr>
                                ) : sortedPayments.map((payment) => (
                                    <tr key={payment._id} className={payment.status === 'pending' ? 'bg-orange-50/50 hover:bg-orange-50' : 'hover:bg-gray-50'}>
                                        <td className="px-2.5 py-3 text-xs text-gray-500">#{payment._id?.slice(-6).toUpperCase()}</td>
                                        <td className="px-2.5 py-3">
                                            <button type="button" onClick={() => selectPlayerFromPayment(payment)} className="text-left hover:text-orange-600">
                                                <p className="font-medium text-gray-800">{payment.userId?.username || 'Unknown'}</p>
                                                <p className="text-xs text-gray-500">{payment.userId?.phone || '—'}</p>
                                                <p className="text-[11px] text-indigo-700">{getPaymentBelongsTo(payment)}</p>
                                            </button>
                                        </td>
                                        <td className="px-2.5 py-3"><span className={`px-1.5 py-0.5 rounded-full text-[11px] border ${getTypeBadge(payment.type)}`}>{payment.type === 'deposit' ? '↓ Deposit' : '↑ Withdraw'}</span></td>
                                        <td className="px-2.5 py-3 font-semibold"><span className={payment.type === 'deposit' ? 'text-green-600' : 'text-purple-600'}>{payment.type === 'deposit' ? '+' : '-'}₹{payment.amount?.toLocaleString('en-IN')}</span></td>
                                        <td className="px-2.5 py-3 text-xs">
                                            {payment.type === 'deposit' ? (
                                                <>
                                                    {payment.upiTransactionId && <p className="text-gray-500">UTR: {payment.upiTransactionId}</p>}
                                                    {payment.screenshotUrl && <button type="button" onClick={() => openScreenshot(payment)} className="text-blue-600 hover:underline"><FaImage className="inline mr-1" />Screenshot</button>}
                                                </>
                                            ) : (
                                                <p className="text-gray-600 truncate">{payment.bankDetailId?.accountHolderName || 'No bank details'}</p>
                                            )}
                                        </td>
                                        <td className="px-2.5 py-3"><span className={`px-2 py-1 rounded-full text-xs border ${getStatusBadge(payment.status)}`}>{payment.status}</span></td>
                                        <td className="px-2.5 py-3 text-xs text-gray-500">{formatDate(payment.createdAt)}</td>
                                        <td className="px-2.5 py-3">
                                            <div className="flex flex-wrap gap-1.5">
                                                <button type="button" onClick={() => setDetailModal({ show: true, payment })} className="px-2 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs border border-blue-200"><FaEye className="inline mr-1" />View</button>
                                                {canApproveRejectPayment(payment) ? (
                                                    <>
                                                        <button type="button" onClick={() => openActionModal(payment, 'approve')} className="px-2 py-1.5 rounded-lg bg-green-600 text-white text-xs">Approve</button>
                                                        <button type="button" onClick={() => openActionModal(payment, 'reject')} className="px-2 py-1.5 rounded-lg bg-red-600 text-white text-xs">Reject</button>
                                                    </>
                                                ) : (
                                                    <span className="text-xs text-gray-400 italic">{payment.status === 'pending' ? 'View only' : 'Processed'}</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Action modal */}
            {actionModal.show && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={() => !processing && closeActionModal()}>
                    <div className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-2xl sm:rounded-xl bg-white p-4 sm:p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-gray-800 mb-3">{actionModal.action === 'approve' ? 'Approve' : 'Reject'} {actionModal.payment?.type}</h3>
                        <div className="bg-gray-50 rounded-lg p-3 mb-3 text-sm space-y-1.5">
                            <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-bold">₹{actionModal.payment?.amount?.toLocaleString('en-IN')}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Player</span><span>{actionModal.payment?.userId?.username}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Belongs to</span><span className="text-indigo-700 text-right">{getPaymentBelongsTo(actionModal.payment)}</span></div>
                        </div>
                        {actionModal.payment?.type === 'deposit' && actionModal.payment?.screenshotUrl && (
                            <img src={actionModal.payment.screenshotUrl.startsWith('http') ? actionModal.payment.screenshotUrl : `${API_BASE_URL}${actionModal.payment.screenshotUrl}`} alt="Proof" className="w-full max-h-32 object-contain rounded-lg border mb-3 cursor-pointer" onClick={() => openScreenshot(actionModal.payment)} />
                        )}
                        {actionModal.payment?.type === 'withdrawal' && actionModal.payment?.bankDetailId && (
                            <div className="bg-gray-50 rounded-lg p-3 mb-3 text-xs text-gray-600">
                                <p className="font-medium text-gray-800">{actionModal.payment.bankDetailId.accountHolderName}</p>
                                {actionModal.payment.bankDetailId.bankName && <p>{actionModal.payment.bankDetailId.bankName} · {actionModal.payment.bankDetailId.accountNumber}</p>}
                            </div>
                        )}
                        <label className="block text-sm text-gray-600 mb-1">Remarks {actionModal.action === 'reject' && <span className="text-red-500">*</span>}</label>
                        <textarea value={adminRemarks} onChange={(e) => setAdminRemarks(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 mb-3 text-sm" placeholder={actionModal.action === 'approve' ? 'Optional...' : 'Reason...'} />
                        <div className="flex gap-2">
                            <button type="button" onClick={closeActionModal} disabled={processing} className="flex-1 py-2.5 rounded-lg bg-gray-100">Cancel</button>
                            <button type="button" onClick={actionModal.action === 'approve' ? handleApprove : handleReject} disabled={processing || (actionModal.action === 'reject' && !adminRemarks.trim())} className={`flex-1 py-2.5 rounded-lg text-white font-medium disabled:opacity-50 ${actionModal.action === 'approve' ? 'bg-emerald-600' : 'bg-rose-600'}`}>{processing ? 'Processing...' : actionModal.action === 'approve' ? 'Approve' : 'Reject'}</button>
                        </div>
                    </div>
                </div>
            )}

            {imageModal.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setImageModal({ show: false, url: '' })}>
                    <img src={imageModal.url} alt="Screenshot" className="max-h-[85vh] max-w-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
                </div>
            )}

            {detailModal.show && detailModal.payment && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-0 sm:p-4" onClick={() => setDetailModal({ show: false, payment: null })}>
                    <div className="w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-gray-800 mb-4">{detailModal.payment.type} details</h3>
                        <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-bold text-lg">₹{detailModal.payment.amount?.toLocaleString('en-IN')}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Status</span><span className={`px-2 py-0.5 rounded-full border text-xs ${getStatusBadge(detailModal.payment.status)}`}>{detailModal.payment.status}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Player</span><span>{detailModal.payment.userId?.username}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Belongs to</span><span className="text-indigo-700">{getPaymentBelongsTo(detailModal.payment)}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Requested</span><span>{formatDate(detailModal.payment.createdAt)}</span></div>
                        </div>
                        {detailModal.payment.type === 'withdrawal' && detailModal.payment.bankDetailId && (
                            <div className="bg-gray-50 rounded-lg p-4 mb-4 text-sm space-y-1.5">
                                <h4 className="font-semibold text-gray-700 mb-2">Bank details</h4>
                                <p><span className="text-gray-500">Holder:</span> {detailModal.payment.bankDetailId.accountHolderName}</p>
                                {detailModal.payment.bankDetailId.bankName && <p><span className="text-gray-500">Bank:</span> {detailModal.payment.bankDetailId.bankName}</p>}
                                {detailModal.payment.bankDetailId.accountNumber && <p><span className="text-gray-500">Account:</span> {detailModal.payment.bankDetailId.accountNumber}</p>}
                                {detailModal.payment.bankDetailId.ifscCode && <p><span className="text-gray-500">IFSC:</span> {detailModal.payment.bankDetailId.ifscCode}</p>}
                                {detailModal.payment.bankDetailId.upiId && <p><span className="text-gray-500">UPI:</span> {detailModal.payment.bankDetailId.upiId}</p>}
                            </div>
                        )}
                        {detailModal.payment.screenshotUrl && (
                            <img src={detailModal.payment.screenshotUrl.startsWith('http') ? detailModal.payment.screenshotUrl : `${API_BASE_URL}${detailModal.payment.screenshotUrl}`} alt="Proof" className="w-full max-h-48 object-contain rounded border mb-4 cursor-pointer" onClick={() => openScreenshot(detailModal.payment)} />
                        )}
                        {detailModal.payment.processedAt && (
                            <p className="text-xs text-gray-500 mb-3">Processed: {formatDate(detailModal.payment.processedAt)}{detailModal.payment.processedBy?.username ? ` by ${detailModal.payment.processedBy.username}` : ''}</p>
                        )}
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setDetailModal({ show: false, payment: null })} className="flex-1 py-2 rounded-lg bg-gray-100">Close</button>
                            {canApproveRejectPayment(detailModal.payment) && (
                                <>
                                    <button type="button" onClick={() => { const p = detailModal.payment; setDetailModal({ show: false, payment: null }); openActionModal(p, 'approve'); }} className="flex-1 py-2 rounded-lg bg-green-600 text-white">Approve</button>
                                    <button type="button" onClick={() => { const p = detailModal.payment; setDetailModal({ show: false, payment: null }); openActionModal(p, 'reject'); }} className="flex-1 py-2 rounded-lg bg-red-600 text-white">Reject</button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BookiePaymentsScreen;
