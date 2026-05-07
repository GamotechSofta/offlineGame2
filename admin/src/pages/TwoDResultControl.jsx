import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { clearAdminSession, fetchWithAuth } from '../lib/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';
const RESULT_CONTROL_UNLOCK_SESSION_KEY = 'offlinebookie:admin:2d-result-control-unlock';
const todayDate = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const formatSlotLabel = (slot) => slot?.drawLabelEnd || slot?.slotStartIso || '-';
const getProfitRangeColorClass = (profitPercentValue) => {
    const signedPct = Number(profitPercentValue);
    if (!Number.isFinite(signedPct)) return 'text-gray-400';
    if (signedPct < 0) return 'text-red-700';
    const pct = Math.abs(signedPct);
    if (pct === 0) return 'text-pink-600';
    if (pct <= 10) return 'text-pink-600';
    if (pct <= 20) return 'text-red-500';
    if (pct <= 30) return 'text-orange-500';
    if (pct <= 40) return 'text-amber-500';
    if (pct <= 50) return 'text-yellow-500';
    if (pct <= 60) return 'text-lime-500';
    if (pct <= 70) return 'text-lime-600';
    if (pct <= 80) return 'text-green-600';
    if (pct <= 90) return 'text-sky-500';
    return 'text-blue-600';
};
const formatHousePl = (value, totalStakeValue = null) => {
    const n = Number(value);
    if (value == null || !Number.isFinite(n)) {
        return { text: 'P/L: --', className: 'text-gray-400' };
    }
    const totalStake = Number(totalStakeValue);
    const profitPct = Number.isFinite(totalStake) && totalStake > 0 ? (n / totalStake) * 100 : null;
    const className = Number.isFinite(profitPct) ? getProfitRangeColorClass(profitPct) : (n >= 0 ? 'text-green-700' : 'text-red-700');
    const rounded = Math.round(n);
    if (n >= 0) {
        return { text: `P/L: +₹${rounded.toLocaleString('en-IN')}`, className };
    }
    return { text: `P/L: -₹${Math.abs(rounded).toLocaleString('en-IN')}`, className };
};
const formatProfitPercent = (houseNetValue, totalStakeValue) => {
    const houseNet = Number(houseNetValue);
    const totalStake = Number(totalStakeValue);
    if (!Number.isFinite(houseNet) || !Number.isFinite(totalStake) || totalStake <= 0) {
        return { text: 'Profit: --', className: 'text-gray-400' };
    }
    const pct = (houseNet / totalStake) * 100;
    const rounded = Math.round(pct * 10) / 10;
    const sign = rounded >= 0 ? '+' : '';
    const cls = getProfitRangeColorClass(rounded);
    return { text: `Profit: ${sign}${rounded}%`, className: cls };
};

