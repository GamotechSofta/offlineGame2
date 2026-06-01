import React from 'react';
import { Link } from 'react-router-dom';
import { FaSpinner, FaUsers, FaPercent, FaWallet, FaChartLine } from 'react-icons/fa';
import { TOP_LEVEL_LABEL, SUB_LEVEL_LABEL, SUB_LEVEL_LABEL_PLURAL } from '../config/roleLabels';

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

const BookieManagementDetailPanel = ({
    detail,
    loading,
    error,
    onRefresh,
    fullPage = false,
}) => {
    const wrapClass = fullPage ? 'space-y-4' : 'mt-4 pt-4 border-t border-gray-200 space-y-4';

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
                        {superBookies.map((sb) => (
                            <div key={sb.id} className="px-3 py-2.5 flex flex-wrap justify-between gap-2 text-sm">
                                <div>
                                    <p className="font-medium text-gray-800">{sb.username}</p>
                                    <p className="text-xs text-gray-500">{sb.phone || '—'} · {sb.status}</p>
                                </div>
                                <div className="flex flex-wrap gap-3 text-xs">
                                    <span><strong>{sb.commissionPercentage ?? 0}%</strong> comm.</span>
                                    <span>{sb.playerCount ?? 0} players</span>
                                    <span>Bal {formatCurrency(sb.balance)}</span>
                                    <span className="text-[#1B3150]">Earned {formatCurrency(sb.totalCommissionAmount)}</span>
                                </div>
                            </div>
                        ))}
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
