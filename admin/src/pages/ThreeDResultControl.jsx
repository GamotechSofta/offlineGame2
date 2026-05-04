import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { clearAdminSession, fetchWithAuth } from '../lib/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';
const RESULT_CONTROL_UNLOCK_SESSION_KEY = 'offlinebookie:admin:3d-result-control-unlock';
const setLabelByQuizId = {
    1: 'Set A',
    2: 'Set B',
    3: 'Set C',
};
const todayDate = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const formatSlotLabel = (slot) => slot?.drawLabelEnd || slot?.slotStartIso || '-';
const formatHousePl = (value) => {
    if (value == null || !Number.isFinite(Number(value))) {
        return { text: 'P/L: —', className: 'text-gray-400' };
    }
    const n = Math.round(Number(value));
    if (n >= 0) {
        return { text: `P/L: +₹${n.toLocaleString('en-IN')}`, className: 'text-green-700' };
    }
    return { text: `P/L: -₹${Math.abs(n).toLocaleString('en-IN')}`, className: 'text-red-700' };
};

const ThreeDResultControl = () => {
    const navigate = useNavigate();
    const [date, setDate] = useState(todayDate());
    const [slots, setSlots] = useState([]);
    const [currentSlotStartIso, setCurrentSlotStartIso] = useState('');
    const [currentSlotPhase, setCurrentSlotPhase] = useState('');
    const [currentHintRows, setCurrentHintRows] = useState([]);
    const [manualModal, setManualModal] = useState({ open: false, slotStartIso: '', quizId: '1', result: '' });
    const [manualSaving, setManualSaving] = useState(false);
    const [manualError, setManualError] = useState('');
    const [hasSecretDeclarePassword, setHasSecretDeclarePassword] = useState(false);
    const [pagePassword, setPagePassword] = useState('');
    const [pageUnlocked, setPageUnlocked] = useState(false);
    const [unlockingPage, setUnlockingPage] = useState(false);
    const [pageUnlockError, setPageUnlockError] = useState('');
    const [loading, setLoading] = useState(true);
    const [hintsLoading, setHintsLoading] = useState(true);
    const [secretCheckComplete, setSecretCheckComplete] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [slotDetailMap, setSlotDetailMap] = useState({});

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
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/slots?${params.toString()}`);
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
        if (!silent) setHintsLoading(true);
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/current-slot`);
            if (res.status === 401) return;
            const json = await res.json();
            if (!json?.success) {
                setCurrentSlotStartIso('');
                setCurrentHintRows([]);
                return;
            }
            const iso = json?.data?.slot?.slotStartIso || '';
            const phase = json?.data?.slot?.phase || '';
            setCurrentSlotStartIso(iso);
            setCurrentSlotPhase(phase);
            if (!iso) {
                setCurrentHintRows([]);
                return;
            }
            const detailRes = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/slots/${encodeURIComponent(iso)}/detail`);
            if (detailRes.status === 401) return;
            const detailJson = await detailRes.json();
            if (!detailJson?.success) {
                setCurrentHintRows([]);
                return;
            }
            const rows = Array.isArray(detailJson?.data?.perQuiz)
                ? detailJson.data.perQuiz.map((row) => ({
                    quizId: row.quizId,
                    hint: row.result == null ? '--' : String(row.result).padStart(3, '0'),
                    houseNetIfHintWins: row.houseNetIfHintWins,
                }))
                : [];
            setCurrentHintRows(rows);
        } catch {
            setCurrentSlotStartIso('');
            setCurrentSlotPhase('');
            setCurrentHintRows([]);
        } finally {
            if (!silent) setHintsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!secretCheckComplete) return;
        if (hasSecretDeclarePassword && !pageUnlocked) return;
        // Quick initial load for faster first paint, then hydrate full day rows in background.
        fetchSlots(date, { limit: 24 });
        fetchSlots(date, { silent: true, limit: 96 });
    }, [fetchSlots, date, hasSecretDeclarePassword, pageUnlocked, secretCheckComplete]);

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

    const unlockPage = useCallback(async () => {
        const secret = pagePassword.trim();
        if (!secret) {
            setPageUnlockError('Please enter security password');
            return;
        }
        setUnlockingPage(true);
        setPageUnlockError('');
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/current-slot/hints`, {
                method: 'POST',
                body: JSON.stringify({ secretDeclarePassword: secret }),
            });
            if (res.status === 401) return;
            const data = await res.json();
            if (!data?.success) throw new Error(data?.message || 'Invalid security password');
            setPageUnlocked(true);
            setPagePassword('');
            try {
                sessionStorage.setItem(RESULT_CONTROL_UNLOCK_SESSION_KEY, '1');
            } catch {
                // ignore storage write errors
            }
            await fetchCurrentSlotForHints();
        } catch (err) {
            setPageUnlocked(false);
            setPageUnlockError(err?.message || 'Invalid security password');
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
        if (!Number.isInteger(quizId) || ![1, 2, 3].includes(quizId)) {
            setManualError('Set must be A, B or C.');
            return;
        }
        if (!/^\d{1,3}$/.test(resultText) || !Number.isInteger(result) || result < 0 || result > 999) {
            setManualError('Result must be between 000 and 999.');
            return;
        }

        setManualSaving(true);
        setManualError('');
        setError('');
        setNotice('');
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/slots/${encodeURIComponent(slotStartIso)}/result`, {
                method: 'PATCH',
                body: JSON.stringify({ quizId, result }),
            });
            if (res.status === 401) return;
            const data = await res.json();
            if (!data?.success) throw new Error(data?.message || 'Failed to set manual result');

            const padded = String(result).padStart(3, '0');
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
            setNotice(`Manual result set for ${setLabelByQuizId[quizId] || `Set ${quizId}`} = ${padded}.`);
            await fetchCurrentSlotForHints({ silent: true });
            closeManualModal();
        } catch (err) {
            setManualError(err?.message || 'Failed to set manual result');
        } finally {
            setManualSaving(false);
        }
    }, [manualModal, closeManualModal, fetchCurrentSlotForHints]);

    const sortedSlots = useMemo(() => (
        [...slots].sort((a, b) => String(b.slotStartIso || '').localeCompare(String(a.slotStartIso || '')))
    ), [slots]);

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
                        const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/slots/${encodeURIComponent(slotStartIso)}/detail`);
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
        <AdminLayout onLogout={handleLogout} title="3D Result Control">
            <div className="relative min-h-[60vh] space-y-5">
                <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">3D Result Declaration Control</h1>
                        <p className="text-sm text-gray-500">Simple flow: set running slot results, then review history.</p>
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
                                Use <span className="font-semibold text-gray-600">View all bets</span> on a set to open its full betting breakdown (every number) for this slot.
                            </p>
                            {hintsLoading ? (
                                <p className="mt-3 text-xs text-gray-500">Loading running slot...</p>
                            ) : currentHintRows.length ? (
                                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {currentHintRows.map((item) => (
                                        (() => {
                                            const pl = formatHousePl(item.houseNetIfHintWins);
                                            const qid = String(item.quizId);
                                            const goToBetHistory = () => {
                                                if (!currentSlotStartIso) return;
                                                navigate(`/3d-management/set/${qid}/stake?slotStartIso=${encodeURIComponent(currentSlotStartIso)}`);
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
                                                title="Open number-wise betting breakdown for this set"
                                            >
                                                <div className="flex justify-between gap-1 items-baseline">
                                                    <span className="text-gray-500 shrink-0">{setLabelByQuizId[Number(item.quizId)] || `Set ${item.quizId}`}</span>
                                                    <span className="font-mono font-semibold text-gray-800">{item.hint}</span>
                                                </div>
                                                <div className={`mt-0.5 text-[10px] font-semibold ${pl.className}`}>{pl.text}</div>
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
                            <h2 className="text-base font-semibold text-gray-800">Step 2: Slot history (latest first)</h2>
                            <p className="text-xs text-gray-500 mt-1">Simple table view: one slot per row with all set results.</p>
                            {!sortedSlots.length && !loading ? (
                                <p className="mt-3 text-sm text-gray-500">No slots found for selected date.</p>
                            ) : (
                                <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
                                    <table className="w-full min-w-[760px] text-xs">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr className="text-gray-600">
                                                <th className="text-left p-2.5 font-semibold">Slot</th>
                                                <th className="text-left p-2.5 font-semibold">Status</th>
                                                <th className="text-center p-2.5 font-semibold">Set A</th>
                                                <th className="text-center p-2.5 font-semibold">Set B</th>
                                                <th className="text-center p-2.5 font-semibold">Set C</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedSlots.map((slot) => {
                                                const declared = Boolean(slot?.declaration?.declared);
                                                const isRunning = Boolean(currentSlotStartIso) && slot.slotStartIso === currentSlotStartIso && !slot?.isCompleted;
                                                const canManualResult = !declared && isRunning && currentSlotPhase === 'study';
                                                return (
                                                    <tr key={slot.slotStartIso} className="border-b border-gray-200 last:border-b-0">
                                                        <td className="p-2.5 align-top">
                                                            <div className="font-semibold text-gray-800">{formatSlotLabel(slot)}</div>
                                                            <div className="text-[11px] text-gray-500 mt-0.5">{slot.slotStartIso}</div>
                                                        </td>
                                                        <td className="p-2.5 align-top">
                                                            <div className="flex flex-col items-start gap-1">
                                                                <span className={`text-[10px] px-2 py-1 rounded-full font-semibold ${declared ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                                                    {declared ? 'Declared' : 'Pending'}
                                                                </span>
                                                                {isRunning ? <span className="text-[10px] px-2 py-1 rounded-full bg-orange-100 text-orange-700 font-semibold">Running Slot</span> : null}
                                                            </div>
                                                        </td>
                                                        {[1, 2, 3].map((quizId) => {
                                                            const q = (slot?.perQuiz || []).find((row) => Number(row.quizId) === quizId);
                                                            const detailQuiz = (slotDetailMap?.[slot.slotStartIso]?.perQuiz || []).find((row) => Number(row.quizId) === quizId);
                                                            const visibleResultLabel = (slot?.isCompleted || isRunning) ? (q?.resultLabel || '--') : '--';
                                                            const pl = formatHousePl(detailQuiz?.houseNetIfHintWins ?? q?.houseNetIfHintWins);
                                                            return (
                                                                <td key={`${slot.slotStartIso}-${quizId}`} className="p-2.5 text-center align-top">
                                                                    <div className="font-mono text-sm font-semibold text-gray-800">{visibleResultLabel}</div>
                                                                    <div className={`text-[10px] mt-0.5 ${q?.declared ? 'text-green-600' : 'text-gray-500'}`}>
                                                                        {q?.declared ? 'Declared' : 'Not declared'}
                                                                    </div>
                                                                    <div className={`text-[10px] mt-0.5 font-semibold ${pl.className}`}>{pl.text}</div>
                                                                    {canManualResult ? (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => openManualModal(slot.slotStartIso, String(quizId), q?.resultLabel || '--')}
                                                                            className="mt-1.5 inline-flex px-2 py-0.5 rounded border border-purple-300 text-[10px] text-purple-700 font-semibold hover:bg-purple-50"
                                                                        >
                                                                            Set
                                                                        </button>
                                                                    ) : null}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
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
                                    <span className="block mb-1 font-medium">Set</span>
                                    <select
                                        value={manualModal.quizId}
                                        onChange={(e) => setManualModal((prev) => ({ ...prev, quizId: e.target.value }))}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300"
                                    >
                                        <option value="1">Set A</option>
                                        <option value="2">Set B</option>
                                        <option value="3">Set C</option>
                                    </select>
                                </label>
                                <label className="text-sm text-gray-700">
                                    <span className="block mb-1 font-medium">Result (000-999)</span>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={3}
                                        value={manualModal.result}
                                        onChange={(e) => setManualModal((prev) => ({ ...prev, result: e.target.value.replace(/\D/g, '').slice(0, 3) }))}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300"
                                        placeholder="000"
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

export default ThreeDResultControl;

