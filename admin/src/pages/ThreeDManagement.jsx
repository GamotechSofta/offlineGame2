import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { clearAdminSession, fetchWithAuth } from '../lib/auth';
import CurrentSlotOverview from '../components/twoDManagement/CurrentSlotOverview';
import ThreeDAggregateStatsCard from '../components/threeDManagement/ThreeDAggregateStatsCard';
import { getTodayIST } from '../utils/istDate';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const ThreeDManagement = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const currentSlotIsoRef = useRef('');

    const [currentSlotData, setCurrentSlotData] = useState(null);
    const [loadingCurrent, setLoadingCurrent] = useState(true);
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

    const [timingForm, setTimingForm] = useState({ studyMinutes: '14.5', questionRevealStaggerMs: '810' });
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

    const handleLogout = useCallback(() => {
        clearAdminSession();
        navigate('/');
    }, [navigate]);

    const getThreeDQuizLabel = useCallback((quizId) => {
        const map = { 1: 'Set A', 2: 'Set B', 3: 'Set C' };
        return map[Number(quizId)] || `Q${String(quizId).padStart(2, '0')}`;
    }, []);

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
    }, []);

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
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/aggregate-stats${q}`);
            if (res.status === 401) return;
            const data = await res.json();
            if (!data?.success) throw new Error(data?.message || 'Failed to load 3D aggregate stats');
            setAggregateStats(data.data || null);
        } catch (err) {
            setAggregateStatsError(err.message || 'Failed to load 3D aggregate stats');
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
    }, []);

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
    }, []);

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
    }, [fetchCurrent, navigate]);

    useEffect(() => {
        fetchAggregateStats();
    }, [fetchAggregateStats]);

    useEffect(() => {
        currentSlotIsoRef.current = currentSlotData?.slot?.slotStartIso || '';
    }, [currentSlotData?.slot?.slotStartIso]);

    useEffect(() => {
        if (hasSecretDeclarePassword) {
            setTimingUnlocked(false);
            setTimingUnlockedSecret('');
            return;
        }
        fetchTimingSettings('');
    }, [hasSecretDeclarePassword, fetchTimingSettings]);

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

    useQuery({
        queryKey: ['3d-management-current'],
        queryFn: async () => {
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/current-slot`);
            if (res.status === 401) return null;
            const data = await res.json();
            if (!data?.success) throw new Error(data?.message || 'Failed to load current slot');
            return data.data || null;
        },
        enabled: !!localStorage.getItem('admin'),
        staleTime: Infinity,
        refetchOnMount: false,
        refetchInterval: false,
        onSuccess: (data) => {
            setCurrentSlotData(data);
            setLoadingCurrent(false);
        },
    });

    return (
        <AdminLayout onLogout={handleLogout} title="3D Management">
            <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">3D Management</h1>
                        <p className="text-sm text-gray-500">Current slot, old slot results, edit and set-wise ticket analytics.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            fetchCurrent();
                            fetchAggregateStats();
                            queryClient.invalidateQueries({ queryKey: ['3d-management-current'] });
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

                <ThreeDAggregateStatsCard
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
                    onEditHint={() => {}}
                    quizLabelFormatter={getThreeDQuizLabel}
                />

                <div className="rounded-xl border border-gray-200 bg-white p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h3 className="text-base font-semibold text-gray-800">All User Tickets</h3>
                        <p className="text-sm text-gray-500">Open ticket-wise list with username, bet count and total stake.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate('/3d-management/tickets')}
                        className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                    >
                        Open Tickets Page
                    </button>
                </div>
            </div>
        </AdminLayout>
    );
};

export default ThreeDManagement;
