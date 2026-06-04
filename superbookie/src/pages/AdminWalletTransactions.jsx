import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { API_BASE_URL, fetchWithAuth } from '../utils/api';
import { useLanguage } from '../context/useLanguage';
import { useAuth } from '../context/AuthContext';
import { dispatchWalletSummaryRefresh } from '../hooks/useWalletGrandTotal';
import { FaWallet, FaSyncAlt, FaArrowUp, FaArrowDown, FaUsers, FaMoneyBillWave, FaList } from 'react-icons/fa';

const formatCurrency = (n) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return '₹0';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num);
};

const formatDateTime = (v) => {
    if (!v) return '-';
    return new Date(v).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const TxTable = ({ rows, t }) => (
    <>
        <div className="hidden md:block overflow-x-auto rounded-xl border border-violet-100 bg-white shadow-sm">
            <table className="w-full text-sm">
                <thead className="bg-violet-50 text-left text-gray-600">
                    <tr>
                        <th className="px-4 py-3">{t('date')}</th>
                        <th className="px-4 py-3">{t('walletTxType')}</th>
                        <th className="px-4 py-3">{t('amount')}</th>
                        <th className="px-4 py-3">{t('walletTxBalanceAfter')}</th>
                        <th className="px-4 py-3">{t('walletTxDetails')}</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row._id} className="border-t border-gray-100">
                            <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(row.createdAt)}</td>
                            <td className="px-4 py-3">{row.label || row.type}</td>
                            <td className="px-4 py-3">
                                <span
                                    className={`inline-flex items-center gap-1 font-semibold ${
                                        row.direction === 'credit' ? 'text-green-600' : 'text-red-600'
                                    }`}
                                >
                                    {row.direction === 'credit' ? (
                                        <FaArrowUp className="w-3 h-3" />
                                    ) : (
                                        <FaArrowDown className="w-3 h-3" />
                                    )}
                                    {row.direction === 'credit' ? '+' : '-'}
                                    {formatCurrency(row.amount)}
                                </span>
                            </td>
                            <td className="px-4 py-3 font-medium">{formatCurrency(row.balanceAfter)}</td>
                            <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{row.description || '-'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        <div className="md:hidden space-y-3">
            {rows.map((row) => (
                <div key={row._id} className="rounded-xl border border-violet-100 bg-white p-4 shadow-sm">
                    <div className="flex justify-between items-start gap-2">
                        <p className="font-semibold text-gray-800 text-sm">{row.label || row.type}</p>
                        <span
                            className={`text-sm font-bold shrink-0 ${
                                row.direction === 'credit' ? 'text-green-600' : 'text-red-600'
                            }`}
                        >
                            {row.direction === 'credit' ? '+' : '-'}
                            {formatCurrency(row.amount)}
                        </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{formatDateTime(row.createdAt)}</p>
                    {row.description && <p className="text-xs text-gray-600 mt-2">{row.description}</p>}
                    <p className="text-xs mt-2 text-gray-500">
                        {t('walletTxBalanceAfter')}:{' '}
                        <span className="font-semibold text-gray-800">{formatCurrency(row.balanceAfter)}</span>
                    </p>
                </div>
            ))}
        </div>
    </>
);

const FromBookieSummaryCard = ({ summary, accent, t, role }) => {
    const received = Number(summary?.received ?? 0);
    const advance = Number(summary?.advanceFromBookie ?? received);
    const settled = Number(summary?.commissionSettledDeducted ?? 0);
    const remaining = Number(summary?.remainingFromBookie ?? Math.max(0, advance - settled));
    const isParentBookie = role === 'bookie';

    return (
        <div className={`rounded-xl border p-4 ${accent}`}>
            <div className="flex items-center gap-2 mb-2">
                <FaMoneyBillWave className="w-5 h-5 shrink-0 text-violet-600" />
                <h3 className="font-semibold text-xs sm:text-sm text-gray-800 leading-tight">
                    {t('walletTxFromBookieSummary')}
                </h3>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{formatCurrency(received)}</p>
            <div className="text-xs text-gray-600 mt-2 space-y-1 border-t border-violet-100 pt-2">
                <div className="flex justify-between gap-2">
                    <span>
                        {isParentBookie ? t('walletTxSuperBookieAdvanceGiven') : t('walletTxAdvanceFromBookie')}
                    </span>
                    <span className="font-semibold text-violet-800">{formatCurrency(advance)}</span>
                </div>
                {settled > 0 && (
                    <div className="flex justify-between gap-2 text-amber-800">
                        <span>{t('walletTxCommissionSettledDeduct')}</span>
                        <span className="font-semibold">−{formatCurrency(settled)}</span>
                    </div>
                )}
                <div className="flex justify-between gap-2 pt-1 border-t border-violet-50">
                    <span className="font-medium text-gray-700">{t('walletTxRemainingFromBookie')}</span>
                    <span className="font-bold text-green-700">{formatCurrency(remaining)}</span>
                </div>
                <p className="text-[10px] text-gray-400 pt-0.5">{t('walletTxCommissionDeductNote')}</p>
            </div>
        </div>
    );
};

