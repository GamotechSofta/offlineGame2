import React, { useEffect, useMemo, useState } from 'react';
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
    FaTimes,
} from 'react-icons/fa';
import Layout from '../components/Layout';
import { fetchWithAuth } from '../utils/api';
import { useLanguage } from '../context/useLanguage';
import { PANEL_LABEL, PANEL_LABEL_PLURAL } from '../config/panelLabels';
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

const renderPaymentHistoryTable = (items, t, { loading = false, loadingText = 'Loading payment history...', emptyText = 'No payment history found.' } = {}) => {
    if (loading) {
        return <p className="text-xs text-slate-500">{loadingText}</p>;
    }
    if (!items?.length) {
        return <p className="text-xs text-slate-500">{emptyText}</p>;
    }
    return (
        <div className="rounded-lg border border-slate-100 overflow-hidden text-sm bg-white">
            <div className="grid grid-cols-3 gap-2 px-3 py-1.5 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 font-medium">
                <span>{t('amount')}</span>
                <span>{t('from')}</span>
                <span>{t('date')}</span>
            </div>
            {items.map((item) => (
                <div
                    key={item._id}
                    className="grid grid-cols-3 gap-2 px-3 py-2 border-t border-slate-100 items-center leading-tight"
                >
                    <span className="font-semibold text-green-700 tabular-nums">
                        {formatCurrency(item.amount)}
                    </span>
                    <span className="text-slate-700 font-medium truncate">
                        {item.createdBy || 'Bookie'}
                    </span>
                    <p className="text-xs text-slate-700 tabular-nums min-w-0 truncate">
                        {formatPaymentDateTime(item.createdAt)}
                    </p>
                </div>
            ))}
        </div>
    );
};

const sumMoney = (a, b) => Math.round((Number(a || 0) + Number(b || 0)) * 100) / 100;

const getRowDisplaySettled = (row) => Number(
    row.parentRemainderPaid ?? row.displaySettled ?? sumMoney(row.advanceRecovered, row.totalPaid),
);

const getRowDisplayPending = (row) => Number(
    row.parentRemainderPending ?? row.displayPending ?? sumMoney(row.recoveryPendingFromBets, row.totalPending),
);

const getRowPayablePending = (row) => Number(
    row.bookieCommissionPending ?? row.commissionPayable ?? 0,
);

const hasAdvanceRecovery = (row) =>
    Number(row.advanceOutstanding || 0) > 0 || Number(row.recoveryPendingFromBets || 0) > 0;

