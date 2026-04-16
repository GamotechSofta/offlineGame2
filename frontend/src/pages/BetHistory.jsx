import React, { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { API_BASE_URL, fetchWithAuth, getAuthHeaders } from '../config/api';
import { getMyWalletTransactions, getRatesCurrent } from '../api/bets';
import { useRefreshOnMarketReset } from '../hooks/useRefreshOnMarketReset';
import BetHistoryCard from '../components/BetHistoryCard';
import AviatorBetHistoryCard from '../components/AviatorBetHistoryCard';
import FunTimerBetHistoryCard from '../components/FunTimerBetHistoryCard';

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
const isGameHistoryMarketName = (marketTitle) => {
  const k = normalizeMarketName(marketTitle);
  return k.includes('aviator') || k.includes('funtimer') || k.includes('fun timer') || k.includes('roulette');
};
const detectGameName = (text) => {
  const s = normalizeMarketName(text);
  if (s.includes('aviator')) return 'Aviator';
  if (s.includes('funtimer') || s.includes('fun timer')) return 'FunTimer';
  if (s.includes('roulette')) return 'Roulette';
  return '';
};
const parseRoundId = (text) => {
  const s = String(text || '');
  const m = s.match(/roundId=([^|]+)/i);
  return m && m[1] ? String(m[1]).trim() : '';
};

const parseGameBetNumber = (txn) => {
  const directCandidates = [
    txn?.betNumber,
    txn?.selectedNumber,
    txn?.betNo,
    txn?.bet_no,
    txn?.number,
    txn?.selection,
    txn?.selectedNo,
    txn?.bet?.betNumber,
    txn?.bet?.selectedNumber,
    txn?.bet?.betNo,
    txn?.bet?.bet_no,
    txn?.bet?.number,
    txn?.bet?.selection,
    txn?.bet?.selectedNo,
  ];

  for (const candidate of directCandidates) {
    const value = String(candidate ?? '').trim();
    if (value) return value;
  }

  const source = [txn?.description, txn?.bet?.description, txn?.bet?.marketName].filter(Boolean).join(' | ');
  const patterns = [
    /(?:bet(?:\s*no|\s*number)?|number|selectedNumber|selection|selected\s*no|bet_on|bet no)\s*[:=-]\s*([a-z0-9_-]+)/i,
    /\b(?:on|num(?:ber)?|bet)\s+([a-z0-9_-]+)/i,
    /([a-z0-9_-]+)\s*(?:number|no)\b/i,
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) return String(match[1]).trim();
  }

  return '';
};

const detectTransactionGameName = (txn) =>
  detectGameName(txn?.description || '') ||
  detectGameName(txn?.bet?.marketName || '') ||
  detectGameName(txn?.marketName || '') ||
  detectGameName(txn?.gameName || '');

