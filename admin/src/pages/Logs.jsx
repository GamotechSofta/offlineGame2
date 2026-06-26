import React, { useState, useEffect, useMemo, useRef } from 'react';
import AdminLayout from '../components/AdminLayout';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import useModalBackHandler from '../hooks/useModalBackHandler';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';
import { clearAdminSession, fetchWithAuth } from '../lib/auth';
import { TOP_LEVEL_LABEL, SUB_LEVEL_LABEL } from '../config/roleLabels';
import { useTraceRender } from '../lib/runtimeTrace';

const ACTION_LABELS = {
    admin_login: 'Admin Login',
    bookie_login: `${TOP_LEVEL_LABEL} Login`,
    super_bookie_login: `${SUB_LEVEL_LABEL} Login`,
    player_login: 'Player Login',
    player_signup: 'Player Signup',
    create_admin: 'Create Admin',
    create_specific_admin: 'Create Specific Admin',
    update_specific_admin: 'Update Specific Admin',
    delete_specific_admin: 'Delete Specific Admin',
    create_bookie: `Create ${TOP_LEVEL_LABEL}`,
    update_bookie: `Update ${TOP_LEVEL_LABEL}`,
    delete_bookie: `Delete ${TOP_LEVEL_LABEL}`,
    toggle_bookie_status: `Toggle ${TOP_LEVEL_LABEL} Status`,
    create_super_bookie: `Create ${SUB_LEVEL_LABEL}`,
    delete_super_bookie: `Delete ${SUB_LEVEL_LABEL}`,
    create_market: 'Create Market',
    update_market: 'Update Market',
    delete_market: 'Delete Market',
    set_opening_number: 'Set Opening Number',
    set_closing_number: 'Set Closing Number',
    declare_open_result: 'Declare Open Result',
    declare_close_result: 'Declare Close Result',
    clear_result: 'Clear Result',
    create_starline_group: 'Create Starline Group',
    delete_starline_group: 'Delete Starline Group',
    create_player: 'Create Player',
    update_player_to_give_take: 'Update Player Give/Take',
    reset_player_password: 'Reset Player Password',
    delete_player: 'Delete Player',
    clear_login_devices: 'Clear Login Devices',
    suspend_player: 'Suspend Player',
    unsuspend_player: 'Unsuspend Player',
    wallet_adjust: 'Wallet Adjust',
    operator_wallet_adjust: 'Operator Wallet Adjust',
    wallet_set_balance: 'Wallet Set Balance',
    deposit_request_created: 'Deposit Request',
    withdrawal_request_created: 'Withdrawal Request',
    payment_deposit_approved: 'Deposit Approved',
    payment_deposit_rejected: 'Deposit Rejected',
    payment_withdrawal_approved: 'Withdrawal Approved',
    payment_withdrawal_rejected: 'Withdrawal Rejected',
    update_payment_ui_config: 'Update Payment UI',
    commission_request_created: 'Commission Request',
    commission_counter_accepted: 'Commission Counter Accepted',
    help_ticket_create: 'Help Ticket Create',
    help_ticket_update: 'Help Ticket Update',
    bank_detail_added: 'Bank Detail Added',
    bank_detail_updated: 'Bank Detail Updated',
    bank_detail_deleted: 'Bank Detail Deleted',
    set_secret_declare_password: 'Set Declare Password',
};

const ACTIVITY_TYPE_OPTIONS = [
    { value: '', label: 'All activity' },
    ...Object.entries(ACTION_LABELS)
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
];

const PAGE_SIZE_OPTIONS = [50, 100, 200];

const TYPE_LABELS = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    bookie: TOP_LEVEL_LABEL,
    super_bookie: SUB_LEVEL_LABEL,
    user: 'Player',
    system: 'System',
};

const DetailRow = ({ label, children, mono = false }) => (
    <div className="py-2.5 border-b border-slate-100 last:border-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">{label}</p>
        <div className={`text-sm text-slate-800 break-words ${mono ? 'font-mono text-xs' : ''}`}>{children}</div>
    </div>
);