const Commission = () => {
    const { t } = useLanguage();
    const [pageTab, setPageTab] = useState('settlements');
    const [allRows, setAllRows] = useState([]);
    const [requests, setRequests] = useState([]);
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
    const [summaryTotals, setSummaryTotals] = useState({
        bookieCount: 0,
        totalAdvanceCommissionPaid: 0,
        totalCommission: 0,
        totalPaid: 0,
        totalPending: 0,
    });
    const [negotiateModal, setNegotiateModal] = useState({ open: false, requestId: '', counterOffer: '', message: '' });

    const loadCommissions = async () => {
        try {
            setLoading(true);
            const [summaryRes, reqRes] = await Promise.all([
                fetchWithAuth(`${API_BASE_URL}/daily-commission/super-bookie-summary`),
                fetchWithAuth(`${API_BASE_URL}/commission/super-bookie-requests`),
            ]);
            if (summaryRes.status === 401) return;
            const result = await summaryRes.json();
            const reqResult = await reqRes.json();
            if (result.success) {
                const rows = (result.data?.commissions || []).map((row) => ({
                    ...row,
                    bookieId: row.superBookieId,
                    commissionPercentage: row.commissionPercentage ?? 0,
                    advanceCommissionPaid: row.advanceCommissionPaid ?? 0,
                    advancePaidInitial: row.advancePaidInitial ?? 0,
                    advanceRecoverable: row.advanceRecoverable ?? 0,
                    initialBalancePaymentMode: row.initialBalancePaymentMode ?? 'advance_paid',
                    advanceAvailableForSettlement: row.advanceAvailableForSettlement ?? 0,
                    advanceSettledFromAdvance: row.advanceSettledFromAdvance ?? 0,
                    advanceOutstanding: row.advanceOutstanding ?? 0,
                    advanceRecovered: row.advanceRecovered ?? 0,
                    recoveryPendingFromBets: row.recoveryPendingFromBets ?? 0,
                    commissionPayable: row.bookieCommissionPending ?? row.commissionPayable ?? 0,
                    displaySettled: row.parentRemainderPaid ?? row.displaySettled ?? row.totalPaid ?? 0,
                    displayPending: row.parentRemainderPending ?? row.displayPending ?? row.totalPending ?? 0,
                }));
                setAllRows(rows);
                const apiSummary = result.data?.summary || {};
                setSummaryTotals({
                    bookieCount: rows.length,
                    totalAdvanceCommissionPaid: Number(apiSummary.totalAdvanceCommissionPaid ?? 0),
                    totalAdvanceOutstanding: Number(apiSummary.totalAdvanceOutstanding ?? 0),
                    totalCommission: Number(apiSummary.totalCommission ?? 0),
                    totalPaid: Number(apiSummary.totalPaid ?? 0),
                    totalPending: Number(apiSummary.totalPending ?? 0),
                });
            }
            if (reqResult.success) setRequests(reqResult.data || []);
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
        const pending = allRows.filter(
            (row) =>
                row.paymentStatus === 'pending'
                || row.paymentStatus === 'partial'
                || row.paymentStatus === 'advance_recovery'
        ).length;
        const paid = allRows.filter((row) => row.paymentStatus === 'paid').length;
        return { all: allRows.length, pending, paid };
    }, [allRows]);

    const filteredRows = useMemo(() => {
        const normalizedSearch = searchText.trim().toLowerCase();
        let rows = [...allRows];

        if (statusFilter === 'pending') {
            rows = rows.filter(
                (row) =>
                    row.paymentStatus === 'pending'
                    || row.paymentStatus === 'partial'
                    || row.paymentStatus === 'advance_recovery'
            );
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

    const reduceCommissionRows = (rows) =>
        rows.reduce(
            (acc, row) => {
                acc.totalCommission += Number(row.parentRemainderAmount ?? row.totalCommission ?? 0);
                acc.totalPaid += getRowDisplaySettled(row);
                acc.totalPending += getRowDisplayPending(row);
                acc.advanceCommissionPaid += Number(row.advanceCommissionPaid || 0);
                acc.advanceOutstanding += Number(row.advanceOutstanding || 0);
                return acc;
            },
            {
                totalCommission: 0,
                totalPaid: 0,
                totalPending: 0,
                advanceCommissionPaid: 0,
                advanceOutstanding: 0,
            }
        );

    const allTotals = useMemo(() => reduceCommissionRows(allRows), [allRows]);

    const allSummary = useMemo(
        () => ({
            bookieCount: summaryTotals.bookieCount || allRows.length,
            totalCommission: summaryTotals.totalCommission || allTotals.totalCommission,
            totalPaid: allTotals.totalPaid || summaryTotals.totalPaid,
            totalPending: allTotals.totalPending || summaryTotals.totalPending,
            advanceCommissionPaid:
                summaryTotals.totalAdvanceCommissionPaid || allTotals.advanceCommissionPaid,
            advanceRemaining:
                summaryTotals.totalAdvanceOutstanding || allTotals.advanceOutstanding,
        }),
        [summaryTotals, allTotals, allRows.length]
    );

    const filteredTotals = useMemo(() => reduceCommissionRows(filteredRows), [filteredRows]);

    const isListFiltered =
        statusFilter !== 'all' || Boolean(searchText.trim()) || filteredRows.length !== allRows.length;

    const getPayState = (bookieId) => payStateByBookie[String(bookieId)] || {};

    const handlePayModeChange = (bookieId, mode, pendingAmount, row) => {
        const id = String(bookieId);
        const max = getRecordPaymentMax(row);
        setPayStateByBookie((prev) => ({
            ...prev,
            [id]: {
                ...prev[id],
                mode,
                amount: mode === 'full' ? String(Number(max || 0).toFixed(2)) : (prev[id]?.amount || ''),
            },
        }));
    };

    const handleAmountChange = (bookieId, value) => {
        setPayStateByBookie((prev) => ({
            ...prev,
            [String(bookieId)]: {
                mode: 'partial',
                ...prev[String(bookieId)],
                amount: value,
            },
        }));
    };

    const getRecordPaymentMax = (row) => {
        if (Number(row.recoveryPendingFromBets || 0) > 0) {
            return Number(row.recoveryPendingFromBets);
        }
        return getRowPayablePending(row);
    };

    const isRecoveryPayment = (row) => Number(row.recoveryPendingFromBets || 0) > 0;

    const canRecordPayment = (row) => getRecordPaymentMax(row) > 0;

    const submitRecordPayment = async (row) => {
        const bookieId = String(row.bookieId);
        const payState = getPayState(bookieId);
        const mode = payState.mode || 'partial';
        const maxPayable = getRecordPaymentMax(row);
        const amountRaw = mode === 'full'
            ? String(Number(maxPayable || 0).toFixed(2))
            : (payState.amount || '');
        const amount = Number(amountRaw);
        if (!Number.isFinite(amount) || amount <= 0) {
            alert('Please enter a valid paid amount.');
            return;
        }
        if (amount > maxPayable) {
            alert('Paid amount cannot be more than the pending amount.');
            return;
        }

        const today = new Date();
        const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        setSubmittingBookieId(bookieId);
        try {
            const recovery = isRecoveryPayment(row);
            const response = await fetchWithAuth(
                recovery
                    ? `${API_BASE_URL}/daily-commission/super-bookie/${bookieId}/settle-bets`
                    : `${API_BASE_URL}/daily-commission/super-bookie/${bookieId}/pay`,
                {
                method: 'POST',
                    body: JSON.stringify({
                        paidAmount: amount,
                        date,
                        settlementSource: recovery ? undefined : 'paid_with_other',
                    }),
                },
            );
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
                setToast({
                    show: true,
                    message:
                        result.message
                        || `${formatCurrency(amount)} commission payment recorded for ${row.username}.`,
                });
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
            const response = await fetchWithAuth(`${API_BASE_URL}/daily-commission/super-bookie/${bookieId}/payments`);
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
        if (status === 'advance_recovery') return 'bg-violet-100 text-violet-700';
        if (status === 'none') return 'bg-slate-100 text-slate-600';
        return 'bg-orange-100 text-orange-700';
    };

    const getStatusLabel = (status) => {
        if (status === 'paid') return 'Paid';
        if (status === 'partial') return 'Partial';
        if (status === 'advance_recovery') return 'Recovering advance';
        if (status === 'none') return 'No earnings';
        return 'Pending';
    };

    const renderRecordPaymentControls = (row, bookieId, isExpanded, compact = false) => {
        const payState = getPayState(bookieId);
        const maxPayable = getRecordPaymentMax(row);
        const paymentMode = payState.mode || 'partial';
        const paymentAmount = paymentMode === 'full'
            ? String(Number(maxPayable || 0).toFixed(2))
            : (payState.amount || '');
        const inputClass = compact
            ? 'w-20 min-w-[4.5rem] px-2 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-amber-500/40 shrink-0'
            : 'w-[4.5rem] px-2 py-1.5 rounded-md border border-slate-200 bg-white text-xs disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500/30 shrink-0';
        const selectClass = compact
            ? 'px-2 py-2 rounded-lg border border-slate-200 bg-white text-xs shrink-0'
            : 'h-8 px-2 rounded-md border border-slate-200 bg-white text-xs shrink-0 min-w-[5.25rem]';
        const btnClass = compact
            ? 'px-2.5 py-2 rounded-lg text-xs bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors shrink-0 whitespace-nowrap'
            : 'h-8 px-3 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors shrink-0 whitespace-nowrap';
        if (!canRecordPayment(row)) {
            return (
                <button
                    type="button"
                    onClick={() => toggleExpanded(bookieId)}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                >
                    <FaHistory />
                    View history
                    {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                </button>
            );
        }

        const paymentHint = isRecoveryPayment(row)
            ? `Bet commission recovery (max ${formatCurrency(maxPayable)})`
            : 'Record commission payment';

        return (
            <div
                className="inline-flex items-center gap-1.5 flex-nowrap"
                title={paymentHint}
            >
                <select
                    value={paymentMode}
                    onChange={(e) => handlePayModeChange(bookieId, e.target.value, maxPayable, row)}
                    className={selectClass}
                >
                    <option value="partial">Partial</option>
                    <option value="full">Full</option>
                </select>
                <input
                    type="number"
                    min="0"
                    max={maxPayable}
                    step="0.01"
                    disabled={paymentMode === 'full' || maxPayable <= 0}
                    value={paymentAmount}
                    onChange={(e) => handleAmountChange(bookieId, e.target.value)}
                    className={inputClass}
                    placeholder="Amt"
                />
                <button
                    type="button"
                    disabled={submittingBookieId === bookieId || maxPayable <= 0}
                    onClick={() => submitRecordPayment(row)}
                    className={btnClass}
                >
                    {submittingBookieId === bookieId ? '...' : 'Pay'}
                </button>
                <button
                    type="button"
                    onClick={() => toggleExpanded(bookieId)}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-slate-200 text-blue-600 hover:bg-blue-50 shrink-0"
                    title="Payment history"
                >
                    <FaHistory className="w-3.5 h-3.5" />
                </button>
            </div>
        );
    };

    const pendingRequestCount = requests.filter((r) => r.status === 'pending' || r.status === 'negotiation').length;

    const handleRequestAction = async (requestId, action, body = {}) => {
        const paths = {
            approve: 'super-bookie-approve',
            reject: 'super-bookie-reject',
            negotiate: 'super-bookie-negotiate',
        };
        const res = await fetchWithAuth(`${API_BASE_URL}/commission/${paths[action]}/${requestId}`, {
            method: 'POST',
            body: JSON.stringify(body),
        });
        const result = await res.json();
        if (result.success) {
            setToast({ show: true, message: result.message || 'Request updated' });
            loadCommissions();
        } else {
            alert(result.message || 'Action failed');
        }
    };

    const submitNegotiate = async (e) => {
        e.preventDefault();
        const counter = Number(negotiateModal.counterOffer);
        if (!Number.isFinite(counter) || counter < 0 || counter > 100) {
            alert('Counter offer must be between 0 and 100');
            return;
        }
        await handleRequestAction(negotiateModal.requestId, 'negotiate', {
            counterOffer: counter,
            message: negotiateModal.message,
        });
        setNegotiateModal({ open: false, requestId: '', counterOffer: '', message: '' });
    };

    return (
        <Layout title={t('commissionSuperBookies')}>
            <div className="space-y-4 sm:space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 flex items-center gap-2">
                            <FaMoneyBillWave className="text-[#1B3150]" />
                            {t('commissionSuperBookies')}
                    </h1>
                        <p className="text-sm text-slate-500 mt-1">
                            {t('commissionPageSubtitle')} {PANEL_LABEL_PLURAL} → Quick Manage; settle pending here.
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

                <div className="flex flex-wrap gap-2">
                    {[
                        { id: 'settlements', label: t('commissionTabSettlements') },
                        { id: 'requests', label: `${t('commissionTabRequests')} (${pendingRequestCount})` },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setPageTab(tab.id)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium border ${
                                pageTab === tab.id
                                    ? 'bg-[#1B3150] text-white border-[#1B3150]'
                                    : 'bg-white text-slate-700 border-slate-200'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {pageTab === 'settlements' && (
                <>
                <section className="bg-slate-800 rounded-xl p-4 sm:p-5 shadow-sm text-white space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <h2 className="text-lg font-semibold">All {PANEL_LABEL_PLURAL}</h2>
                            <span className="text-slate-500 hidden sm:inline">·</span>
                            <p className="text-sm text-slate-300">
                                Combined total across {allSummary.bookieCount} {PANEL_LABEL.toLowerCase()}
                                {allSummary.bookieCount === 1 ? '' : 's'}
                            </p>
                        </div>
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/15 text-sm font-medium shrink-0">
                            All ({allSummary.bookieCount})
                        </span>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                        <div className="rounded-lg bg-white/10 border border-white/15 p-3 sm:p-4">
                            <p className="text-[11px] uppercase tracking-wide text-blue-200 flex items-center gap-1.5">
                                <FaMoneyBillWave className="text-blue-300" />
                                Your remainder
                            </p>
                            <p className="text-xl sm:text-2xl font-bold mt-1">{formatCurrency(allSummary.totalCommission)}</p>
                        </div>
                        <div className="rounded-lg bg-white/10 border border-white/15 p-3 sm:p-4">
                            <p className="text-[11px] uppercase tracking-wide text-green-200 flex items-center gap-1.5">
                                <FaCheckCircle className="text-green-300" />
                                Settled
                            </p>
                            <p className="text-xl sm:text-2xl font-bold mt-1">{formatCurrency(allSummary.totalPaid)}</p>
                        </div>
                        <div className="rounded-lg bg-white/10 border border-white/15 p-3 sm:p-4">
                            <p className="text-[11px] uppercase tracking-wide text-orange-200 flex items-center gap-1.5">
                                <FaClock className="text-orange-300" />
                                Pending
                            </p>
                            <p className="text-xl sm:text-2xl font-bold mt-1">{formatCurrency(allSummary.totalPending)}</p>
                        </div>
                    </div>
                </section>

                <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                    <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-0.5">
                        <h2 className="text-sm font-semibold text-slate-800 shrink-0 whitespace-nowrap">
                            Per {PANEL_LABEL.toLowerCase()}
                        </h2>
                        <span className="hidden md:inline w-px h-6 bg-slate-200 shrink-0" aria-hidden />
                        <FaFilter className="text-slate-400 shrink-0 hidden sm:block" />
                        {[
                            { id: 'all', label: 'All', count: tabCounts.all },
                            { id: 'pending', label: 'Pending', count: tabCounts.pending },
                            { id: 'paid', label: 'Paid', count: tabCounts.paid },
                        ].map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setStatusFilter(item.id)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs sm:text-sm border transition-colors shrink-0 whitespace-nowrap ${
                                    statusFilter === item.id
                                        ? 'bg-[#1B3150] text-white border-[#1B3150]'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                {item.label} ({item.count})
                            </button>
                        ))}
                        <span className="hidden sm:inline w-px h-6 bg-slate-200 shrink-0" aria-hidden />
                        <div className="relative min-w-[10rem] sm:min-w-[14rem] flex-1 shrink-0">
                            <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                            <input
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                placeholder={`Search ${PANEL_LABEL.toLowerCase()} by name or phone`}
                                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                            />
                        </div>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs sm:text-sm shrink-0 whitespace-nowrap"
                        >
                            <option value="pending_desc">Sort: Pending (High to Low)</option>
                            <option value="pending_asc">Sort: Pending (Low to High)</option>
                            <option value="last_payment_desc">Sort: Last Payment (Newest)</option>
                            <option value="last_payment_asc">Sort: Last Payment (Oldest)</option>
                            <option value="name_asc">Sort: Name (A-Z)</option>
                        </select>
                        {isListFiltered && filteredRows.length > 0 && (
                            <p className="text-[11px] text-slate-600 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 shrink-0 whitespace-nowrap">
                                Pending: {formatCurrency(filteredTotals.totalPending)}
                            </p>
                        )}
                    </div>
                </div>

                {/* Desktop table */}
                <div className="hidden lg:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wide text-slate-500">{PANEL_LABEL}</th>
                                    <th className="text-right px-3 py-2.5 text-[10px] uppercase tracking-wide text-slate-500 whitespace-nowrap">Player sales</th>
                                    <th className="text-center px-3 py-2.5 text-[10px] uppercase tracking-wide text-slate-500 whitespace-nowrap">Commission %</th>
                                    <th className="text-right px-3 py-2.5 text-[10px] uppercase tracking-wide text-slate-500 whitespace-nowrap">Your remainder</th>
                                    <th className="text-right px-3 py-2.5 text-[10px] uppercase tracking-wide text-slate-500 whitespace-nowrap">Settled</th>
                                    <th className="text-right px-3 py-2.5 text-[10px] uppercase tracking-wide text-slate-500 whitespace-nowrap">Pending</th>
                                    <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wide text-slate-500 whitespace-nowrap">Last Payment</th>
                                    <th className="text-center px-3 py-2.5 text-[10px] uppercase tracking-wide text-slate-500 whitespace-nowrap">Status</th>
                                    <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wide text-slate-500 whitespace-nowrap">Record Payment</th>
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
                                        return (
                                            <React.Fragment key={bookieId}>
                                                <tr className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-3 py-3 align-middle">
                                                        <div className="min-w-0 leading-tight">
                                                            <p className="font-semibold text-slate-800 truncate">{row.username || 'Unknown'}</p>
                                                            <p className="text-xs text-slate-500 mt-0.5">{row.phone || '-'}</p>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 text-right align-middle tabular-nums text-slate-700 whitespace-nowrap">{formatCurrency(row.totalBetAmount)}</td>
                                                    <td className="px-3 py-3 text-center align-middle text-orange-600 font-semibold whitespace-nowrap">{row.commissionPercentage ?? 0}%</td>
                                                    <td className="px-3 py-3 text-right align-middle tabular-nums font-semibold text-slate-800 whitespace-nowrap">{formatCurrency(row.totalCommission)}</td>
                                                    <td className="px-3 py-3 text-right align-middle whitespace-nowrap">
                                                        <p className="font-semibold text-green-700 tabular-nums">{formatCurrency(getRowDisplaySettled(row))}</p>
                                                        {hasAdvanceRecovery(row) && Number(row.advanceRecovered || 0) > 0 && (
                                                            <p className="text-[10px] text-green-600 mt-0.5 tabular-nums">
                                                                Recovered {formatCurrency(row.advanceRecovered)}
                                                            </p>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-3 text-right align-middle whitespace-nowrap">
                                                        <p className="font-semibold text-orange-700 tabular-nums">{formatCurrency(getRowDisplayPending(row))}</p>
                                                        {hasAdvanceRecovery(row) && Number(row.recoveryPendingFromBets || 0) > 0 && (
                                                            <p className="text-[10px] text-orange-600 mt-0.5 tabular-nums">
                                                                From bets {formatCurrency(row.recoveryPendingFromBets)}
                                                            </p>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-3 align-middle text-slate-700 whitespace-nowrap">{formatDate(row.lastPaidAt)}</td>
                                                    <td className="px-3 py-3 align-middle text-center">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${getBadge(row.paymentStatus)}`}>
                                                            {row.paymentStatus === 'paid' ? <FaCheckCircle className="w-3 h-3" /> : <FaClock className="w-3 h-3" />}
                                                            {getStatusLabel(row.paymentStatus)}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3 align-middle">
                                                        {renderRecordPaymentControls(row, bookieId, isExpanded)}
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr>
                                                        <td colSpan={9} className="px-5 py-4 bg-slate-50">
                                                            <p className="text-sm font-semibold text-slate-700 mb-2">Payment History</p>
                                                            {renderPaymentHistoryTable(historyByBookie[bookieId], t, {
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
                        const isExpanded = expandedBookieId === bookieId;
                        return (
                            <div key={bookieId} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <p className="font-semibold text-slate-800">{row.username || 'Unknown'}</p>
                                        <p className="text-xs text-slate-500">{row.phone || '-'}</p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Player sales: {formatCurrency(row.totalBetAmount)} · Commission %: {row.commissionPercentage ?? 0}%
                                        </p>
                                        <p className="text-xs text-slate-500 mt-0.5">Last payment: {formatDate(row.lastPaidAt)}</p>
                                    </div>
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${getBadge(row.paymentStatus)}`}>
                                        {getStatusLabel(row.paymentStatus)}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 text-right">
                                    <div>
                                        <p className="text-[11px] text-slate-500">Your remainder</p>
                                        <p className="text-sm font-semibold text-slate-800">{formatCurrency(row.totalCommission)}</p>
                                </div>
                                    <div>
                                        <p className="text-[11px] text-slate-500">Settled</p>
                                        <p className="text-sm font-semibold text-green-700">{formatCurrency(getRowDisplaySettled(row))}</p>
                                </div>
                                    <div>
                                        <p className="text-[11px] text-slate-500">Pending</p>
                                        <p className="text-sm font-semibold text-orange-700">{formatCurrency(getRowDisplayPending(row))}</p>
                            </div>
                                </div>

                                <div className="mt-3">
                                    {renderRecordPaymentControls(row, bookieId, isExpanded, true)}
                                </div>

                                {isExpanded && (
                                    <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-3">
                                        <p className="text-sm font-semibold text-slate-700 mb-2">Payment History</p>
                                        {renderPaymentHistoryTable(historyByBookie[bookieId], t, {
                                            loading: historyLoadingByBookie[bookieId],
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                            </div>
                    </>
                )}

                {pageTab === 'requests' && (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="px-4 py-3 border-b bg-slate-50">
                            <h2 className="font-semibold text-slate-800">Commission % change requests</h2>
                            <p className="text-xs text-slate-500 mt-1">Approve, reject, or counter offer — same as admin {PANEL_LABEL.toLowerCase()} flow.</p>
                        </div>
                        {requests.length === 0 ? (
                            <p className="p-6 text-sm text-slate-500">No commission requests.</p>
                        ) : (
                            <div className="divide-y divide-slate-200">
                                {requests.map((req) => (
                                    <div key={req._id} className="p-4 flex flex-wrap justify-between gap-3">
                                        <div>
                                            <p className="font-semibold">{req.bookieId?.username}</p>
                                            <p className="text-sm mt-1">{req.currentPercentage}% → {req.requestedPercentage}%</p>
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 mt-2 inline-block">{req.status}</span>
                                        </div>
                                        {req.status === 'pending' && (
                                            <div className="flex gap-2">
                                                <button type="button" onClick={() => handleRequestAction(req._id, 'approve')} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs">Approve</button>
                                                <button type="button" onClick={() => setNegotiateModal({ open: true, requestId: req._id, counterOffer: String(req.requestedPercentage), message: '' })} className="px-3 py-1.5 bg-[#1B3150] text-white rounded-lg text-xs">Counter</button>
                                                <button type="button" onClick={() => handleRequestAction(req._id, 'reject')} className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs">Reject</button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                        </div>

            {negotiateModal.open && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white rounded-xl w-full max-w-md p-4">
                        <div className="flex justify-between mb-3">
                            <h3 className="font-bold">Counter offer</h3>
                            <button type="button" onClick={() => setNegotiateModal({ open: false, requestId: '', counterOffer: '', message: '' })}><FaTimes /></button>
                        </div>
                        <form onSubmit={submitNegotiate} className="space-y-3">
                            <input type="text" value={negotiateModal.counterOffer} onChange={(e) => setNegotiateModal((p) => ({ ...p, counterOffer: e.target.value.replace(/[^0-9.]/g, '').slice(0, 6) }))} className="w-full border rounded-lg px-3 py-2" placeholder="Counter %" required />
                            <textarea value={negotiateModal.message} onChange={(e) => setNegotiateModal((p) => ({ ...p, message: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} placeholder="Message" />
                                                    <div className="flex gap-2">
                                <button type="button" onClick={() => setNegotiateModal({ open: false, requestId: '', counterOffer: '', message: '' })} className="flex-1 py-2 border rounded-lg">Cancel</button>
                                <button type="submit" className="flex-1 py-2 bg-[#1B3150] text-white rounded-lg">Send</button>
                                                    </div>
                        </form>
                                            </div>
                                </div>
                            )}

            {toast.show && (
                <div className="fixed right-4 bottom-4 z-50 bg-green-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm">
                    {toast.message}
                    </div>
                )}
        </Layout>
    );
};

export default Commission;

