import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';

const safeParse = (raw, fallback) => {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const formatTxnTime = (iso) => {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    const date = d.toLocaleDateString('en-GB').replace(/\//g, '-');
    const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    return `${date} ${time}`;
  } catch {
    return '-';
  }
};

const renderBetNumber = (val) => {
  const s = (val ?? '').toString().trim();
  if (/^\d{2}$/.test(s)) {
    return (
      <span className="inline-flex items-center justify-center gap-2">
        <span>{s[0]}</span>
        <span>{s[1]}</span>
      </span>
    );
  }
  return s || '-';
};

const sumDigits = (str) => [...String(str)].reduce((acc, c) => acc + (Number(c) || 0), 0);
const lastDigit = (str) => sumDigits(str) % 10;

const normalizeMarketName = (s) => (s || '').toString().trim().toLowerCase();

const inferBetKind = (betNumberRaw) => {
  const s = (betNumberRaw ?? '').toString().trim();
  if (!s) return 'unknown';
  if (s.includes('-')) {
    const [a, b] = s.split('-').map((x) => (x || '').trim());
    if (/^\d{3}$/.test(a) && /^\d{3}$/.test(b)) return 'full-sangam';
    if (/^\d{3}$/.test(a) && /^\d$/.test(b)) return 'half-sangam-open';
    if (/^\d$/.test(a) && /^\d{3}$/.test(b)) return 'half-sangam-close';
    return 'unknown';
  }
  if (/^\d$/.test(s)) return 'digit';
  if (/^\d{2}$/.test(s)) return 'jodi';
  if (/^\d{3}$/.test(s)) return 'panna';
  return 'unknown';
};

const getPayoutMultiplier = (kind, betNumberRaw) => {
  if (kind === 'digit') return 9;
  if (kind === 'jodi') return 90;
  if (kind === 'half-sangam-open' || kind === 'half-sangam-close') return 1000;
  if (kind === 'full-sangam') return 10000;
  if (kind === 'panna') {
    const s = (betNumberRaw ?? '').toString().trim();
    if (/^\d{3}$/.test(s)) {
      const a = s[0], b = s[1], c = s[2];
      const allSame = a === b && b === c;
      const twoSame = a === b || b === c || a === c;
      if (allSame) return 600; // triple patti
      if (twoSame) return 300; // double patti
      return 150; // single patti
    }
  }
  return 0;
};

const evaluateBet = ({ market, betNumberRaw, amount, session }) => {
  const opening = market?.openingNumber && /^\d{3}$/.test(String(market.openingNumber)) ? String(market.openingNumber) : null;
  const closing = market?.closingNumber && /^\d{3}$/.test(String(market.closingNumber)) ? String(market.closingNumber) : null;
  const openDigit = opening ? String(lastDigit(opening)) : null;
  const closeDigit = closing ? String(lastDigit(closing)) : null;
  const jodi = openDigit != null && closeDigit != null ? `${openDigit}${closeDigit}` : null;

  const betNumber = (betNumberRaw ?? '').toString().trim();
  const kind = inferBetKind(betNumber);
  const sess = (session || '').toString().trim().toUpperCase();

  // Determine if result is declared for this kind/session
  const declared =
    kind === 'digit'
      ? (sess === 'OPEN' ? !!openDigit : sess === 'CLOSE' ? !!closeDigit : !!(openDigit && closeDigit))
      : kind === 'panna'
        ? (sess === 'OPEN' ? !!opening : sess === 'CLOSE' ? !!closing : !!(opening && closing))
        : kind === 'jodi'
          ? !!jodi
          : kind === 'half-sangam-open' || kind === 'half-sangam-close' || kind === 'full-sangam'
            ? !!(opening && closing)
            : false;

  if (!declared) return { state: 'pending', kind, payout: 0 };

  let won = false;
  if (kind === 'digit') {
    if (sess === 'OPEN') won = betNumber === openDigit;
    else if (sess === 'CLOSE') won = betNumber === closeDigit;
    else won = betNumber === openDigit || betNumber === closeDigit;
  } else if (kind === 'jodi') {
    won = betNumber === jodi;
  } else if (kind === 'panna') {
    if (sess === 'OPEN') won = betNumber === opening;
    else if (sess === 'CLOSE') won = betNumber === closing;
    else won = betNumber === opening || betNumber === closing;
  } else if (kind === 'full-sangam') {
    won = betNumber === `${opening}-${closing}`;
  } else if (kind === 'half-sangam-open') {
    won = betNumber === `${opening}-${closeDigit}`;
  } else if (kind === 'half-sangam-close') {
    won = betNumber === `${openDigit}-${closing}`;
  }

  if (!won) return { state: 'lost', kind, payout: 0 };

  const mul = getPayoutMultiplier(kind, betNumber);
  const payout = mul > 0 ? (Number(amount) || 0) * mul : 0;
  return { state: 'won', kind, payout };
};

const BetHistory = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('All');
  const [markets, setMarkets] = useState([]);

  const { userId, bets } = useMemo(() => {
    const u = safeParse(localStorage.getItem('user') || 'null', null);
    const uid = u?._id || u?.id || u?.userId || u?.userid || u?.user_id || u?.uid || null;
    const all = safeParse(localStorage.getItem('betHistory') || '[]', []);
    const list = Array.isArray(all) ? all : [];
    const onlyMine = uid ? list.filter((x) => x?.userId === uid) : list;
    return { userId: uid, bets: onlyMine };
  }, []);

  const visible = useMemo(() => {
    if (filter === 'All') return bets;
    // Placeholder filter: no result data stored yet, so show all.
    return bets;
  }, [filter, bets]);

  const flat = useMemo(() => {
    const out = [];
    for (const x of visible || []) {
      const rows = Array.isArray(x?.rows) ? x.rows : [];
      if (!rows.length) {
        out.push({ x, r: null, idx: 0 });
        continue;
      }
      rows.forEach((r, idx) => out.push({ x, r, idx }));
    }
    return out;
  }, [visible]);

  useEffect(() => {
    let alive = true;
    const fetchMarkets = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/markets/get-markets`);
        const data = await res.json();
        if (!alive) return;
        if (data?.success && Array.isArray(data?.data)) {
          setMarkets(data.data);
        }
      } catch {
        // ignore
      }
    };
    fetchMarkets();
    const id = setInterval(fetchMarkets, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const marketByName = useMemo(() => {
    const map = new Map();
    for (const m of markets || []) {
      map.set(normalizeMarketName(m?.marketName), m);
    }
    return map;
  }, [markets]);

  return (
    <div className="min-h-screen bg-black text-white px-3 sm:px-4 pt-3 pb-28">
      <div className="w-full max-w-3xl mx-auto">
        {/* Header row */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white hover:bg-white/15 active:scale-95 transition"
              aria-label="Back"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl sm:text-2xl font-bold truncate">Bet History</h1>
          </div>

          <button
            type="button"
            onClick={() => setFilter((p) => (p === 'All' ? 'Win' : p === 'Win' ? 'Lose' : 'All'))}
            className="shrink-0 flex items-center gap-2 text-white/80 hover:text-white transition-colors"
            aria-label="Filter"
            title="Filter"
          >
            <span className="text-sm font-semibold">Filter By</span>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18l-7 8v6l-4 2v-8L3 4z" />
            </svg>
          </button>
        </div>

        {/* Cards */}
        <div className="space-y-4">
          {flat.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#202124] p-6 text-center text-gray-300">
              {userId ? 'No bets found.' : 'Please login to see your bet history.'}
            </div>
          ) : flat.map(({ x, r, idx }) => {
            const betValue = r?.number != null ? renderBetNumber(r.number) : '-';
            const gameType = (x?.labelKey || 'Bet').toString();
            const points = Number(r?.points || 0) || 0;
            const session = (r?.type || x?.session || '').toString();
            const market = (x?.marketTitle || '').toString().trim() || 'MARKET';
            const m = marketByName.get(normalizeMarketName(market));
            const verdict = evaluateBet({
              market: m,
              betNumberRaw: r?.number,
              amount: points,
              session,
            });

            return (
            <div key={`${x.id}-${r?.id ?? idx}`} className="rounded-2xl overflow-hidden border border-white/10 bg-[#202124] shadow-[0_12px_24px_rgba(0,0,0,0.35)]">
              <div className="bg-[#0b2b55] px-4 py-3 text-center">
                <div className="text-white font-extrabold tracking-wide">
                  {market.toUpperCase()} {session ? `(${session})` : ''}
                </div>
              </div>

              <div className="px-4 py-4">
                <div className="grid grid-cols-3 text-center text-[#d4af37] font-bold">
                  <div>Game Type</div>
                  <div>{(x?.labelKey || 'Bet').toString()}</div>
                  <div>Points</div>
                </div>
                <div className="mt-3 grid grid-cols-3 text-center text-white/90">
                  <div className="font-semibold">{gameType}</div>
                  <div className="font-extrabold">{betValue}</div>
                  <div className="font-extrabold">{points}</div>
                </div>
              </div>

              <div className="h-px bg-white/10" />

              <div className="px-4 py-3 text-center text-white/70">
                Transaction: <span className="font-semibold">{formatTxnTime(x?.createdAt)}</span>
              </div>

              <div className="h-px bg-white/10" />

              {verdict.state === 'won' ? (
                <div className="px-4 py-3 text-center font-semibold text-[#43b36a]">
                  Congratulations, You Won {verdict.payout ? `₹${Number(verdict.payout || 0).toLocaleString('en-IN')}` : ''}
                </div>
              ) : verdict.state === 'lost' ? (
                <div className="px-4 py-3 text-center font-semibold text-red-400">
                  Better Luck Next time
                </div>
              ) : (
                <div className="px-4 py-3 text-center font-semibold text-[#43b36a]">
                  Bet Placed
                </div>
              )}
            </div>
            );
          })}
        </div>
      </div>

      {/* Bottom pagination (UI only) */}
      <div className="fixed left-0 right-0 bottom-[88px] z-20 px-3 sm:px-4">
        <div className="w-full max-w-3xl mx-auto bg-white rounded-xl shadow-[0_16px_30px_rgba(0,0,0,0.35)] overflow-hidden">
          <div className="grid grid-cols-3 items-center">
            <button type="button" className="py-3 text-gray-700 font-semibold border-r border-gray-200 text-sm">
              ‹ PREV
            </button>
            <div className="flex items-center justify-center py-2.5">
              <div className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center font-bold text-sm">1</div>
            </div>
            <button type="button" className="py-3 text-gray-700 font-semibold border-l border-gray-200 text-sm">
              NEXT ›
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BetHistory;

