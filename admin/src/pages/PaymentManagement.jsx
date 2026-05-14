import React, { useState, useEffect, useRef, useMemo } from 'react';
import AdminLayout from '../components/AdminLayout';
import { useNavigate } from 'react-router-dom';
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTraceRender } from '../lib/runtimeTrace';
import useAdminPaymentsQueryInvalidation from '../hooks/useAdminPaymentsQueryInvalidation';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';
import { getAuthHeaders, clearAdminSession, fetchWithAuth } from '../lib/auth';
import { getTodayIST } from '../utils/istDate.js';

const IST_MS = 330 * 60 * 1000;

function istYmdStartUtc(y, m, d) {
    return Date.UTC(y, m - 1, d, 0, 0, 0, 0) - IST_MS;
}

function fmtIstDayFromMs(ms) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date(ms));
}

function addDaysIst(ymd, delta) {
    const [y, m, d] = ymd.split('-').map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return ymd;
    return fmtIstDayFromMs(istYmdStartUtc(y, m, d) + delta * 86400000);
}

function istWeekdaySun0(ymd) {
    const [y, m, d] = ymd.split('-').map(Number);
    const ms = istYmdStartUtc(y, m, d) + 12 * 60 * 60 * 1000;
    const short = new Date(ms).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' });
    const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return map[short] ?? 0;
}

/** Monday = 0 … Sunday = 6 (IST calendar day). */
function istWeekdayMon0(ymd) {
    const sun0 = istWeekdaySun0(ymd);
    return sun0 === 0 ? 6 : sun0 - 1;
}

const DATE_PRESETS = [
    { id: 'all', label: 'All', getRange: () => ({ from: '', to: '' }) },
    {
        id: 'today',
        label: 'Today',
        getRange: () => {
            const t = getTodayIST();
            return { from: t, to: t };
        },
    },
    {
        id: 'yesterday',
        label: 'Yesterday',
        getRange: () => {
            const t = getTodayIST();
            const y = addDaysIst(t, -1);
            return { from: y, to: y };
        },
    },
    {
        id: 'this_week',
        label: 'This Week',
        getRange: () => {
            const today = getTodayIST();
            const idx = istWeekdayMon0(today);
            const from = addDaysIst(today, -idx);
            return { from, to: today };
        },
    },
    {
        id: 'last_week',
        label: 'Last Week',
        getRange: () => {
            const today = getTodayIST();
            const idx = istWeekdayMon0(today);
            const thisMon = addDaysIst(today, -idx);
            const from = addDaysIst(thisMon, -7);
            const to = addDaysIst(thisMon, -1);
            return { from, to };
        },
    },
    {
        id: 'this_month',
        label: 'This Month',
        getRange: () => {
            const today = getTodayIST();
            const [y, m] = today.split('-').map(Number);
            const from = `${y}-${String(m).padStart(2, '0')}-01`;
            return { from, to: today };
        },
    },
    {
        id: 'last_month',
        label: 'Last Month',
        getRange: () => {
            const today = getTodayIST();
            const [ty, tm] = today.split('-').map(Number);
            const firstThis = `${ty}-${String(tm).padStart(2, '0')}-01`;
            const lastPrev = addDaysIst(firstThis, -1);
            const [ly, lm] = lastPrev.split('-').map(Number);
            const from = `${ly}-${String(lm).padStart(2, '0')}-01`;
            return { from, to: lastPrev };
        },
    },
];

/** One IST calendar YYYY-MM-DD as a readable label (India has no DST). */
function formatIstYmdLabel(ymd) {
    if (typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ymd.trim())) return String(ymd || '');
    const [y, m, d] = ymd.trim().split('-').map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return ymd;
    const utcMs = Date.UTC(y, m - 1, d, 6, 30, 0, 0);
    return new Date(utcMs).toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

const formatRangeLabel = (from, to) => {
    if (!from || !to) return 'All time';
    if (from === to) return formatIstYmdLabel(from);
    return `${formatIstYmdLabel(from)} – ${formatIstYmdLabel(to)}`;
};

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