const TwoDResultControl = () => {
    const navigate = useNavigate();
    const [date, setDate] = useState(todayDate());
    const [slots, setSlots] = useState([]);
    const [currentSlotStartIso, setCurrentSlotStartIso] = useState('');
    const [currentSlotPhase, setCurrentSlotPhase] = useState('');
    const [hasSecretDeclarePassword, setHasSecretDeclarePassword] = useState(false);
    const [pagePassword, setPagePassword] = useState('');
    const [pageUnlocked, setPageUnlocked] = useState(false);
    const [unlockingPage, setUnlockingPage] = useState(false);
    const [pageUnlockError, setPageUnlockError] = useState('');
    const [currentHintRows, setCurrentHintRows] = useState([]);
    const [targetProfitPercent, setTargetProfitPercent] = useState('0');
    const [hasTouchedTargetProfit, setHasTouchedTargetProfit] = useState(false);
    const [manualModal, setManualModal] = useState({ open: false, slotStartIso: '', quizId: '1', result: '' });
    const [manualSaving, setManualSaving] = useState(false);
    const [manualError, setManualError] = useState('');
    const [armingTargetAuto, setArmingTargetAuto] = useState(false);
    const [switchingRandomAuto, setSwitchingRandomAuto] = useState(false);
    const [loading, setLoading] = useState(true);
    const [hintsLoading, setHintsLoading] = useState(true);
    const [hintPreviewMode, setHintPreviewMode] = useState('default');
    const [autoDeclareMode, setAutoDeclareMode] = useState('random');
    const [isEditingTargetProfit, setIsEditingTargetProfit] = useState(false);
    const [secretCheckComplete, setSecretCheckComplete] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [slotDetailMap, setSlotDetailMap] = useState({});
    const [showAllHistorySlots, setShowAllHistorySlots] = useState(false);
    const targetProfitNumber = Number(String(targetProfitPercent || '').trim());
    const hasValidTargetProfit = Number.isFinite(targetProfitNumber);
    const canRunTargetActions = Boolean(currentSlotStartIso) && hasValidTargetProfit && !hintsLoading;

    const handleLogout = useCallback(() => {
        clearAdminSession();
        navigate('/');
    }, [navigate]);

    const fetchSlots = useCallback(async (targetDate = date, options = {}) => {
        const silent = Boolean(options?.silent);
        const limit = Math.min(96, Math.max(1, Number(options?.limit || 96)));
        if (!silent) {
            setLoading(true);
        }
        setError('');
        try {
            const params = new URLSearchParams({ date: targetDate, limit: String(limit) });
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/slots/declaration-matrix?${params.toString()}`);
            if (res.status === 401) return;
            const data = await res.json();
            if (!data?.success) throw new Error(data?.message || 'Failed to load slots');
            setSlots(Array.isArray(data?.data?.slots) ? data.data.slots : []);
        } catch (err) {
            setError(err.message || 'Failed to load slots');
            setSlots([]);
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    }, [date]);

    useEffect(() => {
        if (!secretCheckComplete) return;
        if (hasSecretDeclarePassword && !pageUnlocked) return;
        fetchSlots(date, { limit: 24 });
        fetchSlots(date, { silent: true, limit: 96 });
    }, [fetchSlots, date, hasSecretDeclarePassword, pageUnlocked, secretCheckComplete]);

    useEffect(() => {
        fetchWithAuth(`${API_BASE_URL}/admin/me/secret-declare-password-status`)
            .then((res) => (res.status === 401 ? null : res.json()))
            .then((json) => {
                if (json?.success) {
                    const hasPassword = Boolean(json?.hasSecretDeclarePassword);
                    let restoredUnlock = false;
                    try {
                        restoredUnlock = sessionStorage.getItem(RESULT_CONTROL_UNLOCK_SESSION_KEY) === '1';
                    } catch {
                        restoredUnlock = false;
                    }
                    setHasSecretDeclarePassword(hasPassword);
                    setPageUnlocked(!hasPassword || restoredUnlock);
                }
            })
            .catch(() => {})
            .finally(() => {
                setSecretCheckComplete(true);
            });
    }, []);

    const fetchCurrentSlotForHints = useCallback(async (options = {}) => {
        const silent = Boolean(options?.silent);
        const mode = String(options?.mode || 'default');
        const targetInput = String(options?.targetProfitPercent ?? targetProfitPercent).trim();
        const parsedTarget = Number(targetInput);
        const targetToUse = Number.isFinite(parsedTarget) ? parsedTarget : 0;
        if (!silent) setHintsLoading(true);
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/current-slot`);
            if (res.status === 401) return;
            const json = await res.json();
            if (json?.success) {
                const iso = json?.data?.slot?.slotStartIso || '';
                const phase = json?.data?.slot?.phase || '';
                const persistedTargetRaw = json?.data?.slot?.declaration?.targetProfitPercent;
                const persistedTarget = typeof persistedTargetRaw === 'number' ? persistedTargetRaw : null;
                setCurrentSlotStartIso(iso);
                setCurrentSlotPhase(phase);
                if (Number.isFinite(persistedTarget)) {
                    setAutoDeclareMode('target');
                    if (!isEditingTargetProfit && !hasTouchedTargetProfit) {
                        setTargetProfitPercent(String(persistedTarget));
                    }
                } else {
                    setAutoDeclareMode('random');
                }
                if (!iso) {
                    setCurrentHintRows([]);
                    return;
                }
                if (mode === 'target') {
                    const targetParams = new URLSearchParams({ targetProfitPercent: String(targetToUse) });
                    const targetMetaRes = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/current-slot/target-hints?${targetParams.toString()}`);
                    if (targetMetaRes.status === 401) return;
                    const targetMetaJson = await targetMetaRes.json().catch(() => ({}));
                    if (!targetMetaJson?.success) {
                        setCurrentHintRows([]);
                        return;
                    }
                    const rows = Array.isArray(targetMetaJson?.data?.perQuiz)
                        ? targetMetaJson.data.perQuiz.map((row) => ({
                            quizId: row.quizId,
                            hint: row.totalStake > 0
                                ? (row.suggestedResultLabel == null ? '--' : String(row.suggestedResultLabel).padStart(2, '0'))
                                : '--',
                            houseNetIfHintWins: row.houseNetIfSuggestedWins,
                            totalStake: row.totalStake,
                            meetsOrExceedsTarget: Boolean(row.meetsOrExceedsTarget),
                            topCandidates: Array.isArray(row.topCandidates) ? row.topCandidates : [],
                        }))
                        : [];
                    setCurrentHintRows(rows);
                    setHintPreviewMode('target');
                } else {
                    const detailRes = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/slots/${encodeURIComponent(iso)}/detail`);
                    if (detailRes.status === 401) return;
                    const detailJson = await detailRes.json();
                    if (!detailJson?.success) {
                        setCurrentHintRows([]);
                        return;
                    }
                    const rows = Array.isArray(detailJson?.data?.perQuiz)
                        ? detailJson.data.perQuiz.map((row) => ({
                            quizId: row.quizId,
                            hint: row.result == null ? '--' : String(row.result).padStart(2, '0'),
                            houseNetIfHintWins: row.houseNetIfHintWins,
                            totalStake: row.totalBetAmount,
                            meetsOrExceedsTarget: null,
                        }))
                        : [];
                    setCurrentHintRows(rows);
                    setHintPreviewMode('default');
                }
            }
        } catch {
            setCurrentSlotStartIso('');
            setCurrentSlotPhase('');
            setCurrentHintRows([]);
        } finally {
            if (!silent) setHintsLoading(false);
        }
    }, [targetProfitPercent, isEditingTargetProfit]);

    useEffect(() => {
        if (!secretCheckComplete) return;
        if (hasSecretDeclarePassword && !pageUnlocked) return;
        fetchCurrentSlotForHints();
    }, [fetchCurrentSlotForHints, hasSecretDeclarePassword, pageUnlocked, secretCheckComplete]);

    useEffect(() => {
        if (secretCheckComplete && hasSecretDeclarePassword && !pageUnlocked) {
            setHintsLoading(false);
            setLoading(false);
        }
    }, [secretCheckComplete, hasSecretDeclarePassword, pageUnlocked]);

    useEffect(() => {
        if (hasSecretDeclarePassword && !pageUnlocked) return undefined;
        const timer = setInterval(() => {
            fetchSlots(date, { silent: true });
            fetchCurrentSlotForHints({ silent: true });
        }, 15000);
        return () => clearInterval(timer);
    }, [fetchSlots, fetchCurrentSlotForHints, date, hasSecretDeclarePassword, pageUnlocked]);

    const unlockPage = useCallback(async () => {
        const secret = pagePassword.trim();
        if (!secret) {
            setPageUnlockError('Please enter security password');
            return;
        }
        setUnlockingPage(true);
        setPageUnlockError('');
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/current-slot/hints`, {
                method: 'POST',
                body: JSON.stringify({ secretDeclarePassword: secret }),
            });
            if (res.status === 401) return;
            const data = await res.json();
            if (!data?.success) {
                throw new Error(data?.message || 'Invalid security password');
            }
            setPageUnlocked(true);
            setPagePassword('');
            try {
                sessionStorage.setItem(RESULT_CONTROL_UNLOCK_SESSION_KEY, '1');
            } catch {
                // ignore storage write errors
            }
            await fetchCurrentSlotForHints();
        } catch (err) {
            setPageUnlockError(err?.message || 'Invalid security password');
            setPageUnlocked(false);
        } finally {
            setUnlockingPage(false);
        }
    }, [pagePassword, fetchCurrentSlotForHints]);

    const openManualModal = useCallback((slotStartIso, quizId = '1', currentResultLabel = '') => {
        const normalizedQuizId = String(quizId || '1');
        const normalizedResult = typeof currentResultLabel === 'string' && currentResultLabel !== '--'
            ? currentResultLabel
            : '';
        setManualModal({ open: true, slotStartIso, quizId: normalizedQuizId, result: normalizedResult });
        setManualError('');
    }, []);

    const closeManualModal = useCallback(() => {
        setManualModal({ open: false, slotStartIso: '', quizId: '1', result: '' });
        setManualError('');
    }, []);

    const submitManualResult = useCallback(async (e) => {
        e.preventDefault();
        const slotStartIso = String(manualModal.slotStartIso || '').trim();
        const quizId = Number(manualModal.quizId);
        const resultText = String(manualModal.result || '').trim();
        const result = Number(resultText);
        if (!slotStartIso) {
            setManualError('Invalid slot.');
            return;
        }
        if (!Number.isInteger(quizId) || quizId < 1 || quizId > 30) {
            setManualError('Quiz ID must be between 1 and 30.');
            return;
        }
        if (!/^\d{1,2}$/.test(resultText) || !Number.isInteger(result) || result < 0 || result > 99) {
            setManualError('Result must be between 00 and 99.');
            return;
        }

        setManualSaving(true);
        setManualError('');
        setError('');
        setNotice('');
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/slots/${encodeURIComponent(slotStartIso)}/result`, {
                method: 'PATCH',
                body: JSON.stringify({ quizId, result }),
            });
            if (res.status === 401) return;
            const data = await res.json();
            if (!data?.success) throw new Error(data?.message || 'Failed to set manual result');

            const padded = String(result).padStart(2, '0');
            setSlots((prev) => prev.map((slot) => {
                if (slot.slotStartIso !== slotStartIso) return slot;
                return {
                    ...slot,
                    perQuiz: Array.isArray(slot.perQuiz)
                        ? slot.perQuiz.map((q) => (
                            Number(q.quizId) === quizId
                                ? { ...q, result, resultLabel: padded }
                                : q
                        ))
                        : slot.perQuiz,
                };
            }));
            setNotice(`Manual result set for Q${String(quizId).padStart(2, '0')} = ${padded}.`);
            await fetchCurrentSlotForHints({ silent: true });
            closeManualModal();
        } catch (err) {
            setManualError(err?.message || 'Failed to set manual result');
        } finally {
            setManualSaving(false);
        }
    }, [manualModal, closeManualModal, fetchCurrentSlotForHints]);

    const armTargetAutoDeclare = useCallback(async () => {
        const valueText = String(targetProfitPercent || '').trim();
        const value = Number(valueText);
        if (!Number.isFinite(value)) {
            setError('Enter valid Target profit % first.');
            return;
        }
        setArmingTargetAuto(true);
        setError('');
        setNotice('');
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/current-slot/target-auto-declare`, {
                method: 'PATCH',
                body: JSON.stringify({ targetProfitPercent: value }),
            });
            if (res.status === 401) return;
            const data = await res.json();
            if (!data?.success) throw new Error(data?.message || 'Failed to arm target auto declare');
            setNotice(`Target auto-declare armed at ${value}% for current running slot.`);
            setAutoDeclareMode('target');
            setHasTouchedTargetProfit(false);
            await fetchCurrentSlotForHints({ targetProfitPercent: value, mode: 'target', silent: true });
        } catch (err) {
            setError(err?.message || 'Failed to arm target auto declare');
        } finally {
            setArmingTargetAuto(false);
        }
    }, [targetProfitPercent, fetchCurrentSlotForHints]);

    const switchToRandomAutoDeclare = useCallback(async () => {
        setSwitchingRandomAuto(true);
        setError('');
        setNotice('');
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/current-slot/target-auto-declare`, {
                method: 'PATCH',
                body: JSON.stringify({ mode: 'random' }),
            });
            if (res.status === 401) return;
            const data = await res.json();
            if (!data?.success) throw new Error(data?.message || 'Failed to switch random auto declare');
            setNotice('Switched to random auto declare for current running slot.');
            setAutoDeclareMode('random');
            await fetchCurrentSlotForHints({ mode: 'default', silent: true });
        } catch (err) {
            setError(err?.message || 'Failed to switch random auto declare');
        } finally {
            setSwitchingRandomAuto(false);
        }
    }, [fetchCurrentSlotForHints]);

    const sortedSlots = useMemo(() => (
        [...slots].sort((a, b) => String(b.slotStartIso || '').localeCompare(String(a.slotStartIso || '')))
    ), [slots]);

    const visibleHistorySlots = useMemo(() => {
        if (showAllHistorySlots) return sortedSlots;
        if (!sortedSlots.length) return [];

        const declaredSlots = sortedSlots.filter((slot) => Boolean(slot?.declaration?.declared));
        const runningSlot = sortedSlots.find((slot) => (
            Boolean(currentSlotStartIso) && slot.slotStartIso === currentSlotStartIso && !slot?.isCompleted
        ));
        const chronologicalSlots = [...sortedSlots].sort((a, b) => String(a.slotStartIso || '').localeCompare(String(b.slotStartIso || '')));
        const runningIndex = chronologicalSlots.findIndex((slot) => (
            Boolean(currentSlotStartIso) && slot.slotStartIso === currentSlotStartIso && !slot?.isCompleted
        ));
        const limitedPending = [];
        if (runningIndex >= 0) {
            for (let i = runningIndex + 1; i < chronologicalSlots.length && limitedPending.length < 2; i += 1) {
                const slot = chronologicalSlots[i];
                if (!slot) continue;
                const declared = Boolean(slot?.declaration?.declared);
                if (!declared) {
                    limitedPending.push(slot);
                }
            }
        }
        const combined = [...[...limitedPending].reverse(), ...(runningSlot ? [runningSlot] : []), ...declaredSlots];
        const seen = new Set();
        return combined.filter((slot) => {
            const key = String(slot?.slotStartIso || '');
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [sortedSlots, showAllHistorySlots, currentSlotStartIso]);

    useEffect(() => {
        if (!sortedSlots.length) {
            setSlotDetailMap({});
            return;
        }
        let cancelled = false;
        const loadSlotDetails = async () => {
            try {
                const settled = await Promise.allSettled(
                    sortedSlots.map(async (slot) => {
                        const slotStartIso = slot?.slotStartIso;
                        if (!slotStartIso) return [null, null];
                        const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/slots/${encodeURIComponent(slotStartIso)}/detail`);
                        if (res.status === 401) return [slotStartIso, null];
                        const json = await res.json();
                        if (!json?.success) return [slotStartIso, null];
                        return [slotStartIso, json?.data || null];
                    }),
                );
                if (cancelled) return;
                const nextMap = {};
                settled.forEach((entry) => {
                    if (entry.status !== 'fulfilled') return;
                    const [slotStartIso, detail] = entry.value || [];
                    if (slotStartIso) nextMap[slotStartIso] = detail;
                });
                setSlotDetailMap(nextMap);
            } catch {
                if (!cancelled) {
                    setSlotDetailMap({});
                }
            }
        };
        loadSlotDetails();
        return () => {
            cancelled = true;
        };
    }, [sortedSlots]);

    return (
        <AdminLayout onLogout={handleLogout} title="2D Result Control">
            <div className="relative min-h-[60vh] space-y-5">
                <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">2D Result Declaration Control</h1>
                        <p className="text-sm text-gray-500">Simple flow: edit running slot first, then review history.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-gray-300 text-sm"
                        />
                        <button
                            type="button"
                            onClick={() => fetchSlots(date)}
                            className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                            disabled={loading}
                        >
                            {loading ? 'Refreshing...' : 'Refresh'}
                        </button>
                    </div>
                </div>

                {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div> : null}
                {notice ? <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">{notice}</div> : null}

                {hasSecretDeclarePassword && !pageUnlocked ? (
                    <div className="bg-white border border-gray-200 rounded-xl p-5 max-w-xl">
                        <h3 className="text-lg font-semibold text-gray-800">Unlock Result Control</h3>
                        <p className="text-sm text-gray-500 mt-1">Enter security password to view Result Control content.</p>
                        <div className="mt-3 flex flex-col sm:flex-row gap-2">
                            <input
                                type="password"
                                value={pagePassword}
                                onChange={(e) => {
                                    setPagePassword(e.target.value);
                                    setPageUnlockError('');
                                }}
                                placeholder="Enter security password"
                                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm"
                            />
                            <button
                                type="button"
                                onClick={unlockPage}
                                disabled={unlockingPage}
                                className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold"
                            >
                                {unlockingPage ? 'Unlocking...' : 'Unlock'}
                            </button>
                        </div>
                        {pageUnlockError ? <p className="mt-2 text-sm text-red-600">{pageUnlockError}</p> : null}
                    </div>
                ) : null}

                {hasSecretDeclarePassword && !pageUnlocked ? null : (
                    <>
                        <div className="bg-white border border-gray-200 rounded-xl p-5">
                            <h2 className="text-base font-semibold text-gray-800">Step 1: Running slot quick edit</h2>
                            <p className="text-xs text-gray-500 mt-1">
                                Current slot: {currentSlotStartIso || '-'}
                                {' · '}
                                Use <span className="font-semibold text-gray-600">View all bets</span> on a quiz to open its full betting breakdown (every number) for this slot.
                            </p>
                            <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-gray-600">Auto mode</span>
                                        <span className={`text-[11px] px-2 py-1 rounded-full font-semibold ${autoDeclareMode === 'target' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                            {autoDeclareMode === 'target' ? 'Target mode active' : 'Random mode active'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={armTargetAutoDeclare}
                                            disabled={armingTargetAuto || !canRunTargetActions}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60 ${
                                                autoDeclareMode === 'target'
                                                    ? 'bg-purple-700 text-white ring-2 ring-purple-300'
                                                    : 'bg-purple-600 text-white hover:bg-purple-700'
                                            }`}
                                        >
                                            {armingTargetAuto ? 'Activating target...' : autoDeclareMode === 'target' ? 'Target mode active' : 'Use target mode'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={switchToRandomAutoDeclare}
                                            disabled={switchingRandomAuto || !currentSlotStartIso}
                                            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold disabled:opacity-60 ${
                                                autoDeclareMode === 'random'
                                                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200'
                                                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                                            }`}
                                        >
                                            {switchingRandomAuto ? 'Switching...' : autoDeclareMode === 'random' ? 'Random mode active' : 'Use random mode'}
                                        </button>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-end gap-2">
                                    <label className="text-xs text-gray-600 font-medium">
                                        Target profit %
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={targetProfitPercent}
                                            onChange={(e) => {
                                                setHasTouchedTargetProfit(true);
                                                setTargetProfitPercent(e.target.value.replace(/[^\d.-]/g, '').slice(0, 6));
                                            }}
                                            onFocus={() => setIsEditingTargetProfit(true)}
                                            onBlur={() => setIsEditingTargetProfit(false)}
                                            className="ml-2 w-24 px-2 py-1.5 rounded border border-gray-300 text-sm bg-white"
                                            placeholder="0"
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => fetchCurrentSlotForHints({ targetProfitPercent, mode: 'target' })}
                                        disabled={!canRunTargetActions}
                                        className="px-3 py-1.5 rounded-lg border border-purple-300 text-xs font-semibold text-purple-700 hover:bg-purple-50 disabled:opacity-60"
                                    >
                                        {hintsLoading ? 'Computing...' : 'Compute target hints'}
                                    </button>
                                    {!currentSlotStartIso ? (
                                        <span className="text-[11px] text-amber-700 font-medium">No running slot available now.</span>
                                    ) : !hasValidTargetProfit ? (
                                        <span className="text-[11px] text-amber-700 font-medium">Enter a valid target % to use target mode.</span>
                                    ) : null}
                                </div>
                            </div>
                            {hintsLoading ? (
                                <p className="mt-3 text-xs text-gray-500">Loading running slot...</p>
                            ) : currentHintRows.length ? (
                                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2">
                                    {currentHintRows.map((item) => (
                                        (() => {
                                            const pl = formatHousePl(item.houseNetIfHintWins, item.totalStake);
                                            const qid = String(item.quizId);
                                            const candidateText = item?.topCandidates?.length
                                                ? item.topCandidates
                                                    .map((c) => `${c.numberLabel} (${Number(c.stakePercent || 0).toFixed(1)}%)`)
                                                    .join(', ')
                                                : null;
                                            const goToBetHistory = () => {
                                                if (!currentSlotStartIso) return;
                                                navigate(`/2d-management/quiz/${qid}/stake?slotStartIso=${encodeURIComponent(currentSlotStartIso)}`);
                                            };
                                            return (
                                        <div
                                            key={item.quizId}
                                            className="rounded-md border border-gray-200 bg-white px-2 py-2 text-xs text-left flex flex-col gap-1 hover:border-purple-300 hover:bg-purple-50/60 transition"
                                        >
                                            <button
                                                type="button"
                                                onClick={goToBetHistory}
                                                disabled={!currentSlotStartIso}
                                                className="text-left w-full rounded p-0.5 -m-0.5 outline-none focus-visible:ring-2 focus-visible:ring-purple-400 disabled:opacity-50 disabled:cursor-not-allowed"
                                                title="Open number-wise betting breakdown for this quiz"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-500">{`Q${qid.padStart(2, '0')}`}</span>
                                                    <span className="font-mono font-semibold text-gray-800">{item.hint}</span>
                                                </div>
                                                <div className={`mt-0.5 text-[10px] font-semibold ${pl.className}`}>{pl.text}</div>
                                                {(() => {
                                                    const profitPct = formatProfitPercent(item.houseNetIfHintWins, item.totalStake);
                                                    return <div className={`mt-0.5 text-[10px] font-semibold ${profitPct.className}`}>{profitPct.text}</div>;
                                                })()}
                                                {hintPreviewMode === 'target' ? (
                                                    <div className={`mt-0.5 text-[10px] font-semibold ${item.meetsOrExceedsTarget ? 'text-emerald-700' : 'text-amber-700'}`}>
                                                        {item.meetsOrExceedsTarget ? 'Target reached' : 'Nearest to target'}
                                                    </div>
                                                ) : (
                                                    <div className="mt-0.5 text-[10px] font-semibold text-slate-600">Default auto hint</div>
                                                )}
                                                {hintPreviewMode === 'target' ? (
                                                    <div className="mt-0.5 text-[10px] font-semibold text-slate-700">
                                                        {candidateText ? `Possible: ${candidateText}` : (Number(item.totalStake || 0) > 0 ? 'Possible: --' : 'No bets yet')}
                                                    </div>
                                                ) : null}
                                                <div className="mt-1 text-[10px] text-gray-600 font-semibold">View all bets →</div>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => openManualModal(currentSlotStartIso, qid, item.hint)}
                                                className="w-full rounded border border-purple-200 bg-white py-1 text-[10px] text-purple-700 font-semibold hover:bg-purple-100/80"
                                            >
                                                Set result
                                            </button>
                                        </div>
                                            );
                                        })()
                                    ))}
                                </div>
                            ) : (
                                <p className="mt-3 text-xs text-gray-500">Running slot unavailable or hint numbers not ready.</p>
                            )}
                        </div>

                        <div className="bg-white border border-gray-200 rounded-xl p-5">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-base font-semibold text-gray-800">Step 2: Slot history (latest first)</h2>
                                    <p className="text-xs text-gray-500 mt-1">Default: pending from next 2 slots first, then running, then declared. Use button to view all.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowAllHistorySlots((prev) => !prev)}
                                    className="shrink-0 px-3 py-1.5 rounded-lg border border-purple-300 text-xs font-semibold text-purple-700 hover:bg-purple-50"
                                >
                                    {showAllHistorySlots ? 'Show Limited' : 'Show All'}
                                </button>
                            </div>
                            {!sortedSlots.length && !loading ? (
                                <p className="mt-3 text-sm text-gray-500">No slots found for selected date.</p>
                            ) : !visibleHistorySlots.length ? (
                                <p className="mt-3 text-sm text-gray-500">No running slot or pending slots found.</p>
                            ) : (
                                <div className="mt-3 space-y-3">
                                    {visibleHistorySlots.map((slot) => {
                                        const declared = Boolean(slot?.declaration?.declared);
                                        const declaredCount = (slot?.perQuiz || []).filter((q) => q?.declared).length;
                                        const isRunning = Boolean(currentSlotStartIso) && slot.slotStartIso === currentSlotStartIso && !slot?.isCompleted;
                                        const canManualResult = !declared && isRunning && currentSlotPhase === 'study';
                                        return (
                                            <div key={slot.slotStartIso} className="rounded-lg border border-gray-200">
                                                <div className="px-3 py-2.5 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
                                                    <div>
                                                        <div className="font-semibold text-gray-800">{formatSlotLabel(slot)}</div>
                                                        <div className="text-[11px] text-gray-500 mt-0.5">{slot.slotStartIso}</div>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <span className={`text-[10px] px-2 py-1 rounded-full font-semibold ${declared ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                                            {declared ? 'Declared' : 'Pending'}
                                                        </span>
                                                        <span className="text-[10px] px-2 py-1 rounded-full bg-gray-100 text-gray-700 font-semibold">{`${declaredCount}/30 declared`}</span>
                                                        {isRunning ? <span className="text-[10px] px-2 py-1 rounded-full bg-orange-100 text-orange-700 font-semibold">Running Slot</span> : null}
                                                    </div>
                                                </div>
                                                <div className="p-2.5">
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2">
                                                        {Array.from({ length: 30 }, (_, idx) => idx + 1).map((quizId) => {
                                                            const q = (slot?.perQuiz || []).find((row) => Number(row.quizId) === quizId);
                                                            const detailQuiz = (slotDetailMap?.[slot.slotStartIso]?.perQuiz || []).find((row) => Number(row.quizId) === quizId);
                                                            const visibleResultLabel = (slot?.isCompleted || isRunning) ? (q?.resultLabel || '--') : '--';
                                                            const pl = formatHousePl(
                                                                detailQuiz?.houseNetIfHintWins ?? q?.houseNetIfHintWins,
                                                                detailQuiz?.totalBetAmount ?? q?.totalBetAmount,
                                                            );
                                                            return (
                                                                <div key={`${slot.slotStartIso}-${quizId}`} className="rounded-md border border-gray-200 bg-white px-2 py-2 text-xs text-left">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-gray-500">{`Q${String(quizId).padStart(2, '0')}`}</span>
                                                                        <span className="font-mono font-semibold text-gray-800">{visibleResultLabel}</span>
                                                                    </div>
                                                                    <div className={`mt-0.5 text-[10px] font-semibold ${pl.className}`}>{pl.text}</div>
                                                                    {canManualResult ? (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => openManualModal(slot.slotStartIso, String(quizId), q?.resultLabel || '--')}
                                                                            className="mt-1 text-[10px] text-purple-700 font-semibold hover:underline"
                                                                        >
                                                                            Set Result
                                                                        </button>
                                                                    ) : null}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </>
                )}
                </div>
            </div>
            {manualModal.open ? (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-md">
                        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-800">Set Manual Result</h3>
                            <button type="button" onClick={closeManualModal} className="text-gray-400 hover:text-gray-800 p-1">x</button>
                        </div>
                        <form onSubmit={submitManualResult} className="p-4 space-y-3">
                            <p className="text-xs text-gray-500 break-all">Slot: {manualModal.slotStartIso}</p>
                            <div className="grid grid-cols-2 gap-3">
                                <label className="text-sm text-gray-700">
                                    <span className="block mb-1 font-medium">Quiz ID</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max="30"
                                        value={manualModal.quizId}
                                        onChange={(e) => setManualModal((prev) => ({ ...prev, quizId: e.target.value.replace(/\D/g, '').slice(0, 2) }))}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300"
                                    />
                                </label>
                                <label className="text-sm text-gray-700">
                                    <span className="block mb-1 font-medium">Result (00-99)</span>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={2}
                                        value={manualModal.result}
                                        onChange={(e) => setManualModal((prev) => ({ ...prev, result: e.target.value.replace(/\D/g, '').slice(0, 2) }))}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300"
                                        placeholder="00"
                                    />
                                </label>
                            </div>
                            {manualError ? <p className="text-sm text-red-600">{manualError}</p> : null}
                            <div className="flex justify-end gap-2 pt-1">
                                <button type="button" onClick={closeManualModal} className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold">
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={manualSaving}
                                    className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold disabled:bg-purple-400"
                                >
                                    {manualSaving ? 'Saving...' : 'Save Manual'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}
        </AdminLayout>
    );
};

export default TwoDResultControl;

