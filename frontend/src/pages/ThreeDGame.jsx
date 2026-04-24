import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ClipboardList,
  CircleX,
  History,
  HelpCircle,
  House,
  KeyRound,
  RefreshCw,
  Trophy,
  UserCircle,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ResultPanel from '../components/threeD/ResultPanel';
import Keypad from '../components/threeD/Keypad';
import {
  GAME_INTERVAL_SECONDS,
  calculateSettlementSummary,
  formatTimer,
  generate3DResult,
  getNextDrawTime,
  getSlotMeta,
  settleAllBets,
  validateBetForMode,
} from '../components/threeD/helpers';
import TicketListModal from '../components/threeD/TicketListModal';
import TicketDetailsModal from '../components/threeD/TicketDetailsModal';
import AdvanceDrawModal from '../components/AdvanceDrawModal';
import { getBalance, updateUserBalance } from '../api/bets';
import { getMyQuizBets, getQuizSlotResultsForDate, postQuizBetsBatch } from '../api/quizApi';
import { getCurrentUser, subscribeUserSession } from '../session/userSession';

const MODE_OPTIONS = ['all', 'box', 'str', 'sp', 'fp', 'bp', 'ap', 'single', 'duplicates', 'triples'];
const MODE_GROUP_COMBO = MODE_OPTIONS.slice(0, 7);
const MODE_GROUP_SPECIAL = MODE_OPTIONS.slice(7);
const ALL_SHORTCUT_MODES = ['box', 'str', 'sp', 'fp', 'bp', 'ap'];
const RATE_OPTIONS = [10, 20, 30, 50, 100, 200];
/** Progress bar turns red when remaining time is at or below this many seconds (5 minutes). */
const TIMER_BAR_RED_MAX_SECONDS = 5 * 60;
const HISTORY_FETCH_LIMIT = 5000;
const HEADER_MENU_ITEMS = [
  { label: 'Result', Icon: Trophy },
  { label: 'Account', Icon: UserCircle },
  { label: 'Quiz', Icon: HelpCircle },
  { label: 'Ticket List', Icon: ClipboardList },
  { label: 'Cancel Bet', Icon: CircleX },
  { label: 'Refresh', Icon: RefreshCw },
  { label: 'History', Icon: History },
];
const PANEL_OPTIONS = ['A', 'B', 'C'];
const DIGIT_OPTIONS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
/** Panel letter strip on placed-bet cards (matches ResultPanel-style gradients). */
const BET_CARD_PANEL_HEADER = {
  A: 'bg-gradient-to-b from-blue-500 via-blue-600 to-indigo-800 shadow-[0_3px_10px_rgba(37,99,235,0.42)] ring-1 ring-white/35',
  B: 'bg-gradient-to-b from-rose-500 via-red-600 to-red-800 shadow-[0_3px_10px_rgba(220,38,38,0.4)] ring-1 ring-white/35',
  C: 'bg-gradient-to-b from-emerald-500 via-teal-600 to-emerald-800 shadow-[0_3px_10px_rgba(5,150,105,0.4)] ring-1 ring-white/35',
};
const VALID_MODES = new Set(['single', 'str', 'box', 'sp', 'fp', 'bp', 'ap', 'duplicates', 'dp', 'triples', 'tp']);
const LPICK_OPTIONS = ['single', 'box', 'str', 'sp', 'fp', 'bp', 'ap', 'duplicates', 'triples'];
const BASE_WIDTH = 1536;
const BASE_HEIGHT = 864;
const PANEL_QUIZ_IDS = { A: 1, B: 2, C: 3 };
const panelToQuizId = (panelRaw) => {
  const p = String(panelRaw || '').trim().toUpperCase();
  return PANEL_QUIZ_IDS[p] || 1;
};

const deriveThreeDigitSetValue = (results, quizId) => {
  const byQuiz = new Map((Array.isArray(results) ? results : []).map((r) => [r.quizId, r.result]));
  const raw = byQuiz.get(quizId);
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 999) return '---';
  return String(n).padStart(3, '0');
};

