import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import useModalBackHandler from '../hooks/useModalBackHandler';
import { clearAdminSession, fetchWithAuth } from '../lib/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const todayDate = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const slotScheduleLabel = (s) => {
    const tag = s.status === 'live' ? 'Live' : 'Advance';
    return `${s.drawLabelEnd || s.slotStartIso} (${tag})`;
};

const LIVE_OR_ADVANCE = (s) => s.status === 'live' || s.status === 'upcoming';

const resolveScheduleSelection = (slots, prevIso) => {
    if (prevIso && slots.some((s) => s.slotStartIso === prevIso)) return prevIso;
    const live = slots.find((s) => s.status === 'live');
    if (live) return live.slotStartIso;
    const firstUp = slots.find((s) => s.status === 'upcoming');
    return firstUp ? firstUp.slotStartIso : '';
};

const TwoDCurrentSlotPlayers = () => {
    const navigate = useNavigate();
    /** live = server current slot; bySlot = IST day + draw time (live and advance only — no past) */
    const [viewMode, setViewMode] = useState('live');
    const [historyDate, setHistoryDate] = useState(todayDate);
    const [historySlots, setHistorySlots] = useState([]);
    const [selectedHistorySlotIso, setSelectedHistorySlotIso] = useState('');
    const [loadingHistorySlots, setLoadingHistorySlots] = useState(false);

    const [slotStartIso, setSlotStartIso] = useState('');
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showPlayerHistoryModal, setShowPlayerHistoryModal] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [playerHistoryData, setPlayerHistoryData] = useState(null);
    const [loadingPlayerHistory, setLoadingPlayerHistory] = useState(false);
    const [playerHistoryError, setPlayerHistoryError] = useState('');

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

    const fetchLiveSlotPlayers = useCallback(async () => {
        setLoading(true);
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
                return;
            }

            const playersRes = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/slots/${encodeURIComponent(iso)}/players`);
            if (playersRes.status === 401) return;
            const playersJson = await playersRes.json();
            if (!playersJson?.success) throw new Error(playersJson?.message || 'Failed to load current slot players');
            setPlayers(Array.isArray(playersJson?.data?.players) ? playersJson.data.players : []);
        } catch (err) {
            setPlayers([]);
            setError(err?.message || 'Failed to load current slot players');
        } finally {
            setLoading(false);
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

            const raw = Array.isArray(json?.data?.slots) ? json.data.slots : [];
            const slots = raw.filter(LIVE_OR_ADVANCE);

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

    const fetchPlayersForSlotIso = useCallback(async (iso) => {
        if (!iso) {
            setSlotStartIso('');
            setPlayers([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError('');
        try {
            const playersRes = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/slots/${encodeURIComponent(iso)}/players`);
            if (playersRes.status === 401) return;
            const playersJson = await playersRes.json();
            if (!playersJson?.success) throw new Error(playersJson?.message || 'Failed to load slot players');
            const meta = playersJson?.data?.slot;
            setSlotStartIso(meta?.slotStartIso || iso);
            setPlayers(Array.isArray(playersJson?.data?.players) ? playersJson.data.players : []);
        } catch (err) {
            setPlayers([]);
            setError(err?.message || 'Failed to load slot players');
        } finally {
            setLoading(false);
        }
    }, []);

    const refresh = useCallback(async () => {
        if (viewMode === 'live') {
            await fetchLiveSlotPlayers();
            return;
        }
        const prevIso = selectedSlotIsoRef.current;
        const chosen = await fetchDaySlotSchedule(historyDate);
        if (chosen && chosen === prevIso) {
            await fetchPlayersForSlotIso(chosen);
        }
    }, [viewMode, historyDate, fetchLiveSlotPlayers, fetchDaySlotSchedule, fetchPlayersForSlotIso]);

    useEffect(() => {
        if (viewMode === 'live') {
            fetchLiveSlotPlayers();
        }
    }, [viewMode, fetchLiveSlotPlayers]);

    useEffect(() => {
        if (viewMode === 'bySlot') {
            fetchDaySlotSchedule(historyDate);
        }
    }, [viewMode, historyDate, fetchDaySlotSchedule]);

    useEffect(() => {
        if (viewMode !== 'bySlot') return;
        if (!selectedHistorySlotIso) {
            setSlotStartIso('');
            setPlayers([]);
            setLoading(false);
            return;
        }
        fetchPlayersForSlotIso(selectedHistorySlotIso);
    }, [viewMode, selectedHistorySlotIso, fetchPlayersForSlotIso]);

    const fetchPlayerHistory = useCallback(async (userId) => {
        if (!userId) return;
        setLoadingPlayerHistory(true);
        setPlayerHistoryError('');
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/players/${encodeURIComponent(userId)}/history?limit=100`);
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

    const selectedSlotMeta = useMemo(
        () => historySlots.find((s) => s.slotStartIso === selectedHistorySlotIso) || null,
        [historySlots, selectedHistorySlotIso],
    );

    return (
        <AdminLayout onLogout={handleLogout} title="2D Current Slot Players">
            <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">2D Current Slot Players</h1>
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
                        Calendar day is IST (Asia/Kolkata). Only the running draw and advance draws are listed — pick one to see who has bet.
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
                            <label className="flex flex-col gap-1 text-sm">
                                <span className="text-gray-600 font-medium">Date (IST day)</span>
                                <input
                                    type="date"
                                    value={historyDate}
                                    max={todayDate()}
                                    onChange={(e) => setHistoryDate(e.target.value)}
                                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                                />
                            </label>
                            <label className="flex flex-col gap-1 text-sm min-w-[220px] flex-1">
                                <span className="text-gray-600 font-medium">Draw (slot end time)</span>
                                <select
                                    value={selectedHistorySlotIso}
                                    onChange={(e) => setSelectedHistorySlotIso(e.target.value)}
                                    disabled={loadingHistorySlots || !historySlots.length}
                                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-full max-w-md"
                                >
                                    {!historySlots.length && !loadingHistorySlots ? (
                                        <option value="">No live or advance draws for this IST day</option>
                                    ) : null}
                                    {historySlots.map((s) => (
                                        <option key={s.slotStartIso} value={s.slotStartIso}>
                                            {slotScheduleLabel(s)}
                                        </option>
                                    ))}
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
                                {selectedSlotMeta.status === 'upcoming'
                                    ? 'Advance draw (bets already placed for this future slot)'
                                    : 'Current running slot'}
                            </span>
                        </p>
                    ) : null}
                </div>

                {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div> : null}

                <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <h3 className="text-lg font-semibold text-gray-800">Current Slot Playing Players</h3>
                        {loading ? <span className="text-xs text-gray-500">Loading...</span> : null}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-500 border-b border-gray-200">
                                    <th className="py-2 pr-3">Player</th>
                                    <th className="py-2 pr-3 text-right">Total Bets (This Slot)</th>
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
                                {players.map((player) => (
                                    <tr key={`current-${player.userId}`} className="border-b border-gray-100">
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
                </div>
            </div>

            {showPlayerHistoryModal && (
                <div className="fixed inset-0 z-[95] flex items-center justify-center p-3 bg-black/40">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-[96vw] h-[92vh] overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-blue-700">
                                    Player 2D Bet History - {playerHistoryData?.player?.username || selectedPlayer?.username || 'Player'}
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

export default TwoDCurrentSlotPlayers;

