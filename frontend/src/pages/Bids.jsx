import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import { getRatesCurrent } from '../api/bets';
import ResultDatePicker from '../components/ResultDatePicker';
import { useRefreshOnMarketReset } from '../hooks/useRefreshOnMarketReset';

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
const isStarlineMarketName = (s) => {
  const k = normalizeMarketName(s);
  return k.includes('starline') || k.includes('startline') || k.includes('star line') || k.includes('start line');
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

const Bids = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleBack = () => {
    // Desktop: always go Home (as requested).
    try {
      if (window?.matchMedia?.('(min-width: 768px)')?.matches) {
        navigate('/');
        return;
      }
    } catch (_) {}

    // Mobile: go to previous real page, not just switch sections.
    try {
      const prev = sessionStorage.getItem('prevPathname');
      if (prev && prev !== '/bids' && prev !== '/bet-history' && prev !== '/market-result-history') {
        navigate(prev);
        return;
      }
    } catch (_) {}
    navigate(-1);
  };

  // Mobile only: prevent page scrolling (as requested)
  useEffect(() => {
    let cleanup = () => {};
    try {
      const mql = window.matchMedia('(max-width: 767px)');
      const apply = () => {
        cleanup();
        if (!mql.matches) return;
        const prevBody = document.body.style.overflow;
        const prevHtml = document.documentElement.style.overflow;
        const prevOverscrollBody = document.body.style.overscrollBehavior;
        const prevOverscrollHtml = document.documentElement.style.overscrollBehavior;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overscrollBehavior = 'none';
        document.documentElement.style.overscrollBehavior = 'none';
        cleanup = () => {
          document.body.style.overflow = prevBody;
          document.documentElement.style.overflow = prevHtml;
          document.body.style.overscrollBehavior = prevOverscrollBody;
          document.documentElement.style.overscrollBehavior = prevOverscrollHtml;
        };
      };
      apply();
      mql.addEventListener?.('change', apply);
      return () => {
        mql.removeEventListener?.('change', apply);
        cleanup();
      };
    } catch (_) {
      return () => cleanup();
    }
  }, []);

  const items = useMemo(() => ([
    {
      title: 'Bet History',
      subtitle: 'You can view your market bet history',
      color: '#f3b61b'
    },
    {
      title: 'Game Results',
      subtitle: 'You can view your market result history',
      color: '#25d366',
      iconUrl: 'https://res.cloudinary.com/dzd47mpdo/image/upload/v1769799295/result_ekwn16.png'
    },
  ]), []);

  const TAB_TO_TITLE = useMemo(() => ({
    'bet-history': 'Bet History',
    'game-results': 'Game Results',
  }), []);
  const TITLE_TO_TAB = useMemo(() => ({
    'Bet History': 'bet-history',
    'Game Results': 'game-results',
  }), []);

  const tabParam = (searchParams.get('tab') || '').toString();
  const initialTitle = TAB_TO_TITLE[tabParam] || (items[0]?.title || 'Bet History');
  const [activeTitle, setActiveTitle] = useState(initialTitle);
  const activeItem = items.find((i) => i.title === activeTitle) || items[0];
  const isBetHistoryPanel = activeTitle === 'Bet History';
  const isGameResultsPanel = activeTitle === 'Game Results';
  const rightPanelTitle = activeTitle === 'Game Results' ? 'Market Result History' : activeTitle;
  const historyScope = 'main';
  const isAnyHistoryPanel = isBetHistoryPanel;

  // Desktop Bet History filters (desktop panel inside My Bets)
  const [isDesktopFilterOpen, setIsDesktopFilterOpen] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState([]); // ['OPEN','CLOSE']
  const [selectedStatuses, setSelectedStatuses] = useState([]); // ['Win','Loose','Pending']
  const [selectedMarkets, setSelectedMarkets] = useState([]); // normalized market keys
  const [draftSessions, setDraftSessions] = useState([]);
  const [draftStatuses, setDraftStatuses] = useState([]);
  const [draftMarkets, setDraftMarkets] = useState([]);

  // Keep selected desktop panel on refresh (via ?tab=...)
  useEffect(() => {
    const t = TAB_TO_TITLE[tabParam];
    if (t && t !== activeTitle) setActiveTitle(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);

  // Write the tab param whenever selection changes
  useEffect(() => {
    const nextTab = TITLE_TO_TAB[activeTitle] || 'bet-history';
    if (searchParams.get('tab') === nextTab) return;
    const next = new URLSearchParams(searchParams);
    next.set('tab', nextTab);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTitle]);

  const handleMobileItemClick = (item) => {
    if (item?.title === 'Bet History') {
      navigate('/bet-history');
      return;
    }
    if (item?.title === 'Game Results') {
      navigate('/market-result-history');
      return;
    }
    // keep current behavior for other items
    setActiveTitle(item.title);
  };

  const handleDesktopItemClick = (item) => {
    // Desktop: show content on right panel (no navigation)
    setActiveTitle(item.title);
  };

  const desktopBetHistory = useMemo(() => {
    const u = safeParse(localStorage.getItem('user') || 'null', null);
    const uid = u?._id || u?.id || u?.userId || u?.userid || u?.user_id || u?.uid || null;
    const all = safeParse(localStorage.getItem('betHistory') || '[]', []);
    const list = Array.isArray(all) ? all : [];
    const onlyMine = uid ? list.filter((x) => x?.userId === uid) : [];
    return { uid, items: onlyMine };
  }, []);

  const [markets, setMarkets] = useState([]);
  const [ratesMap, setRatesMap] = useState(null);

  const toDateKeyIST = (d) => {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d || new Date());
    } catch {
      return '';
    }
  };

  const todayKey = useMemo(() => toDateKeyIST(new Date()), []);

  const [resultsDate, setResultsDate] = useState(() => new Date());
  const [resultsRows, setResultsRows] = useState([]);

  const fetchMarkets = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/markets/get-markets`);
      const data = await res.json();
      if (data?.success && Array.isArray(data?.data)) {
        setMarkets(data.data);
      }
    } catch {
      // ignore
    }
  };

  const fetchHistory = async () => {
    try {
      const dateKey = toDateKeyIST(resultsDate) || toDateKeyIST(new Date());
      const res = await fetch(`${API_BASE_URL}/markets/result-history?date=${encodeURIComponent(dateKey)}`);
      const data = await res.json();
      if (data?.success && Array.isArray(data?.data)) {
        const mapped = data.data.map((x) => ({
          id: x?._id || `${x?.marketId || ''}-${x?.dateKey || ''}`,
          name: (x?.marketName || '').toString().trim(),
          result: (x?.displayResult || '***-**-***').toString().trim(),
        })).filter((x) => x.name);
        mapped.sort((a, b) => a.name.localeCompare(b.name));
        setResultsRows(mapped);
      } else {
        setResultsRows([]);
      }
    } catch {
      setResultsRows([]);
    }
  };

  const refetchAll = async () => {
    await Promise.all([fetchMarkets(), fetchHistory()]);
  };

  useEffect(() => {
    let alive = true;
    const run = async () => {
      await fetchMarkets();
    };
    run();
    const id = setInterval(run, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  useRefreshOnMarketReset(refetchAll);
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

  useEffect(() => {
    const k = toDateKeyIST(resultsDate);
    if (k && k > todayKey) setResultsDate(new Date());
  }, [resultsDate, todayKey]);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      await fetchHistory();
    };
    run();
    const id = setInterval(run, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [resultsDate, todayKey]);

  const desktopBetHistoryFlat = useMemo(() => {
    const out = [];
    for (const x of desktopBetHistory.items || []) {
      const rows = Array.isArray(x?.rows) ? x.rows : [];
      if (!rows.length) {
        out.push({ x, r: null, idx: 0 });
        continue;
      }
      rows.forEach((r, idx) => out.push({ x, r, idx }));
    }
    return out;
  }, [desktopBetHistory.items]);

  const desktopRows = useMemo(() => {
    return (desktopBetHistoryFlat || []).map(({ x, r, idx }) => {
      const betValue = r?.number != null ? renderBetNumber(r.number) : '-';
      const gameType = (x?.labelKey || 'Bet').toString();
      const points = Number(r?.points || 0) || 0;
      const session = (r?.type || x?.session || '').toString().trim().toUpperCase();
      const market = (x?.marketTitle || '').toString().trim() || 'MARKET';
      const marketKey = normalizeMarketName(market);
      const m = marketByName.get(marketKey);
      const verdict = evaluateBet({
        market: m,
        betNumberRaw: r?.number,
        amount: points,
        session,
        ratesMap,
      });
      const statusLabel = verdict.state === 'won' ? 'Win' : verdict.state === 'lost' ? 'Loose' : 'Pending';
      return { x, r, idx, betValue, gameType, points, session, market, marketKey, verdict, statusLabel };
    });
  }, [desktopBetHistoryFlat, marketByName, ratesMap]);

  const marketOptions = useMemo(() => {
    const fromApi = (markets || [])
      .map((m) => (m?.marketName || '').toString().trim())
      .filter(Boolean);
    const fromHistory = (desktopBetHistory.items || [])
      .map((x) => (x?.marketTitle || '').toString().trim())
      .filter(Boolean);
    const uniqAll = Array.from(new Set([...fromApi, ...fromHistory]));
    const uniq =
      isAnyHistoryPanel
        ? (historyScope === 'starline'
            ? uniqAll.filter((name) => isStarlineMarketName(name))
            : uniqAll.filter((name) => !isStarlineMarketName(name)))
        : uniqAll;
    uniq.sort((a, b) => a.localeCompare(b));
    return uniq.map((label) => ({ label, key: normalizeMarketName(label) }));
  }, [markets, desktopBetHistory.items, isAnyHistoryPanel, historyScope]);

  const filteredDesktopRows = useMemo(() => {
    const effectiveSelectedMarkets = isAnyHistoryPanel
      ? (historyScope === 'starline'
          ? (selectedMarkets || []).filter((k) => isStarlineMarketName(k))
          : (selectedMarkets || []).filter((k) => !isStarlineMarketName(k)))
      : selectedMarkets;
    return (desktopRows || []).filter((row) => {
      if (isAnyHistoryPanel) {
        const isStar = isStarlineMarketName(row.market);
        if (historyScope === 'starline' && !isStar) return false;
        if (historyScope !== 'starline' && isStar) return false;
      }
      if (selectedSessions.length > 0 && !selectedSessions.includes(row.session)) return false;
      if (effectiveSelectedMarkets.length > 0 && !effectiveSelectedMarkets.includes(row.marketKey)) return false;
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(row.statusLabel)) return false;
      return true;
    });
  }, [desktopRows, selectedMarkets, selectedSessions, selectedStatuses, isAnyHistoryPanel, historyScope]);

  useEffect(() => {
    if (!isDesktopFilterOpen) return;
    setDraftSessions(selectedSessions);
    setDraftStatuses(selectedStatuses);
    setDraftMarkets(selectedMarkets);
  }, [isDesktopFilterOpen, selectedMarkets, selectedSessions, selectedStatuses]);

  const toggleDraft = (arr, value, setArr) => {
    setArr((prev) => (prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]));
  };

  return (
    <div className="min-h-screen bg-white text-gray-800 pl-3 pr-3 sm:pl-4 sm:pr-4 pt-0 pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
      <style>{`
        .hide-scrollbar {
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE/Edge */
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none; /* Chrome/Safari */
          width: 0;
          height: 0;
        }
      `}</style>
      <div className="w-full max-w-lg md:max-w-none mx-auto md:mx-0">
        <div className="mb-6 md:grid md:grid-cols-[360px_1fr] md:gap-6 md:items-center">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="w-10 h-10 rounded-full bg-gray-100 border border-gray-300 flex items-center justify-center text-gray-700 hover:bg-gray-200 active:scale-95 transition"
              aria-label="Back"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl sm:text-2xl font-bold">My Bets</h1>
          </div>

          <div className="hidden md:flex items-center justify-between gap-4 px-1">
            <div className="text-2xl font-extrabold text-gray-900">{rightPanelTitle}</div>
            {isGameResultsPanel ? (
              <div className="w-[320px]">
                <ResultDatePicker
                  value={resultsDate}
                  onChange={setResultsDate}
                  maxDate={new Date()}
                  label="Select Date"
                  buttonClassName="px-4 py-2 rounded-full bg-white border border-gray-200 text-gray-800 font-bold text-sm shadow-sm hover:border-gray-400 transition-colors"
                />
              </div>
            ) : isAnyHistoryPanel ? (
              <button
                type="button"
                onClick={() => setIsDesktopFilterOpen(true)}
                className="px-4 py-2 rounded-full bg-white border border-gray-200 text-gray-600 font-bold text-sm shadow-sm hover:border-gray-400 transition-colors"
                aria-label="Filter By"
                title="Filter By"
              >
                Filter By
              </button>
            ) : null}
          </div>
        </div>

        {/* Mobile: same list layout */}
        <div className="space-y-4 md:hidden">
          {items.map((item) => (
            <div
              key={item.title}
              onClick={() => handleMobileItemClick(item)}
              className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between shadow-md"
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-black shadow-[0_10px_20px_rgba(0,0,0,0.35)]"
                  style={{ backgroundColor: item.color }}
                >
                  {item.iconUrl ? (
                    <img src={item.iconUrl} alt={item.title} className="w-7 h-7 object-contain" />
                  ) : (
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                      <circle cx="12" cy="12" r="8" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="text-base sm:text-lg font-semibold text-gray-900">{item.title}</p>
                  <p className="text-xs sm:text-sm text-gray-600">{item.subtitle}</p>
                </div>
              </div>
              <div className="w-9 h-9 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: sidebar-style list */}
        <div className="hidden md:grid md:grid-cols-[360px_1fr] md:gap-6 md:items-start">
          <aside className="md:sticky md:top-[96px] space-y-3 md:space-y-5">
            {items.map((item) => {
              const active = item.title === activeTitle;
              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => handleDesktopItemClick(item)}
                  className={`w-full text-left bg-white border rounded-2xl p-4 md:p-5 flex items-center justify-between shadow-md transition-colors ${
                    active ? 'border-[#1B3150] bg-gray-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-black shadow-[0_10px_20px_rgba(0,0,0,0.35)]"
                      style={{ backgroundColor: item.color }}
                    >
                      {item.iconUrl ? (
                        <img src={item.iconUrl} alt={item.title} className="w-6 h-6 object-contain" />
                      ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                          <circle cx="12" cy="12" r="8" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-gray-900 truncate">{item.title}</p>
                      <p className="text-xs text-gray-600 truncate">{item.subtitle}</p>
                    </div>
                  </div>
                  <div className={`w-9 h-9 rounded-full border flex items-center justify-center ${
                    active ? 'bg-gray-100 border-gray-400 text-[#1B3150]' : 'bg-gray-50 border-gray-200 text-gray-600'
                  }`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </aside>

          <main
            className={
              (isAnyHistoryPanel || isGameResultsPanel)
                ? 'bg-transparent border-0 shadow-none p-0'
                : 'rounded-2xl bg-white border border-gray-200 shadow-md p-6'
            }
          >
            {(isAnyHistoryPanel || isGameResultsPanel) ? null : (
              <div className="flex items-center justify-center gap-4">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-black shadow-[0_10px_20px_rgba(0,0,0,0.35)]"
                  style={{ backgroundColor: activeItem?.color || '#f3b61b' }}
                >
                  {activeItem?.iconUrl ? (
                    <img src={activeItem.iconUrl} alt={activeItem.title} className="w-7 h-7 object-contain" />
                  ) : (
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                      <circle cx="12" cy="12" r="8" />
                    </svg>
                  )}
                </div>
                <div className="min-w-0 text-center">
                  <div className="text-xl font-bold text-gray-900 truncate">{activeItem?.title}</div>
                  <div className="text-sm text-gray-600">{activeItem?.subtitle}</div>
                </div>
              </div>
            )}

            {isAnyHistoryPanel ? (
              <div className={isAnyHistoryPanel ? 'mt-0' : 'mt-6'}>
                <div className="max-h-[calc(100vh-220px)] overflow-y-auto hide-scrollbar">
                  {desktopBetHistory.uid && filteredDesktopRows.length === 0 ? (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-gray-600 text-sm">
                      No bets found.
                    </div>
                  ) : !desktopBetHistory.uid ? (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-gray-600 text-sm">
                      Please login to see your bet history.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {filteredDesktopRows.map(({ x, r, idx, betValue, gameType, points, session, market, verdict }) => {

                        return (
                          <div
                            key={`${x.id}-${r?.id ?? idx}`}
                            className="rounded-2xl overflow-hidden border border-gray-200 bg-white"
                          >
                            <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b border-gray-200">
                              <div className="text-[#1B3150] font-extrabold tracking-wide truncate">
                                {market.toUpperCase()}
                              </div>
                              {session ? (
                                <div className="text-xs font-bold text-[#1B3150] border border-gray-300 rounded-full px-3 py-1 bg-white">
                                  {session}
                                </div>
                              ) : null}
                            </div>

                            <div className="px-4 py-4">
                              <div className="grid grid-cols-3 text-center text-gray-600 font-bold text-sm">
                                <div>Game Type</div>
                                <div>{(x?.labelKey || 'Bet').toString()}</div>
                                <div>Points</div>
                              </div>
                              <div className="mt-3 grid grid-cols-3 text-center text-gray-800 text-sm">
                                <div className="font-semibold">{gameType}</div>
                                <div className="font-extrabold">{betValue}</div>
                                <div className="font-extrabold">{points}</div>
                              </div>
                            </div>

                            <div className="h-px bg-gray-200" />
                            <div className="px-4 py-3 text-center text-gray-600 text-sm">
                              Transaction: <span className="font-semibold">{formatTxnTime(x?.createdAt)}</span>
                            </div>

                            <div className="h-px bg-gray-200" />
                            {verdict.state === 'won' ? (
                              <div className="px-4 py-3 text-center font-semibold text-green-600">
                                Congratulations, You Won {verdict.payout ? `₹${Number(verdict.payout || 0).toLocaleString('en-IN')}` : ''}
                              </div>
                            ) : verdict.state === 'lost' ? (
                              <div className="px-4 py-3 text-center font-semibold text-red-500">
                                Better Luck Next time
                              </div>
                            ) : (
                              <div className="px-4 py-3 text-center font-semibold text-gray-500">
                                Bet Placed
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : activeTitle === 'Game Results' ? (
              <div className="mt-3">
                <div className="max-h-[calc(100vh-260px)] overflow-y-auto hide-scrollbar">
                  {resultsRows.length === 0 ? (
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-gray-600">
                      No markets found.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {resultsRows.map((r) => (
                        <div
                          key={r.id}
                          className="rounded-2xl bg-white border border-gray-200 px-5 py-4 shadow-md flex items-center justify-between gap-4"
                        >
                          <div className="font-extrabold tracking-wide text-gray-900 truncate">{r.name.toUpperCase()}</div>
                          <div className="font-extrabold tracking-wide text-gray-600 shrink-0">{r.result}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-6 text-gray-600 text-sm">
                Select an item from the left menu. We will add the actual pages/content here next.
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Desktop Bet History Filter modal */}
      {isDesktopFilterOpen ? (
        <div className="fixed inset-0 z-[999] hidden md:flex items-center justify-center px-3 sm:px-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close filter"
            onClick={() => setIsDesktopFilterOpen(false)}
          />

          <div className="relative w-full max-w-md rounded-[28px] overflow-hidden shadow-xl border border-gray-200 bg-white">
            <div className="bg-[#1B3150] text-white text-center py-4 text-2xl font-extrabold border-b border-gray-300">
              Filter Type
            </div>

            <div className="bg-white text-gray-800">
              <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
                <div className="text-lg font-bold text-gray-600 mb-3">By Game Type</div>
                <div className="flex items-center justify-around gap-6 pb-4">
                  <label className="flex items-center gap-3 text-base sm:text-lg">
                    <input
                      type="checkbox"
                      className="w-6 h-6 accent-[#1B3150]"
                      checked={draftSessions.includes('OPEN')}
                      onChange={() => toggleDraft(draftSessions, 'OPEN', setDraftSessions)}
                    />
                    Open
                  </label>
                  <label className="flex items-center gap-3 text-base sm:text-lg">
                    <input
                      type="checkbox"
                      className="w-6 h-6 accent-[#1B3150]"
                      checked={draftSessions.includes('CLOSE')}
                      onChange={() => toggleDraft(draftSessions, 'CLOSE', setDraftSessions)}
                    />
                    Close
                  </label>
                </div>

                <div className="h-px bg-gray-200 my-3" />

                <div className="text-lg font-bold text-gray-600 mb-3">By Winning Status</div>
                <div className="flex items-center justify-around gap-3 pb-4">
                  {['Win', 'Loose', 'Pending'].map((s) => (
                    <label key={s} className="flex items-center gap-3 text-base sm:text-lg">
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

                <div className="h-px bg-gray-200 my-3" />

                <div className="text-lg font-bold text-gray-600 mb-3">By Games</div>
                <div className="space-y-3 pb-2">
                  {marketOptions.map((name) => (
                    <label
                      key={name.key}
                      className="flex items-center gap-4 bg-gray-50 rounded-xl border border-gray-200 shadow-sm px-4 py-4 hover:border-gray-400 transition-colors"
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
                    onClick={() => setIsDesktopFilterOpen(false)}
                    className="rounded-full bg-gray-100 border border-gray-300 text-gray-800 font-bold py-4 text-base sm:text-lg shadow-md active:scale-[0.99] hover:border-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSessions(draftSessions);
                      setSelectedStatuses(draftStatuses);
                      setSelectedMarkets(draftMarkets);
                      setIsDesktopFilterOpen(false);
                    }}
                    className="rounded-full bg-[#1B3150] text-white font-extrabold py-4 text-base sm:text-lg shadow-md active:scale-[0.99] hover:bg-[#152842] transition-colors"
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

export default Bids;
