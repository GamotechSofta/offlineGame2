import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

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

    const getAuthHeaders = () => {
        const admin = JSON.parse(localStorage.getItem('admin'));
        const password = sessionStorage.getItem('adminPassword') || '';
        return {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${btoa(`${admin.username}:${password}`)}`,
        };
    };

    const fetchLogs = async (showLoader = true) => {
        if (showLoader) setLoading(true);
        if (showLoader) setError('');
        try {
            const params = new URLSearchParams({ page, limit: 50, sort: sortOrder });
            if (filterAction) params.append('action', filterAction);
            if (filterPerformedBy) params.append('performedBy', filterPerformedBy);
            if (filterType) params.append('performedByType', filterType);
            const response = await fetch(`${API_BASE_URL}/admin/logs?${params}`, {
                headers: getAuthHeaders(),
            });
            const data = await response.json();
            if (data.success) {
                setLogs(data.data || []);
                setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
            } else {
                if (showLoader) setError(data.message || 'Failed to fetch logs');
            }
        } catch (err) {
            if (showLoader) setError('Failed to fetch logs');
        } finally {
            if (showLoader) setLoading(false);
        }
    };

    useEffect(() => {
        const admin = localStorage.getItem('admin');
        if (!admin) {
            navigate('/');
            return;
        }
        fetchLogs(true);
        const interval = setInterval(() => fetchLogs(false), 15000);
        return () => clearInterval(interval);
    }, [navigate, page, filterAction, filterPerformedBy, filterType, sortOrder]);

    const handleLogout = () => {
        localStorage.removeItem('admin');
        sessionStorage.removeItem('adminPassword');
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
                All activity from admin, bookie and player (frontend) – auto-refreshes every 15 seconds.
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
                        {/* Desktop table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm sm:text-base">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">#</th>
                                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Timestamp</th>
                                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase min-w-[140px]">Action</th>
                                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Performed By</th>
                                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Type</th>
                                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Details</th>
                                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Target</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {logs.map((log, index) => (
                                        <tr key={log._id} className="hover:bg-gray-50">
                                            <td className="px-4 sm:px-6 py-3 text-gray-400 whitespace-nowrap">{(pagination.page - 1) * 50 + index + 1}</td>
                                            <td className="px-4 sm:px-6 py-3 text-gray-600 font-mono text-xs whitespace-nowrap">{formatTimestamp(log.createdAt)}</td>
                                            <td className="px-4 sm:px-6 py-3 min-w-0">
                                                <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-orange-50 text-orange-600 border border-orange-200 break-words max-w-full">
                                                    {getActionLabel(log.action)}
                                                </span>
                                            </td>
                                            <td className="px-4 sm:px-6 py-3 font-medium text-gray-800 break-words max-w-[120px]">{log.performedBy || '—'}</td>
                                            <td className="px-4 sm:px-6 py-3">
                                                <span className="px-2 py-0.5 rounded text-xs bg-gray-200 text-gray-700 capitalize">
                                                    {TYPE_LABELS[log.performedByType] || log.performedByType || '—'}
                                                </span>
                                            </td>
                                            <td className="px-4 sm:px-6 py-3 text-gray-600 break-words max-w-[200px]">{log.details || '—'}</td>
                                            <td className="px-4 sm:px-6 py-3 text-gray-400 text-xs">{log.targetType && (log.targetId ? `${log.targetType}: ${String(log.targetId).slice(-8)}` : log.targetType)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile card layout */}
                        <div className="md:hidden divide-y divide-gray-700">
                            {logs.map((log, index) => (
                                <div key={log._id} className="p-4 hover:bg-gray-100/30">
                                    <div className="flex flex-wrap items-start gap-2 mb-2">
                                        <span className="px-2 py-1 rounded text-xs font-medium bg-orange-50 text-orange-600 border border-orange-200 break-words">
                                            {getActionLabel(log.action)}
                                        </span>
                                        <span className="px-2 py-0.5 rounded text-xs bg-gray-200 text-gray-700 capitalize">
                                            {TYPE_LABELS[log.performedByType] || log.performedByType || '—'}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-400 space-y-1">
                                        <p><span className="text-gray-500">By:</span> <span className="text-gray-800 font-medium">{log.performedBy || '—'}</span></p>
                                        <p><span className="text-gray-500">When:</span> {formatTimestamp(log.createdAt)}</p>
                                        <p className="text-gray-600 break-words">{log.details || '—'}</p>
                                        {log.targetType && (
                                            <p className="text-gray-500">{log.targetType}{log.targetId ? `: ${String(log.targetId).slice(-8)}` : ''}</p>
                                        )}
                                    </div>
                                    <p className="text-gray-500 text-[10px] mt-1">#{(pagination.page - 1) * 50 + index + 1}</p>
                                </div>
                            ))}
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
