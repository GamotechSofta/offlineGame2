import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import DateRangePresetFilter from '../components/DateRangePresetFilter';
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

const listDateKeysBetween = (from, to) => {
    if (!from || !to || from > to) return [];
    const out = [];
    const start = new Date(`${from}T12:00:00`);
    const end = new Date(`${to}T12:00:00`);
    for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
        out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    return out;
};

const ThreeDOldSlotsStats = () => {
    const navigate = useNavigate();
    const [dateFrom, setDateFrom] = useState(todayDate());
    const [dateTo, setDateTo] = useState(todayDate());
    const [historySlots, setHistorySlots] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState('');
    const [activeSection, setActiveSection] = useState('oldSlots');
    const [loadingHistory, setLoadingHistory] = useState(true);
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

    const fetchHistory = useCallback(async (fromDate, toDate) => {
        setLoadingHistory(true);
        try {
            const days = listDateKeysBetween(fromDate, toDate);
            const settled = await Promise.allSettled(days.map(async (d) => {
                const params = new URLSearchParams({ date: d, limit: '96' });
                const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/slots?${params.toString()}`);
                if (res.status === 401) return [];
                const data = await res.json();
                if (!data?.success) return [];
                return Array.isArray(data?.data?.slots) ? data.data.slots : [];
            }));
            const mergedSlots = settled.flatMap((entry) => (entry.status === 'fulfilled' ? entry.value : []));
            const uniqueMap = new Map();
            mergedSlots.forEach((slot) => {
                const key = String(slot?.slotStartIso || '');
                if (key) uniqueMap.set(key, slot);
            });
            const slots = Array.from(uniqueMap.values())
                .sort((a, b) => new Date(b.slotStartIso).getTime() - new Date(a.slotStartIso).getTime());
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

    useEffect(() => {
        fetchHistory(dateFrom, dateTo);
    }, [dateFrom, dateTo, fetchHistory]);

    const playerFetchSlots = useMemo(() => {
        if (activeSection !== 'playerHistory') return [];
        const slotsWithBets = historySlots.filter((slot) => Number(slot?.totalTickets || 0) > 0);
        if (slotsWithBets.length) return slotsWithBets.slice(0, 48);
        // fallback: if summaries are zero/missing, still try recent slots
        return historySlots.slice(0, 24);
    }, [activeSection, historySlots]);

    useEffect(() => {
        fetchAllHistoryPlayers(playerFetchSlots);
    }, [playerFetchSlots, fetchAllHistoryPlayers]);


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
        setActiveSection('oldSlots');
        setNotice('Slot selected.');
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

    const playerHistoryBetRows = useMemo(() => {
        const slots = Array.isArray(playerHistoryData?.slots) ? playerHistoryData.slots : [];
        const rows = [];
        slots.forEach((slot) => {
            const draw = slot?.drawLabelEnd || slot?.slotStartIso || '-';
            const drawDate = slot?.slotStartIso
                ? new Date(slot.slotStartIso).toLocaleDateString('en-GB')
                : '-';
            const bets = Array.isArray(slot?.bets) ? slot.bets : [];
            bets.forEach((bet) => {
                rows.push({
                    ...bet,
                    drawDate,
                    drawLabelEnd: draw,
                });
            });
        });
        return rows;
    }, [playerHistoryData]);

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
                        onClick={() => fetchHistory(dateFrom, dateTo)}
                        className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                    >
                        Refresh
                    </button>
                </div>

                {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div> : null}
                {notice ? <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">{notice}</div> : null}
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <DateRangePresetFilter
                        dateFrom={dateFrom}
                        dateTo={dateTo}
                        setDateFrom={setDateFrom}
                        setDateTo={setDateTo}
                    />
                </div>

                <OldSlotsSection
                    activeSection={activeSection}
                    setActiveSection={setActiveSection}
                    date={dateFrom}
                    setDate={(d) => {
                        setDateFrom(d);
                        setDateTo(d);
                    }}
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
                    getThreeDQuizLabel={getThreeDQuizLabel}
                    loadingAllHistoryPlayers={loadingAllHistoryPlayers}
                    slotPlayerListRows={slotPlayerListRows}
                    handleOpenPlayerHistory={handleOpenPlayerHistory}
                />
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
                                                        <td className="px-3 py-2 whitespace-nowrap">{bet.drawLabelEnd}</td>
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

export default ThreeDOldSlotsStats;

