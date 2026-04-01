import React, { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, fetchWithAuth, getAuthHeaders } from '../config/api';
import { getRatesCurrent } from '../api/bets';
import { useRefreshOnMarketReset } from '../hooks/useRefreshOnMarketReset';
import BetHistoryCard from '../components/BetHistoryCard';

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
    const time = d
      .toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
      .replace(/\s/g, ' ')
      .toLowerCase();
    return `${date} ${time}`;
  } catch {
    return '-';
  }
};

const shortGameLabel = (label) => {
  const s = String(label || '').trim();
  if (!s) return 'Bet';
  if (s === 'Single Digit') return 'Digit';
  return s;
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

const BET_TYPE_LABELS = {
  single: 'Single Digit',
  jodi: 'Jodi',
  panna: 'Panna',
  'sp-motor': 'SP Motor',
  'dp-motor': 'DP Motor',
  'half-sangam': 'Half Sangam',
  'full-sangam': 'Full Sangam',
  'odd-even': 'Odd Even',
  'sp-common': 'SP Common',
  'dp-common': 'DP Common',
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
          : kind === 'half-sangam-open'
            ? !!(opening && openDigit)
            : kind === 'half-sangam-close' || kind === 'full-sangam'
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
    // Half Sangam (O) in this app is Open Pana + Open Ank (derived from Open Pana),
    // so it can be decided as soon as OPEN result is declared.
    won = betNumber === `${opening}-${openDigit}`;
  } else if (kind === 'half-sangam-close') {
    won = betNumber === `${openDigit}-${closing}`;
  }

  if (!won) return { state: 'lost', kind, payout: 0 };

  const mul = getPayoutMultiplier(kind, betNumber, ratesMap);
  const payout = mul > 0 ? (Number(amount) || 0) * mul : 0;
  return { state: 'won', kind, payout };
};

