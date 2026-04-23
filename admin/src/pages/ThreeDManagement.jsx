import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import useModalBackHandler from '../hooks/useModalBackHandler';
import { clearAdminSession, fetchWithAuth } from '../lib/auth';
import CurrentSlotOverview from '../components/twoDManagement/CurrentSlotOverview';
import OldSlotsSection from '../components/threeDManagement/OldSlotsSection';

const ThreeDManagement = () => {
    const navigate = useNavigate();
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

    const todayDate = () => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const [date, setDate] = useState(todayDate());
    const [currentSlotData, setCurrentSlotData] = useState(null);
    const [historySlots, setHistorySlots] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState('');
    const [detailData, setDetailData] = useState(null);
    const [loadingCurrent, setLoadingCurrent] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [savingResult, setSavingResult] = useState(false);
    const [activeSection, setActiveSection] = useState('oldSlots');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [hasSecretDeclarePassword, setHasSecretDeclarePassword] = useState(false);
    const [currentHintRows, setCurrentHintRows] = useState([]);
    const [hintPassword, setHintPassword] = useState('');
    const [hintError, setHintError] = useState('');
    const [loadingHints, setLoadingHints] = useState(false);
    const [hintUnlocked, setHintUnlocked] = useState(false);
    const [unlockedHintPassword, setUnlockedHintPassword] = useState('');
    const [adminRole, setAdminRole] = useState('');
    const [showEditHintModal, setShowEditHintModal] = useState(false);
    const [editHintForm, setEditHintForm] = useState({ quizId: '', result: '' });
    const [editHintError, setEditHintError] = useState('');
    const [slotPlayers, setSlotPlayers] = useState([]);
    const [loadingSlotPlayers, setLoadingSlotPlayers] = useState(false);
    const [showPlayerHistoryModal, setShowPlayerHistoryModal] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [playerHistoryData, setPlayerHistoryData] = useState(null);
    const [loadingPlayerHistory, setLoadingPlayerHistory] = useState(false);
    const [playerHistoryError, setPlayerHistoryError] = useState('');
    const [historyDetailsMap, setHistoryDetailsMap] = useState({});
    const [historyPlayersMap, setHistoryPlayersMap] = useState({});
    const [loadingAllHistoryDetails, setLoadingAllHistoryDetails] = useState(false);
    const [loadingAllHistoryPlayers, setLoadingAllHistoryPlayers] = useState(false);
    const [timingForm, setTimingForm] = useState({ studyMinutes: '14.5', questionRevealStaggerMs: '810' });
    const [loadingTiming, setLoadingTiming] = useState(false);
    const [savingTiming, setSavingTiming] = useState(false);
    const [timingError, setTimingError] = useState('');
    const [timingPassword, setTimingPassword] = useState('');
    const [timingUnlocked, setTimingUnlocked] = useState(false);
    const [timingUnlockedSecret, setTimingUnlockedSecret] = useState('');
    const detailSectionRef = useRef(null);
    const timeDropdownRef = useRef(null);
    const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);
    const getThreeDQuizLabel = useCallback((quizId) => {
        const map = { 1: 'Set A', 2: 'Set B', 3: 'Set C' };
        return map[Number(quizId)] || `Q${String(quizId).padStart(2, '0')}`;
    }, []);
    const closeEditHintModal = useModalBackHandler(showEditHintModal, () => {
        setShowEditHintModal(false);
        setEditHintForm({ quizId: '', result: '' });
        setEditHintError('');
    });
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

    const fetchCurrent = useCallback(async () => {
        setLoadingCurrent(true);
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/current-slot`);
            if (res.status === 401) return;
            const data = await res.json();
            if (!data?.success) throw new Error(data?.message || 'Failed to load current slot');
            setCurrentSlotData(data.data);
        } catch (err) {
            setError(err.message || 'Failed to load current slot');
        } finally {
            setLoadingCurrent(false);
        }
    }, [API_BASE_URL]);


    const fetchTimingSettings = useCallback(async (secretDeclarePasswordValue = '') => {
        setLoadingTiming(true);
        setTimingError('');
        try {
            const params = new URLSearchParams();
            if (secretDeclarePasswordValue) params.set('secretDeclarePassword', secretDeclarePasswordValue);
            const q = params.toString() ? `?${params.toString()}` : '';
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/quiz-settings/3d${q}`);
            if (res.status === 401) return;
            const data = await res.json();
            if (!data?.success) {
                if (data?.code === 'INVALID_SECRET_DECLARE_PASSWORD') {
                    setHasSecretDeclarePassword(true);
                    setTimingUnlocked(false);
                    setTimingUnlockedSecret('');
                    setTimingError(data?.message || 'Invalid secret password');
                    return;
                }
                throw new Error(data?.message || 'Failed to load timing settings');
            }
            setTimingForm({
                studyMinutes: String(data.data.studyMinutes ?? '14.5'),
                questionRevealStaggerMs: String(data.data.questionRevealStaggerMs ?? '810'),
            });
            setTimingUnlocked(true);
            setTimingUnlockedSecret(secretDeclarePasswordValue || '');
            setTimingPassword('');
        } catch (err) {
            setTimingError(err.message || 'Failed to load timing settings');
        } finally {
            setLoadingTiming(false);
        }
    }, [API_BASE_URL]);

    const fetchCurrentHints = useCallback(async (secretDeclarePasswordValue = '') => {
        setLoadingHints(true);
        setHintError('');
        try {
            const body = secretDeclarePasswordValue ? { secretDeclarePassword: secretDeclarePasswordValue } : {};
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/current-slot/hints`, {
                method: 'POST',
                body: JSON.stringify(body),
            });
            if (res.status === 401) return;
            const data = await res.json();
            if (!data?.success) {
                if (data?.code === 'INVALID_SECRET_DECLARE_PASSWORD') {
                    // If status endpoint is restricted, infer that a secret password is enabled.
                    setHasSecretDeclarePassword(true);
                    setHintError(data.message || 'Invalid secret password');
                    setHintUnlocked(false);
                    setCurrentHintRows([]);
                    setUnlockedHintPassword('');
                    return;
                }
                throw new Error(data?.message || 'Failed to load current slot hints');
            }

            const rows = Array.isArray(data?.data?.perQuiz)
                ? data.data.perQuiz
                    .filter((row) => [1, 2, 3].includes(Number(row.quizId)))
                    .map((row) => ({
                    quizId: row.quizId,
                    hint: row.result == null ? '--' : String(row.result).padStart(3, '0'),
                    }))
                : [];

            setCurrentHintRows(rows);
            setHintUnlocked(true);
            setUnlockedHintPassword(secretDeclarePasswordValue || '');
            setHintPassword('');
        } catch (err) {
            setHintError(err.message || 'Failed to load current slot hints');
            setHintUnlocked(false);
            setCurrentHintRows([]);
            setUnlockedHintPassword('');
        } finally {
            setLoadingHints(false);
        }
    }, [API_BASE_URL]);

    const fetchHistory = useCallback(async (targetDate) => {
        setLoadingHistory(true);
        try {
            const params = new URLSearchParams({ date: targetDate, limit: '40' });
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/slots?${params.toString()}`);
            if (res.status === 401) return;
            const data = await res.json();
            if (!data?.success) throw new Error(data?.message || 'Failed to load slot history');
            let slots = data?.data?.slots || [];
            // If today's history has no completed slots yet (common around midnight), auto-fallback to previous day.
            if (!slots.length && targetDate === todayDate()) {
                const d = new Date(`${targetDate}T12:00:00`);
                d.setDate(d.getDate() - 1);
                const prevDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                const prevParams = new URLSearchParams({ date: prevDate, limit: '40' });
                const prevRes = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/slots?${prevParams.toString()}`);
                if (prevRes.status !== 401) {
                    const prevData = await prevRes.json();
                    if (prevData?.success) {
                        const prevSlots = prevData?.data?.slots || [];
                        if (prevSlots.length) {
                            slots = prevSlots;
                            setDate(prevDate);
                            setNotice(`No completed slots for ${targetDate}. Showing last available history (${prevDate}).`);
                        }
                    }
                }
            }
            setHistorySlots(slots);
            if (slots.length) {
                setSelectedSlot((prev) => {
                    if (prev && slots.some((slot) => slot.slotStartIso === prev)) {
                        return prev;
                    }
                    return slots[0].slotStartIso;
                });
            } else {
                setSelectedSlot('');
                setDetailData(null);
            }
        } catch (err) {
            setError(err.message || 'Failed to load history');
        } finally {
            setLoadingHistory(false);
        }
    }, [API_BASE_URL]);

    const fetchDetail = useCallback(async (slotStartIso) => {
        if (!slotStartIso) return;
        setLoadingDetail(true);
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/slots/${encodeURIComponent(slotStartIso)}/detail`);
            if (res.status === 401) return;
            const data = await res.json();
            if (!data?.success) throw new Error(data?.message || 'Failed to load slot detail');
            setDetailData(data.data);
        } catch (err) {
            setError(err.message || 'Failed to load slot detail');
        } finally {
            setLoadingDetail(false);
        }
    }, [API_BASE_URL]);

    const fetchSlotPlayers = useCallback(async (slotStartIso) => {
        if (!slotStartIso) return;
        setLoadingSlotPlayers(true);
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/slots/${encodeURIComponent(slotStartIso)}/players`);
            if (res.status === 401) return;
            const data = await res.json();
            if (!data?.success) throw new Error(data?.message || 'Failed to load slot players');
            const rows = Array.isArray(data?.data?.players) ? data.data.players : [];
            setSlotPlayers(rows);
        } catch (err) {
            setError(err.message || 'Failed to load slot players');
            setSlotPlayers([]);
        } finally {
            setLoadingSlotPlayers(false);
        }
    }, [API_BASE_URL]);

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
    }, [API_BASE_URL]);

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
    }, [API_BASE_URL]);

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
    }, [API_BASE_URL]);

    useEffect(() => {
        const admin = localStorage.getItem('admin');
        if (!admin) {
            navigate('/');
            return;
        }
        try {
            const parsedAdmin = JSON.parse(admin);
            setAdminRole(parsedAdmin?.role || '');
        } catch {
            setAdminRole('');
        }
        fetchWithAuth(`${API_BASE_URL}/admin/me/secret-declare-password-status`)
            .then((res) => {
                if (res.status === 401) return null;
                // Non-super-admin may get 403; treat as "secret password enabled" to show unlock prompt.
                if (res.status === 403) {
                    setHasSecretDeclarePassword(true);
                    return null;
                }
                return res.json();
            })
            .then((json) => {
                if (json?.success) setHasSecretDeclarePassword(json.hasSecretDeclarePassword || false);
            })
            .catch(() => setHasSecretDeclarePassword(false));
        fetchCurrent();
    }, [API_BASE_URL, fetchCurrent, fetchTimingSettings, navigate]);

    useEffect(() => {
        if (hasSecretDeclarePassword) {
            setTimingUnlocked(false);
            setTimingUnlockedSecret('');
            return;
        }
        fetchTimingSettings('');
    }, [hasSecretDeclarePassword, fetchTimingSettings]);

    const saveTimingSettings = async () => {
        setSavingTiming(true);
        setTimingError('');
        try {
            const studyMinutes = Number(timingForm.studyMinutes);
            const questionRevealStaggerMs = Number(timingForm.questionRevealStaggerMs);
            if (!Number.isFinite(studyMinutes) || studyMinutes <= 0 || studyMinutes >= 15) {
                throw new Error('Study minutes must be between 0 and 15.');
            }
            if (!Number.isFinite(questionRevealStaggerMs) || questionRevealStaggerMs < 100) {
                throw new Error('Question loading delay must be at least 100 ms.');
            }
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/quiz-settings/3d`, {
                method: 'PATCH',
                body: JSON.stringify({
                    studyMinutes,
                    questionRevealStaggerMs,
                    secretDeclarePassword: timingUnlockedSecret,
                }),
            });
            if (res.status === 401) return;
            const data = await res.json();
            if (!data?.success) {
                if (data?.code === 'INVALID_SECRET_DECLARE_PASSWORD') {
                    setTimingUnlocked(false);
                    setTimingUnlockedSecret('');
                }
                throw new Error(data?.message || 'Failed to update timing settings');
            }
            setNotice('3D quiz timing settings updated successfully.');
            await fetchTimingSettings(timingUnlockedSecret);
        } catch (err) {
            setTimingError(err.message || 'Failed to update timing settings');
        } finally {
            setSavingTiming(false);
        }
    };

    const unlockTimingSettings = async () => {
        if (hasSecretDeclarePassword && !timingPassword.trim()) {
            setTimingError('Please enter the secret declare password');
            return;
        }
        await fetchTimingSettings(timingPassword.trim());
    };

    useEffect(() => {
        fetchHistory(date);
    }, [date, fetchHistory]);

    useEffect(() => {
        if (selectedSlot) fetchDetail(selectedSlot);
    }, [selectedSlot, fetchDetail]);

    useEffect(() => {
        if (!selectedSlot) {
            setSlotPlayers([]);
            return;
        }
        fetchSlotPlayers(selectedSlot);
    }, [selectedSlot, fetchSlotPlayers]);

    useEffect(() => {
        fetchAllHistoryDetails(historySlots);
        fetchAllHistoryPlayers(historySlots);
    }, [historySlots, fetchAllHistoryDetails, fetchAllHistoryPlayers]);

    useEffect(() => {
        setCurrentHintRows([]);
        setHintPassword('');
        setHintError('');
        setHintUnlocked(false);
        setUnlockedHintPassword('');
    }, [currentSlotData?.slot?.slotStartIso]);

    useEffect(() => {
        if (currentSlotData?.slot?.slotStartIso && !hasSecretDeclarePassword) {
            fetchCurrentHints('');
        }
    }, [currentSlotData?.slot?.slotStartIso, hasSecretDeclarePassword, fetchCurrentHints]);

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
        setNotice('Slot detail loaded. Scroll below for set-wise view/edit.');
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

    const handleUnlockHints = async () => {
        if (hasSecretDeclarePassword && !hintPassword.trim()) {
            setHintError('Please enter the secret declare password');
            return;
        }
        await fetchCurrentHints(hintPassword.trim());
    };

    const handleLockHints = () => {
        setCurrentHintRows([]);
        setHintPassword('');
        setHintError('');
        setHintUnlocked(false);
        setUnlockedHintPassword('');
    };

    const handleEditCurrentHint = async (quizId, currentHint) => {
        if (adminRole !== 'super_admin') {
            setError('Only super admin can edit running slot hint numbers.');
            return;
        }
        if (!currentSlotData?.slot?.slotStartIso) {
            setError('Current slot is not available.');
            return;
        }
        setNotice('');
        setError('');
        setEditHintError('');
        setEditHintForm({
            quizId: String(quizId),
            result: currentHint === '--' ? '' : currentHint,
        });
        setShowEditHintModal(true);
    };

    const submitEditCurrentHint = async (e) => {
        e.preventDefault();
        const quizId = Number(editHintForm.quizId);
        const trimmed = editHintForm.result.trim();
        const result = Number(trimmed);

        if (!/^\d{1,3}$/.test(trimmed) || !Number.isInteger(result) || result < 0 || result > 999) {
            setEditHintError('Result must be between 000 and 999.');
            return;
        }
        if (![1, 2, 3].includes(quizId)) {
            setEditHintError('Only Set A / Set B / Set C are editable in 3D.');
            return;
        }
        if (!currentSlotData?.slot?.slotStartIso) {
            setEditHintError('Current slot is not available.');
            return;
        }

        setSavingResult(true);
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/slots/${encodeURIComponent(currentSlotData.slot.slotStartIso)}/result`, {
                method: 'PATCH',
                body: JSON.stringify({ quizId, result }),
            });
            if (res.status === 401) return;
            const data = await res.json();
            if (!data?.success) throw new Error(data?.message || 'Failed to update result');
            setNotice(`Running slot ${getThreeDQuizLabel(quizId)} hint updated to ${String(result).padStart(3, '0')}.`);
            closeEditHintModal();
            await fetchCurrent();
            if (hintUnlocked || !hasSecretDeclarePassword) {
                await fetchCurrentHints(unlockedHintPassword);
            }
        } catch (err) {
            setEditHintError(err.message || 'Failed to update result');
        } finally {
            setSavingResult(false);
        }
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
        return Array.from(merged.values())
            .sort((a, b) => b.slotCount - a.slotCount || b.betCount - a.betCount || a.userId.localeCompare(b.userId));
    }, [historyPlayersMap, historySlots]);

    return (
        <AdminLayout onLogout={handleLogout} title="3D Management">
            <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                <h1 className="text-2xl font-bold text-gray-800">3D Management</h1>
                        <p className="text-sm text-gray-500">Current slot, old slot results, edit and set-wise ticket analytics (3D mode).</p>
                    </div>
                    <button
                        type="button"
                        onClick={fetchCurrent}
                        className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                    >
                        Refresh Current Slot
                    </button>
                </div>

                {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div> : null}
                {notice ? <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">{notice}</div> : null}
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <h3 className="text-lg font-semibold text-gray-800">3D Quiz Timing Settings</h3>
                        {loadingTiming ? <span className="text-xs text-gray-500">Loading...</span> : null}
                    </div>
                    {hasSecretDeclarePassword && !timingUnlocked ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <label className="text-sm text-gray-700 md:col-span-2">
                                <span className="block mb-1 font-medium">Secret Declare Password</span>
                                <input
                                    type="password"
                                    value={timingPassword}
                                    onChange={(e) => {
                                        setTimingPassword(e.target.value);
                                        setTimingError('');
                                    }}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300"
                                    placeholder="Enter password to unlock 3D settings"
                                />
                            </label>
                            <div className="flex items-end">
                                <button
                                    type="button"
                                    onClick={unlockTimingSettings}
                                    disabled={loadingTiming}
                                    className="w-full px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold disabled:bg-orange-300"
                                >
                                    {loadingTiming ? 'Unlocking...' : 'Unlock 3D Settings'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <label className="text-sm text-gray-700">
                                <span className="block mb-1 font-medium">Hint Time (Study Minutes)</span>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="15"
                                    value={timingForm.studyMinutes}
                                    onChange={(e) => setTimingForm((prev) => ({ ...prev, studyMinutes: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300"
                                />
                            </label>
                            <label className="text-sm text-gray-700">
                                <span className="block mb-1 font-medium">Question Loading Delay (ms)</span>
                                <input
                                    type="number"
                                    min="100"
                                    value={timingForm.questionRevealStaggerMs}
                                    onChange={(e) => setTimingForm((prev) => ({ ...prev, questionRevealStaggerMs: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300"
                                />
                            </label>
                            <div className="flex items-end">
                                <button
                                    type="button"
                                    onClick={saveTimingSettings}
                                    disabled={savingTiming}
                                    className="w-full px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold disabled:bg-orange-300"
                                >
                                    {savingTiming ? 'Saving...' : 'Save 3D Settings'}
                                </button>
                            </div>
                        </div>
                    )}
                    {timingError ? <p className="mt-3 text-sm text-red-600">{timingError}</p> : null}
                </div>
                <CurrentSlotOverview
                    data={currentSlotData}
                    loading={loadingCurrent}
                    hintRows={currentHintRows}
                    loadingHints={loadingHints}
                    hasSecretDeclarePassword={hasSecretDeclarePassword}
                    hintPassword={hintPassword}
                    hintError={hintError}
                    hintUnlocked={hintUnlocked}
                    onHintPasswordChange={(value) => {
                        setHintPassword(value);
                        setHintError('');
                    }}
                    onUnlockHints={handleUnlockHints}
                    onLockHints={handleLockHints}
                    canEditHints={adminRole === 'super_admin' && hintUnlocked && !savingResult}
                    onEditHint={handleEditCurrentHint}
                    quizLabelFormatter={getThreeDQuizLabel}
                />

                {false ? <OldSlotsSection
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
                /> : null}
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
                            <button type="button" onClick={closePlayerHistoryModal} className="text-gray-400 hover:text-gray-800 p-1">×</button>
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
                                            <p className="text-lg font-bold text-gray-800">₹{Number(playerHistoryData.summary?.totalStake || 0).toLocaleString('en-IN')}</p>
                                        </div>
                                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                            <p className="text-xs text-gray-500">Total Payout</p>
                                            <p className="text-lg font-bold text-gray-800">₹{Number(playerHistoryData.summary?.totalPayout || 0).toLocaleString('en-IN')}</p>
                                        </div>
                                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                            <p className="text-xs text-gray-500">Net Profit/Loss</p>
                                            <p className={`text-lg font-bold ${Number(playerHistoryData.summary?.netProfitLoss || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                ₹{Number(playerHistoryData.summary?.netProfitLoss || 0).toLocaleString('en-IN')}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {(playerHistoryData.slots || []).map((slot) => (
                                            <div key={slot.slotStartIso} className="rounded-xl border border-gray-200">
                                                <div className="px-4 py-2 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-2">
                                                    <div>
                                                        <p className="text-sm font-semibold text-gray-800">{slot.drawLabelEnd}</p>
                                                        <p className="text-xs text-gray-500">{slot.slotStartIso}</p>
                                                    </div>
                                                    <div className="text-xs text-gray-600">
                                                        Total Bets: <span className="font-semibold">{slot.betCount}</span> | Stake: <span className="font-semibold">₹{Number(slot.totalStake || 0).toLocaleString('en-IN')}</span> | Payout: <span className="font-semibold">₹{Number(slot.totalPayout || 0).toLocaleString('en-IN')}</span>
                                                    </div>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="min-w-full text-xs">
                                                        <thead>
                                                            <tr className="text-left text-gray-500 border-b border-gray-100">
                                                                <th className="py-2 px-3">Set</th>
                                                                <th className="py-2 px-3">Number</th>
                                                                <th className="py-2 px-3 text-right">Amount</th>
                                                                <th className="py-2 px-3 text-right">Outcome</th>
                                                                <th className="py-2 px-3 text-right">Payout</th>
                                                                <th className="py-2 px-3 text-right">P/L</th>
                                                                <th className="py-2 px-3">Placed At</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {slot.bets?.map((bet) => (
                                                                <tr key={bet.betId} className="border-b border-gray-100">
                                                                    <td className="py-2 px-3 font-medium">{bet.setLabel}</td>
                                                                    <td className="py-2 px-3 font-mono">{bet.number}</td>
                                                                    <td className="py-2 px-3 text-right font-mono">₹{Number(bet.amount || 0).toLocaleString('en-IN')}</td>
                                                                    <td className={`py-2 px-3 text-right font-semibold ${bet.outcome === 'win' ? 'text-green-600' : bet.outcome === 'lose' ? 'text-red-600' : 'text-amber-600'}`}>
                                                                        {String(bet.outcome || '').toUpperCase()}
                                                                    </td>
                                                                    <td className="py-2 px-3 text-right font-mono">₹{Number(bet.payout || 0).toLocaleString('en-IN')}</td>
                                                                    <td className={`py-2 px-3 text-right font-mono ${Number(bet.netProfitLoss || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                        ₹{Number(bet.netProfitLoss || 0).toLocaleString('en-IN')}
                                                                    </td>
                                                                    <td className="py-2 px-3 text-gray-600">{bet.createdAt ? new Date(bet.createdAt).toLocaleString() : '-'}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        ))}
                                        {!playerHistoryData.slots?.length ? (
                                            <div className="text-sm text-gray-500">No 3D betting history found for this player.</div>
                                        ) : null}
                                    </div>
                                </>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}

            {showEditHintModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-md">
                        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-orange-500">
                                Edit Running Hint for {getThreeDQuizLabel(editHintForm.quizId)}
                            </h3>
                            <button type="button" onClick={closeEditHintModal} className="text-gray-400 hover:text-gray-800 p-1">×</button>
                        </div>
                        <form onSubmit={submitEditCurrentHint} className="p-4 space-y-4">
                            <p className="text-gray-600 text-sm">
                                Enter a new hint number between 000 and 999 for the current running slot.
                            </p>
                            <input
                                type="text"
                                inputMode="numeric"
                                maxLength={3}
                                placeholder="000"
                                value={editHintForm.result}
                                onChange={(e) => {
                                    setEditHintForm((prev) => ({ ...prev, result: e.target.value.replace(/\D/g, '').slice(0, 3) }));
                                    setEditHintError('');
                                }}
                                className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-800 placeholder-gray-400"
                                autoFocus
                            />
                            {editHintError ? (
                                <div className="rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2">
                                    {editHintError}
                                </div>
                            ) : null}
                            <div className="flex gap-2 justify-end">
                                <button type="button" onClick={closeEditHintModal} className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold">
                                    Cancel
                                </button>
                                <button type="submit" disabled={savingResult} className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold disabled:bg-orange-300">
                                    {savingResult ? 'Saving...' : 'Save Hint'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default ThreeDManagement;
