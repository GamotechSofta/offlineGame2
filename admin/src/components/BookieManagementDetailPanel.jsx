import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaSpinner, FaUsers, FaPercent, FaWallet, FaChartLine } from 'react-icons/fa';
import { TOP_LEVEL_LABEL, SUB_LEVEL_LABEL_PLURAL } from '../config/roleLabels';
import { fetchWithAuth } from '../lib/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const formatCurrency = (n) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return '₹0';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(num);
};

const formatNumber = (n) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return '0';
    return new Intl.NumberFormat('en-IN').format(num);
};

const SubBookiePlayersList = ({ players, loading, error, onRetry }) => {
    if (loading) {
        return (
            <div className="flex items-center gap-2 py-4 text-gray-500 text-sm">
                <FaSpinner className="animate-spin text-indigo-500" />
                Loading players...
            </div>
        );
    }
    if (error) {
        return (
            <div className="py-2">
                <p className="text-sm text-red-600">{error}</p>
                <button type="button" onClick={onRetry} className="mt-1 text-xs font-semibold text-orange-600 hover:underline">
                    Retry
                </button>
            </div>
        );
    }
    if (!players?.length) {
        return <p className="text-gray-500 text-sm py-2">No players yet.</p>;
    }
    return (
        <ul className="divide-y divide-indigo-100 max-h-52 overflow-y-auto rounded-lg border border-indigo-100 bg-white">
            {players.map((p) => (
                <li key={p._id} className="px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <Link to={`/all-users/${p._id}`} className="font-medium text-orange-600 hover:underline">
                        {p.username}
                    </Link>
                    <span className="text-gray-500 text-xs">{p.phone || '—'}</span>
                    <span className="text-green-700 text-xs font-mono">
                        ₹{Math.floor(Number(p.walletBalance ?? 0)).toLocaleString('en-IN')}
                    </span>
                    <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                            p.isActive !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'
                        }`}
                    >
                        {p.isActive !== false ? 'Active' : 'Suspended'}
                    </span>
                </li>
            ))}
        </ul>
    );
};

const BookieManagementDetailPanel = ({
    detail,
    loading,
    error,
    onRefresh,
    fullPage = false,
    bookieId,
}) => {
    const navigate = useNavigate();
    const wrapClass = fullPage ? 'space-y-4' : 'mt-4 pt-4 border-t border-gray-200 space-y-4';
    const [expandedSuperBookieId, setExpandedSuperBookieId] = useState(null);
    const [playersBySb, setPlayersBySb] = useState({});
    const [playersLoadingId, setPlayersLoadingId] = useState(null);
    const [playersErrorBySb, setPlayersErrorBySb] = useState({});

    const resolvedBookieId = bookieId || detail?.bookie?._id || detail?.bookie?.id;

    const loadSubBookiePlayers = async (superBookieId, force = false) => {
        const sbId = String(superBookieId);
        if (!resolvedBookieId || !sbId) return;
        if (!force && playersBySb[sbId]) return;

        setPlayersLoadingId(sbId);
        setPlayersErrorBySb((prev) => ({ ...prev, [sbId]: '' }));
        try {
            const response = await fetchWithAuth(
                `${API_BASE_URL}/admin/bookies/${resolvedBookieId}/super-bookies/${sbId}/players`
            );
            if (response.status === 401) return;
            const data = await response.json();
            if (data.success) {
                setPlayersBySb((prev) => ({ ...prev, [sbId]: data.data || [] }));
            } else {
                setPlayersErrorBySb((prev) => ({
                    ...prev,
                    [sbId]: data.message || 'Failed to load players',
                }));
            }
        } catch {
            setPlayersErrorBySb((prev) => ({ ...prev, [sbId]: 'Network error' }));
        } finally {
            setPlayersLoadingId(null);
        }
    };

    const toggleSubBookiePlayers = (superBookieId) => {
        const sbId = String(superBookieId);
        if (expandedSuperBookieId === sbId) {
            setExpandedSuperBookieId(null);
            return;
        }
        setExpandedSuperBookieId(sbId);
        loadSubBookiePlayers(sbId);
    };

    if (loading) {
        return (
            <div className={`${wrapClass} flex items-center justify-center gap-2 py-12 text-gray-500`}>
                <FaSpinner className="animate-spin text-orange-500" />
                <span className="text-sm">Loading details...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className={wrapClass}>
                <p className="text-sm text-red-600">{error}</p>
                <button
                    type="button"
                    onClick={onRefresh}
                    className="mt-2 text-sm font-semibold text-orange-600 hover:underline"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (!detail) return null;

    const { bookie, commission, hierarchy, revenue, directPlayers, recentBets, totalNetworkPlayers } = detail;
    const superBookies = hierarchy?.superBookies || [];

    return (
        <div className={wrapClass}>
            <p className="text-sm font-semibold text-gray-800">Account overview</p>

            {/* Commission & wallet */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-lg bg-orange-50 border border-orange-100 p-2.5">
                    <p className="text-[10px] text-gray-500 flex items-center gap-1">
                        <FaPercent className="w-3 h-3" /> Commission %
                    </p>
                    <p className="font-bold text-orange-600">{bookie.commissionPercentage ?? 0}%</p>
                </div>
                <div className="rounded-lg bg-green-50 border border-green-100 p-2.5">
                    <p className="text-[10px] text-gray-500 flex items-center gap-1">
                        <FaWallet className="w-3 h-3" /> Balance
                    </p>
                    <p className="font-bold text-green-700">{formatCurrency(bookie.balance)}</p>
                </div>
                <div className="rounded-lg bg-blue-50 border border-blue-100 p-2.5">
                    <p className="text-[10px] text-gray-500">Total commission earned</p>
                    <p className="font-bold text-[#1B3150]">{formatCurrency(commission?.totalCommission ?? bookie.totalCommissionAmount)}</p>
                </div>
                <div className="rounded-lg bg-amber-50 border border-amber-100 p-2.5">
                    <p className="text-[10px] text-gray-500">Commission pending</p>
                    <p className="font-bold text-amber-700">{formatCurrency(commission?.totalPending ?? bookie.totalCommissionPending)}</p>
                </div>
            </div>

            {/* Players summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-2.5">
                    <p className="text-[10px] text-gray-500 flex items-center gap-1">
                        <FaUsers className="w-3 h-3" /> Network players
                    </p>
                    <p className="font-bold text-gray-800">{formatNumber(totalNetworkPlayers ?? hierarchy?.totalPlayers ?? 0)}</p>
                </div>
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-2.5">
                    <p className="text-[10px] text-gray-500">Direct players</p>
                    <p className="font-bold text-gray-800">{formatNumber(hierarchy?.directPlayers ?? 0)}</p>
                </div>
                <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-2.5">
                    <p className="text-[10px] text-gray-500">{SUB_LEVEL_LABEL_PLURAL}</p>
                    <p className="font-bold text-indigo-700">{formatNumber(hierarchy?.superBookiesCount ?? 0)}</p>
                </div>
                <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-2.5">
                    <p className="text-[10px] text-gray-500">Via {SUB_LEVEL_LABEL_PLURAL.toLowerCase()}</p>
                    <p className="font-bold text-indigo-700">{formatNumber(hierarchy?.superBookiePlayers ?? 0)}</p>
                </div>
            </div>

            {/* Revenue (selected period) */}
            {revenue && (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                        <FaChartLine className="text-orange-500 w-4 h-4" />
                        <p className="text-sm font-semibold text-gray-800">Revenue (selected period)</p>
                    </div>
                    <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase">Total bets</p>
                            <p className="font-semibold">{formatCurrency(revenue.totalBetAmount)}</p>
                            <p className="text-[10px] text-gray-400">{formatNumber(revenue.totalBetCount)} bets</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase">Payouts</p>
                            <p className="font-semibold text-red-600">{formatCurrency(revenue.totalPayouts)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase">{TOP_LEVEL_LABEL} share</p>
                            <p className="font-semibold text-orange-600">{formatCurrency(revenue.bookieShare)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase">Admin profit</p>
                            <p className={`font-semibold ${revenue.adminProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {formatCurrency(revenue.adminProfit)}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase">Win rate</p>
                            <p className="font-semibold">{revenue.winRate}%</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase">Paid commission</p>
                            <p className="font-semibold">{formatCurrency(commission?.totalPaid ?? bookie.totalCommissionPaid)}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Sub-bookies */}
            {superBookies.length > 0 && (
                <div className="rounded-xl border border-indigo-200 overflow-hidden">
                    <p className="px-3 py-2 bg-indigo-50 text-sm font-semibold text-indigo-800 border-b border-indigo-100">
                        {SUB_LEVEL_LABEL_PLURAL} under this {TOP_LEVEL_LABEL}
                    </p>
                    <div className="divide-y divide-indigo-100">
                        {superBookies.map((sb) => {
                            const sbId = String(sb.id);
                            const isExpanded = expandedSuperBookieId === sbId;
                            return (
                                <div key={sbId}>
                                    <div
                                        className="px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm cursor-pointer hover:bg-indigo-50/50 transition-colors"
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => {
                                            if (resolvedBookieId) {
                                                navigate(
                                                    `/bookie-management/${resolvedBookieId}/bookie/${sbId}/commission`,
                                                );
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                if (resolvedBookieId) {
                                                    navigate(
                                                        `/bookie-management/${resolvedBookieId}/bookie/${sbId}/commission`,
                                                    );
                                                }
                                            }
                                        }}
                                    >
                                        <div>
                                            <p className="font-medium text-indigo-800 hover:underline">{sb.username}</p>
                                            <p className="text-xs text-gray-500">{sb.phone || '—'} · {sb.status}</p>
                                            <p className="text-[10px] text-indigo-600 mt-0.5">Open player commission dashboard →</p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                                                <span><strong>{sb.commissionPercentage ?? 0}%</strong> comm.</span>
                                                <span>{sb.playerCount ?? 0} players</span>
                                                <span>Bal {formatCurrency(sb.balance)}</span>
                                                <span className="text-[#1B3150]">Earned {formatCurrency(sb.totalCommissionAmount)}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => toggleSubBookiePlayers(sbId)}
                                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shrink-0"
                                            >
                                                {isExpanded ? 'Hide players' : 'View players'}
                                            </button>
                                        </div>
                                    </div>
                                    {isExpanded && (
                                        <div className="px-3 pb-3 border-t border-indigo-100 bg-indigo-50/30">
                                            <SubBookiePlayersList
                                                players={playersBySb[sbId]}
                                                loading={playersLoadingId === sbId}
                                                error={playersErrorBySb[sbId]}
                                                onRetry={() => loadSubBookiePlayers(sbId, true)}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Direct players preview */}
            {directPlayers?.length > 0 && (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <p className="px-3 py-2 bg-gray-50 text-sm font-semibold text-gray-800 border-b border-gray-200">
                        Direct players (latest {directPlayers.length})
                    </p>
                    <ul className="divide-y divide-gray-100 max-h-40 overflow-y-auto">
                        {directPlayers.map((p) => (
                            <li key={p._id} className="px-3 py-2 flex justify-between text-sm">
                                <Link to={`/all-users/${p._id}`} className="font-medium text-orange-600 hover:underline">
                                    {p.username}
                                </Link>
                                <span className="text-gray-500 text-xs">{p.phone || '—'}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Recent bets */}
            {recentBets?.length > 0 && (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <p className="px-3 py-2 bg-gray-50 text-sm font-semibold text-gray-800 border-b border-gray-200">
                        Recent bets (network)
                    </p>
                    <div className="overflow-x-auto max-h-48 overflow-y-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-gray-100 text-gray-500">
                                <tr>
                                    <th className="text-left px-2 py-1.5">Player</th>
                                    <th className="text-left px-2 py-1.5">Market</th>
                                    <th className="text-right px-2 py-1.5">Amount</th>
                                    <th className="text-left px-2 py-1.5">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {recentBets.map((b) => (
                                    <tr key={b._id}>
                                        <td className="px-2 py-1.5">{b.username}</td>
                                        <td className="px-2 py-1.5 text-gray-600">{b.marketName}</td>
                                        <td className="px-2 py-1.5 text-right">{formatCurrency(b.amount)}</td>
                                        <td className="px-2 py-1.5 capitalize">{b.status}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <p className="text-[10px] text-gray-400">
                Payment management: {bookie.canManagePayments ? 'Enabled' : 'Disabled'} · Created{' '}
                {bookie.createdAt ? new Date(bookie.createdAt).toLocaleDateString('en-IN') : '—'}
            </p>
        </div>
    );
};

export default BookieManagementDetailPanel;
