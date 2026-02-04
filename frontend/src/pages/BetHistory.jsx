import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import { getRatesCurrent } from '../api/bets';

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

// Backend defaults (must match backend/models/rate/rate.js) – used when API rates not loaded
const DEFAULT_RATES = { single: 10, jodi: 100, singlePatti: 150, doublePatti: 300, triplePatti: 1000, halfSangam: 5000, fullSangam: 10000 };

const rateNum = (val, def) => (Number.isFinite(Number(val)) && Number(val) >= 0 ? Number(val) : def);
const getPayoutMultiplier = (kind, betNumberRaw, ratesMap) => {
  const r = ratesMap && typeof ratesMap === 'object' ? ratesMap : DEFAULT_RATES;
  if (kind === 'digit') return rateNum(r.single, DEFAULT_RATES.single);
  if (kind === 'jodi') return rateNum(r.jodi, DEFAULT_RATES.jodi);
  if (kind === 'half-sangam-open' || kind === 'half-sangam-close') return rateNum(r.halfSangam, DEFAULT_RATES.halfSangam);
  if (kind === 'full-sangam') return rateNum(r.fullSangam, DEFAULT_RATES.fullSangam);
  if (kind === 'panna') {
    const s = (betNumberRaw ?? '').toString().trim();
    if (/^\d{3}$/.test(s)) {
      const a = s[0], b = s[1], c = s[2];
      const allSame = a === b && b === c;
      const twoSame = a === b || b === c || a === c;
      if (allSame) return rateNum(r.triplePatti, DEFAULT_RATES.triplePatti);
      if (twoSame) return rateNum(r.doublePatti, DEFAULT_RATES.doublePatti);
      return rateNum(r.singlePatti, DEFAULT_RATES.singlePatti);
    }
  }
  return 0;
};

const evaluateBet = ({ market, betNumberRaw, amount, session, ratesMap }) => {
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

  const mul = getPayoutMultiplier(kind, betNumber, ratesMap);
  const payout = mul > 0 ? (Number(amount) || 0) * mul : 0;
  return { state: 'won', kind, payout };
};

