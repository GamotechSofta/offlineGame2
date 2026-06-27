import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { API_BASE_URL, fetchWithAuth } from '../utils/api';
import { subscribeBookiePanelBalance } from '../lib/panelSocket';
import { useLanguage } from '../context/LanguageContext';
import {
    FaMoneyBillWave,
    FaSyncAlt,
    FaCalendarAlt,
    FaCheckCircle,
    FaClock,
} from 'react-icons/fa';

const getPresets = (t) => [
    { id: 'all', label: t('all'), getRange: () => ({ from: '', to: '' }) },
    { id: 'today', label: t('today'), getRange: () => {
        const d = new Date();
        const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return { from, to: from };
    }},
    { id: 'yesterday', label: t('yesterday'), getRange: () => {
        const d = new Date(); d.setDate(d.getDate() - 1);
        const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return { from, to: from };
    }},
    { id: 'this_week', label: t('thisWeek'), getRange: () => {
        const d = new Date(); const day = d.getDay();
        const sun = new Date(d); sun.setDate(d.getDate() - day);
        const sat = new Date(sun); sat.setDate(sun.getDate() + 6);
        const fmt = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
        return { from: fmt(sun), to: fmt(sat) };
    }},
    { id: 'this_month', label: t('thisMonth'), getRange: () => {
        const d = new Date(); const y = d.getFullYear(), m = d.getMonth();
        const last = new Date(y, m + 1, 0);
        return { from: `${y}-${String(m + 1).padStart(2, '0')}-01`, to: `${y}-${String(m + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}` };
    }},
];

const formatCurrency = (n) => {
    const num = Number(n || 0);
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(num);
};

const paymentStatusBadge = (status) => {
    if (status === 'paid') return 'bg-green-100 text-green-700';
    if (status === 'partial') return 'bg-amber-100 text-amber-800';
    if (status === 'advance_recovery') return 'bg-violet-100 text-violet-700';
    if (status === 'pending') return 'bg-orange-100 text-orange-700';
    return 'bg-slate-100 text-slate-600';
};

const paymentStatusLabel = (status) => {
    if (status === 'paid') return 'Paid';
    if (status === 'partial') return 'Partial';
    if (status === 'advance_recovery') return 'Advance recovery';
    if (status === 'pending') return 'Pending';
    return status || '—';
};