const toIstDayKey = (d = new Date()) => {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    return `${map.year}-${map.month}-${map.day}`;
  } catch (_) {
    const x = new Date(d);
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const day = String(x.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
};

const toDigits3 = (value) => {
  const s = String(value ?? '').replace(/\s+/g, '');
  if (!s) return ['-', '-', '-'];
  return s.padStart(3, '-').slice(-3).split('');
};

const BetCardsGrid = React.memo(function BetCardsGrid({
  bets,
  visibleBetCards,
  hiddenBetCardCount,
  getDisplayBetNumber,
  onRemoveBet,
}) {
  if (!bets.length) {
    return (
      <div className="flex min-h-[200px] flex-1 items-center justify-center text-[clamp(1.25rem,3vw,2.625rem)] text-[#9a9a9a] sm:min-h-0">
        No bets placed yet
      </div>
    );
  }

  return (
    <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto">
      {hiddenBetCardCount > 0 ? (
        <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[13px] font-semibold text-amber-800 sm:text-[14px]">
          Showing latest {visibleBetCards.length} bets for fast view. {hiddenBetCardCount} older bets are hidden from grid but included in BUY.
        </div>
      ) : null}
      <div className="grid w-full min-w-0 gap-3 [grid-template-columns:repeat(auto-fit,minmax(5.75rem,1fr))]">
        {visibleBetCards.map((bet) => {
          const panelKey = String(bet.panels || '').trim().toUpperCase();
          const panelHeaderClass = BET_CARD_PANEL_HEADER[panelKey] || BET_CARD_PANEL_HEADER.A;
          const shellClass =
            bet.outcome === 'win'
              ? 'border border-emerald-300/85 bg-gradient-to-b from-emerald-50/95 via-white to-white shadow-[0_4px_16px_rgba(5,150,105,0.18)] ring-1 ring-emerald-200/50'
              : bet.outcome === 'loss'
                ? 'border border-rose-300/85 bg-gradient-to-b from-rose-50/95 via-white to-white shadow-[0_4px_16px_rgba(225,29,72,0.14)] ring-1 ring-rose-200/45'
                : bet.outcome === 'cancelled'
                  ? 'border border-slate-300/90 bg-gradient-to-b from-slate-50/95 via-white to-white shadow-[0_4px_14px_rgba(71,85,105,0.14)] ring-1 ring-slate-200/55'
                  : 'border border-slate-200/90 bg-gradient-to-b from-white via-slate-50/60 to-slate-100/50 shadow-[0_4px_14px_rgba(15,23,42,0.09)] ring-1 ring-slate-200/40';
          return (
            <div
              key={bet.id}
              className={`min-w-0 w-full max-w-full overflow-hidden rounded-xl ${shellClass} ${bet.justAdded ? 'animate-pulse' : ''}`}
            >
              <div className={`flex h-9 items-center justify-center text-[18px] font-bold tracking-wide text-white drop-shadow-sm ${panelHeaderClass}`}>
                {panelKey || '-'}
              </div>
              <div className="px-2.5 py-2.5 text-center">
                <div className="text-[26px] font-bold leading-none tracking-tight text-slate-900 sm:text-[28px]">{getDisplayBetNumber(bet)}</div>
                <div className="mt-1 text-[15px] font-bold uppercase leading-none tracking-wide text-slate-500 sm:text-[16px]">{bet.mode}</div>
                <div className="mt-1 text-[14px] font-semibold leading-none text-slate-500">Price {bet.rate}</div>
                <button
                  type="button"
                  onClick={() => onRemoveBet(bet.id)}
                  className="mx-auto mt-2 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-b from-rose-500 to-red-700 text-[18px] font-bold leading-none text-white shadow-[0_2px_10px_rgba(220,38,38,0.4)] ring-1 ring-white/30 transition hover:brightness-110 active:scale-95"
                  aria-label="Remove bet"
                >
                  ×
                </button>
              </div>
              {bet.outcome ? (
                <div className="border-t border-slate-200/70 bg-slate-50/80 px-2 pb-2 pt-1.5 text-[12px] text-center sm:text-[13px]">
                  <span className={`font-bold ${
                    bet.outcome === 'win' ? 'text-emerald-600' : bet.outcome === 'cancelled' ? 'text-slate-600' : 'text-rose-600'
                  }`}
                  >
                    {bet.outcome.toUpperCase()}
                  </span>
                  <div className="mt-0.5 font-medium text-slate-600">Panel: {bet.matchedPanel || '-'}</div>
                  <div className="font-medium text-slate-600">Result: {bet.matchedResult || '-'}</div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
});

const ThreeDGame = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const quizId = searchParams.get('quiz');
  const slotRef = useRef('');
  const backendResultCacheRef = useRef(new Map());
  const lastLandscapeAutoFsAttemptRef = useRef(0);
  const inputNumberRef = useRef(null);
  const rangeFromRef = useRef(null);
  const rangeToRef = useRef(null);
  const qtyRef = useRef(null);
  const autoAddLockRef = useRef(false);
  const autoRangeAddLockRef = useRef('');
  const autoAddTimerRef = useRef(null);
  const hasSettledRef = useRef(false);
  const isBuyingRef = useRef(false);
  const rangeAutoNextLockRef = useRef(false);
  const [activeInputIndex, setActiveInputIndex] = useState(0);
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : BASE_WIDTH,
    height: typeof window !== 'undefined' ? window.innerHeight : BASE_HEIGHT,
  }));
  const [showRotatePrompt, setShowRotatePrompt] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [timerSeconds, setTimerSeconds] = useState(GAME_INTERVAL_SECONDS);
  const [nextDrawAt, setNextDrawAt] = useState(() => getNextDrawTime(new Date()));
  const [results, setResults] = useState(() => generate3DResult());
  const [resultUpdatedAt, setResultUpdatedAt] = useState(0);
  const [inputNumber, setInputNumber] = useState('');
  const [points, setPoints] = useState(String(RATE_OPTIONS[0]));
  const [selectedModes, setSelectedModes] = useState(['box']);
  const [selectedRate, setSelectedRate] = useState(10);
  const [selectedPanels, setSelectedPanels] = useState(['A']);
  const [selectedDigits, setSelectedDigits] = useState([]);
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [lPickType, setLPickType] = useState('box');
  const [qty, setQty] = useState('');
  const [validationMsg, setValidationMsg] = useState('');
  const [toast, setToast] = useState('');
  const [buySummary, setBuySummary] = useState(null);
  const [bets, setBets] = useState([]);
  const [lastTxnId, setLastTxnId] = useState('GM00000000000000');
  const [lastPoints, setLastPoints] = useState(0);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isTicketListOpen, setIsTicketListOpen] = useState(false);
  const [isHistoryListOpen, setIsHistoryListOpen] = useState(false);
  const [backendHistoryTickets, setBackendHistoryTickets] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isAdvanceDrawOpen, setIsAdvanceDrawOpen] = useState(false);
  const [selectedAdvanceSlots, setSelectedAdvanceSlots] = useState([]);
  const [advanceBuySuccess, setAdvanceBuySuccess] = useState(null);
  const [advanceSelectionNotice, setAdvanceSelectionNotice] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedQuizId, setSelectedQuizId] = useState(null);
  const [resultDateDay, setResultDateDay] = useState(() => String(new Date().getDate()).padStart(2, '0'));
  const [resultDateMonth, setResultDateMonth] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'));
  const [resultDateYear, setResultDateYear] = useState(() => String(new Date().getFullYear()));
  const [resultFilterKey, setResultFilterKey] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  const [resultSlots, setResultSlots] = useState([]);
  const [resultLoading, setResultLoading] = useState(false);
  const [resultError, setResultError] = useState('');
  const [lastDrawResult, setLastDrawResult] = useState(null);
  const [ticketHistory, setTicketHistory] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [playerIdentity, setPlayerIdentity] = useState('user');

  const isResultFresh = useMemo(() => Date.now() - resultUpdatedAt < 1400, [resultUpdatedAt, now]);
  const topDisplayResults = useMemo(() => {
    if (!lastDrawResult) return results;
    return {
      A: toDigits3(lastDrawResult.A),
      B: toDigits3(lastDrawResult.B),
      C: toDigits3(lastDrawResult.C),
    };
  }, [lastDrawResult, results]);
  const isBuySuccessToast = useMemo(
    () => String(toast || '').toLowerCase() === 'bet placed successfully',
    [toast],
  );
  const canUsePortal = typeof document !== 'undefined';
  const lastTicket = useMemo(() => (ticketHistory.length ? ticketHistory[0] : null), [ticketHistory]);
  const lastWinAmount = useMemo(() => {
    const latestWinningTicket = (Array.isArray(ticketHistory) ? ticketHistory : []).find((ticket) => {
      const outcome = String(ticket?.outcome || '').toLowerCase();
      const win = Number(ticket?.totalWin || 0);
      return outcome === 'win' && win > 0;
    });
    return Number(latestWinningTicket?.totalWin || 0);
  }, [ticketHistory]);
  const historyTicketsForModal = useMemo(
    () => (Array.isArray(backendHistoryTickets) ? backendHistoryTickets : []),
    [backendHistoryTickets],
  );
  const formattedWalletBalance = useMemo(
    () => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(walletBalance) || 0),
    [walletBalance],
  );
  const visibleBetCards = useMemo(
    () => (Array.isArray(bets) ? [...bets].reverse() : []),
    [bets],
  );
  const hiddenBetCardCount = 0;
  const accountDetails = useMemo(() => {
    const user = getCurrentUser() || {};
    const userId = user?.id || user?._id || '-';
    const phone = user?.phone || user?.mobile || user?.mobileNumber || '-';
    const email = user?.email || '-';
    return {
      name: playerIdentity || 'user',
      userId: String(userId),
      phone: String(phone),
      email: String(email),
      wallet: Number(walletBalance) || 0,
    };
  }, [playerIdentity, walletBalance]);

  const loadStoredBalance = useCallback(() => {
    try {
      const user = getCurrentUser() || {};
      const b = user?.balance ?? user?.walletBalance ?? user?.wallet ?? 0;
      setWalletBalance(Number(b) || 0);
    } catch (_) {
      setWalletBalance(0);
    }
  }, []);

  const loadStoredPlayerIdentity = useCallback(() => {
    try {
      const user = getCurrentUser() || {};
      const label =
        user?.username ||
        user?.name ||
        user?.fullName ||
        user?.phone ||
        user?.email ||
        user?.id ||
        user?._id ||
        'user';
      setPlayerIdentity(String(label).trim() || 'user');
    } catch (_) {
      setPlayerIdentity('user');
    }
  }, []);

  const refreshWalletBalance = useCallback(async () => {
    try {
      const user = getCurrentUser();
      const userId = user?.id || user?._id;
      if (!userId) {
        loadStoredBalance();
        return;
      }
      const res = await getBalance();
      if (res.success && res.data?.balance != null) {
        updateUserBalance(res.data.balance);
        setWalletBalance(Number(res.data.balance) || 0);
      } else {
        loadStoredBalance();
      }
    } catch (_) {
      loadStoredBalance();
    }
  }, [loadStoredBalance]);

  const loadBackendHistoryTickets = useCallback(async () => {
    setIsHistoryLoading(true);
    try {
      const j = await getMyQuizBets(HISTORY_FETCH_LIMIT, '3d');
      const rows = Array.isArray(j?.data) ? j.data : [];
      const rowsBySlot = new Map();
      rows.forEach((row) => {
        const slotStartIso = String(row?.slotStartIso || '').trim() || 'unknown-slot';
        if (!rowsBySlot.has(slotStartIso)) rowsBySlot.set(slotStartIso, []);
        rowsBySlot.get(slotStartIso).push(row);
      });

      const mapped = Array.from(rowsBySlot.entries()).map(([slotStartIso, slotRows]) => {
        const sortedRows = [...slotRows].sort((a, b) => new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime());
        const firstRow = sortedRows[0] || {};
        const createdAtIso = firstRow?.createdAt ? new Date(firstRow.createdAt).toISOString() : new Date().toISOString();
        const createdAt = new Date(createdAtIso);
        const drawDate = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}-${String(createdAt.getDate()).padStart(2, '0')}`;
        const drawTime = String(firstRow?.drawLabelEnd || '').trim() || new Intl.DateTimeFormat('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }).format(createdAt).replace(/\s?(am|pm)$/i, (m) => ` ${m.trim().toUpperCase()}`);

        let totalPoints = 0;
        let totalWin = 0;
        let hasPending = false;
        let hasWin = false;
        const bets = sortedRows.map((row) => {
          const status = String(row?.status || '').toLowerCase();
          const outcome = status === 'win' ? 'win' : status === 'lose' ? 'loss' : 'pending';
          if (outcome === 'pending') hasPending = true;
          if (outcome === 'win') hasWin = true;
          const setPanel = Number(row?.quizId) === 1 ? 'A' : Number(row?.quizId) === 2 ? 'B' : Number(row?.quizId) === 3 ? 'C' : 'A';
          const number3 = String(row?.number ?? '').replace(/\D/g, '').slice(-3).padStart(3, '0');
          const betMode = String(row?.betMode || row?.mode || 'str').trim().toLowerCase();
          const amount = Number(row?.amount || 0);
          const winPayout = Number(row?.winPayout || 0);
          const winningNumber = String(row?.winningNumber ?? '').replace(/\D/g, '').slice(-3).padStart(3, '0');
          totalPoints += amount;
          totalWin += winPayout;
          return {
            id: row?.id || `${row?.createdAt || Date.now()}-${row?.quizId}-${number3}`,
            panels: setPanel,
            mode: betMode,
            number: number3,
            points: amount,
            outcome,
            matchedPanel: setPanel,
            matchedResult: outcome === 'pending' ? '-' : (/^\d{3}$/.test(winningNumber) ? winningNumber : '-'),
            winAmount: winPayout,
            payoutLabel: outcome === 'win' ? `${amount} × ${amount > 0 ? Math.round(winPayout / amount) : 0} = ${winPayout}` : null,
          };
        });

        const outcome = hasPending ? 'pending' : (hasWin ? 'win' : 'loss');
        return {
          id: `backend-slot-${slotStartIso}`,
          userName: playerIdentity || 'user',
          slotStartIso,
          drawDate,
          drawTime,
          createdAt: createdAtIso,
          gameId: slotStartIso,
          totalPoints,
          totalWin,
          outcome,
          settled: !hasPending,
          settledUsing: 'backend',
          bets,
        };
      });
      mapped.sort((a, b) => new Date(b?.slotStartIso || b?.createdAt || 0).getTime() - new Date(a?.slotStartIso || a?.createdAt || 0).getTime());
      setBackendHistoryTickets(mapped);
      await refreshWalletBalance();
    } catch (_) {
      setBackendHistoryTickets([]);
    } finally {
      setIsHistoryLoading(false);
    }
  }, [playerIdentity, refreshWalletBalance]);

  const pushWalletHistory = useCallback(() => {}, []);

  useEffect(() => {
    if (!quizId) return;

    const parsedQuizId = Number(String(quizId).replace(/\D/g, ''));

    if (Number.isInteger(parsedQuizId) && parsedQuizId >= 1 && parsedQuizId <= 3) {
      setSelectedQuizId(parsedQuizId);

      // Remove query param after applying it
      navigate('/lottery/3d', { replace: true });
    }
  }, [quizId, navigate]);

  useEffect(() => {
    loadStoredBalance();
    loadStoredPlayerIdentity();
    refreshWalletBalance();

    const handleSessionChange = () => {
      loadStoredBalance();
      loadStoredPlayerIdentity();
    };
    const unsubscribe = subscribeUserSession(handleSessionChange);
    const handleUserLogin = () => {
      loadStoredBalance();
      loadStoredPlayerIdentity();
    };
    const handleUserLogout = () => {
      loadStoredBalance();
      loadStoredPlayerIdentity();
    };
    const handleBalanceUpdated = (e) => {
      const nextBalance = e?.detail?.balance;
      if (nextBalance != null) {
        setWalletBalance(Number(nextBalance) || 0);
      } else {
        loadStoredBalance();
      }
      loadStoredPlayerIdentity();
    };

    window.addEventListener('userLogin', handleUserLogin);
    window.addEventListener('userLogout', handleUserLogout);
    window.addEventListener('balanceUpdated', handleBalanceUpdated);

    return () => {
      unsubscribe();
      window.removeEventListener('userLogin', handleUserLogin);
      window.removeEventListener('userLogout', handleUserLogout);
      window.removeEventListener('balanceUpdated', handleBalanceUpdated);
    };
  }, [loadStoredBalance, loadStoredPlayerIdentity, refreshWalletBalance]);
  const canAddBet = useMemo(
    () => {
      const singleValid = /^\d{1,3}$/.test((inputNumber || '').trim());
      const fromVal = Number(rangeFrom);
      const toVal = Number(rangeTo);
      const hasAnyRangeInput = Boolean(rangeFrom || rangeTo);
      const rangeValid = /^\d{1,3}$/.test(rangeFrom) && /^\d{1,3}$/.test(rangeTo) && fromVal <= toVal && (toVal - fromVal + 1) <= 1000;
      const qtyValid = Number.isInteger(Number(qty)) && Number(qty) > 0 && Number(qty) <= 1000;
      if (hasAnyRangeInput) {
        return Number(points) > 0 && selectedModes.length > 0 && rangeValid;
      }
      return Number(points) > 0 && selectedModes.length > 0 && (singleValid || qtyValid);
    },
    [inputNumber, points, qty, rangeFrom, rangeTo, selectedModes],
  );
  const totalPoints = useMemo(() => bets.reduce((sum, bet) => sum + Number(bet.points || 0), 0), [bets]);
  const pointValue = useMemo(() => {
    const parsed = parseInt(points, 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }, [points]);

  useEffect(() => {
    // Rate is the default stake per bet.
    setPoints(String(selectedRate));
  }, [selectedRate]);
  const getDisplayBetNumber = useCallback((bet) => {
    const mode = String(bet?.mode || '').toLowerCase();
    const digits = String(bet?.number || '').replace(/\D/g, '').slice(-3).padStart(3, '0');
    if (mode === 'fp') return digits.slice(0, 2);
    if (mode === 'bp') return digits.slice(1);
    if (mode === 'ap') return digits.slice(0, 2);
    return bet?.number;
  }, []);
  const dashboardScaleX = useMemo(() => viewport.width / BASE_WIDTH, [viewport.width]);
  const dashboardScaleY = useMemo(() => viewport.height / BASE_HEIGHT, [viewport.height]);
  const isMobileView = useMemo(() => viewport.width <= 900, [viewport.width]);
  const isTouchDevice = useMemo(
    () => typeof window !== 'undefined' && ('ontouchstart' in window || (navigator?.maxTouchPoints || 0) > 0),
    [],
  );
  const useDesktopStakeSplit = useMemo(() => !isTouchDevice, [isTouchDevice]);
  const isZoomCompactView = useMemo(
    () => viewport.width <= 1200 || viewport.height <= 700,
    [viewport.height, viewport.width],
  );
  const inputNumberDisplay = useMemo(
    () => (activeInputIndex === 0 ? `${inputNumber || ''} |` : inputNumber),
    [activeInputIndex, inputNumber],
  );
  const rangeFromDisplay = useMemo(
    () => (activeInputIndex === 1 ? `${rangeFrom || ''} |` : rangeFrom),
    [activeInputIndex, rangeFrom],
  );
  const rangeToDisplay = useMemo(
    () => (activeInputIndex === 2 ? `${rangeTo || ''} |` : rangeTo),
    [activeInputIndex, rangeTo],
  );
  const qtyDisplay = useMemo(
    () => (activeInputIndex === 3 ? `${qty || ''} |` : qty),
    [activeInputIndex, qty],
  );
  const keypadCenterDisplay = useMemo(() => {
    if (activeInputIndex === -1) return String(pointValue);
    if (activeInputIndex === 1) return rangeFromDisplay || '0';
    if (activeInputIndex === 2) return rangeToDisplay || '0';
    if (activeInputIndex === 3) return qtyDisplay || '0';
    return inputNumberDisplay || '0';
  }, [activeInputIndex, inputNumberDisplay, pointValue, qtyDisplay, rangeFromDisplay, rangeToDisplay]);

  const applyFreshResult = useCallback((newResult) => {
    setResults(newResult);
    setResultUpdatedAt(Date.now());
  }, []);

  const refreshLastDrawResult = useCallback(async () => {
    try {
      const dayKey = toIstDayKey(new Date());
      const j = await getQuizSlotResultsForDate(dayKey, 1, '3d');
      const slots = Array.isArray(j?.data?.slots) ? j.data.slots : [];
      const slot = slots[0];
      if (!slot?.results) return;
      setLastDrawResult({
        slotStartIso: slot.slotStartIso,
        timeLabel: slot.timeLabel || '-',
        A: deriveThreeDigitSetValue(slot.results, PANEL_QUIZ_IDS.A),
        B: deriveThreeDigitSetValue(slot.results, PANEL_QUIZ_IDS.B),
        C: deriveThreeDigitSetValue(slot.results, PANEL_QUIZ_IDS.C),
      });
    } catch (_) {
      // optional
    }
  }, []);

  const computeSlotStartIsoFromSettleAtMs = useCallback((settleAtMs) => {
    const end = new Date(Number(settleAtMs) || 0);
    if (!Number.isFinite(end.getTime()) || end.getTime() <= 0) return null;
    const startMs = end.getTime() - (GAME_INTERVAL_SECONDS * 1000);
    const start = new Date(startMs);
    start.setSeconds(0, 0);
    return start.toISOString();
  }, []);

  const toPanelDigits = useCallback((threeDigit) => {
    const s = String(threeDigit ?? '').replace(/\D/g, '').padStart(3, '0').slice(-3);
    if (s.length !== 3) return null;
    const out = s.split('').map((d) => Number(d));
    return out.every((n) => Number.isInteger(n) && n >= 0 && n <= 9) ? out : null;
  }, []);

  const getBackendResultsForSlotStartIso = useCallback(async (slotStartIso) => {
    const key = String(slotStartIso || '').trim();
    if (!key) return null;
    if (backendResultCacheRef.current.has(key)) return backendResultCacheRef.current.get(key) || null;

    try {
      const dayKey = toIstDayKey(new Date(key));
      const j = await getQuizSlotResultsForDate(dayKey, 96, '3d');
      const slots = Array.isArray(j?.data?.slots) ? j.data.slots : [];
      const slot = slots.find((s) => String(s?.slotStartIso || '') === key);
      if (!slot?.results) {
        backendResultCacheRef.current.set(key, null);
        return null;
      }
      const A3 = deriveThreeDigitSetValue(slot.results, PANEL_QUIZ_IDS.A);
      const B3 = deriveThreeDigitSetValue(slot.results, PANEL_QUIZ_IDS.B);
      const C3 = deriveThreeDigitSetValue(slot.results, PANEL_QUIZ_IDS.C);
      const A = toPanelDigits(A3);
      const B = toPanelDigits(B3);
      const C = toPanelDigits(C3);
      const resolved = A && B && C ? { A, B, C } : null;
      backendResultCacheRef.current.set(key, resolved);
      return resolved;
    } catch (_) {
      backendResultCacheRef.current.set(key, null);
      return null;
    }
  }, [toPanelDigits]);

  const runClockTick = useCallback(() => {
    const current = new Date();
    const meta = getSlotMeta(current);
    setNow(current);
    setTimerSeconds(meta.remainingSeconds);
    setNextDrawAt(meta.nextDraw);
    if (slotRef.current !== meta.slotKey) {
      slotRef.current = meta.slotKey;
      applyFreshResult(generate3DResult());
      refreshLastDrawResult();
    }
  }, [applyFreshResult, refreshLastDrawResult]);

  useEffect(() => {
    runClockTick();
    const id = setInterval(runClockTick, 1000);
    return () => clearInterval(id);
  }, [runClockTick]);

  useEffect(() => {
    refreshLastDrawResult();
  }, [refreshLastDrawResult]);

  useEffect(() => {
    const onResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const checkMobilePortrait = () => {
      const isMobile = window.innerWidth <= 900;
      const isPortrait = window.innerHeight > window.innerWidth;
      setShowRotatePrompt(isMobile && isPortrait);
      if (isMobile && !isPortrait && !document.fullscreenElement) {
        const nowMs = Date.now();
        if (nowMs - lastLandscapeAutoFsAttemptRef.current > 1200) {
          lastLandscapeAutoFsAttemptRef.current = nowMs;
          const root = document.documentElement;
          if (root.requestFullscreen) {
            root.requestFullscreen().catch(() => {
              // Some browsers require explicit user action.
            });
          }
        }
      }
    };
    checkMobilePortrait();
    window.addEventListener('resize', checkMobilePortrait);
    window.addEventListener('orientationchange', checkMobilePortrait);
    return () => {
      window.removeEventListener('resize', checkMobilePortrait);
      window.removeEventListener('orientationchange', checkMobilePortrait);
    };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 1800);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!advanceSelectionNotice) return undefined;
    const t = setTimeout(() => setAdvanceSelectionNotice(''), 1400);
    return () => clearTimeout(t);
  }, [advanceSelectionNotice]);

  useEffect(() => {
    if (!isResultModalOpen || !resultFilterKey) return undefined;
    let cancelled = false;
    const loadResults = async () => {
      setResultLoading(true);
      setResultError('');
      try {
        const j = await getQuizSlotResultsForDate(resultFilterKey, undefined, '3d');
        if (!cancelled && j.success && j.data) {
          setResultSlots(Array.isArray(j.data.slots) ? j.data.slots : []);
        }
      } catch (e) {
        if (!cancelled) {
          setResultSlots([]);
          setResultError(e.message || 'Failed to load result history.');
        }
      } finally {
        if (!cancelled) setResultLoading(false);
      }
    };
    loadResults();
    return () => {
      cancelled = true;
    };
  }, [isResultModalOpen, resultFilterKey]);

  useEffect(() => {
    if (!bets.length) return undefined;
    const t = setTimeout(() => {
      setBets((prev) => prev.map((bet) => (bet.justAdded ? { ...bet, justAdded: false } : bet)));
    }, 550);
    return () => clearTimeout(t);
  }, [bets]);

  const currentTimeText = useMemo(
    () =>
      new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
        .format(now)
        .replace(/\s?(am|pm)$/i, (m) => ` ${m.trim().toUpperCase()}`),
    [now],
  );
  const resultModalRows = useMemo(() => {
    return (resultSlots || []).map((slot) => {
      return {
        id: slot?.slotStartIso || `${slot?.timeLabel || 'slot'}-abc`,
        time: slot?.timeLabel || '-',
        A: deriveThreeDigitSetValue(slot?.results, PANEL_QUIZ_IDS.A),
        B: deriveThreeDigitSetValue(slot?.results, PANEL_QUIZ_IDS.B),
        C: deriveThreeDigitSetValue(slot?.results, PANEL_QUIZ_IDS.C),
      };
    });
  }, [resultSlots]);

  const timeToDrawText = useMemo(
    () =>
      new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
        .format(nextDrawAt)
        .replace(/\s?(am|pm)$/i, (m) => ` ${m.trim().toUpperCase()}`),
    [nextDrawAt],
  );
  const formatAdvanceSlotLabel = useCallback((iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
      .format(d)
      .replace(/\s?(am|pm)$/i, (m) => ` ${m.trim().toUpperCase()}`);
  }, []);
  const advanceDrawSlots = useMemo(() => {
    const baseMs = new Date(nextDrawAt).getTime();
    if (!Number.isFinite(baseMs)) return [];
    return Array.from({ length: 47 }, (_, idx) => {
      const slotStartIso = new Date(baseMs + (idx * 15 * 60 * 1000)).toISOString();
      return { slotStartIso, label: formatAdvanceSlotLabel(slotStartIso) };
    });
  }, [formatAdvanceSlotLabel, nextDrawAt]);
  const generateGameId = useCallback(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    return `GM${y}${m}${day}${rand}`;
  }, []);
  const applyResultDateFilter = useCallback(() => {
    const day = String(resultDateDay || '').replace(/\D/g, '').padStart(2, '0').slice(-2);
    const month = String(resultDateMonth || '').replace(/\D/g, '').padStart(2, '0').slice(-2);
    const year = String(resultDateYear || '').replace(/\D/g, '').padStart(4, '0').slice(-4);
    setResultDateDay(day);
    setResultDateMonth(month);
    setResultDateYear(year);
    setResultFilterKey(`${year}-${month}-${day}`);
  }, [resultDateDay, resultDateMonth, resultDateYear]);

  const getTicketSettleAtMs = useCallback((ticket) => {
    const direct = Number(ticket?.settleAtMs);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const createdAtMs = new Date(ticket?.createdAt || ticket?.id || 0).getTime();
    if (Number.isFinite(createdAtMs) && createdAtMs > 0) {
      return createdAtMs + (GAME_INTERVAL_SECONDS * 1000);
    }
    return 0;
  }, []);

  const resolveKeypadTargetIndex = useCallback(() => {
    const focusedIndex =
      document.activeElement === rangeFromRef.current ? 1
      : document.activeElement === rangeToRef.current ? 2
      : document.activeElement === qtyRef.current ? 3
      : document.activeElement === inputNumberRef.current ? 0
      : activeInputIndex;

    // Range flow: behave like add-number keypad flow, fill FROM then TO automatically.
    if (focusedIndex === 1 || focusedIndex === 2 || ((activeInputIndex === 1 || activeInputIndex === 2) && focusedIndex !== 3)) {
      return String(rangeFrom || '').length < 3 ? 1 : 2;
    }
    return focusedIndex;
  }, [activeInputIndex, rangeFrom]);

  const handleDigitInput = useCallback((digit) => {
    const focusedIndex = resolveKeypadTargetIndex();
    const appendDigit = (value) => `${String(value || '')}${digit}`.replace(/\D/g, '').slice(0, 3);
    const appendPointDigit = (value) => {
      const base = String(value ?? '0').replace(/\D/g, '');
      const next = base === '0' ? digit : `${base}${digit}`.slice(0, 4);
      return next || '0';
    };
    // Points should change only when the points box is active.
    if (focusedIndex === -1) {
      setPoints((prev) => appendPointDigit(prev));
    } else if (focusedIndex === 0) {
      setInputNumber((prev) => appendDigit(prev));
    } else if (focusedIndex === 1) setRangeFrom((prev) => appendDigit(prev));
    else if (focusedIndex === 2) setRangeTo((prev) => appendDigit(prev));
    else if (focusedIndex === 3) setQty((prev) => appendDigit(prev));
    else {
      setInputNumber((prev) => appendDigit(prev));
    }
    if (validationMsg) setValidationMsg('');
  }, [resolveKeypadTargetIndex, validationMsg]);

  const handleAdjustFocusedValue = useCallback((delta) => {
    const focusedIndex = activeInputIndex;
    const step = Number(delta) || 0;
    const adjust = (value) => {
      const current = parseInt(String(value || '').replace(/\D/g, ''), 10);
      const base = Number.isFinite(current) ? current : 0;
      const next = Math.max(0, Math.min(999, base + step));
      return String(next);
    };

    if (focusedIndex === -1) {
      setPoints((prev) => adjust(prev));
    } else if (focusedIndex === 0) {
      setInputNumber((prev) => adjust(prev));
    } else if (focusedIndex === 1) {
      setRangeFrom((prev) => adjust(prev));
    } else if (focusedIndex === 2) {
      setRangeTo((prev) => adjust(prev));
    } else if (focusedIndex === 3) {
      setQty((prev) => adjust(prev));
    } else {
      setInputNumber((prev) => adjust(prev));
      setActiveInputIndex(0);
    }

    if (validationMsg) setValidationMsg('');
  }, [activeInputIndex, validationMsg]);

  const toggleMode = useCallback((mode) => {
    setSelectedModes((prev) => {
      if (mode === 'all') {
        return prev.includes('all') ? [] : ['all', ...ALL_SHORTCUT_MODES];
      }

      const next = prev.includes(mode)
        ? prev.filter((m) => m !== mode && m !== 'all')
        : [...prev.filter((m) => m !== 'all'), mode];

      const hasEveryShortcutMode = ALL_SHORTCUT_MODES.every((m) => next.includes(m));
      return hasEveryShortcutMode ? ['all', ...next] : next;
    });
    if (validationMsg) setValidationMsg('');
  }, [validationMsg]);

  const togglePanel = useCallback((panel) => {
    setSelectedPanels((prev) => {
      if (prev.includes(panel)) return prev.filter((x) => x !== panel);
      return [...prev, panel];
    });
  }, []);

  const toggleDigit = useCallback((digit) => {
    setSelectedDigits((prev) => {
      if (prev.includes(digit)) return prev.filter((x) => x !== digit);
      return [...prev, digit];
    });
  }, []);

  const handleToggleAllDigits = useCallback(() => {
    setSelectedDigits((prev) => (prev.length === DIGIT_OPTIONS.length ? [] : [...DIGIT_OPTIONS]));
  }, []);

  const validateByMode = useCallback((number, mode) => {
    const uniqueCount = new Set(number.split('')).size;
    if (mode === 'sp') return uniqueCount === 3;
    if (mode === 'duplicates') return uniqueCount === 2;
    if (mode === 'triples') return uniqueCount === 1;
    return true;
  }, []);

  const getNormalizedSelectedModes = useCallback(() => {
    const normalizedModes = selectedModes
      .map((m) => String(m || '').toLowerCase().trim())
      .filter(Boolean)
      .map((m) => (m === 'all' ? 'single' : m))
      .map((m) => (m === 'dp' ? 'duplicates' : m))
      .map((m) => (m === 'tp' ? 'triples' : m))
      .filter((m) => VALID_MODES.has(m));
    return Array.from(new Set(normalizedModes));
  }, [selectedModes]);

  const toThreeDigit = useCallback((n) => String(n).replace(/\D/g, '').slice(-3).padStart(3, '0'), []);
  const toSpCycleValue = useCallback((threeDigit) => {
    const digits = String(threeDigit || '').replace(/\D/g, '').slice(-3).padStart(3, '0');
    return String(10 + Number(digits[2]));
  }, []);
  const normalizeNumberForMode = useCallback((num, modeRaw) => {
    const mode = String(modeRaw || '').toLowerCase();
    if (mode === 'sp') return toSpCycleValue(num);
    return num;
  }, [toSpCycleValue]);

  const generateRangeNumbers = useCallback((fromStr, toStr) => {
    const from = Number(fromStr);
    const to = Number(toStr);
    if (!Number.isInteger(from) || !Number.isInteger(to)) return { ok: false, error: 'Range values must be numeric.' };
    if (from < 0 || to > 999) return { ok: false, error: 'Range must be between 000 and 999.' };
    if (from >= to) return { ok: false, error: 'Invalid range: From must be less than To.' };
    const count = to - from + 1;
    if (count > 1000) return { ok: false, error: 'Range limit exceeded (max 1000 numbers).' };
    const nums = Array.from({ length: count }, (_, i) => toThreeDigit(from + i));
    return { ok: true, nums };
  }, [toThreeDigit]);

  const getUniquePermutations = useCallback((numStr) => {
    const chars = numStr.split('');
    const seen = new Set();
    const out = [];
    const permute = (arr, l) => {
      if (l === arr.length - 1) {
        const s = arr.join('');
        if (!seen.has(s)) {
          seen.add(s);
          out.push(s);
        }
        return;
      }
      for (let i = l; i < arr.length; i += 1) {
        [arr[l], arr[i]] = [arr[i], arr[l]];
        permute(arr, l + 1);
        [arr[l], arr[i]] = [arr[i], arr[l]];
      }
    };
    permute([...chars], 0);
    return out;
  }, []);

  const generateLuckyPickNumbers = useCallback((qtyNum, typeRaw) => {
    const type = String(typeRaw || 'single').toLowerCase();
    if (!Number.isInteger(qtyNum) || qtyNum <= 0) return { ok: false, error: 'Qty must be greater than 0.' };
    if (qtyNum > 1000) return { ok: false, error: 'Qty limit exceeded (max 1000).' };

    const outSet = new Set();
    let attempts = 0;
    const maxAttempts = qtyNum * 50;
    while (outSet.size < qtyNum) {
      attempts += 1;
      if (attempts > maxAttempts) break;
      const base = toThreeDigit(Math.floor(Math.random() * 1000));
      if (type === 'box') {
        const perms = getUniquePermutations(base);
        // For box, pick one canonical representative to keep list compact.
        outSet.add(perms.sort()[0]);
      } else {
        const modeValidation = validateBetForMode(base, type);
        if (modeValidation.valid) outSet.add(base);
      }
    }
    if (outSet.size < qtyNum) {
      return { ok: false, error: `Could not generate ${qtyNum} unique numbers for selected L-Pick type.` };
    }
    return { ok: true, nums: Array.from(outSet) };
  }, [getUniquePermutations, toThreeDigit]);

  const addNumbersToBetState = useCallback((numbers, betTypes, pts, rateValue) => {
    const normalizedTypes = Array.isArray(betTypes) ? betTypes : [betTypes];
    const created = [];
    const skipped = [];
    const panelsToApply = selectedPanels.length ? selectedPanels : ['A', 'B', 'C'];
    numbers.forEach((num, idx) => {
      normalizedTypes.forEach((betType, tIdx) => {
        const betNumber = normalizeNumberForMode(num, betType);
        const modeValidation = validateBetForMode(betNumber, betType);
        if (!modeValidation.valid) {
          skipped.push(`${betNumber}:${betType}`);
          return;
        }
        panelsToApply.forEach((panel, pIdx) => {
          created.push({
            id: `${Date.now()}-${idx}-${tIdx}-${pIdx}-${betNumber}`,
            number: betNumber,
            mode: betType,
            points: pts,
            basePoints: pts,
            rate: rateValue,
            outcome: null,
            justAdded: true,
            panels: panel,
          });
        });
      });
    });
    if (created.length) {
      setBets((prev) => [...prev, ...created]);
    }
    return { createdCount: created.length, skippedCount: skipped.length };
  }, [bets, normalizeNumberForMode, selectedPanels]);

  const addBet = useCallback(() => {
    const cleanNum = (inputNumber || '').trim();
    const pts = Number(selectedRate) > 0 ? Number(selectedRate) : pointValue;
    const selectedBetTypes = getNormalizedSelectedModes();
    const resetPrimaryInputs = () => {
      setInputNumber('');
      setPoints('0');
    };

    console.debug('[3D addBet] snapshot', { inputNumber, rangeFrom, rangeTo, qty, lPickType, points, selectedModes, selectedPanels, selectedRate });

    if (!Number.isFinite(pts) || pts <= 0) {
      setValidationMsg('Points must be greater than 0.');
      resetPrimaryInputs();
      return;
    }
    if (!selectedBetTypes.length) {
      setValidationMsg('Please select at least one mode.');
      resetPrimaryInputs();
      return;
    }
    if ((rangeFrom && !rangeTo) || (!rangeFrom && rangeTo)) {
      setValidationMsg('Please enter complete range (FROM and TO).');
      resetPrimaryInputs();
      return;
    }

    // Priority: Range -> Lucky Pick -> Single number.
    if (rangeFrom && rangeTo) {
      const r = generateRangeNumbers(rangeFrom, rangeTo);
      if (!r.ok) {
        setValidationMsg(r.error);
        resetPrimaryInputs();
        return;
      }
      const result = addNumbersToBetState(r.nums, selectedBetTypes, pts, selectedRate);
      if (!result.createdCount) {
        setValidationMsg('No valid numbers/modes generated from selected range.');
        resetPrimaryInputs();
        return;
      }
      setValidationMsg(result.skippedCount ? `${result.skippedCount} duplicate numbers skipped.` : '');
      setToast('Range numbers added');
      setInputNumber('');
      setPoints('0');
      setRangeFrom('');
      setRangeTo('');
      return;
    }

    if (qty) {
      const lType = String(lPickType || 'single').toLowerCase();
      const r = generateLuckyPickNumbers(Number(qty), lType);
      if (!r.ok) {
        setValidationMsg(r.error);
        resetPrimaryInputs();
        return;
      }
      const result = addNumbersToBetState(r.nums, [lType], pts, selectedRate);
      setValidationMsg(result.skippedCount ? `${result.skippedCount} duplicate numbers skipped.` : '');
      setToast('Lucky pick numbers added');
      setInputNumber('');
      setPoints('0');
      setQty('');
      return;
    }

    if (!/^\d{1,3}$/.test(cleanNum)) {
      setValidationMsg('Please enter a valid number (000-999).');
      resetPrimaryInputs();
      return;
    }
    const singleNum = toThreeDigit(cleanNum);
    const atLeastOneValidMode = selectedBetTypes.some((t) => {
      const candidate = normalizeNumberForMode(singleNum, t);
      return validateBetForMode(candidate, t).valid;
    });
    if (!atLeastOneValidMode) {
      const firstCandidate = normalizeNumberForMode(singleNum, selectedBetTypes[0]);
      const firstReason = validateBetForMode(firstCandidate, selectedBetTypes[0]).reason || 'Selected mode is not valid for this number.';
      setValidationMsg(firstReason);
      resetPrimaryInputs();
      return;
    }
    const result = addNumbersToBetState([singleNum], selectedBetTypes, pts, selectedRate);
    if (!result.createdCount) {
      setValidationMsg('Duplicate entry blocked.');
      resetPrimaryInputs();
      return;
    }
    setInputNumber('');
    setPoints('0');
    setRangeFrom('');
    setValidationMsg('');
    setToast('Bet Added Successfully');
  }, [
    inputNumber,
    pointValue,
    selectedRate,
    selectedModes,
    rangeFrom,
    rangeTo,
    qty,
    lPickType,
    selectedRate,
    getNormalizedSelectedModes,
    generateRangeNumbers,
    generateLuckyPickNumbers,
    addNumbersToBetState,
    normalizeNumberForMode,
    toThreeDigit,
  ]);

  useEffect(() => {
    if (autoAddTimerRef.current) {
      clearTimeout(autoAddTimerRef.current);
      autoAddTimerRef.current = null;
    }

    const isSingleThreeDigits = /^\d{3}$/.test(inputNumber || '');
    const isRangeFromThreeDigits = /^\d{3}$/.test(rangeFrom || '');
    const isRangeToThreeDigits = /^\d{3}$/.test(rangeTo || '');
    const isRangeComplete = isRangeFromThreeDigits && isRangeToThreeDigits;
    const isPrimaryInputFlow = !rangeFrom && !rangeTo && !qty;

    if (isSingleThreeDigits && isPrimaryInputFlow && !autoAddLockRef.current) {
      autoAddLockRef.current = true;
      addBet();
      return;
    }
    if (!isSingleThreeDigits) {
      autoAddLockRef.current = false;
    }

    if (isRangeComplete) {
      const rangeKey = `${rangeFrom}-${rangeTo}`;
      if (autoRangeAddLockRef.current !== rangeKey) {
        autoRangeAddLockRef.current = rangeKey;
        addBet();
      }
      return;
    }
    autoRangeAddLockRef.current = '';
  }, [activeInputIndex, addBet, inputNumber, qty, rangeFrom, rangeTo]);

  useEffect(() => () => {
    if (autoAddTimerRef.current) {
      clearTimeout(autoAddTimerRef.current);
      autoAddTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const isRangeFromComplete = /^\d{3}$/.test(rangeFrom || '');
    if (isRangeFromComplete && !rangeAutoNextLockRef.current) {
      rangeAutoNextLockRef.current = true;
      setActiveInputIndex(2);
      if (rangeToRef.current) rangeToRef.current.focus();
      setPoints('0');
      return;
    }
    if (!isRangeFromComplete) {
      rangeAutoNextLockRef.current = false;
    }
  }, [rangeFrom]);

  const handleBuy = useCallback(async () => {
    if (isBuyingRef.current) return;
    if (!bets.length) {
      setValidationMsg('Add at least one bet before BUY.');
      return;
    }
    isBuyingRef.current = true;

    try {
    const investedAmount = Number(totalPoints);

    if (investedAmount <= 0) {
      setValidationMsg('Total points must be greater than 0.');
      return;
    }
    if ((Number(walletBalance) || 0) < investedAmount) {
      setValidationMsg('Insufficient balance');
      return;
    }

    // Persist 3D ticket lines to backend DB so admin history remains after refresh.
    const roundMap = new Map();
    for (const bet of bets) {
      const number = Number(String(bet?.number ?? '').replace(/\D/g, '').slice(-3));
      const amount = Number(bet?.points || 0);
      const mode = String(bet?.mode || 'str').trim().toLowerCase();
      if (!Number.isInteger(number) || number < 0 || number > 999) continue;
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const panelsRaw = String(bet?.panels || 'A').split(',').map((x) => x.trim()).filter(Boolean);
      const primaryPanel = panelsRaw.length ? panelsRaw[0] : 'A';
      const quizId = Number.isInteger(Number(selectedQuizId)) && Number(selectedQuizId) >= 1 && Number(selectedQuizId) <= 3
        ? Number(selectedQuizId)
        : panelToQuizId(primaryPanel);
      const roundKey = `${quizId}|${mode}`;
      if (!roundMap.has(roundKey)) {
        roundMap.set(roundKey, { quizId, mode, byNumber: new Map() });
      }
      const bucket = roundMap.get(roundKey);
      bucket.byNumber.set(number, (bucket.byNumber.get(number) || 0) + amount);
    }

    const rounds = [...roundMap.values()].map(({ quizId, mode, byNumber }) => ({
      quizId,
      bets: [...byNumber.entries()].map(([number, amount]) => ({ number, amount, betMode: mode })),
    })).filter((r) => r.bets.length > 0);

    if (!rounds.length) {
      setValidationMsg('No valid bets to save.');
      return;
    }

    const targetSlots = selectedAdvanceSlots.length
      ? [...selectedAdvanceSlots]
      : [new Date(nextDrawAt).toISOString()];
    const totalPerSlot = Number(investedAmount) || 0;
    const requiredBalance = totalPerSlot * targetSlots.length;
    if ((Number(walletBalance) || 0) < requiredBalance) {
      setValidationMsg(`Insufficient balance for ${targetSlots.length} slot(s). Need ₹${requiredBalance}.`);
      return;
    }

    let backendBalance = null;
    try {
      for (const slotStartIso of targetSlots) {
        // eslint-disable-next-line no-await-in-loop
        const saved = await postQuizBetsBatch(rounds, '3d', { slotStartIso });
        const b = Number(saved?.data?.balance);
        if (Number.isFinite(b)) backendBalance = b;
      }
    } catch (e) {
      setValidationMsg(e?.message || 'Failed to save bet in database.');
      return;
    }

    const drawDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (backendBalance != null) {
      updateUserBalance(backendBalance);
      setWalletBalance(backendBalance);
    } else {
      refreshWalletBalance();
    }

    hasSettledRef.current = false;
    const pendingBets = bets.map((bet) => ({
      ...bet,
      outcome: 'pending',
      matchedPanel: null,
      matchedResult: null,
      matchReason: null,
      winAmount: 0,
      multiplier: 0,
      payoutLabel: null,
    }));
    const resolvedQuizId = Number.isInteger(Number(selectedQuizId)) && Number(selectedQuizId) > 0
      ? Number(selectedQuizId)
      : null;
    const createdTickets = targetSlots.map((slotStartIso, idx) => {
      const settleAtMs = new Date(slotStartIso).getTime() + (15 * 60 * 1000);
      const slotDate = new Date(slotStartIso);
      const slotDrawDate = `${slotDate.getFullYear()}-${String(slotDate.getMonth() + 1).padStart(2, '0')}-${String(slotDate.getDate()).padStart(2, '0')}`;
      const gameId = generateGameId();
      return {
        id: Date.now() + idx,
        userName: 'user',
        quizId: resolvedQuizId,
        drawTime: formatAdvanceSlotLabel(slotStartIso),
        drawDate: slotDrawDate || drawDate,
        gameId,
        slotKey: slotRef.current,
        settleAtMs: Number.isFinite(settleAtMs) ? settleAtMs : null,
        bets: pendingBets,
        totalPoints: investedAmount,
        totalWin: 0,
        outcome: 'pending',
        settled: false,
        isAdvanceDraw: selectedAdvanceSlots.length > 0,
        createdAt: new Date().toISOString(),
      };
    });
    setTicketHistory((prev) => [...createdTickets, ...prev].slice(0, 500));
    setLastTxnId(createdTickets[0]?.gameId || '');
    setLastPoints((Number(investedAmount) || 0) * targetSlots.length);
    setToast(targetSlots.length > 1 ? 'Advance draw bets scheduled successfully' : 'Bet placed successfully');
    if (targetSlots.length > 1) {
      setAdvanceBuySuccess({
        slotCount: targetSlots.length,
        totalPoints: (Number(investedAmount) || 0) * targetSlots.length,
        perSlotPoints: Number(investedAmount) || 0,
        slots: targetSlots.map((slotStartIso) => formatAdvanceSlotLabel(slotStartIso)),
      });
    } else {
      setAdvanceBuySuccess(null);
    }
    setBuySummary(null);
    setValidationMsg(
      targetSlots.length > 1
        ? `Status: pending. Scheduled for ${targetSlots.length} future slots.`
        : 'Status: pending. Result will be shown after draw time.',
    );
    setBets([]);
    setSelectedAdvanceSlots([]);
    } finally {
      isBuyingRef.current = false;
    }
  }, [bets, formatAdvanceSlotLabel, generateGameId, nextDrawAt, now, refreshWalletBalance, selectedAdvanceSlots, selectedQuizId, totalPoints, walletBalance]);

  const handleCancelPendingTicket = useCallback(() => {
    const nowMs = Date.now();
    const cancellable = (ticketHistory || []).find((ticket) => {
      if (ticket?.settled) return false;
      const settleAtMs = getTicketSettleAtMs(ticket);
      return settleAtMs > nowMs;
    });

    if (!cancellable) {
      setToast('No active ticket to cancel before draw time.');
      return;
    }

    const refundAmount = Number(cancellable?.totalPoints || 0);
    const ticketLabel = cancellable?.gameId || String(cancellable?.id || '');
    const ok = window.confirm(`Cancel ticket ${ticketLabel} before draw and refund ₹${refundAmount}?`);
    if (!ok) return;

    setTicketHistory((prev) => prev.map((ticket) => {
      if (ticket?.id !== cancellable.id) return ticket;
      return {
        ...ticket,
        bets: (ticket?.bets || []).map((bet) => ({
          ...bet,
          outcome: 'cancelled',
          winAmount: 0,
          matchedPanel: '-',
          matchedResult: '-',
          matchReason: 'Cancelled before draw',
          payoutLabel: null,
        })),
        totalWin: 0,
        outcome: 'cancelled',
        settled: true,
        cancelledAt: new Date().toISOString(),
        settledAt: new Date().toISOString(),
      };
    }));

    if (refundAmount > 0) {
      setWalletBalance((prev) => {
        const next = (Number(prev) || 0) + refundAmount;
        updateUserBalance(next);
        return next;
      });
    }

    setToast('Ticket cancelled');
    setValidationMsg(`Ticket ${ticketLabel} cancelled. Refund ₹${refundAmount} credited.`);
  }, [getTicketSettleAtMs, ticketHistory]);

  useEffect(() => {
    if (!resultUpdatedAt) return;
    const nowMs = now.getTime();
    const pendingTickets = ticketHistory.filter((ticket) => !ticket?.settled);
    if (!pendingTickets.length) return;
    const eligibleTickets = pendingTickets.filter((ticket) => nowMs >= getTicketSettleAtMs(ticket));
    if (!eligibleTickets.length) return;

    let cancelled = false;
    (async () => {
      let settledCount = 0;
      let totalWinCredit = 0;
      let totalInvested = 0;

      const nextHistory = [];
      for (const ticket of ticketHistory) {
        if (ticket?.settled) {
          nextHistory.push(ticket);
          continue;
        }
        const settleAtMs = getTicketSettleAtMs(ticket);
        if (!settleAtMs || nowMs < settleAtMs) {
          nextHistory.push(ticket);
          continue;
        }

        const slotStartIso = computeSlotStartIsoFromSettleAtMs(settleAtMs);
        const backendPanels = slotStartIso ? await getBackendResultsForSlotStartIso(slotStartIso) : null;
        // Settle only on official backend result; if unavailable, keep ticket pending and retry.
        if (!backendPanels) {
          nextHistory.push(ticket);
          continue;
        }
        const settledBets = settleAllBets(ticket?.bets || [], backendPanels);
        const summary = calculateSettlementSummary(settledBets);
        const invested = Number(summary.totalInvested ?? summary.totalPoints ?? ticket?.totalPoints ?? 0);
        const wonAmount = Number(summary.totalWinAmount || 0);
        const outcome = wonAmount > 0 ? 'win' : 'loss';

        settledCount += 1;
        totalWinCredit += wonAmount;
        totalInvested += invested;

        nextHistory.push({
          ...ticket,
          bets: settledBets,
          totalPoints: invested,
          totalWin: wonAmount,
          outcome,
          settled: true,
          settledAt: new Date().toISOString(),
          settledUsing: 'backend',
        });
      }

      if (cancelled || !settledCount) return;

      if (totalWinCredit > 0) {
        setWalletBalance((prev) => {
          const next = (Number(prev) || 0) + totalWinCredit;
          updateUserBalance(next);
          return next;
        });
        setValidationMsg(`You won ₹${totalWinCredit}`);
      } else {
        setValidationMsg(`You lost ₹${totalInvested}`);
      }

      setTicketHistory(nextHistory);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    calculateSettlementSummary,
    computeSlotStartIsoFromSettleAtMs,
    getBackendResultsForSlotStartIso,
    getTicketSettleAtMs,
    now,
    pushWalletHistory,
    resultUpdatedAt,
    settleAllBets,
    ticketHistory,
  ]);

  const handleClearAll = useCallback(() => {
    setBets([]);
    setInputNumber('');
    setPoints('0');
    setSelectedModes(['box']);
    setSelectedRate(10);
    setSelectedPanels(['A']);
    setSelectedDigits([]);
    setRangeFrom('');
    setRangeTo('');
    setLPickType('box');
    setQty('');
    setValidationMsg('');
    setToast('');
    setBuySummary(null);
    setActiveInputIndex(0);
  }, []);
  const handleRemoveBet = useCallback((betId) => {
    setBets((prev) => prev.filter((x) => x.id !== betId));
  }, []);

  const handleAdvance = useCallback(() => {
    setIsAdvanceDrawOpen(true);
  }, []);

  const handleRotateLandscape = useCallback(async () => {
    try {
      const root = document.documentElement;
      if (root.requestFullscreen && !document.fullscreenElement) {
        await root.requestFullscreen();
      }
      if (window.screen?.orientation?.lock) {
        await window.screen.orientation.lock('landscape');
      }
    } catch (_) {
      // On many mobile browsers this requires user/system support.
    }
  }, []);

  const handleHeaderAction = useCallback(async (label) => {
    if (label.toLowerCase() === 'result') {
      const d = new Date(now);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = String(d.getFullYear());
      setResultDateDay(day);
      setResultDateMonth(month);
      setResultDateYear(year);
      setResultFilterKey(`${year}-${month}-${day}`);
      setIsResultModalOpen(true);
      return;
    }
    if (label.toLowerCase() === 'quiz') {
      // Keep mobile in landscape while moving from 3D board to 3D quiz.
      handleRotateLandscape();
      navigate('/lottery/3d/quiz');
      return;
    }
    if (label.toLowerCase() === 'refresh') {
      window.location.reload();
      return;
    }
    if (label.toLowerCase() === 'ticket list') {
      setIsTicketListOpen(true);
      setIsHistoryListOpen(false);
      return;
    }
    if (label.toLowerCase() === 'history') {
      setIsHistoryListOpen(true);
      setIsTicketListOpen(false);
      loadBackendHistoryTickets();
      return;
    }
    if (label.toLowerCase() === 'account') {
      setIsAccountModalOpen(true);
      return;
    }
    if (label.toLowerCase() === 'cancel bet') {
      handleCancelPendingTicket();
      return;
    }
    setToast(`${label} clicked`);
  }, [applyFreshResult, handleCancelPendingTicket, handleRotateLandscape, loadBackendHistoryTickets, navigate, now]);

  const handleGoHome = useCallback(async () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (_) {
      // Ignore if browser blocks exitFullscreen.
    }

    try {
      if (window.screen?.orientation?.unlock) {
        window.screen.orientation.unlock();
      }
      if (window.screen?.orientation?.lock) {
        await window.screen.orientation.lock('portrait');
      }
    } catch (_) {
      // Not supported on all mobile browsers/devices.
    }

    navigate('/');
  }, [navigate]);

  const handleMotorPick = useCallback(() => {
    const digitPool = selectedDigits.length ? [...selectedDigits] : [];
    if (!digitPool.length) {
      setValidationMsg('Select at least one digit for Motor.');
      return;
    }

    const selectedBetTypes = getNormalizedSelectedModes()
      .map((m) => String(m || '').toLowerCase());
    const wantsStrLike = selectedBetTypes.includes('single') || selectedBetTypes.includes('str');
    const wantsDuplicates = selectedBetTypes.includes('duplicates');
    const wantsTriples = selectedBetTypes.includes('triples');
    if (!wantsStrLike && !wantsDuplicates && !wantsTriples) {
      setValidationMsg('For Motor, select mode: SINGLE/STR, DUPLICATES, or TRIPLES.');
      return;
    }

    const allCombos = [];
    digitPool.forEach((a) => {
      digitPool.forEach((b) => {
        digitPool.forEach((c) => {
          allCombos.push(`${a}${b}${c}`);
        });
      });
    });
    const singleCombos = allCombos.filter((num) => new Set(num.split('')).size === 3);
    const duplicateCombos = allCombos.filter((num) => new Set(num.split('')).size === 2);
    const tripleCombos = allCombos.filter((num) => new Set(num.split('')).size === 1);
    const pts = Number(pointValue) > 0 ? Number(pointValue) : 10;

    const motorTasks = [];
    if (wantsStrLike) motorTasks.push({ mode: 'str', nums: singleCombos });
    if (wantsDuplicates) motorTasks.push({ mode: 'duplicates', nums: duplicateCombos });
    if (wantsTriples) motorTasks.push({ mode: 'triples', nums: tripleCombos });

    let createdCount = 0;
    let skippedCount = 0;
    motorTasks.forEach((task) => {
      const result = addNumbersToBetState(task.nums, [task.mode], pts, selectedRate);
      createdCount += result.createdCount;
      skippedCount += result.skippedCount;
    });

    if (!createdCount) {
      setValidationMsg('Motor could not add any bet with current selection.');
      return;
    }

    setValidationMsg(
      skippedCount ? `${createdCount} motor bets added. ${skippedCount} skipped.` : '',
    );
    setToast(`Motor added ${createdCount} bets`);
    setInputNumber('');
    setRangeFrom('');
    setRangeTo('');
    setQty('');
    setPoints('0');
  }, [addNumbersToBetState, getNormalizedSelectedModes, pointValue, selectedDigits, selectedRate]);

  const handleLuckyPick = useCallback(() => {
    const randomCount = Math.random() < 0.5 ? 4 : 5;
    const numberSet = new Set();
    while (numberSet.size < randomCount) {
      numberSet.add(toThreeDigit(Math.floor(Math.random() * 1000)));
    }
    const randomDigitCount = Math.random() < 0.5 ? 4 : 5;
    const shuffledDigits = [...DIGIT_OPTIONS].sort(() => Math.random() - 0.5);
    const highlightedDigits = shuffledDigits.slice(0, randomDigitCount);
    setSelectedDigits(highlightedDigits);

    const selectedBetTypes = getNormalizedSelectedModes()
      .map((m) => String(m || '').toLowerCase())
      .filter((m) => ['single', 'str', 'box', 'sp', 'fp', 'bp', 'ap'].includes(m));
    const modePool = selectedBetTypes.length ? selectedBetTypes : ['box', 'str', 'sp', 'fp', 'bp', 'ap'];
    const pts = Number(pointValue) > 0 ? Number(pointValue) : 10;
    const randomNumbers = Array.from(numberSet);

    let createdCount = 0;
    let skippedCount = 0;
    randomNumbers.forEach((num) => {
      const randomMode = modePool[Math.floor(Math.random() * modePool.length)];
      const result = addNumbersToBetState([num], [randomMode], pts, selectedRate);
      createdCount += result.createdCount;
      skippedCount += result.skippedCount;
    });

    if (!createdCount) {
      setValidationMsg('Lucky pick generated duplicates only. Try again.');
      return;
    }
    setValidationMsg(
      skippedCount ? `${createdCount} lucky bets added. ${skippedCount} duplicates skipped.` : '',
    );
    setToast(`Lucky pick added ${createdCount} bets`);
    setInputNumber('');
    setRangeFrom('');
    setRangeTo('');
    setQty('');
    setPoints('0');
  }, [addNumbersToBetState, getNormalizedSelectedModes, pointValue, selectedRate, toThreeDigit]);

  const handleNextFromKeypad = useCallback(() => {
    const orderedInputs = [inputNumberRef.current, rangeFromRef.current, rangeToRef.current, qtyRef.current].filter(Boolean);
    if (!orderedInputs.length) return;
    if (activeInputIndex < orderedInputs.length - 1) {
      const nextIdx = activeInputIndex + 1;
      orderedInputs[nextIdx].focus();
      setActiveInputIndex(nextIdx);
      return;
    }
    orderedInputs[0].focus();
    setActiveInputIndex(0);
    if (canAddBet) addBet();
    else setValidationMsg('Please complete number, points and at least one mode.');
  }, [activeInputIndex, addBet, canAddBet]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-gradient-to-br from-[#0b1223] via-[#182a4a] to-[#1e3a5f]">
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          width: `${viewport.width}px`,
          height: `${viewport.height}px`,
        }}
      >
      <div
        className="absolute top-0 left-0"
        style={{
          width: `${BASE_WIDTH}px`,
          height: `${BASE_HEIGHT}px`,
          transform: `scale(${dashboardScaleX}, ${dashboardScaleY})`,
          transformOrigin: 'top left',
        }}
      >
        <div className="relative w-full h-full bg-[#f5f7fc] border border-[#dbe2f0] p-2 overflow-hidden grid grid-rows-[auto_auto_auto_minmax(0,1fr)] gap-3">
        {toast ? (
          <div
            className={`fixed z-50 ${
              isBuySuccessToast ? 'inset-0 flex items-center justify-center bg-black/35 p-4' : 'top-4 right-4'
            }`}
          >
            <div
              className={`text-white font-semibold shadow-md ${
                isBuySuccessToast
                  ? 'rounded-2xl border border-emerald-300/60 bg-gradient-to-b from-emerald-500 to-emerald-700 px-10 py-7 text-[30px] font-extrabold tracking-wide shadow-[0_12px_36px_rgba(5,150,105,0.45)]'
                  : 'rounded-md bg-[#2ca44f] px-4 py-2 text-[14px]'
              }`}
            >
              {toast}
            </div>
          </div>
        ) : null}

        <div className="grid min-h-0 grid-cols-[minmax(0,11rem)_minmax(0,1fr)_minmax(0,5.5rem)] items-stretch gap-1 pb-0 sm:grid-cols-[minmax(0,12.5rem)_minmax(0,1fr)_minmax(0,6rem)] sm:gap-1.5">
          <div className="flex h-full min-h-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-amber-200/50 bg-gradient-to-br from-amber-50/95 via-white to-rose-50/30 px-2 py-1 text-center shadow-[0_4px_16px_rgba(15,23,42,0.07)] ring-1 ring-white/90 sm:px-2.5 sm:py-1.5">
            <div className="bg-gradient-to-r from-rose-700 via-red-600 to-rose-700 bg-clip-text text-[clamp(1.35rem,3.5vw,1.75rem)] font-extrabold leading-none tracking-tight text-transparent">
              3D Quiz
            </div>
            <div className="text-[16px] font-bold leading-tight text-slate-600 sm:text-[17px] md:text-[18px]">
              Last Draw:{' '}
              <span className="font-extrabold tabular-nums text-slate-900">{lastDrawResult?.timeLabel || '-'}</span>
            </div>
            <div className="text-[15px] font-bold leading-tight text-slate-700 sm:text-[16px] md:text-[17px]">
              Wallet: <span className="font-extrabold tabular-nums text-emerald-700">₹{formattedWalletBalance}</span>
            </div>
          </div>
          <div className="grid min-w-0 grid-cols-3 gap-1 sm:gap-1.5">
            <ResultPanel title="A" digits={topDisplayResults.A} isUpdated={isResultFresh} />
            <ResultPanel title="B" digits={topDisplayResults.B} isUpdated={isResultFresh} />
            <ResultPanel title="C" digits={topDisplayResults.C} isUpdated={isResultFresh} />
          </div>
          <button
            type="button"
            onClick={handleGoHome}
            className="inline-flex h-full min-h-0 items-center justify-center gap-1.5 rounded-lg border border-amber-200/40 bg-gradient-to-b from-amber-600 via-amber-800 to-amber-950 px-2.5 text-[16px] font-bold uppercase tracking-wide text-white shadow-[0_3px_12px_rgba(120,53,15,0.35)] ring-1 ring-amber-200/35 transition hover:brightness-110 active:scale-[0.99] sm:text-[17px]"
          >
            <House className="h-[18px] w-[18px] shrink-0 sm:h-5 sm:w-5" strokeWidth={2.5} aria-hidden />
            <span>Home</span>
          </button>
        </div>

        <div className="flex w-full min-h-0 items-center justify-center rounded-lg border border-[#8b9ab3] bg-[#dfe6f2] px-2 py-0.5">
          <div className="grid w-full min-w-0 grid-cols-7 gap-1 text-center min-h-0">
          <div className="min-w-0 rounded-md border border-[#8b9ab3] bg-gradient-to-b from-[#f2f6ff] to-[#e3ecff] flex min-h-[42px] flex-col justify-center gap-0.5 py-1 px-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <div className="text-[14px] uppercase tracking-wide text-[#4a5b86] font-semibold sm:text-[15px]">Time To Draw</div>
            <div className={`text-[22px] font-bold leading-none ${timerSeconds <= 10 ? 'text-[#d4372f] animate-pulse' : 'text-[#18233f]'}`}>{formatTimer(timerSeconds)}</div>
          </div>
          <div className="min-w-0 rounded-md border border-[#8b9ab3] bg-gradient-to-b from-[#f8f9ff] to-[#edf1ff] flex min-h-[42px] flex-col justify-center gap-0.5 py-1 px-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <div className="text-[14px] uppercase tracking-wide text-[#5e6787] font-semibold sm:text-[15px]">Dr.Time</div>
            <div className="text-[18px] font-semibold leading-none text-[#1f2a44] sm:text-[19px]">{timeToDrawText}</div>
          </div>
          <div className="min-w-0 rounded-md border border-[#8b9ab3] bg-gradient-to-b from-[#f6f8fc] to-[#ebeff7] flex min-h-[42px] flex-col justify-center gap-0.5 py-1 px-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <div className="text-[14px] uppercase tracking-wide text-[#636b7d] font-semibold sm:text-[15px]">Id</div>
            <div className="truncate text-[17px] font-semibold leading-none text-[#1f2738]" title={playerIdentity}>{playerIdentity}</div>
          </div>
          <div className="min-w-0 rounded-md border border-[#8b9ab3] bg-gradient-to-b from-[#f3f8ff] to-[#e7f0ff] flex min-h-[42px] flex-col justify-center gap-0.5 py-1 px-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <div className="text-[14px] uppercase tracking-wide text-[#5a6784] font-semibold sm:text-[15px]">Time</div>
            <div className="text-[17px] font-semibold leading-none text-[#1f2d46]">{currentTimeText}</div>
          </div>
          <div className="min-w-0 rounded-md border border-[#8b9ab3] bg-gradient-to-b from-[#f8f7ff] to-[#edeafc] flex min-h-[42px] flex-col justify-center gap-0.5 py-1 px-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <div className="text-[14px] uppercase tracking-wide text-[#6a6284] font-semibold sm:text-[15px]">Last Ticket</div>
            <div className={`text-[16px] font-bold leading-none sm:text-[17px] ${
              lastTicket?.outcome === 'win'
                ? 'text-[#15803d]'
                : lastTicket?.outcome === 'cancelled'
                  ? 'text-[#475569]'
                  : 'text-[#b91c1c]'
            }`}>
              {lastTicket ? lastTicket.outcome.toUpperCase() : '-'}
            </div>
          </div>
          <div className="min-w-0 rounded-md border border-[#8b9ab3] bg-gradient-to-b from-[#fff8f2] to-[#ffefe2] flex min-h-[42px] flex-col justify-center gap-0.5 py-1 px-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <div className="text-[14px] uppercase tracking-wide text-[#8a6950] font-semibold sm:text-[15px]">Last Trn</div>
            <div className="text-[15px] font-semibold leading-none text-[#3f2a1c] truncate sm:text-[16px]" title={lastTxnId}>{lastTxnId}</div>
          </div>
          <div className="min-w-0 rounded-md border border-[#8b9ab3] bg-gradient-to-b from-[#f2fbf5] to-[#e4f6e9] flex min-h-[42px] flex-col justify-center gap-0.5 py-1 px-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <div className="text-[14px] uppercase tracking-wide text-[#4e7760] font-semibold sm:text-[15px]">Last Win</div>
            <div className="text-[18px] font-semibold leading-none text-[#1f3a2b]">{lastWinAmount}</div>
          </div>
          </div>
        </div>

        <div className="w-full min-h-0 rounded-lg border border-[#d6c2a5] bg-[#fff7ec] px-2 py-2">
          <nav className="grid w-full grid-cols-7 gap-1" aria-label="Main menu">
            {HEADER_MENU_ITEMS.map(({ label, Icon }) => (
              <button
                key={label}
                type="button"
                onClick={() => handleHeaderAction(label)}
                className="inline-flex min-w-0 touch-manipulation items-center justify-center gap-2 rounded-lg border border-black bg-[#f7ecde] px-2.5 py-2.5 text-[18px] font-bold text-[#6b4423] transition-colors hover:bg-[#eedfc8] active:scale-[0.99] sm:text-[19px]"
              >
                <Icon className="h-5 w-5 shrink-0 sm:h-[20px] sm:w-[20px]" strokeWidth={2.25} aria-hidden />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div
          className={`w-full shrink-0 rounded-full overflow-hidden transition-all duration-300 ${
            timerSeconds <= TIMER_BAR_RED_MAX_SECONDS
              ? 'h-3 bg-[#fecdd3] shadow-[inset_0_0_0_1px_rgba(220,38,38,0.35)]'
              : 'h-2.5 bg-[#e8e8e8]'
          }`}
        >
          <div
            className={`h-full transition-all duration-700 ${
              timerSeconds <= TIMER_BAR_RED_MAX_SECONDS ? 'bg-[#d4372f]' : 'bg-[#2e59c6]'
            } ${timerSeconds <= 10 ? 'animate-pulse' : ''}`}
            style={{ width: `${Math.max(0, Math.min(100, (timerSeconds / GAME_INTERVAL_SECONDS) * 100))}%` }}
          />
        </div>

        <div className="flex h-full min-h-0 min-w-0 flex-col gap-2">
            <div className="w-full min-w-0 rounded-xl border border-[#d4b896] bg-gradient-to-br from-[#fffbeb] via-[#fef3c7] to-[#fde68a] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_1px_3px_rgba(180,130,40,0.12)]">
              <div className="flex w-full min-w-0 flex-nowrap items-center gap-2 overflow-x-auto pb-1">
                <label className={`inline-flex h-11 shrink-0 cursor-pointer select-none items-center gap-2 rounded-lg border px-3.5 text-[18px] font-semibold uppercase tracking-wide shadow-sm transition hover:brightness-110 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2 ${
                  selectedPanels.length === 3
                    ? 'border-[#475569] bg-[#334155] text-white has-[:focus-visible]:ring-[#64748b]'
                    : 'border-[#cbd5e1] bg-white text-[#334155] has-[:focus-visible]:ring-[#94a3b8]'
                }`}>
                  <input className="size-4 accent-white" type="checkbox" checked={selectedPanels.length === 3} onChange={() => setSelectedPanels(selectedPanels.length === 3 ? [] : [...PANEL_OPTIONS])} />
                  All
                </label>
                {PANEL_OPTIONS.map((panel) => (
                  <label
                    key={panel}
                    className={`inline-flex h-11 shrink-0 cursor-pointer select-none items-center gap-2 rounded-lg border px-3.5 text-[19px] font-bold shadow-sm transition hover:brightness-110 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2 ${
                      selectedPanels.includes(panel)
                        ? panel === 'A'
                          ? 'border-[#1d4ed8] bg-[#2563eb] text-white has-[:focus-visible]:ring-[#3b82f6]'
                          : panel === 'B'
                            ? 'border-[#b91c1c] bg-[#dc2626] text-white has-[:focus-visible]:ring-[#f87171]'
                            : 'border-[#047857] bg-[#059669] text-white has-[:focus-visible]:ring-[#34d399]'
                        : 'border-[#cbd5e1] bg-white text-[#334155] has-[:focus-visible]:ring-[#94a3b8]'
                    }`}
                  >
                    <input className="size-4 accent-white" type="checkbox" checked={selectedPanels.includes(panel)} onChange={() => togglePanel(panel)} />
                    {panel}
                  </label>
                ))}
                <span className="mx-1 h-7 w-px shrink-0 bg-[#c9a66b]/70" aria-hidden />
                <button
                  type="button"
                  onClick={handleToggleAllDigits}
                  className={`flex h-12 w-[5.25rem] shrink-0 items-center justify-center rounded-xl border-2 px-3 text-[18px] font-bold tracking-wide transition sm:h-[3.25rem] sm:w-[5.75rem] sm:text-[19px] ${
                    selectedDigits.length === DIGIT_OPTIONS.length
                      ? 'border-[#4f46e5] bg-[#4f46e5] text-white shadow-md'
                      : 'border-[#cbd5e1] bg-white text-[#334155] shadow-sm hover:border-[#94a3b8] hover:bg-[#f8fafc]'
                  }`}
                >
                  All
                </button>
                {DIGIT_OPTIONS.map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => toggleDigit(digit)}
                    className={`flex h-12 w-[4rem] shrink-0 items-center justify-center rounded-xl border-2 px-2 text-[24px] font-bold transition sm:h-[3.25rem] sm:w-[4.25rem] sm:text-[25px] ${
                      selectedDigits.includes(digit)
                        ? 'scale-[1.03] border-[#4f46e5] bg-[#4f46e5] text-white shadow-md'
                        : 'border-[#e2e8f0] bg-white text-[#334155] shadow-sm hover:border-[#94a3b8] hover:bg-[#f8fafc]'
                    }`}
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => navigate('/lottery')}
                  className="ml-auto shrink-0 rounded-lg border border-[#0f172a] bg-[#0f172a] px-4 py-2.5 text-[17px] font-bold tracking-wide text-white shadow-md transition hover:bg-[#1e293b] active:scale-[0.98] sm:text-[18px]"
                >
                  Go back to 2D game
                </button>
              </div>
            </div>

          <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[1fr_250px] gap-2 overflow-hidden">
          <div className="grid h-full max-h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
            <div className="overflow-hidden rounded-lg border border-[#d9d9d9] bg-white">
              <div className="flex min-w-0 flex-col sm:flex-row sm:items-stretch">
                <div className="flex min-w-0 w-full flex-[7] flex-nowrap items-stretch gap-1.5 overflow-x-auto bg-gradient-to-br from-[#dbeafe] to-[#e0f2fe] px-2 py-2.5 sm:min-w-0 sm:gap-2 sm:px-2.5 sm:py-3">
                  {MODE_GROUP_COMBO.map((mode) => (
                    <label
                      key={mode}
                      className={`flex min-w-[3.25rem] flex-1 basis-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-1 text-[17px] font-extrabold uppercase shadow-sm transition sm:min-w-0 sm:px-2 sm:text-[18px] md:text-[19px] ${
                        selectedModes.includes(mode)
                          ? 'h-12 min-h-12 border-[#1d4ed8] bg-[#2563eb] text-white'
                          : 'h-12 min-h-12 border-[#bfdbfe] bg-white/90 text-[#0f172a]'
                      }`}
                    >
                      <input type="checkbox" className="size-4 shrink-0 accent-[#2563eb]" checked={selectedModes.includes(mode)} onChange={() => toggleMode(mode)} />
                      <span className="truncate">{mode}</span>
                    </label>
                  ))}
                </div>
                <div className="h-px w-full shrink-0 bg-[#d1d5db] sm:h-auto sm:w-px sm:self-stretch" aria-hidden />
                <div className="flex min-w-0 w-full flex-[3] flex-nowrap items-stretch gap-1.5 overflow-x-auto bg-gradient-to-br from-[#d1fae5] to-[#ecfdf5] px-2 py-2.5 sm:min-w-0 sm:gap-2 sm:px-2.5 sm:py-3">
                  {MODE_GROUP_SPECIAL.map((mode) => (
                    <label
                      key={mode}
                      className={`flex h-12 min-h-12 cursor-pointer items-center justify-center gap-1 rounded-md border px-1 text-[14px] font-extrabold uppercase leading-tight shadow-sm transition sm:px-1.5 sm:text-[15px] md:text-[16px] ${
                        selectedModes.includes(mode)
                          ? 'border-[#059669] bg-[#059669] text-white'
                          : 'border-[#a7f3d0] bg-white/90 text-[#0f172a]'
                      } ${
                        mode === 'duplicates'
                          ? 'min-w-[9.5rem] shrink-0 flex-[1.65] basis-auto sm:min-w-[10.5rem] md:min-w-[11rem] md:text-[16px]'
                          : 'min-w-[4.75rem] flex-1 basis-0 sm:min-w-[5.25rem]'
                      }`}
                    >
                      <input type="checkbox" className="size-4 shrink-0 accent-[#059669]" checked={selectedModes.includes(mode)} onChange={() => toggleMode(mode)} />
                      <span className="whitespace-nowrap text-center">{mode}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className={`grid h-full min-h-0 min-w-0 gap-2 sm:gap-3 ${useDesktopStakeSplit ? 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : 'grid-cols-1 sm:grid-cols-2'}`}>
            <div className={`order-2 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-[#d9d9d9] bg-white ${isZoomCompactView ? 'p-2.5' : 'p-3 sm:p-4'}`}>
              <div className={`min-h-0 flex-1 overflow-y-auto pr-1 ${isZoomCompactView ? 'space-y-2' : 'space-y-3 sm:space-y-4'}`}>
              <header className={`space-y-1 border-b border-slate-200/80 ${isZoomCompactView ? 'pb-2' : 'pb-3'}`}>
                <h2 className={`bg-gradient-to-r from-indigo-700 via-blue-700 to-indigo-800 bg-clip-text font-extrabold leading-tight tracking-tight text-transparent ${isZoomCompactView ? 'text-[19px] sm:text-[20px]' : 'text-[20px] sm:text-[22px]'}`}>
                  Play &amp; stake — 3D Quiz
                </h2>
              </header>
              <div className={`rounded-xl border border-[#c5cdd9] bg-gradient-to-b from-[#f8fafc] to-[#f1f5f9] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.06)] ${isZoomCompactView ? 'p-2' : 'p-2.5 sm:p-3'}`}>
              {/* Line 1: ADD NUMBER + Range + NUM To NUM (single row, scroll if narrow) */}
              <div className="flex min-w-0 flex-nowrap items-center gap-x-2 overflow-x-auto sm:gap-x-3">
                <input
                  ref={inputNumberRef}
                  onFocus={() => setActiveInputIndex(0)}
                  onClick={() => {
                    setActiveInputIndex(0);
                    if (inputNumberRef.current) inputNumberRef.current.focus();
                  }}
                  onTouchStart={() => setActiveInputIndex(0)}
                  onPointerDown={() => setActiveInputIndex(0)}
                  value={inputNumberDisplay}
                  readOnly
                  inputMode="none"
                  onKeyDown={(e) => e.preventDefault()}
                  onPaste={(e) => e.preventDefault()}
                  onChange={(e) => {
                    const next = e.target.value.replace(/\D/g, '').slice(0, 3);
                    setInputNumber(next);
                    if (validationMsg) setValidationMsg('');
                  }}
                  placeholder="ADD NUMBER"
                  className="h-12 w-[min(12.5rem,40vw)] shrink-0 rounded-full border-2 border-[#2e59c6] px-3 text-center text-[18px] font-semibold tracking-wide sm:h-14 sm:w-[220px] sm:text-[20px]"
                />
                <span className="shrink-0 font-semibold text-[20px] text-[#1d2b4d] sm:text-[22px]">Range:</span>
                <input
                  ref={rangeFromRef}
                  onFocus={() => setActiveInputIndex(1)}
                  onClick={() => {
                    setActiveInputIndex(1);
                    if (rangeFromRef.current) rangeFromRef.current.focus();
                  }}
                  onTouchStart={() => setActiveInputIndex(1)}
                  onPointerDown={() => setActiveInputIndex(1)}
                  value={rangeFromDisplay}
                  readOnly
                  inputMode="none"
                  onKeyDown={(e) => e.preventDefault()}
                  onPaste={(e) => e.preventDefault()}
                  onChange={(e) => {
                    setActiveInputIndex(1);
                    const next = e.target.value.replace(/\D/g, '').slice(0, 3);
                    setRangeFrom(next);
                    if (validationMsg) setValidationMsg('');
                  }}
                  placeholder="NUM."
                  className="h-11 w-[5rem] shrink-0 rounded-full border border-[#d1d1d1] px-2 text-center text-[17px] sm:h-12 sm:w-[92px] sm:text-[18px]"
                />
                <span className="shrink-0 font-semibold text-[20px] text-[#1d2b4d] sm:text-[22px]">To</span>
                <input
                  ref={rangeToRef}
                  onFocus={() => setActiveInputIndex(2)}
                  onClick={() => {
                    setActiveInputIndex(2);
                    if (rangeToRef.current) rangeToRef.current.focus();
                  }}
                  onTouchStart={() => setActiveInputIndex(2)}
                  onPointerDown={() => setActiveInputIndex(2)}
                  value={rangeToDisplay}
                  readOnly
                  inputMode="none"
                  onKeyDown={(e) => e.preventDefault()}
                  onPaste={(e) => e.preventDefault()}
                  onChange={(e) => {
                    setActiveInputIndex(2);
                    setRangeTo(e.target.value.replace(/\D/g, '').slice(0, 3));
                  }}
                  placeholder="NUM."
                  className="h-11 w-[5rem] shrink-0 rounded-full border border-[#d1d1d1] px-2 text-center text-[17px] sm:h-12 sm:w-[92px] sm:text-[18px]"
                />
              </div>
              <div className={`${isZoomCompactView ? 'my-2' : 'my-2.5'} border-t border-[#d8dee9]`} aria-hidden />
              {/* Line 2: L-Pick + Qty + ADD */}
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                <span className="shrink-0 font-semibold text-[20px] text-[#1d2b4d] sm:text-[22px]">L-Pick:</span>
                <select
                  value={lPickType}
                  onChange={(e) => setLPickType(e.target.value)}
                  className="h-11 min-w-[8.5rem] rounded-full border border-[#d1d1d1] px-3 text-[17px] sm:h-12 sm:px-4 sm:text-[18px]"
                >
                  {LPICK_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt.toUpperCase()}
                    </option>
                  ))}
                </select>
                <span className="shrink-0 font-semibold text-[20px] text-[#1d2b4d] sm:text-[22px]">Qty</span>
                <input
                  ref={qtyRef}
                  onFocus={() => setActiveInputIndex(3)}
                  onClick={() => {
                    setActiveInputIndex(3);
                    if (qtyRef.current) qtyRef.current.focus();
                  }}
                  onTouchStart={() => setActiveInputIndex(3)}
                  onPointerDown={() => setActiveInputIndex(3)}
                  value={qtyDisplay}
                  readOnly
                  inputMode="none"
                  onKeyDown={(e) => e.preventDefault()}
                  onPaste={(e) => e.preventDefault()}
                  onChange={(e) => {
                    setActiveInputIndex(3);
                    setQty(e.target.value.replace(/\D/g, '').slice(0, 3));
                  }}
                  placeholder="Qty"
                  className="h-11 w-[5rem] shrink-0 rounded-full border border-[#d1d1d1] px-2 text-center text-[17px] sm:h-12 sm:w-[92px] sm:text-[18px]"
                />
                {qty ? (
                  <button
                    type="button"
                    onClick={addBet}
                    className="h-11 shrink-0 rounded-full border border-[#2e59c6] bg-white px-5 text-[17px] font-semibold text-[#2e59c6] sm:h-12 sm:px-6 sm:text-[18px]"
                  >
                    ADD
                  </button>
                ) : null}
              </div>
              </div>
              {/* Line 3: Rate — fixed grid (no scroller) */}
              <div className="min-w-0 rounded-lg bg-[#f8fafc] px-2 py-2.5 sm:px-3 sm:py-3">
                <span className="block font-semibold text-[20px] text-[#1d2b4d] sm:text-[22px]">Rate:</span>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5">
                  {RATE_OPTIONS.map((rate) => (
                    <label
                      key={rate}
                      className={`inline-flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border px-2.5 shadow-sm sm:h-10 sm:px-3 ${
                        selectedRate === rate
                          ? 'border-[#2563eb] bg-[#2563eb] text-white'
                          : 'border-[#cbd5e1] bg-white text-[#1e293b]'
                      }`}
                    >
                      <input type="radio" className="size-5 accent-[#2e59c6]" checked={selectedRate === rate} onChange={() => setSelectedRate(rate)} />
                      <span className="text-[20px] font-bold leading-none sm:text-[22px]">{rate}</span>
                    </label>
                  ))}
                </div>
              </div>
              </div>
              {validationMsg ? <div className="mt-1 shrink-0 text-[13px] font-semibold text-[#d4372f] sm:text-[14px]">{validationMsg}</div> : null}
            </div>

            <div className="order-1 flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border-2 border-[#d9d9d9] bg-white p-3">
              <BetCardsGrid
                bets={bets}
                visibleBetCards={visibleBetCards}
                hiddenBetCardCount={hiddenBetCardCount}
                getDisplayBetNumber={getDisplayBetNumber}
                onRemoveBet={handleRemoveBet}
              />
              <div className="w-full min-w-0 shrink-0 border-t border-[#e5e7eb] pt-2 mt-2">
                <div className={`w-full min-w-0 rounded-xl border border-[#c5cdd9] bg-gradient-to-b from-[#f8fafc] to-[#eef2f7] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_2px_10px_rgba(15,23,42,0.06)] ${isZoomCompactView ? 'p-2.5' : 'p-3 sm:p-4'}`}>
                  <div className={`flex w-full justify-end border-b border-slate-200/80 ${isZoomCompactView ? 'mb-2 pb-2' : 'mb-2.5 pb-2.5 sm:mb-3 sm:pb-3'}`}>
                    <div className={`font-bold leading-tight text-slate-600 ${isZoomCompactView ? 'text-[14px] sm:text-[16px]' : 'text-[16px] sm:text-[19px] md:text-[22px]'}`}>
                      Total Count:{' '}
                      <span className="tabular-nums text-[1.1em] font-extrabold text-slate-900">{bets.length}</span>
                    </div>
                  </div>
                  <div className={`grid w-full min-w-0 grid-cols-1 ${isZoomCompactView ? 'gap-2' : 'gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-stretch sm:gap-3'}`}>
                    <div className={`flex w-full min-w-0 flex-wrap items-stretch justify-start ${isZoomCompactView ? 'gap-1.5' : 'gap-2'}`}>
                      <button
                        type="button"
                        onClick={handleBuy}
                        className={`${isZoomCompactView ? 'min-h-[2.3rem] basis-[4.5rem] px-2 py-1.5 text-[16px] sm:min-h-[2.5rem] sm:text-[17px]' : 'min-h-[2.75rem] basis-[5.25rem] px-3 py-2 text-[19px] sm:min-h-[3.25rem] sm:basis-0 sm:px-7 sm:text-[23px]'} flex-1 rounded-xl bg-gradient-to-b from-emerald-400 via-emerald-500 to-emerald-700 font-bold tracking-wide text-white shadow-[0_4px_16px_rgba(5,150,105,0.42)] ring-1 ring-white/35 transition hover:brightness-110 active:scale-[0.98]`}
                      >
                        BUY
                      </button>
                      <button
                        type="button"
                        onClick={handleClearAll}
                        className={`${isZoomCompactView ? 'min-h-[2.3rem] basis-[4rem] px-2 py-1.5 text-[15px] sm:min-h-[2.5rem] sm:text-[17px]' : 'min-h-[2.75rem] basis-[4.25rem] px-3 py-2 text-[18px] sm:min-h-[3.25rem] sm:basis-0 sm:px-7 sm:text-[23px]'} flex-1 rounded-xl bg-gradient-to-b from-rose-500 via-rose-600 to-red-700 font-bold tracking-wide text-white shadow-[0_4px_16px_rgba(225,29,72,0.4)] ring-1 ring-white/30 transition hover:brightness-110 active:scale-[0.98]`}
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={handleAdvance}
                        className={`${isZoomCompactView ? 'min-h-[2.3rem] basis-[4.25rem] px-2 py-1.5 text-[15px] sm:min-h-[2.5rem] sm:text-[17px]' : 'min-h-[2.75rem] basis-[4.75rem] px-3 py-2 text-[18px] sm:min-h-[3.25rem] sm:basis-0 sm:px-7 sm:text-[23px]'} flex-1 rounded-xl bg-gradient-to-b from-violet-500 via-indigo-600 to-indigo-800 font-bold tracking-wide text-white shadow-[0_4px_16px_rgba(79,70,229,0.4)] ring-1 ring-white/35 transition hover:brightness-110 active:scale-[0.98]`}
                      >
                        Advance
                      </button>
                    </div>
                    <div className={`flex w-full min-w-0 ${isZoomCompactView ? '' : 'sm:w-auto sm:min-w-[8rem] sm:justify-end'}`}>
                      <div className={`flex w-full min-w-0 items-center justify-center rounded-xl border-2 border-amber-200/80 bg-gradient-to-b from-amber-50 to-amber-100/90 font-bold tabular-nums text-slate-900 shadow-[inset_0_2px_6px_rgba(255,255,255,0.75),0_2px_10px_rgba(180,83,9,0.12)] ring-1 ring-amber-300/30 ${isZoomCompactView ? 'min-h-[2.35rem] px-3 text-[clamp(1rem,3.2vw,1.35rem)] sm:min-h-[2.5rem]' : 'min-h-[2.75rem] px-4 text-[clamp(1.2rem,4vw,1.75rem)] sm:min-h-[3.25rem] sm:min-w-[7.25rem] sm:px-5 sm:text-[clamp(1.55rem,2.2vw,2.15rem)]'}`}>
                        {totalPoints}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>

          </div>

          <div className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleMotorPick}
                className="h-12 rounded-xl bg-gradient-to-b from-orange-600 via-red-600 to-red-800 text-[22px] font-bold tracking-wide text-white shadow-[0_4px_14px_rgba(220,38,38,0.4)] ring-1 ring-white/30 transition hover:brightness-110 active:scale-[0.98] sm:text-[24px]"
              >
                Motor
              </button>
              <button
                type="button"
                onClick={handleLuckyPick}
                className="h-12 rounded-xl bg-gradient-to-b from-amber-300 via-amber-400 to-yellow-500 text-[20px] font-bold tracking-wide text-amber-950 shadow-[0_4px_14px_rgba(245,158,11,0.45)] ring-1 ring-amber-100/60 transition hover:brightness-110 active:scale-[0.98] sm:text-[22px]"
              >
                Lucky Pick
              </button>
            </div>
            <div className="flex min-h-0 w-full flex-col justify-center">
            <Keypad
              onDigit={handleDigitInput}
              onClear={() => {
                const focusedIndex = resolveKeypadTargetIndex();
                if (focusedIndex === -1 || focusedIndex === 0) {
                  if (focusedIndex === -1) setPoints(String(selectedRate));
                  setInputNumber('');
                }
                else if (focusedIndex === 1) setRangeFrom('');
                else if (focusedIndex === 2) setRangeTo('');
                else if (focusedIndex === 3) setQty('');
                else setInputNumber('');
                if (validationMsg) setValidationMsg('');
              }}
              onDelete={() => {
                const focusedIndex = resolveKeypadTargetIndex();
                if (focusedIndex === -1 || focusedIndex === 0) {
                  if (focusedIndex === -1) {
                    setPoints((prev) => {
                      const next = String(prev || '').slice(0, -1);
                      return next || String(selectedRate);
                    });
                  }
                  setInputNumber((prev) => prev.slice(0, -1));
                } else if (focusedIndex === 1) setRangeFrom((prev) => prev.slice(0, -1));
                else if (focusedIndex === 2) setRangeTo((prev) => prev.slice(0, -1));
                else if (focusedIndex === 3) setQty((prev) => prev.slice(0, -1));
                else setInputNumber((prev) => prev.slice(0, -1));
                if (validationMsg) setValidationMsg('');
              }}
              onIncreasePoint={() => {
                handleAdjustFocusedValue(1);
              }}
              onDecreasePoint={() => {
                handleAdjustFocusedValue(-1);
              }}
              onSelectPointBox={() => setActiveInputIndex(-1)}
              isPointBoxActive={activeInputIndex === -1}
              onNext={handleNextFromKeypad}
              points={pointValue}
              displayValue={keypadCenterDisplay}
            />
            </div>
          </div>
          </div>
        </div>

        {buySummary ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020617]/65 p-4 backdrop-blur-[2px]">
            <div className="w-full max-w-md rounded-2xl border border-[#bfdbfe] bg-gradient-to-b from-white to-[#eff6ff] p-5 shadow-[0_20px_55px_rgba(2,6,23,0.45)]">
              <h3 className="text-[24px] font-black text-[#1d2b4d]">Bet Summary</h3>
              <div className="mt-3 space-y-1.5 text-[15px]">
                <div>Total Bets: <span className="font-semibold">{buySummary.totalBets}</span></div>
                <div>Winning Bets: <span className="font-semibold text-[#2ca44f]">{buySummary.matched}</span></div>
                <div>Total Win: <span className="font-semibold text-[#2ca44f]">{buySummary.totalWinPoints}</span></div>
                <div>Total Loss: <span className="font-semibold text-[#d4372f]">{buySummary.totalLossPoints}</span></div>
                <div>Net Result: <span className={`font-semibold ${buySummary.netResult >= 0 ? 'text-[#2ca44f]' : 'text-[#d4372f]'}`}>{buySummary.netResult}</span></div>
                <div>Ticket Outcome: <span className={`font-semibold ${buySummary.outcome === 'win' ? 'text-[#2ca44f]' : 'text-[#d4372f]'}`}>{buySummary.outcome?.toUpperCase?.() || '-'}</span></div>
                <div>Last Win Amount: <span className="font-semibold text-[#2ca44f]">{buySummary.lastWinAmount}</span></div>
              </div>
              <button type="button" onClick={() => setBuySummary(null)} className="mt-5 h-11 w-full rounded-lg border border-[#264ca7] bg-gradient-to-b from-[#3b82f6] to-[#2563eb] text-[15px] font-extrabold text-white shadow-[0_8px_20px_rgba(37,99,235,0.35)]">
                Close
              </button>
            </div>
          </div>
        ) : null}
        {advanceBuySuccess ? (
          <div className="fixed inset-0 z-[86] flex items-center justify-center bg-[#020617]/70 p-4 backdrop-blur-[2px]">
            <div className="w-full max-w-md rounded-2xl border border-[#93c5fd] bg-gradient-to-b from-white to-[#eff6ff] p-5 shadow-[0_20px_55px_rgba(2,6,23,0.45)]">
              <h3 className="text-[24px] font-black text-[#1d4ed8]">Advance Draw Success</h3>
              <div className="mt-3 space-y-1.5 text-[15px] text-[#1f2937]">
                <div>Scheduled Slots: <span className="font-bold">{advanceBuySuccess.slotCount}</span></div>
                <div>Points Per Slot: <span className="font-bold">{advanceBuySuccess.perSlotPoints}</span></div>
                <div>Total Points: <span className="font-bold">{advanceBuySuccess.totalPoints}</span></div>
                <div className="pt-1 font-semibold">Slot Times:</div>
              </div>
              <div className="mt-2 max-h-36 space-y-1 overflow-y-auto rounded-xl border border-[#dbe4ff] bg-[#eff6ff] p-2.5 text-[14px] font-semibold text-[#1e3a8a]">
                {advanceBuySuccess.slots.map((slot, idx) => (
                  <div key={`${slot}-${idx}`}>{slot}</div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setAdvanceBuySuccess(null)}
                className="mt-5 h-11 w-full rounded-lg border border-[#1d4ed8] bg-gradient-to-b from-[#3b82f6] to-[#1d4ed8] text-[15px] font-extrabold text-white shadow-[0_8px_20px_rgba(37,99,235,0.35)]"
              >
                OK
              </button>
            </div>
          </div>
        ) : null}
        <TicketListModal
          open={isTicketListOpen}
          onClose={() => setIsTicketListOpen(false)}
          tickets={ticketHistory}
          onView={(ticket) => {
            setSelectedTicket(ticket);
            setIsTicketListOpen(false);
          }}
        />
        <TicketListModal
          open={isHistoryListOpen}
          onClose={() => setIsHistoryListOpen(false)}
          tickets={historyTicketsForModal}
          title="HISTORY"
          loading={isHistoryLoading}
          loadingMessage="Loading history..."
          emptyMessage="No history available yet."
          onView={(ticket) => {
            setSelectedTicket(ticket);
            setIsHistoryListOpen(false);
          }}
        />
        <TicketDetailsModal
          open={Boolean(selectedTicket)}
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
        />
        <AdvanceDrawModal
          open={isAdvanceDrawOpen}
          title="ADVANCE DRAW"
          currentLabel={currentTimeText}
          nextLabel={timeToDrawText}
          slotOptions={advanceDrawSlots}
          selectedSlots={selectedAdvanceSlots}
          onToggleSlot={(slotStartIso) => {
            setSelectedAdvanceSlots((prev) => (
              prev.includes(slotStartIso)
                ? prev.filter((x) => x !== slotStartIso)
                : [...prev, slotStartIso]
            ));
          }}
          onToggleAll={() => {
            setSelectedAdvanceSlots((prev) => (
              prev.length === advanceDrawSlots.length ? [] : advanceDrawSlots.map((x) => x.slotStartIso)
            ));
          }}
          onApply={() => {
            setIsAdvanceDrawOpen(false);
            if (selectedAdvanceSlots.length > 0) {
              setAdvanceSelectionNotice(`Advance slot selected (${selectedAdvanceSlots.length})`);
            } else {
              setAdvanceSelectionNotice('No advance slot selected');
            }
          }}
          onClose={() => setIsAdvanceDrawOpen(false)}
        />
        {advanceSelectionNotice ? (
          <div className="fixed inset-0 z-[87] flex items-center justify-center bg-[#020617]/60 p-4 backdrop-blur-[2px]">
            <div className="w-full max-w-sm rounded-2xl border border-[#93c5fd] bg-gradient-to-b from-white to-[#eff6ff] p-5 shadow-[0_18px_45px_rgba(2,6,23,0.45)]">
              <h3 className="text-[22px] font-black text-[#1d4ed8]">Advance Draw</h3>
              <p className="mt-2 text-[16px] font-bold text-[#1e293b]">{advanceSelectionNotice}</p>
            </div>
          </div>
        ) : null}
        {canUsePortal && isResultModalOpen ? createPortal(
          <div className="fixed inset-0 z-[88] flex items-center justify-center bg-black/55 p-3 sm:p-4">
            <div className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#8d8d8d] bg-[#d4d7dd] shadow-2xl">
              <div className="flex items-center justify-between bg-[#e5354c] px-3 py-2 text-white sm:px-4">
                <h3 className="truncate text-lg font-black tracking-wide sm:text-2xl">
                  3D Result
                  <span className="ml-2 text-base sm:text-xl">{`${resultDateDay}-${resultDateMonth}-${resultDateYear}`}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsResultModalOpen(false)}
                  className="rounded bg-black/10 px-2 py-0.5 text-3xl font-bold leading-none hover:bg-black/20"
                  aria-label="Close result modal"
                >
                  ×
                </button>
              </div>

              <div className="grid gap-2 border-b border-[#bcc2cc] bg-[#cfd4dc] p-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3 sm:p-3">
                <div className="grid grid-cols-[auto_56px_56px_88px] items-center gap-2">
                  <span className="text-sm font-bold text-[#1f2937] sm:text-base">Date</span>
                  <input
                    type="text"
                    value={resultDateDay}
                    onChange={(e) => setResultDateDay(e.target.value.replace(/\D/g, '').slice(0, 2))}
                    className="h-9 rounded-md border border-[#c2c6ce] bg-[#f3f4f6] text-center text-base font-bold text-[#4b5563]"
                    placeholder="DD"
                  />
                  <input
                    type="text"
                    value={resultDateMonth}
                    onChange={(e) => setResultDateMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
                    className="h-9 rounded-md border border-[#c2c6ce] bg-[#f3f4f6] text-center text-base font-bold text-[#4b5563]"
                    placeholder="MM"
                  />
                  <input
                    type="text"
                    value={resultDateYear}
                    onChange={(e) => setResultDateYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="h-9 rounded-md border border-[#c2c6ce] bg-[#f3f4f6] text-center text-base font-bold text-[#4b5563]"
                    placeholder="YYYY"
                  />
                </div>
                <button
                  type="button"
                  onClick={applyResultDateFilter}
                  className="h-9 rounded-lg bg-[#234372] px-4 text-sm font-black text-white shadow-[0_6px_18px_rgba(15,23,42,0.35)] sm:min-w-[120px]"
                >
                  Show Result
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-[#e5e7eb] p-2 sm:p-3">
                {resultLoading && (
                  <div className="rounded-md border border-[#b8bfca] bg-[#f8fafc] px-4 py-8 text-center text-sm font-semibold text-[#475569]">
                    Loading result history...
                  </div>
                )}
                {!resultLoading && resultError && (
                  <div className="rounded-md border border-[#f0b5b5] bg-[#fff1f1] px-4 py-8 text-center text-sm font-semibold text-[#b91c1c]">
                    {resultError}
                  </div>
                )}
                {!resultLoading && !resultError && (
                <>
                <div className="hidden min-w-[460px] sm:block">
                  <div className="grid grid-cols-[130px_repeat(3,minmax(0,1fr))] gap-2">
                    <div className="flex h-10 items-center justify-center rounded-md border border-[#9ca3af] bg-[#f3f4f6] text-sm font-black text-[#374151]">TIME</div>
                    <div className="flex h-10 items-center justify-center rounded-md bg-gradient-to-b from-[#3f66c9] to-[#2f4ea6] text-lg font-black text-white">A</div>
                    <div className="flex h-10 items-center justify-center rounded-md bg-gradient-to-b from-[#ea4f08] to-[#cc3f00] text-lg font-black text-white">B</div>
                    <div className="flex h-10 items-center justify-center rounded-md bg-gradient-to-b from-[#31925d] to-[#2b7f52] text-lg font-black text-white">C</div>
                  </div>
                  <div className="mt-2 space-y-2">
                    {resultModalRows.length ? resultModalRows.map((row) => (
                      <div key={row.id} className="grid grid-cols-[130px_repeat(3,minmax(0,1fr))] gap-2">
                        <div className="flex h-12 items-center justify-center rounded-md border border-[#9ca3af] bg-black px-1 text-xs font-bold text-white">
                          {row.time}
                        </div>
                        <div className="grid h-12 grid-cols-1 overflow-hidden rounded-md border border-[#5f77b8] bg-gradient-to-b from-[#3f66c9] to-[#2f4ea6] text-2xl font-black text-white">
                          <span className="flex items-center justify-center tracking-[0.25em]">{row.A}</span>
                        </div>
                        <div className="grid h-12 grid-cols-1 overflow-hidden rounded-md border border-[#b65935] bg-gradient-to-b from-[#ea4f08] to-[#cc3f00] text-2xl font-black text-white">
                          <span className="flex items-center justify-center tracking-[0.25em]">{row.B}</span>
                        </div>
                        <div className="grid h-12 grid-cols-1 overflow-hidden rounded-md border border-[#4b8d68] bg-gradient-to-b from-[#31925d] to-[#2b7f52] text-2xl font-black text-white">
                          <span className="flex items-center justify-center tracking-[0.25em]">{row.C}</span>
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-md border border-[#b8bfca] bg-[#f8fafc] px-4 py-8 text-center text-sm font-semibold text-[#475569]">
                        No result found for selected date.
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2 sm:hidden">
                  {resultModalRows.length ? resultModalRows.map((row) => (
                    <div key={`mobile-${row.id}`} className="rounded-lg border border-[#b8bfca] bg-[#f8fafc] p-2">
                      <div className="mb-2 flex items-center justify-between text-xs font-bold text-[#334155]">
                        <span>TIME</span>
                        <span>{row.time}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-md border border-[#5f77b8] bg-gradient-to-b from-[#3f66c9] to-[#2f4ea6] p-1 text-center text-white">
                          <div className="mb-1 text-[10px] font-bold">A</div>
                          <div className="font-black tracking-[0.22em]">{row.A}</div>
                        </div>
                        <div className="rounded-md border border-[#b65935] bg-gradient-to-b from-[#ea4f08] to-[#cc3f00] p-1 text-center text-white">
                          <div className="mb-1 text-[10px] font-bold">B</div>
                          <div className="font-black tracking-[0.22em]">{row.B}</div>
                        </div>
                        <div className="rounded-md border border-[#4b8d68] bg-gradient-to-b from-[#31925d] to-[#2b7f52] p-1 text-center text-white">
                          <div className="mb-1 text-[10px] font-bold">C</div>
                          <div className="font-black tracking-[0.22em]">{row.C}</div>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-md border border-[#b8bfca] bg-[#f8fafc] px-4 py-8 text-center text-sm font-semibold text-[#475569]">
                      No result found for selected date.
                    </div>
                  )}
                </div>
                </>
                )}
              </div>

              {lastTicket ? (
                <div className="border-t border-[#b9bec7] bg-[#d4d7dd] px-3 py-2 text-xs font-semibold text-[#374151] sm:px-4 sm:text-sm">
                  Last Ticket: <span className="font-bold">{lastTicket.gameId}</span> | Outcome:{' '}
                  <span className={
                    lastTicket.outcome === 'win'
                      ? 'text-[#15803d]'
                      : lastTicket.outcome === 'cancelled'
                        ? 'text-[#475569]'
                        : 'text-[#b91c1c]'
                  }>
                    {String(lastTicket.outcome || '-').toUpperCase()}
                  </span>{' '}
                  | Win: <span className="font-bold">{lastTicket.totalWin ?? 0}</span>
                </div>
              ) : null}
            </div>
          </div>
        , document.body) : null}
        {isAccountModalOpen ? (
          <div className="fixed inset-0 z-[89] flex items-center justify-center bg-black/60 p-3 sm:p-4">
            <div className="w-full max-w-md rounded-xl border border-[#7b7b7b] bg-[#d4d7dd] shadow-2xl">
              <div className="flex items-center justify-between bg-[#c71616] px-4 py-2 text-white">
                <h3 className="text-xl font-black tracking-wide">Account Details</h3>
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="rounded bg-black/20 px-2 py-0.5 text-2xl font-bold leading-none hover:bg-black/35"
                  aria-label="Close account modal"
                >
                  ×
                </button>
              </div>
              <div className="space-y-2 bg-[#eceff4] p-4 text-sm font-semibold text-[#1f2937]">
                <div className="rounded border border-[#c4ccd8] bg-white px-3 py-2">Name: <span className="font-bold">{accountDetails.name}</span></div>
                <div className="rounded border border-[#c4ccd8] bg-white px-3 py-2">User ID: <span className="font-bold">{accountDetails.userId}</span></div>
                <div className="rounded border border-[#c4ccd8] bg-white px-3 py-2">Phone: <span className="font-bold">{accountDetails.phone}</span></div>
                <div className="rounded border border-[#c4ccd8] bg-white px-3 py-2">Email: <span className="font-bold">{accountDetails.email}</span></div>
                <div className="rounded border border-[#c4ccd8] bg-white px-3 py-2">Wallet: <span className="font-bold text-emerald-700">₹{accountDetails.wallet}</span></div>
              </div>
            </div>
          </div>
        ) : null}
        {showRotatePrompt ? (
          <div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-[#111] border border-[#3b3b3b] text-white p-4 text-center rounded">
              <div className="phone-rotate-wrap" aria-hidden>
                <div className="phone-rotate-icon" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Rotate Screen</h3>
              <p className="text-sm text-gray-300 mb-4">
                3D game works best in landscape mode.
                Please rotate your phone horizontally.
              </p>
              <button
                type="button"
                onClick={handleRotateLandscape}
                className="w-full h-10 bg-[#ef3f34] border border-[#d4372f] font-semibold rounded"
              >
                Rotate + Full Screen
              </button>
            </div>
          </div>
        ) : null}
        </div>
      </div>
      </div>
    </div>
  );
};

export default ThreeDGame;
