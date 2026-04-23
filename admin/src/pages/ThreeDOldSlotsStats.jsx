import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import useModalBackHandler from '../hooks/useModalBackHandler';
import { clearAdminSession, fetchWithAuth } from '../lib/auth';
import OldSlotsSection from '../components/threeDManagement/OldSlotsSection';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const todayDate = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const ThreeDOldSlotsStats = () => {
    const navigate = useNavigate();
    const [date, setDate] = useState(todayDate());
    const [historySlots, setHistorySlots] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState('');
    const [activeSection, setActiveSection] = useState('oldSlots');
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [historyDetailsMap, setHistoryDetailsMap] = useState({});
    const [historyPlayersMap, setHistoryPlayersMap] = useState({});
    const [loadingAllHistoryDetails, setLoadingAllHistoryDetails] = useState(false);
    const [loadingAllHistoryPlayers, setLoadingAllHistoryPlayers] = useState(false);
    const [showPlayerHistoryModal, setShowPlayerHistoryModal] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [playerHistoryData, setPlayerHistoryData] = useState(null);
    const [loadingPlayerHistory, setLoadingPlayerHistory] = useState(false);
    const [playerHistoryError, setPlayerHistoryError] = useState('');
    const detailSectionRef = useRef(null);
    const timeDropdownRef = useRef(null);
    const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);

    const getThreeDQuizLabel = useCallback((quizId) => {
        const map = { 1: 'Set A', 2: 'Set B', 3: 'Set C' };
        return map[Number(quizId)] || `Q${String(quizId).padStart(2, '0')}`;
    }, []);

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
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/slots?${params.toString()}`);
            if (res.status === 401) return;
            const data = await res.json();
            if (!data?.success) throw new Error(data?.message || 'Failed to load slot history');
            const slots = Array.isArray(data?.data?.slots) ? data.data.slots : [];
            setHistorySlots(slots);
            if (slots.length) {
                setSelectedSlot((prev) => (prev && slots.some((slot) => slot.slotStartIso === prev) ? prev : slots[0].slotStartIso));
            } else {
                setSelectedSlot('');
            }
        } catch (err) {
            setError(err.message || 'Failed to load history');
            setHistorySlots([]);
            setSelectedSlot('');
        } finally {
            setLoadingHistory(false);
        }
    }, []);

    const fetchAllHistoryDetails = useCallback(async (slots) => {
        const list = Array.isArray(slots) ? slots : [];
        if (!list.length) {
            setHistoryDetailsMap({});
            return;
        }
        setLoadingAllHistoryDetails(true);
        try {
            const settled = await Promise.allSettled(
                list.map(async (slot) => {
                    const slotStartIso = slot?.slotStartIso;
                    if (!slotStartIso) return [null, null];
                    const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/slots/${encodeURIComponent(slotStartIso)}/detail`);
                    if (res.status === 401) return [slotStartIso, null];
                    const data = await res.json();
                    if (!data?.success) return [slotStartIso, null];
                    return [slotStartIso, data.data || null];
                }),
            );
            const next = {};
            settled.forEach((entry) => {
                if (entry.status !== 'fulfilled') return;
                const [k, v] = entry.value || [];
                if (k) next[k] = v;
            });
            setHistoryDetailsMap(next);
        } catch {
            setHistoryDetailsMap({});
        } finally {
            setLoadingAllHistoryDetails(false);
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
                    const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/slots/${encodeURIComponent(slotStartIso)}/players`);
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
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/players/${encodeURIComponent(userId)}/history?limit=40`);
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
        fetchAllHistoryDetails(historySlots);
        fetchAllHistoryPlayers(historySlots);
    }, [historySlots, fetchAllHistoryDetails, fetchAllHistoryPlayers]);

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
        setActiveSection('quizStats');
        setNotice('Slot detail loaded. Scroll below for set-wise view.');
        if (detailSectionRef.current) {
            detailSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const handleOpenPlayerHistory = async (player) => {
        if (!player?.userId) return;
        setSelectedPlayer(player);
        setShowPlayerHistoryModal(true);
        await fetchPlayerHistory(player.userId);
    };

    const selectedSlotMeta = historySlots.find((slot) => slot.slotStartIso === selectedSlot) || null;
    const slotPlayerListRows = useMemo(() => {
        const merged = new Map();
        historySlots.forEach((slot) => {
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
    }, [historyPlayersMap, historySlots]);

    return (
        <AdminLayout onLogout={handleLogout} title="3D Old Slots Stats">
            <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">3D Old Slots Stats</h1>
                        <p className="text-sm text-gray-500">Old Slots, Set-wise Slot Stats and Slot Player Bets.</p>
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
                    loadingAllHistoryDetails={loadingAllHistoryDetails}
                    historyDetailsMap={historyDetailsMap}
                    getThreeDQuizLabel={getThreeDQuizLabel}
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
                                    Player 3D Bet History - {playerHistoryData?.player?.username || selectedPlayer?.username || 'Player'}
                                </h3>
                                {playerHistoryData?.player?.phone ? (
                                    <p className="text-xs text-gray-500">{playerHistoryData.player.phone}</p>
                                ) : null}
                            </div>
                            <button type="button" onClick={closePlayerHistoryModal} className="text-gray-400 hover:text-gray-800 p-1">x</button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default ThreeDOldSlotsStats;

