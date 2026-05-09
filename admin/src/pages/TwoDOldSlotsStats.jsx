import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { clearAdminSession, fetchWithAuth } from '../lib/auth';
import OldSlotsSection from '../components/twoDManagement/OldSlotsSection';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const todayDate = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const TwoDOldSlotsStats = () => {
    const navigate = useNavigate();
    const [date, setDate] = useState(todayDate());
    const [historySlots, setHistorySlots] = useState([]);
    const [currentSlotData, setCurrentSlotData] = useState(null);
    const [selectedSlot, setSelectedSlot] = useState('');
    const [detailData, setDetailData] = useState(null);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [activeSection, setActiveSection] = useState('oldSlots');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const detailSectionRef = useRef(null);
    const timeDropdownRef = useRef(null);
    const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);

    const handleLogout = useCallback(() => {
        clearAdminSession();
        navigate('/');
    }, [navigate]);

    const fetchHistory = useCallback(async (targetDate) => {
        setLoadingHistory(true);
        try {
            const params = new URLSearchParams({ date: targetDate, limit: '24' });
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/slots?${params.toString()}`);
            if (res.status === 401) return;
            const data = await res.json();
            if (!data?.success) throw new Error(data?.message || 'Failed to load slot history');
            const slots = Array.isArray(data?.data?.slots)
                ? [...data.data.slots].sort((a, b) => new Date(a.slotStartIso).getTime() - new Date(b.slotStartIso).getTime())
                : [];
            setHistorySlots(slots);
            if (slots.length) {
                setSelectedSlot((prev) => (prev && slots.some((slot) => slot.slotStartIso === prev) ? prev : slots[0].slotStartIso));
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

    const fetchCurrentSlot = useCallback(async () => {
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/current-slot`);
            if (res.status === 401) return;
            const data = await res.json();
            if (!data?.success) throw new Error(data?.message || 'Failed to load current slot');
            setCurrentSlotData(data?.data || null);
        } catch {
            setCurrentSlotData(null);
        }
    }, []);

    useEffect(() => {
        fetchHistory(date);
    }, [date, fetchHistory]);

    useEffect(() => {
        fetchCurrentSlot();
    }, [fetchCurrentSlot]);

    useEffect(() => {
        if (selectedSlot) fetchDetail(selectedSlot);
    }, [selectedSlot, fetchDetail]);

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
        setActiveSection('quizStats');
        setNotice('Slot detail loaded. Scroll below for quiz-wise view.');
        if (detailSectionRef.current) {
            detailSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const selectedSlotMeta = historySlots.find((slot) => slot.slotStartIso === selectedSlot) || null;

    return (
        <AdminLayout onLogout={handleLogout} title="2D Old Slots Stats">
            <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">2D Old Slots Stats</h1>
                        <p className="text-sm text-gray-500">Old Slots and Quiz-wise Slot Stats.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            fetchHistory(date);
                            fetchCurrentSlot();
                        }}
                        className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                    >
                        Refresh
                    </button>
                </div>

                {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div> : null}
                {notice ? <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">{notice}</div> : null}

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
                    currentSlotData={currentSlotData}
                />
            </div>
        </AdminLayout>
    );
};

export default TwoDOldSlotsStats;
