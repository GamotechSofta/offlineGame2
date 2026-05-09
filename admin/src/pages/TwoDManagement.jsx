import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import useModalBackHandler from '../hooks/useModalBackHandler';
import { clearAdminSession, fetchWithAuth } from '../lib/auth';
import CurrentSlotOverview from '../components/twoDManagement/CurrentSlotOverview';
import TwoDAggregateStatsCard from '../components/twoDManagement/TwoDAggregateStatsCard';
import OldSlotsSection from '../components/twoDManagement/OldSlotsSection';
import useSectionAutoRefresh from '../hooks/useSectionAutoRefresh';
import useAdminLiveQueryInvalidation from '../hooks/useAdminLiveQueryInvalidation';
import { dedupeRequest } from '../lib/requestDedupe';
import { getTodayIST } from '../utils/istDate';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

/** Same browser tab: remember hint unlock for current slot so returning from quiz detail does not ask for password again. */
const HINT_UNLOCK_SESSION_KEY = 'offlinebookie:admin:2d-hint-unlock';

const todayDate = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const TwoDManagement = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const location = useLocation();
    const isOldSlotsPage = location.pathname === '/2d-management/old-slots';
    const [date, setDate] = useState(todayDate());
    const [currentSlotData, setCurrentSlotData] = useState(null);
    const [historySlots, setHistorySlots] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState('');
    const [detailData, setDetailData] = useState(null);
    const [loadingCurrent, setLoadingCurrent] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [loadingDetail, setLoadingDetail] = useState(false);
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
    const [currentPlayers, setCurrentPlayers] = useState([]);
    const [loadingCurrentPlayers, setLoadingCurrentPlayers] = useState(false);
    const [showPlayerHistoryModal, setShowPlayerHistoryModal] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [playerHistoryData, setPlayerHistoryData] = useState(null);
    const [loadingPlayerHistory, setLoadingPlayerHistory] = useState(false);
    const [playerHistoryError, setPlayerHistoryError] = useState('');
    const [historyPlayersMap, setHistoryPlayersMap] = useState({});
    const [loadingAllHistoryPlayers, setLoadingAllHistoryPlayers] = useState(false);
    const [timingForm, setTimingForm] = useState({ studyMinutes: '14.5', questionRevealStaggerMs: '8700' });
    const [loadingTiming, setLoadingTiming] = useState(false);
    const [savingTiming, setSavingTiming] = useState(false);
    const [timingError, setTimingError] = useState('');
    const [timingPassword, setTimingPassword] = useState('');
    const [timingUnlocked, setTimingUnlocked] = useState(false);
    const [timingUnlockedSecret, setTimingUnlockedSecret] = useState('');
    const [aggregateStats, setAggregateStats] = useState(null);
    const [loadingAggregateStats, setLoadingAggregateStats] = useState(true);
    const [aggregateStatsError, setAggregateStatsError] = useState('');
    const [appliedStatsDateFrom, setAppliedStatsDateFrom] = useState(() => getTodayIST());
    const [appliedStatsDateTo, setAppliedStatsDateTo] = useState(() => getTodayIST());
    const detailSectionRef = useRef(null);
    const timeDropdownRef = useRef(null);
    const currentSlotIsoRef = useRef('');
    const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);
    /** Slot Player Bets: default aggregate all slots for the date; choosing one slot narrows the table to that slot only. */
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

    const fetchSlotPlayers = useCallback(async (slotStartIso) => {
        if (!slotStartIso) return;
        setLoadingCurrentPlayers(true);
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/slots/${encodeURIComponent(slotStartIso)}/players`);
            if (res.status === 401) return;
            const data = await res.json();
            if (!data?.success) throw new Error(data?.message || 'Failed to load slot players');
            const rows = Array.isArray(data?.data?.players) ? data.data.players : [];
            setCurrentPlayers(rows);
        } catch (err) {
            setError(err.message || 'Failed to load slot players');
            setCurrentPlayers([]);
        } finally {
            setLoadingCurrentPlayers(false);
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

    const fetchPlayerHistoryQuery = useCallback(async () => {
        if (!selectedPlayer?.userId) return null;
        return dedupeRequest(`2d:player-history:${selectedPlayer.userId}`, async () => {
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/players/${encodeURIComponent(selectedPlayer.userId)}/history?limit=40`);
            if (res.status === 401) return null;
            const data = await res.json();
            if (!data?.success) throw new Error(data?.message || 'Failed to load player history');
            return data.data || null;
        });
    }, [selectedPlayer?.userId]);

    const playerHistoryQuery = useQuery({
        queryKey: ['2d-player-history', selectedPlayer?.userId || ''],
        queryFn: fetchPlayerHistoryQuery,
        enabled: showPlayerHistoryModal && Boolean(selectedPlayer?.userId),
        staleTime: 15000,
    });

    const fetchCurrent = useCallback(async () => {
        setLoadingCurrent(true);
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/current-slot`);
            if (res.status === 401) return;
            const data = await res.json();
            if (!data?.success) throw new Error(data?.message || 'Failed to load current slot');
            setCurrentSlotData(data.data);
            const iso = data.data?.slot?.slotStartIso;
            if (iso) fetchSlotPlayers(iso);
        } catch (err) {
            setError(err.message || 'Failed to load current slot');
        } finally {
            setLoadingCurrent(false);
        }
    }, [fetchSlotPlayers]);

    const fetchAggregateStats = useCallback(async () => {
        setLoadingAggregateStats(true);
        setAggregateStatsError('');
        try {
            const params = new URLSearchParams();
            if (appliedStatsDateFrom && appliedStatsDateTo) {
                params.set('dateFrom', appliedStatsDateFrom);
                params.set('dateTo', appliedStatsDateTo);
            }
            const q = params.toString() ? `?${params.toString()}` : '';
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/aggregate-stats${q}`);
            if (res.status === 401) return;
            const data = await res.json();
            if (!data?.success) throw new Error(data?.message || 'Failed to load 2D aggregate stats');
            setAggregateStats(data.data || null);
        } catch (err) {
            setAggregateStatsError(err.message || 'Failed to load 2D aggregate stats');
            setAggregateStats(null);
        } finally {
            setLoadingAggregateStats(false);
        }
    }, [appliedStatsDateFrom, appliedStatsDateTo]);


    const fetchTimingSettings = useCallback(async (secretDeclarePasswordValue = '') => {
        setLoadingTiming(true);
        setTimingError('');
        try {
            const params = new URLSearchParams();
            if (secretDeclarePasswordValue) params.set('secretDeclarePassword', secretDeclarePasswordValue);
            const q = params.toString() ? `?${params.toString()}` : '';
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/quiz-settings/2d${q}`);
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
                questionRevealStaggerMs: String(data.data.questionRevealStaggerMs ?? '8700'),
            });
            setTimingUnlocked(true);
            setTimingUnlockedSecret(secretDeclarePasswordValue || '');
            setTimingPassword('');
        } catch (err) {
            setTimingError(err.message || 'Failed to load timing settings');
        } finally {
            setLoadingTiming(false);
        }
    }, []);

    const fetchCurrentHints = useCallback(async (secretDeclarePasswordValue = '') => {
        setLoadingHints(true);
        setHintError('');
        try {
            const body = secretDeclarePasswordValue ? { secretDeclarePassword: secretDeclarePasswordValue } : {};
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/current-slot/hints`, {
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
                    try {
                        sessionStorage.removeItem(HINT_UNLOCK_SESSION_KEY);
                    } catch {
                        /* ignore */
                    }
                    return;
                }
                throw new Error(data?.message || 'Failed to load current slot hints');
            }

            const rows = Array.isArray(data?.data?.perQuiz)
                ? data.data.perQuiz.map((row) => ({
                    quizId: row.quizId,
                    hint: row.result == null ? '--' : String(row.result).padStart(2, '0'),
                }))
                : [];

            setCurrentHintRows(rows);
            setHintUnlocked(true);
            setUnlockedHintPassword(secretDeclarePasswordValue || '');
            setHintPassword('');
            const iso = currentSlotIsoRef.current;
            if (iso) {
                try {
                    sessionStorage.setItem(
                        HINT_UNLOCK_SESSION_KEY,
                        JSON.stringify({ slotStartIso: iso, secret: secretDeclarePasswordValue || '' }),
                    );
                } catch {
                    /* ignore quota */
                }
            }
        } catch (err) {
            setHintError(err.message || 'Failed to load current slot hints');
            setHintUnlocked(false);
            setCurrentHintRows([]);
            setUnlockedHintPassword('');
        } finally {
            setLoadingHints(false);
        }
    }, []);

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
        const withTickets = list.filter((slot) => Number(slot?.totalTickets || 0) > 0);
        const capped = withTickets.length ? withTickets.slice(0, 20) : list.slice(0, 12);
        setLoadingAllHistoryPlayers(true);
        try {
            const next = {};
            const CONCURRENCY = 2;
            for (let i = 0; i < capped.length; i += CONCURRENCY) {
                const chunk = capped.slice(i, i + CONCURRENCY);
                // eslint-disable-next-line no-await-in-loop
                const settled = await Promise.allSettled(
                    chunk.map(async (slot) => {
                        const slotStartIso = slot?.slotStartIso;
                        if (!slotStartIso) return [null, []];
                        const params = new URLSearchParams({
                            lite: '1',
                            limit: '200',
                            page: '1',
                        });
                        const res = await fetchWithAuth(
                            `${API_BASE_URL}/admin/lottery2d/slots/${encodeURIComponent(slotStartIso)}/players?${params.toString()}`,
                        );
                        if (res.status === 401) return [slotStartIso, []];
                        const data = await res.json();
                        if (!data?.success) return [slotStartIso, []];
                        return [slotStartIso, Array.isArray(data?.data?.players) ? data.data.players : []];
                    }),
                );
                settled.forEach((entry) => {
                    if (entry.status !== 'fulfilled') return;
                    const [k, v] = entry.value || [];
                    if (k) next[k] = v;
                });
            }
            setHistoryPlayersMap(next);
        } catch {
            setHistoryPlayersMap({});
        } finally {
            setLoadingAllHistoryPlayers(false);
        }
    }, []);

    useEffect(() => {
        const slotStartIso = currentSlotData?.slot?.slotStartIso;
        if (!slotStartIso) {
            setCurrentPlayers([]);
            return undefined;
        }
        fetchSlotPlayers(slotStartIso);
        return undefined;
    }, [currentSlotData?.slot?.slotStartIso, fetchSlotPlayers]);

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
    }, [fetchCurrent, fetchTimingSettings, navigate]);

    useEffect(() => {
        fetchAggregateStats();
    }, [fetchAggregateStats]);

    useEffect(() => {
        if (playerHistoryQuery.data !== undefined) {
            setPlayerHistoryData(playerHistoryQuery.data || null);
            setPlayerHistoryError('');
            setLoadingPlayerHistory(false);
        }
    }, [playerHistoryQuery.data]);

    useEffect(() => {
        setLoadingPlayerHistory(playerHistoryQuery.isLoading || playerHistoryQuery.isFetching);
        if (playerHistoryQuery.error) {
            setPlayerHistoryError(playerHistoryQuery.error?.message || 'Failed to load player history');
            setPlayerHistoryData(null);
        }
    }, [playerHistoryQuery.isLoading, playerHistoryQuery.isFetching, playerHistoryQuery.error]);

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
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/quiz-settings/2d`, {
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
            setNotice('2D quiz timing settings updated successfully.');
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
        fetchAllHistoryPlayers(historySlots);
    }, [historySlots, fetchAllHistoryPlayers]);

    useEffect(() => {
        currentSlotIsoRef.current = currentSlotData?.slot?.slotStartIso || '';
    }, [currentSlotData?.slot?.slotStartIso]);

    useEffect(() => {
        const iso = currentSlotData?.slot?.slotStartIso;
        if (!iso) {
            setCurrentHintRows([]);
            setHintPassword('');
            setHintError('');
            setHintUnlocked(false);
            setUnlockedHintPassword('');
            return;
        }

        try {
            const raw = sessionStorage.getItem(HINT_UNLOCK_SESSION_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed?.slotStartIso === iso && typeof parsed.secret === 'string') {
                    fetchCurrentHints(parsed.secret);
                    return;
                }
                if (parsed?.slotStartIso && parsed.slotStartIso !== iso) {
                    sessionStorage.removeItem(HINT_UNLOCK_SESSION_KEY);
                }
            }
        } catch {
            sessionStorage.removeItem(HINT_UNLOCK_SESSION_KEY);
        }

        setCurrentHintRows([]);
        setHintPassword('');
        setHintError('');
        setHintUnlocked(false);
        setUnlockedHintPassword('');

        if (!hasSecretDeclarePassword) {
            fetchCurrentHints('');
        }
    }, [currentSlotData?.slot?.slotStartIso, hasSecretDeclarePassword, fetchCurrentHints]);


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
        setNotice('Slot detail loaded. Scroll below for quiz-wise view/edit.');
        if (detailSectionRef.current) {
            detailSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const handleUnlockHints = async () => {
        if (hasSecretDeclarePassword && !hintPassword.trim()) {
            setHintError('Please enter the secret declare password');
            return;
        }
        await fetchCurrentHints(hintPassword.trim());
    };

    const handleLockHints = () => {
        try {
            sessionStorage.removeItem(HINT_UNLOCK_SESSION_KEY);
        } catch {
            /* ignore */
        }
        setCurrentHintRows([]);
        setHintPassword('');
        setHintError('');
        setHintUnlocked(false);
        setUnlockedHintPassword('');
    };

    const handleEditCurrentHint = (quizId) => {
        if (adminRole !== 'super_admin') {
            setError('Only super admin can edit running slot hint numbers.');
            return;
        }
        const iso = currentSlotData?.slot?.slotStartIso;
        if (!iso) {
            setError('Current slot is not available.');
            return;
        }
        setNotice('');
        setError('');
        navigate(`/2d-management/quiz/${quizId}/stake?slotStartIso=${encodeURIComponent(iso)}`);
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
        return Array.from(merged.values())
            .sort((a, b) => b.slotCount - a.slotCount || b.betCount - a.betCount || a.userId.localeCompare(b.userId));
    }, [historyPlayersMap, slotsForPlayerBetsMerge]);

    const handleOpenPlayerHistory = async (player) => {
        if (!player?.userId) return;
        setSelectedPlayer(player);
        setShowPlayerHistoryModal(true);
        await fetchPlayerHistory(player.userId);
    };

    useSectionAutoRefresh({
        enabled: true,
        intervalMs: 30000,
        onRefresh: () => {
            queryClient.invalidateQueries({ queryKey: ['2d-management-current'] });
            queryClient.invalidateQueries({ queryKey: ['2d-management-aggregate', appliedStatsDateFrom, appliedStatsDateTo] });
            queryClient.invalidateQueries({ queryKey: ['2d-management-history', date] });
            if (showPlayerHistoryModal && selectedPlayer?.userId) {
                queryClient.invalidateQueries({ queryKey: ['2d-player-history', selectedPlayer.userId] });
            }
        },
        immediate: false,
    });

    useAdminLiveQueryInvalidation({
        enabled: true,
        queryKeys: [
            ['2d-management-current'],
            ['2d-management-aggregate', appliedStatsDateFrom, appliedStatsDateTo],
            ['2d-management-history', date],
            ['2d-player-history', selectedPlayer?.userId || ''],
        ],
        throttleMs: 900,
    });

    const currentQuery = useQuery({
        queryKey: ['2d-management-current'],
        queryFn: async () => {
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/current-slot`);
            if (res.status === 401) return null;
            const data = await res.json();
            if (!data?.success) throw new Error(data?.message || 'Failed to load current slot');
            return data.data || null;
        },
        enabled: !!localStorage.getItem('admin'),
    });

    const aggregateQuery = useQuery({
        queryKey: ['2d-management-aggregate', appliedStatsDateFrom, appliedStatsDateTo],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (appliedStatsDateFrom && appliedStatsDateTo) {
                params.set('dateFrom', appliedStatsDateFrom);
                params.set('dateTo', appliedStatsDateTo);
            }
            const q = params.toString() ? `?${params.toString()}` : '';
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/aggregate-stats${q}`);
            if (res.status === 401) return null;
            const data = await res.json();
            if (!data?.success) throw new Error(data?.message || 'Failed to load 2D aggregate stats');
            return data.data || null;
        },
        enabled: !!localStorage.getItem('admin'),
    });

    const historyQuery = useQuery({
        queryKey: ['2d-management-history', date],
        queryFn: async () => {
            const params = new URLSearchParams({ date, limit: '40' });
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/slots?${params.toString()}`);
            if (res.status === 401) return [];
            const data = await res.json();
            if (!data?.success) throw new Error(data?.message || 'Failed to load slot history');
            return data?.data?.slots || [];
        },
        enabled: !!localStorage.getItem('admin'),
    });

    useEffect(() => {
        if (currentQuery.data) {
            setCurrentSlotData(currentQuery.data);
            setLoadingCurrent(false);
            const iso = currentQuery.data?.slot?.slotStartIso;
            if (iso) fetchSlotPlayers(iso);
        }
    }, [currentQuery.data, fetchSlotPlayers]);

    useEffect(() => {
        if (aggregateQuery.data !== undefined) {
            setAggregateStats(aggregateQuery.data);
            setLoadingAggregateStats(false);
            setAggregateStatsError('');
        }
    }, [aggregateQuery.data]);

    useEffect(() => {
        if (historyQuery.data) {
            const slots = historyQuery.data || [];
            setHistorySlots(slots);
            setLoadingHistory(false);
            if (slots.length) {
                setSelectedSlot((prev) => (prev && slots.some((slot) => slot.slotStartIso === prev) ? prev : slots[0].slotStartIso));
            } else {
                setSelectedSlot('');
                setDetailData(null);
            }
        }
    }, [historyQuery.data]);

    return (
        <AdminLayout onLogout={handleLogout} title="2D Management">
            <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">2D Management</h1>
                        <p className="text-sm text-gray-500">Current slot, old slot results, edit and quiz-wise ticket analytics.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            fetchCurrent();
                            fetchAggregateStats();
                        }}
                        className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                    >
                        Refresh Current Slot
                    </button>
                </div>

                {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div> : null}
                {notice ? <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">{notice}</div> : null}
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <h3 className="text-lg font-semibold text-gray-800">2D Quiz Timing Settings</h3>
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
                                    placeholder="Enter password to unlock 2D settings"
                                />
                            </label>
                            <div className="flex items-end">
                                <button
                                    type="button"
                                    onClick={unlockTimingSettings}
                                    disabled={loadingTiming}
                                    className="w-full px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold disabled:bg-orange-300"
                                >
                                    {loadingTiming ? 'Unlocking...' : 'Unlock 2D Settings'}
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
                                    {savingTiming ? 'Saving...' : 'Save 2D Settings'}
                                </button>
                            </div>
                        </div>
                    )}
                    {timingError ? <p className="mt-3 text-sm text-red-600">{timingError}</p> : null}
                </div>
                <TwoDAggregateStatsCard
                    data={aggregateStats}
                    loading={loadingAggregateStats}
                    error={aggregateStatsError}
                    appliedFrom={appliedStatsDateFrom}
                    appliedTo={appliedStatsDateTo}
                    onApplyRange={(from, to) => {
                        setAppliedStatsDateFrom(from);
                        setAppliedStatsDateTo(to);
                    }}
                    onClearRange={() => {
                        setAppliedStatsDateFrom('');
                        setAppliedStatsDateTo('');
                    }}
                />
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
                    canEditHints={adminRole === 'super_admin' && hintUnlocked}
                    onEditHint={handleEditCurrentHint}
                    onQuizCardClick={(qid) => {
                        const iso = currentSlotData?.slot?.slotStartIso;
                        if (!iso) return;
                        navigate(`/2d-management/quiz/${qid}/stake?slotStartIso=${encodeURIComponent(iso)}`);
                    }}
                />
                <div className="rounded-xl border border-gray-200 bg-white p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h3 className="text-base font-semibold text-gray-800">All User Tickets</h3>
                        <p className="text-sm text-gray-500">Open ticket-wise list with username, bet count and total stake.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate('/2d-management/tickets')}
                        className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                    >
                        Open Tickets Page
                    </button>
                </div>
                {isOldSlotsPage ? (
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
                ) : null}
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
                                                                <th className="py-2 px-3">Quiz</th>
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
                                            <div className="text-sm text-gray-500">No 2D betting history found for this player.</div>
                                        ) : null}
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

export default TwoDManagement;
