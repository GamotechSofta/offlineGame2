import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../components/AdminLayout';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { FaArrowLeft, FaSyncAlt, FaExternalLinkAlt } from 'react-icons/fa';
import BookieManagementDetailPanel from '../components/BookieManagementDetailPanel';
import DateRangeFilter from '../components/DateRangeFilter';
import { TOP_LEVEL_LABEL } from '../config/roleLabels';
import { clearAdminSession, fetchWithAuth } from '../lib/auth';
import { presetToDateRange, formatDateRangeLabel } from '../lib/dateRangePresets';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const BookieManagementDetail = () => {
    const { bookieId } = useParams();
    const navigate = useNavigate();
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [datePreset, setDatePreset] = useState('today');
    const [customMode, setCustomMode] = useState(false);
    const [customOpen, setCustomOpen] = useState(false);
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [dateRange, setDateRange] = useState(() => presetToDateRange('today'));

    const handleLogout = () => {
        clearAdminSession();
        navigate('/');
    };

    const fetchDetail = useCallback(async () => {
        if (!bookieId) return;
        setLoading(true);
        setError('');
        try {
            const q = new URLSearchParams();
            if (dateRange.startDate) q.set('startDate', dateRange.startDate);
            if (dateRange.endDate) q.set('endDate', dateRange.endDate);
            const qs = q.toString() ? `?${q.toString()}` : '';
            const response = await fetchWithAuth(`${API_BASE_URL}/admin/bookies/${bookieId}/detail${qs}`);
            if (response.status === 401) return;
            const data = await response.json();
            if (data.success) {
                setDetail(data.data);
            } else {
                setError(data.message || 'Failed to load details');
            }
        } catch {
            setError('Network error loading details');
        } finally {
            setLoading(false);
        }
    }, [bookieId, dateRange.startDate, dateRange.endDate]);

    useEffect(() => {
        if (!localStorage.getItem('admin')) {
            navigate('/');
            return;
        }
        fetchDetail();
    }, [fetchDetail, navigate]);

    const applyPreset = (presetId) => {
        setCustomMode(false);
        setCustomOpen(false);
        setDatePreset(presetId);
        setDateRange(presetToDateRange(presetId));
    };

    const handleCustomToggle = () => {
        const next = !customMode;
        setCustomMode(next);
        setCustomOpen(next);
        if (next) {
            setDatePreset('');
            setCustomFrom(dateRange.startDate || '');
            setCustomTo(dateRange.endDate || '');
        }
    };

    const handleCustomApply = () => {
        if (!customFrom || !customTo) return;
        setDateRange({ startDate: customFrom, endDate: customTo });
        setDatePreset('');
    };

    const displayLabel = formatDateRangeLabel(dateRange.startDate, dateRange.endDate);
    const bookieName = detail?.bookie?.username || TOP_LEVEL_LABEL;

    return (
        <AdminLayout onLogout={handleLogout} title={`${TOP_LEVEL_LABEL} Detail`}>
            <div className="min-w-0 max-w-5xl mx-auto space-y-4">
                <div>
                    <Link
                        to="/bookie-management"
                        className="text-gray-500 hover:text-orange-600 text-sm inline-flex items-center gap-1 mb-3"
                    >
                        <FaArrowLeft className="w-3 h-3" />
                        Back to {TOP_LEVEL_LABEL} Accounts
                    </Link>
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">{bookieName}</h1>
                        {detail?.bookie?.status && (
                            <span
                                className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                    detail.bookie.status === 'active'
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-red-50 text-red-600'
                                }`}
                            >
                                {detail.bookie.status === 'active' ? 'Active' : 'Suspended'}
                            </span>
                        )}
                    </div>
                    {detail?.bookie?.phone && (
                        <p className="text-gray-500 text-sm mt-1">{detail.bookie.phone}</p>
                    )}
                </div>

                <DateRangeFilter
                    datePreset={datePreset}
                    customMode={customMode}
                    customOpen={customOpen}
                    customFrom={customFrom}
                    customTo={customTo}
                    displayLabel={displayLabel}
                    onPresetSelect={applyPreset}
                    onCustomToggle={handleCustomToggle}
                    onCustomFromChange={setCustomFrom}
                    onCustomToChange={setCustomTo}
                    onCustomApply={handleCustomApply}
                    rangeUpdating={loading && !!detail}
                    headerRight={
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={fetchDetail}
                                disabled={loading}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-orange-500/20 border border-gray-200 text-xs font-medium text-gray-600 disabled:opacity-60"
                            >
                                <FaSyncAlt className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                                Refresh
                            </button>
                            {bookieId && (
                                <Link
                                    to={`/revenue/${bookieId}`}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-500 text-gray-800 text-xs font-semibold hover:bg-orange-400"
                                >
                                    Full report <FaExternalLinkAlt className="w-3 h-3" />
                                </Link>
                            )}
                        </div>
                    }
                />

                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm">
                    <BookieManagementDetailPanel
                        fullPage
                        detail={detail}
                        loading={loading}
                        error={error}
                        onRefresh={fetchDetail}
                    />
                </div>
            </div>
        </AdminLayout>
    );
};

export default BookieManagementDetail;