const SummaryCard = ({ icon: Icon, title, summary, accent, showOpening, variant, footerNote, t }) => {
    const opening = Number(summary?.openingBalance ?? 0);
    const amount = Number(summary?.received ?? summary?.credit ?? summary?.withdrawn ?? 0);
    const logged = Math.max(0, amount - opening);
    const isDebit = variant === 'debit';
    return (
        <div className={`rounded-xl border p-4 ${accent}`}>
            <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-5 h-5 shrink-0 ${isDebit ? 'text-red-600' : ''}`} />
                <h3 className="font-semibold text-xs sm:text-sm text-gray-800 leading-tight">{title}</h3>
            </div>
            <p className={`text-xl sm:text-2xl font-bold ${isDebit ? 'text-red-600' : 'text-gray-900'}`}>
                {isDebit ? '−' : ''}
                {formatCurrency(amount)}
            </p>
            <p className="text-xs text-gray-500 mt-1 space-y-0.5">
                {showOpening && opening > 0 && (
                    <span className="block text-violet-700">
                        incl. opening {formatCurrency(opening)}
                    </span>
                )}
                {!isDebit && logged > 0 && amount !== logged && (
                    <span className="block">logged {formatCurrency(logged)}</span>
                )}
                {footerNote}
                {(summary?.count ?? 0) > 0 && <span className="block">{summary.count} tx</span>}
            </p>
        </div>
    );
};

const AdminFromSummaryCard = ({ summary, accent, t }) => {
    const received = Number(summary?.received ?? 0);
    const settled = Number(summary?.commissionSettled ?? 0);
    return (
        <div className={`rounded-xl border p-4 ${accent}`}>
            <div className="flex items-center gap-2 mb-2">
                <FaMoneyBillWave className="w-5 h-5 shrink-0 text-indigo-600" />
                <h3 className="font-semibold text-xs sm:text-sm text-gray-800 leading-tight">
                    {t('walletTxFromAdminSummary')}
                </h3>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{formatCurrency(received)}</p>
            <p className="text-xs text-gray-500 mt-1 space-y-0.5">
                {settled > 0 && (
                    <span className="block text-amber-700">
                        {t('commissionSettled')}: {formatCurrency(settled)}
                    </span>
                )}
                {(summary?.count ?? 0) > 0 && <span className="block">{summary.count} tx</span>}
            </p>
        </div>
    );
};

const AdminWalletTransactions = () => {
    const { t } = useLanguage();
    const { updateBookie } = useAuth();
    const [rows, setRows] = useState([]);
    const [summaries, setSummaries] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ totalPages: 1, hasNextPage: false, hasPrevPage: false });
    const [category, setCategory] = useState('from_admin');
    const [operatorRole, setOperatorRole] = useState('bookie');

    const fetchTransactions = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            const params = new URLSearchParams({ page: String(page), limit: '30', category });
            const res = await fetchWithAuth(`${API_BASE_URL}/bookie/wallet-transactions?${params}`);
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || 'Failed to load transactions');
            }
            setRows(json.data || []);
            setSummaries(json.summaries || null);
            if (json.operatorRole) setOperatorRole(json.operatorRole);
            setPagination(json.pagination || { totalPages: 1, hasNextPage: false, hasPrevPage: false });
            if (json.currentBalance != null) {
                updateBookie({ balance: json.currentBalance });
            }
            dispatchWalletSummaryRefresh();
        } catch (e) {
            setError(e.message || 'Failed to load');
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [page, category, updateBookie]);

    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);

    const categories = [
        { id: 'from_admin', label: t('walletTxFromAdmin'), icon: FaMoneyBillWave },
        { id: 'from_player', label: t('walletTxFromPlayer'), icon: FaUsers },
        { id: 'all', label: t('walletTxAll'), icon: FaList },
    ];

    const emptyMsg =
        category === 'from_admin'
            ? t('walletTxEmptyAdmin')
            : category === 'from_player'
              ? t('walletTxEmptyPlayer')
              : t('walletTxEmpty');

    const playerDepositsSummary = summaries?.from_player
        ? { received: summaries.from_player.received ?? 0, count: summaries.from_player.depositCount }
        : null;
    const playerWithdrawalsSummary = summaries?.from_player
        ? { withdrawn: summaries.from_player.withdrawn ?? 0, count: summaries.from_player.withdrawalCount }
        : null;
    const commissionSettledTotal = Number(summaries?.grandTotal?.commissionSettled ?? 0);
    const grandSummary = summaries?.grandTotal
        ? {
              received: summaries.grandTotal.received ?? 0,
              footerNote:
                  commissionSettledTotal > 0 ? (
                      <span className="block text-amber-700">
                          {t('walletTxMinusCommissionSettled')}: −{formatCurrency(commissionSettledTotal)}
                      </span>
                  ) : null,
          }
        : null;

    return (
        <Layout title={t('walletTxFromAdmin')}>
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2 text-[#1B3150]">
                        <FaWallet className="w-6 h-6" />
                        <p className="text-sm text-gray-600">{t('commissionFromAdminSubtitle')}</p>
                    </div>
                    <button
                        type="button"
                        onClick={fetchTransactions}
                        disabled={loading}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#1B3150] text-white text-sm font-semibold disabled:opacity-60"
                    >
                        <FaSyncAlt className={loading ? 'animate-spin' : ''} />
                        {t('refresh')}
                    </button>
                </div>

                {summaries && grandSummary && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                        <AdminFromSummaryCard
                            summary={summaries.from_admin}
                            accent="border-indigo-200 bg-indigo-50/80"
                            t={t}
                        />
                        <SummaryCard
                            icon={FaUsers}
                            title={t('walletTxFromPlayerSummary')}
                            summary={playerDepositsSummary}
                            accent="border-emerald-200 bg-emerald-50/80"
                            t={t}
                        />
                        <SummaryCard
                            icon={FaArrowDown}
                            title={t('walletTxPlayerWithdrawalsSummary')}
                            summary={playerWithdrawalsSummary}
                            accent="border-red-200 bg-red-50/80"
                            variant="debit"
                            t={t}
                        />
                        <SummaryCard
                            icon={FaWallet}
                            title={t('walletTxGrandTotal')}
                            summary={grandSummary}
                            accent="border-[#1B3150]/30 bg-[#1B3150]/10 ring-1 ring-[#1B3150]/20"
                            footerNote={grandSummary?.footerNote}
                            t={t}
                        />
                    </div>
                )}

                <div className="flex flex-wrap gap-2">
                    {categories.map((c) => (
                        <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                                setCategory(c.id);
                                setPage(1);
                            }}
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
                                category === c.id
                                    ? 'bg-[#1B3150] text-white'
                                    : 'bg-violet-50 text-gray-700 hover:bg-violet-100'
                            }`}
                        >
                            <c.icon className="w-4 h-4" />
                            {c.label}
                        </button>
                    ))}
                </div>

                {error && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}

                {loading && rows.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">{t('loading')}</div>
                ) : rows.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">{emptyMsg}</div>
                ) : (
                    <TxTable rows={rows} t={t} />
                )}

                {(pagination.hasPrevPage || pagination.hasNextPage) && (
                    <div className="flex justify-center gap-3 pt-2">
                        <button
                            type="button"
                            disabled={!pagination.hasPrevPage || loading}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            className="px-4 py-2 rounded-lg border text-sm disabled:opacity-50"
                        >
                            {t('walletTxPrev')}
                        </button>
                        <span className="py-2 text-sm text-gray-600">
                            {page} / {pagination.totalPages || 1}
                        </span>
                        <button
                            type="button"
                            disabled={!pagination.hasNextPage || loading}
                            onClick={() => setPage((p) => p + 1)}
                            className="px-4 py-2 rounded-lg border text-sm disabled:opacity-50"
                        >
                            {t('walletTxNext')}
                        </button>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default AdminWalletTransactions;
