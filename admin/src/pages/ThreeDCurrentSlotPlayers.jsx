import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import DateRangePresetFilter from '../components/DateRangePresetFilter';
import useModalBackHandler from '../hooks/useModalBackHandler';
import { clearAdminSession, fetchWithAuth } from '../lib/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const ALL_DAY_SLOT_ISO = '__all_day__';

const todayDate = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const slotScheduleLabel = (s) => {
    const tag = s.status === 'live' ? 'Live' : s.status === 'past' ? 'Past' : 'Advance';
    return `${s.drawLabelEnd || s.slotStartIso} (${tag})`;
};

const resolveScheduleSelection = (slots, prevIso) => {
    if (prevIso === ALL_DAY_SLOT_ISO) return ALL_DAY_SLOT_ISO;
    if (prevIso && slots.some((s) => s.slotStartIso === prevIso)) return prevIso;
    return ALL_DAY_SLOT_ISO;
};

/** Matches user id, player name, or phone (substring; phone also digit-only). */
const rowMatchesSlotPlayerSearch = (player, raw) => {
    const q = String(raw || '').trim();
    if (!q) return true;
    const ql = q.toLowerCase();
    const uid = String(player.userId ?? '').toLowerCase();
    const user = String(player.username || '').toLowerCase();
    const phone = String(player.phone || '');
    const phoneDigits = phone.replace(/\D/g, '');
    const qDigits = q.replace(/\D/g, '');
    if (uid.includes(ql)) return true;
    if (user.includes(ql)) return true;
    if (phone.toLowerCase().includes(ql)) return true;
    if (qDigits.length >= 2 && phoneDigits.includes(qDigits)) return true;
    return false;
};

