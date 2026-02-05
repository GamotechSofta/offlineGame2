import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBalance, getMyWalletTransactions } from '../api/bets';

const Bank = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [balance, setBalance] = useState(0);
  const [balanceOk, setBalanceOk] = useState(false);
  const [txs, setTxs] = useState([]);
  const [page, setPage] = useState(1);

  const isLoggedIn = useMemo(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || 'null');
      return !!(u?.id || u?._id);
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [b, t] = await Promise.all([getBalance(), getMyWalletTransactions(500)]);
        if (!alive) return;
        if (b?.success && b?.data?.balance != null) {
          setBalance(Number(b.data.balance) || 0);
          setBalanceOk(true);
        } else {
          setBalanceOk(false);
        }
        if (t?.success && Array.isArray(t?.data)) setTxs(t.data);
        if (!t?.success && t?.message) setError(t.message);
      } catch (e) {
        if (!alive) return;
        setError(e?.message || 'Failed to load transactions');
      } finally {
        if (alive) setLoading(false);
      }
    };

    if (isLoggedIn) load();
    else setLoading(false);

    return () => {
      alive = false;
    };
  }, [isLoggedIn]);

  const formatMoney = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0.00';
    return n.toFixed(2);
  };

  const formatTime = (iso) => {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '-';
      const date = d.toLocaleDateString('en-GB').replace(/\//g, '-');
      const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      return `${date} ${String(time).toUpperCase()}`;
    } catch {
      return '-';
    }
  };

  const humanBetType = (betType) => {
    const t = (betType || '').toString().toLowerCase();
    if (t === 'single') return 'Single Ank';
    if (t === 'jodi') return 'Digit';
    if (t === 'panna') return 'Panna';
    if (t === 'half-sangam') return 'Half Sangam';
    if (t === 'full-sangam') return 'Full Sangam';
    return '';
  };

  const inferSession = (betType) => {
    const t = (betType || '').toString().toLowerCase();
    // In this backend: single/panna settle on opening; others on closing
    if (t === 'single' || t === 'panna') return 'open';
    if (t) return 'close';
    return '';
  };

  const parseDesc = (desc) => {
    const s = (desc || '').toString().trim();
    if (!s) return null;

    // Win – MARKET (Single 7) / (Panna 123) / (Jodi 12) / (Half Sangam) / (Full Sangam)
    const win = s.match(/^Win\s*–\s*(.+?)\s*\((.+)\)\s*$/i);
    if (win) {
      const marketName = (win[1] || '').trim();
      const inner = (win[2] || '').trim();
      const parts = inner.split(/\s+/);
      const kindRaw = (parts[0] || '').trim();
      const number = parts.slice(1).join(' ').trim();
      const kind =
        kindRaw.toLowerCase() === 'single'
          ? 'Single Ank'
          : kindRaw.toLowerCase() === 'jodi'
            ? 'Digit'
            : kindRaw.toLowerCase() === 'panna'
              ? 'Panna'
              : inner.toLowerCase().includes('half')
                ? 'Half Sangam'
                : inner.toLowerCase().includes('full')
                  ? 'Full Sangam'
                  : inner;
      const betType =
        kindRaw.toLowerCase() === 'single'
          ? 'single'
          : kindRaw.toLowerCase() === 'jodi'
            ? 'jodi'
            : kindRaw.toLowerCase() === 'panna'
              ? 'panna'
              : inner.toLowerCase().includes('half')
                ? 'half-sangam'
                : inner.toLowerCase().includes('full')
                  ? 'full-sangam'
                  : '';
      return {
        bidPlay: number || '-',
        game: marketName || '-',
        type: kind || '-',
        market: inferSession(betType) || '-',
      };
    }

    // Bet placed – MARKET (3 bet(s))
    const placed = s.match(/^Bet\s*placed\s*–\s*(.+?)\s*\((\d+)\s*bet/i);
    if (placed) {
      const marketName = (placed[1] || '').trim();
      const count = Number(placed[2] || 0) || 0;
      return {
        bidPlay: count > 1 ? `${count} Bets` : '1 Bet',
        game: marketName || '-',
        type: 'Bet Placed',
        market: '-',
      };
    }

    // Admin credit/debit etc.
    return { bidPlay: '-', game: '-', type: '-', market: '-', raw: s };
  };

  const computed = useMemo(() => {
    // Compute running balances from current wallet balance backwards
    let running = Number(balance) || 0;
    return (txs || []).map((tx) => {
      const amt = Number(tx?.amount || 0) || 0;
      const type = (tx?.type || '').toString().toLowerCase();
      const currentBalance = balanceOk ? running : null;
      const previousBalance = balanceOk
        ? (type === 'debit' ? currentBalance + amt : currentBalance - amt)
        : null;
      const transactionAmount = type === 'debit' ? -amt : amt;
      if (balanceOk) running = previousBalance;
      return {
        id: tx?._id || tx?.id || `${tx?.createdAt || ''}-${type}-${amt}-${tx?.referenceId || ''}`,
        type: type === 'credit' ? 'Credit' : 'Debit',
        amount: amt,
        time: formatTime(tx?.createdAt),
        description: (tx?.description || '').toString(),
        bet: tx?.bet || null,
        previousBalance,
        transactionAmount,
        currentBalance,
      };
    });
  }, [txs, balance, balanceOk]);

  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil((computed.length || 0) / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const visible = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return computed.slice(start, start + PAGE_SIZE);
  }, [computed, currentPage]);

  useEffect(() => {
    setPage(1);
  }, [computed.length]);

  const hasPagination = computed.length > PAGE_SIZE;

  return (
    <div className={`min-h-screen bg-black text-white ${hasPagination ? 'pb-[100px] md:pb-10' : 'pb-24 md:pb-24'}`}>
      <div className="bg-black px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full border border-white/10 bg-[#202124] flex items-center justify-center text-white active:scale-95 transition-transform shadow-[0_6px_14px_rgba(0,0,0,0.35)]"
            aria-label="Go back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-semibold text-white">Transaction History</h1>
        </div>
      </div>

      <div className="px-4 pt-4">
        {!isLoggedIn ? (
          <div className="rounded-2xl border border-white/10 bg-[#202124] p-6 text-center text-gray-300 shadow-[0_10px_22px_rgba(0,0,0,0.35)]">
            Please login to see your transaction history.
          </div>
        ) : loading ? (
          <div className="rounded-2xl border border-white/10 bg-[#202124] p-6 text-center text-gray-300 shadow-[0_10px_22px_rgba(0,0,0,0.35)]">
            Loading...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-red-200">
            {error}
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#202124] p-6 text-center text-gray-300 shadow-[0_10px_22px_rgba(0,0,0,0.35)]">
            No transactions found.
          </div>
        ) : (
          <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-4">
            {visible.map((tx) => (
              (() => {
                const betTypeRaw = tx?.bet?.betType || '';
                const betNumber = (tx?.bet?.betNumber || '').toString().trim();
                const marketName = (tx?.bet?.marketName || '').toString().trim();

                const parsed = parseDesc(tx.description);
                const bidPlay = betNumber || parsed?.bidPlay || '-';
                const game = marketName || parsed?.game || '-';
                const typeLabel = humanBetType(betTypeRaw) || parsed?.type || '-';
                const marketLabel = inferSession(betTypeRaw) || parsed?.market || '-';

                const topColor = tx.type === 'Credit' ? 'text-[#2eaf58]' : 'text-red-400';

                return (
                  <div
                    key={tx.id}
                    className="bg-[#202124] text-white rounded-2xl border border-white/10 p-4 shadow-[0_10px_22px_rgba(0,0,0,0.40)]"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <div className={`font-semibold ${topColor}`}>
                        {tx.type} {formatMoney(tx.amount)} <span className="ml-1">₹</span>
                      </div>
                      <div className="text-gray-300">{tx.time}</div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-6 text-center">
                      <div>
                        <div className="text-[15px] font-extrabold text-[#d4af37]">Bid Play</div>
                        <div className="mt-1 text-[16px] font-semibold text-white">{bidPlay || '-'}</div>
                      </div>
                      <div>
                        <div className="text-[15px] font-extrabold text-[#d4af37]">Game</div>
                        <div className="mt-1 text-[16px] font-semibold break-words text-white">
                          {(game || '-').toUpperCase()}
                        </div>
                      </div>
                      <div>
                        <div className="text-[15px] font-extrabold text-[#d4af37]">Type</div>
                        <div className="mt-1 text-[16px] font-semibold text-white">{typeLabel || '-'}</div>
                      </div>
                      <div>
                        <div className="text-[15px] font-extrabold text-[#d4af37]">Market</div>
                        <div className="mt-1 text-[16px] font-semibold text-white">{marketLabel || '-'}</div>
                      </div>
                    </div>

                    <div className="border-t border-white/10 mt-5 pt-4 text-sm grid grid-cols-2 gap-4 text-center">
                      <div>
                        <div className="font-semibold text-gray-300">Previous Balance</div>
                        <div className="mt-1 text-[16px] font-semibold text-white">
                          {tx.previousBalance == null ? '—' : `₹${formatMoney(tx.previousBalance)}`}
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold text-gray-300">Transaction Amount</div>
                        <div
                          className={`mt-1 text-[16px] font-semibold ${tx.transactionAmount >= 0 ? 'text-[#2eaf58]' : 'text-red-400'}`}
                        >
                          {tx.transactionAmount >= 0 ? '+' : '-'} {formatMoney(Math.abs(tx.transactionAmount))} ₹
                        </div>
                      </div>
                    </div>

                    {tx.currentBalance != null ? (
                      <div className="border-t border-white/10 mt-4 pt-3 text-center font-extrabold text-[18px] text-[#d4af37]">
                        Current Balance : {formatMoney(tx.currentBalance)} ₹
                      </div>
                    ) : null}

                    {parsed?.raw ? (
                      <div className="mt-3 text-[12px] text-gray-400 text-center break-words">{parsed.raw}</div>
                    ) : null}
                  </div>
                );
              })()
            ))}
          </div>
        )}
      </div>

      {hasPagination ? (
        <div
          className="fixed left-0 right-0 z-40 px-4 pointer-events-none md:hidden"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 96px)' }}
        >
          <div>
            <div className="mx-auto w-full max-w-[520px] pointer-events-auto">
              <div className="bg-[#202124] rounded-full border border-white/10 px-4 py-2 flex items-center justify-between shadow-[0_10px_22px_rgba(0,0,0,0.40)]">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="flex items-center gap-1 text-white/90 font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="text-lg leading-none">‹</span>
                  <span>PREV</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold text-sm border border-white/10"
                  >
                    {currentPage}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="flex items-center gap-1 text-white/90 font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>NEXT</span>
                  <span className="text-lg leading-none">›</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Bank;