const buildGameRoundRows = (transactions, gameName) => {
  const debitRows = [];
  const knownRoundIds = new Set();
  const byRef = new Map(); // referenceId -> row index
  const byRound = new Map(); // roundId -> row indices[]

  // Build one row per debit transaction (do not merge same round bets).
  for (const t of transactions || []) {
    const desc = String(t?.description || '');
    const g = detectGameName(desc) || detectGameName(t?.bet?.marketName || '');
    const type = String(t?.type || '').toLowerCase();
    if (type !== 'debit' || g !== gameName) continue;

    const roundId = parseRoundId(desc);
    const refId = String(t?.referenceId || '').trim();
    const key = refId || String(t?._id || '').trim();
    if (!key) continue;
    if (roundId) knownRoundIds.add(roundId);

    const row = {
      key,
      betId: key,
      roundId: roundId || '',
      refId: refId || '',
      betAmount: Number(t?.amount || 0) || 0,
      cashOutAmount: null,
      createdAt: t?.createdAt || null,
      gameName,
      betNumber: parseGameBetNumber(t),
    };
    const idx = debitRows.push(row) - 1;
    if (refId) byRef.set(refId, idx);
    if (roundId) {
      const arr = byRound.get(roundId) || [];
      arr.push(idx);
      byRound.set(roundId, arr);
    }
  }

  // Attach credit to matching debit: prefer referenceId, else first unmatched in same round.
  for (const t of transactions || []) {
    const type = String(t?.type || '').toLowerCase();
    if (type !== 'credit') continue;
    const desc = String(t?.description || '');
    const creditRoundId = parseRoundId(desc);
    const creditRef = String(t?.referenceId || '').trim();
    const directGame = detectTransactionGameName(t);

    // Only attach credits that explicitly belong to this game, or that match
    // an existing debit reference / known round for this game. Generic game
    // credits may only contain roundId, so allow that path as well.
    if (directGame && directGame !== gameName) continue;
    if (!directGame && !creditRef && !(creditRoundId && knownRoundIds.has(creditRoundId))) continue;

    let matchIndex = -1;
    if (creditRef && byRef.has(creditRef)) {
      matchIndex = byRef.get(creditRef);
    } else if (creditRoundId && knownRoundIds.has(creditRoundId) && byRound.has(creditRoundId)) {
      const candidates = byRound.get(creditRoundId) || [];
      // Prefer a row that still has no cashout.
      matchIndex = candidates.find((i) => debitRows[i] && debitRows[i].cashOutAmount == null) ?? candidates[0] ?? -1;
    }
    if (matchIndex < 0 || !debitRows[matchIndex]) continue;

    const amount = Number(t?.amount || 0) || 0;
    if (amount > 0) debitRows[matchIndex].cashOutAmount = amount;
    if (!debitRows[matchIndex].createdAt || new Date(t?.createdAt || 0).getTime() > new Date(debitRows[matchIndex].createdAt || 0).getTime()) {
      debitRows[matchIndex].createdAt = t?.createdAt || debitRows[matchIndex].createdAt;
    }
  }

  return debitRows
    .filter((x) => Number.isFinite(Number(x.betAmount)))
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .map((x, i) => ({
      ...x,
      index: i + 1,
      timeFormatted: formatTxnTime(x.createdAt),
    }));
};

const aggregateGameRoundRows = (rows) => {
  const grouped = new Map();

  for (const row of rows || []) {
    const groupKey = String(row?.roundId || row?.betId || row?.key || '').trim();
    if (!groupKey) continue;

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        ...row,
        key: groupKey,
        betId: row?.roundId || row?.betId || groupKey,
        betAmount: Number(row?.betAmount || 0) || 0,
        cashOutAmount: Number(row?.cashOutAmount || 0) || 0,
      });
      continue;
    }

    const current = grouped.get(groupKey);
    current.betAmount += Number(row?.betAmount || 0) || 0;
    current.cashOutAmount += Number(row?.cashOutAmount || 0) || 0;

    const currentTime = new Date(current.createdAt || 0).getTime();
    const nextTime = new Date(row?.createdAt || 0).getTime();
    if (nextTime > currentTime) {
      current.createdAt = row?.createdAt || current.createdAt;
      current.timeFormatted = row?.timeFormatted || current.timeFormatted;
    }
  }

  return Array.from(grouped.values())
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .map((row, index) => ({
      ...row,
      index: index + 1,
      timeFormatted: formatTxnTime(row.createdAt),
    }));
};

