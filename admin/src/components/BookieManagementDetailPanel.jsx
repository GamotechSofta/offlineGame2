import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaSpinner, FaUsers, FaChartLine, FaList } from 'react-icons/fa';
import { TOP_LEVEL_LABEL, SUB_LEVEL_LABEL, SUB_LEVEL_LABEL_PLURAL } from '../config/roleLabels';

const DETAIL_TABS = [
    { id: 'directPlayers', label: 'Direct players', icon: FaUsers },
    { id: 'recentBets', label: 'Recent bets', icon: FaList },
];

const formatCurrency = (n) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(num);
};

const formatNumber = (n) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return '0';
    return new Intl.NumberFormat('en-IN').format(num);
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
    const [detailTab, setDetailTab] = useState('directPlayers');

    const resolvedBookieId = bookieId || detail?.bookie?._id || detail?.bookie?.id;

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

    const adminShare = Number(commission?.adminCommissionAmount ?? 0);
    const adminFromDirect = Number(commission?.adminCommissionFromDirect ?? commission?.directCommission ?? 0);
    const adminFromBookie = Number(commission?.adminCommissionFromSub ?? 0);
    const adminSettled = Number(commission?.adminCommissionPaid ?? commission?.totalPaid ?? 0);
    const adminPending = Number(commission?.adminCommissionPending ?? commission?.totalPending ?? 0);
    const periodAdminProfit = Number(commission?.periodAdminCommission ?? revenue?.adminCommission ?? 0);
    const periodAdminFromDirect = Number(
        commission?.periodAdminCommissionFromDirect ?? commission?.periodDirectCommission ?? revenue?.directCommission ?? 0,
    );
    const periodAdminFromBookie = Number(commission?.periodAdminCommissionFromSub ?? 0);

    return (
        <div className={wrapClass}>
            <p className="text-sm font-semibold text-slate-800">Account overview · All-time</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="rounded-lg bg-orange-50 border border-orange-100 p-3">
                    <p className="text-[10px] uppercase text-slate-500">Rate</p>
                    <p className="font-bold text-orange-600 mt-1 tabular-nums">{bookie.commissionPercentage ?? 0}%</p>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                    <p className="text-[10px] uppercase text-slate-500">Direct player bets</p>
                    <p className="font-bold text-slate-800 mt-1 tabular-nums">{formatCurrency(commission?.directBetAmount ?? 0)}</p>
                </div>
                <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
                    <p className="text-[10px] uppercase text-slate-500">Admin profit</p>
                    <p className="font-bold text-slate-800 mt-1 tabular-nums">{formatCurrency(adminShare)}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                        Direct {formatCurrency(adminFromDirect)} + {SUB_LEVEL_LABEL} {formatCurrency(adminFromBookie)}
                    </p>
                </div>
                <div className="rounded-lg bg-green-50 border border-green-100 p-3">
                    <p className="text-[10px] uppercase text-slate-500">Settled</p>
                    <p className="font-bold text-green-700 mt-1 tabular-nums">{formatCurrency(adminSettled)}</p>
                </div>
                <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
                    <p className="text-[10px] uppercase text-slate-500">Pending</p>
                    <p className="font-bold text-amber-700 mt-1 tabular-nums">{formatCurrency(adminPending)}</p>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                    <p className="text-[10px] uppercase text-slate-500">Direct players</p>
                    <p className="font-bold text-slate-800 mt-1">{formatNumber(hierarchy?.directPlayers ?? 0)}</p>
                </div>
                <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3">
                    <p className="text-[10px] uppercase text-slate-500">{SUB_LEVEL_LABEL_PLURAL}</p>
                    <p className="font-bold text-indigo-700 mt-1">{formatNumber(hierarchy?.superBookiesCount ?? 0)}</p>
                </div>
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                    <p className="text-[10px] uppercase text-slate-500">Players via {SUB_LEVEL_LABEL_PLURAL.toLowerCase()}</p>
                    <p className="font-bold text-slate-800 mt-1">{formatNumber(hierarchy?.superBookiePlayers ?? 0)}</p>
                </div>
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                    <p className="text-[10px] uppercase text-slate-500">Network players</p>
                    <p className="font-bold text-slate-800 mt-1">{formatNumber(totalNetworkPlayers ?? hierarchy?.totalPlayers ?? 0)}</p>
                </div>
            </div>

            {/* Revenue (selected period) */}
            {revenue && (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                        <FaChartLine className="text-orange-500 w-4 h-4" />
                        <p className="text-sm font-semibold text-gray-800">Revenue (selected period)</p>
                    </div>
                    <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase">Direct player bets</p>
                            <p className="font-semibold tabular-nums">{formatCurrency(revenue.totalBetAmount)}</p>
                            <p className="text-[10px] text-gray-400">
                                Matka {formatCurrency(revenue.matkaBetAmount ?? 0)} · 2D/3D{' '}
                                {formatCurrency(revenue.lotteryBetAmount ?? 0)}
                            </p>
                            <p className="text-[10px] text-gray-400">{formatNumber(revenue.totalBetCount)} bets</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase">Payouts</p>
                            <p className="font-semibold text-red-600 tabular-nums">{formatCurrency(revenue.totalPayouts)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase">Admin profit</p>
                            <p className="font-semibold text-slate-800 tabular-nums">{formatCurrency(periodAdminProfit)}</p>
                            <p className="text-[10px] text-gray-400">
                                Direct {formatCurrency(periodAdminFromDirect)} + {SUB_LEVEL_LABEL} {formatCurrency(periodAdminFromBookie)}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase">Win rate</p>
                            <p className="font-semibold">{revenue.winRate}%</p>
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
                            return (
                                <div
                                    key={sbId}
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
                                    <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                                        <span><strong>{sb.commissionPercentage ?? 0}%</strong> rate</span>
                                        <span>{sb.playerCount ?? 0} players</span>
                                        <span className="text-[#1B3150]">To {TOP_LEVEL_LABEL}: {formatCurrency(sb.totalCommissionAmount)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                    {DETAIL_TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = detailTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setDetailTab(tab.id)}
                                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                                    isActive
                                        ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                                        : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300 hover:bg-orange-50'
                                }`}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {detailTab === 'directPlayers' && (
                    <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
                        <p className="px-3 py-2 bg-gray-50 text-sm font-semibold text-gray-800 border-b border-gray-200">
                            Direct players
                            {directPlayers?.length > 0 ? ` (${directPlayers.length})` : ''}
                        </p>
                        {directPlayers?.length > 0 ? (
                            <ul className="divide-y divide-gray-100 max-h-52 overflow-y-auto">
                                {directPlayers.map((p) => (
                                    <li key={p._id} className="px-3 py-2 flex justify-between text-sm">
                                        <Link
                                            to={`/all-users/${p._id}`}
                                            className="font-medium text-orange-600 hover:underline"
                                        >
                                            {p.username}
                                        </Link>
                                        <span className="text-gray-500 text-xs">{p.phone || '—'}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="px-3 py-6 text-sm text-gray-500 text-center">No direct players yet.</p>
                        )}
                    </div>
                )}

                {detailTab === 'recentBets' && (
                    <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
                        <p className="px-3 py-2 bg-gray-50 text-sm font-semibold text-gray-800 border-b border-gray-200">
                            Recent bets (network)
                            {recentBets?.length > 0 ? ` (${recentBets.length})` : ''}
                        </p>
                        {recentBets?.length > 0 ? (
                            <div className="overflow-x-auto max-h-52 overflow-y-auto">
                                <table className="w-full text-xs">
                                    <thead className="bg-gray-100 text-gray-500 sticky top-0">
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
                        ) : (
                            <p className="px-3 py-6 text-sm text-gray-500 text-center">No recent bets.</p>
                        )}
                    </div>
                )}
            </div>

            <p className="text-[10px] text-gray-400">
                Payment management: {bookie.canManagePayments ? 'Enabled' : 'Disabled'} · Created{' '}
                {bookie.createdAt ? new Date(bookie.createdAt).toLocaleDateString('en-IN') : '—'}
            </p>
        </div>
    );
};

export default BookieManagementDetailPanel;
