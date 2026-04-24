import React, { useCallback, useEffect, useState } from 'react';
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

/** House P/L if the current hint number wins (total stake on set − payout on that number). */
function hintHouseNetMeta(value) {
    if (value == null || !Number.isFinite(Number(value))) {
        return { text: 'P/L: —', className: 'text-gray-400', title: '' };
    }
    const n = Math.round(Number(value));
    if (n >= 0) {
        return {
            text: `P/L: +₹${n.toLocaleString('en-IN')}`,
            className: 'text-green-700',
            title: 'House keeps this much if this hint number wins (after paying winners on this number).',
        };
    }
    return {
        text: `P/L: −₹${Math.abs(n).toLocaleString('en-IN')}`,
        className: 'text-red-700',
        title: 'House pays out more than collected on this number if it wins.',
    };
}

const ThreeDResultControl = () => {
    const navigate = useNavigate();
    const [date, setDate] = useState(todayDate());
    const [slots, setSlots] = useState([]);
    const [currentSlotStartIso, setCurrentSlotStartIso] = useState('');
    const [currentSlotPhase, setCurrentSlotPhase] = useState('');
    const [currentHintRows, setCurrentHintRows] = useState([]);
    const [manualModal, setManualModal] = useState({ open: false, slotStartIso: '', quizId: '1', result: '' });
    const [manualSetModeSlots, setManualSetModeSlots] = useState({});
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

    const enableManualSetMode = useCallback((slotStartIso) => {
        if (!slotStartIso) return;
        setManualSetModeSlots((prev) => ({ ...prev, [slotStartIso]: true }));
        setNotice('Select "Set" under Set A/B/C columns to add manual results.');
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

    return (
        <AdminLayout onLogout={handleLogout} title="3D Result Control">
            <div className="relative min-h-[60vh] space-y-5">
                <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">3D Result Declaration Control</h1>
                        <p className="text-sm text-gray-500">All slots chart with set-wise result and declaration controls.</p>
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
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <p className="text-sm font-bold text-gray-700">
                                    Running Slot <span className="text-red-500">Hint Numbers</span>
                                </p>
                                <span className="text-[11px] font-medium text-green-600">Visible</span>
                            </div>
                            <p className="text-xs text-gray-500 mb-3 break-all">Slot Start: {currentSlotStartIso || '-'}</p>
                            {currentHintRows.length ? (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {currentHintRows.map((item) => {
                                        const pl = hintHouseNetMeta(item.houseNetIfHintWins);
                                        return (
                                            <button
                                                key={item.quizId}
                                                type="button"
                                                onClick={() => {
                                                    if (!currentSlotStartIso) return;
                                                    navigate(
                                                        `/3d-management/set/${encodeURIComponent(item.quizId)}/stake?slotStartIso=${encodeURIComponent(currentSlotStartIso)}`,
                                                    );
                                                }}
                                                disabled={!currentSlotStartIso}
                                                className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-left hover:border-orange-400 hover:bg-orange-50/50 hover:shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
                                                title={currentSlotStartIso ? 'Open set-wise stake / P/L' : 'Current slot unavailable'}
                                            >
                                                <div className="flex justify-between gap-1 items-baseline">
                                                    <span className="text-gray-500 shrink-0">{setLabelByQuizId[Number(item.quizId)] || `Set ${item.quizId}`}</span>
                                                    <span className="font-mono font-semibold text-gray-800">{item.hint}</span>
                                                </div>
                                                <div className={`mt-1 text-[10px] font-semibold leading-tight ${pl.className}`} title={pl.title || undefined}>
                                                    {pl.text}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-xs text-gray-500">Hint numbers unavailable for current slot.</p>
                            )}
                        </div>

                        <div className="bg-white border border-gray-200 rounded-xl p-5">
                            <div className="max-h-[calc(100vh-100px)] overflow-y-auto">
                                <table className="w-full text-xs table-fixed">
                                    <thead>
                                        <tr className="border-b border-gray-200 text-gray-600 bg-gray-50">
                                            <th className="text-left p-2">Slot</th>
                                            <th className="text-left p-2">Declared</th>
                                            <th className="text-left p-2">Actions</th>
                                            {[1, 2, 3].map((quizId) => (
                                                <th key={quizId} className="text-center p-2 whitespace-nowrap">{setLabelByQuizId[quizId]}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {!slots.length && !loading ? (
                                            <tr>
                                                <td colSpan={6} className="text-center p-4 text-gray-500">No slots found for selected date.</td>
                                            </tr>
                                        ) : null}
                                        {slots.map((slot) => {
                                            const declared = Boolean(slot?.declaration?.declared);
                                            const isCurrentRunningSlot = Boolean(currentSlotStartIso) && slot.slotStartIso === currentSlotStartIso && !slot?.isCompleted;
                                            const canManualResult = !declared && isCurrentRunningSlot && currentSlotPhase === 'study';
                                            const showManualSetOptions = canManualResult && manualSetModeSlots[slot.slotStartIso];
                                            return (
                                                <tr key={slot.slotStartIso} className="border-b border-black">
                                                    <td className="p-2">
                                                        <div className="font-semibold text-gray-800">{slot.drawLabelEnd || slot.slotStartIso}</div>
                                                        <div className="text-gray-500">{slot.slotStartIso}</div>
                                                    </td>
                                                    <td className="p-2">
                                                        <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${declared
                                                            ? 'bg-green-100 text-green-700'
                                                            : 'bg-gray-100 text-gray-700'}`}
                                                        >
                                                            {declared ? 'Declared' : 'Not'}
                                                        </span>
                                                    </td>
                                                    <td className="p-2">
                                                        {declared ? (
                                                            <span className="text-[11px] text-gray-500 font-medium">Locked</span>
                                                        ) : canManualResult ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => enableManualSetMode(slot.slotStartIso)}
                                                                className="px-2 py-1 rounded border border-purple-300 text-purple-700 hover:bg-purple-50 font-semibold"
                                                            >
                                                                Manual Result
                                                            </button>
                                                        ) : (
                                                            <span className="text-[11px] text-gray-400">—</span>
                                                        )}
                                                    </td>
                                                    {[1, 2, 3].map((quizId) => {
                                                        const q = (slot?.perQuiz || []).find((row) => Number(row.quizId) === quizId);
                                                        return (
                                                            <td key={`${slot.slotStartIso}-${quizId}`} className="p-2 text-center">
                                                                <div className="font-mono text-gray-800">{q?.resultLabel || '--'}</div>
                                                                <div className={`text-[9px] leading-tight ${q?.declared ? 'text-green-600' : 'text-gray-600'}`}>
                                                                    {q?.declared ? 'Declared' : 'Not'}
                                                                </div>
                                                                {showManualSetOptions ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openManualModal(slot.slotStartIso, String(quizId), q?.resultLabel || '--')}
                                                                        className="mt-1 px-1.5 py-0.5 rounded border border-purple-300 text-[10px] leading-none font-semibold text-purple-700 hover:bg-purple-50"
                                                                        title="Set manual result for this set"
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

