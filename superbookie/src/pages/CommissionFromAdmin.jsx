import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { API_BASE_URL, fetchWithAuth } from '../utils/api';
import { subscribeBookiePanelBalance } from '../lib/panelSocket';
import { useLanguage } from '../context/useLanguage';
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

const CommissionFromAdmin = () => {
    const { t } = useLanguage();
    const PRESETS = getPresets(t);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [paymentTotals, setPaymentTotals] = useState({ advance: 0, settled: 0 });
    const [payments, setPayments] = useState([]);
    const [paymentsLoading, setPaymentsLoading] = useState(false);
    const [dateRange, setDateRange] = useState(() => {
        const d = new Date();
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return { startDate: today, endDate: today };
    });
    const [activePreset, setActivePreset] = useState('today');

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

    useEffect(() => { fetchRevenue(); }, [fetchRevenue]);
    useEffect(() => {
        fetchPayments();
    }, [fetchPayments]);

    useEffect(() => {
        const unsub = subscribeBookiePanelBalance((payload) => {
            const reason = payload?.reason || '';
            if (
                reason === 'commission_recovery_settled'
                || reason === 'commission_settlement'
                || reason === 'advance_commission_transfer'
                || reason === 'advance_commission_from_admin'
                || reason === 'admin_update'
            ) {
                fetchRevenue();
                fetchPayments();
            }
        });
        return unsub;
    }, [fetchRevenue, fetchPayments]);

    const applyPreset = (presetId) => {
        const preset = PRESETS.find((p) => p.id === presetId);
        if (preset) {
            const { from, to } = preset.getRange();
            setDateRange({ startDate: from, endDate: to });
            setActivePreset(presetId);
        }
    };

    const advanceGiven = Number(data?.advanceCommissionPaid ?? paymentTotals.advance ?? 0);
    const advanceRemaining = Number(data?.advanceOutstanding ?? 0);
    const advanceRecovered = Number(data?.advanceRecovered ?? 0);
    const recoveryPendingFromBets = Number(data?.recoveryPendingFromBets ?? 0);
    const superBookieCommissionAllTime = Number(data?.allTimeCommission ?? data?.totalCommission ?? 0);
    const superBookieSettled = Number(data?.displaySettled ?? data?.totalPaid ?? 0);
    const superBookiePending = Number(data?.displayPending ?? data?.totalPending ?? recoveryPendingFromBets);
    const adminRateOnDirect = Number(data?.commissionPercentage ?? 0);
    const hasAdvance = advanceGiven > 0;
    const isRecoveringAdvance = advanceRemaining > 0 || recoveryPendingFromBets > 0;

    const hasDateFilter = Boolean(dateRange.startDate && dateRange.endDate);
    const displayDirectPlayerBetAmount = hasDateFilter
        ? Number(data?.periodDirectBetAmount ?? data?.periodBetAmount ?? data?.totalBetAmount ?? 0)
        : Number(data?.directBetAmount ?? data?.allTimeBetAmount ?? 0);
    const displayPlayerPayouts = hasDateFilter
        ? Number(data?.periodPayouts ?? 0)
        : 0;
    const displayGrossProfit = hasDateFilter
        ? Number(data?.periodGrossProfit ?? (displayDirectPlayerBetAmount - displayPlayerPayouts))
        : Number(data?.grossProfit ?? 0);
    const displaySuperBookieCommission = hasDateFilter
        ? Number(data?.periodSuperBookieCommission ?? data?.periodCommission ?? 0)
        : superBookieCommissionAllTime;
    const displayCalculatedCommission = hasDateFilter
        ? Number(data?.periodCalculatedCommission ?? data?.calculatedCommission ?? displaySuperBookieCommission)
        : Number(data?.calculatedCommission ?? displaySuperBookieCommission);
    const settlementHistory = payments.filter((payment) => {
        if (payment.paymentType !== 'settlement') return false;
        if (!hasDateFilter) return true;
        const d = new Date(payment.createdAt);
        if (Number.isNaN(d.getTime())) return false;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return key >= dateRange.startDate && key <= dateRange.endDate;
    });

    return (
        <Layout title={t('commissionFromAdmin')}>
            <div className="space-y-4 sm:space-y-5">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FaMoneyBillWave className="text-emerald-500" />
                        {t('commissionFromAdmin')}
                    </h1>
                    <p className="text-gray-400 text-xs sm:text-sm mt-1">
                        Player bets × {adminRateOnDirect}% = your commission (profit-capped).
                    </p>
                </div>

                <section className="bg-slate-800 rounded-xl p-4 sm:p-5 shadow-sm text-white space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h2 className="text-lg font-semibold">Commission summary</h2>
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
                            <p className="text-xl sm:text-2xl font-bold mt-1">{formatCurrency(superBookieCommissionAllTime)}</p>
                            <p className="text-[11px] text-blue-200 mt-1">
                                {adminRateOnDirect}% of player bets (all-time)
                            </p>
                        </div>
                        <div className="rounded-lg bg-white/10 border border-white/15 p-3 sm:p-4">
                            <p className="text-[11px] uppercase tracking-wide text-green-200 flex items-center gap-1.5">
                                <FaCheckCircle className="text-green-300" />
                                Settled
                            </p>
                            <p className="text-xl sm:text-2xl font-bold mt-1">{formatCurrency(superBookieSettled)}</p>
                            <p className="text-[11px] text-green-200 mt-1">Your commission paid</p>
                        </div>
                        <div className="rounded-lg bg-white/10 border border-white/15 p-3 sm:p-4">
                            <p className="text-[11px] uppercase tracking-wide text-orange-200 flex items-center gap-1.5">
                                <FaClock className="text-orange-300" />
                                Pending
                            </p>
                            <p className="text-xl sm:text-2xl font-bold mt-1">{formatCurrency(superBookiePending)}</p>
                            <p className="text-[11px] text-orange-200 mt-1">Your commission due</p>
                        </div>
                    </div>
                </section>

                {isRecoveringAdvance && (
                    <p className="text-sm text-violet-800 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
                        {recoveryPendingFromBets > 0
                            ? `${t('commissionRecoveringAdvance')} — ${formatCurrency(recoveryPendingFromBets)} from player bets can be settled by admin toward advance recovery.`
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
                                            activePreset === p.id
                                                ? 'bg-[#1B3150] text-white'
                                                : 'bg-gray-100 border border-gray-200 text-gray-600'
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
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#1B3150] text-white rounded-lg text-sm shrink-0 whitespace-nowrap"
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
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-4">
                                    <p className="text-sm font-semibold text-slate-800">{t('commissionAdminSummary')}</p>
                                    <span className="text-slate-300 hidden sm:inline">·</span>
                                    <p className="text-xs text-slate-500">{hasDateFilter ? t('selectedPeriod') : t('all')}</p>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
                                    <div className="text-right sm:text-left">
                                        <p className="text-[11px] uppercase text-slate-500">{t('directPlayerBetAmount')}</p>
                                        <p className="font-semibold text-slate-800 tabular-nums mt-0.5">{formatCurrency(displayDirectPlayerBetAmount)}</p>
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
                                        <p className="text-[11px] uppercase text-slate-500">Your commission ({adminRateOnDirect}%)</p>
                                        <p className="font-semibold text-orange-600 tabular-nums mt-0.5">{formatCurrency(displaySuperBookieCommission)}</p>
                                        {displayCalculatedCommission !== displaySuperBookieCommission && (
                                            <p className="text-[10px] text-slate-500 mt-0.5">
                                                Capped from {formatCurrency(displayCalculatedCommission)}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right sm:text-left">
                                        <p className="text-[11px] uppercase text-slate-500">Settled</p>
                                        <p className="font-semibold text-green-700 tabular-nums mt-0.5">{formatCurrency(superBookieSettled)}</p>
                                    </div>
                                    <div className="text-right sm:text-left">
                                        <p className="text-[11px] uppercase text-slate-500">Pending</p>
                                        <p className="font-semibold text-orange-700 tabular-nums mt-0.5">{formatCurrency(superBookiePending)}</p>
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
                                            {payment.createdBy || 'Admin'}
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
            </div>
        </Layout>
    );
};

export default CommissionFromAdmin;
