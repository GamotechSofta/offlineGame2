import React, { useState, useEffect, useRef } from 'react';
import AdminLayout from '../components/AdminLayout';
import { useNavigate, Link } from 'react-router-dom';
import { SkeletonCard } from '../components/Skeleton';
import {
    FaChartLine,
    FaUsers,
    FaMoneyBillWave,
    FaChartBar,
    FaSyncAlt,
    FaWallet,
    FaCreditCard,
    FaUserFriends,
    FaLifeRing,
    FaClipboardList,
    FaArrowRight,
    FaExclamationTriangle,
    FaDice,
} from 'react-icons/fa';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';
import { getAuthHeaders, clearAdminSession, fetchWithAuth } from '../lib/auth';

const LOTTERY_LIVE_REFRESH_MS = 2000;
/** Main dashboard KPIs (bets, wallet, payments) — keep in sync with live activity without full page reload */
const DASHBOARD_SECTION_REFRESH_MS = 2000;

const PRESETS = [
    { id: 'all', label: 'All', getRange: () => ({ from: '', to: '' }) },
    { id: 'today', label: 'Today', getRange: () => {
        const d = new Date();
        const y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
        const from = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return { from, to: from };
    }},
    { id: 'yesterday', label: 'Yesterday', getRange: () => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
        const from = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return { from, to: from };
    }},
    { id: 'this_week', label: 'This Week', getRange: () => {
        const d = new Date();
        const day = d.getDay();
        const sun = new Date(d);
        sun.setDate(d.getDate() - day);
        const sat = new Date(sun);
        sat.setDate(sun.getDate() + 6);
        const fmt = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
        return { from: fmt(sun), to: fmt(sat) };
    }},
    { id: 'last_week', label: 'Last Week', getRange: () => {
        const d = new Date();
        const day = d.getDay();
        const sun = new Date(d);
        sun.setDate(d.getDate() - day - 7);
        const sat = new Date(sun);
        sat.setDate(sun.getDate() + 6);
        const fmt = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
        return { from: fmt(sun), to: fmt(sat) };
    }},
    { id: 'this_month', label: 'This Month', getRange: () => {
        const d = new Date();
        const y = d.getFullYear(), m = d.getMonth();
        const last = new Date(y, m + 1, 0);
        const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
        const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
        return { from, to };
    }},
    { id: 'last_month', label: 'Last Month', getRange: () => {
        const d = new Date();
        const y = d.getFullYear(), m = d.getMonth() - 1;
        const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
        const last = new Date(y, m + 1, 0);
        const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
        return { from, to };
    }},
];