const PaymentManagement = () => {
    useTraceRender('PaymentManagement');
    useAdminPaymentsQueryInvalidation({
        enabled: typeof window !== 'undefined' && !!localStorage.getItem('admin'),
        queryKeys: [['payments-list'], ['payments-dashboard-stats']],
        throttleMs: 600,
    });
    const navigate = useNavigate();
    const PAGE_SIZE = 50;
    const [loading, setLoading] = useState(true);
    const [playerSearch, setPlayerSearch] = useState('');
    const [amountSearch, setAmountSearch] = useState('');
    const [debouncedPlayerSearch, setDebouncedPlayerSearch] = useState('');
    const [debouncedAmountSearch, setDebouncedAmountSearch] = useState('');
    const [filters, setFilters] = useState({
        status: '',
        type: '',
    });
    /** When set, list is scoped to this player's full payment history (all statuses/types unless filters apply). */
    const [playerFilter, setPlayerFilter] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);

    const [datePreset, setDatePreset] = useState('today');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [customMode, setCustomMode] = useState(false);
    const [customOpen, setCustomOpen] = useState(false);

    // Modal state
    const [actionModal, setActionModal] = useState({ show: false, payment: null, action: '' });
    const [adminRemarks, setAdminRemarks] = useState('');
    const [processing, setProcessing] = useState(false);
    const [hasSecretDeclarePassword, setHasSecretDeclarePassword] = useState(false);
    const [secretPassword, setSecretPassword] = useState('');
    const [actionPasswordError, setActionPasswordError] = useState('');

    // Image preview modal
    const [imageModal, setImageModal] = useState({ show: false, url: '' });
    const imageModalHistoryPushedRef = useRef(false);

    // Detail modal for viewing full payment details
    const [detailModal, setDetailModal] = useState({ show: false, payment: null });
    const [expandedPaymentId, setExpandedPaymentId] = useState(null);
    const actionModalHistoryPushedRef = useRef(false);
    const detailModalHistoryPushedRef = useRef(false);
    const queryClient = useQueryClient();

    useEffect(() => {
        const t = window.setTimeout(() => {
            setDebouncedPlayerSearch(playerSearch.trim());
        }, 400);
        return () => window.clearTimeout(t);
    }, [playerSearch]);

    useEffect(() => {
        const t = window.setTimeout(() => {
            setDebouncedAmountSearch(amountSearch.trim());
        }, 400);
        return () => window.clearTimeout(t);
    }, [amountSearch]);

    useEffect(() => {
        fetchWithAuth(`${API_BASE_URL}/admin/me/secret-declare-password-status`)
            .then((res) => { if (res.status === 401) return; return res.json(); })
            .then((json) => {
                if (json && json.success) setHasSecretDeclarePassword(json.hasSecretDeclarePassword || false);
            })
            .catch(() => setHasSecretDeclarePassword(false));
    }, []);

    const getPaymentUserId = (payment) => {
        const u = payment?.userId;
        if (!u) return '';
        if (typeof u === 'string') return u;
        if (u._id) return String(u._id);
        return '';
    };

    const effectiveDateRange = useMemo(() => {
        if (customMode && customFrom && customTo) return { from: customFrom, to: customTo };
        const preset = DATE_PRESETS.find((p) => p.id === datePreset);
        return preset ? preset.getRange() : DATE_PRESETS[0].getRange();
    }, [customMode, customFrom, customTo, datePreset]);

    const selectPlayerFromPayment = (payment) => {
        const userId = getPaymentUserId(payment);
        if (!userId) return;
        const u = payment.userId;
        setPlayerFilter({
            userId,
            username: typeof u === 'object' && u?.username ? u.username : '',
            phone: typeof u === 'object' && u?.phone ? u.phone : '',
        });
    };

    const fetchPayments = async () => {
        try {
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

            const response = await fetchWithAuth(`${API_BASE_URL}/payments?${queryParams}`);
            if (response.status === 401) {
                return {
                    data: [],
                    pagination: { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1, hasNextPage: false, hasPrevPage: false },
                };
            }
            const data = await response.json();
            if (data.success) {
                return {
                    data: data.data || [],
                    pagination: data.pagination || { page: currentPage, limit: PAGE_SIZE, total: 0, totalPages: 1, hasNextPage: false, hasPrevPage: false },
                };
            }
            return {
                data: [],
                pagination: { page: currentPage, limit: PAGE_SIZE, total: 0, totalPages: 1, hasNextPage: false, hasPrevPage: currentPage > 1 },
            };
        } catch (err) {
            console.error('Error fetching payments:', err);
            return {
                data: [],
                pagination: { page: currentPage, limit: PAGE_SIZE, total: 0, totalPages: 1, hasNextPage: false, hasPrevPage: currentPage > 1 },
            };
        }
    };

    const fetchDashboardStats = async () => {
        try {
            const queryParams = new URLSearchParams();
            if (effectiveDateRange?.from && effectiveDateRange?.to) {
                queryParams.append('from', effectiveDateRange.from);
                queryParams.append('to', effectiveDateRange.to);
            }
            const qs = queryParams.toString();
            const response = await fetchWithAuth(
                `${API_BASE_URL}/payments/dashboard-stats${qs ? `?${qs}` : ''}`,
            );
            if (response.status === 401) return EMPTY_DASHBOARD_STATS;
            const data = await response.json();
            if (data.success && data.data) return data.data;
            return EMPTY_DASHBOARD_STATS;
        } catch (err) {
            console.error('Error fetching payment dashboard stats:', err);
            return EMPTY_DASHBOARD_STATS;
        }
    };

    const paymentsQuery = useQuery({
        queryKey: [
            'payments-list',
            filters.status || '',
            filters.type || '',
            playerFilter?.userId || '',
            effectiveDateRange?.from || '',
            effectiveDateRange?.to || '',
            currentPage,
            debouncedPlayerSearch,
            debouncedAmountSearch,
        ],
        queryFn: () => fetchPayments(),
        enabled: !!localStorage.getItem('admin'),
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    });

    const dashboardStatsQuery = useQuery({
        queryKey: ['payments-dashboard-stats', effectiveDateRange?.from || '', effectiveDateRange?.to || ''],
        queryFn: fetchDashboardStats,
        enabled: !!localStorage.getItem('admin'),
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    });

    const payments = paymentsQuery.data?.data ?? [];
    const pagination = paymentsQuery.data?.pagination ?? {
        page: currentPage,
        limit: PAGE_SIZE,
        total: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: currentPage > 1,
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [filters.status, filters.type, playerFilter?.userId, datePreset, customMode, customFrom, customTo, debouncedPlayerSearch, debouncedAmountSearch]);

    useEffect(() => {
        setLoading(
            paymentsQuery.isLoading
            || paymentsQuery.isFetching
            || dashboardStatsQuery.isLoading
            || dashboardStatsQuery.isFetching,
        );
    }, [
        paymentsQuery.isLoading,
        paymentsQuery.isFetching,
        dashboardStatsQuery.isLoading,
        dashboardStatsQuery.isFetching,
    ]);

    const dash = dashboardStatsQuery.data ?? EMPTY_DASHBOARD_STATS;

    const openActionModal = (payment, action) => {
        setActionModal({ show: true, payment, action });
        setAdminRemarks('');
        setSecretPassword('');
        setActionPasswordError('');
    };

    const closeActionModal = () => {
        if (actionModal.show && actionModalHistoryPushedRef.current) {
            actionModalHistoryPushedRef.current = false;
            window.history.back();
            return;
        }
        setActionModal({ show: false, payment: null, action: '' });
        setAdminRemarks('');
        setSecretPassword('');
        setActionPasswordError('');
    };

    const closeDetailModal = () => {
        if (detailModal.show && detailModalHistoryPushedRef.current) {
            detailModalHistoryPushedRef.current = false;
            window.history.back();
            return;
        }
        setDetailModal({ show: false, payment: null });
    };

    const actionMutation = useMutation({
        mutationFn: async ({ payment, action, remarks, secretDeclarePassword }) => {
            const endpoint = action === 'approve'
                ? `${API_BASE_URL}/payments/${payment._id}/approve`
                : `${API_BASE_URL}/payments/${payment._id}/reject`;
            const body = { adminRemarks: remarks };
            if (action === 'approve' && hasSecretDeclarePassword) {
                body.secretDeclarePassword = secretDeclarePassword?.trim() || '';
            }
            const response = await fetchWithAuth(endpoint, {
                method: 'POST',
                body: JSON.stringify(body),
            });
            if (response.status === 401) return { success: false, unauthorized: true };
            return response.json();
        },
        onMutate: ({ payment, action, remarks }) => {
            setProcessing(true);
            setActionPasswordError('');
            const nextStatus = action === 'approve' ? 'approved' : 'rejected';
            queryClient.setQueriesData({ queryKey: ['payments-list'] }, (old) => {
                if (!old || !Array.isArray(old.data)) return old;
                return {
                    ...old,
                    data: old.data.map((item) => (
                        item._id === payment._id
                            ? { ...item, status: nextStatus, adminRemarks: remarks || item.adminRemarks }
                            : item
                    )),
                };
            });
        },
        onSuccess: async (data) => {
            if (data?.success) {
                await Promise.all([
                    queryClient.invalidateQueries({ queryKey: ['payments-list'] }),
                    queryClient.invalidateQueries({ queryKey: ['payments-dashboard-stats'] }),
                ]);
                closeActionModal();
                return;
            }
            if (data?.code === 'INVALID_SECRET_DECLARE_PASSWORD') {
                setActionPasswordError(data.message || 'Invalid secret password');
                await Promise.all([
                    queryClient.invalidateQueries({ queryKey: ['payments-list'] }),
                    queryClient.invalidateQueries({ queryKey: ['payments-dashboard-stats'] }),
                ]);
                return;
            }
            if (!data?.unauthorized) {
                alert(data?.message || 'Action failed');
            }
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['payments-list'] }),
                queryClient.invalidateQueries({ queryKey: ['payments-dashboard-stats'] }),
            ]);
        },
        onError: async () => {
            alert('Error processing action');
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['payments-list'] }),
                queryClient.invalidateQueries({ queryKey: ['payments-dashboard-stats'] }),
            ]);
        },
        onSettled: () => {
            setProcessing(false);
        },
    });

    const handleAction = async () => {
        if (!actionModal.payment || !actionModal.action) return;
        if (actionModal.action === 'approve' && hasSecretDeclarePassword && !secretPassword.trim()) {
            setActionPasswordError('Please enter the secret declare password');
            return;
        }
        await actionMutation.mutateAsync({
            payment: actionModal.payment,
            action: actionModal.action,
            remarks: adminRemarks,
            secretDeclarePassword: secretPassword,
        });
    };

    const handleLogout = () => {
        clearAdminSession();
        navigate('/');
    };

    const handleDatePresetSelect = (presetId) => {
        if (!customMode && datePreset === presetId) {
            queryClient.invalidateQueries({ queryKey: ['payments-list'] });
            queryClient.invalidateQueries({ queryKey: ['payments-dashboard-stats'] });
            return;
        }
        setDatePreset(presetId);
        setCustomMode(false);
        setCustomOpen(false);
    };

    const handleCustomDateToggle = () => {
        setCustomMode(true);
        setCustomOpen((o) => !o);
    };

    const handleCustomDateApply = () => {
        if (!customFrom || !customTo) return;
        if (new Date(customFrom) > new Date(customTo)) return;
        setCustomMode(true);
        setCustomOpen(false);
    };

    const displayDateRangeLabel = useMemo(() => {
        const from = typeof effectiveDateRange?.from === 'string' ? effectiveDateRange.from.trim() : '';
        const to = typeof effectiveDateRange?.to === 'string' ? effectiveDateRange.to.trim() : '';
        if (from && to) return formatRangeLabel(from, to);
        return 'All time';
    }, [effectiveDateRange?.from, effectiveDateRange?.to]);

    const closeImageModal = () => {
        if (imageModal.show && imageModalHistoryPushedRef.current) {
            imageModalHistoryPushedRef.current = false;
            window.history.back();
            return;
        }
        setImageModal({ show: false, url: '' });
    };

    useEffect(() => {
        if (!actionModal.show) {
            actionModalHistoryPushedRef.current = false;
            return undefined;
        }
        window.history.pushState({ paymentActionModal: true }, '');
        actionModalHistoryPushedRef.current = true;

        const onPopState = () => {
            actionModalHistoryPushedRef.current = false;
            setActionModal({ show: false, payment: null, action: '' });
            setAdminRemarks('');
            setSecretPassword('');
            setActionPasswordError('');
        };

        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, [actionModal.show]);

    useEffect(() => {
        if (!detailModal.show) {
            detailModalHistoryPushedRef.current = false;
            return undefined;
        }
        window.history.pushState({ paymentDetailModal: true }, '');
        detailModalHistoryPushedRef.current = true;

        const onPopState = () => {
            detailModalHistoryPushedRef.current = false;
            setDetailModal({ show: false, payment: null });
        };

        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, [detailModal.show]);

    useEffect(() => {
        if (!imageModal.show) {
            imageModalHistoryPushedRef.current = false;
            return undefined;
        }

        // Add a history entry so mobile hardware back closes screenshot first.
        window.history.pushState({ paymentImageModal: true }, '');
        imageModalHistoryPushedRef.current = true;

        const onPopState = () => {
            imageModalHistoryPushedRef.current = false;
            setImageModal({ show: false, url: '' });
        };

        window.addEventListener('popstate', onPopState);
        return () => {
            window.removeEventListener('popstate', onPopState);
        };
    }, [imageModal.show]);

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
            approved: 'bg-green-600/30 text-green-600 border-green-600/50',
            rejected: 'bg-red-600/30 text-red-500 border-red-600/50',
            completed: 'bg-blue-600/30 text-blue-600 border-blue-600/50',
        };
        return styles[status] || 'bg-gray-200/30 text-gray-400 border-gray-200';
    };

    const getTypeBadge = (type) => {
        return type === 'deposit' 
            ? 'bg-green-600/20 text-green-600 border-green-600/40'
            : 'bg-purple-600/20 text-purple-600 border-purple-600/40';
    };

    const hasDateRange = Boolean(effectiveDateRange?.from && effectiveDateRange?.to);
    const isAllPaymentsView = !playerFilter?.userId && !filters.status && !filters.type && !hasDateRange
        && !debouncedPlayerSearch && !debouncedAmountSearch;
    const hasActiveFilters = Boolean(
        filters.status
        || filters.type
        || playerFilter?.userId
        || hasDateRange
        || debouncedPlayerSearch
        || debouncedAmountSearch,
    );
    const pendingRequireAction = dash.totalPending.count > 0;

    return (
        <AdminLayout onLogout={handleLogout} title="Payments">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-3">
                    <FaWallet className="text-orange-500" />
                    Payment Management
                </h1>
            </div>

            {/* Date range (IST calendar days — matches dashboard) */}
            <div className="bg-white rounded-xl p-4 border border-gray-200 mb-6">
                <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Date range</p>
                </div>
                <div className="grid grid-cols-4 gap-x-1.5 gap-y-1.5 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
                    {DATE_PRESETS.map((p) => {
                        const isActive = !customMode && datePreset === p.id;
                        return (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => handleDatePresetSelect(p.id)}
                                className={`min-w-0 px-1 py-1.5 text-[10px] sm:px-4 sm:py-2 sm:text-sm font-semibold leading-snug text-center rounded-md transition-all sm:rounded-lg ${
                                    isActive ? 'bg-orange-500 text-white' : 'bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {p.label}
                            </button>
                        );
                    })}
                    <button
                        type="button"
                        onClick={handleCustomDateToggle}
                        className={`min-w-0 px-1 py-1.5 text-[10px] sm:px-4 sm:py-2 sm:text-sm font-semibold leading-snug text-center rounded-md transition-all sm:rounded-lg ${
                            customMode && ((customFrom && customTo) || customOpen) ? 'bg-orange-500 text-white' : 'bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        Custom
                    </button>
                    {customOpen && (
                        <div className="col-span-4 w-full flex flex-wrap items-end gap-2 sm:gap-3 mt-1 p-2 sm:mt-3 sm:p-3 rounded-lg bg-gray-50 border border-gray-200 sm:basis-full">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">From</label>
                                <input
                                    type="date"
                                    value={customFrom}
                                    onChange={(e) => setCustomFrom(e.target.value)}
                                    className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-800"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">To</label>
                                <input
                                    type="date"
                                    value={customTo}
                                    onChange={(e) => setCustomTo(e.target.value)}
                                    className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-800"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleCustomDateApply}
                                className="px-4 py-2 rounded-lg bg-orange-500 text-white font-semibold text-sm"
                            >
                                Apply
                            </button>
                        </div>
                    )}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                    Showing payments for: <span className="text-orange-500 font-medium">{displayDateRangeLabel}</span>
                    {hasDateRange && (
                        <span className="text-gray-400"> (IST)</span>
                    )}
                </p>
                <p className="text-[11px] text-gray-400 mt-1 leading-snug">
                    Summary cards and the payment list both use this range (IST midnight–midnight for each day).
                </p>
            </div>

            {/* Dashboard stats (counts + amounts for selected date range) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3 mb-6">
                <div
                    className={`rounded-xl p-2.5 sm:p-4 border-2 transition-all cursor-pointer ${
                        filters.status === 'approved' && filters.type === 'deposit'
                            ? 'border-green-500 bg-green-500/10'
                            : 'border-gray-200 bg-white hover:border-gray-200'
                    }`}
                    onClick={() => setFilters({ status: 'approved', type: 'deposit' })}
                    title="Filter: approved deposits (stats include completed)"
                >
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <p className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wide leading-tight">Approved Deposits</p>
                            <p className="text-lg sm:text-2xl font-bold text-green-600 mt-0.5">{dash.approvedDeposits.count}</p>
                            <p className="text-[10px] sm:text-xs text-gray-600 mt-0 font-medium">{fmtInr(dash.approvedDeposits.totalAmount)}</p>
                            <p className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5 leading-tight">Click to filter</p>
                        </div>
                        <FaCheck className="w-6 h-6 sm:w-9 sm:h-9 text-green-500/45 shrink-0 mt-0.5" />
                    </div>
                </div>
                <div
                    className={`rounded-xl p-2.5 sm:p-4 border-2 transition-all cursor-pointer ${
                        filters.status === 'pending' && filters.type === 'deposit'
                            ? 'border-amber-500 bg-orange-500/10'
                            : 'border-gray-200 bg-white hover:border-gray-200'
                    }`}
                    onClick={() => setFilters({ status: 'pending', type: 'deposit' })}
                    title="Click to view pending deposits"
                >
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <p className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wide leading-tight">Pending Deposits</p>
                            <p className="text-lg sm:text-2xl font-bold text-orange-500 mt-0.5">{dash.pendingDeposits.count}</p>
                            <p className="text-[10px] sm:text-xs text-gray-600 mt-0 font-medium">{fmtInr(dash.pendingDeposits.totalAmount)}</p>
                            <p className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5 leading-tight">Click to filter</p>
                        </div>
                        <FaArrowDown className="w-6 h-6 sm:w-9 sm:h-9 text-orange-500/50 shrink-0 mt-0.5" />
                    </div>
                </div>
                <div
                    className={`rounded-xl p-2.5 sm:p-4 border-2 transition-all cursor-pointer ${
                        filters.status === 'approved' && filters.type === 'withdrawal'
                            ? 'border-purple-500 bg-purple-500/10'
                            : 'border-gray-200 bg-white hover:border-gray-200'
                    }`}
                    onClick={() => setFilters({ status: 'approved', type: 'withdrawal' })}
                    title="Filter: approved withdrawals (stats include completed)"
                >
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <p className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wide leading-tight">Approved Withdrawals</p>
                            <p className="text-lg sm:text-2xl font-bold text-purple-600 mt-0.5">{dash.approvedWithdrawals.count}</p>
                            <p className="text-[10px] sm:text-xs text-gray-600 mt-0 font-medium">{fmtInr(dash.approvedWithdrawals.totalAmount)}</p>
                            <p className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5 leading-tight">Click to filter</p>
                        </div>
                        <FaCheck className="w-6 h-6 sm:w-9 sm:h-9 text-purple-500/45 shrink-0 mt-0.5" />
                    </div>
                </div>
                <div
                    className={`rounded-xl p-2.5 sm:p-4 border-2 transition-all cursor-pointer ${
                        filters.status === 'pending' && filters.type === 'withdrawal'
                            ? 'border-amber-500 bg-orange-500/10'
                            : 'border-gray-200 bg-white hover:border-gray-200'
                    }`}
                    onClick={() => setFilters({ status: 'pending', type: 'withdrawal' })}
                    title="Click to view pending withdrawals"
                >
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <p className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wide leading-tight">Pending Withdrawals</p>
                            <p className="text-lg sm:text-2xl font-bold text-orange-500 mt-0.5">{dash.pendingWithdrawals.count}</p>
                            <p className="text-[10px] sm:text-xs text-gray-600 mt-0 font-medium">{fmtInr(dash.pendingWithdrawals.totalAmount)}</p>
                            <p className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5 leading-tight">Click to filter</p>
                        </div>
                        <FaArrowUp className="w-6 h-6 sm:w-9 sm:h-9 text-purple-500/50 shrink-0 mt-0.5" />
                    </div>
                </div>
                <div
                    className={`rounded-xl p-2.5 sm:p-4 border-2 transition-all cursor-pointer ${
                        filters.status === 'rejected' && filters.type === 'withdrawal'
                            ? 'border-red-400 bg-red-500/10'
                            : 'border-gray-200 bg-white hover:border-gray-200'
                    }`}
                    onClick={() => setFilters({ status: 'rejected', type: 'withdrawal' })}
                    title="Rejected withdrawals"
                >
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <p className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wide leading-tight">Rejected Withdrawals</p>
                            <p className="text-lg sm:text-2xl font-bold text-red-500 mt-0.5">{dash.rejectedWithdrawals.count}</p>
                            <p className="text-[10px] sm:text-xs text-gray-600 mt-0 font-medium">{fmtInr(dash.rejectedWithdrawals.totalAmount)}</p>
                            <p className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5 leading-tight">Click to filter</p>
                        </div>
                        <FaTimes className="w-6 h-6 sm:w-9 sm:h-9 text-red-400/50 shrink-0 mt-0.5" />
                    </div>
                </div>
                <div
                    className={`rounded-xl p-2.5 sm:p-4 border-2 transition-all cursor-pointer ${
                        filters.status === 'rejected' && filters.type === 'deposit'
                            ? 'border-amber-600 bg-amber-500/10'
                            : 'border-gray-200 bg-white hover:border-gray-200'
                    }`}
                    onClick={() => setFilters({ status: 'rejected', type: 'deposit' })}
                    title="Rejected / failed deposits"
                >
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <p className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wide leading-tight">Failed Deposits</p>
                            <p className="text-lg sm:text-2xl font-bold text-amber-700 mt-0.5">{dash.failedDeposits.count}</p>
                            <p className="text-[10px] sm:text-xs text-gray-600 mt-0 font-medium">{fmtInr(dash.failedDeposits.totalAmount)}</p>
                            <p className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5 leading-tight">Rejected deposits</p>
                        </div>
                        <FaExclamationTriangle className="w-6 h-6 sm:w-9 sm:h-9 text-amber-600/50 shrink-0 mt-0.5" />
                    </div>
                </div>
                <div
                    className={`rounded-xl p-2.5 sm:p-4 border-2 transition-all cursor-pointer ${
                        isAllPaymentsView
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-gray-200 bg-white hover:border-gray-200'
                    } col-span-2 sm:col-span-1 xl:col-span-1`}
                    onClick={() => {
                        setFilters({ status: '', type: '' });
                        setPlayerFilter(null);
                        setPlayerSearch('');
                        setAmountSearch('');
                        setDatePreset('all');
                        setCustomMode(false);
                        setCustomOpen(false);
                    }}
                    title="Click to view all payments"
                >
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <p className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wide leading-tight">Total Pending</p>
                            <p className="text-lg sm:text-2xl font-bold text-blue-600 mt-0.5">{dash.totalPending.count}</p>
                            <p className="text-[10px] sm:text-xs text-gray-600 mt-0 font-medium">{fmtInr(dash.totalPending.totalAmount)}</p>
                            <p className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5 leading-tight">{pendingRequireAction ? 'Requires action' : 'All clear'}</p>
                        </div>
                        <FaClock className="w-6 h-6 sm:w-9 sm:h-9 text-blue-500/50 shrink-0 mt-0.5" />
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl p-3 sm:p-5 mb-6 border border-gray-200">
                <div className="flex items-center gap-2 mb-3">
                    <FaFilter className="text-gray-500 w-4 h-4" />
                    <span className="text-xs sm:text-sm font-medium text-gray-400">Filter Payments</span>
                    {hasActiveFilters && (
                        <span className="ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-500 text-[10px] sm:text-xs">
                            Filters active
                        </span>
                    )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3 items-end">
                    <div>
                        <label className="block text-[10px] sm:text-xs text-gray-500 mb-1">Status</label>
                        <select
                            value={filters.status}
                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-xs sm:text-sm text-gray-800 focus:ring-2 focus:ring-amber-500/50"
                        >
                            <option value="">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] sm:text-xs text-gray-500 mb-1">Type</label>
                        <select
                            value={filters.type}
                            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-xs sm:text-sm text-gray-800 focus:ring-2 focus:ring-amber-500/50"
                        >
                            <option value="">All Types</option>
                            <option value="deposit">Deposit</option>
                            <option value="withdrawal">Withdrawal</option>
                        </select>
                    </div>
                    <div className="sm:col-span-2 lg:col-span-1">
                        <label className="block text-[10px] sm:text-xs text-gray-500 mb-1">Search by player</label>
                        <div className="relative">
                            <FaSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                            <input
                                type="search"
                                value={playerSearch}
                                onChange={(e) => setPlayerSearch(e.target.value)}
                                placeholder="Username or phone"
                                autoComplete="off"
                                className="w-full rounded-lg border border-gray-200 bg-gray-100 py-2 pl-9 pr-3 text-xs text-gray-800 focus:ring-2 focus:ring-amber-500/50 sm:text-sm"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] sm:text-xs text-gray-500 mb-1">Search by amount</label>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={amountSearch}
                            onChange={(e) => setAmountSearch(e.target.value.replace(/[^\d.]/g, ''))}
                            placeholder="Exact match (₹)"
                            autoComplete="off"
                            className="w-full rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-xs text-gray-800 focus:ring-2 focus:ring-amber-500/50 sm:text-sm"
                        />
                    </div>
                    <div className="flex items-end sm:col-span-2 lg:col-span-1">
                        <button
                            type="button"
                            onClick={() => {
                                setFilters({ status: '', type: '' });
                                setPlayerFilter(null);
                                setPlayerSearch('');
                                setAmountSearch('');
                                setDatePreset('all');
                                setCustomMode(false);
                                setCustomOpen(false);
                            }}
                            className="w-full px-2.5 sm:px-3 py-2 bg-gray-200 hover:bg-gray-500 rounded-lg text-gray-800 text-[11px] sm:text-sm font-medium transition-colors"
                        >
                            Clear Filters
                        </button>
                    </div>
                </div>
            </div>

            {playerFilter?.userId && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-orange-200 bg-orange-50/80 px-3 py-2.5 sm:px-4">
                    <p className="text-xs sm:text-sm text-gray-700">
                        <span className="font-semibold text-gray-900">Player:</span>{' '}
                        {playerFilter.username || 'Unknown'}
                        {playerFilter.phone ? (
                            <span className="text-gray-500"> · {playerFilter.phone}</span>
                        ) : null}
                        <span className="text-gray-500"> — full payment history</span>
                    </p>
                    <button
                        type="button"
                        onClick={() => setPlayerFilter(null)}
                        className="shrink-0 rounded-lg border border-orange-300 bg-white px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-50"
                    >
                        Show all players
                    </button>
                </div>
            )}

            {/* Summary bar */}
            {!loading && (
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <p className="text-sm text-gray-400">
                        Showing <span className="font-semibold text-gray-800">{payments.length}</span> of{' '}
                        <span className="font-semibold text-gray-800">{pagination.total}</span> payment{pagination.total !== 1 ? 's' : ''}{' '}
                        {hasActiveFilters && (
                            <span className="ml-2 text-orange-500">(filtered)</span>
                        )}
                    </p>
                    {pendingRequireAction && payments.some((p) => p.status === 'pending') && (
                        <p className="text-xs text-orange-500 flex items-center gap-2">
                            <FaClock className="w-3.5 h-3.5" />
                            Some payments need your approval
                        </p>
                    )}
                </div>
            )}

            {!loading && pagination.totalPages > 1 && (
                <div className="mb-4 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        disabled={!pagination.hasPrevPage}
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        className="px-3 py-1.5 rounded-md border border-gray-200 text-sm text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Prev
                    </button>
                    <span className="text-sm text-gray-500">
                        Page {pagination.page} / {pagination.totalPages}
                    </span>
                    <button
                        type="button"
                        disabled={!pagination.hasNextPage}
                        onClick={() => setCurrentPage((prev) => prev + 1)}
                        className="px-3 py-1.5 rounded-md border border-gray-200 text-sm text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Next
                    </button>
                </div>
            )}

            {/* Payments List/Table */}
            {loading ? (
                <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                    <div className="animate-spin rounded-full h-12 w-12 border-2 border-amber-500 border-t-transparent mx-auto mb-4"></div>
                    <p className="text-gray-400">Loading payments...</p>
                    <p className="text-gray-500 text-sm mt-1">Please wait</p>
                </div>
            ) : (
                <>
                {/* Mobile: expandable payment cards */}
                <div className="md:hidden space-y-3">
                    {payments.length === 0 ? (
                        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
                            <FaWallet className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                            <p className="text-gray-400 font-medium mb-1">No payments found</p>
                            <p className="text-gray-500 text-sm">
                                {hasActiveFilters
                                    ? 'Try clearing filters or change your filter criteria.'
                                    : 'Payments will appear here when players request deposits or withdrawals.'}
                            </p>
                        </div>
                    ) : (
                        payments.map((payment) => {
                            const isExpanded = expandedPaymentId === payment._id;
                            return (
                                <div key={payment._id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => setExpandedPaymentId(isExpanded ? null : payment._id)}
                                        className="w-full p-3 text-left"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <button
                                                    type="button"
                                                    onClick={() => selectPlayerFromPayment(payment)}
                                                    className="block w-full text-left font-semibold text-gray-800 truncate hover:text-orange-600 hover:underline decoration-orange-500/60 underline-offset-2"
                                                    title="Show all payments for this player"
                                                >
                                                    {payment.userId?.username || 'Unknown'}
                                                </button>
                                                <p className="text-xs text-gray-500 truncate">{formatDate(payment.createdAt)}</p>
                                                <div className="mt-1 flex items-center gap-2">
                                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium border ${getTypeBadge(payment.type)}`}>
                                                        {payment.type === 'deposit' ? 'Deposit' : 'Withdrawal'}
                                                    </span>
                                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium border ${getStatusBadge(payment.status)}`}>
                                                        {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className={`font-semibold ${payment.type === 'deposit' ? 'text-green-600' : 'text-purple-600'}`}>
                                                    {payment.type === 'deposit' ? '+' : '-'} ₹{payment.amount?.toLocaleString()}
                                                </p>
                                                <p className="text-xs text-gray-500">{isExpanded ? 'Hide' : 'View'} details</p>
                                            </div>
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div className="px-3 pb-3 pt-1 border-t border-gray-200 space-y-2 text-xs">
                                            <p className="text-gray-500">Ref: <span className="text-gray-800 font-mono">#{payment._id.slice(-6).toUpperCase()}</span></p>
                                            {payment.type === 'deposit' ? (
                                                <>
                                                    {payment.upiTransactionId && (
                                                        <p className="text-gray-500">UTR: <span className="text-gray-800 font-mono">{payment.upiTransactionId}</span></p>
                                                    )}
                                                    {payment.screenshotUrl && (
                                                        <button
                                                            onClick={() => {
                                                                const screenshotUrl = payment.screenshotUrl.startsWith('http')
                                                                    ? payment.screenshotUrl
                                                                    : `${API_BASE_URL}${payment.screenshotUrl}`;
                                                                setImageModal({ show: true, url: screenshotUrl });
                                                            }}
                                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-600/20 border border-blue-500/40 rounded text-xs text-blue-600"
                                                        >
                                                            <FaImage className="w-3.5 h-3.5" /> Screenshot
                                                        </button>
                                                    )}
                                                </>
                                            ) : (
                                                <p className="text-gray-500 truncate">
                                                    {payment.bankDetailId?.accountHolderName || 'No bank details'}
                                                </p>
                                            )}
                                            <div className="flex flex-wrap gap-2 pt-1">
                                                <button
                                                    onClick={() => setDetailModal({ show: true, payment })}
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600/20 border border-blue-500/40 rounded-lg text-xs font-medium text-blue-600"
                                                >
                                                    <FaEye className="w-3.5 h-3.5 shrink-0" /> View
                                                </button>
                                                {payment.status === 'pending' ? (
                                                    <>
                                                        <button
                                                            onClick={() => openActionModal(payment, 'approve')}
                                                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-green-600 rounded-lg text-xs font-medium text-white"
                                                        >
                                                            <FaCheck className="w-3.5 h-3.5 shrink-0" /> Approve
                                                        </button>
                                                        <button
                                                            onClick={() => openActionModal(payment, 'reject')}
                                                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-red-600 rounded-lg text-xs font-medium text-white"
                                                        >
                                                            <FaTimes className="w-3.5 h-3.5 shrink-0" /> Reject
                                                        </button>
                                                    </>
                                                ) : (
                                                    <span className="text-xs text-gray-500 italic self-center">Processed</span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Desktop: table */}
                <div className="hidden md:block">
                <div className="-mx-4 sm:mx-0 rounded-xl border border-gray-200 overflow-hidden">
                    <div className="bg-white min-w-0">
                        <table className="w-full text-sm table-fixed">
                            <thead className="bg-gray-50/80">
                                <tr>
                                    <th className="w-[78px] px-2.5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Ref ID</th>
                                    <th className="w-[150px] px-2.5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                                        <span className="block">Player</span>
                                        <span className="mt-0.5 block font-normal normal-case text-gray-500">Click for history</span>
                                    </th>
                                    <th className="w-[86px] px-2.5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Type</th>
                                    <th className="w-[96px] px-2.5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Amount</th>
                                    <th className="w-[170px] px-2.5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                                        Payment Info
                                    </th>
                                    <th className="w-[104px] px-2.5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                                    <th className="w-[132px] px-2.5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Date</th>
                                    <th className="w-[164px] px-2.5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                                        <span className="block">Actions</span>
                                        <span className="block font-normal normal-case text-gray-500 mt-0.5">View / Approve / Reject</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {payments.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="px-6 py-16 text-center">
                                            <div className="max-w-sm mx-auto">
                                                <FaWallet className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                                                <p className="text-gray-400 font-medium mb-1">No payments found</p>
                                                <p className="text-gray-500 text-sm">
                                                    {hasActiveFilters
                                                        ? 'Try clearing filters or change your filter criteria.'
                                                        : 'Payments will appear here when players request deposits or withdrawals.'}
                                                </p>
                                                {hasActiveFilters && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setFilters({ status: '', type: '' });
                                                            setPlayerFilter(null);
                                                            setDatePreset('all');
                                                            setCustomMode(false);
                                                            setCustomOpen(false);
                                                        }}
                                                        className="mt-4 px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg text-gray-800 text-sm font-medium"
                                                    >
                                                        Clear Filters
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    payments.map((payment) => (
                                        <tr key={payment._id} className="hover:bg-gray-50">
                                            <td className="px-2.5 py-3 text-xs text-gray-400 whitespace-nowrap">
                                                #{payment._id.slice(-6).toUpperCase()}
                                            </td>
                                            <td className="px-2.5 py-3">
                                                <button
                                                    type="button"
                                                    onClick={() => selectPlayerFromPayment(payment)}
                                                    className="w-full text-left rounded-md px-0 py-0.5 hover:bg-orange-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60"
                                                    title="Show all payments for this player"
                                                >
                                                <div className="truncate">
                                                    <p className="font-medium text-gray-800 truncate hover:text-orange-600">
                                                        {payment.userId?.username || 'Unknown'}
                                                    </p>
                                                    <p className="text-xs text-gray-500 truncate">
                                                        {payment.userId?.phone || '—'}
                                                    </p>
                                                </div>
                                                </button>
                                            </td>
                                            <td className="px-2.5 py-3 whitespace-nowrap">
                                                <span className={`inline-block px-1.5 py-0.5 rounded-full text-[11px] font-medium border ${getTypeBadge(payment.type)}`}>
                                                    {payment.type === 'deposit' ? '↓ Deposit' : '↑ Withdraw'}
                                                </span>
                                            </td>
                                            <td className="px-2.5 py-3 whitespace-nowrap">
                                                <span className={`font-semibold ${payment.type === 'deposit' ? 'text-green-600' : 'text-purple-600'}`}>
                                                    {payment.type === 'deposit' ? '+' : '-'} ₹{payment.amount?.toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="px-2.5 py-3">
                                                {payment.type === 'deposit' ? (
                                                    <div className="space-y-1.5">
                                                        {payment.upiTransactionId && (
                                                            <p className="text-xs text-gray-400 truncate">
                                                                UTR: <span className="text-gray-800 font-mono">{payment.upiTransactionId}</span>
                                                            </p>
                                                        )}
                                                        {payment.screenshotUrl && (
                                                            <button
                                                                onClick={() => {
                                                                    const screenshotUrl = payment.screenshotUrl.startsWith('http') 
                                                                        ? payment.screenshotUrl 
                                                                        : `${API_BASE_URL}${payment.screenshotUrl}`;
                                                                    setImageModal({ show: true, url: screenshotUrl });
                                                                }}
                                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-600/20 border border-blue-500/40 rounded text-xs text-blue-600 hover:bg-blue-600/30 transition-colors"
                                                                title="View screenshot"
                                                            >
                                                                <FaImage className="w-3.5 h-3.5" /> Screenshot
                                                            </button>
                                                        )}
                                                        {payment.userNote && (
                                                            <p className="text-xs text-gray-500 truncate" title={payment.userNote}>Note: {payment.userNote}</p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="space-y-0.5">
                                                        {payment.bankDetailId ? (
                                                            <>
                                                                <p className="text-xs text-gray-800 font-medium truncate">
                                                                    {payment.bankDetailId.accountHolderName}
                                                                </p>
                                                                {payment.bankDetailId.bankName && (
                                                                    <p className="text-xs text-gray-500 truncate">
                                                                        {payment.bankDetailId.bankName}
                                                                        {payment.bankDetailId.accountNumber && (
                                                                            <> - ****{payment.bankDetailId.accountNumber.slice(-4)}</>
                                                                        )}
                                                                    </p>
                                                                )}
                                                                {payment.bankDetailId.upiId && (
                                                                    <p className="text-xs text-gray-500 truncate">
                                                                        UPI: {payment.bankDetailId.upiId}
                                                                    </p>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <p className="text-xs text-gray-500">No bank details</p>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-2.5 py-3">
                                                <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${getStatusBadge(payment.status)}`}>
                                                    {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                                                </span>
                                                {payment.adminRemarks && payment.status !== 'pending' && (
                                                    <p className="text-xs text-gray-500 mt-1 truncate" title={payment.adminRemarks}>
                                                        {payment.adminRemarks}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-2.5 py-3 text-xs text-gray-400">
                                                <p className="block">{formatDate(payment.createdAt)}</p>
                                                {payment.processedAt && payment.status !== 'pending' && (
                                                    <p className="block text-gray-500 text-[10px] mt-0.5">
                                                        Done: {formatDate(payment.processedAt)}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-2.5 py-3">
                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        onClick={() => setDetailModal({ show: true, payment })}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600/20 border border-blue-500/40 hover:bg-blue-600/30 rounded-lg text-xs font-medium text-blue-600 transition-colors"
                                                        title="View full payment details"
                                                    >
                                                        <FaEye className="w-3.5 h-3.5 shrink-0" /> View Details
                                                    </button>
                                                    {payment.status === 'pending' ? (
                                                        <>
                                                            <button
                                                                onClick={() => openActionModal(payment, 'approve')}
                                                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-xs font-medium text-gray-800 transition-colors"
                                                                title="Approve – add money to player wallet"
                                                            >
                                                                <FaCheck className="w-3.5 h-3.5 shrink-0" /> Approve
                                                            </button>
                                                            <button
                                                                onClick={() => openActionModal(payment, 'reject')}
                                                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-xs font-medium text-gray-800 transition-colors"
                                                                title="Reject – decline this request"
                                                            >
                                                                <FaTimes className="w-3.5 h-3.5 shrink-0" /> Reject
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <span className="text-xs text-gray-500 italic">Processed</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                </div>
                </>
            )}

            {/* Action Modal */}
            {actionModal.show && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-[min(92vw,560px)] p-4 sm:p-5 border border-gray-200 shadow-2xl">
                        <div className="flex items-center gap-3 mb-3">
                            {actionModal.action === 'approve' ? (
                                <div className="w-10 h-10 rounded-full bg-green-600/20 flex items-center justify-center">
                                    <FaCheck className="w-5 h-5 text-green-600" />
                                </div>
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-red-600/20 flex items-center justify-center">
                                    <FaTimes className="w-5 h-5 text-red-500" />
                                </div>
                            )}
                            <div>
                                <h3 className="text-lg sm:text-xl font-bold text-gray-800">
                                    {actionModal.action === 'approve' ? 'Approve' : 'Reject'} {actionModal.payment?.type === 'deposit' ? 'Deposit' : 'Withdrawal'}
                                </h3>
                                <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
                                    {actionModal.action === 'approve' ? 'Credit will be added to player wallet' : 'Request will be declined'}
                                </p>
                            </div>
                        </div>
                        
                        <div className="bg-gray-50 rounded-lg p-3 mb-3">
                            <div className="flex justify-between items-center mb-1.5">
                                <span className="text-gray-400">Amount</span>
                                <span className="text-lg font-bold text-gray-800">
                                    ₹{actionModal.payment?.amount?.toLocaleString()}
                                </span>
                            </div>
                            <div className="flex justify-between items-center mb-1.5">
                                <span className="text-gray-400">Player</span>
                                <span className="text-gray-800">
                                    {actionModal.payment?.userId?.username || 'Unknown'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400">Type</span>
                                <span className={`px-2 py-1 rounded text-xs ${
                                    actionModal.payment?.type === 'deposit' 
                                        ? 'bg-green-600/30 text-green-600' 
                                        : 'bg-purple-600/30 text-purple-600'
                                }`}>
                                    {actionModal.payment?.type}
                                </span>
                            </div>
                        </div>

                        {/* Show screenshot for deposits */}
                        {actionModal.payment?.type === 'deposit' && actionModal.payment?.screenshotUrl && (
                            <div className="mb-3">
                                <p className="text-gray-600 text-xs sm:text-sm mb-1.5 font-medium">Payment Screenshot:</p>
                                <img
                                    src={actionModal.payment.screenshotUrl.startsWith('http') 
                                        ? actionModal.payment.screenshotUrl 
                                        : `${API_BASE_URL}${actionModal.payment.screenshotUrl}`}
                                    alt="Payment proof"
                                    className="w-full max-h-28 sm:max-h-32 object-contain rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => {
                                        const screenshotUrl = actionModal.payment.screenshotUrl.startsWith('http') 
                                            ? actionModal.payment.screenshotUrl 
                                            : `${API_BASE_URL}${actionModal.payment.screenshotUrl}`;
                                        setImageModal({ show: true, url: screenshotUrl });
                                    }}
                                    onError={(e) => {
                                        e.target.src = 'https://via.placeholder.com/600x400?text=Image+Not+Found';
                                    }}
                                />
                            </div>
                        )}

                        {/* Show bank details for withdrawals */}
                        {actionModal.payment?.type === 'withdrawal' && actionModal.payment?.bankDetailId && (
                            <div className="mb-3 bg-gray-50 rounded-lg p-3">
                                <p className="text-gray-400 text-xs sm:text-sm mb-1.5">Withdraw to:</p>
                                <p className="text-gray-800 font-medium">{actionModal.payment.bankDetailId.accountHolderName}</p>
                                {actionModal.payment.bankDetailId.bankName && (
                                    <p className="text-gray-400 text-sm">
                                        {actionModal.payment.bankDetailId.bankName} - {actionModal.payment.bankDetailId.accountNumber}
                                    </p>
                                )}
                                {actionModal.payment.bankDetailId.ifscCode && (
                                    <p className="text-gray-400 text-sm">IFSC: {actionModal.payment.bankDetailId.ifscCode}</p>
                                )}
                                {actionModal.payment.bankDetailId.upiId && (
                                    <p className="text-gray-400 text-sm">UPI: {actionModal.payment.bankDetailId.upiId}</p>
                                )}
                            </div>
                        )}

                        <div className="mb-3">
                            <label className="block text-gray-400 text-xs sm:text-sm mb-1.5">
                                Admin Remarks {actionModal.action === 'reject' && <span className="text-red-500">*</span>}
                            </label>
                            <textarea
                                value={adminRemarks}
                                onChange={(e) => setAdminRemarks(e.target.value)}
                                placeholder={actionModal.action === 'approve' ? 'Optional remarks...' : 'Reason for rejection...'}
                                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 resize-none focus:outline-none focus:border-blue-500"
                                rows={2}
                            />
                        </div>

                        {actionModal.action === 'approve' && hasSecretDeclarePassword && (
                            <div className="mb-3">
                                <label className="block text-gray-400 text-xs sm:text-sm mb-1.5">Secret declare password *</label>
                                <input
                                    type="password"
                                    placeholder="Secret declare password"
                                    value={secretPassword}
                                    onChange={(e) => { setSecretPassword(e.target.value); setActionPasswordError(''); }}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:border-blue-500"
                                />
                                {actionPasswordError && (
                                    <p className="text-red-500 text-sm mt-2">{actionPasswordError}</p>
                                )}
                            </div>
                        )}

                        <div className="flex gap-2.5">
                            <button
                                onClick={closeActionModal}
                                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-800 transition-colors text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAction}
                                disabled={
                                    processing ||
                                    (actionModal.action === 'reject' && !adminRemarks.trim()) ||
                                    (actionModal.action === 'approve' && hasSecretDeclarePassword && !secretPassword.trim())
                                }
                                className={`flex-1 px-4 py-2.5 rounded-lg text-white font-medium transition-colors disabled:opacity-50 text-sm ${
                                    actionModal.action === 'approve'
                                        ? 'bg-emerald-600 hover:bg-emerald-700'
                                        : 'bg-rose-600 hover:bg-rose-700'
                                }`}
                            >
                                {processing ? 'Processing...' : (actionModal.action === 'approve' ? 'Approve' : 'Reject')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Preview Modal */}
            {imageModal.show && (
                <div 
                    className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
                    onClick={closeImageModal}
                >
                    <div className="relative max-w-4xl max-h-[90vh]">
                        <button
                            onClick={closeImageModal}
                            className="absolute -top-10 right-0 text-gray-800 hover:text-gray-600"
                        >
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <img
                            src={imageModal.url}
                            alt="Payment proof"
                            className="max-w-full max-h-[85vh] object-contain rounded-lg"
                        />
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {detailModal.show && detailModal.payment && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl w-full max-w-[min(94vw,720px)] p-4 sm:p-6 border border-gray-200 max-h-[92vh] overflow-y-auto shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${detailModal.payment.type === 'deposit' ? 'bg-green-600/20' : 'bg-purple-600/20'}`}>
                                    {detailModal.payment.type === 'deposit' ? (
                                        <FaArrowDown className="w-5 h-5 text-green-600" />
                                    ) : (
                                        <FaArrowUp className="w-5 h-5 text-purple-600" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800">
                                        {detailModal.payment.type === 'deposit' ? 'Deposit' : 'Withdrawal'} Details
                                    </h3>
                                    <p className="text-sm text-gray-400">
                                        Full payment information
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={closeDetailModal}
                                className="text-gray-400 hover:text-gray-800"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Amount & Status */}
                        <div className="bg-gray-50 rounded-lg p-4 mb-4">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-gray-400">Amount</span>
                                <span className="text-2xl font-bold text-gray-800">
                                    ₹{detailModal.payment.amount?.toLocaleString()}
                                </span>
                            </div>
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-gray-400">Status</span>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(detailModal.payment.status)}`}>
                                    {detailModal.payment.status.charAt(0).toUpperCase() + detailModal.payment.status.slice(1)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-gray-400">Type</span>
                                <span className={`px-1.5 py-0.5 rounded text-[11px] ${
                                    detailModal.payment.type === 'deposit' 
                                        ? 'bg-green-600/30 text-green-600' 
                                        : 'bg-purple-600/30 text-purple-600'
                                }`}>
                                    {detailModal.payment.type === 'deposit' ? '↓ Deposit' : '↑ Withdrawal'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400">Request ID</span>
                                <span className="text-gray-800 font-mono text-sm">
                                    #{detailModal.payment._id.slice(-8).toUpperCase()}
                                </span>
                            </div>
                        </div>

                        {/* Player Info */}
                        <div className="bg-gray-50 rounded-lg p-4 mb-4">
                            <h4 className="text-sm font-semibold text-gray-600 mb-3">Player Information</h4>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Username</span>
                                    <span className="text-gray-800">{detailModal.payment.userId?.username || 'Unknown'}</span>
                                </div>
                                {detailModal.payment.userId?.email && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Email</span>
                                        <span className="text-gray-800">{detailModal.payment.userId.email}</span>
                                    </div>
                                )}
                                {detailModal.payment.userId?.phone && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Phone</span>
                                        <span className="text-gray-800">{detailModal.payment.userId.phone}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Bank Details for Withdrawals */}
                        {detailModal.payment.type === 'withdrawal' && detailModal.payment.bankDetailId && (
                            <div className="bg-gray-50 rounded-lg p-4 mb-4">
                                <h4 className="text-sm font-semibold text-gray-600 mb-3">Bank Account Details</h4>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Account Holder</span>
                                        <span className="text-gray-800 font-medium">{detailModal.payment.bankDetailId.accountHolderName}</span>
                                    </div>
                                    {detailModal.payment.bankDetailId.bankName && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Bank Name</span>
                                            <span className="text-gray-800">{detailModal.payment.bankDetailId.bankName}</span>
                                        </div>
                                    )}
                                    {detailModal.payment.bankDetailId.accountNumber && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Account Number</span>
                                            <span className="text-gray-800 font-mono">{detailModal.payment.bankDetailId.accountNumber}</span>
                                        </div>
                                    )}
                                    {detailModal.payment.bankDetailId.ifscCode && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">IFSC Code</span>
                                            <span className="text-gray-800 font-mono">{detailModal.payment.bankDetailId.ifscCode}</span>
                                        </div>
                                    )}
                                    {detailModal.payment.bankDetailId.upiId && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">UPI ID</span>
                                            <span className="text-gray-800 font-mono">{detailModal.payment.bankDetailId.upiId}</span>
                                        </div>
                                    )}
                                    {detailModal.payment.bankDetailId.accountType && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Account Type</span>
                                            <span className="text-gray-800 capitalize">{detailModal.payment.bankDetailId.accountType.replace('_', ' ')}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Deposit Details */}
                        {detailModal.payment.type === 'deposit' && (
                            <div className="bg-gray-50 rounded-lg p-4 mb-4">
                                <h4 className="text-sm font-semibold text-gray-600 mb-3">Payment Details</h4>
                                <div className="space-y-2">
                                    {detailModal.payment.upiTransactionId && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">UTR / Transaction ID</span>
                                            <span className="text-gray-800 font-mono">{detailModal.payment.upiTransactionId}</span>
                                        </div>
                                    )}
                                    {detailModal.payment.userNote && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">User Note</span>
                                            <span className="text-gray-800">{detailModal.payment.userNote}</span>
                                        </div>
                                    )}
                                </div>
                                {detailModal.payment.screenshotUrl && (
                                    <div className="mt-4">
                                        <p className="text-gray-600 text-sm mb-2 font-medium">Payment Screenshot:</p>
                                        <img
                                            src={detailModal.payment.screenshotUrl.startsWith('http') 
                                                ? detailModal.payment.screenshotUrl 
                                                : `${API_BASE_URL}${detailModal.payment.screenshotUrl}`}
                                            alt="Payment proof"
                                            className="w-full max-h-60 object-contain rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                                            onClick={() => {
                                                const screenshotUrl = detailModal.payment.screenshotUrl.startsWith('http') 
                                                    ? detailModal.payment.screenshotUrl 
                                                    : `${API_BASE_URL}${detailModal.payment.screenshotUrl}`;
                                                setImageModal({ show: true, url: screenshotUrl });
                                            }}
                                            onError={(e) => {
                                                e.target.src = 'https://via.placeholder.com/600x400?text=Image+Not+Found';
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Timestamps */}
                        <div className="bg-gray-50 rounded-lg p-4 mb-4">
                            <h4 className="text-sm font-semibold text-gray-600 mb-3">Timeline</h4>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Requested</span>
                                    <span className="text-gray-800">{formatDate(detailModal.payment.createdAt)}</span>
                                </div>
                                {detailModal.payment.processedAt && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Processed</span>
                                        <span className="text-gray-800">{formatDate(detailModal.payment.processedAt)}</span>
                                    </div>
                                )}
                                {detailModal.payment.processedBy?.username && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Processed By</span>
                                        <span className="text-gray-800">{detailModal.payment.processedBy.username}</span>
                                    </div>
                                )}
                                {detailModal.payment.adminRemarks && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Admin Remarks</span>
                                        <span className="text-gray-800">{detailModal.payment.adminRemarks}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={closeDetailModal}
                                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-800 transition-colors"
                            >
                                Close
                            </button>
                            {detailModal.payment.status === 'pending' && (
                                <>
                                    <button
                                        onClick={() => {
                                            const p = detailModal.payment;
                                            setDetailModal({ show: false, payment: null });
                                            openActionModal(p, 'approve');
                                        }}
                                        className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-gray-800 font-medium transition-colors"
                                    >
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => {
                                            const p = detailModal.payment;
                                            setDetailModal({ show: false, payment: null });
                                            openActionModal(p, 'reject');
                                        }}
                                        className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-gray-800 font-medium transition-colors"
                                    >
                                        Reject
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default PaymentManagement;
