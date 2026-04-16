import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaChevronDown } from 'react-icons/fa';
import AdminLayout from '../components/AdminLayout';
import useModalBackHandler from '../hooks/useModalBackHandler';
import { clearAdminSession, fetchWithAuth } from '../lib/auth';
import CurrentSlotOverview from '../components/twoDManagement/CurrentSlotOverview';
import SlotHistoryTable from '../components/twoDManagement/SlotHistoryTable';
import QuizSlotStatsTable from '../components/twoDManagement/QuizSlotStatsTable';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const todayDate = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const TwoDManagement = () => {
    const navigate = useNavigate();
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
    const detailSectionRef = useRef(null);
    const timeDropdownRef = useRef(null);
    const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);
    const closeEditHintModal = useModalBackHandler(showEditHintModal, () => {
        setShowEditHintModal(false);
        setEditHintForm({ quizId: '', result: '' });
        setEditHintError('');
    });

    const handleLogout = useCallback(() => {
        clearAdminSession();
        navigate('/');
    }, [navigate]);

    const fetchCurrent = useCallback(async () => {
        setLoadingCurrent(true);
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/current-slot`);
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
    }, [fetchCurrent, navigate]);

    useEffect(() => {
        fetchHistory(date);
    }, [date, fetchHistory]);

    useEffect(() => {
        if (selectedSlot) fetchDetail(selectedSlot);
    }, [selectedSlot, fetchDetail]);

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

        if (!/^\d{1,2}$/.test(trimmed) || !Number.isInteger(result) || result < 0 || result > 99) {
            setEditHintError('Result must be between 00 and 99.');
            return;
        }
        if (!currentSlotData?.slot?.slotStartIso) {
            setEditHintError('Current slot is not available.');
            return;
        }

        setSavingResult(true);
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/slots/${encodeURIComponent(currentSlotData.slot.slotStartIso)}/result`, {
                method: 'PATCH',
                body: JSON.stringify({ quizId, result }),
            });
            if (res.status === 401) return;
            const data = await res.json();
            if (!data?.success) throw new Error(data?.message || 'Failed to update result');
            setNotice(`Running slot Quiz ${String(quizId).padStart(2, '0')} hint updated to ${String(result).padStart(2, '0')}.`);
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
                        onClick={fetchCurrent}
                        className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                    >
                        Refresh Current Slot
                    </button>
                </div>

                {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div> : null}
                {notice ? <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">{notice}</div> : null}

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
                />

                <div className="bg-white border border-gray-200 rounded-xl p-2">
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveSection('oldSlots')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                                activeSection === 'oldSlots'
                                    ? 'bg-orange-500 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            Old Slots
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveSection('quizStats')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                                activeSection === 'quizStats'
                                    ? 'bg-orange-500 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            Quiz-wise Slot Stats
                        </button>
                    </div>
                </div>

                {activeSection === 'oldSlots' ? (
                    <>
                        <div className="bg-white border border-gray-200 rounded-xl p-5">
                            <div className="flex flex-wrap items-end gap-4">
                                <div className="min-w-[180px]">
                                    <label className="mb-1 block text-sm font-medium text-gray-700">History Date</label>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={(e) => {
                                            setDate(e.target.value);
                                            setNotice('');
                                            setError('');
                                            setIsTimeDropdownOpen(false);
                                        }}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300"
                                    />
                                </div>
                                <div ref={timeDropdownRef} className="min-w-[220px] flex-1 relative">
                                    <label className="mb-1 block text-sm font-medium text-gray-700">History Time Slot</label>
                                    <button
                                        type="button"
                                        onClick={() => historySlots.length && setIsTimeDropdownOpen((prev) => !prev)}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-left flex items-center justify-between gap-3 disabled:bg-gray-50 disabled:text-gray-400"
                                        disabled={!historySlots.length}
                                    >
                                        <span>{selectedSlotMeta?.drawLabelEnd || 'No slots available for selected date'}</span>
                                        <FaChevronDown
                                            className={`text-xs text-gray-500 transition-transform ${isTimeDropdownOpen ? 'rotate-180' : ''}`}
                                        />
                                    </button>
                                    {isTimeDropdownOpen && historySlots.length ? (
                                        <div className="absolute z-20 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                                            <div className="max-h-64 overflow-y-auto py-1">
                                                {historySlots.map((slot) => {
                                                    const active = slot.slotStartIso === selectedSlot;
                                                    return (
                                                        <button
                                                            key={slot.slotStartIso}
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedSlot(slot.slotStartIso);
                                                                setNotice('');
                                                                setError('');
                                                                setIsTimeDropdownOpen(false);
                                                            }}
                                                            className={`w-full px-3 py-2 text-left text-sm transition ${
                                                                active ? 'bg-orange-50 text-orange-600 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                                                            }`}
                                                        >
                                                            {slot.drawLabelEnd}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        <SlotHistoryTable
                            slots={historySlots}
                            selectedSlot={selectedSlot}
                            onSelectSlot={handleSelectSlot}
                            loading={loadingHistory}
                        />
                    </>
                ) : (
                    <div ref={detailSectionRef} className="space-y-5">
                        <div className="bg-white border border-gray-200 rounded-xl p-5">
                            <div className="flex flex-wrap items-end gap-4">
                                <div className="min-w-[180px]">
                                    <label className="mb-1 block text-sm font-medium text-gray-700">Filter Date</label>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={(e) => {
                                            setDate(e.target.value);
                                            setNotice('');
                                            setError('');
                                            setIsTimeDropdownOpen(false);
                                        }}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300"
                                    />
                                </div>
                                <div ref={timeDropdownRef} className="min-w-[220px] flex-1 relative">
                                    <label className="mb-1 block text-sm font-medium text-gray-700">Filter Time Slot</label>
                                    <button
                                        type="button"
                                        onClick={() => historySlots.length && setIsTimeDropdownOpen((prev) => !prev)}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-left flex items-center justify-between gap-3 disabled:bg-gray-50 disabled:text-gray-400"
                                        disabled={!historySlots.length}
                                    >
                                        <span>{selectedSlotMeta?.drawLabelEnd || 'No slots available for selected date'}</span>
                                        <FaChevronDown
                                            className={`text-xs text-gray-500 transition-transform ${isTimeDropdownOpen ? 'rotate-180' : ''}`}
                                        />
                                    </button>
                                    {isTimeDropdownOpen && historySlots.length ? (
                                        <div className="absolute z-20 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                                            <div className="max-h-64 overflow-y-auto py-1">
                                                {historySlots.map((slot) => {
                                                    const active = slot.slotStartIso === selectedSlot;
                                                    return (
                                                        <button
                                                            key={slot.slotStartIso}
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedSlot(slot.slotStartIso);
                                                                setNotice('');
                                                                setError('');
                                                                setIsTimeDropdownOpen(false);
                                                            }}
                                                            className={`w-full px-3 py-2 text-left text-sm transition ${
                                                                active ? 'bg-orange-50 text-orange-600 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                                                            }`}
                                                        >
                                                            {slot.drawLabelEnd}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                                {selectedSlotMeta ? (
                                    <div className="text-sm text-gray-500">
                                        Showing stats for <span className="font-semibold text-gray-700">{selectedSlotMeta.drawLabelEnd}</span>
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        {loadingDetail ? (
                            <div className="bg-white border border-gray-200 rounded-xl p-5 text-sm text-gray-500">Loading slot detail...</div>
                        ) : detailData?.perQuiz ? (
                            <QuizSlotStatsTable
                                rows={detailData.perQuiz}
                                canEdit={false}
                            />
                        ) : (
                            <div className="bg-white border border-gray-200 rounded-xl p-5 text-sm text-gray-500">
                                Please select a slot from Old Slots to view quiz-wise stats.
                            </div>
                        )}
                    </div>
                )}
            </div>
            {showEditHintModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-md">
                        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-orange-500">
                                Edit Running Hint for Quiz{String(editHintForm.quizId || '').padStart(2, '0')}
                            </h3>
                            <button type="button" onClick={closeEditHintModal} className="text-gray-400 hover:text-gray-800 p-1">×</button>
                        </div>
                        <form onSubmit={submitEditCurrentHint} className="p-4 space-y-4">
                            <p className="text-gray-600 text-sm">
                                Enter a new hint number between 00 and 99 for the current running slot.
                            </p>
                            <input
                                type="text"
                                inputMode="numeric"
                                maxLength={2}
                                placeholder="00"
                                value={editHintForm.result}
                                onChange={(e) => {
                                    setEditHintForm((prev) => ({ ...prev, result: e.target.value.replace(/\D/g, '').slice(0, 2) }));
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

export default TwoDManagement;
