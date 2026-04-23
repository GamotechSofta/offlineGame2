import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import useModalBackHandler from '../hooks/useModalBackHandler';
import { clearAdminSession, fetchWithAuth } from '../lib/auth';
import OldSlotsSection from '../components/twoDManagement/OldSlotsSection';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const todayDate = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const TwoDOldSlotsStats = () => {
    const navigate = useNavigate();
    const [date, setDate] = useState(todayDate());
    const [historySlots, setHistorySlots] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState('');
    const [detailData, setDetailData] = useState(null);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [activeSection, setActiveSection] = useState('oldSlots');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [historyPlayersMap, setHistoryPlayersMap] = useState({});
    const [loadingAllHistoryPlayers, setLoadingAllHistoryPlayers] = useState(false);
    const [showPlayerHistoryModal, setShowPlayerHistoryModal] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [playerHistoryData, setPlayerHistoryData] = useState(null);
    const [loadingPlayerHistory, setLoadingPlayerHistory] = useState(false);
    const [playerHistoryError, setPlayerHistoryError] = useState('');
    const detailSectionRef = useRef(null);
    const timeDropdownRef = useRef(null);
    const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);
    const [playerBetsAggregateAllSlots, setPlayerBetsAggregateAllSlots] = useState(true);

    const closePlayerHistoryModal = useModalBackHandler(showPlayerHistoryModal, () => {
        setShowPlayerHistoryModal(false);
        setSelectedPlayer(null);
        setPlayerHistoryData(null);
        setPlayerHistoryError('');
    });

    const handleLogout = useCallback(() => {
        clearAdminSession();
        navigate('/');
    }, [navigate]);

    const fetchHistory = useCallback(async (targetDate) => {
        setLoadingHistory(true);
        try {
            const params = new URLSearchParams({ date: targetDate, limit: '40' });
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/slots?${params.toString()}`);
            if (res.status === 401) return;
            const data = await res.json();
            if (!data?.success) throw new Error(data?.message || 'Failed to load slot history');
            const slots = data?.data?.slots || [];
            setHistorySlots(slots);
            if (slots.length) {
                setSelectedSlot((prev) => (prev && slots.some((slot) => slot.slotStartIso === prev) ? prev : slots[0].slotStartIso));
            } else {
                setSelectedSlot('');
                setDetailData(null);
            }
        } catch (err) {
            setError(err.message || 'Failed to load history');
        } finally {
            setLoadingHistory(false);
        }
    }, []);

    const fetchDetail = useCallback(async (slotStartIso) => {
        if (!slotStartIso) return;
        setLoadingDetail(true);
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/slots/${encodeURIComponent(slotStartIso)}/detail`);
            if (res.status === 401) return;
            const data = await res.json();
            if (!data?.success) throw new Error(data?.message || 'Failed to load slot detail');
            setDetailData(data.data);
        } catch (err) {
            setError(err.message || 'Failed to load slot detail');
        } finally {
            setLoadingDetail(false);
        }
    }, []);

    const fetchAllHistoryPlayers = useCallback(async (slots) => {
        const list = Array.isArray(slots) ? slots : [];
        if (!list.length) {
            setHistoryPlayersMap({});
            return;
        }
        setLoadingAllHistoryPlayers(true);
        try {
            const settled = await Promise.allSettled(
                list.map(async (slot) => {
                    const slotStartIso = slot?.slotStartIso;
                    if (!slotStartIso) return [null, []];
                    const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/slots/${encodeURIComponent(slotStartIso)}/players`);
                    if (res.status === 401) return [slotStartIso, []];
                    const data = await res.json();
                    if (!data?.success) return [slotStartIso, []];
                    return [slotStartIso, Array.isArray(data?.data?.players) ? data.data.players : []];
                }),
            );
            const next = {};
            settled.forEach((entry) => {
                if (entry.status !== 'fulfilled') return;
                const [k, v] = entry.value || [];
                if (k) next[k] = v;
            });
            setHistoryPlayersMap(next);
        } catch {
            setHistoryPlayersMap({});
        } finally {
            setLoadingAllHistoryPlayers(false);
        }
    }, []);

    const fetchPlayerHistory = useCallback(async (userId) => {
        if (!userId) return;
        setLoadingPlayerHistory(true);
        setPlayerHistoryError('');
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/players/${encodeURIComponent(userId)}/history?limit=40`);
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

    useEffect(() => {
        fetchHistory(date);
    }, [date, fetchHistory]);

    useEffect(() => {
        if (selectedSlot) fetchDetail(selectedSlot);
    }, [selectedSlot, fetchDetail]);

    useEffect(() => {
        fetchAllHistoryPlayers(historySlots);
    }, [historySlots, fetchAllHistoryPlayers]);

    useEffect(() => {
        setPlayerBetsAggregateAllSlots(true);
    }, [date]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (timeDropdownRef.current && !timeDropdownRef.current.contains(event.target)) {
                setIsTimeDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectSlot = async (slotStartIso) => {
        setSelectedSlot(slotStartIso);
        setNotice('');
        setError('');
        await fetchDetail(slotStartIso);
        setActiveSection('quizStats');
        setNotice('Slot detail loaded. Scroll below for quiz-wise view.');
        if (detailSectionRef.current) {
            detailSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const selectedSlotMeta = historySlots.find((slot) => slot.slotStartIso === selectedSlot) || null;

    const slotsForPlayerBetsMerge = useMemo(() => {
        if (!historySlots.length) return [];
        if (playerBetsAggregateAllSlots) return historySlots;
        if (!selectedSlot) return historySlots;
        return historySlots.filter((s) => s.slotStartIso === selectedSlot);
    }, [historySlots, selectedSlot, playerBetsAggregateAllSlots]);

    const slotPlayerListRows = useMemo(() => {
        const merged = new Map();
        slotsForPlayerBetsMerge.forEach((slot) => {
            const players = Array.isArray(historyPlayersMap[slot.slotStartIso]) ? historyPlayersMap[slot.slotStartIso] : [];
            players.forEach((player) => {
                const userId = String(player?.userId || '').trim();
                if (!userId) return;
                const existing = merged.get(userId) || {
                    userId,
                    username: player?.username || 'unknown',
                    phone: player?.phone || '',
                    slotCount: 0,
                    betCount: 0,
                };
                existing.slotCount += 1;
                existing.betCount += Number(player?.betCount ?? 0);
                if (!existing.phone && player?.phone) existing.phone = player.phone;
                if ((existing.username === 'unknown' || !existing.username) && player?.username) existing.username = player.username;
                merged.set(userId, existing);
            });
        });
        return Array.from(merged.values()).sort((a, b) => b.slotCount - a.slotCount || b.betCount - a.betCount || a.userId.localeCompare(b.userId));
    }, [historyPlayersMap, slotsForPlayerBetsMerge]);

    const handleOpenPlayerHistory = async (player) => {
        if (!player?.userId) return;
        setSelectedPlayer(player);
        setShowPlayerHistoryModal(true);
        await fetchPlayerHistory(player.userId);
    };

    return (
        <AdminLayout onLogout={handleLogout} title="2D Old Slots Stats">
            <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">2D Old Slots Stats</h1>
                        <p className="text-sm text-gray-500">Old Slots, Quiz-wise Slot Stats and Slot Player Bets.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => fetchHistory(date)}
                        className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                    >
                        Refresh
                    </button>
                </div>

                {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div> : null}
                {notice ? <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">{notice}</div> : null}

                <OldSlotsSection
                    activeSection={activeSection}
                    setActiveSection={setActiveSection}
                    date={date}
                    setDate={setDate}
                    setNotice={setNotice}
                    setError={setError}
                    isTimeDropdownOpen={isTimeDropdownOpen}
                    setIsTimeDropdownOpen={setIsTimeDropdownOpen}
                    timeDropdownRef={timeDropdownRef}
                    historySlots={historySlots}
                    selectedSlot={selectedSlot}
                    setSelectedSlot={setSelectedSlot}
                    selectedSlotMeta={selectedSlotMeta}
                    handleSelectSlot={handleSelectSlot}
                    loadingHistory={loadingHistory}
                    detailSectionRef={detailSectionRef}
                    loadingDetail={loadingDetail}
                    detailData={detailData}
                    playerBetsAggregateAllSlots={playerBetsAggregateAllSlots}
                    setPlayerBetsAggregateAllSlots={setPlayerBetsAggregateAllSlots}
                    loadingAllHistoryPlayers={loadingAllHistoryPlayers}
                    slotPlayerListRows={slotPlayerListRows}
                    handleOpenPlayerHistory={handleOpenPlayerHistory}
                />
            </div>

            {showPlayerHistoryModal && (
                <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/40">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-5xl max-h-[88vh] overflow-hidden">
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
                        <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(88vh-64px)]">
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

export default TwoDOldSlotsStats;