const buildAggregatedGameRoundRows = (transactions, gameName) => {
  const grouped = new Map();
  const knownRoundIds = new Set();

  const ensureRow = (groupKey, txn, fallbackGameName = gameName) => {
    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        key: groupKey,
        betId: groupKey,
        roundId: groupKey,
        refId: String(txn?.referenceId || '').trim(),
        betAmount: 0,
        cashOutAmount: 0,
        createdAt: txn?.createdAt || null,
        gameName: fallbackGameName,
        betNumber: parseGameBetNumber(txn),
      });
    }
    return grouped.get(groupKey);
  };

  const allTransactions = Array.isArray(transactions) ? transactions : [];

  // Pass 1: register all debit rounds for this game.
  for (const txn of allTransactions) {
    const type = String(txn?.type || '').toLowerCase();
    if (type !== 'debit') continue;

    const desc = String(txn?.description || '');
    const detectedGame = detectTransactionGameName(txn);
    if (detectedGame !== gameName) continue;

    const roundId = parseRoundId(desc);
    const groupKey = String(roundId || txn?.referenceId || txn?._id || '').trim();
    if (!groupKey) continue;

    knownRoundIds.add(groupKey);
    const row = ensureRow(groupKey, txn, gameName);
    row.betAmount += Number(txn?.amount || 0) || 0;
    if (!row.betNumber) row.betNumber = parseGameBetNumber(txn);
    if (!row.createdAt || new Date(txn?.createdAt || 0).getTime() > new Date(row.createdAt || 0).getTime()) {
      row.createdAt = txn?.createdAt || row.createdAt;
    }
  }

  // Pass 2: attach all matching credits to the already-known rounds.
  for (const txn of allTransactions) {
    const type = String(txn?.type || '').toLowerCase();
    if (type !== 'credit') continue;

    const desc = String(txn?.description || '');
    const detectedGame = detectTransactionGameName(txn);
    const roundId = parseRoundId(desc);
    const groupKey = String(roundId || txn?.referenceId || txn?._id || '').trim();
    if (!groupKey) continue;

    const belongsToGame = detectedGame === gameName || (!detectedGame && knownRoundIds.has(groupKey));
    if (!belongsToGame || !knownRoundIds.has(groupKey)) continue;

    const row = ensureRow(groupKey, txn, gameName);
    row.cashOutAmount += Number(txn?.amount || 0) || 0;
    if (!row.createdAt || new Date(txn?.createdAt || 0).getTime() > new Date(row.createdAt || 0).getTime()) {
      row.createdAt = txn?.createdAt || row.createdAt;
    }
  }

  return Array.from(grouped.values())
    .filter((row) => Number(row.betAmount || 0) > 0)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .map((row, index) => ({
      ...row,
      index: index + 1,
      timeFormatted: formatTxnTime(row.createdAt),
    }));
};
const normalizeGameQueryToTab = (raw) => {
  const q = normalizeMarketName(raw);
  if (q === 'aviator') return 'Aviator';
  if (q === 'funtimer' || q === 'fun-timer' || q === 'fun timer') return 'FunTimer';
  if (q === 'roulette') return 'Roulette';
  return null;
};

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
  't-motor': 'T Motor',
  'half-sangam': 'Half Sangam',
  'full-sangam': 'Full Sangam',
  'odd-even': 'Odd Even',
  'sp-common': 'SP Common',
  'cp-common': 'CP (Common Pana)',
  'dp-common': 'DP Common',
  chart: 'Chart Game',
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
  const location = useLocation();
  const qp = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const queryScope = (qp.get('scope') || '').toString().trim().toLowerCase();
  const queryTitle = (qp.get('title') || '').toString().trim();
  const queryGame = (qp.get('game') || '').toString().trim();
  const isGameTitle = normalizeMarketName(queryTitle) === 'game bet history';
  const isGameScope = queryScope === 'games' || queryScope === 'game' || isGameTitle;
  const selectedGameFromQuery = normalizeGameQueryToTab(queryGame);
  const isGameDetailPage = isGameScope && !!selectedGameFromQuery;
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState([]); // ['OPEN','CLOSE']
  const [selectedStatuses, setSelectedStatuses] = useState([]); // ['Win','Lost','Pending']
  const [gameStatusFilter, setGameStatusFilter] = useState('all'); // all | won | lost
  const [selectedMarkets, setSelectedMarkets] = useState([]); // normalized market keys
  const [markets, setMarkets] = useState([]);
  const [ratesMap, setRatesMap] = useState(null);
  const [myBets, setMyBets] = useState([]);
  const [gameTransactions, setGameTransactions] = useState([]);

  // Scope behavior:
  // - default (null/empty): MAIN markets only (exclude starline/startline)
  // - "starline"/"startline": only starline/startline markets
  const effectivePageTitle = queryTitle || pageTitle;
  const scopeRaw = (marketScope || queryScope || '').toString().trim().toLowerCase();
  const scope = scopeRaw || 'main';
  const isStarlineMarketName = (marketTitle) => {
    const k = normalizeMarketName(marketTitle);
    return k.includes('starline') || k.includes('startline') || k.includes('star line') || k.includes('start line');
  };
  const inScope = (marketTitle) => {
    if (scope === 'starline' || scope === 'startline') return isStarlineMarketName(marketTitle);
    if (scope === 'games' || scope === 'game') return isGameHistoryMarketName(marketTitle);
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

  const fetchGameTransactionsOnce = useCallback(async (background = false) => {
    try {
      const result = await getMyWalletTransactions(500);
      const rows = result?.success && Array.isArray(result?.data) ? result.data : [];
      const apply = () => setGameTransactions(rows);
      if (background) startTransition(apply);
      else apply();
    } catch {
      const apply = () => setGameTransactions([]);
      if (background) startTransition(apply);
      else apply();
    }
  }, []);

  const refreshBetHistoryData = useCallback(async (background = false) => {
    await fetchMarketsOnce(background);
    if (isGameScope) {
      await fetchGameTransactionsOnce(background);
    } else {
      await fetchMyBetsOnce(background);
    }
  }, [fetchMarketsOnce, fetchGameTransactionsOnce, fetchMyBetsOnce, isGameScope]);

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

  const gameRows = useMemo(() => {
    if (!(scope === 'games' || scope === 'game')) return [];
    return (gameTransactions || [])
      .map((t, idx) => {
        const gameFromDesc = detectGameName(t?.description || '');
        const gameFromBet = detectGameName(t?.bet?.marketName || '');
        const gameName = gameFromDesc || gameFromBet;
        if (!gameName) return null;
        const amount = Number(t?.amount || 0) || 0;
        const isCredit = String(t?.type || '').toLowerCase() === 'credit';
        const statusLabel = isCredit ? 'Win' : 'Pending';
        return {
          key: t?._id || `${gameName}-${t?.createdAt || ''}-${idx}`,
          marketTitle: gameName,
          marketKey: normalizeMarketName(gameName),
          createdAt: t?.createdAt,
          timeFormatted: formatTxnTime(t?.createdAt),
          session: 'GAME',
          gameLabel: gameName,
          betValue: (t?.referenceId || '').toString().slice(-8) || '-',
          betAmount: amount,
          winPayout: isCredit ? amount : 0,
          statusLabel,
        };
      })
      .filter(Boolean);
  }, [gameTransactions, scope]);

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
    if (isGameScope) {
      const uniq = Array.from(new Set((gameRows || []).map((x) => x.marketTitle).filter(Boolean)));
      uniq.sort((a, b) => a.localeCompare(b));
      return uniq.map((label) => ({ label, key: normalizeMarketName(label) }));
    }
    const fromApi = (markets || [])
      .map((m) => (m?.marketName || '').toString().trim())
      .filter(Boolean);
    const fromHistory = (bets || [])
      .map((x) => (x?.marketTitle || '').toString().trim())
      .filter(Boolean);
    const uniq = Array.from(new Set([...fromApi, ...fromHistory])).filter((name) => inScope(name));
    uniq.sort((a, b) => a.localeCompare(b));
    return uniq.map((label) => ({ label, key: normalizeMarketName(label) }));
  }, [markets, bets, gameRows, isGameScope]);

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

  const filteredGameRows = useMemo(() => {
    if (!(scope === 'games' || scope === 'game')) return [];
    return (gameRows || [])
      .filter((row) => {
        if (selectedMarkets.length > 0 && !selectedMarkets.includes(row.marketKey)) return false;
        if (selectedStatuses.length > 0 && !selectedStatuses.includes(row.statusLabel)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [gameRows, scope, selectedMarkets, selectedStatuses]);

  const aviatorRoundRows = useMemo(() => {
    if (!isGameDetailPage || selectedGameFromQuery !== 'Aviator') return [];
    return buildGameRoundRows(gameTransactions, 'Aviator');
  }, [gameTransactions, isGameDetailPage, selectedGameFromQuery]);
  const funTimerRoundRows = useMemo(() => {
    if (!isGameDetailPage || selectedGameFromQuery !== 'FunTimer') return [];
    return buildAggregatedGameRoundRows(gameTransactions, 'FunTimer');
  }, [gameTransactions, isGameDetailPage, selectedGameFromQuery]);
  const rouletteRoundRows = useMemo(() => {
    if (!isGameDetailPage || selectedGameFromQuery !== 'Roulette') return [];
    return buildGameRoundRows(gameTransactions, 'Roulette');
  }, [gameTransactions, isGameDetailPage, selectedGameFromQuery]);

  const filteredAviatorRoundRows = useMemo(() => {
    if (selectedGameFromQuery === 'Aviator' && gameStatusFilter === 'won') {
      return aviatorRoundRows.filter((x) => Number(x.betAmount || 0) < Number(x.cashOutAmount || 0));
    }
    if (selectedGameFromQuery === 'Aviator' && gameStatusFilter === 'lost') {
      return aviatorRoundRows.filter((x) => Number(x.betAmount || 0) > Number(x.cashOutAmount || 0));
    }
    return aviatorRoundRows;
  }, [aviatorRoundRows, gameStatusFilter, selectedGameFromQuery]);
  const filteredFunTimerRoundRows = useMemo(() => {
    if (selectedGameFromQuery === 'FunTimer' && gameStatusFilter === 'won') {
      return funTimerRoundRows.filter((x) => Number(x.cashOutAmount || 0) > Number(x.betAmount || 0));
    }
    if (selectedGameFromQuery === 'FunTimer' && gameStatusFilter === 'lost') {
      return funTimerRoundRows.filter((x) => Number(x.cashOutAmount || 0) <= Number(x.betAmount || 0));
    }
    return funTimerRoundRows;
  }, [funTimerRoundRows, gameStatusFilter, selectedGameFromQuery]);
  const filteredRouletteRoundRows = useMemo(() => {
    if (selectedGameFromQuery === 'Roulette' && gameStatusFilter === 'won') {
      return rouletteRoundRows.filter((x) => Number(x.betAmount || 0) < Number(x.cashOutAmount || 0));
    }
    if (selectedGameFromQuery === 'Roulette' && gameStatusFilter === 'lost') {
      return rouletteRoundRows.filter((x) => Number(x.betAmount || 0) > Number(x.cashOutAmount || 0));
    }
    return rouletteRoundRows;
  }, [rouletteRoundRows, gameStatusFilter, selectedGameFromQuery]);

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
              <h1 className="text-xl sm:text-2xl font-bold truncate text-[#1B3150]">{effectivePageTitle}</h1>
            </div>

            {!isGameScope && (
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
            )}
          </div>

          {!isGameScope && (
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
          )}
        </div>

        <div className={isGameScope ? 'space-y-4' : 'grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3 md:gap-4'}>
          {isGameScope ? (
            !isGameDetailPage ? (
              <div className="space-y-3">
                {[
                  { title: 'Aviator Bet History', key: 'Aviator', color: '#38bdf8', subtitle: 'You can view Aviator bet history' },
                  { title: 'FunTimer Bet History', key: 'FunTimer', color: '#22c55e', subtitle: 'You can view FunTimer bet history' },
                  { title: 'Roulette Bet History', key: 'Roulette', color: '#f97316', subtitle: 'You can view Roulette bet history' },
                ].map((card) => (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() =>
                      navigate(
                        `/bet-history?scope=games&game=${encodeURIComponent(card.key.toLowerCase())}&title=${encodeURIComponent(card.title)}`
                      )
                    }
                    className="w-full rounded-2xl p-4 flex items-center justify-between border border-gray-200 bg-white shadow-md transition-colors hover:border-[#1B3150]"
                  >
                    <span className="flex items-center gap-4">
                      <span
                        className="w-14 h-14 rounded-full flex items-center justify-center text-black shadow-[0_10px_20px_rgba(0,0,0,0.35)]"
                        style={{ backgroundColor: card.color }}
                        aria-hidden
                      >
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                          <circle cx="12" cy="12" r="8" />
                        </svg>
                      </span>
                      <span className="text-left">
                        <span className="block text-lg font-semibold text-gray-900">{card.title}</span>
                        <span className="block text-sm text-gray-600">{card.subtitle}</span>
                      </span>
                    </span>
                    <span className="w-9 h-9 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <>
                {selectedGameFromQuery === 'Aviator' && (
                  <section className="p-0">
                    <h3 className="text-base sm:text-lg font-bold text-[#1B3150] mb-3">Aviator Bet History</h3>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 mr-1">Result</span>
                      {[
                        { key: 'all', label: 'All' },
                        { key: 'won', label: 'Win' },
                        { key: 'lost', label: 'Lost' },
                      ].map((f) => {
                        const active = gameStatusFilter === f.key;
                        return (
                          <button
                            key={f.key}
                            type="button"
                            onClick={() => setGameStatusFilter(f.key)}
                            className={`min-h-[38px] px-4 rounded-xl text-sm font-bold border-2 transition-colors ${
                              active
                                ? 'bg-[#1B3150] border-[#1B3150] text-white shadow-sm'
                                : 'bg-white border-gray-300 text-[#1B3150] hover:border-[#1B3150]/40 hover:bg-gray-50'
                            }`}
                          >
                            {f.label}
                          </button>
                        );
                      })}
                    </div>
                    {filteredAviatorRoundRows.length === 0 ? (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                        {userId ? 'No Aviator records found for selected filter.' : 'Please login to see your Aviator bet history.'}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5 gap-3 lg:gap-4">
                        {filteredAviatorRoundRows.map((row) => (
                          <AviatorBetHistoryCard
                            key={row.key}
                            index={row.index}
                            betId={row.betId}
                            betAmount={row.betAmount}
                            cashOutAmount={row.cashOutAmount}
                            timeFormatted={row.timeFormatted}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                )}
                {selectedGameFromQuery === 'FunTimer' && (
                  <section className="p-0">
                    <h3 className="text-base sm:text-lg font-bold text-[#1B3150] mb-3">FunTimer Bet History</h3>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 mr-1">Result</span>
                      {[
                        { key: 'all', label: 'All' },
                        { key: 'won', label: 'Win' },
                        { key: 'lost', label: 'Lost' },
                      ].map((f) => {
                        const active = gameStatusFilter === f.key;
                        return (
                          <button
                            key={f.key}
                            type="button"
                            onClick={() => setGameStatusFilter(f.key)}
                            className={`min-h-[38px] px-4 rounded-xl text-sm font-bold border-2 transition-colors ${
                              active
                                ? 'bg-[#1B3150] border-[#1B3150] text-white shadow-sm'
                                : 'bg-white border-gray-300 text-[#1B3150] hover:border-[#1B3150]/40 hover:bg-gray-50'
                            }`}
                          >
                            {f.label}
                          </button>
                        );
                      })}
                    </div>
                    {filteredFunTimerRoundRows.length === 0 ? (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                        {userId ? 'No FunTimer records found for selected filter.' : 'Please login to see your FunTimer bet history.'}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5 gap-3 lg:gap-4">
                        {filteredFunTimerRoundRows.map((row) => (
                          <FunTimerBetHistoryCard
                            key={row.key}
                            index={row.index}
                            betId={row.betId}
                            betNumber={row.betNumber}
                            betAmount={row.betAmount}
                            winAmount={row.cashOutAmount}
                            statusLabel={Number(row.cashOutAmount || 0) > Number(row.betAmount || 0) ? 'Won' : 'Lost'}
                            timeFormatted={row.timeFormatted}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                )}
                {selectedGameFromQuery === 'Roulette' && (
                  <section className="p-0">
                    <h3 className="text-base sm:text-lg font-bold text-[#1B3150] mb-3">Roulette Bet History</h3>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 mr-1">Result</span>
                      {[
                        { key: 'all', label: 'All' },
                        { key: 'won', label: 'Win' },
                        { key: 'lost', label: 'Lost' },
                      ].map((f) => {
                        const active = gameStatusFilter === f.key;
                        return (
                          <button
                            key={f.key}
                            type="button"
                            onClick={() => setGameStatusFilter(f.key)}
                            className={`min-h-[38px] px-4 rounded-xl text-sm font-bold border-2 transition-colors ${
                              active
                                ? 'bg-[#1B3150] border-[#1B3150] text-white shadow-sm'
                                : 'bg-white border-gray-300 text-[#1B3150] hover:border-[#1B3150]/40 hover:bg-gray-50'
                            }`}
                          >
                            {f.label}
                          </button>
                        );
                      })}
                    </div>
                    {filteredRouletteRoundRows.length === 0 ? (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                        {userId ? 'No Roulette records found for selected filter.' : 'Please login to see your Roulette bet history.'}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5 gap-3 lg:gap-4">
                        {filteredRouletteRoundRows.map((row) => (
                          <AviatorBetHistoryCard
                            key={row.key}
                            index={row.index}
                            betId={row.betId}
                            betAmount={row.betAmount}
                            cashOutAmount={row.cashOutAmount}
                            timeFormatted={row.timeFormatted}
                            gameName="Roulette"
                          />
                        ))}
                      </div>
                    )}
                  </section>
                )}
              </>
            )
          ) : sortedFiltered.length === 0 ? (
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
      {!isGameScope && isFilterOpen ? (
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

