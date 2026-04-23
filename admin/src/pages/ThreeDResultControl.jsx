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

const ThreeDResultControl = () => {
    const navigate = useNavigate();
    const [date, setDate] = useState(todayDate());
    const [slots, setSlots] = useState([]);
    const [currentSlotStartIso, setCurrentSlotStartIso] = useState('');
    const [currentHintRows, setCurrentHintRows] = useState([]);
    const [hasSecretDeclarePassword, setHasSecretDeclarePassword] = useState(false);
    const [pagePassword, setPagePassword] = useState('');
    const [pageUnlocked, setPageUnlocked] = useState(false);
    const [unlockingPage, setUnlockingPage] = useState(false);
    const [pageUnlockError, setPageUnlockError] = useState('');
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const handleLogout = useCallback(() => {
        clearAdminSession();
        navigate('/');
    }, [navigate]);

    const fetchSlots = useCallback(async (targetDate = date) => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({ date: targetDate, limit: '96' });
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/slots?${params.toString()}`);
            if (res.status === 401) return;
            const data = await res.json();
            if (!data?.success) throw new Error(data?.message || 'Failed to load slots');
            setSlots(Array.isArray(data?.data?.slots) ? data.data.slots : []);
        } catch (err) {
            setError(err.message || 'Failed to load slots');
            setSlots([]);
        } finally {
            setLoading(false);
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
            .catch(() => {});
    }, []);

    const fetchCurrentSlotForHints = useCallback(async () => {
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
            setCurrentSlotStartIso(iso);
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
                }))
                : [];
            setCurrentHintRows(rows);
        } catch {
            setCurrentSlotStartIso('');
            setCurrentHintRows([]);
        }
    }, []);

    useEffect(() => {
        if (!hasSecretDeclarePassword || pageUnlocked) {
            fetchSlots(date);
            fetchCurrentSlotForHints();
        }
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
        } catch (err) {
            setPageUnlocked(false);
            setPageUnlockError(err?.message || 'Invalid security password');
        } finally {
            setUnlockingPage(false);
        }
    }, [pagePassword]);

    const updateDeclaration = useCallback(async (slotStartIso, action) => {
        if (!slotStartIso) return;
        setUpdating(true);
        setError('');
        setNotice('');
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/slots/declaration`, {
                method: 'PATCH',
                body: JSON.stringify({ slotStartIso, action }),
            });
            if (res.status === 401) return;
            const data = await res.json();
            if (!data?.success) throw new Error(data?.message || 'Failed to update declaration');
            setSlots((prev) => prev.map((slot) => (
                slot.slotStartIso === slotStartIso
                    ? {
                        ...slot,
                        declaration: data?.data?.declaration || slot.declaration || null,
                        perQuiz: Array.isArray(slot.perQuiz)
                            ? slot.perQuiz.map((q) => ({
                                ...q,
                                declared: Boolean(data?.data?.declaration?.declared),
                            }))
                            : slot.perQuiz,
                    }
                    : slot
            )));
            setNotice(action === 'declare' ? 'Result declared successfully.' : 'Auto declare preference updated.');
        } catch (err) {
            setError(err.message || 'Failed to update declaration');
        } finally {
            setUpdating(false);
        }
    }, []);

    return (
        <AdminLayout onLogout={handleLogout} title="3D Result Control">
            <div className="space-y-5">
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
                                    {currentHintRows.map((item) => (
                                        <button
                                            key={item.quizId}
                                            type="button"
                                            onClick={() => {
                                                if (!currentSlotStartIso) return;
                                                navigate(`/3d-management?slotStartIso=${encodeURIComponent(currentSlotStartIso)}`);
                                            }}
                                            disabled={!currentSlotStartIso}
                                            className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-left hover:border-orange-400 hover:bg-orange-50/50 hover:shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
                                            title={currentSlotStartIso ? 'Open slot management details' : 'Current slot unavailable'}
                                        >
                                            <span className="text-gray-500">{setLabelByQuizId[Number(item.quizId)] || `Set ${item.quizId}`}</span>
                                            <span className="float-right font-mono font-semibold text-gray-800">{item.hint}</span>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-gray-500">Hint numbers unavailable for current slot.</p>
                            )}
                        </div>

                        <div className="bg-white border border-gray-200 rounded-xl p-5">
                            <div className="overflow-x-auto">
                                <table className="min-w-[900px] w-full text-xs">
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
                                            const paused = Boolean(slot?.declaration?.autoDeclareBlocked) && !declared;
                                            return (
                                                <tr key={slot.slotStartIso} className="border-b border-gray-100">
                                                    <td className="p-2">
                                                        <div className="font-semibold text-gray-800">{slot.drawLabelEnd || slot.slotStartIso}</div>
                                                        <div className="text-gray-500">{slot.slotStartIso}</div>
                                                    </td>
                                                    <td className="p-2">
                                                        <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${declared
                                                            ? 'bg-green-100 text-green-700'
                                                            : (paused ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700')}`}
                                                        >
                                                            {declared ? 'Declared' : (paused ? 'Paused' : 'Auto')}
                                                        </span>
                                                    </td>
                                                    <td className="p-2">
                                                        {declared ? (
                                                            <span className="text-[11px] text-gray-500 font-medium">Locked</span>
                                                        ) : (
                                                            <div className="flex flex-col gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateDeclaration(slot.slotStartIso, 'hold')}
                                                                    disabled={updating}
                                                                    className="px-2 py-1 rounded border border-amber-300 text-amber-700 hover:bg-amber-50 font-semibold disabled:opacity-60"
                                                                >
                                                                    Hold Auto Declare
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateDeclaration(slot.slotStartIso, 'auto')}
                                                                    disabled={updating}
                                                                    className="px-2 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 font-semibold disabled:opacity-60"
                                                                >
                                                                    Enable Auto Declare
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateDeclaration(slot.slotStartIso, 'declare')}
                                                                    disabled={updating || !slot?.isCompleted}
                                                                    className="px-2 py-1 rounded bg-green-600 hover:bg-green-700 text-white font-semibold disabled:bg-green-400"
                                                                >
                                                                    {slot?.isCompleted ? 'Declare' : 'Wait Slot End'}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                    {[1, 2, 3].map((quizId) => {
                                                        const q = (slot?.perQuiz || []).find((row) => Number(row.quizId) === quizId);
                                                        return (
                                                            <td key={`${slot.slotStartIso}-${quizId}`} className="p-2 text-center">
                                                                <div className="font-mono text-gray-800">{q?.resultLabel || '--'}</div>
                                                                <div className={`text-[10px] ${q?.declared ? 'text-green-600' : 'text-red-500'}`}>
                                                                    {q?.declared ? 'Declared' : 'Not'}
                                                                </div>
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
        </AdminLayout>
    );
};

export default ThreeDResultControl;

