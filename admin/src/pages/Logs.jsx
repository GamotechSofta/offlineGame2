import React, { useState, useEffect, useMemo, useRef } from 'react';
import AdminLayout from '../components/AdminLayout';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';
import { clearAdminSession, fetchWithAuth } from '../lib/auth';
import { useTraceRender } from '../lib/runtimeTrace';

const ACTION_LABELS = {
    admin_login: 'Admin Login',
    bookie_login: 'Bookie Login',
    player_login: 'Player Login',
    player_signup: 'Player Signup',
    create_admin: 'Create Admin',
    create_bookie: 'Create Bookie',
    update_bookie: 'Update Bookie',
    delete_bookie: 'Delete Bookie',
    toggle_bookie_status: 'Toggle Bookie Status',
    create_market: 'Create Market',
    update_market: 'Update Market',
    delete_market: 'Delete Market',
    set_opening_number: 'Set Opening Number',
    set_closing_number: 'Set Closing Number',
    create_player: 'Create Player',
    wallet_adjust: 'Wallet Adjust',
    payment_status_update: 'Payment Status Update',
    help_ticket_create: 'Help Ticket Create',
    help_ticket_update: 'Help Ticket Update',
    suspend_player: 'Suspend Player',
    unsuspend_player: 'Unsuspend Player',
};

const TYPE_LABELS = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    bookie: 'Bookie',
    user: 'Player',
    system: 'System',
};

