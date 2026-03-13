import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { API_BASE_URL, fetchWithAuth } from '../utils/api';
import { useLanguage } from '../context/LanguageContext';

const formatNum = (num) => {
    if (num == null) return '0';
    return Number(num).toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

const Roulette = () => {
    const { t } = useLanguage();
    const [records, setRecords] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ userId: '', startDate: '', endDate: '' });
    const [applyKey, setApplyKey] = useState(0);

    useEffect(() => {
        const fetchRecords = async () => {
            try {
                setLoading(true);
                const q = new URLSearchParams();
                if (filters.userId) q.append('userId', filters.userId);
                if (filters.startDate) q.append('startDate', filters.startDate);
                if (filters.endDate) q.append('endDate', filters.endDate);
                q.append('limit', pagination.limit);
                q.append('page', pagination.page);
                const res = await fetchWithAuth(`${API_BASE_URL}/admin/roulette/records?${q}`);
                if (res.status === 401) return;
                const data = await res.json();
                if (data.success) {
                    setRecords(data.data || []);
                    setPagination((prev) => ({
                        ...prev,
                        ...(data.pagination || {}),
                        total: data.pagination?.total ?? 0,
                        totalPages: data.pagination?.totalPages ?? 0,
                    }));
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchRecords();
    }, [pagination.page, applyKey]);

    return (
        <Layout title={t('roulette') || 'Roulette'}>
            <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">{t('rouletteRecords') || 'Roulette records'}</h1>
            <p className="text-sm text-gray-600 mb-4">{t('rouletteRecordsMyPlayers') || 'Spins by your referred players only.'}</p>

            <div className="bg-white rounded-lg p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <input
                    type="text"
                    placeholder={t('playerId') || 'Player ID'}
                    value={filters.userId}
                    onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
                    className="px-3 py-2 border border-gray-200 rounded-lg"
                />
                <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                    className="px-3 py-2 border border-gray-200 rounded-lg"
                />
                <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    className="px-3 py-2 border border-gray-200 rounded-lg"
                />
                <button
                    type="button"
                    onClick={() => {
                        setPagination((p) => ({ ...p, page: 1 }));
                        setApplyKey((k) => k + 1);
                    }}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium"
                >
                    {t('apply') || 'Apply'}
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-500">{t('loading') || 'Loading...'}</div>
            ) : records.length === 0 ? (
                <div className="bg-white rounded-lg p-8 text-center text-gray-500">{t('noRouletteRecords') || 'No roulette records found'}</div>
            ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-3 py-2 text-left font-semibold text-gray-700">{t('time') || 'Time'}</th>
                                <th className="px-3 py-2 text-left font-semibold text-gray-700">{t('player') || 'Player'}</th>
                                <th className="px-3 py-2 text-left font-semibold text-gray-700">Spin ID</th>
                                <th className="px-3 py-2 text-center font-semibold text-gray-700">Win #</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-700">Bet</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-700">Payout</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-700">Profit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {records.map((r) => (
                                <tr key={r.spinId || r._id} className="hover:bg-gray-50">
                                    <td className="px-3 py-2 text-gray-600 font-mono text-xs">
                                        {r.createdAt ? new Date(r.createdAt).toLocaleString('en-IN') : '—'}
                                    </td>
                                    <td className="px-3 py-2 text-gray-800">
                                        {r.user?.username || r.user?.email || r.user?.phone || (typeof r.user === 'string' ? r.user : '—')}
                                    </td>
                                    <td className="px-3 py-2 font-mono text-xs truncate max-w-[120px]" title={r.spinId}>{r.spinId || '—'}</td>
                                    <td className="px-3 py-2 text-center font-semibold">{r.winningNumber ?? '—'}</td>
                                    <td className="px-3 py-2 text-right">₹{formatNum(r.totalBet)}</td>
                                    <td className="px-3 py-2 text-right">₹{formatNum(r.payout)}</td>
                                    <td className={`px-3 py-2 text-right font-semibold ${Number(r.profit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {Number(r.profit) >= 0 ? '+' : ''}₹{formatNum(r.profit)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                            <span className="text-sm text-gray-600">
                                {t('page') || 'Page'} {pagination.page} {t('of') || 'of'} {pagination.totalPages} ({pagination.total} {t('total') || 'total'})
                            </span>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    disabled={pagination.page <= 1}
                                    onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                                    className="px-3 py-1 border rounded-lg disabled:opacity-50"
                                >
                                    {t('previous') || 'Previous'}
                                </button>
                                <button
                                    type="button"
                                    disabled={pagination.page >= pagination.totalPages}
                                    onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                                    className="px-3 py-1 border rounded-lg disabled:opacity-50"
                                >
                                    {t('next') || 'Next'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Layout>
    );
};

export default Roulette;