const BetHistory = () => {
  const navigate = useNavigate();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState([]); // ['OPEN','CLOSE']
  const [selectedStatuses, setSelectedStatuses] = useState([]); // ['Win','Loose','Pending']
  const [selectedMarkets, setSelectedMarkets] = useState([]); // normalized market keys
  const [page, setPage] = useState(1);
  const [markets, setMarkets] = useState([]);
  const [ratesMap, setRatesMap] = useState(null);

  const { userId, bets } = useMemo(() => {
    const u = safeParse(localStorage.getItem('user') || 'null', null);
    const uid = u?._id || u?.id || u?.userId || u?.userid || u?.user_id || u?.uid || null;
    const all = safeParse(localStorage.getItem('betHistory') || '[]', []);
    const list = Array.isArray(all) ? all : [];
    const onlyMine = uid ? list.filter((x) => x?.userId === uid) : list;
    return { userId: uid, bets: onlyMine };
  }, []);

  const flat = useMemo(() => {
    const out = [];
    for (const x of bets || []) {
      const rows = Array.isArray(x?.rows) ? x.rows : [];
      if (!rows.length) {
        out.push({ x, r: null, idx: 0 });
        continue;
      }
      rows.forEach((r, idx) => out.push({ x, r, idx }));
    }
    return out;
  }, [bets]);

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
  useEffect(() => {
    let alive = true;
    getRatesCurrent().then((result) => {
      if (!alive) return;
      if (result?.success && result?.data) setRatesMap(result.data);
    });
    return () => { alive = false; };
  }, []);

  const marketByName = useMemo(() => {
    const map = new Map();
    for (const m of markets || []) {
      map.set(normalizeMarketName(m?.marketName), m);
    }
    return map;
  }, [markets]);

  const marketOptions = useMemo(() => {
    const fromApi = (markets || [])
      .map((m) => (m?.marketName || '').toString().trim())
      .filter(Boolean);
    const fromHistory = (bets || [])
      .map((x) => (x?.marketTitle || '').toString().trim())
      .filter(Boolean);
    const uniq = Array.from(new Set([...fromApi, ...fromHistory]));
    uniq.sort((a, b) => a.localeCompare(b));
    return uniq.map((label) => ({ label, key: normalizeMarketName(label) }));
  }, [markets, bets]);

  const enriched = useMemo(() => {
    return flat.map(({ x, r, idx }) => {
      const points = Number(r?.points || 0) || 0;
      const session = (r?.type || x?.session || '').toString().trim().toUpperCase();
      const marketTitle = (x?.marketTitle || '').toString().trim() || 'MARKET';
      const m = marketByName.get(normalizeMarketName(marketTitle));
      const verdict = evaluateBet({
        market: m,
        betNumberRaw: r?.number,
        amount: points,
        session,
        ratesMap,
      });
      return { x, r, idx, points, session, marketTitle, verdict };
    });
  }, [flat, marketByName, ratesMap]);

  const filtered = useMemo(() => {
    return (enriched || []).filter((row) => {
      if (selectedSessions.length > 0 && !selectedSessions.includes(row.session)) return false;

      if (selectedMarkets.length > 0) {
        const k = normalizeMarketName(row.marketTitle);
        if (!selectedMarkets.includes(k)) return false;
      }

      if (selectedStatuses.length > 0) {
        const st =
          row.verdict.state === 'won' ? 'Win' : row.verdict.state === 'lost' ? 'Loose' : 'Pending';
        if (!selectedStatuses.includes(st)) return false;
      }
      return true;
    });
  }, [enriched, selectedMarkets, selectedSessions, selectedStatuses]);

  // Reset to page 1 when filters/data change
  useEffect(() => {
    setPage(1);
  }, [selectedSessions, selectedStatuses, selectedMarkets, enriched.length]);

  const PAGE_SIZE = 10;
  const totalPages = useMemo(() => {
    const n = Math.ceil((filtered?.length || 0) / PAGE_SIZE);
    return n > 0 ? n : 1;
  }, [filtered]);

  const currentPage = Math.min(Math.max(1, page), totalPages);
  const paged = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return (filtered || []).slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  // Draft state for modal
  const [draftSessions, setDraftSessions] = useState([]);
  const [draftStatuses, setDraftStatuses] = useState([]);
  const [draftMarkets, setDraftMarkets] = useState([]);

  useEffect(() => {
    if (!isFilterOpen) return;
    setDraftSessions(selectedSessions);
    setDraftStatuses(selectedStatuses);
    setDraftMarkets(selectedMarkets);
  }, [isFilterOpen, selectedMarkets, selectedSessions, selectedStatuses]);

  const toggleDraft = (arr, value, setArr) => {
    setArr((prev) => (prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]));
  };

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
            onClick={() => setIsFilterOpen(true)}
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
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#202124] p-6 text-center text-gray-300">
              {userId ? 'No bets found.' : 'Please login to see your bet history.'}
            </div>
          ) : paged.map(({ x, r, idx, points, session, marketTitle, verdict }) => {
            const betValue = r?.number != null ? renderBetNumber(r.number) : '-';
            const gameType = (x?.labelKey || 'Bet').toString();

            return (
            <div key={`${x.id}-${r?.id ?? idx}`} className="rounded-2xl overflow-hidden border border-white/10 bg-[#202124] shadow-[0_12px_24px_rgba(0,0,0,0.35)]">
              <div className="bg-[#0b2b55] px-4 py-3 text-center">
                <div className="text-white font-extrabold tracking-wide">
                  {marketTitle.toUpperCase()} {session ? `(${session})` : ''}
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

      {/* Filter modal (as per screenshot) */}
      {isFilterOpen ? (
        <div className="fixed inset-0 z-[999] flex items-center justify-center px-3 sm:px-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close filter"
            onClick={() => setIsFilterOpen(false)}
          />

          <div className="relative w-full max-w-md rounded-[28px] overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.65)] border border-white/10 bg-[#202124]">
            <div className="bg-black text-white text-center py-4 text-2xl font-extrabold border-b border-white/10">
              Filter Type
            </div>

            <div className="bg-[#202124] text-white">
              <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
                <div className="text-lg font-bold text-[#d4af37] mb-3">By Game Type</div>
                <div className="flex items-center justify-around gap-6 pb-4">
                  <label className="flex items-center gap-3 text-base sm:text-lg">
                    <input
                      type="checkbox"
                      className="w-6 h-6 accent-[#d4af37]"
                      checked={draftSessions.includes('OPEN')}
                      onChange={() => toggleDraft(draftSessions, 'OPEN', setDraftSessions)}
                    />
                    Open
                  </label>
                  <label className="flex items-center gap-3 text-base sm:text-lg">
                    <input
                      type="checkbox"
                      className="w-6 h-6 accent-[#d4af37]"
                      checked={draftSessions.includes('CLOSE')}
                      onChange={() => toggleDraft(draftSessions, 'CLOSE', setDraftSessions)}
                    />
                    Close
                  </label>
                </div>

                <div className="h-px bg-white/10 my-3" />

                <div className="text-lg font-bold text-[#d4af37] mb-3">By Winning Status</div>
                <div className="flex items-center justify-around gap-3 pb-4">
                  {['Win', 'Loose', 'Pending'].map((s) => (
                    <label key={s} className="flex items-center gap-3 text-base sm:text-lg">
                      <input
                        type="checkbox"
                        className="w-6 h-6 accent-[#d4af37]"
                        checked={draftStatuses.includes(s)}
                        onChange={() => toggleDraft(draftStatuses, s, setDraftStatuses)}
                      />
                      {s}
                    </label>
                  ))}
                </div>

                <div className="h-px bg-white/10 my-3" />

                <div className="text-lg font-bold text-[#d4af37] mb-3">By Games</div>
                <div className="space-y-3 pb-2">
                  {marketOptions.map((name) => (
                    <label
                      key={name.key}
                      className="flex items-center gap-4 bg-black/25 rounded-xl border border-white/10 shadow-sm px-4 py-4 hover:border-[#d4af37]/40 transition-colors"
                    >
                      <input
                        type="checkbox"
                        className="w-6 h-6 accent-[#d4af37]"
                        checked={draftMarkets.includes(name.key)}
                        onChange={() => toggleDraft(draftMarkets, name.key, setDraftMarkets)}
                      />
                      <span className="text-sm sm:text-base font-semibold tracking-wide text-white">
                        {name.label.toUpperCase()}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="px-5 pb-5 pt-3">
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setIsFilterOpen(false)}
                    className="rounded-full bg-black border border-white/10 text-white font-bold py-4 text-base sm:text-lg shadow-md active:scale-[0.99] hover:border-[#d4af37]/40 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSessions(draftSessions);
                      setSelectedStatuses(draftStatuses);
                      setSelectedMarkets(draftMarkets);
                      setIsFilterOpen(false);
                    }}
                    className="rounded-full bg-gradient-to-r from-[#d4af37] to-[#cca84d] text-[#4b3608] font-extrabold py-4 text-base sm:text-lg shadow-md active:scale-[0.99] hover:from-[#e5c04a] hover:to-[#d4af37] transition-colors"
                  >
                    Filter
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Bottom pagination (UI only) */}
      {filtered.length > PAGE_SIZE ? (
        <div className="fixed left-0 right-0 bottom-[88px] z-20 px-3 sm:px-4">
          <div className="w-full max-w-3xl mx-auto bg-white rounded-xl shadow-[0_16px_30px_rgba(0,0,0,0.35)] overflow-hidden">
            <div className="grid grid-cols-3 items-center">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="py-3 text-gray-700 font-semibold border-r border-gray-200 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ‹ PREV
              </button>
              <div className="flex items-center justify-center py-2.5">
                <div className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center font-bold text-sm">
                  {currentPage}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="py-3 text-gray-700 font-semibold border-l border-gray-200 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                NEXT ›
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default BetHistory;