const Logs = () => {
    useTraceRender('Logs');
    const navigate = useNavigate();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
    const [filterAction, setFilterAction] = useState('');
    const [filterPerformedBy, setFilterPerformedBy] = useState('');
    const [filterType, setFilterType] = useState('');
    const [sortOrder, setSortOrder] = useState('desc');
    const [bootstrapped, setBootstrapped] = useState(false);
    const desktopListRef = useRef(null);
    const mobileListRef = useRef(null);
    const desktopVirtualizer = useVirtualizer({
        count: logs.length,
        getScrollElement: () => desktopListRef.current,
        estimateSize: () => 64,
        overscan: 8,
    });
    const mobileVirtualizer = useVirtualizer({
        count: logs.length,
        getScrollElement: () => mobileListRef.current,
        estimateSize: () => 132,
        overscan: 6,
    });
    const desktopRows = useMemo(() => desktopVirtualizer.getVirtualItems(), [desktopVirtualizer, logs.length]);
    const mobileRows = useMemo(() => mobileVirtualizer.getVirtualItems(), [mobileVirtualizer, logs.length]);

    const fetchLogs = async () => {
        const params = new URLSearchParams({ page, limit: 50, sort: sortOrder });
        if (filterAction) params.append('action', filterAction);
        if (filterPerformedBy) params.append('performedBy', filterPerformedBy);
        if (filterType) params.append('performedByType', filterType);
        const response = await fetchWithAuth(`${API_BASE_URL}/admin/logs?${params.toString()}`);
        if (response.status === 401) return { data: [], pagination: { page: 1, totalPages: 1, total: 0 } };
        const data = await response.json();
        if (!data?.success) {
            throw new Error(data?.message || 'Failed to fetch logs');
        }
        return {
            data: data.data || [],
            pagination: data.pagination || { page: 1, totalPages: 1, total: 0 },
        };
    };

    useEffect(() => {
        const admin = localStorage.getItem('admin');
        if (!admin) {
            navigate('/');
            return;
        }
        setBootstrapped(true);
    }, [navigate]);

    const logsQuery = useQuery({
        queryKey: ['admin-logs', page, filterAction, filterPerformedBy, filterType, sortOrder],
        queryFn: fetchLogs,
        enabled: bootstrapped,
    });

    useEffect(() => {
        const payload = logsQuery.data;
        if (!payload) return;
        setLogs(payload.data || []);
        setPagination(payload.pagination || { page: 1, totalPages: 1, total: 0 });
        setError('');
    }, [logsQuery.data]);

    useEffect(() => {
        setLoading(logsQuery.isLoading || logsQuery.isFetching);
        if (logsQuery.error) {
            setError(logsQuery.error?.message || 'Failed to fetch logs');
        }
    }, [logsQuery.isLoading, logsQuery.isFetching, logsQuery.error]);

    const handleLogout = () => {
        clearAdminSession();
        navigate('/');
    };

    const formatTimestamp = (ts) => {
        if (!ts) return '—';
        const d = new Date(ts);
        return d.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
        });
    };

    const getActionLabel = (action) => ACTION_LABELS[action] || action?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    return (
        <AdminLayout onLogout={handleLogout} title="Logs">
            <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Activity Logs</h1>
            <p className="text-gray-400 mb-4 sm:mb-6 text-sm">
                All activity from admin, bookie and player (frontend). Use filters or change page to load; refresh the browser for the latest entries.
            </p>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3 mb-4 p-3 sm:p-4 bg-white rounded-lg border border-gray-200">
                <input
                    type="text"
                    placeholder="Filter by action..."
                    value={filterAction}
                    onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
                    className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-800 text-sm placeholder-gray-400 focus:ring-2 focus:ring-orange-500 min-w-0 w-full"
                />
                <input
                    type="text"
                    placeholder="Filter by user..."
                    value={filterPerformedBy}
                    onChange={(e) => { setFilterPerformedBy(e.target.value); setPage(1); }}
                    className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-800 text-sm placeholder-gray-400 focus:ring-2 focus:ring-orange-500 min-w-0 w-full"
                />
                <select
                    value={filterType}
                    onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
                    className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-800 text-sm focus:ring-2 focus:ring-orange-500 min-w-0 w-full"
                >
                    <option value="">All types</option>
                    {Object.entries(TYPE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                    ))}
                </select>
                <select
                    value={sortOrder}
                    onChange={(e) => { setSortOrder(e.target.value); setPage(1); }}
                    className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-800 text-sm focus:ring-2 focus:ring-orange-500 min-w-0 w-full"
                >
                    <option value="desc">Newest first</option>
                    <option value="asc">Oldest first</option>
                </select>
                <button
                    onClick={() => { setFilterAction(''); setFilterPerformedBy(''); setFilterType(''); setPage(1); }}
                    className="px-3 py-2 bg-gray-200 hover:bg-gray-500 rounded-lg text-sm font-medium w-full sm:col-span-2 xl:col-span-1"
                >
                    Clear
                </button>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
                    {error}
                </div>
            )}

            <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
                {loading ? (
                    <div className="p-8 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto" />
                        <p className="mt-4 text-gray-400">Loading logs...</p>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        No activity logs found.
                    </div>
                ) : (
                    <>
                        {/* Desktop virtualized table */}
                        <div className="hidden md:block">
                            <div className="grid grid-cols-[70px_170px_160px_160px_120px_1fr_170px] bg-gray-100 px-4 py-3 text-xs font-medium text-gray-600 uppercase">
                                <div>#</div>
                                <div>Timestamp</div>
                                <div>Action</div>
                                <div>Performed By</div>
                                <div>Type</div>
                                <div>Details</div>
                                <div>Target</div>
                            </div>
                            <div ref={desktopListRef} className="overflow-auto" style={{ maxHeight: 560 }}>
                                <div style={{ height: desktopVirtualizer.getTotalSize(), position: 'relative' }}>
                                    {desktopRows.map((virtualRow) => {
                                        const log = logs[virtualRow.index];
                                        if (!log) return null;
                                        return (
                                            <div
                                                key={virtualRow.key}
                                                className="absolute left-0 top-0 w-full border-b border-gray-200 px-4 hover:bg-gray-50"
                                                style={{ transform: `translateY(${virtualRow.start}px)`, height: `${virtualRow.size}px` }}
                                            >
                                                <div className="grid h-full grid-cols-[70px_170px_160px_160px_120px_1fr_170px] items-center text-sm">
                                                    <div className="text-gray-400">{(pagination.page - 1) * 50 + virtualRow.index + 1}</div>
                                                    <div className="font-mono text-xs text-gray-600">{formatTimestamp(log.createdAt)}</div>
                                                    <div>
                                                        <span className="inline-block rounded border border-orange-200 bg-orange-50 px-2 py-1 text-xs font-medium text-orange-600">
                                                            {getActionLabel(log.action)}
                                                        </span>
                                                    </div>
                                                    <div className="truncate font-medium text-gray-800">{log.performedBy || '—'}</div>
                                                    <div>
                                                        <span className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-700 capitalize">
                                                            {TYPE_LABELS[log.performedByType] || log.performedByType || '—'}
                                                        </span>
                                                    </div>
                                                    <div className="truncate pr-3 text-gray-600">{log.details || '—'}</div>
                                                    <div className="text-xs text-gray-400">
                                                        {log.targetType && (log.targetId ? `${log.targetType}: ${String(log.targetId).slice(-8)}` : log.targetType)}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Mobile card virtualized layout */}
                        <div ref={mobileListRef} className="md:hidden overflow-auto" style={{ maxHeight: 560 }}>
                            <div style={{ height: mobileVirtualizer.getTotalSize(), position: 'relative' }}>
                                {mobileRows.map((virtualRow) => {
                                    const log = logs[virtualRow.index];
                                    if (!log) return null;
                                    return (
                                        <div
                                            key={virtualRow.key}
                                            className="absolute left-0 top-0 w-full border-b border-gray-200 p-4 hover:bg-gray-100/30"
                                            style={{ transform: `translateY(${virtualRow.start}px)`, height: `${virtualRow.size}px` }}
                                        >
                                            <div className="mb-2 flex flex-wrap items-start gap-2">
                                                <span className="rounded border border-orange-200 bg-orange-50 px-2 py-1 text-xs font-medium text-orange-600 break-words">
                                                    {getActionLabel(log.action)}
                                                </span>
                                                <span className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-700 capitalize">
                                                    {TYPE_LABELS[log.performedByType] || log.performedByType || '—'}
                                                </span>
                                            </div>
                                            <div className="space-y-1 text-xs text-gray-400">
                                                <p><span className="text-gray-500">By:</span> <span className="font-medium text-gray-800">{log.performedBy || '—'}</span></p>
                                                <p><span className="text-gray-500">When:</span> {formatTimestamp(log.createdAt)}</p>
                                                <p className="break-words text-gray-600">{log.details || '—'}</p>
                                                {log.targetType && (
                                                    <p className="text-gray-500">{log.targetType}{log.targetId ? `: ${String(log.targetId).slice(-8)}` : ''}</p>
                                                )}
                                            </div>
                                            <p className="mt-1 text-[10px] text-gray-500">#{(pagination.page - 1) * 50 + virtualRow.index + 1}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}

                {!loading && pagination.totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-3 sm:px-4 py-3 border-t border-gray-200 bg-gray-100/30">
                        <p className="text-gray-400 text-sm text-center sm:text-left">
                            Page {pagination.page} of {pagination.totalPages} • {pagination.total} total
                        </p>
                        <div className="flex gap-2 justify-center sm:justify-end">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-500 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                                disabled={page >= pagination.totalPages}
                                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-500 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
};

export default Logs;