const LogDetailModal = ({ log, onClose, formatTimestamp, getActionLabel }) => {
    const closeModal = useModalBackHandler(Boolean(log), onClose);
    if (!log) return null;

    const metaEntries = log.meta && typeof log.meta === 'object' && !Array.isArray(log.meta)
        ? Object.entries(log.meta)
        : null;

    const targetLink = log.targetType === 'user' && log.targetId
        ? `/all-users/${log.targetId}`
        : null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40" onClick={closeModal}>
            <div
                className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-4 py-3 border-b border-slate-200 flex items-start justify-between gap-3">
                    <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Activity details</p>
                        <h3 className="text-base font-semibold text-slate-900 mt-0.5">{getActionLabel(log.action)}</h3>
                    </div>
                    <button
                        type="button"
                        onClick={closeModal}
                        className="text-slate-400 hover:text-slate-700 text-xl leading-none p-1 shrink-0"
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>
                <div className="p-4 overflow-y-auto">
                    <div className="mb-3">
                        <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
                            {getActionLabel(log.action)}
                        </span>
                        <span className="ml-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                            {TYPE_LABELS[log.performedByType] || log.performedByType || '—'}
                        </span>
                    </div>

                    <DetailRow label="When">{formatTimestamp(log.createdAt)}</DetailRow>
                    <DetailRow label="Performed by">{log.performedBy || '—'}</DetailRow>
                    <DetailRow label="Account type">{TYPE_LABELS[log.performedByType] || log.performedByType || '—'}</DetailRow>
                    <DetailRow label="Details">{log.details || '—'}</DetailRow>
                    <DetailRow label="Target type">{log.targetType || '—'}</DetailRow>
                    <DetailRow label="Target ID" mono>
                        {targetLink ? (
                            <Link to={targetLink} onClick={closeModal} className="text-orange-600 hover:text-orange-700 hover:underline">
                                {log.targetId}
                            </Link>
                        ) : (
                            log.targetId || '—'
                        )}
                    </DetailRow>
                    <DetailRow label="IP address" mono>{log.ip || '—'}</DetailRow>

                    {metaEntries && metaEntries.length > 0 && (
                        <DetailRow label="Extra info">
                            <div className="space-y-1.5">
                                {metaEntries.map(([key, value]) => (
                                    <div key={key} className="flex flex-col sm:flex-row sm:gap-2 text-xs">
                                        <span className="font-semibold text-slate-500 shrink-0 capitalize">{key.replace(/_/g, ' ')}:</span>
                                        <span className="font-mono text-slate-800 break-all">
                                            {typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </DetailRow>
                    )}

                    {log.meta && !metaEntries?.length && (
                        <DetailRow label="Extra info" mono>{JSON.stringify(log.meta, null, 2)}</DetailRow>
                    )}

                    <DetailRow label="Log ID" mono>{log._id || '—'}</DetailRow>
                    {log.updatedAt && log.updatedAt !== log.createdAt && (
                        <DetailRow label="Last updated">{formatTimestamp(log.updatedAt)}</DetailRow>
                    )}
                    <DetailRow label="Action code" mono>{log.action || '—'}</DetailRow>
                </div>
                <div className="px-4 py-3 border-t border-slate-200 bg-slate-50">
                    <button
                        type="button"
                        onClick={closeModal}
                        className="w-full px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
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
    const [pageSize, setPageSize] = useState(100);
    const [selectedLog, setSelectedLog] = useState(null);
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
        const params = new URLSearchParams({ page, limit: pageSize, sort: sortOrder });
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
        queryKey: ['admin-logs', page, pageSize, filterAction, filterPerformedBy, filterType, sortOrder],
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
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">Activity Logs</h1>
            <p className="text-slate-500 mb-4 sm:mb-6 text-sm">
                Full history from Super Admin, {TOP_LEVEL_LABEL}, {SUB_LEVEL_LABEL}, and players. Click any row to see full details.
            </p>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-2 sm:gap-3 mb-4 p-3 sm:p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <select
                    value={filterAction}
                    onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-sm focus:ring-2 focus:ring-orange-500 min-w-0 w-full xl:col-span-2"
                >
                    {ACTIVITY_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
                <input
                    type="text"
                    placeholder="Search by user..."
                    value={filterPerformedBy}
                    onChange={(e) => { setFilterPerformedBy(e.target.value); setPage(1); }}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-sm placeholder-slate-400 focus:ring-2 focus:ring-orange-500 min-w-0 w-full"
                />
                <select
                    value={filterType}
                    onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-sm focus:ring-2 focus:ring-orange-500 min-w-0 w-full"
                >
                    <option value="">All types</option>
                    {Object.entries(TYPE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                    ))}
                </select>
                <select
                    value={sortOrder}
                    onChange={(e) => { setSortOrder(e.target.value); setPage(1); }}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-sm focus:ring-2 focus:ring-orange-500 min-w-0 w-full"
                >
                    <option value="desc">Newest first</option>
                    <option value="asc">Oldest first</option>
                </select>
                <select
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-sm focus:ring-2 focus:ring-orange-500 min-w-0 w-full"
                >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                        <option key={size} value={size}>{size} per page</option>
                    ))}
                </select>
                <button
                    type="button"
                    onClick={() => {
                        setFilterAction('');
                        setFilterPerformedBy('');
                        setFilterType('');
                        setSortOrder('desc');
                        setPageSize(100);
                        setPage(1);
                    }}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-700 w-full"
                >
                    Reset
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
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => setSelectedLog(log)}
                                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedLog(log); }}
                                                className="absolute left-0 top-0 w-full border-b border-gray-200 px-4 hover:bg-orange-50/60 cursor-pointer transition-colors"
                                                style={{ transform: `translateY(${virtualRow.start}px)`, height: `${virtualRow.size}px` }}
                                            >
                                                <div className="grid h-full grid-cols-[70px_170px_160px_160px_120px_1fr_170px] items-center text-sm">
                                                    <div className="text-gray-400">{(pagination.page - 1) * pageSize + virtualRow.index + 1}</div>
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
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => setSelectedLog(log)}
                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedLog(log); }}
                                            className="absolute left-0 top-0 w-full border-b border-gray-200 p-4 hover:bg-orange-50/60 cursor-pointer transition-colors"
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
                                            <p className="mt-1 text-[10px] text-gray-500">#{(pagination.page - 1) * pageSize + virtualRow.index + 1}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}

                {!loading && pagination.total > 0 && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-3 sm:px-4 py-3 border-t border-gray-200 bg-gray-100/30">
                        <p className="text-slate-500 text-sm text-center sm:text-left">
                            Showing page {pagination.page} of {pagination.totalPages} · {pagination.total} total entries
                            {filterAction || filterPerformedBy || filterType ? ' (filtered)' : ''}
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

            <LogDetailModal
                log={selectedLog}
                onClose={() => setSelectedLog(null)}
                formatTimestamp={formatTimestamp}
                getActionLabel={getActionLabel}
            />
        </AdminLayout>
    );
};

export default Logs;