const formatRangeLabel = (from, to) => {
    if (!from || !to) return 'Today';
    if (from === to) {
        const d = new Date(from + 'T12:00:00');
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    const a = new Date(from + 'T12:00:00');
    const b = new Date(to + 'T12:00:00');
    return `${a.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${b.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
};

/** Section card wrapper */
const SectionCard = ({ title, description, icon: Icon, children, linkTo, linkLabel }) => (
    <div className="bg-white rounded-xl p-5 sm:p-6 border border-gray-200 hover:border-gray-200/80 transition-all">
        <div className="flex items-start justify-between mb-4">
            <div>
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    {Icon && <Icon className="w-5 h-5 text-orange-500" />}
                    {title}
                </h3>
                {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
            </div>
            {linkTo && (
                <Link to={linkTo} className="text-xs font-medium text-orange-500 hover:text-orange-600 flex items-center gap-1">
                    {linkLabel || 'View'} <FaArrowRight className="w-3 h-3" />
                </Link>
            )}
        </div>
        {children}
    </div>
);

/** Stat row */
const StatRow = ({ label, value, subValue, colorClass = 'text-gray-800' }) => (
    <div className="flex justify-between items-center py-2.5 border-b border-gray-200 last:border-0">
        <span className="text-sm text-gray-500">{label}</span>
        <div className="text-right">
            <span className={`font-semibold font-mono ${colorClass}`}>{value}</span>
            {subValue && <span className="text-xs text-gray-500 ml-2">{subValue}</span>}
        </div>
    </div>
);

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [datePreset, setDatePreset] = useState('today');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [customMode, setCustomMode] = useState(false);
    const [customOpen, setCustomOpen] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [rangeUpdating, setRangeUpdating] = useState(false);
    const [adminRole, setAdminRole] = useState('');
    const [marketOptions, setMarketOptions] = useState([]);
    const [selectedMarketId, setSelectedMarketId] = useState('');
    const [lotteryStats, setLotteryStats] = useState({
        twoD: { current: null, latest: null, error: '' },
        threeD: { current: null, latest: null, error: '' },
    });
    const dashboardPollBusyRef = useRef(false);
    const lotteryPollBusyRef = useRef(false);

    const hasChanged = (a, b) => JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
    const mergeSectionStats = (prev, next) => {
        if (!next || typeof next !== 'object') return prev;
        if (!prev || typeof prev !== 'object') return next;
        const merged = { ...prev };
        let changed = false;
        Object.keys(next).forEach((key) => {
            const nextValue = next[key];
            if (hasChanged(prev[key], nextValue)) {
                merged[key] = nextValue;
                changed = true;
            }
        });
        return changed ? merged : prev;
    };

    const getFromTo = () => {
        if (customMode && customFrom && customTo) return { from: customFrom, to: customTo };
        const preset = PRESETS.find((p) => p.id === datePreset);
        return preset ? preset.getRange() : PRESETS[0].getRange();
    };

    useEffect(() => {
        const admin = localStorage.getItem('admin');
        if (!admin) {
            navigate('/');
            return;
        }
        try {
            const parsed = JSON.parse(admin);
            setAdminRole(parsed.role || '');
        } catch (_) {}
        fetchDashboardStats();
        fetchMarketOptions();
        fetchLotteryDashboardStats();
    }, [navigate]);

    const getTodayDateKey = () => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const listDateKeysInRange = (from, to) => {
        if (!from || !to) {
            return [getTodayDateKey()];
        }
        const start = new Date(`${from}T00:00:00`);
        const end = new Date(`${to}T00:00:00`);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
            return [getTodayDateKey()];
        }
        const out = [];
        const cursor = new Date(start);
        // Keep calls bounded for performance; enough for dashboard overviews.
        const MAX_DAYS = 31;
        while (cursor <= end && out.length < MAX_DAYS) {
            out.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`);
            cursor.setDate(cursor.getDate() + 1);
        }
        return out;
    };
    const dateKeyFromMs = (ms) => {
        if (!Number.isFinite(ms) || ms <= 0) return '';
        const d = new Date(ms);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const fetchLotteryModeStats = async (mode, rangeOverride) => {
        const modeKey = mode === '2d' ? 'twoD' : 'threeD';
        const nonce = Date.now();
        const currentEndpoint = `${API_BASE_URL}/admin/lottery${mode}/current-slot?_=${nonce}`;
        const effectiveRange = rangeOverride || getFromTo();
        const currentRes = await fetchWithAuth(currentEndpoint, { cache: 'no-store' });
        if (currentRes.status === 401) {
            return null;
        }

        const currentJson = await currentRes.json();
        if (!currentJson?.success) {
            throw new Error(currentJson?.message || `Failed to load ${mode.toUpperCase()} current slot`);
        }
        const currentSlotIso = currentJson?.data?.slot?.slotStartIso || '';
        const currentSlotMs = currentSlotIso ? new Date(currentSlotIso).getTime() : 0;
        const previousSlotMs = Number.isFinite(currentSlotMs) && currentSlotMs > 0
            ? (currentSlotMs - (15 * 60 * 1000))
            : 0;
        const rangeDateKeys = listDateKeysInRange(effectiveRange?.from, effectiveRange?.to);
        const mustHaveDateKeys = [
            dateKeyFromMs(currentSlotMs),
            dateKeyFromMs(previousSlotMs),
        ].filter(Boolean);
        const dateKeys = [...new Set([...rangeDateKeys, ...mustHaveDateKeys])];
        const historyResList = await Promise.all(
            dateKeys.map((dateKey) =>
                fetchWithAuth(`${API_BASE_URL}/admin/lottery${mode}/slots?date=${encodeURIComponent(dateKey)}&limit=96&_=${nonce}`, { cache: 'no-store' }),
            ),
        );
        if (historyResList.some((r) => r.status === 401)) {
            return null;
        }
        const historyJsonList = await Promise.all(historyResList.map((res) => res.json()));
        if (historyJsonList.some((json) => !json?.success)) {
            const bad = historyJsonList.find((json) => !json?.success);
            throw new Error(bad?.message || `Failed to load ${mode.toUpperCase()} all slots`);
        }
        const historySlots = historyJsonList.flatMap((json) => (Array.isArray(json?.data?.slots) ? json.data.slots : []));
        const normalizedSlots = historySlots
            .map((slot) => {
                const slotStartMs = new Date(slot?.slotStartIso || 0).getTime();
                return {
                    ...slot,
                    slotStartMs: Number.isFinite(slotStartMs) ? slotStartMs : 0,
                };
            })
            .filter((slot) => slot.slotStartMs > 0);

        // Exclude future/upcoming slots so dashboard current/latest remain intuitive.
        const uptoCurrentSlots = normalizedSlots.filter((slot) => (currentSlotMs ? slot.slotStartMs <= currentSlotMs : true));
        const completedSlots = uptoCurrentSlots.filter((slot) => Boolean(slot?.isCompleted));
        const latestSlot = previousSlotMs
            ? (completedSlots.find((slot) => slot.slotStartMs === previousSlotMs)
                || [...completedSlots].sort((a, b) => b.slotStartMs - a.slotStartMs)[0]
                || null)
            : ([...completedSlots].sort((a, b) => b.slotStartMs - a.slotStartMs)[0] || null);
        const nextUpcomingSlot = currentSlotMs
            ? [...normalizedSlots]
                .filter((slot) => slot.slotStartMs > currentSlotMs)
                .sort((a, b) => a.slotStartMs - b.slotStartMs)[0] || null
            : null;
        const currentSummary = currentJson?.data?.summary || {};
        const historyTotals = completedSlots.reduce((acc, slot) => {
            acc.tickets += Number(slot?.totalTickets || 0);
            acc.bets += Number(slot?.totalBets ?? slot?.totalTickets ?? 0);
            acc.revenue += Number(slot?.revenue || 0);
            acc.payout += Number(slot?.winnerPayout || 0);
            acc.net += Number(slot?.amountRemaining || 0);
            acc.users += Number(slot?.totalUsers || 0);
            return acc;
        }, { tickets: 0, bets: 0, revenue: 0, payout: 0, net: 0, users: 0 });

        const currentBets = Number(currentSummary?.totalBets ?? currentSummary?.totalTickets ?? 0);
        const allSlots = {
            tickets: historyTotals.tickets + Number(currentSummary?.totalTickets || 0),
            bets: historyTotals.bets + currentBets,
            revenue: historyTotals.revenue + Number(currentSummary?.revenue || 0),
            payout: historyTotals.payout + Number(currentSummary?.winnerPayout || 0),
            net: historyTotals.net + Number(currentSummary?.amountRemaining || 0),
            users: historyTotals.users + Number(currentSummary?.totalUsers || 0),
        };

        return {
            modeKey,
            current: currentJson?.data || null,
            latest: latestSlot,
            nextUpcoming: nextUpcomingSlot,
            allSlots,
            error: '',
        };
    };

    const fetchLotteryDashboardStats = async (rangeOverride) => {
        try {
            const [twoD, threeD] = await Promise.all([
                fetchLotteryModeStats('2d', rangeOverride),
                fetchLotteryModeStats('3d', rangeOverride),
            ]);

            setLotteryStats({
                twoD: twoD || { current: null, latest: null, nextUpcoming: null, allSlots: null, error: '' },
                threeD: threeD || { current: null, latest: null, nextUpcoming: null, allSlots: null, error: '' },
            });
        } catch (err) {
            const message = err?.message || 'Failed to load lottery stats';
            setLotteryStats((prev) => ({
                twoD: prev.twoD.current || prev.twoD.latest ? prev.twoD : { ...prev.twoD, error: message },
                threeD: prev.threeD.current || prev.threeD.latest ? prev.threeD : { ...prev.threeD, error: message },
            }));
        }
    };

    const fetchMarketOptions = async () => {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/markets/list-for-dashboard`);
            if (response.status === 401) return;
            const data = await response.json();
            if (data?.success && Array.isArray(data?.data)) {
                const options = data.data
                    .map((m) => ({
                        id: m?._id != null ? String(m._id) : '',
                        name: (m?.displayLabel || m?.marketName || m?.gameName || '').toString().trim(),
                    }))
                    .filter((m) => m.id && m.name)
                    .sort((a, b) => a.name.localeCompare(b.name));
                setMarketOptions(options);
            }
        } catch (_) {
            // keep empty on error
        }
    };

    const fetchDashboardStats = async (rangeOverride, options = {}) => {
        const isRefresh = options.refresh === true;
        const isSilent = options.silent === true;
        try {
            if (!isSilent) {
                if (isRefresh) setRefreshing(true);
                else setLoading(true);
                setError('');
            }
            const { from, to } = rangeOverride || getFromTo();
            const params = new URLSearchParams();
            if (from && to) { params.set('from', from); params.set('to', to); }
            const marketId = options.marketIdOverride !== undefined ? options.marketIdOverride : selectedMarketId;
            if (marketId) params.set('marketId', marketId);
            if (isRefresh) params.set('_', String(Date.now()));
            const query = params.toString();
            const url = `${API_BASE_URL}/dashboard/stats${query ? `?${query}` : ''}`;
            const response = await fetchWithAuth(url, {
                cache: isRefresh ? 'no-store' : 'default',
            });
            if (response.status === 401) return;
            const data = await response.json();
            if (data.success) {
                setStats((prev) => mergeSectionStats(prev, data.data));
            } else {
                if (!isSilent) setError('Failed to fetch dashboard stats');
            }
        } catch (err) {
            if (!isSilent) setError('Network error. Please check if the server is running.');
        } finally {
            if (!isSilent) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    };

    const handleRefresh = () => fetchDashboardStats(undefined, { refresh: true });
    const handleRefreshAll = () => {
        const range = customMode && customFrom && customTo
            ? { from: customFrom, to: customTo }
            : getFromTo();
        fetchDashboardStats(undefined, { refresh: true });
        fetchLotteryDashboardStats(range);
    };
    const applyRangeUpdate = async (range, marketIdOverride) => {
        setRangeUpdating(true);
        try {
            await Promise.all([
                fetchDashboardStats(range, { silent: true, marketIdOverride }),
                fetchLotteryDashboardStats(range),
            ]);
        } finally {
            setRangeUpdating(false);
        }
    };
    const handlePresetSelect = (presetId) => {
        setDatePreset(presetId);
        setCustomMode(false);
        setCustomOpen(false);
        const preset = PRESETS.find((p) => p.id === presetId);
        const range = preset ? preset.getRange() : PRESETS[0].getRange();
        applyRangeUpdate(range);
    };
    const handleCustomToggle = () => { setCustomMode(true); setCustomOpen((o) => !o); };
    const handleCustomApply = () => {
        if (!customFrom || !customTo) return;
        if (new Date(customFrom) > new Date(customTo)) return;
        setCustomMode(true);
        setCustomOpen(false);
        const range = { from: customFrom, to: customTo };
        applyRangeUpdate(range);
    };

    const handleLogout = () => {
        clearAdminSession();
        navigate('/');
    };

    useEffect(() => {
        if (loading) return undefined;
        const getEffectiveRange = () => (
            customMode && customFrom && customTo
                ? { from: customFrom, to: customTo }
                : getFromTo()
        );

        const refreshDashboardSections = () => {
            if (document.visibilityState !== 'visible') return;
            if (rangeUpdating || dashboardPollBusyRef.current) return;
            dashboardPollBusyRef.current = true;
            fetchDashboardStats(getEffectiveRange(), { refresh: true, silent: true }).finally(() => {
                dashboardPollBusyRef.current = false;
            });
        };

        const refreshLotterySections = () => {
            if (document.visibilityState !== 'visible') return;
            if (rangeUpdating || lotteryPollBusyRef.current) return;
            lotteryPollBusyRef.current = true;
            Promise.resolve(fetchLotteryDashboardStats(getEffectiveRange())).finally(() => {
                lotteryPollBusyRef.current = false;
            });
        };

        const dashboardTimer = setInterval(refreshDashboardSections, DASHBOARD_SECTION_REFRESH_MS);
        const lotteryTimer = setInterval(refreshLotterySections, LOTTERY_LIVE_REFRESH_MS);

        const onVisible = () => {
            if (document.visibilityState === 'visible') {
                refreshDashboardSections();
                refreshLotterySections();
            }
        };

        window.addEventListener('focus', onVisible);
        document.addEventListener('visibilitychange', onVisible);

        return () => {
            clearInterval(dashboardTimer);
            clearInterval(lotteryTimer);
            window.removeEventListener('focus', onVisible);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [customFrom, customMode, customTo, datePreset, loading, selectedMarketId, rangeUpdating]);

    const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
    const formatNumber = (value) => Number(value || 0).toLocaleString('en-IN');
    const formatDrawTime = (label) => {
        if (!label) return '-';
        return label;
    };
    const formatSlotWindow = (slot) => {
        const slotStartIso = String(slot?.slotStartIso || '').trim();
        if (!slotStartIso) return formatDrawTime(slot?.drawLabelEnd);
        const startDate = new Date(slotStartIso);
        if (Number.isNaN(startDate.getTime())) return formatDrawTime(slot?.drawLabelEnd);
        const start = new Intl.DateTimeFormat('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        }).format(startDate).replace(/\s?(am|pm)$/i, (m) => ` ${m.trim().toUpperCase()}`);
        const endFallback = new Date(startDate.getTime() + (15 * 60 * 1000));
        const end = String(slot?.drawLabelEnd || '').trim() || new Intl.DateTimeFormat('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        }).format(endFallback).replace(/\s?(am|pm)$/i, (m) => ` ${m.trim().toUpperCase()}`);
        return `${start} - ${end}`;
    };

    const twoDCurrent = lotteryStats?.twoD?.current?.summary || {};
    const threeDCurrent = lotteryStats?.threeD?.current?.summary || {};
    const twoDAllSlots = lotteryStats?.twoD?.allSlots || {};
    const threeDAllSlots = lotteryStats?.threeD?.allSlots || {};
    const gameWiseRevenue = stats?.gameWiseRevenue || {};
    const twoDCurrentRevenue = Number(twoDCurrent.revenue || 0);
    const threeDCurrentRevenue = Number(threeDCurrent.revenue || 0);
    const twoDCurrentNet = Number(twoDCurrent.amountRemaining || 0);
    const threeDCurrentNet = Number(threeDCurrent.amountRemaining || 0);
    const twoDCurrentUsers = Number(twoDCurrent.totalUsers || 0);
    const threeDCurrentUsers = Number(threeDCurrent.totalUsers || 0);
    const twoDCurrentBets = Number(twoDCurrent.totalTickets || 0);
    const threeDCurrentBets = Number(threeDCurrent.totalTickets || 0);
    const lotteryCurrentTotalTickets = Number(twoDCurrent.totalTickets || 0) + Number(threeDCurrent.totalTickets || 0);
    const lotteryCurrentTotalRevenue = Number(twoDCurrent.revenue || 0) + Number(threeDCurrent.revenue || 0);
    const lotteryCurrentTotalNet = Number(twoDCurrent.amountRemaining || 0) + Number(threeDCurrent.amountRemaining || 0);
    const twoDAllSlotsPayout = Number(twoDAllSlots.payout || 0);
    const threeDAllSlotsPayout = Number(threeDAllSlots.payout || 0);
    const lotteryAllSlotsTotalTickets = Number(twoDAllSlots.tickets || 0) + Number(threeDAllSlots.tickets || 0);
    const lotteryAllSlotsTotalRevenue = Number(twoDAllSlots.revenue || 0) + Number(threeDAllSlots.revenue || 0);
    const lotteryAllSlotsTotalPayout = twoDAllSlotsPayout + threeDAllSlotsPayout;
    const lotteryAllSlotsTotalNet = Number(twoDAllSlots.net || 0) + Number(threeDAllSlots.net || 0);
    const lotteryAllSlotsTotalUsers = Number(twoDAllSlots.users || 0) + Number(threeDAllSlots.users || 0);
    const gameRevenueTotal = Number(gameWiseRevenue?.total?.revenue || 0);
    const mainRevenueWithLottery = Number(stats?.revenue?.total || 0) + lotteryAllSlotsTotalRevenue + gameRevenueTotal;
    const mainNetWithLottery = Number(stats?.revenue?.netProfit || 0) + lotteryAllSlotsTotalNet;
    const mainBetsWithLottery = Number(stats?.bets?.total || 0) + lotteryAllSlotsTotalTickets;

    const pendingPayments = stats?.payments?.pending || 0;
    const pendingDeposits = stats?.payments?.pendingDeposits ?? stats?.payments?.pending ?? 0;
    const pendingWithdrawals = stats?.payments?.pendingWithdrawals ?? 0;
    const helpDeskOpen = stats?.helpDesk?.open || 0;
    const isSuperAdmin = adminRole === 'super_admin';
    const marketsPendingResultList = stats?.marketsPendingResultList || [];
    const starlinePendingList = marketsPendingResultList.filter((m) => (m.marketType || '').toString().toLowerCase() === 'startline');
    const mainPendingList = marketsPendingResultList.filter((m) => (m.marketType || '').toString().toLowerCase() !== 'startline');
    const starlinePendingCount = starlinePendingList.length;
    const mainPendingCount = mainPendingList.length;
    const marketsPendingResult = marketsPendingResultList.length;
    // Help Desk open tickets should not trigger the "Action Required" banner.
    const hasActionRequired = pendingPayments > 0 || marketsPendingResult > 0;

    if (loading) {
        return (
            <AdminLayout onLogout={handleLogout} title="Dashboard">
                <div className="mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Dashboard Overview</h1>
                    <p className="text-gray-400 text-sm mt-2">Loading your admin overview...</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
                </div>
            </AdminLayout>
        );
    }

    if (error) {
        return (
            <AdminLayout onLogout={handleLogout} title="Dashboard">
                <div className="flex flex-col items-center justify-center min-h-[50vh]">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                        <FaExclamationTriangle className="w-8 h-8 text-red-500" />
                    </div>
                    <p className="text-red-500 text-lg font-medium mb-2">{error}</p>
                    <button onClick={fetchDashboardStats} className="mt-4 px-6 py-2 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-xl">
                        Retry
                    </button>
                </div>
            </AdminLayout>
        );
    }

    const displayLabel = customMode && customFrom && customTo ? formatRangeLabel(customFrom, customTo) : (PRESETS.find((p) => p.id === datePreset)?.label || 'Today');
    const selectedMarketName = marketOptions.find((m) => m.id === selectedMarketId)?.name || 'All Markets';

    return (
        <AdminLayout onLogout={handleLogout} title="Dashboard">
            {/* Header */}
            <div className="mb-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                                <FaChartLine className="w-5 h-5 text-orange-500" />
                            </span>
                            Dashboard Overview
                        </h1>
                    </div>
                </div>

                {/* Date Filter */}
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Date Range</p>
                        <button
                            type="button"
                            onClick={handleRefreshAll}
                            disabled={refreshing}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-orange-500/20 border border-gray-200 hover:border-orange-300 text-gray-600 hover:text-orange-500 transition-all disabled:opacity-60 text-xs font-medium"
                        >
                            <FaSyncAlt className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {PRESETS.map((p) => {
                            const isActive = !customMode && datePreset === p.id;
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => handlePresetSelect(p.id)}
                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${isActive ? 'bg-orange-500 text-white' : 'bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200'}`}
                                >
                                    {p.label}
                                </button>
                            );
                        })}
                        <button
                            type="button"
                            onClick={handleCustomToggle}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold ${customMode ? 'bg-orange-500 text-white' : 'bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200'}`}
                        >
                            Custom
                        </button>
                        {customOpen && (
                            <div className="flex flex-wrap items-end gap-3 w-full mt-3 p-3 rounded-lg bg-white border border-gray-200">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">From</label>
                                    <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="px-3 py-2 rounded-lg bg-gray-100 border border-gray-200 text-sm text-gray-800" />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">To</label>
                                    <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="px-3 py-2 rounded-lg bg-gray-100 border border-gray-200 text-sm text-gray-800" />
                                </div>
                                <button type="button" onClick={handleCustomApply} className="px-4 py-2 rounded-lg bg-orange-500 text-white font-semibold text-sm">
                                    Apply
                                </button>
                            </div>
                        )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Showing data for: <span className="text-orange-500 font-medium">{displayLabel}</span></p>
                    {rangeUpdating && (
                        <p className="text-xs text-blue-600 mt-2 font-medium">Updating selected range data...</p>
                    )}
                    <div className="mt-3">
                        <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider">Market</p>
                        <select
                            value={selectedMarketId}
                            onChange={(e) => {
                                const nextMarketId = e.target.value;
                                setSelectedMarketId(nextMarketId);
                                const range = customMode && customFrom && customTo
                                    ? { from: customFrom, to: customTo }
                                    : getFromTo();
                                applyRangeUpdate(range, nextMarketId);
                            }}
                            className="w-full sm:w-auto min-w-[260px] px-3 py-2 rounded-lg bg-gray-100 border border-gray-200 text-sm text-gray-800"
                        >
                            <option value="">All Markets</option>
                            {marketOptions.map((m) => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-2">Selected market: <span className="text-orange-500 font-medium">{selectedMarketName}</span></p>
                    </div>
                </div>
            </div>

            {/* Action Required */}
            {hasActionRequired && (
                <div className="mb-6 p-4 rounded-xl bg-orange-500/10 border border-orange-200">
                    <h3 className="text-sm font-semibold text-orange-500 flex items-center gap-2 mb-3">
                        <FaExclamationTriangle className="w-4 h-4" />
                        Action Required
                    </h3>
                    <div className="flex flex-wrap gap-3">
                        {pendingPayments > 0 && (
                            <Link to="/payment-management" className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-medium text-sm">
                                {pendingPayments} Pending Payment{pendingPayments !== 1 ? 's' : ''} →
                            </Link>
                        )}
                        {/* Help Desk tickets are shown only inside the Help Desk section-card (super admin). */}
                        {starlinePendingCount > 0 && (
                            <Link to="/markets" state={{ marketType: 'starline' }} className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-medium text-sm">
                                {starlinePendingCount} Starline slot{starlinePendingCount !== 1 ? 's' : ''} result pending →
                            </Link>
                        )}
                        {mainPendingCount > 0 && (
                            <Link to="/add-result" className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-medium text-sm">
                                {mainPendingCount} Market{mainPendingCount !== 1 ? 's' : ''} result pending →
                            </Link>
                        )}
                    </div>
                    {(starlinePendingList.length > 0 || mainPendingList.length > 0) && (
                        <p className="text-xs text-orange-700 mt-2">
                            {starlinePendingList.length > 0 && (
                                <span>Starline: {starlinePendingList.map((m) => m.marketName).join(', ')}</span>
                            )}
                            {starlinePendingList.length > 0 && mainPendingList.length > 0 && ' · '}
                            {mainPendingList.length > 0 && (
                                <span>Markets: {mainPendingList.map((m) => m.marketName).join(', ')}</span>
                            )}
                        </p>
                    )}
                </div>
            )}

            {/* Primary KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-green-50 to-transparent rounded-xl p-5 border border-green-200">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Revenue (period)</p>
                    <p className="text-2xl font-bold text-green-600 font-mono">{formatCurrency(mainRevenueWithLottery)}</p>
                    <p className="text-xs text-gray-500 mt-1">Bet amount collected in selected range</p>
                    <p className="text-xs text-gray-500 mt-1">
                        2D: <span className="font-medium">{formatCurrency(twoDCurrentRevenue)}</span> · 3D: <span className="font-medium">{formatCurrency(threeDCurrentRevenue)}</span> · Total: <span className="font-medium text-green-600">{formatCurrency(lotteryCurrentTotalRevenue)}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                        All slots total - 2D: <span className="font-medium">{formatCurrency(twoDAllSlots.revenue)}</span> · 3D: <span className="font-medium">{formatCurrency(threeDAllSlots.revenue)}</span> · Total: <span className="font-medium text-green-600">{formatCurrency(lotteryAllSlotsTotalRevenue)}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                        Games total - Aviator/FunTimer/Roulette: <span className="font-medium text-green-600">{formatCurrency(gameRevenueTotal)}</span>
                    </p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-transparent rounded-xl p-5 border border-blue-200">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Net Profit (period)</p>
                    <p className="text-2xl font-bold text-blue-600 font-mono">{formatCurrency(mainNetWithLottery)}</p>
                    <p className="text-xs text-gray-500 mt-1">Revenue − Payouts in selected range</p>
                    <p className="text-xs text-gray-500 mt-1">
                        2D net: <span className="font-medium">{formatCurrency(twoDCurrentNet)}</span> · 3D net: <span className="font-medium">{formatCurrency(threeDCurrentNet)}</span> · Total net: <span className="font-medium text-blue-600">{formatCurrency(lotteryCurrentTotalNet)}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                        All slots net - 2D: <span className="font-medium">{formatCurrency(twoDAllSlots.net)}</span> · 3D: <span className="font-medium">{formatCurrency(threeDAllSlots.net)}</span> · Total: <span className="font-medium text-blue-600">{formatCurrency(lotteryAllSlotsTotalNet)}</span>
                    </p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-transparent rounded-xl p-5 border border-purple-200">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Players (all-time)</p>
                    <p className="text-2xl font-bold text-purple-600 font-mono">{stats?.users?.total ?? 0}</p>
                    <p className="text-xs text-gray-500 mt-1">{stats?.users?.active ?? 0} active · {stats?.users?.newToday ?? 0} new in range</p>
                    <p className="text-xs text-gray-500 mt-1">
                        2D users: <span className="font-medium">{formatNumber(twoDCurrentUsers)}</span> · 3D users: <span className="font-medium">{formatNumber(threeDCurrentUsers)}</span> · Total: <span className="font-medium">{formatNumber(twoDCurrentUsers + threeDCurrentUsers)}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                        All slots users - 2D: <span className="font-medium">{formatNumber(twoDAllSlots.users)}</span> · 3D: <span className="font-medium">{formatNumber(threeDAllSlots.users)}</span> · Total: <span className="font-medium">{formatNumber(lotteryAllSlotsTotalUsers)}</span>
                    </p>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-transparent rounded-xl p-5 border border-orange-200">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Bets (period)</p>
                    <p className="text-2xl font-bold text-orange-500 font-mono">{formatNumber(mainBetsWithLottery)}</p>
                    <p className="text-xs text-gray-500 mt-1">Win rate: {stats?.bets?.winRate ?? 0}%</p>
                    <p className="text-xs text-gray-500 mt-1">
                        2D bets: <span className="font-medium">{formatNumber(twoDCurrentBets)}</span> · 3D bets: <span className="font-medium">{formatNumber(threeDCurrentBets)}</span> · Total: <span className="font-medium text-orange-600">{formatNumber(lotteryCurrentTotalTickets)}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                        All slots bets - 2D: <span className="font-medium">{formatNumber(twoDAllSlots.tickets)}</span> · 3D: <span className="font-medium">{formatNumber(threeDAllSlots.tickets)}</span> · Total: <span className="font-medium text-orange-600">{formatNumber(lotteryAllSlotsTotalTickets)}</span>
                    </p>
                </div>
            </div>

            {/* Detailed Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5 mb-6">
                {/* Revenue Details */}
                <SectionCard title="Revenue & Payouts" description="Selected period" icon={FaMoneyBillWave} linkTo="/reports" linkLabel="Reports">
                    <StatRow label="Total Revenue" value={formatCurrency(stats?.revenue?.total)} colorClass="text-green-600" />
                    <StatRow label="Total Payouts" value={formatCurrency(stats?.revenue?.payouts)} colorClass="text-red-500" />
                    <StatRow label="Net Profit" value={formatCurrency(stats?.revenue?.netProfit)} colorClass="text-blue-600" />
                </SectionCard>

                {/* Players */}
                <SectionCard title="Players" description="All-time counts" icon={FaUserFriends} linkTo="/all-users" linkLabel="All Players">
                    <StatRow label="Total Players" value={stats?.users?.total ?? 0} />
                    <StatRow label="Active Players" value={stats?.users?.active ?? 0} colorClass="text-green-600" />
                    <StatRow label="New in Period" value={stats?.users?.newToday ?? 0} colorClass="text-orange-500" />
                </SectionCard>

                {/* Bets */}
                <SectionCard title="Bets" description="Selected period" icon={FaChartBar} linkTo="/bet-history" linkLabel="Bet History">
                    <StatRow label="Total Bets" value={stats?.bets?.total ?? 0} />
                    <StatRow label="Winning Bets" value={stats?.bets?.winning ?? 0} colorClass="text-green-600" />
                    <StatRow label="Losing Bets" value={stats?.bets?.losing ?? 0} colorClass="text-red-500" />
                    <StatRow label="Pending Bets" value={stats?.bets?.pending ?? 0} colorClass="text-orange-500" />
                    <StatRow label="Win Rate" value={`${stats?.bets?.winRate ?? 0}%`} />
                </SectionCard>

                {/* Markets */}
                <SectionCard title="Markets" description="Main + Starline" icon={FaChartBar} linkTo="/markets" linkLabel="Markets">
                    <StatRow label="Total Markets" value={stats?.markets?.total ?? 0} />
                    <StatRow label="Open Now" value={stats?.markets?.open ?? 0} colorClass="text-green-600" />
                    <StatRow label="Result Pending" value={marketsPendingResult} colorClass={marketsPendingResult > 0 ? 'text-orange-500' : 'text-gray-400'} />
                    <StatRow label="Main Markets" value={stats?.markets?.main ?? stats?.markets?.total ?? 0} subValue={`${stats?.markets?.openMain ?? 0} open`} />
                    <StatRow label="Starline Markets" value={stats?.markets?.starline ?? 0} subValue={`${stats?.markets?.openStarline ?? 0} open`} />
                </SectionCard>

                {/* Payments */}
                <SectionCard title="Payments" description="Deposits & Withdrawals" icon={FaCreditCard} linkTo="/payment-management" linkLabel="Manage Payments">
                    <StatRow label="Deposits (period)" value={formatCurrency(stats?.payments?.totalDeposits)} colorClass="text-green-600" />
                    <StatRow label="Withdrawals (period)" value={formatCurrency(stats?.payments?.totalWithdrawals)} colorClass="text-red-500" />
                    <StatRow label="Pending Deposits" value={pendingDeposits} colorClass="text-orange-500" />
                    <StatRow label="Pending Withdrawals" value={pendingWithdrawals} colorClass="text-orange-500" />
                    <StatRow label="Total Pending" value={pendingPayments} colorClass="text-orange-500" />
                </SectionCard>

                {/* Wallet */}
                <SectionCard title="Wallet Balance" description="All players combined (all-time)" icon={FaWallet} linkTo="/wallet" linkLabel="Wallet">
                    <StatRow label="Total Balance" value={formatCurrency(stats?.wallet?.totalBalance)} colorClass="text-green-600" />
                </SectionCard>

                {/* Bookies (Super Admin only) */}
                {adminRole === 'super_admin' && (
                    <SectionCard title="Bookie Accounts" description="All-time" icon={FaUsers} linkTo="/bookie-management" linkLabel="Manage Bookies">
                        <StatRow label="Total Bookies" value={stats?.bookies?.total ?? 0} />
                        <StatRow label="Active Bookies" value={stats?.bookies?.active ?? 0} colorClass="text-green-600" />
                    </SectionCard>
                )}

                {/* Help Desk */}
                {isSuperAdmin && (
                    <SectionCard title="Help Desk" description="Support tickets" icon={FaLifeRing} linkTo="/help-desk" linkLabel="Help Desk">
                        <StatRow label="Total Tickets" value={stats?.helpDesk?.total ?? 0} />
                        <StatRow label="Open" value={stats?.helpDesk?.open ?? 0} colorClass="text-orange-500" />
                        <StatRow label="In Progress" value={stats?.helpDesk?.inProgress ?? 0} colorClass="text-blue-600" />
                    </SectionCard>
                )}
            </div>

            {/* Revenue Timeline (period summary) */}
            <div className="bg-white rounded-xl p-5 border border-gray-200 mb-6">
                <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <FaMoneyBillWave className="w-4 h-4 text-orange-500" />
                    Revenue Summary for Selected Period
                </h3>
                <p className="text-xs text-gray-500 mb-4">Total revenue in the selected date range.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <p className="text-gray-500 text-sm mb-1">Total Revenue</p>
                        <p className="text-xl font-bold text-green-600 font-mono">{formatCurrency(stats?.revenue?.total)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <p className="text-gray-500 text-sm mb-1">Total Payouts</p>
                        <p className="text-xl font-bold text-red-500 font-mono">{formatCurrency(stats?.revenue?.payouts)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <p className="text-gray-500 text-sm mb-1">Net Profit</p>
                        <p className="text-xl font-bold text-blue-600 font-mono">{formatCurrency(stats?.revenue?.netProfit)}</p>
                    </div>
                </div>
            </div>

            {isSuperAdmin && !selectedMarketId && (
                <div className="bg-white rounded-xl p-5 border border-gray-200 mb-6">
                    <h3 className="text-base font-semibold text-gray-800 mb-2 flex items-center gap-2">
                        <FaChartBar className="w-4 h-4 text-orange-500" />
                        Market-wise stats (selected period)
                    </h3>
                    <p className="text-xs text-gray-500 mb-3">
                        Bet volume, revenue, and payouts by market. Use the Market filter above to focus summary cards on one market.
                    </p>
                    {!stats?.marketWise?.length ? (
                        <p className="text-sm text-gray-500">No bets in this period.</p>
                    ) : (
                        <div className="overflow-x-auto -mx-1">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="text-left text-gray-500 border-b border-gray-200">
                                        <th className="py-2 px-1 sm:px-2 font-medium">Market</th>
                                        <th className="py-2 px-1 sm:px-2 font-medium text-right">Bets</th>
                                        <th className="py-2 px-1 sm:px-2 font-medium text-right">Revenue</th>
                                        <th className="py-2 px-1 sm:px-2 font-medium text-right">Payouts</th>
                                        <th className="py-2 px-1 sm:px-2 font-medium text-right">Net</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.marketWise.map((row) => (
                                        <tr key={row.marketId} className="border-b border-gray-100 last:border-0">
                                            <td className="py-2 px-1 sm:px-2 font-medium text-gray-800">{row.marketName}</td>
                                            <td className="py-2 px-1 sm:px-2 text-right font-mono tabular-nums">{row.bets}</td>
                                            <td className="py-2 px-1 sm:px-2 text-right font-mono tabular-nums text-green-600">{formatCurrency(row.revenue)}</td>
                                            <td className="py-2 px-1 sm:px-2 text-right font-mono tabular-nums text-red-500">{formatCurrency(row.payouts)}</td>
                                            <td className="py-2 px-1 sm:px-2 text-right font-mono tabular-nums text-blue-600">{formatCurrency(row.netProfit)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Game-wise Revenue Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-xl p-5 border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Aviator</h3>
                    <StatRow label="Total Revenue" value={formatCurrency(gameWiseRevenue?.aviator?.revenue)} colorClass="text-green-600" />
                    <StatRow label="Total Payout" value={formatCurrency(gameWiseRevenue?.aviator?.payout)} colorClass="text-red-500" />
                    <StatRow label="Total Profit" value={formatCurrency(gameWiseRevenue?.aviator?.totalProfit)} colorClass="text-blue-600" />
                </div>
                <div className="bg-white rounded-xl p-5 border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">FunTimer</h3>
                    <StatRow label="Total Revenue" value={formatCurrency(gameWiseRevenue?.funTimer?.revenue)} colorClass="text-green-600" />
                    <StatRow label="Total Payout" value={formatCurrency(gameWiseRevenue?.funTimer?.payout)} colorClass="text-red-500" />
                    <StatRow label="Total Profit" value={formatCurrency(gameWiseRevenue?.funTimer?.totalProfit)} colorClass="text-blue-600" />
                </div>
                <div className="bg-white rounded-xl p-5 border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Roulette</h3>
                    <StatRow label="Total Revenue" value={formatCurrency(gameWiseRevenue?.roulette?.revenue)} colorClass="text-green-600" />
                    <StatRow label="Total Payout" value={formatCurrency(gameWiseRevenue?.roulette?.payout)} colorClass="text-red-500" />
                    <StatRow label="Total Profit" value={formatCurrency(gameWiseRevenue?.roulette?.totalProfit)} colorClass="text-blue-600" />
                </div>
            </div>

            {/* Lottery 2D + 3D */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mt-6">
                <SectionCard title="2D Lottery Overview" description="Current slot + previous slot + selected range total" icon={FaDice} linkTo="/2d-management" linkLabel="Open 2D Management">
                    {lotteryStats.twoD.error ? (
                        <p className="text-sm text-red-500">{lotteryStats.twoD.error}</p>
                    ) : (
                        <>
                            <div className="mb-2 mt-1">
                                <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Current Slot (Live)</p>
                                <p className="text-[11px] text-gray-500">Running slot stats updated in real-time.</p>
                            </div>
                            <StatRow label="Current Slot" value={formatDrawTime(lotteryStats.twoD.current?.slot?.drawLabelEnd)} />
                            <StatRow label="Current Slot Tickets" value={formatNumber(lotteryStats.twoD.current?.summary?.totalTickets)} />
                            <StatRow label="Current Slot Bets" value={formatNumber(lotteryStats.twoD.current?.summary?.totalBets)} />
                            <StatRow label="Current Revenue" value={formatCurrency(lotteryStats.twoD.current?.summary?.revenue)} colorClass="text-green-600" />
                            <StatRow label="Current Payout" value={formatCurrency(lotteryStats.twoD.current?.summary?.winnerPayout)} colorClass="text-red-500" />
                            <StatRow label="Current Net" value={formatCurrency(lotteryStats.twoD.current?.summary?.amountRemaining)} colorClass="text-blue-600" />

                            <div className="mb-2 mt-3">
                                <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Previous Slot (Last Closed)</p>
                                <p className="text-[11px] text-gray-500">Shows only the immediate previous closed slot.</p>
                            </div>
                            <StatRow label="Previous Slot" value={formatDrawTime(lotteryStats.twoD.latest?.drawLabelEnd)} />
                            <StatRow label="Previous Slot Tickets" value={formatNumber(lotteryStats.twoD.latest?.totalTickets)} />
                            <StatRow label="Previous Slot Bets" value={formatNumber(lotteryStats.twoD.latest?.totalBets)} />
                            <StatRow label="Previous Slot Revenue" value={formatCurrency(lotteryStats.twoD.latest?.revenue)} colorClass="text-green-600" />
                            <StatRow label="Previous Slot Payout" value={formatCurrency(lotteryStats.twoD.latest?.winnerPayout)} colorClass="text-red-500" />
                            <StatRow label="Previous Slot Net" value={formatCurrency(lotteryStats.twoD.latest?.amountRemaining)} colorClass="text-blue-600" />

                            <div className="mb-2 mt-3">
                                <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Selected Range Total</p>
                                <p className="text-[11px] text-gray-500">All bets in selected date range (today/yesterday/custom).</p>
                            </div>
                            <StatRow label="All Slots Tickets" value={formatNumber(twoDAllSlots.tickets)} />
                            <StatRow label="All Slots Bets" value={formatNumber(twoDAllSlots.bets)} />
                            <StatRow label="All Slots Revenue" value={formatCurrency(twoDAllSlots.revenue)} colorClass="text-green-600" />
                            <StatRow label="All Slots Payout" value={formatCurrency(twoDAllSlots.payout)} colorClass="text-red-500" />
                            <StatRow label="All Slots Net" value={formatCurrency(twoDAllSlots.net)} colorClass="text-blue-600" />
                        </>
                    )}
                    <div className="grid grid-cols-2 gap-2 mt-3">
                        <Link to="/2d-management/current-slot-players" className="px-3 py-2 rounded-lg bg-gray-100 border border-gray-200 text-xs font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-600">2D players</Link>
                        <Link to="/2d-management/result-control" className="px-3 py-2 rounded-lg bg-gray-100 border border-gray-200 text-xs font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-600">Result Control</Link>
                        <Link to="/2d-management/old-slots" className="px-3 py-2 rounded-lg bg-gray-100 border border-gray-200 text-xs font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-600">Old Slot Stats</Link>
                    </div>
                </SectionCard>

                <SectionCard title="3D Lottery Overview" description="Current slot + previous slot + selected range total" icon={FaDice} linkTo="/3d-management" linkLabel="Open 3D Management">
                    {lotteryStats.threeD.error ? (
                        <p className="text-sm text-red-500">{lotteryStats.threeD.error}</p>
                    ) : (
                        <>
                            <div className="mb-2 mt-1">
                                <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Current Slot (Live)</p>
                                <p className="text-[11px] text-gray-500">Running slot stats updated in real-time.</p>
                            </div>
                            <StatRow label="Current Slot" value={formatSlotWindow(lotteryStats.threeD.current?.slot)} />
                            <StatRow label="Current Tickets" value={formatNumber(lotteryStats.threeD.current?.summary?.totalTickets)} />
                            <StatRow label="Current Revenue" value={formatCurrency(lotteryStats.threeD.current?.summary?.revenue)} colorClass="text-green-600" />
                            <StatRow label="Current Payout" value={formatCurrency(lotteryStats.threeD.current?.summary?.winnerPayout)} colorClass="text-red-500" />
                            <StatRow label="Current Net" value={formatCurrency(lotteryStats.threeD.current?.summary?.amountRemaining)} colorClass="text-blue-600" />

                            <div className="mb-2 mt-3">
                                <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Previous Slot (Last Closed)</p>
                                <p className="text-[11px] text-gray-500">Shows only the immediate previous closed slot.</p>
                            </div>
                            <StatRow label="Previous Slot" value={formatSlotWindow(lotteryStats.threeD.latest)} />
                            <StatRow label="Previous Slot Tickets" value={formatNumber(lotteryStats.threeD.latest?.totalTickets)} />
                            <StatRow label="Previous Slot Revenue" value={formatCurrency(lotteryStats.threeD.latest?.revenue)} colorClass="text-green-600" />
                            <StatRow label="Previous Slot Payout" value={formatCurrency(lotteryStats.threeD.latest?.winnerPayout)} colorClass="text-red-500" />
                            <StatRow label="Previous Slot Net" value={formatCurrency(lotteryStats.threeD.latest?.amountRemaining)} colorClass="text-blue-600" />

                            <div className="mb-2 mt-3">
                                <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Selected Range Total</p>
                                <p className="text-[11px] text-gray-500">All bets in selected date range (today/yesterday/custom).</p>
                            </div>
                            <StatRow label="All Slots Tickets" value={formatNumber(threeDAllSlots.tickets)} />
                            <StatRow label="All Slots Revenue" value={formatCurrency(threeDAllSlots.revenue)} colorClass="text-green-600" />
                            <StatRow label="All Slots Payout" value={formatCurrency(threeDAllSlots.payout)} colorClass="text-red-500" />
                            <StatRow label="All Slots Net" value={formatCurrency(threeDAllSlots.net)} colorClass="text-blue-600" />
                        </>
                    )}
                    <div className="grid grid-cols-2 gap-2 mt-3">
                        <Link to="/3d-management/current-slot-players" className="px-3 py-2 rounded-lg bg-gray-100 border border-gray-200 text-xs font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-600">3D players</Link>
                        <Link to="/3d-management/result-control" className="px-3 py-2 rounded-lg bg-gray-100 border border-gray-200 text-xs font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-600">Result Control</Link>
                        <Link to="/3d-management/tickets" className="px-3 py-2 rounded-lg bg-gray-100 border border-gray-200 text-xs font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-600">All User Tickets</Link>
                        <Link to="/3d-management/old-slots" className="px-3 py-2 rounded-lg bg-gray-100 border border-gray-200 text-xs font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-600">Old Slot Stats</Link>
                        <Link to="/3d-management/slot-wise-bets" className="px-3 py-2 rounded-lg bg-gray-100 border border-gray-200 text-xs font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-600">Slot-wise Bets</Link>
                    </div>
                </SectionCard>
            </div>

            {/* Quick Links */}
            <div className="bg-white rounded-xl p-5 border border-gray-200 mt-6">
                <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <FaClipboardList className="w-4 h-4 text-orange-500" />
                    Quick Links
                </h3>
                <p className="text-xs text-gray-500 mb-4">Navigate to admin sections directly from here.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    <Link to="/add-result" className="px-4 py-3 rounded-lg bg-gray-100 hover:bg-orange-500/20 border border-gray-200 hover:border-orange-300 text-gray-600 hover:text-orange-500 text-sm font-medium transition-all text-center">
                        Add Result
                    </Link>
                    <Link to="/update-rate" className="px-4 py-3 rounded-lg bg-gray-100 hover:bg-orange-500/20 border border-gray-200 hover:border-orange-300 text-gray-600 hover:text-orange-500 text-sm font-medium transition-all text-center">
                        Update Rate
                    </Link>
                    <Link to="/add-user" className="px-4 py-3 rounded-lg bg-gray-100 hover:bg-orange-500/20 border border-gray-200 hover:border-orange-300 text-gray-600 hover:text-orange-500 text-sm font-medium transition-all text-center">
                        Add Player
                    </Link>
                    <Link to="/add-market" className="px-4 py-3 rounded-lg bg-gray-100 hover:bg-orange-500/20 border border-gray-200 hover:border-orange-300 text-gray-600 hover:text-orange-500 text-sm font-medium transition-all text-center">
                        Add Market
                    </Link>
                    <Link to="/logs" className="px-4 py-3 rounded-lg bg-gray-100 hover:bg-orange-500/20 border border-gray-200 hover:border-orange-300 text-gray-600 hover:text-orange-500 text-sm font-medium transition-all text-center">
                        Activity Logs
                    </Link>
                </div>
            </div>
        </AdminLayout>
    );
};

export default AdminDashboard;