const formatSettlementPeriod = (start, end) => {
    const fmt = (value) => {
        if (!value) return '-';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };
    return `${fmt(start)} – ${fmt(end)}`;
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

const Commission = () => {
    const { t } = useLanguage();
    const PRESETS = getPresets(t);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [paymentTotals, setPaymentTotals] = useState({ advance: 0, settled: 0 });
    const [payments, setPayments] = useState([]);
    const [paymentsLoading, setPaymentsLoading] = useState(false);
    const [settlements, setSettlements] = useState([]);
    const [settlementsLoading, setSettlementsLoading] = useState(false);
    const [dateRange, setDateRange] = useState(() => {
        const d = new Date();
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return { startDate: today, endDate: today };
    });
    const [activePreset, setActivePreset] = useState('today');

    const hasDateFilter = Boolean(dateRange.startDate && dateRange.endDate);

    const fetchRevenue = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (dateRange.startDate && dateRange.endDate) {
                params.set('startDate', dateRange.startDate);
                params.set('endDate', dateRange.endDate);
            }
            const query = params.toString();
            const res = await fetchWithAuth(
                `${API_BASE_URL}/daily-commission/my-summary${query ? `?${query}` : ''}`
            );
            const result = await res.json();
            setData(result.success ? result.data : null);
        } catch {
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [dateRange]);

    const fetchPayments = useCallback(async () => {
        try {
            setPaymentsLoading(true);
            const res = await fetchWithAuth(`${API_BASE_URL}/daily-commission/my-payments`);
            const result = await res.json();
            if (result.success) {
                setPayments(result.data || []);
                setPaymentTotals({
                    advance: Number(result.totalAdvanceCommission ?? 0),
                    settled: Number(result.totalCommissionSettled ?? 0),
                });
            }
        } catch {
            setPayments([]);
            setPaymentTotals({ advance: 0, settled: 0 });
        } finally {
            setPaymentsLoading(false);
        }
    }, []);

    const fetchSettlements = useCallback(async () => {
        try {
            setSettlementsLoading(true);
            const res = await fetchWithAuth(`${API_BASE_URL}/daily-commission/my-settlements`);
            const result = await res.json();
            setSettlements(result.success ? (result.data || []) : []);
        } catch {
            setSettlements([]);
        } finally {
            setSettlementsLoading(false);
        }
    }, []);

    useEffect(() => { fetchRevenue(); }, [fetchRevenue]);
    useEffect(() => {
        fetchPayments();
        fetchSettlements();
    }, [fetchPayments, fetchSettlements]);

    useEffect(() => {
        const unsub = subscribeBookiePanelBalance((payload) => {
            const reason = payload?.reason || '';
            if (
                reason === 'commission_recovery_settled'
                || reason === 'commission_settlement'
                || reason === 'advance_commission_transfer'
            ) {
                fetchRevenue();
                fetchPayments();
                fetchSettlements();
            }
        });
        return unsub;
    }, [fetchRevenue, fetchPayments, fetchSettlements]);

    const applyPreset = (presetId) => {
        const preset = PRESETS.find((p) => p.id === presetId);
        if (preset) {
            const { from, to } = preset.getRange();
            setDateRange({ startDate: from || '', endDate: to || '' });
            setActivePreset(presetId);
        }
    };

    const advanceGiven = Number(data?.advanceCommissionPaid ?? paymentTotals.advance ?? 0);
    const advanceRemaining = Number(data?.advanceOutstanding ?? 0);
    const advanceRecovered = Number(data?.advanceRecovered ?? 0);
    const recoveryPendingFromBets = Number(data?.recoveryPendingFromBets ?? 0);
    const ownCommissionAllTime = Number(data?.allTimeCommission ?? data?.totalCommission ?? 0);
    const ownCommissionSettled = Number(
        data?.allTimePaid ?? data?.paidAmount ?? data?.totalPaid ?? paymentTotals.settled ?? 0,
    );
    const ownCommissionPending = Number(
        data?.allTimePending
        ?? data?.pendingAmount
        ?? data?.totalPending
        ?? Math.max(0, ownCommissionAllTime - ownCommissionSettled),
    );
    const commissionRate = Number(data?.commissionPercentage ?? data?.parentCommissionPercentage ?? 0);
    const hasAdvance = advanceGiven > 0;
    const isRecoveringAdvance = advanceRemaining > 0 || recoveryPendingFromBets > 0;

    const displayPlayerBetAmount = hasDateFilter
        ? Number(data?.periodBetAmount ?? data?.totalBetAmount ?? 0)
        : Number(data?.allTimeBetAmount ?? 0);
    const displayPlayerPayouts = hasDateFilter
        ? Number(data?.periodPlayerWinning ?? data?.periodPayouts ?? 0)
        : Number(data?.playerWinning ?? data?.totalPayouts ?? 0);
    const displayGrossProfit = hasDateFilter
        ? (Number(data?.periodGrossProfit) > 0
            ? Number(data?.periodGrossProfit)
            : Math.round((displayPlayerBetAmount - displayPlayerPayouts) * 100) / 100)
        : Number(data?.grossProfit ?? 0);
    const displayOwnCommission = hasDateFilter
        ? Number(data?.periodSuperBookieCommission ?? data?.periodCommission ?? 0)
        : ownCommissionAllTime;
    const displaySettled = hasDateFilter
        ? Number(data?.periodSettled ?? ownCommissionSettled)
        : ownCommissionSettled;
    const displayPending = hasDateFilter
        ? Number(data?.periodPending ?? Math.max(0, displayOwnCommission - displaySettled))
        : ownCommissionPending;
    const parentSuperBookieName = data?.parentBookieUsername || 'SuperBookie';
    const parentSuperBookieRate = Number(data?.parentSuperBookieRate ?? 0);
    const allTimeSuperBookieShare = Number(data?.superBookieShare ?? 0);
    const allTimeAdminShare = Number(data?.adminShare ?? 0);
    const displaySuperBookieShare = hasDateFilter
        ? Number(data?.periodSuperBookieShare ?? 0)
        : allTimeSuperBookieShare;
    const displayAdminShare = hasDateFilter
        ? Number(data?.periodAdminShare ?? 0)
        : allTimeAdminShare;
    const displayCalculatedCommission = hasDateFilter
        ? Number(data?.periodCalculatedCommission ?? data?.calculatedCommission ?? displayOwnCommission)
        : Number(data?.calculatedCommission ?? displayOwnCommission);
    const settlementHistory = payments.filter((payment) => {
        if (payment.paymentType !== 'settlement') return false;
        if (!hasDateFilter) return true;
        const d = new Date(payment.createdAt);
        if (Number.isNaN(d.getTime())) return false;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return key >= dateRange.startDate && key <= dateRange.endDate;
    });

    return (
        <Layout title="Commission">
            <div className="space-y-4 sm:space-y-5">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FaMoneyBillWave className="text-emerald-500" />
                        Commission
                    </h1>
                    <p className="text-gray-400 text-xs sm:text-sm mt-1">
                        Player bets × {commissionRate}% = your commission (profit-capped).
                    </p>
                </div>

                <section className="bg-slate-800 rounded-xl p-4 sm:p-5 shadow-sm text-white space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <h2 className="text-lg font-semibold">Commission summary</h2>
                            <span className="text-slate-500 hidden sm:inline">·</span>
                            <p className="text-sm text-slate-300">Your account — all-time totals</p>
                        </div>
                        {data?.paymentStatus && (
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${paymentStatusBadge(data.paymentStatus)}`}>
                                {data.paymentStatus === 'paid' ? <FaCheckCircle /> : <FaClock />}
                                {paymentStatusLabel(data.paymentStatus)}
                            </span>
                        )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-lg bg-white/10 border border-white/15 p-3 sm:p-4">
                            <p className="text-[11px] uppercase tracking-wide text-blue-200 flex items-center gap-1.5">
                                <FaMoneyBillWave className="text-blue-300" />
                                Your commission
                            </p>
                            <p className="text-xl sm:text-2xl font-bold mt-1">{formatCurrency(ownCommissionAllTime)}</p>
                            <p className="text-[11px] text-blue-200 mt-1">
                                {commissionRate}% of player bets (all-time)
                            </p>
                        </div>
                        <div className="rounded-lg bg-white/10 border border-white/15 p-3 sm:p-4">
                            <p className="text-[11px] uppercase tracking-wide text-green-200 flex items-center gap-1.5">
                                <FaCheckCircle className="text-green-300" />
                                Settled
                            </p>
                            <p className="text-xl sm:text-2xl font-bold mt-1">{formatCurrency(ownCommissionSettled)}</p>
                            <p className="text-[11px] text-green-200 mt-1">Your commission paid</p>
                        </div>
                        <div className="rounded-lg bg-white/10 border border-white/15 p-3 sm:p-4">
                            <p className="text-[11px] uppercase tracking-wide text-orange-200 flex items-center gap-1.5">
                                <FaClock className="text-orange-300" />
                                Pending
                            </p>
                            <p className="text-xl sm:text-2xl font-bold mt-1">{formatCurrency(ownCommissionPending)}</p>
                            <p className="text-[11px] text-orange-200 mt-1">Your commission due</p>
                            {(allTimeSuperBookieShare > 0 || allTimeAdminShare > 0) && (
                                <div className="mt-2.5 pt-2.5 border-t border-white/15 space-y-1">
                                    <p className="text-[10px] uppercase tracking-wide text-slate-400">
                                        From your player sales
                                    </p>
                                    {allTimeSuperBookieShare > 0 && (
                                        <p className="text-[11px] text-violet-200 tabular-nums">
                                            {parentSuperBookieName}
                                            {parentSuperBookieRate > 0 ? ` (${parentSuperBookieRate}%)` : ''}
                                            : {formatCurrency(allTimeSuperBookieShare)}
                                        </p>
                                    )}
                                    {allTimeAdminShare > 0 && (
                                        <p className="text-[11px] text-slate-300 tabular-nums">
                                            Admin: {formatCurrency(allTimeAdminShare)}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {isRecoveringAdvance && (
                    <p className="text-sm text-violet-800 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
                        {recoveryPendingFromBets > 0
                            ? `${t('commissionRecoveringAdvance')} — ${formatCurrency(recoveryPendingFromBets)} from player bets can be settled by your bookie toward advance recovery.`
                            : t('commissionRecoveringAdvance')}
                        {advanceRecovered > 0 && (
                            <span className="block mt-1 text-violet-700">
                                Recovered so far: {formatCurrency(advanceRecovered)}
                                {advanceRemaining > 0 ? ` · Due: ${formatCurrency(advanceRemaining)}` : ''}
                            </span>
                        )}
                    </p>
                )}

                <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
                            <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-0.5">
                                {PRESETS.map((p) => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => applyPreset(p.id)}
                                        className={`px-2.5 py-1.5 rounded-lg text-xs sm:text-sm whitespace-nowrap shrink-0 ${
                                            activePreset === p.id ? 'bg-sb-primary text-white' : 'bg-gray-100'
                                        }`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                                <span className="hidden sm:inline w-px h-6 bg-gray-200 shrink-0" aria-hidden />
                                <FaCalendarAlt className="text-gray-400 shrink-0" />
                                <input
                                    type="date"
                                    value={dateRange.startDate}
                                    onChange={(e) => {
                                        setDateRange((r) => ({ ...r, startDate: e.target.value }));
                                        setActivePreset('');
                                    }}
                                    className="px-2 py-1.5 border rounded-lg text-sm shrink-0"
                                />
                                <span className="text-gray-500 text-sm shrink-0">to</span>
                                <input
                                    type="date"
                                    value={dateRange.endDate}
                                    onChange={(e) => {
                                        setDateRange((r) => ({ ...r, endDate: e.target.value }));
                                        setActivePreset('');
                                    }}
                                    className="px-2 py-1.5 border rounded-lg text-sm shrink-0"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        fetchRevenue();
                                        fetchPayments();
                                    }}
                                    disabled={loading}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-sb-primary text-white rounded-lg text-sm shrink-0 whitespace-nowrap"
                                >
                                    <FaSyncAlt className={loading ? 'animate-spin' : ''} />
                                    Refresh
                                </button>
                            </div>
                        </div>

                        {loading ? (
                            <div className="h-28 bg-white rounded-xl border animate-pulse" />
                        ) : data ? (
                            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-3">
                                    <p className="text-sm font-semibold text-slate-800">{t('commissionBookieSummary')}</p>
                                    <span className="text-slate-300 hidden sm:inline">·</span>
                                    <p className="text-xs text-slate-500">{hasDateFilter ? t('selectedPeriod') : t('all')}</p>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
                                    <div className="text-right sm:text-left">
                                        <p className="text-[11px] uppercase text-slate-500">Player sales</p>
                                        <p className="font-semibold text-slate-800 tabular-nums mt-0.5">{formatCurrency(displayPlayerBetAmount)}</p>
                                    </div>
                                    <div className="text-right sm:text-left">
                                        <p className="text-[11px] uppercase text-slate-500">Player payouts</p>
                                        <p className="font-semibold text-red-600 tabular-nums mt-0.5">{formatCurrency(displayPlayerPayouts)}</p>
                                    </div>
                                    <div className="text-right sm:text-left">
                                        <p className="text-[11px] uppercase text-slate-500">Gross profit</p>
                                        <p className="font-semibold text-emerald-600 tabular-nums mt-0.5">{formatCurrency(displayGrossProfit)}</p>
                                        <p className="text-[10px] text-slate-500 mt-0.5">Bets − payouts</p>
                                    </div>
                                    <div className="text-right sm:text-left">
                                        <p className="text-[11px] uppercase text-slate-500">Your commission ({commissionRate}%)</p>
                                        <p className="font-semibold text-orange-600 tabular-nums mt-0.5">{formatCurrency(displayOwnCommission)}</p>
                                        {displayCalculatedCommission !== displayOwnCommission && (
                                            <p className="text-[10px] text-slate-500 mt-0.5">
                                                Capped from {formatCurrency(displayCalculatedCommission)}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right sm:text-left">
                                        <p className="text-[11px] uppercase text-slate-500">Settled</p>
                                        <p className="font-semibold text-green-700 tabular-nums mt-0.5">{formatCurrency(displaySettled)}</p>
                                    </div>
                                    <div className="text-right sm:text-left">
                                        <p className="text-[11px] uppercase text-slate-500">Pending</p>
                                        <p className="font-semibold text-orange-700 tabular-nums mt-0.5">{formatCurrency(displayPending)}</p>
                                        {(displaySuperBookieShare > 0 || displayAdminShare > 0) && (
                                            <div className="mt-1 space-y-0.5">
                                                {displaySuperBookieShare > 0 && (
                                                    <p className="text-[10px] text-violet-600 tabular-nums">
                                                        {parentSuperBookieName}: {formatCurrency(displaySuperBookieShare)}
                                                    </p>
                                                )}
                                                {displayAdminShare > 0 && (
                                                    <p className="text-[10px] text-slate-500 tabular-nums">
                                                        Admin: {formatCurrency(displayAdminShare)}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl border p-8 text-center text-gray-500">No data</div>
                        )}

                <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-2">
                        <p className="text-sm font-semibold text-slate-700">{t('commissionPaymentsTitle')}</p>
                        <span className="text-slate-300 hidden sm:inline">·</span>
                        <p className="text-xs text-slate-500">{t('commissionPaymentsHint')}</p>
                    </div>
                    <div className="rounded-lg border border-slate-100 overflow-hidden text-sm">
                        {paymentsLoading ? (
                            <p className="text-sm text-slate-500 py-3 text-center">{t('loading')}</p>
                        ) : settlementHistory.length === 0 ? (
                            <p className="text-sm text-slate-500 py-3 text-center">{t('commissionPaymentsEmpty')}</p>
                        ) : (
                            <>
                                <div className="grid grid-cols-3 gap-2 px-3 py-1.5 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 font-medium">
                                    <span>{t('amount')}</span>
                                    <span>{t('from')}</span>
                                    <span>{t('date')}</span>
                                </div>
                                {settlementHistory.map((payment) => (
                                    <div
                                        key={payment._id}
                                        className="grid grid-cols-3 gap-2 px-3 py-2 border-t border-slate-100 items-center leading-tight"
                                    >
                                        <span className="font-semibold text-green-700 tabular-nums">
                                            {formatCurrency(payment.amount)}
                                        </span>
                                        <span className="text-slate-700 font-medium truncate">
                                            {payment.createdBy || 'SuperBookie'}
                                        </span>
                                        <p className="text-xs text-slate-700 tabular-nums min-w-0 truncate">
                                            {formatPaymentDateTime(payment.createdAt)}
                                        </p>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-2">
                        <p className="text-sm font-semibold text-slate-700">Settlement history</p>
                        <span className="text-slate-300 hidden sm:inline">·</span>
                        <p className="text-xs text-slate-500">Engine-recorded commission per period</p>
                    </div>
                    <div className="rounded-lg border border-slate-100 overflow-hidden text-sm">
                        {settlementsLoading ? (
                            <p className="text-sm text-slate-500 py-3 text-center">{t('loading')}</p>
                        ) : settlements.length === 0 ? (
                            <p className="text-sm text-slate-500 py-3 text-center">No settlements recorded yet.</p>
                        ) : (
                            <>
                                <div className="grid grid-cols-4 gap-2 px-3 py-1.5 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 font-medium">
                                    <span>Period</span>
                                    <span className="text-right">Bets</span>
                                    <span className="text-right">Commission</span>
                                    <span className="text-right">Settled</span>
                                </div>
                                {settlements.map((row) => (
                                    <div
                                        key={row._id}
                                        className="grid grid-cols-4 gap-2 px-3 py-2 border-t border-slate-100 items-center leading-tight"
                                    >
                                        <span className="text-xs text-slate-700">{formatSettlementPeriod(row.periodStart, row.periodEnd)}</span>
                                        <span className="text-right tabular-nums text-slate-700">{formatCurrency(row.totalBet)}</span>
                                        <span className="text-right tabular-nums text-orange-700">{formatCurrency(row.actualCommission)}</span>
                                        <span className="text-right text-xs text-slate-500 tabular-nums">{formatPaymentDateTime(row.settledAt)}</span>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Commission;
