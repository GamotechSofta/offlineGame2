import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ClipboardList,
  CircleX,
  HelpCircle,
  KeyRound,
  LogOut,
  RefreshCw,
  Trophy,
  UserCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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

const MODE_OPTIONS = ['all', 'box', 'str', 'sp', 'fp', 'bp', 'ap', 'single', 'duplicates', 'triples'];
const MODE_GROUP_COMBO = MODE_OPTIONS.slice(0, 7);
const MODE_GROUP_SPECIAL = MODE_OPTIONS.slice(7);
const ALL_SHORTCUT_MODES = ['box', 'str', 'sp', 'fp', 'bp', 'ap'];
const RATE_OPTIONS = [10, 20, 30, 50, 100, 200];
/** Progress bar turns red when remaining time is at or below this many seconds (5 minutes). */
const TIMER_BAR_RED_MAX_SECONDS = 5 * 60;
const STORAGE_KEY = 'matka3d-bets';
const TICKET_HISTORY_KEY = '3d-ticket-history';
const RESULT_HISTORY_KEY = '3d-result-history';
const HEADER_MENU_ITEMS = [
  { label: 'Result', Icon: Trophy },
  { label: 'Account', Icon: UserCircle },
  { label: 'Quiz', Icon: HelpCircle },
  { label: 'Ticket List', Icon: ClipboardList },
  { label: 'Cancel', Icon: CircleX },
  { label: 'Password', Icon: KeyRound },
  { label: 'Refresh', Icon: RefreshCw },
  { label: 'Logout', Icon: LogOut },
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

const ThreeDGame = () => {
  const navigate = useNavigate();
  const slotRef = useRef('');
  const lastLandscapeAutoFsAttemptRef = useRef(0);
  const inputNumberRef = useRef(null);
  const rangeFromRef = useRef(null);
  const rangeToRef = useRef(null);
  const qtyRef = useRef(null);
  const autoAddLockRef = useRef(false);
  const autoRangeAddLockRef = useRef('');
  const autoAddTimerRef = useRef(null);
  const rangeAutoNextLockRef = useRef(false);
  const headerMenuRef = useRef(null);
  const [activeInputIndex, setActiveInputIndex] = useState(-1);
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
  const [points, setPoints] = useState('0');
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
  const [bets, setBets] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [lastTxnId, setLastTxnId] = useState('GM00000000000000');
  const [lastPoints, setLastPoints] = useState(0);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [isTicketListOpen, setIsTicketListOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
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
  const [resultHistory, setResultHistory] = useState(() => {
    try {
      const raw = localStorage.getItem(RESULT_HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [ticketHistory, setTicketHistory] = useState(() => {
    try {
      const raw = localStorage.getItem(TICKET_HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const isResultFresh = useMemo(() => Date.now() - resultUpdatedAt < 1400, [resultUpdatedAt, now]);
  const isBuySuccessToast = useMemo(
    () => String(toast || '').toLowerCase() === 'bet placed successfully',
    [toast],
  );
  const lastTicket = useMemo(() => (ticketHistory.length ? ticketHistory[0] : null), [ticketHistory]);
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
    () => (isMobileView && activeInputIndex === 0 ? `${inputNumber || ''} |` : inputNumber),
    [activeInputIndex, inputNumber, isMobileView],
  );
  const rangeFromDisplay = useMemo(
    () => (isMobileView && activeInputIndex === 1 ? `${rangeFrom || ''} |` : rangeFrom),
    [activeInputIndex, isMobileView, rangeFrom],
  );
  const rangeToDisplay = useMemo(
    () => (isMobileView && activeInputIndex === 2 ? `${rangeTo || ''} |` : rangeTo),
    [activeInputIndex, isMobileView, rangeTo],
  );
  const qtyDisplay = useMemo(
    () => (isMobileView && activeInputIndex === 3 ? `${qty || ''} |` : qty),
    [activeInputIndex, isMobileView, qty],
  );

  const pushResultToHistory = useCallback((newResult, createdAt = new Date()) => {
    const d = new Date(createdAt);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateKey = `${y}-${m}-${day}`;
    const time = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
      .format(d)
      .replace(/\s?(am|pm)$/i, (match) => ` ${match.trim().toUpperCase()}`);
    const row = {
      id: `${d.getTime()}-${newResult.A.join('')}-${newResult.B.join('')}-${newResult.C.join('')}`,
      createdAt: d.toISOString(),
      dateKey,
      time,
      A: newResult.A.join(''),
      B: newResult.B.join(''),
      C: newResult.C.join(''),
    };
    setResultHistory((prev) => [row, ...prev].slice(0, 500));
  }, []);

  const applyFreshResult = useCallback((newResult, createdAt = new Date()) => {
    setResults(newResult);
    setResultUpdatedAt(Date.now());
    pushResultToHistory(newResult, createdAt);
  }, [pushResultToHistory]);

  const runClockTick = useCallback(() => {
    const current = new Date();
    const meta = getSlotMeta(current);
    setNow(current);
    setTimerSeconds(meta.remainingSeconds);
    setNextDrawAt(meta.nextDraw);
    if (slotRef.current !== meta.slotKey) {
      slotRef.current = meta.slotKey;
      applyFreshResult(generate3DResult(), current);
    }
  }, [applyFreshResult]);

  useEffect(() => {
    runClockTick();
    const id = setInterval(runClockTick, 1000);
    return () => clearInterval(id);
  }, [runClockTick]);

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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bets));
    } catch (_) {}
  }, [bets]);

  useEffect(() => {
    try {
      localStorage.setItem(TICKET_HISTORY_KEY, JSON.stringify(ticketHistory));
    } catch (_) {}
  }, [ticketHistory]);

  useEffect(() => {
    try {
      localStorage.setItem(RESULT_HISTORY_KEY, JSON.stringify(resultHistory));
    } catch (_) {}
  }, [resultHistory]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!isHeaderMenuOpen) return undefined;
    const handleOutsideClick = (event) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(event.target)) {
        setIsHeaderMenuOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsHeaderMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isHeaderMenuOpen]);

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
    return resultHistory
      .filter((row) => row.dateKey === resultFilterKey)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 12);
  }, [resultFilterKey, resultHistory]);

  const timeToDrawText = useMemo(
    () =>
      new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
        .format(nextDrawAt)
        .replace(/\s?(am|pm)$/i, (m) => ` ${m.trim().toUpperCase()}`),
    [nextDrawAt],
  );
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
    // Keep keypad top box visibly in sync for every digit press.
    setPoints((prev) => appendPointDigit(prev));
    if (focusedIndex === -1 || focusedIndex === 0) {
      setInputNumber((prev) => appendDigit(prev));
    } else if (focusedIndex === 1) setRangeFrom((prev) => appendDigit(prev));
    else if (focusedIndex === 2) setRangeTo((prev) => appendDigit(prev));
    else if (focusedIndex === 3) setQty((prev) => appendDigit(prev));
    else {
      setInputNumber((prev) => appendDigit(prev));
    }
    if (validationMsg) setValidationMsg('');
  }, [resolveKeypadTargetIndex, validationMsg]);

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
    if (count > 999) return { ok: false, error: 'Range limit exceeded (max 999 numbers).' };
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
    if (qtyNum > 500) return { ok: false, error: 'Qty limit exceeded (max 500).' };

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
    const existing = new Set(
      bets.flatMap((b) => {
        const mode = String(b.mode || '').toLowerCase();
        const num = String(b.number || '');
        const panels = String(b.panels || '')
          .split(',')
          .map((p) => p.trim().toUpperCase())
          .filter(Boolean);
        if (!panels.length) return [`${num}|${mode}|A`, `${num}|${mode}|B`, `${num}|${mode}|C`];
        return panels.map((panel) => `${num}|${mode}|${panel}`);
      }),
    );
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
          const key = `${betNumber}|${betType}|${panel}`;
          const isSpMode = String(betType || '').toLowerCase() === 'sp';
          if (!isSpMode && existing.has(key)) {
            skipped.push(`${betNumber}:${betType}:${panel}`);
            return;
          }
          existing.add(key);
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
    const pts = pointValue;
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
      autoAddTimerRef.current = setTimeout(() => {
        addBet();
        autoAddTimerRef.current = null;
      }, 40);
      return;
    }
    if (!isSingleThreeDigits) {
      autoAddLockRef.current = false;
    }

    if (isRangeComplete) {
      const rangeKey = `${rangeFrom}-${rangeTo}`;
      if (autoRangeAddLockRef.current !== rangeKey) {
        autoRangeAddLockRef.current = rangeKey;
        autoAddTimerRef.current = setTimeout(() => {
          addBet();
          autoAddTimerRef.current = null;
        }, 40);
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

  const handleBuy = useCallback(() => {
    if (!bets.length) {
      setValidationMsg('Add at least one bet before BUY.');
      return;
    }
    const updatedBets = settleAllBets(bets, results);
    const summary = calculateSettlementSummary(updatedBets);
    setBets(updatedBets);
    const matched = updatedBets.filter((b) => b.outcome === 'win').length;
    const drawDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const gameId = generateGameId();
    const ticket = {
      id: Date.now(),
      userName: 'user',
      drawTime: timeToDrawText,
      drawDate,
      gameId,
      bets: updatedBets,
      totalPoints: summary.totalInvested ?? summary.totalPoints,
      totalWin: summary.totalWinAmount,
      outcome: summary.netResult > 0 ? 'win' : 'loss',
      createdAt: new Date().toISOString(),
    };
    setTicketHistory((prev) => [ticket, ...prev].slice(0, 200));
    setLastTxnId(gameId);
    setLastPoints(summary.totalInvested ?? totalPoints);
    setToast('Bet placed successfully');
    setValidationMsg('');
    setBuySummary(null);
    setBets([]);
  }, [bets, calculateSettlementSummary, generateGameId, now, results, settleAllBets, timeToDrawText, totalPoints]);

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
    setActiveInputIndex(-1);
  }, []);

  const handleAdvance = useCallback(() => {
    if (!window.confirm('Are you sure to generate next result?')) return;
    applyFreshResult(generate3DResult(), new Date());
    setTimerSeconds(GAME_INTERVAL_SECONDS);
    setNextDrawAt(getNextDrawTime(new Date()));
  }, [applyFreshResult]);

  const handleHeaderAction = useCallback((label) => {
    setIsHeaderMenuOpen(false);
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
      navigate('/lottery/3d/quiz');
      return;
    }
    if (label.toLowerCase() === 'refresh') {
      applyFreshResult(generate3DResult(), new Date());
      setToast('Result Refreshed');
      return;
    }
    if (label.toLowerCase() === 'ticket list') {
      setIsTicketListOpen(true);
      return;
    }
    if (label.toLowerCase() === 'logout') {
      localStorage.removeItem(STORAGE_KEY);
      window.alert('Demo logout action triggered.');
      return;
    }
    setToast(`${label} clicked`);
  }, [applyFreshResult, navigate, now]);

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

  const handleMotorPick = useCallback(() => {
    const d = String(Math.floor(Math.random() * 10));
    setInputNumber(`${d}${d}${d}`);
    setToast('Motor number selected');
  }, []);

  const handleLuckyPick = useCallback(() => {
    const n = Array.from({ length: 3 }, () => Math.floor(Math.random() * 10)).join('');
    setInputNumber(n);
    setToast('Lucky pick generated');
  }, []);

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

        <div className="grid min-h-0 grid-cols-[minmax(0,11rem)_minmax(0,1fr)_minmax(2.75rem,3.5rem)] items-stretch gap-1.5 pb-0.5 sm:grid-cols-[minmax(0,12.5rem)_minmax(0,1fr)_minmax(2.75rem,3.75rem)] sm:gap-2">
          <div className="flex h-full min-h-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-amber-200/50 bg-gradient-to-br from-amber-50/95 via-white to-rose-50/30 px-2 py-1.5 text-center shadow-[0_4px_16px_rgba(15,23,42,0.07)] ring-1 ring-white/90 sm:px-2.5 sm:py-2">
            <div className="bg-gradient-to-r from-rose-700 via-red-600 to-rose-700 bg-clip-text text-[clamp(1.35rem,3.5vw,1.75rem)] font-extrabold leading-none tracking-tight text-transparent">
              3D Quiz
            </div>
            <div className="text-[13px] font-bold leading-tight text-slate-600 sm:text-[15px] md:text-[16px]">
              Last Draw:{' '}
              <span className="font-extrabold tabular-nums text-slate-900">{timeToDrawText}</span>
            </div>
          </div>
          <div className="grid min-w-0 grid-cols-3 gap-1 sm:gap-1.5">
            <ResultPanel title="A" digits={results.A} isUpdated={isResultFresh} />
            <ResultPanel title="B" digits={results.B} isUpdated={isResultFresh} />
            <ResultPanel title="C" digits={results.C} isUpdated={isResultFresh} />
          </div>
          <div
            ref={headerMenuRef}
            className="relative z-40 flex h-full min-h-0 shrink-0 items-stretch justify-end pr-1.5 sm:pr-2.5"
          >
            <button
              type="button"
              onClick={() => setIsHeaderMenuOpen((prev) => !prev)}
              className="flex h-full w-full min-w-0 max-w-[2.75rem] shrink-0 items-center justify-center rounded-lg bg-gradient-to-b from-amber-600 via-amber-800 to-amber-950 text-[18px] font-bold leading-none text-white shadow-[0_3px_12px_rgba(120,53,15,0.35)] ring-1 ring-amber-200/35 transition hover:brightness-110 active:scale-[0.98] sm:text-[19px]"
              aria-label="Open menu"
              aria-expanded={isHeaderMenuOpen}
            >
              &#9776;
            </button>
            {isHeaderMenuOpen ? (
              <div className="absolute right-0 top-full z-50 mt-2 flex min-h-[min(420px,72vh)] w-64 flex-col overflow-hidden rounded-2xl border border-[#c9a882] bg-[#fffdf9] py-3 shadow-[0_18px_48px_rgba(30,20,10,0.26)] ring-1 ring-black/5">
                <div className="border-b border-[#ead9c4] px-4 pb-3 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-[#6b4423]">
                  Menu
                </div>
                <nav className="flex min-h-0 flex-1 flex-col justify-center gap-1.5 p-3" aria-label="Main menu">
                  {HEADER_MENU_ITEMS.map(({ label, Icon }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => handleHeaderAction(label)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-4 text-left text-[17px] font-semibold transition-colors active:scale-[0.99] ${
                        label === 'Logout'
                          ? 'text-[#9a3412] hover:bg-[#ffedd5] active:bg-[#fed7aa]'
                          : 'text-[#1f1812] hover:bg-[#f5e9d8] active:bg-[#e8dcc8]'
                      }`}
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                          label === 'Logout' ? 'bg-[#ffedd5] text-[#c2410c]' : 'bg-[#f4e8d8]/90 text-[#7a4f26]'
                        }`}
                      >
                        <Icon className="h-5 w-5" strokeWidth={2.25} aria-hidden />
                      </span>
                      <span className="min-w-0 leading-snug">{label}</span>
                    </button>
                  ))}
                </nav>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex w-full min-h-0 items-center justify-center rounded-lg border border-[#8b9ab3] bg-[#dfe6f2] px-2 py-2">
          <div className="grid w-full min-w-0 grid-cols-7 gap-2 text-center min-h-0">
          <div className="min-w-0 rounded-md border border-[#8b9ab3] bg-gradient-to-b from-[#f2f6ff] to-[#e3ecff] flex min-h-[60px] flex-col justify-center gap-1 py-2.5 px-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <div className="text-[11px] uppercase tracking-wide text-[#4a5b86] font-semibold">Time To Draw</div>
            <div className={`text-[24px] font-bold leading-none ${timerSeconds <= 10 ? 'text-[#d4372f] animate-pulse' : 'text-[#18233f]'}`}>{formatTimer(timerSeconds)}</div>
          </div>
          <div className="min-w-0 rounded-md border border-[#8b9ab3] bg-gradient-to-b from-[#f8f9ff] to-[#edf1ff] flex min-h-[60px] flex-col justify-center gap-1 py-2.5 px-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <div className="text-[11px] uppercase tracking-wide text-[#5e6787] font-semibold">Dr.Time</div>
            <div className="text-[20px] font-semibold leading-none text-[#1f2a44]">{timeToDrawText}</div>
          </div>
          <div className="min-w-0 rounded-md border border-[#8b9ab3] bg-gradient-to-b from-[#f6f8fc] to-[#ebeff7] flex min-h-[60px] flex-col justify-center gap-1 py-2.5 px-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <div className="text-[11px] uppercase tracking-wide text-[#636b7d] font-semibold">Id</div>
            <div className="text-[18px] font-semibold leading-none text-[#1f2738]">user</div>
          </div>
          <div className="min-w-0 rounded-md border border-[#8b9ab3] bg-gradient-to-b from-[#f3f8ff] to-[#e7f0ff] flex min-h-[60px] flex-col justify-center gap-1 py-2.5 px-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <div className="text-[11px] uppercase tracking-wide text-[#5a6784] font-semibold">Time</div>
            <div className="text-[18px] font-semibold leading-none text-[#1f2d46]">{currentTimeText}</div>
          </div>
          <div className="min-w-0 rounded-md border border-[#8b9ab3] bg-gradient-to-b from-[#f8f7ff] to-[#edeafc] flex min-h-[60px] flex-col justify-center gap-1 py-2.5 px-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <div className="text-[11px] uppercase tracking-wide text-[#6a6284] font-semibold">Last Ticket</div>
            <div className={`text-[16px] font-bold leading-none ${lastTicket?.outcome === 'win' ? 'text-[#15803d]' : 'text-[#b91c1c]'}`}>
              {lastTicket ? lastTicket.outcome.toUpperCase() : '-'}
            </div>
          </div>
          <div className="min-w-0 rounded-md border border-[#8b9ab3] bg-gradient-to-b from-[#fff8f2] to-[#ffefe2] flex min-h-[60px] flex-col justify-center gap-1 py-2.5 px-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <div className="text-[11px] uppercase tracking-wide text-[#8a6950] font-semibold">Last Trn</div>
            <div className="text-[15px] font-semibold leading-none text-[#3f2a1c] truncate" title={lastTxnId}>{lastTxnId}</div>
          </div>
          <div className="min-w-0 rounded-md border border-[#8b9ab3] bg-gradient-to-b from-[#f2fbf5] to-[#e4f6e9] flex min-h-[60px] flex-col justify-center gap-1 py-2.5 px-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <div className="text-[11px] uppercase tracking-wide text-[#4e7760] font-semibold">Last Win</div>
            <div className="text-[18px] font-semibold leading-none text-[#1f3a2b]">{lastTicket?.totalWin ?? 0}</div>
          </div>
          </div>
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
            <div className="flex w-full min-w-0 flex-wrap items-center gap-2 rounded-xl border border-[#d4b896] bg-gradient-to-br from-[#fffbeb] via-[#fef3c7] to-[#fde68a] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_1px_3px_rgba(180,130,40,0.12)]">
              <label className="inline-flex cursor-pointer select-none items-center gap-2 rounded-lg border border-[#475569] bg-[#334155] px-3 py-2 text-[14px] font-semibold uppercase tracking-wide text-white shadow-sm transition hover:brightness-110 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#64748b] has-[:focus-visible]:ring-offset-2">
                <input className="size-4 accent-white" type="checkbox" checked={selectedPanels.length === 3} onChange={() => setSelectedPanels(selectedPanels.length === 3 ? [] : [...PANEL_OPTIONS])} />
                All
              </label>
              {PANEL_OPTIONS.map((panel) => (
                <label
                  key={panel}
                  className={`inline-flex cursor-pointer select-none items-center gap-2 rounded-lg border px-3 py-2 text-[15px] font-bold text-white shadow-sm transition hover:brightness-110 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2 ${
                    panel === 'A'
                      ? 'border-[#1d4ed8] bg-[#2563eb] has-[:focus-visible]:ring-[#3b82f6]'
                      : panel === 'B'
                        ? 'border-[#b91c1c] bg-[#dc2626] has-[:focus-visible]:ring-[#f87171]'
                        : 'border-[#047857] bg-[#059669] has-[:focus-visible]:ring-[#34d399]'
                  }`}
                >
                  <input className="size-4 accent-white" type="checkbox" checked={selectedPanels.includes(panel)} onChange={() => togglePanel(panel)} />
                  {panel}
                </label>
              ))}
              <span className="mx-1 hidden h-7 w-px bg-[#c9a66b]/70 sm:inline-block" aria-hidden />
              <button
                type="button"
                onClick={handleToggleAllDigits}
                className={`rounded-full border-2 px-3.5 py-2 text-[13px] font-bold tracking-wide transition ${
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
                  className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-[15px] font-bold transition ${
                    selectedDigits.includes(digit)
                      ? 'scale-[1.03] border-[#4f46e5] bg-[#4f46e5] text-white shadow-md'
                      : 'border-[#e2e8f0] bg-white text-[#334155] shadow-sm hover:border-[#94a3b8] hover:bg-[#f8fafc]'
                  }`}
                >
                  {digit}
                </button>
              ))}
              <div className="ml-auto flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-x-2 gap-y-1 pl-2 sm:gap-x-3">
                <button
                  type="button"
                  onClick={() => navigate('/lottery')}
                  className="rounded-lg border border-[#0f172a] bg-[#0f172a] px-4 py-2 text-[14px] font-bold tracking-wide text-white shadow-md transition hover:bg-[#1e293b] active:scale-[0.98] sm:text-[15px]"
                >
                  Go back to 2D game
                </button>
              </div>
            </div>

          <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[1fr_250px] gap-2 overflow-hidden">
          <div className="grid h-full max-h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
            <div className="overflow-hidden rounded-lg border border-[#d9d9d9] bg-white">
              <div className="flex min-w-0 flex-col sm:flex-row sm:items-stretch">
                <div className="flex min-w-0 w-full flex-[7] flex-nowrap items-stretch gap-1.5 overflow-x-auto bg-gradient-to-br from-[#dbeafe] to-[#e0f2fe] px-2 py-2 sm:min-w-0 sm:gap-2 sm:px-2.5 sm:py-2.5">
                  {MODE_GROUP_COMBO.map((mode) => (
                    <label
                      key={mode}
                      className="flex h-10 min-h-10 min-w-[3.25rem] flex-1 basis-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#bfdbfe] bg-white/90 px-1 text-[13px] font-semibold uppercase shadow-sm sm:min-w-0 sm:px-2 sm:text-[14px] md:text-[15px]"
                    >
                      <input type="checkbox" className="size-4 shrink-0 accent-[#2563eb]" checked={selectedModes.includes(mode)} onChange={() => toggleMode(mode)} />
                      <span className="truncate">{mode}</span>
                    </label>
                  ))}
                </div>
                <div className="h-px w-full shrink-0 bg-[#d1d5db] sm:h-auto sm:w-px sm:self-stretch" aria-hidden />
                <div className="flex min-w-0 w-full flex-[3] flex-nowrap items-stretch gap-1.5 overflow-x-auto bg-gradient-to-br from-[#d1fae5] to-[#ecfdf5] px-2 py-2 sm:min-w-0 sm:gap-2 sm:px-2.5 sm:py-2.5">
                  {MODE_GROUP_SPECIAL.map((mode) => (
                    <label
                      key={mode}
                      className={`flex h-10 min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#a7f3d0] bg-white/90 px-1.5 text-[12px] font-semibold uppercase leading-tight shadow-sm sm:px-2 sm:text-[13px] md:text-[14px] ${
                        mode === 'duplicates'
                          ? 'min-w-[9.5rem] shrink-0 flex-[1.65] basis-auto sm:min-w-[10.5rem] md:min-w-[11rem] md:text-[15px]'
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
                <h2 className={`bg-gradient-to-r from-indigo-700 via-blue-700 to-indigo-800 bg-clip-text font-extrabold leading-tight tracking-tight text-transparent ${isZoomCompactView ? 'text-[15px] sm:text-[16px]' : 'text-[17px] sm:text-[19px]'}`}>
                  Play &amp; stake — 3D Quiz
                </h2>
                <p className={`font-semibold leading-snug text-slate-500 ${isZoomCompactView ? 'text-[11px] sm:text-[12px]' : 'text-[12px] sm:text-[13px]'}`}>
                  Add number or range, L-Pick &amp; qty, set rate, then BUY / Clear / Advance
                </p>
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
                  readOnly={isMobileView}
                  inputMode={isMobileView ? 'none' : 'numeric'}
                  onKeyDown={(e) => {
                    if (isMobileView) e.preventDefault();
                  }}
                  onChange={(e) => {
                    const next = e.target.value.replace(/\D/g, '').slice(0, 3);
                    setInputNumber(next);
                    if (validationMsg) setValidationMsg('');
                  }}
                  placeholder="ADD NUMBER"
                  className="h-11 w-[min(11rem,36vw)] shrink-0 rounded-full border-2 border-[#2e59c6] px-3 text-center text-[16px] font-semibold tracking-wide sm:h-12 sm:w-[190px] sm:text-[18px]"
                />
                <span className="shrink-0 font-semibold text-[16px] text-[#1d2b4d] sm:text-[18px]">Range:</span>
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
                  readOnly={isMobileView}
                  inputMode={isMobileView ? 'none' : 'numeric'}
                  onKeyDown={(e) => {
                    if (isMobileView) e.preventDefault();
                  }}
                  onChange={(e) => {
                    setActiveInputIndex(1);
                    const next = e.target.value.replace(/\D/g, '').slice(0, 3);
                    setRangeFrom(next);
                    if (validationMsg) setValidationMsg('');
                  }}
                  placeholder="NUM."
                  className="h-10 w-[4.25rem] shrink-0 rounded-full border border-[#d1d1d1] px-2 text-center text-[15px] sm:h-11 sm:w-[76px] sm:text-[16px]"
                />
                <span className="shrink-0 font-semibold text-[16px] text-[#1d2b4d] sm:text-[18px]">To</span>
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
                  readOnly={isMobileView}
                  inputMode={isMobileView ? 'none' : 'numeric'}
                  onKeyDown={(e) => {
                    if (isMobileView) e.preventDefault();
                  }}
                  onChange={(e) => {
                    setActiveInputIndex(2);
                    setRangeTo(e.target.value.replace(/\D/g, '').slice(0, 3));
                  }}
                  placeholder="NUM."
                  className="h-10 w-[4.25rem] shrink-0 rounded-full border border-[#d1d1d1] px-2 text-center text-[15px] sm:h-11 sm:w-[76px] sm:text-[16px]"
                />
              </div>
              <div className={`${isZoomCompactView ? 'my-2' : 'my-2.5'} border-t border-[#d8dee9]`} aria-hidden />
              {/* Line 2: L-Pick + Qty + ADD */}
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                <span className="shrink-0 font-semibold text-[16px] text-[#1d2b4d] sm:text-[18px]">L-Pick:</span>
                <select
                  value={lPickType}
                  onChange={(e) => setLPickType(e.target.value)}
                  className="h-10 min-w-[7.5rem] rounded-full border border-[#d1d1d1] px-3 text-[15px] sm:h-11 sm:px-4 sm:text-[16px]"
                >
                  {LPICK_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt.toUpperCase()}
                    </option>
                  ))}
                </select>
                <span className="shrink-0 font-semibold text-[16px] text-[#1d2b4d] sm:text-[18px]">Qty</span>
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
                  readOnly={isMobileView}
                  inputMode={isMobileView ? 'none' : 'numeric'}
                  onKeyDown={(e) => {
                    if (isMobileView) e.preventDefault();
                  }}
                  onChange={(e) => {
                    setActiveInputIndex(3);
                    setQty(e.target.value.replace(/\D/g, '').slice(0, 3));
                  }}
                  placeholder="Qty"
                  className="h-10 w-[4.25rem] shrink-0 rounded-full border border-[#d1d1d1] px-2 text-center text-[15px] sm:h-11 sm:w-[76px] sm:text-[16px]"
                />
                {qty ? (
                  <button
                    type="button"
                    onClick={addBet}
                    className="h-10 shrink-0 rounded-full border border-[#2e59c6] bg-white px-4 text-[15px] font-semibold text-[#2e59c6] sm:h-11 sm:px-5 sm:text-[16px]"
                  >
                    ADD
                  </button>
                ) : null}
              </div>
              </div>
              {/* Line 3: Rate — one clear row */}
              <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto rounded-lg bg-[#f8fafc] px-2 py-2 sm:gap-3 sm:px-3">
                <span className="shrink-0 font-semibold text-[16px] text-[#1d2b4d] sm:text-[18px]">Rate:</span>
                <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
                  {RATE_OPTIONS.map((rate) => (
                    <label
                      key={rate}
                      className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#cbd5e1] bg-white px-2.5 shadow-sm sm:h-10 sm:px-3"
                    >
                      <input type="radio" className="size-4 accent-[#2e59c6]" checked={selectedRate === rate} onChange={() => setSelectedRate(rate)} />
                      <span className="text-[15px] font-bold leading-none text-[#1e293b] sm:text-[17px]">{rate}</span>
                    </label>
                  ))}
                </div>
              </div>
              </div>
              <div className="w-full min-w-0 shrink-0 border-t border-[#e5e7eb] pt-1">
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
                        className={`${isZoomCompactView ? 'min-h-[2.3rem] basis-[4.5rem] px-2 py-1.5 text-[15px] sm:min-h-[2.5rem] sm:text-[16px]' : 'min-h-[2.75rem] basis-[5.25rem] px-3 py-2 text-[18px] sm:min-h-[3.25rem] sm:basis-0 sm:px-7 sm:text-[22px]'} flex-1 rounded-xl bg-gradient-to-b from-emerald-400 via-emerald-500 to-emerald-700 font-bold tracking-wide text-white shadow-[0_4px_16px_rgba(5,150,105,0.42)] ring-1 ring-white/35 transition hover:brightness-110 active:scale-[0.98]`}
                      >
                        BUY
                      </button>
                      <button
                        type="button"
                        onClick={handleClearAll}
                        className={`${isZoomCompactView ? 'min-h-[2.3rem] basis-[4rem] px-2 py-1.5 text-[14px] sm:min-h-[2.5rem] sm:text-[16px]' : 'min-h-[2.75rem] basis-[4.25rem] px-3 py-2 text-[17px] sm:min-h-[3.25rem] sm:basis-0 sm:px-7 sm:text-[22px]'} flex-1 rounded-xl bg-gradient-to-b from-rose-500 via-rose-600 to-red-700 font-bold tracking-wide text-white shadow-[0_4px_16px_rgba(225,29,72,0.4)] ring-1 ring-white/30 transition hover:brightness-110 active:scale-[0.98]`}
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={handleAdvance}
                        className={`${isZoomCompactView ? 'min-h-[2.3rem] basis-[4.25rem] px-2 py-1.5 text-[14px] sm:min-h-[2.5rem] sm:text-[16px]' : 'min-h-[2.75rem] basis-[4.75rem] px-3 py-2 text-[17px] sm:min-h-[3.25rem] sm:basis-0 sm:px-7 sm:text-[22px]'} flex-1 rounded-xl bg-gradient-to-b from-violet-500 via-indigo-600 to-indigo-800 font-bold tracking-wide text-white shadow-[0_4px_16px_rgba(79,70,229,0.4)] ring-1 ring-white/35 transition hover:brightness-110 active:scale-[0.98]`}
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
              {validationMsg ? <div className="mt-1 shrink-0 text-[12px] font-semibold text-[#d4372f] sm:text-[13px]">{validationMsg}</div> : null}
            </div>

            <div className="order-1 flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border-2 border-[#d9d9d9] bg-white p-3">
              {!bets.length ? (
                <div className="flex min-h-[200px] flex-1 items-center justify-center text-[clamp(1.25rem,3vw,2.625rem)] text-[#9a9a9a] sm:min-h-0">No bets placed yet</div>
              ) : (
                <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto">
                <div className="grid w-full min-w-0 gap-3 [grid-template-columns:repeat(auto-fit,minmax(5.75rem,1fr))]">
                  {bets.map((bet) => {
                    const panelKey = String(bet.panels || '').trim().toUpperCase();
                    const panelHeaderClass = BET_CARD_PANEL_HEADER[panelKey] || BET_CARD_PANEL_HEADER.A;
                    const shellClass =
                      bet.outcome === 'win'
                        ? 'border border-emerald-300/85 bg-gradient-to-b from-emerald-50/95 via-white to-white shadow-[0_4px_16px_rgba(5,150,105,0.18)] ring-1 ring-emerald-200/50'
                        : bet.outcome === 'loss'
                          ? 'border border-rose-300/85 bg-gradient-to-b from-rose-50/95 via-white to-white shadow-[0_4px_16px_rgba(225,29,72,0.14)] ring-1 ring-rose-200/45'
                          : 'border border-slate-200/90 bg-gradient-to-b from-white via-slate-50/60 to-slate-100/50 shadow-[0_4px_14px_rgba(15,23,42,0.09)] ring-1 ring-slate-200/40';
                    return (
                    <div
                      key={bet.id}
                      className={`min-w-0 w-full max-w-full overflow-hidden rounded-xl ${shellClass} ${bet.justAdded ? 'animate-pulse' : ''}`}
                    >
                      <div className={`flex h-8 items-center justify-center text-[15px] font-bold tracking-wide text-white drop-shadow-sm ${panelHeaderClass}`}>
                        {panelKey || '-'}
                      </div>
                      <div className="px-2.5 py-2.5 text-center">
                        <div className="text-[22px] font-bold leading-none tracking-tight text-slate-900">{getDisplayBetNumber(bet)}</div>
                        <div className="mt-1 text-[13px] font-bold uppercase leading-none tracking-wide text-slate-500">{bet.mode}</div>
                        <div className="mt-1 text-[12px] font-semibold leading-none text-slate-500">Price {bet.rate}</div>
                        <button
                          type="button"
                          onClick={() => setBets((prev) => prev.filter((x) => x.id !== bet.id))}
                          className="mx-auto mt-2 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-b from-rose-500 to-red-700 text-[16px] font-bold leading-none text-white shadow-[0_2px_10px_rgba(220,38,38,0.4)] ring-1 ring-white/30 transition hover:brightness-110 active:scale-95"
                          aria-label="Remove bet"
                        >
                          ×
                        </button>
                      </div>
                      {bet.outcome ? (
                        <div className="border-t border-slate-200/70 bg-slate-50/80 px-2 pb-2 pt-1.5 text-[10px] text-center sm:text-[11px]">
                          <span className={`font-bold ${bet.outcome === 'win' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {bet.outcome.toUpperCase()}
                          </span>
                          <div className="mt-0.5 font-medium text-slate-600">Panel: {bet.matchedPanel || '-'}</div>
                          <div className="font-medium text-slate-600">Result: {bet.matchedResult || '-'}</div>
                        </div>
                      ) : null}
                    </div>
                  )})}
                </div>
                </div>
              )}
            </div>
            </div>

          </div>

          <div className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleMotorPick}
                className="h-12 rounded-xl bg-gradient-to-b from-orange-600 via-red-600 to-red-800 text-[21px] font-bold tracking-wide text-white shadow-[0_4px_14px_rgba(220,38,38,0.4)] ring-1 ring-white/30 transition hover:brightness-110 active:scale-[0.98] sm:text-[23px]"
              >
                Motor
              </button>
              <button
                type="button"
                onClick={handleLuckyPick}
                className="h-12 rounded-xl bg-gradient-to-b from-amber-300 via-amber-400 to-yellow-500 text-[19px] font-bold tracking-wide text-amber-950 shadow-[0_4px_14px_rgba(245,158,11,0.45)] ring-1 ring-amber-100/60 transition hover:brightness-110 active:scale-[0.98] sm:text-[21px]"
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
                  setPoints('0');
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
                  setPoints((prev) => {
                    const next = String(prev || '').slice(0, -1);
                    return next || '0';
                  });
                  setInputNumber((prev) => prev.slice(0, -1));
                } else if (focusedIndex === 1) setRangeFrom((prev) => prev.slice(0, -1));
                else if (focusedIndex === 2) setRangeTo((prev) => prev.slice(0, -1));
                else if (focusedIndex === 3) setQty((prev) => prev.slice(0, -1));
                else setInputNumber((prev) => prev.slice(0, -1));
                if (validationMsg) setValidationMsg('');
              }}
              onIncreasePoint={() => {
                setActiveInputIndex(-1);
                setPoints(String(pointValue + 1));
              }}
              onDecreasePoint={() => {
                setActiveInputIndex(-1);
                setPoints(String(Math.max(0, pointValue - 1)));
              }}
              onSelectPointBox={() => setActiveInputIndex(-1)}
              isPointBoxActive={activeInputIndex === -1}
              onNext={handleNextFromKeypad}
              points={pointValue}
            />
            </div>
          </div>
          </div>
        </div>

        {buySummary ? (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-lg border border-[#d9d9d9] shadow-xl p-4">
              <h3 className="text-[22px] font-bold text-[#1d2b4d]">Bet Summary</h3>
              <div className="mt-3 space-y-1 text-[15px]">
                <div>Total Bets: <span className="font-semibold">{buySummary.totalBets}</span></div>
                <div>Winning Bets: <span className="font-semibold text-[#2ca44f]">{buySummary.matched}</span></div>
                <div>Total Win: <span className="font-semibold text-[#2ca44f]">{buySummary.totalWinPoints}</span></div>
                <div>Total Loss: <span className="font-semibold text-[#d4372f]">{buySummary.totalLossPoints}</span></div>
                <div>Net Result: <span className={`font-semibold ${buySummary.netResult >= 0 ? 'text-[#2ca44f]' : 'text-[#d4372f]'}`}>{buySummary.netResult}</span></div>
                <div>Ticket Outcome: <span className={`font-semibold ${buySummary.outcome === 'win' ? 'text-[#2ca44f]' : 'text-[#d4372f]'}`}>{buySummary.outcome?.toUpperCase?.() || '-'}</span></div>
                <div>Last Win Amount: <span className="font-semibold text-[#2ca44f]">{buySummary.lastWinAmount}</span></div>
              </div>
              <button type="button" onClick={() => setBuySummary(null)} className="mt-4 w-full h-11 bg-[#2e59c6] border border-[#264ca7] rounded text-white font-semibold">
                Close
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
        <TicketDetailsModal
          open={Boolean(selectedTicket)}
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
        />
        {isResultModalOpen ? (
          <div className="fixed inset-0 z-[88] flex items-center justify-center bg-black/60 p-2 sm:p-4">
            <div className="flex max-h-[94vh] w-full max-w-[1220px] flex-col overflow-hidden rounded-2xl border border-[#8d8d8d] bg-[#d4d7dd] shadow-2xl">
              <div className="flex items-center justify-between bg-[#e5354c] px-3 py-2 text-white sm:px-6 sm:py-3">
                <h3 className="truncate text-[clamp(1rem,4vw,2.5rem)] font-black tracking-wide">
                  3D Result <span className="ml-2">{`${resultDateDay}-${resultDateMonth}-${resultDateYear}`}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsResultModalOpen(false)}
                  className="rounded bg-black/10 px-3 py-1 text-[26px] font-bold leading-none hover:bg-black/20 sm:text-[40px]"
                  aria-label="Close result modal"
                >
                  ×
                </button>
              </div>
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 bg-[#cfd4dc] p-2 sm:p-3 lg:grid-cols-[minmax(0,1fr)_240px]">
                <div className="min-h-0 overflow-hidden rounded-xl border border-[#babec7] bg-[#e5e7eb] p-2 sm:p-3">
                  <div className="min-h-0 overflow-auto">
                    <div className="min-w-[620px]">
                      <div className="grid grid-cols-[84px_repeat(3,minmax(0,1fr))] gap-1.5 sm:grid-cols-[98px_repeat(3,minmax(0,1fr))] sm:gap-2">
                        <div className="flex h-10 items-center justify-center rounded-md border border-[#9ca3af] bg-[#f3f4f6] text-[19px] font-black text-[#374151] sm:h-12 sm:text-[30px]">
                          TIME
                        </div>
                        <div className="flex h-10 items-center justify-center rounded-md bg-gradient-to-b from-[#3f66c9] to-[#2f4ea6] text-[22px] font-black text-white sm:h-12 sm:text-[34px]">A</div>
                        <div className="flex h-10 items-center justify-center rounded-md bg-gradient-to-b from-[#ea4f08] to-[#cc3f00] text-[22px] font-black text-white sm:h-12 sm:text-[34px]">B</div>
                        <div className="flex h-10 items-center justify-center rounded-md bg-gradient-to-b from-[#31925d] to-[#2b7f52] text-[22px] font-black text-white sm:h-12 sm:text-[34px]">C</div>
                      </div>
                      <div className="mt-2 max-h-[52vh] space-y-1.5 overflow-y-auto pr-1 sm:space-y-2">
                        {resultModalRows.length ? resultModalRows.map((row) => (
                          <div key={row.id} className="grid grid-cols-[84px_repeat(3,minmax(0,1fr))] gap-1.5 sm:grid-cols-[98px_repeat(3,minmax(0,1fr))] sm:gap-2">
                            <div className="flex h-[60px] items-center justify-center rounded-md border border-[#9ca3af] bg-black px-1 text-[16px] font-black leading-tight text-white sm:h-[84px] sm:text-[30px]">
                              {row.time}
                            </div>
                            <div className="grid h-[60px] grid-cols-3 overflow-hidden rounded-md border border-[#5f77b8] bg-gradient-to-b from-[#3f66c9] to-[#2f4ea6] text-[clamp(1.6rem,4vw,3.2rem)] font-black text-white sm:h-[84px]">
                              {row.A.split('').map((digit, idx) => (
                                <span key={`A-${row.id}-${idx}`} className="flex items-center justify-center border-r border-white/35 last:border-r-0">{digit}</span>
                              ))}
                            </div>
                            <div className="grid h-[60px] grid-cols-3 overflow-hidden rounded-md border border-[#b65935] bg-gradient-to-b from-[#ea4f08] to-[#cc3f00] text-[clamp(1.6rem,4vw,3.2rem)] font-black text-white sm:h-[84px]">
                              {row.B.split('').map((digit, idx) => (
                                <span key={`B-${row.id}-${idx}`} className="flex items-center justify-center border-r border-white/35 last:border-r-0">{digit}</span>
                              ))}
                            </div>
                            <div className="grid h-[60px] grid-cols-3 overflow-hidden rounded-md border border-[#4b8d68] bg-gradient-to-b from-[#31925d] to-[#2b7f52] text-[clamp(1.6rem,4vw,3.2rem)] font-black text-white sm:h-[84px]">
                              {row.C.split('').map((digit, idx) => (
                                <span key={`C-${row.id}-${idx}`} className="flex items-center justify-center border-r border-white/35 last:border-r-0">{digit}</span>
                              ))}
                            </div>
                          </div>
                        )) : (
                          <div className="rounded-md border border-[#b8bfca] bg-[#f8fafc] px-4 py-6 text-center text-[16px] font-semibold text-[#475569]">
                            No result found for selected date.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex min-h-[170px] flex-col rounded-xl border border-[#babec7] bg-[#dde1e8] p-3 sm:min-h-[210px] sm:p-4">
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[30px] font-black text-[#1f2937] sm:text-[42px]">
                    <span className="shrink-0">Date :</span>
                    <input
                      type="text"
                      value={resultDateDay}
                      onChange={(e) => setResultDateDay(e.target.value.replace(/\D/g, '').slice(0, 2))}
                      className="h-14 w-14 rounded-lg border border-[#c2c6ce] bg-[#f3f4f6] text-center text-[30px] font-black text-[#4b5563] sm:h-[72px] sm:w-[74px] sm:text-[36px]"
                    />
                    <input
                      type="text"
                      value={resultDateMonth}
                      onChange={(e) => setResultDateMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
                      className="h-14 w-14 rounded-lg border border-[#c2c6ce] bg-[#f3f4f6] text-center text-[30px] font-black text-[#4b5563] sm:h-[72px] sm:w-[74px] sm:text-[36px]"
                    />
                    <input
                      type="text"
                      value={resultDateYear}
                      onChange={(e) => setResultDateYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      className="h-14 w-[82px] rounded-lg border border-[#c2c6ce] bg-[#f3f4f6] text-center text-[30px] font-black text-[#4b5563] sm:h-[72px] sm:w-[96px] sm:text-[36px]"
                    />
                  </div>
                  <div className="mt-auto pt-4 sm:pt-6">
                    <button
                      type="button"
                      onClick={applyResultDateFilter}
                      className="h-12 w-full rounded-xl bg-[#234372] text-[26px] font-black text-white shadow-[0_6px_18px_rgba(15,23,42,0.35)] sm:h-[86px] sm:text-[45px]"
                    >
                      Show Result
                    </button>
                  </div>
                </div>
              </div>
              {lastTicket ? (
                <div className="border-t border-[#b9bec7] bg-[#d4d7dd] px-5 py-3 text-[14px] font-semibold text-[#374151]">
                  Last Ticket: <span className="font-bold">{lastTicket.gameId}</span> | Outcome:{' '}
                  <span className={lastTicket.outcome === 'win' ? 'text-[#15803d]' : 'text-[#b91c1c]'}>
                    {String(lastTicket.outcome || '-').toUpperCase()}
                  </span>{' '}
                  | Win: <span className="font-bold">{lastTicket.totalWin ?? 0}</span>
                </div>
              ) : null}
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