const BetHistory = ({ pageTitle = 'Bet History', marketScope = null } = {}) => {
  const navigate = useNavigate();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState([]); // ['OPEN','CLOSE']
  const [selectedStatuses, setSelectedStatuses] = useState([]); // ['Win','Lost','Pending']
  const [selectedMarkets, setSelectedMarkets] = useState([]); // normalized market keys
  const [markets, setMarkets] = useState([]);
  const [ratesMap, setRatesMap] = useState(null);
  const [myBets, setMyBets] = useState([]);

  // Scope behavior:
  // - default (null/empty): MAIN markets only (exclude starline/startline)
  // - "starline"/"startline": only starline/startline markets
  const scopeRaw = (marketScope || '').toString().trim().toLowerCase();
  const scope = scopeRaw || 'main';
  const isStarlineMarketName = (marketTitle) => {
    const k = normalizeMarketName(marketTitle);
    return k.includes('starline') || k.includes('startline') || k.includes('star line') || k.includes('start line');
  };
  const inScope = (marketTitle) => {
    if (scope === 'starline' || scope === 'startline') return isStarlineMarketName(marketTitle);
    if (scope === 'main') return !isStarlineMarketName(marketTitle);
    return true;
  };

  const userId = useMemo(() => {
    const u = safeParse(localStorage.getItem('user') || 'null', null);
    return u?._id || u?.id || u?.userId || u?.userid || u?.user_id || u?.uid || null;
  }, []);

  const fetchMarketsOnce = useCallback(async (background = false) => {
    try {
      const res = await fetch(`${API_BASE_URL}/markets/get-markets`);
      const data = await res.json();
      const apply = () => {
        if (data?.success && Array.isArray(data?.data)) setMarkets(data.data);
      };
      if (background) startTransition(apply);
      else apply();
    } catch {
      // ignore
    }
  }, []);

  const fetchMyBetsOnce = useCallback(async (background = false) => {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/bets/my-history`, { headers: getAuthHeaders() });
      if (res.status === 401) return;
      const data = await res.json();
      const apply = () => {
        if (data?.success && Array.isArray(data?.data)) setMyBets(data.data);
        else setMyBets([]);
      };
      if (background) startTransition(apply);
      else apply();
    } catch {
      const apply = () => setMyBets([]);
      if (background) startTransition(apply);
      else apply();
    }
  }, []);

  const refreshBetHistoryData = useCallback(async (background = false) => {
    await fetchMarketsOnce(background);
    await fetchMyBetsOnce(background);
  }, [fetchMarketsOnce, fetchMyBetsOnce]);

  useEffect(() => {
    void refreshBetHistoryData(false);
    const id = setInterval(() => {
      void refreshBetHistoryData(true);
    }, 15000);
    return () => clearInterval(id);
  }, [refreshBetHistoryData]);

  const bets = useMemo(() => {
    return (myBets || [])
      .map((b, idx) => {
        const session = String(b?.betOn || '').trim().toUpperCase();
        const marketTitle = (b?.marketId?.marketName || '').toString().trim() || 'MARKET';
        const typeKey = String(b?.betType || '').toLowerCase();
        const settledState =
          b?.status === 'won' ? 'won' : b?.status === 'lost' ? 'lost' : '';
        const pop = b?.marketId && typeof b.marketId === 'object' ? b.marketId : null;
        const marketFromBet = pop
          ? {
              openingNumber: pop.openingNumber,
              closingNumber: pop.closingNumber,
            }
          : null;
        return {
          id: b?._id || `${marketTitle}-${b?.createdAt || ''}-i${idx}`,
          marketTitle,
          createdAt: b?.createdAt,
          session,
          marketFromBet,
          labelKey: BET_TYPE_LABELS[typeKey] || String(b?.betType || 'Bet'),
          rows: [
            {
              id: b?._id || `${marketTitle}-${b?.createdAt || ''}`,
              number: b?.betNumber,
              points: Number(b?.amount) || 0,
              type: session,
              settledState,
              settledPayout: Number(b?.payout) || 0,
            },
          ],
        };
      })
      .filter((x) => inScope(x?.marketTitle));
  }, [myBets, scope]);

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

  useRefreshOnMarketReset(() => {
    void refreshBetHistoryData(true);
  });
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
    const uniq = Array.from(new Set([...fromApi, ...fromHistory])).filter((name) => inScope(name));
    uniq.sort((a, b) => a.localeCompare(b));
    return uniq.map((label) => ({ label, key: normalizeMarketName(label) }));
  }, [markets, bets]);

  const enriched = useMemo(() => {
    return flat.map(({ x, r, idx }) => {
      const points = Number(r?.points || 0) || 0;
      const session = (r?.type || x?.session || '').toString().trim().toUpperCase();
      const marketTitle = (x?.marketTitle || '').toString().trim() || 'MARKET';
      const key = normalizeMarketName(marketTitle);
      const fromList = marketByName.get(key);
      const fromBet = x?.marketFromBet;
      const mergedMarket = {
        openingNumber: fromList?.openingNumber ?? fromBet?.openingNumber,
        closingNumber: fromList?.closingNumber ?? fromBet?.closingNumber,
      };
      const computed = evaluateBet({
        market: mergedMarket,
        betNumberRaw: r?.number,
        amount: points,
        session,
        ratesMap,
      });

      const storedState = (r?.settledState || '').toString();
      const storedPayout = Number(r?.settledPayout || 0) || 0;
      const finalVerdict =
        storedState === 'won' || storedState === 'lost'
          ? { ...computed, state: storedState, payout: storedPayout }
          : computed;

      return { x, r, idx, points, session, marketTitle, computedVerdict: computed, verdict: finalVerdict };
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
          row.verdict.state === 'won' ? 'Win' : row.verdict.state === 'lost' ? 'Lost' : 'Pending';
        if (!selectedStatuses.includes(st)) return false;
      }
      return true;
    });
  }, [enriched, selectedMarkets, selectedSessions, selectedStatuses]);

  /** All (no status filter): newest first by time only. Win/Lost/Pending filters: Win block on top, then Lost, Pending; then by time. */
  const winSortRank = (state) => (state === 'won' ? 0 : state === 'lost' ? 1 : 2);

  const sortedFiltered = useMemo(() => {
    const byTime = (a, b) => {
      const ta = new Date(a.x?.createdAt || 0).getTime();
      const tb = new Date(b.x?.createdAt || 0).getTime();
      return tb - ta;
    };
    const list = [...filtered];
    if (selectedStatuses.length === 0) {
      return list.sort(byTime);
    }
    return list.sort((a, b) => {
      const d = winSortRank(a.verdict.state) - winSortRank(b.verdict.state);
      if (d !== 0) return d;
      return byTime(a, b);
    });
  }, [filtered, selectedStatuses]);

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
    <div className="min-h-screen bg-white text-gray-800 px-3 sm:px-4 pt-3 pb-[calc(7rem+env(safe-area-inset-bottom,0px))]">
      <div className="w-full max-w-7xl mx-auto">
        {/* Header row */}
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="w-10 h-10 rounded-full bg-gray-100 border border-gray-300 flex items-center justify-center text-gray-700 hover:bg-gray-200 active:scale-95 transition"
                aria-label="Back"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-xl sm:text-2xl font-bold truncate text-[#1B3150]">{pageTitle}</h1>
            </div>

            <button
              type="button"
              onClick={() => setIsFilterOpen(true)}
              className="shrink-0 flex items-center gap-2 rounded-lg border-2 border-[#1B3150] px-3 py-2 text-[#1B3150] hover:bg-[#1B3150]/5 transition-colors"
              aria-label="More filters"
              title="Open / Close, markets, Pending"
            >
              <span className="text-sm font-semibold">Filter By</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18l-7 8v6l-4 2v-8L3 4z" />
              </svg>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 mr-1">Result</span>
            {[
              { key: 'all', label: 'All', statuses: [] },
              { key: 'win', label: 'Win', statuses: ['Win'] },
              { key: 'lost', label: 'Lost', statuses: ['Lost'] },
            ].map(({ key, label, statuses }) => {
              const isAll = key === 'all';
              const active = isAll
                ? selectedStatuses.length === 0
                : selectedStatuses.length === 1 && selectedStatuses[0] === statuses[0];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedStatuses(statuses)}
                  className={`min-h-[40px] px-4 rounded-xl text-sm font-bold border-2 transition-colors ${
                    active
                      ? 'bg-[#1B3150] border-[#1B3150] text-white shadow-sm'
                      : 'bg-white border-gray-300 text-[#1B3150] hover:border-[#1B3150]/40 hover:bg-gray-50'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
          {sortedFiltered.length === 0 ? (
            <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-6 text-center text-gray-600 col-span-2 lg:col-span-3 xl:col-span-4">
              {userId ? 'No bets found.' : 'Please login to see your bet history.'}
            </div>
          ) : (
            sortedFiltered.map(({ x, r, idx, points, session, marketTitle, verdict }, i) => {
              const betValue = r?.number != null ? renderBetNumber(r.number) : '-';
              const statusLabel =
                verdict.state === 'won' ? 'Win' : verdict.state === 'lost' ? 'Lost' : 'Pending';
              const betId = r?.id ?? x.id;

              return (
                <BetHistoryCard
                  key={`${x.id}-${r?.id ?? idx}`}
                  index={i + 1}
                  betId={betId}
                  session={session}
                  marketTitle={marketTitle.toUpperCase()}
                  gameLabel={shortGameLabel(x?.labelKey)}
                  betValue={betValue}
                  betAmount={points}
                  winPayout={verdict.payout}
                  statusLabel={statusLabel}
                  timeFormatted={formatTxnTime(x?.createdAt)}
                />
              );
            })
          )}
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

          <div className="relative w-full max-w-md rounded-[28px] overflow-hidden shadow-xl border-2 border-gray-300 bg-white">
            <div className="bg-[#1B3150] text-white text-center py-4 text-2xl font-extrabold border-b border-gray-300">
              Filter Type
            </div>

            <div className="bg-white text-gray-800">
              <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
                <div className="text-lg font-bold text-[#1B3150] mb-3">By Game Type</div>
                <div className="flex items-center justify-around gap-6 pb-4">
                  <label className="flex items-center gap-3 text-base sm:text-lg text-gray-700">
                    <input
                      type="checkbox"
                      className="w-6 h-6 accent-[#1B3150]"
                      checked={draftSessions.includes('OPEN')}
                      onChange={() => toggleDraft(draftSessions, 'OPEN', setDraftSessions)}
                    />
                    Open
                  </label>
                  <label className="flex items-center gap-3 text-base sm:text-lg text-gray-700">
                    <input
                      type="checkbox"
                      className="w-6 h-6 accent-[#1B3150]"
                      checked={draftSessions.includes('CLOSE')}
                      onChange={() => toggleDraft(draftSessions, 'CLOSE', setDraftSessions)}
                    />
                    Close
                  </label>
                </div>

                <div className="h-px bg-gray-300 my-3" />

                <div className="text-lg font-bold text-[#1B3150] mb-3">By Winning Status</div>
                <div className="flex items-center justify-around gap-3 pb-4">
                  {['Win', 'Lost', 'Pending'].map((s) => (
                    <label key={s} className="flex items-center gap-3 text-base sm:text-lg text-gray-700">
                      <input
                        type="checkbox"
                        className="w-6 h-6 accent-[#1B3150]"
                        checked={draftStatuses.includes(s)}
                        onChange={() => toggleDraft(draftStatuses, s, setDraftStatuses)}
                      />
                      {s}
                    </label>
                  ))}
                </div>

                <div className="h-px bg-gray-300 my-3" />

                <div className="text-lg font-bold text-[#1B3150] mb-3">By Games</div>
                <div className="space-y-3 pb-2">
                  {marketOptions.map((name) => (
                    <label
                      key={name.key}
                      className="flex items-center gap-4 bg-gray-50 rounded-xl border-2 border-gray-300 shadow-sm px-4 py-4 hover:border-gray-400 transition-colors"
                    >
                      <input
                        type="checkbox"
                        className="w-6 h-6 accent-[#1B3150]"
                        checked={draftMarkets.includes(name.key)}
                        onChange={() => toggleDraft(draftMarkets, name.key, setDraftMarkets)}
                      />
                      <span className="text-sm sm:text-base font-semibold tracking-wide text-gray-800">
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
                    className="rounded-full bg-gray-100 border-2 border-gray-300 text-gray-700 font-bold py-4 text-base sm:text-lg shadow-md active:scale-[0.99] hover:border-gray-400 hover:bg-gray-200 transition-colors"
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
                    className="rounded-full bg-gradient-to-r bg-[#1B3150] text-white font-extrabold py-4 text-base sm:text-lg shadow-md active:scale-[0.99] hover:bg-[#152842] transition-colors"
                  >
                    Filter
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default BetHistory;

