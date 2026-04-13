import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
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
    const [editState, setEditState] = useState({ quizId: '', result: '' });
    const [loadingCurrent, setLoadingCurrent] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [savingResult, setSavingResult] = useState(false);
    const [activeSection, setActiveSection] = useState('oldSlots');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const detailSectionRef = useRef(null);

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
                const first = slots[0].slotStartIso;
                setSelectedSlot((prev) => prev || first);
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
        fetchCurrent();
    }, [fetchCurrent, navigate]);

    useEffect(() => {
        fetchHistory(date);
    }, [date, fetchHistory]);

    useEffect(() => {
        if (selectedSlot) fetchDetail(selectedSlot);
    }, [selectedSlot, fetchDetail]);

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

    const onSaveResult = async () => {
        setNotice('');
        setError('');
        const quizId = Number(editState.quizId);
        const result = Number(editState.result);
        if (!selectedSlot) return setError('Please select a slot first.');
        if (!Number.isInteger(quizId) || quizId < 1 || quizId > 30) return setError('Quiz ID must be between 1 and 30.');
        if (!Number.isInteger(result) || result < 0 || result > 99) return setError('Result must be between 00 and 99.');

        setSavingResult(true);
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/slots/${encodeURIComponent(selectedSlot)}/result`, {
                method: 'PATCH',
                body: JSON.stringify({ quizId, result }),
            });
            if (res.status === 401) return;
            const data = await res.json();
            if (!data?.success) throw new Error(data?.message || 'Failed to update result');
            setNotice(`Quiz ${String(quizId).padStart(2, '0')} result updated to ${String(result).padStart(2, '0')}.`);
            await fetchDetail(selectedSlot);
            await fetchCurrent();
        } catch (err) {
            setError(err.message || 'Failed to update result');
        } finally {
            setSavingResult(false);
        }
    };

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

                <CurrentSlotOverview data={currentSlotData} loading={loadingCurrent} />

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
                            <div className="flex flex-wrap items-center gap-2">
                                <label className="text-sm font-medium text-gray-700">History Date</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="px-3 py-2 rounded-lg border border-gray-300"
                                />
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
                        {loadingDetail ? (
                            <div className="bg-white border border-gray-200 rounded-xl p-5 text-sm text-gray-500">Loading slot detail...</div>
                        ) : detailData?.perQuiz ? (
                            <QuizSlotStatsTable
                                rows={detailData.perQuiz}
                                onEditResult={(quizId, result) => setEditState({ quizId: String(quizId), result: result == null ? '' : String(result) })}
                            />
                        ) : (
                            <div className="bg-white border border-gray-200 rounded-xl p-5 text-sm text-gray-500">
                                Please select a slot from Old Slots to view quiz-wise stats.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
};

export default TwoDManagement;
