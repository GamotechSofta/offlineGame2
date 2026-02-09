import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';

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
  <svg className="w-16 h-16 text-gray-600" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
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
  <div className="flex items-center gap-3.5 px-4 py-4 animate-pulse">
    <div className="w-10 h-10 rounded-xl bg-white/5" />
    <div className="flex-1 space-y-2">
      <div className="h-3.5 w-32 rounded-lg bg-white/5" />
      <div className="h-3 w-20 rounded-lg bg-white/5" />
    </div>
    <div className="space-y-2 text-right">
      <div className="h-4 w-16 rounded-lg bg-white/5 ml-auto" />
      <div className="h-3 w-12 rounded-lg bg-white/5 ml-auto" />
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
      const [txRes, balRes] = await Promise.all([
        fetch(`${API_BASE_URL}/wallet/my-transactions?userId=${user.id}&limit=500`),
        fetch(`${API_BASE_URL}/wallet/balance?userId=${user.id}`),
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
    <div className="min-h-screen bg-[#0a0a0b] text-white pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">

      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-40 bg-[#0a0a0b]/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3 px-4 py-3 max-w-lg mx-auto">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all"
            aria-label="Back"
          >
            <IconBack />
          </button>
          <h2 className="text-base font-semibold tracking-wide flex-1">Passbook</h2>
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className={`w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all ${refreshing ? 'animate-spin' : ''}`}
            aria-label="Refresh"
          >
            <IconRefresh />
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">

        {/* ── Balance Card ── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] border border-white/10 shadow-2xl">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-yellow-500/5 blur-2xl" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-blue-500/5 blur-2xl" />
          
          <div className="relative p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Current Balance</p>
                <p className="text-[#f2c14e] text-3xl font-extrabold tracking-tight">
                  ₹{balance !== null ? formatAmount(balance) : '---'}
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[#f2c14e]/10 border border-[#f2c14e]/20 flex items-center justify-center text-[#f2c14e]">
                <IconWallet />
              </div>
            </div>

            {/* Credit / Debit Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m0 0l6.75-6.75M12 19.5l-6.75-6.75" />
                    </svg>
                  </div>
                  <span className="text-emerald-400/70 text-[10px] font-semibold uppercase tracking-wider">Credited</span>
                </div>
                <p className="text-emerald-400 text-lg font-bold">₹{formatAmount(stats.totalCredit)}</p>
              </div>
              <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19.5V4.5m0 0L5.25 11.25M12 4.5l6.75 6.75" />
                    </svg>
                  </div>
                  <span className="text-red-400/70 text-[10px] font-semibold uppercase tracking-wider">Withdrawn</span>
                </div>
                <p className="text-red-400 text-lg font-bold">₹{formatAmount(stats.totalDebit)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Filter Tabs ── */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hidden pb-1">
          {filters.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-semibold whitespace-nowrap transition-all active:scale-95 ${
                  active
                    ? 'bg-[#f2c14e]/15 border border-[#f2c14e]/30 text-[#f2c14e]'
                    : 'bg-[#141416] border border-white/5 text-gray-400 hover:text-white hover:border-white/10'
                }`}
              >
                {f.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  active ? 'bg-[#f2c14e]/20 text-[#f2c14e]' : 'bg-white/5 text-gray-500'
                }`}>
                  {f.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Transaction History ── */}
        <div className="rounded-3xl bg-[#141416] border border-white/5 overflow-hidden">
          <div className="px-5 pt-5 pb-2">
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Transaction History</h3>
          </div>

          {loading ? (
            <div className="pb-2">
              {[...Array(6)].map((_, i) => <SkeletonRow key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <IconEmpty />
              <p className="text-gray-400 font-semibold mt-4 text-sm">No transactions found</p>
              <p className="text-gray-600 text-xs mt-1 text-center">
                {filter === 'all'
                  ? 'Your transaction history will appear here'
                  : `No ${filter === 'credit' ? 'credit' : 'withdrawal'} transactions yet`}
              </p>
            </div>
          ) : (
            <div className="pb-2">
              {grouped.map(([date, txs]) => (
                <div key={date}>
                  {/* Date Header */}
                  <div className="px-5 py-2 mt-1">
                    <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-widest">{date}</p>
                  </div>

                  {/* Transactions */}
                  {txs.map((tx, idx) => {
                    const isCredit = tx.type === 'credit';
                    return (
                      <div
                        key={tx._id || idx}
                        className="flex items-center gap-3.5 px-4 py-3.5 mx-2 rounded-2xl hover:bg-white/[0.02] transition-colors"
                      >
                        {/* Icon */}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isCredit
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}>
                          {isCredit ? <IconCredit /> : <IconDebit />}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">
                            {tx.description || (isCredit ? 'Amount Credited' : 'Amount Withdrawn')}
                          </p>
                          <p className="text-gray-500 text-xs mt-0.5">{formatTime(tx.createdAt)}</p>
                        </div>

                        {/* Amount */}
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-bold ${isCredit ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isCredit ? '+' : '-'}₹{formatAmount(tx.amount)}
                          </p>
                          <p className={`text-[10px] font-semibold uppercase tracking-wider mt-0.5 ${
                            isCredit ? 'text-emerald-500/50' : 'text-red-500/50'
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
