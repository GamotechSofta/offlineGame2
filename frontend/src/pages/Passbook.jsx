import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, getAuthHeaders } from '../config/api';

/* ───────── Icons ───────── */
const IconBack = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);
const IconWallet = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 110 6h3.75A2.25 2.25 0 0021 13.5V12zm0 0V9.75a2.25 2.25 0 00-2.25-2.25h-13.5A2.25 2.25 0 003 9.75v7.5A2.25 2.25 0 005.25 19.5h13.5A2.25 2.25 0 0021 17.25V12z" />
  </svg>
);
const IconCredit = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m0 0l6.75-6.75M12 19.5l-6.75-6.75" />
  </svg>
);
const IconDebit = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19.5V4.5m0 0L5.25 11.25M12 4.5l6.75 6.75" />
  </svg>
);
const IconEmpty = () => (
  <svg className="w-16 h-16 md:w-20 md:h-20 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);
const IconRefresh = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
  </svg>
);

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatTime = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const formatAmount = (amount) => {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '0.00';
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/* ───────── Skeleton Loader ───────── */
const SkeletonRow = () => (
  <div className="flex items-center gap-3.5 md:gap-4 px-4 md:px-6 py-4 md:py-5 animate-pulse">
    <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gray-200" />
    <div className="flex-1 space-y-2">
      <div className="h-3.5 md:h-4 w-32 md:w-40 rounded-lg bg-gray-200" />
      <div className="h-3 md:h-3.5 w-20 md:w-24 rounded-lg bg-gray-200" />
    </div>
    <div className="space-y-2 text-right">
      <div className="h-4 md:h-5 w-16 md:w-20 rounded-lg bg-gray-200 ml-auto" />
      <div className="h-3 md:h-3.5 w-12 md:w-16 rounded-lg bg-gray-200 ml-auto" />
    </div>
  </div>
);

const Passbook = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'credit' | 'debit'
  const [balance, setBalance] = useState(null);

  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); }
    catch { return {}; }
  }, []);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!user.id) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const headers = getAuthHeaders();
      const [txRes, balRes] = await Promise.all([
        fetch(`${API_BASE_URL}/wallet/my-transactions?limit=500`, { headers }),
        fetch(`${API_BASE_URL}/wallet/balance`, { headers }),
      ]);
      const txData = await txRes.json();
      const balData = await balRes.json();

      if (txData.success) setTransactions(txData.data || []);
      if (balData.success) setBalance(balData.data?.balance ?? 0);
    } catch (err) {
      console.error('Passbook fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Derived data ── */
  const filtered = useMemo(() => {
    if (filter === 'all') return transactions;
    return transactions.filter((t) => t.type === filter);
  }, [transactions, filter]);

  const stats = useMemo(() => {
    let totalCredit = 0, totalDebit = 0, creditCount = 0, debitCount = 0;
    transactions.forEach((t) => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'credit') { totalCredit += amt; creditCount++; }
      else { totalDebit += amt; debitCount++; }
    });
    return { totalCredit, totalDebit, creditCount, debitCount };
  }, [transactions]);

  /* ── Group transactions by date ── */
  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach((t) => {
      const key = formatDate(t.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const filters = [
    { key: 'all', label: 'All', count: transactions.length },
    { key: 'credit', label: 'Credited', count: stats.creditCount },
    { key: 'debit', label: 'Withdrawn', count: stats.debitCount },
  ];

  return (
    <div className="min-h-screen bg-white pb-[calc(6rem+env(safe-area-inset-bottom,0px))] md:pb-4">

      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3 max-w-7xl mx-auto">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center hover:bg-gray-100 active:scale-95 transition-all text-gray-700"
            aria-label="Back"
          >
            <IconBack />
          </button>
          <h2 className="text-base md:text-lg font-semibold tracking-wide flex-1 text-gray-800">Passbook</h2>
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className={`w-9 h-9 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center hover:bg-gray-100 active:scale-95 transition-all text-gray-700 ${refreshing ? 'animate-spin' : ''}`}
            aria-label="Refresh"
          >
            <IconRefresh />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 pt-4 md:pt-6 space-y-4 md:space-y-6">

        {/* ── Balance Card ── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-50 via-white to-gray-50 border-2 border-gray-200 shadow-xl">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-gray-100/50 blur-2xl" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-gray-100/50 blur-2xl" />
          
          <div className="relative p-5 md:p-6">
            <div className="flex items-center justify-between mb-4 md:mb-5">
              <div>
                <p className="text-gray-600 text-xs md:text-sm font-medium uppercase tracking-wider mb-1">Current Balance</p>
                <p className="text-[#1B3150] text-3xl md:text-4xl font-extrabold tracking-tight">
                  ₹{balance !== null ? formatAmount(balance) : '---'}
                </p>
              </div>
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gray-50 border-2 border-gray-200 flex items-center justify-center text-[#1B3150]">
                <IconWallet />
              </div>
            </div>

            {/* Credit / Debit Summary */}
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-200 p-3 md:p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 md:w-7 md:h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m0 0l6.75-6.75M12 19.5l-6.75-6.75" />
                    </svg>
                  </div>
                  <span className="text-emerald-600 text-[10px] md:text-xs font-semibold uppercase tracking-wider">Credited</span>
                </div>
                <p className="text-emerald-600 text-lg md:text-xl font-bold">₹{formatAmount(stats.totalCredit)}</p>
              </div>
              <div className="rounded-2xl bg-red-50 border-2 border-red-200 p-3 md:p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 md:w-7 md:h-7 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
                    <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19.5V4.5m0 0L5.25 11.25M12 4.5l6.75 6.75" />
                    </svg>
                  </div>
                  <span className="text-red-600 text-[10px] md:text-xs font-semibold uppercase tracking-wider">Withdrawn</span>
                </div>
                <p className="text-red-600 text-lg md:text-xl font-bold">₹{formatAmount(stats.totalDebit)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Filter Tabs ── */}
        <div className="flex gap-2 md:gap-3 overflow-x-auto scrollbar-hidden pb-1">
          {filters.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`flex items-center gap-1.5 px-4 md:px-5 py-2.5 md:py-3 rounded-2xl text-sm md:text-base font-semibold whitespace-nowrap transition-all active:scale-95 ${
                  active
                    ? 'bg-gray-100 border-2 border-gray-300 text-gray-600 shadow-sm'
                    : 'bg-white border-2 border-gray-200 text-gray-600 hover:text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {f.label}
                <span className={`text-xs md:text-sm px-1.5 md:px-2 py-0.5 md:py-1 rounded-full ${
                  active ? 'bg-[#1B3150] text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {f.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Transaction History ── */}
        <div className="rounded-3xl bg-white border-2 border-gray-200 overflow-hidden shadow-sm">
          <div className="px-5 md:px-6 pt-5 md:pt-6 pb-2 md:pb-3">
            <h3 className="text-gray-800 font-semibold text-sm md:text-base uppercase tracking-wider">Transaction History</h3>
          </div>

          {loading ? (
            <div className="pb-2">
              {[...Array(6)].map((_, i) => <SkeletonRow key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-12 md:py-16 px-4">
              <IconEmpty />
              <p className="text-gray-600 font-semibold mt-4 text-sm md:text-base">No transactions found</p>
              <p className="text-gray-500 text-xs md:text-sm mt-1 text-center">
                {filter === 'all'
                  ? 'Your transaction history will appear here'
                  : `No ${filter === 'credit' ? 'credit' : 'withdrawal'} transactions yet`}
              </p>
            </div>
          ) : (
            <div className="pb-2 md:pb-4">
              {grouped.map(([date, txs]) => (
                <div key={date}>
                  {/* Date Header */}
                  <div className="px-5 md:px-6 py-2 md:py-3 mt-1 bg-gray-50/50">
                    <p className="text-gray-600 text-[10px] md:text-xs font-semibold uppercase tracking-widest">{date}</p>
                  </div>

                  {/* Transactions */}
                  {txs.map((tx, idx) => {
                    const isCredit = tx.type === 'credit';
                    return (
                      <div
                        key={tx._id || idx}
                        className="flex items-center gap-3.5 md:gap-4 px-4 md:px-6 py-3.5 md:py-4 mx-2 md:mx-4 rounded-2xl hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                      >
                        {/* Icon */}
                        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 ${
                          isCredit
                            ? 'bg-emerald-100 text-emerald-600 border-2 border-emerald-200'
                            : 'bg-red-100 text-red-600 border-2 border-red-200'
                        }`}>
                          {isCredit ? <IconCredit /> : <IconDebit />}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-800 text-sm md:text-base font-medium truncate">
                            {tx.description || (isCredit ? 'Amount Credited' : 'Amount Withdrawn')}
                          </p>
                          <p className="text-gray-500 text-xs md:text-sm mt-0.5">{formatTime(tx.createdAt)}</p>
                        </div>

                        {/* Amount */}
                        <div className="text-right shrink-0">
                          <p className={`text-sm md:text-base font-bold ${isCredit ? 'text-emerald-600' : 'text-red-600'}`}>
                            {isCredit ? '+' : '-'}₹{formatAmount(tx.amount)}
                          </p>
                          <p className={`text-[10px] md:text-xs font-semibold uppercase tracking-wider mt-0.5 ${
                            isCredit ? 'text-emerald-500' : 'text-red-500'
                          }`}>
                            {isCredit ? 'Credit' : 'Debit'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom spacer */}
        <div className="h-2" />
      </div>
    </div>
  );
};

export default Passbook;