const ThreeDCurrentSlotPlayers = () => {
    const navigate = useNavigate();
    /** live = server current slot; bySlot = IST day + draw (past, live, or advance) */
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
    const [showPlayerHistoryModal, setShowPlayerHistoryModal] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [playerHistoryData, setPlayerHistoryData] = useState(null);
    const [loadingPlayerHistory, setLoadingPlayerHistory] = useState(false);
    const [playerHistoryError, setPlayerHistoryError] = useState('');
    const [playerSearch, setPlayerSearch] = useState('');

    const selectedSlotIsoRef = useRef('');
    useEffect(() => {
        selectedSlotIsoRef.current = selectedHistorySlotIso;
    }, [selectedHistorySlotIso]);

    const handleLogout = useCallback(() => {
        clearAdminSession();
        navigate('/');
    }, [navigate]);

    const closePlayerHistoryModal = useModalBackHandler(showPlayerHistoryModal, () => {
        setShowPlayerHistoryModal(false);
        setSelectedPlayer(null);
        setPlayerHistoryData(null);
        setPlayerHistoryError('');
    });

    const fetchLiveSlotPlayers = useCallback(async ({ pageToFetch = 1, append = false } = {}) => {
        if (append) setLoadingMorePlayers(true);
        else setLoading(true);
        setError('');
        try {
            const currentRes = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/current-slot`);
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
            const playersRes = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/slots/${encodeURIComponent(iso)}/players?${params.toString()}`);
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
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/day-slot-schedule?${params.toString()}`);
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
                const playersRes = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/day-players?${params.toString()}`);
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
            const playersRes = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/slots/${encodeURIComponent(iso)}/players?${paginationParams.toString()}`);
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

    const fetchPlayerHistory = useCallback(async (userId) => {
        if (!userId) return;
        setLoadingPlayerHistory(true);
        setPlayerHistoryError('');
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/players/${encodeURIComponent(userId)}/history?limit=100`);
            if (res.status === 401) return;
            const data = await res.json();
            if (!data?.success) throw new Error(data?.message || 'Failed to load player history');
            setPlayerHistoryData(data.data || null);
        } catch (err) {
            setPlayerHistoryError(err.message || 'Failed to load player history');
            setPlayerHistoryData(null);
        } finally {
            setLoadingPlayerHistory(false);
        }
    }, []);

    const handleOpenPlayerHistory = async (player) => {
        if (!player?.userId) return;
        setSelectedPlayer(player);
        setShowPlayerHistoryModal(true);
        await fetchPlayerHistory(player.userId);
    };

    const playerHistoryBetRows = useMemo(() => {
        const slots = Array.isArray(playerHistoryData?.slots) ? playerHistoryData.slots : [];
        const rows = [];
        const nowMs = Date.now();
        slots.forEach((slot) => {
            const draw = slot?.drawLabelEnd || slot?.slotStartIso || '-';
            const slotStartMs = slot?.slotStartIso ? new Date(slot.slotStartIso).getTime() : Number.NaN;
            const isAdvanceDraw = Number.isFinite(slotStartMs) && slotStartMs > nowMs;
            const drawDate = slot?.slotStartIso
                ? new Date(slot.slotStartIso).toLocaleDateString('en-GB')
                : '-';
            const bets = Array.isArray(slot?.bets) ? slot.bets : [];
            bets.forEach((bet) => {
                rows.push({
                    ...bet,
                    drawDate,
                    drawLabelEnd: draw,
                    isAdvanceDraw,
                });
            });
        });
        return rows;
    }, [playerHistoryData]);

    const selectedSlotMeta = useMemo(() => {
        if (selectedHistorySlotIso === ALL_DAY_SLOT_ISO) {
            if (dateFrom !== dateTo) {
                return { status: 'range', dateFrom, dateTo };
            }
            return { status: 'day', date: dateFrom };
        }
        return historySlots.find((s) => s.slotStartIso === selectedHistorySlotIso) || null;
    }, [historySlots, selectedHistorySlotIso, dateFrom, dateTo]);

    const isDayOrRangeAggregate = viewMode === 'bySlot' && selectedHistorySlotIso === ALL_DAY_SLOT_ISO;

    const filteredPlayers = useMemo(() => {
        if (!playerSearch.trim()) return players;
        return players.filter((p) => rowMatchesSlotPlayerSearch(p, playerSearch));
    }, [players, playerSearch]);

    return (
        <AdminLayout onLogout={handleLogout} title="3D players">
            <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">3D players</h1>
                        <p className="text-sm text-gray-500 break-all">Slot Start: {slotStartIso || '-'}</p>
                    </div>
                    <button
                        type="button"
                        onClick={refresh}
                        className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                        disabled={loading || loadingHistorySlots}
                    >
                        {loading || loadingHistorySlots ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                    <p className="text-xs text-gray-500">
                        Dates are IST (Asia/Kolkata). Choose a range (max 62 days) or the same start/end for one day. For a
                        single day you can pick a specific draw or &quot;All day&quot;. For a range, all draws in the range
                        are merged.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setViewMode('live')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${
                                viewMode === 'live'
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                            }`}
                        >
                            Live slot
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('bySlot')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${
                                viewMode === 'bySlot'
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                            }`}
                        >
                            By date &amp; draw time
                        </button>
                    </div>
                    {viewMode === 'bySlot' ? (
                        <div className="flex flex-wrap items-end gap-3">
                            <DateRangePresetFilter
                                dateFrom={dateFrom}
                                dateTo={dateTo}
                                setDateFrom={setDateFrom}
                                setDateTo={setDateTo}
                                className="w-full"
                            />
                            <label className="flex flex-col gap-1 text-sm min-w-[220px] flex-1">
                                <span className="text-gray-600 font-medium">Draw (slot end time)</span>
                                <select
                                    value={selectedHistorySlotIso}
                                    onChange={(e) => setSelectedHistorySlotIso(e.target.value)}
                                    disabled={dateFrom !== dateTo || loadingHistorySlots}
                                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-full max-w-md disabled:bg-gray-100 disabled:text-gray-500"
                                >
                                    {dateFrom !== dateTo ? (
                                        <option value={ALL_DAY_SLOT_ISO}>All draws in selected date range</option>
                                    ) : (
                                        <>
                                            <option value={ALL_DAY_SLOT_ISO}>All day — every draw on this date</option>
                                            {historySlots.map((s) => (
                                                <option key={s.slotStartIso} value={s.slotStartIso}>
                                                    {slotScheduleLabel(s)}
                                                </option>
                                            ))}
                                        </>
                                    )}
                                </select>
                            </label>
                            {loadingHistorySlots ? (
                                <span className="text-xs text-gray-500 pb-1">Loading schedule…</span>
                            ) : null}
                        </div>
                    ) : null}
                    {viewMode === 'bySlot' && selectedSlotMeta ? (
                        <p className="text-xs text-gray-600">
                            Viewing:{' '}
                            <span className="font-semibold">
                                {selectedSlotMeta.status === 'range'
                                    ? `All draws from ${selectedSlotMeta.dateFrom} to ${selectedSlotMeta.dateTo} (IST)`
                                    : selectedSlotMeta.status === 'day'
                                      ? 'All draws on this IST date (entire day)'
                                      : selectedSlotMeta.status === 'past'
                                        ? 'Completed draw (historical slot)'
                                        : selectedSlotMeta.status === 'upcoming'
                                          ? 'Advance draw (bets already placed for this future slot)'
                                          : 'Current running slot'}
                            </span>
                        </p>
                    ) : null}
                </div>

                {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div> : null}

                <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-3">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <h3 className="text-lg font-semibold text-gray-800">Current Slot Playing Players</h3>
                            {loading ? <span className="text-xs text-gray-500">Loading...</span> : null}
                            {!loading && players.length > 0 && playerSearch.trim() ? (
                                <span className="text-xs text-gray-500">
                                    Showing {filteredPlayers.length} of {players.length}
                                </span>
                            ) : null}
                        </div>
                        <label className="flex flex-col gap-1 text-sm w-full sm:w-72 shrink-0">
                            <span className="text-gray-600 font-medium">Search</span>
                            <input
                                type="search"
                                value={playerSearch}
                                onChange={(e) => setPlayerSearch(e.target.value)}
                                placeholder="User ID, player name, phone…"
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
                                autoComplete="off"
                                spellCheck={false}
                            />
                        </label>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-500 border-b border-gray-200">
                                    <th className="py-2 pr-3">Player</th>
                                    <th className="py-2 pr-3 text-right">
                                        {!isDayOrRangeAggregate
                                            ? 'Total Bets (This Slot)'
                                            : dateFrom !== dateTo
                                              ? 'Total bets (range)'
                                              : 'Total bets (day)'}
                                    </th>
                                    <th className="py-2 pr-3 text-right">All-time Bets</th>
                                    <th className="py-2 pr-3 text-right">Stake</th>
                                    <th className="py-2 pr-3 text-right">Payout</th>
                                    <th className="py-2 pr-3 text-right">P/L</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!players.length && !loading ? (
                                    <tr>
                                        <td colSpan={6} className="py-4 text-center text-gray-500">
                                            {viewMode === 'bySlot'
                                                ? 'No players for this slot yet.'
                                                : 'No players in current slot yet.'}
                                        </td>
                                    </tr>
                                ) : null}
                                {players.length > 0 && !loading && !filteredPlayers.length ? (
                                    <tr>
                                        <td colSpan={6} className="py-4 text-center text-gray-500">
                                            No players match your search. Try another user ID, name, or phone.
                                        </td>
                                    </tr>
                                ) : null}
                                {filteredPlayers.map((player) => (
                                    <tr key={`3d-current-${player.userId}`} className="border-b border-gray-100">
                                        <td className="py-2 pr-3">
                                            <button
                                                type="button"
                                                onClick={() => handleOpenPlayerHistory(player)}
                                                className="font-semibold text-blue-600 hover:text-blue-800"
                                            >
                                                {player.username || 'unknown'}
                                            </button>
                                            {player.phone ? <div className="text-xs text-gray-500">{player.phone}</div> : null}
                                        </td>
                                        <td className="py-2 pr-3 text-right font-mono">{Number(player.currentSlotBetCount ?? player.batchBetCount ?? player.betCount ?? 0)}</td>
                                        <td className="py-2 pr-3 text-right font-mono">{Number(player.totalBetCountAllTime ?? player.totalBetCount ?? player.betCount ?? 0)}</td>
                                        <td className="py-2 pr-3 text-right font-mono">₹{Number(player.totalStake || 0).toLocaleString('en-IN')}</td>
                                        <td className="py-2 pr-3 text-right font-mono">₹{Number(player.totalPayout || 0).toLocaleString('en-IN')}</td>
                                        <td className={`py-2 pr-3 text-right font-mono ${Number(player.netProfitLoss || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            ₹{Number(player.netProfitLoss || 0).toLocaleString('en-IN')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                        <p className="text-xs text-gray-500">
                            Loaded {players.length} player{players.length === 1 ? '' : 's'} (Page {playersPage || 1})
                        </p>
                        <button
                            type="button"
                            onClick={() => loadNextPlayersPage()}
                            disabled={loading || loadingMorePlayers || !playersHasMore}
                            className="px-3 py-1.5 rounded-lg bg-[#1B3150] text-white text-xs font-semibold hover:bg-[#152842] disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {loadingMorePlayers ? 'Loading...' : 'Next Page'}
                        </button>
                    </div>
                </div>
            </div>

            {showPlayerHistoryModal && (
                <div className="fixed inset-0 z-[95] flex items-center justify-center p-3 bg-black/40">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-[96vw] h-[92vh] overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-blue-700">
                                    Player 3D Bet History - {playerHistoryData?.player?.username || selectedPlayer?.username || 'Player'}
                                </h3>
                                {playerHistoryData?.player?.phone ? (
                                    <p className="text-xs text-gray-500">{playerHistoryData.player.phone}</p>
                                ) : null}
                            </div>
                            <button type="button" onClick={closePlayerHistoryModal} className="text-gray-400 hover:text-gray-800 p-1">x</button>
                        </div>
                        <div className="p-4 space-y-4 overflow-y-auto h-[calc(92vh-64px)]">
                            {loadingPlayerHistory ? (
                                <div className="text-sm text-gray-500">Loading player history...</div>
                            ) : playerHistoryError ? (
                                <div className="rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2">
                                    {playerHistoryError}
                                </div>
                            ) : playerHistoryData ? (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                            <p className="text-xs text-gray-500">Total Bets</p>
                                            <p className="text-lg font-bold text-gray-800">{playerHistoryData.summary?.totalBets || 0}</p>
                                        </div>
                                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                            <p className="text-xs text-gray-500">Total Stake</p>
                                            <p className="text-lg font-bold text-gray-800">Rs {Number(playerHistoryData.summary?.totalStake || 0).toLocaleString('en-IN')}</p>
                                        </div>
                                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                            <p className="text-xs text-gray-500">Total Payout</p>
                                            <p className="text-lg font-bold text-gray-800">Rs {Number(playerHistoryData.summary?.totalPayout || 0).toLocaleString('en-IN')}</p>
                                        </div>
                                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                            <p className="text-xs text-gray-500">Net Profit/Loss</p>
                                            <p className={`text-lg font-bold ${Number(playerHistoryData.summary?.netProfitLoss || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                Rs {Number(playerHistoryData.summary?.netProfitLoss || 0).toLocaleString('en-IN')}
                                            </p>
                                        </div>
                                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                            <p className="text-xs text-gray-500">Wins</p>
                                            <p className="text-lg font-bold text-green-700">{playerHistoryData.summary?.wins || 0}</p>
                                        </div>
                                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                            <p className="text-xs text-gray-500">Losses</p>
                                            <p className="text-lg font-bold text-red-700">{playerHistoryData.summary?.losses || 0}</p>
                                        </div>
                                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                            <p className="text-xs text-gray-500">Pending</p>
                                            <p className="text-lg font-bold text-amber-700">{playerHistoryData.summary?.pending || 0}</p>
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-gray-200 overflow-auto max-h-[58vh]">
                                        <table className="min-w-full text-xs">
                                            <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 text-gray-600">
                                                <tr>
                                                    <th className="text-left px-3 py-2">Date</th>
                                                    <th className="text-left px-3 py-2">Draw Time</th>
                                                    <th className="text-left px-3 py-2">Set</th>
                                                    <th className="text-left px-3 py-2">Number</th>
                                                    <th className="text-right px-3 py-2">Stake (Rs)</th>
                                                    <th className="text-left px-3 py-2">Result</th>
                                                    <th className="text-right px-3 py-2">Payout (Rs)</th>
                                                    <th className="text-right px-3 py-2">Net (Rs)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {playerHistoryBetRows.length ? playerHistoryBetRows.map((bet) => (
                                                    <tr key={bet.betId} className="border-b border-gray-100">
                                                        <td className="px-3 py-2 whitespace-nowrap">{bet.drawDate}</td>
                                                        <td className="px-3 py-2 whitespace-nowrap">
                                                            <div className="inline-flex items-center gap-2">
                                                                <span>{bet.drawLabelEnd}</span>
                                                                {bet.isAdvanceDraw ? (
                                                                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                                                                        Advance Draw
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2 whitespace-nowrap">{bet.setLabel}</td>
                                                        <td className="px-3 py-2 font-mono">{bet.number}</td>
                                                        <td className="px-3 py-2 text-right">Rs {Number(bet.amount || 0).toLocaleString('en-IN')}</td>
                                                        <td className="px-3 py-2">
                                                            <span className={`font-semibold ${
                                                                bet.outcome === 'win'
                                                                    ? 'text-green-700'
                                                                    : bet.outcome === 'lose'
                                                                      ? 'text-red-700'
                                                                      : bet.outcome === 'pending'
                                                                        ? 'text-amber-700'
                                                                        : 'text-gray-600'
                                                            }`}
                                                            >
                                                                {String(bet.outcome || '').toUpperCase()}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-right">Rs {Number(bet.payout || 0).toLocaleString('en-IN')}</td>
                                                        <td className={`px-3 py-2 text-right font-semibold ${
                                                            Number(bet.netProfitLoss || 0) >= 0 ? 'text-green-700' : 'text-red-700'
                                                        }`}
                                                        >
                                                            Rs {Number(bet.netProfitLoss || 0).toLocaleString('en-IN')}
                                                        </td>
                                                    </tr>
                                                )) : (
                                                    <tr>
                                                        <td colSpan={8} className="px-3 py-4 text-center text-gray-500">No bets found.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default ThreeDCurrentSlotPlayers;
