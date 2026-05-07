import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Player2DHistoryModal from '../components/Player2DHistoryModal';
import { clearAdminSession, fetchWithAuth } from '../lib/auth';
import { TWO_D_PLAYERS_ALL_DAY_SLOT } from '../utils/twoDPlayersListReturnNavigation';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const ALL_DAY_SLOT_ISO = TWO_D_PLAYERS_ALL_DAY_SLOT;

const todayDate = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const resolveScheduleSelection = (slots, prevIso) => {
    if (prevIso === ALL_DAY_SLOT_ISO) return ALL_DAY_SLOT_ISO;
    if (prevIso && slots.some((s) => s.slotStartIso === prevIso)) return prevIso;
    return ALL_DAY_SLOT_ISO;
};

/**
 * Holds 2D players list fetch state. Player history opens as a modal (no route swap).
 */
const TwoDPlayersRouteLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const [historyUserId, setHistoryUserId] = useState(null);
    const [viewMode, setViewMode] = useState('live');
    const t0 = todayDate();
    const [dateFrom, setDateFrom] = useState(t0);
    const [dateTo, setDateTo] = useState(t0);
    const [historySlots, setHistorySlots] = useState([]);
    const [selectedHistorySlotIso, setSelectedHistorySlotIso] = useState('');
    const [loadingHistorySlots, setLoadingHistorySlots] = useState(false);

    const [slotStartIso, setSlotStartIso] = useState('');
    const [players, setPlayers] = useState([]);
    const [playersPage, setPlayersPage] = useState(1);
    const [playersHasMore, setPlayersHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMorePlayers, setLoadingMorePlayers] = useState(false);
    const [error, setError] = useState('');

    const selectedSlotIsoRef = useRef('');
    useEffect(() => {
        selectedSlotIsoRef.current = selectedHistorySlotIso;
    }, [selectedHistorySlotIso]);

    useEffect(() => {
        const view = searchParams.get('view');
        if (view === 'bySlot') {
            const df = searchParams.get('dateFrom');
            const dt = searchParams.get('dateTo');
            const slot = searchParams.get('slot');
            setViewMode('bySlot');
            setDateFrom(df || todayDate());
            setDateTo(dt || todayDate());
            setSelectedHistorySlotIso(slot !== null && slot !== '' ? slot : ALL_DAY_SLOT_ISO);
        } else if (view === 'live') {
            setViewMode('live');
        }
    }, [searchParams.toString()]);

    const openPlayerHistory = useCallback((userId) => {
        if (!userId) return;
        setHistoryUserId(String(userId));
    }, []);

    const closePlayerHistory = useCallback(() => {
        setHistoryUserId(null);
    }, []);

    useEffect(() => {
        const openId = location.state?.openHistoryUserId;
        if (!openId) return;
        setHistoryUserId(String(openId));
        navigate('/2d-management/current-slot-players', { replace: true, state: {} });
    }, [location.state, navigate]);

    const fetchLiveSlotPlayers = useCallback(async ({ pageToFetch = 1, append = false } = {}) => {
        if (append) setLoadingMorePlayers(true);
        else setLoading(true);
        setError('');
        try {
            const currentRes = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/current-slot`);
            if (currentRes.status === 401) return;
            const currentJson = await currentRes.json();
            if (!currentJson?.success) throw new Error(currentJson?.message || 'Failed to load current slot');
            const iso = currentJson?.data?.slot?.slotStartIso || '';
            setSlotStartIso(iso);
            if (!iso) {
                setPlayers([]);
                setPlayersPage(1);
                setPlayersHasMore(false);
                return;
            }

            const params = new URLSearchParams({ limit: '20', page: String(pageToFetch) });
            const playersRes = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/slots/${encodeURIComponent(iso)}/players?${params.toString()}`);
            if (playersRes.status === 401) return;
            const playersJson = await playersRes.json();
            if (!playersJson?.success) throw new Error(playersJson?.message || 'Failed to load current slot players');
            const nextPlayers = Array.isArray(playersJson?.data?.players) ? playersJson.data.players : [];
            setPlayersHasMore(Boolean(playersJson?.data?.pagination?.hasMore));
            setPlayersPage(pageToFetch);
            setPlayers((prev) => (append ? [...prev, ...nextPlayers] : nextPlayers));
        } catch (err) {
            setPlayers([]);
            setPlayersPage(1);
            setPlayersHasMore(false);
            setError(err?.message || 'Failed to load current slot players');
        } finally {
            if (append) setLoadingMorePlayers(false);
            else setLoading(false);
        }
    }, []);

    const fetchDaySlotSchedule = useCallback(async (targetDate) => {
        setLoadingHistorySlots(true);
        setError('');
        try {
            const params = new URLSearchParams({ date: targetDate });
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/day-slot-schedule?${params.toString()}`);
            if (res.status === 401) return '';
            const json = await res.json();
            if (!json?.success) throw new Error(json?.message || 'Failed to load slot schedule for date');

            const slots = Array.isArray(json?.data?.slots) ? json.data.slots : [];

            let chosen = '';
            setHistorySlots(slots);
            setSelectedHistorySlotIso((prev) => {
                chosen = resolveScheduleSelection(slots, prev);
                return chosen;
            });
            return chosen;
        } catch (err) {
            setHistorySlots([]);
            setSelectedHistorySlotIso('');
            setError(err?.message || 'Failed to load slots for this date');
            return '';
        } finally {
            setLoadingHistorySlots(false);
        }
    }, []);

    const fetchPlayersForSlotIso = useCallback(async (iso, { pageToFetch = 1, append = false } = {}) => {
        if (!iso) {
            setSlotStartIso('');
            setPlayers([]);
            setPlayersPage(1);
            setPlayersHasMore(false);
            setLoading(false);
            return;
        }
        if (append) setLoadingMorePlayers(true);
        else setLoading(true);
        setError('');
        try {
            const paginationParams = new URLSearchParams({ limit: '20', page: String(pageToFetch) });
            if (iso === ALL_DAY_SLOT_ISO) {
                const params = new URLSearchParams({ dateFrom, dateTo, limit: '20', page: String(pageToFetch) });
                const playersRes = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/day-players?${params.toString()}`);
                if (playersRes.status === 401) return;
                const playersJson = await playersRes.json();
                if (!playersJson?.success) throw new Error(playersJson?.message || 'Failed to load day players');
                const meta = playersJson?.data?.slot;
                setSlotStartIso(
                    meta?.label
                        || (dateFrom === dateTo
                            ? `All draws · ${dateFrom} (IST)`
                            : `All draws · ${dateFrom} – ${dateTo} (IST)`),
                );
                const nextPlayers = Array.isArray(playersJson?.data?.players) ? playersJson.data.players : [];
                setPlayersHasMore(Boolean(playersJson?.data?.pagination?.hasMore));
                setPlayersPage(pageToFetch);
                setPlayers((prev) => (append ? [...prev, ...nextPlayers] : nextPlayers));
                return;
            }
            const playersRes = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/slots/${encodeURIComponent(iso)}/players?${paginationParams.toString()}`);
            if (playersRes.status === 401) return;
            const playersJson = await playersRes.json();
            if (!playersJson?.success) throw new Error(playersJson?.message || 'Failed to load slot players');
            const meta = playersJson?.data?.slot;
            setSlotStartIso(meta?.slotStartIso || iso);
            const nextPlayers = Array.isArray(playersJson?.data?.players) ? playersJson.data.players : [];
            setPlayersHasMore(Boolean(playersJson?.data?.pagination?.hasMore));
            setPlayersPage(pageToFetch);
            setPlayers((prev) => (append ? [...prev, ...nextPlayers] : nextPlayers));
        } catch (err) {
            setPlayers([]);
            setPlayersPage(1);
            setPlayersHasMore(false);
            setError(err?.message || 'Failed to load slot players');
        } finally {
            if (append) setLoadingMorePlayers(false);
            else setLoading(false);
        }
    }, [dateFrom, dateTo]);

    const refresh = useCallback(async () => {
        if (viewMode === 'live') {
            await fetchLiveSlotPlayers({ pageToFetch: 1 });
            return;
        }
        if (dateFrom !== dateTo) {
            setHistorySlots([]);
            setSelectedHistorySlotIso(ALL_DAY_SLOT_ISO);
            await fetchPlayersForSlotIso(ALL_DAY_SLOT_ISO, { pageToFetch: 1 });
            return;
        }
        const prevIso = selectedSlotIsoRef.current;
        const chosen = await fetchDaySlotSchedule(dateFrom);
        if (chosen && chosen === prevIso) {
            await fetchPlayersForSlotIso(chosen, { pageToFetch: 1 });
        }
    }, [viewMode, dateFrom, dateTo, fetchLiveSlotPlayers, fetchDaySlotSchedule, fetchPlayersForSlotIso]);

    const loadNextPlayersPage = useCallback(async () => {
        if (loading || loadingMorePlayers || !playersHasMore) return;
        const nextPage = playersPage + 1;
        if (viewMode === 'live') {
            await fetchLiveSlotPlayers({ pageToFetch: nextPage, append: true });
            return;
        }
        await fetchPlayersForSlotIso(selectedHistorySlotIso, { pageToFetch: nextPage, append: true });
    }, [
        loading,
        loadingMorePlayers,
        playersHasMore,
        playersPage,
        viewMode,
        selectedHistorySlotIso,
        fetchLiveSlotPlayers,
        fetchPlayersForSlotIso,
    ]);

    useEffect(() => {
        if (viewMode === 'live') {
            fetchLiveSlotPlayers({ pageToFetch: 1 });
        }
    }, [viewMode, fetchLiveSlotPlayers]);

    useEffect(() => {
        if (viewMode !== 'bySlot') return;
        if (dateFrom !== dateTo) {
            setHistorySlots([]);
            setSelectedHistorySlotIso(ALL_DAY_SLOT_ISO);
            return;
        }
        fetchDaySlotSchedule(dateFrom);
    }, [viewMode, dateFrom, dateTo, fetchDaySlotSchedule]);

    useEffect(() => {
        if (viewMode !== 'bySlot') return;
        if (!selectedHistorySlotIso) {
            setSlotStartIso('');
            setPlayers([]);
            setPlayersPage(1);
            setPlayersHasMore(false);
            setLoading(false);
            return;
        }
        fetchPlayersForSlotIso(selectedHistorySlotIso, { pageToFetch: 1 });
    }, [viewMode, selectedHistorySlotIso, dateFrom, dateTo, fetchPlayersForSlotIso]);

    const outletContext = useMemo(
        () => ({
            allDaySlotIso: ALL_DAY_SLOT_ISO,
            viewMode,
            setViewMode,
            dateFrom,
            setDateFrom,
            dateTo,
            setDateTo,
            historySlots,
            selectedHistorySlotIso,
            setSelectedHistorySlotIso,
            loadingHistorySlots,
            slotStartIso,
            players,
            playersPage,
            playersHasMore,
            loading,
            loadingMorePlayers,
            error,
            refresh,
            loadNextPlayersPage,
            navigateLogout: () => {
                clearAdminSession();
                navigate('/');
            },
            todayDate,
            openPlayerHistory,
            closePlayerHistory,
        }),
        [
            viewMode,
            dateFrom,
            dateTo,
            historySlots,
            selectedHistorySlotIso,
            loadingHistorySlots,
            slotStartIso,
            players,
            playersPage,
            playersHasMore,
            loading,
            loadingMorePlayers,
            error,
            refresh,
            loadNextPlayersPage,
            navigate,
            openPlayerHistory,
            closePlayerHistory,
        ],
    );

    return (
        <>
            <Outlet context={outletContext} />
            {historyUserId ? (
                <Player2DHistoryModal userId={historyUserId} onClose={closePlayerHistory} />
            ) : null}
        </>
    );
};

export default TwoDPlayersRouteLayout;
