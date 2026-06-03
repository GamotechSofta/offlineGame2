import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { API_BASE_URL, fetchWithAuth } from '../utils/api';
import { useLanguage } from '../context/LanguageContext';
import {
    FaMoneyBillWave,
    FaSyncAlt,
    FaCalendarAlt,
    FaHistory,
    FaPaperPlane,
    FaCheck,
    FaTimes,
} from 'react-icons/fa';

const getPresets = (t) => [
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
    const num = Number(n);
    if (!Number.isFinite(num)) return '₹0';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num);
};

const formatDate = (v) => {
    if (!v) return '-';
    return new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const statusBadge = (status) => {
    if (status === 'approved') return 'bg-green-100 text-green-700';
    if (status === 'rejected') return 'bg-red-100 text-red-700';
    if (status === 'negotiation') return 'bg-blue-100 text-blue-700';
    return 'bg-orange-100 text-orange-700';
};

const Commission = () => {
    const { t } = useLanguage();
    const PRESETS = getPresets(t);
    const [tab, setTab] = useState('overview');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [payments, setPayments] = useState([]);
    const [paymentTotals, setPaymentTotals] = useState({ advance: 0, settled: 0 });
    const [paymentsLoading, setPaymentsLoading] = useState(false);
    const [requests, setRequests] = useState({ currentCommission: 0, requests: [] });
    const [requestsLoading, setRequestsLoading] = useState(false);
    const [requestPct, setRequestPct] = useState('');
    const [requestMsg, setRequestMsg] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [dateRange, setDateRange] = useState(() => {
        const d = new Date();
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return { startDate: today, endDate: today };
    });
    const [activePreset, setActivePreset] = useState('today');

    const fetchRevenue = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                startDate: dateRange.startDate,
                endDate: dateRange.endDate,
            });
            const res = await fetchWithAuth(
                `${API_BASE_URL}/daily-commission/my-summary?${params.toString()}`
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

    const fetchRequests = useCallback(async () => {
        try {
            setRequestsLoading(true);
            const res = await fetchWithAuth(`${API_BASE_URL}/commission/my-requests`);
            const result = await res.json();
            if (result.success) setRequests(result.data || { currentCommission: 0, requests: [] });
        } catch {
            setRequests({ currentCommission: 0, requests: [] });
        } finally {
            setRequestsLoading(false);
        }
    }, []);

    useEffect(() => { fetchRevenue(); }, [fetchRevenue]);
    useEffect(() => {
        fetchPayments();
    }, [fetchPayments]);
    useEffect(() => {
        if (tab === 'request') fetchRequests();
    }, [tab, fetchRequests]);

    const applyPreset = (presetId) => {
        const preset = PRESETS.find((p) => p.id === presetId);
        if (preset) {
            const { from, to } = preset.getRange();
            setDateRange({ startDate: from, endDate: to });
            setActivePreset(presetId);
        }
    };

    const submitRequest = async () => {
        const pct = Number(requestPct);
        if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
            alert('Enter a valid percentage between 0 and 100');
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/commission/request`, {
                method: 'POST',
                body: JSON.stringify({ requestedPercentage: pct, message: requestMsg }),
            });
            const result = await res.json();
            if (result.success) {
                setRequestPct('');
                setRequestMsg('');
                fetchRequests();
                alert(result.message || 'Request submitted');
            } else {
                alert(result.message || 'Failed to submit request');
            }
        } catch {
            alert('Failed to submit request');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCounter = async (requestId, accept) => {
        const path = accept ? 'accept-counter' : 'reject-counter';
        const res = await fetchWithAuth(`${API_BASE_URL}/commission/${path}/${requestId}`, { method: 'POST' });
        const result = await res.json();
        if (result.success) {
            fetchRequests();
            fetchRevenue();
        } else {
            alert(result.message || 'Action failed');
        }
    };

    const tabs = [
        { id: 'overview', label: t('commissionTabOverview') },
        { id: 'payments', label: t('commissionTabBookiePayments') },
        { id: 'request', label: t('commissionTabRequest') },
    ];

    const advanceFromBookie = Number(
        data?.advanceCommissionPaid ?? paymentTotals.advance ?? 0
    );
    const advanceOutstanding = Number(data?.advanceOutstanding ?? 0);
    const advanceRecovered = Number(data?.advanceRecovered ?? 0);
    const commissionSettled = Number(data?.allTimePaid ?? paymentTotals.settled ?? 0);
    const commissionPending = Number(data?.allTimePending ?? 0);
    const commissionEarned = Number(data?.allTimeCommission ?? 0);
    const isRecoveringAdvance = advanceOutstanding > 0;

    return (
        <Layout title="Commission">
            <div className="space-y-4 sm:space-y-5">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FaMoneyBillWave className="text-emerald-500" />
                        Commission
                    </h1>
                    <p className="text-gray-400 text-xs sm:text-sm mt-1">{t('commissionSubtitle')}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                        <p className="text-xs uppercase text-violet-700 font-semibold">{t('commissionAdvanceFromBookie')}</p>
                        <p className="text-2xl font-bold text-violet-900 mt-1">{formatCurrency(advanceFromBookie)}</p>
                        {advanceRecovered > 0 && (
                            <p className="text-xs text-violet-600 mt-1">
                                {t('commissionRecovered')}: {formatCurrency(advanceRecovered)}
                            </p>
                        )}
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                        <p className="text-xs uppercase text-emerald-700 font-semibold">{t('commissionEarned')}</p>
                        <p className="text-2xl font-bold text-emerald-800 mt-1">{formatCurrency(commissionEarned)}</p>
                    </div>
                    <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                        <p className="text-xs uppercase text-green-700 font-semibold">{t('commissionSettled')}</p>
                        <p className="text-2xl font-bold text-green-700 mt-1">{formatCurrency(commissionSettled)}</p>
                    </div>
                    <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
                        <p className="text-xs uppercase text-orange-700 font-semibold">{t('commissionPending')}</p>
                        <p className="text-2xl font-bold text-orange-700 mt-1">{formatCurrency(commissionPending)}</p>
                        {isRecoveringAdvance && (
                            <p className="text-xs text-violet-600 mt-1">
                                {t('commissionAdvanceDue')}: {formatCurrency(advanceOutstanding)}
                            </p>
                        )}
                    </div>
                </div>

                {isRecoveringAdvance && (
                    <p className="text-sm text-violet-800 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
                        {t('commissionRecoveringAdvance')}
                    </p>
                )}

                <div className="flex flex-wrap gap-2">
                    {tabs.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setTab(item.id)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                                tab === item.id ? 'bg-sb-primary text-white' : 'bg-gray-100 text-gray-600'
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                {tab === 'overview' && (
                    <>
                        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
                            <div className="flex flex-wrap gap-1.5 mb-3">
                                {PRESETS.map((p) => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => applyPreset(p.id)}
                                        className={`px-2.5 py-1 rounded-lg text-xs sm:text-sm ${
                                            activePreset === p.id ? 'bg-sb-primary text-white' : 'bg-gray-100'
                                        }`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <FaCalendarAlt className="text-gray-400" />
                                <input
                                    type="date"
                                    value={dateRange.startDate}
                                    onChange={(e) => {
                                        setDateRange((r) => ({ ...r, startDate: e.target.value }));
                                        setActivePreset('');
                                    }}
                                    className="px-2 py-1.5 border rounded-lg text-sm"
                                />
                                <span className="text-gray-500">to</span>
                                <input
                                    type="date"
                                    value={dateRange.endDate}
                                    onChange={(e) => {
                                        setDateRange((r) => ({ ...r, endDate: e.target.value }));
                                        setActivePreset('');
                                    }}
                                    className="px-2 py-1.5 border rounded-lg text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        fetchRevenue();
                                        fetchPayments();
                                    }}
                                    disabled={loading}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-sb-primary text-white rounded-lg text-sm"
                                >
                                    <FaSyncAlt className={loading ? 'animate-spin' : ''} />
                                    Refresh
                                </button>
                            </div>
                        </div>

                        {loading ? (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="h-28 bg-white rounded-xl border animate-pulse" />
                                ))}
                            </div>
                        ) : data ? (
                            <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="bg-white rounded-xl border p-4">
                                    <p className="text-xs uppercase text-gray-500 font-semibold">Period sales</p>
                                    <p className="text-2xl font-bold mt-1">{formatCurrency(data.periodBetAmount)}</p>
                                </div>
                                <div className="bg-white rounded-xl border p-4">
                                    <p className="text-xs uppercase text-gray-500 font-semibold">All-time sales</p>
                                    <p className="text-xl font-bold mt-1">{formatCurrency(data.allTimeBetAmount)}</p>
                                </div>
                                <div className="bg-sb-primary rounded-xl p-4 text-white">
                                    <p className="text-xs uppercase text-blue-100">Period commission ({data.commissionPercentage}%)</p>
                                    <p className="text-2xl font-bold mt-1">{formatCurrency(data.periodCommission)}</p>
                                    <p className="text-xs text-blue-100 mt-1">Selected period only</p>
                                </div>
                            </div>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                <p className="text-sm font-semibold text-slate-700 mb-2">{t('commissionBookieSummary')}</p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                    <div>
                                        <p className="text-xs text-slate-500">{t('commissionAdvanceFromBookie')}</p>
                                        <p className="font-bold text-violet-700">{formatCurrency(advanceFromBookie)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500">{t('commissionSettled')}</p>
                                        <p className="font-bold text-green-700">{formatCurrency(commissionSettled)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500">{t('commissionPending')}</p>
                                        <p className="font-bold text-orange-700">{formatCurrency(commissionPending)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500">{t('commissionRate')}</p>
                                        <p className="font-bold text-slate-800">{data.commissionPercentage ?? 0}%</p>
                                    </div>
                                </div>
                            </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl border p-8 text-center text-gray-500">No data</div>
                        )}
                    </>
                )}

                {tab === 'payments' && (
                    <div className="bg-white rounded-xl border overflow-hidden">
                        <div className="px-4 py-3 border-b flex flex-wrap justify-between items-center gap-2">
                            <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                                <FaHistory /> Advance commission history
                            </h2>
                            <p className="text-sm font-bold text-violet-700">
                                {t('walletTxFromBookieSummary')}: {formatCurrency(fromBookieWallet.received)}
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    fetchPayments();
                                    fetchFromBookieWallet();
                                }}
                                className="text-sm text-sb-primary"
                            >
                                Refresh
                            </button>
                        </div>
                        {paymentsLoading ? (
                            <p className="p-6 text-gray-500 text-sm">Loading...</p>
                        ) : payments.length === 0 ? (
                            <p className="p-6 text-gray-500 text-sm">No payments recorded yet.</p>
                        ) : (
                            <div className="divide-y">
                                {payments.map((p) => (
                                    <div key={p._id} className="px-4 py-3 flex justify-between">
                                        <div>
                                            <p
                                                className={`text-xs font-semibold uppercase ${
                                                    p.paymentType === 'settlement'
                                                        ? 'text-green-700'
                                                        : 'text-violet-700'
                                                }`}
                                            >
                                                {p.label || (p.paymentType === 'settlement' ? t('commissionSettled') : t('commissionAdvanceFromBookie'))}
                                            </p>
                                            <p
                                                className={`font-semibold ${
                                                    p.paymentType === 'settlement' ? 'text-green-700' : 'text-violet-800'
                                                }`}
                                            >
                                                {formatCurrency(p.amount)}
                                            </p>
                                            <p className="text-xs text-gray-500">{formatDate(p.createdAt)} · {p.createdBy}</p>
                                            {p.notes ? <p className="text-xs text-gray-400">{p.notes}</p> : null}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {tab === 'request' && (
                    <div className="space-y-4">
                        <div className="bg-white rounded-xl border p-4">
                            <p className="text-sm text-gray-600">
                                Current commission rate:{' '}
                                <span className="font-bold text-sb-primary">{requests.currentCommission ?? data?.commissionPercentage ?? 0}%</span>
                            </p>
                        </div>

                        <div className="bg-white rounded-xl border p-4 space-y-3">
                            <h2 className="font-semibold text-gray-800">Request new percentage</h2>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={requestPct}
                                onChange={(e) => setRequestPct(e.target.value)}
                                placeholder="Requested %"
                                className="w-full px-3 py-2 border rounded-lg"
                            />
                            <textarea
                                value={requestMsg}
                                onChange={(e) => setRequestMsg(e.target.value)}
                                placeholder="Message (optional)"
                                rows={2}
                                className="w-full px-3 py-2 border rounded-lg text-sm"
                            />
                            <button
                                type="button"
                                disabled={submitting}
                                onClick={submitRequest}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-sb-primary text-white rounded-lg text-sm disabled:opacity-50"
                            >
                                <FaPaperPlane />
                                {submitting ? 'Submitting...' : 'Submit request'}
                            </button>
                        </div>

                        <div className="bg-white rounded-xl border overflow-hidden">
                            <div className="px-4 py-3 border-b font-semibold text-gray-700">Your requests</div>
                            {requestsLoading ? (
                                <p className="p-4 text-sm text-gray-500">Loading...</p>
                            ) : (requests.requests || []).length === 0 ? (
                                <p className="p-4 text-sm text-gray-500">No requests yet.</p>
                            ) : (
                                <div className="divide-y">
                                    {(requests.requests || []).map((req) => (
                                        <div key={req._id} className="p-4">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div>
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge(req.status)}`}>
                                                        {req.status}
                                                    </span>
                                                    <p className="text-sm mt-1">
                                                        {req.currentPercentage}% → <strong>{req.requestedPercentage}%</strong>
                                                    </p>
                                                    {req.adminResponse ? (
                                                        <p className="text-xs text-gray-500 mt-1">{req.adminResponse}</p>
                                                    ) : null}
                                                </div>
                                                {req.status === 'negotiation' && req.counterOffer != null && (
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCounter(req._id, true)}
                                                            className="px-2 py-1 bg-green-600 text-white rounded text-xs flex items-center gap-1"
                                                        >
                                                            <FaCheck /> Accept {req.counterOffer}%
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCounter(req._id, false)}
                                                            className="px-2 py-1 bg-red-500 text-white rounded text-xs flex items-center gap-1"
                                                        >
                                                            <FaTimes /> Reject
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default Commission;
