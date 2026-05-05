import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import TopHeader from '../components/TopHeader';
import QuizSelector from '../components/QuizSelector';
import StatusStrip from '../components/StatusStrip';
import NumberBoard from '../components/NumberBoard';
import SummaryPanel from '../components/SummaryPanel';
import ControlPanel from '../components/ControlPanel';
import AdvanceDrawModal from '../components/AdvanceDrawModal';
import ResultHistoryModal from '../components/ResultHistoryModal';
import MyBetsModal from '../components/MyBetsModal';
import { getBalance, updateUserBalance } from '../api/bets';
import { getQuizSlot, getQuizSlotResults, postQuizBetsBatch } from '../api/quizApi';
import { DEFAULT_TIMER_SECONDS, FILTER_TYPES } from '../types';
import { formatTimer, getCellKey, getFamilyNumbers, getLotterySetTotals, getTotals } from '../utils/boardHelpers';
import { getCurrentUser, isUserLoggedIn, subscribeUserSession } from '../session/userSession';

const MAX_QUIZ_NUMBERS_PER_SLOT = 100;
/** Keypad stake entry: max 3 digits (1–999). */
const MAX_LOTTERY_AMOUNT = 999;
const MAX_LOTTERY_AMOUNT_DIGITS = 3;
const LotteryDashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const BASE_WIDTH = 1536;
  const BASE_HEIGHT = 864;
  const colApplyTimersRef = useRef({});
  const rowApplyTimersRef = useRef({});
  const autoApplyTimerRef = useRef(null);
  const prevKeypadDraftRef = useRef('2');
  const prevPendingTargetKeyRef = useRef('');
  const appliedAmountByTargetRef = useRef({});
  const lastLandscapeAutoFsAttemptRef = useRef(0);
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : BASE_WIDTH,
    height: typeof window !== 'undefined' ? window.innerHeight : BASE_HEIGHT,
  }));
  const [clockNow, setClockNow] = useState(() => new Date());
  const [activeQuiz, setActiveQuiz] = useState(1);
  const [selectedQuizzes, setSelectedQuizzes] = useState([1]);
  const [multi, setMulti] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showMyBets, setShowMyBets] = useState(false);
  const [showBuyConfirm, setShowBuyConfirm] = useState(false);
  const [buyConfirmError, setBuyConfirmError] = useState('');
  const [buyProcessing, setBuyProcessing] = useState(false);
  const buyConfirmInFlightRef = useRef(false);
  const [pendingRemoveBetLineKey, setPendingRemoveBetLineKey] = useState('');
  const [showAdvanceDrawModal, setShowAdvanceDrawModal] = useState(false);
  const [selectedAdvanceSlots, setSelectedAdvanceSlots] = useState([]);
  const [advanceSelectionNotice, setAdvanceSelectionNotice] = useState('');
  const [serverSlot, setServerSlot] = useState(null);
  const [slotSyncErr, setSlotSyncErr] = useState('');
  const [showRotatePrompt, setShowRotatePrompt] = useState(false);
  const [rotatePromptDismissed, setRotatePromptDismissed] = useState(false);
  const [uiNotice, setUiNotice] = useState('');
  const [uiToast, setUiToast] = useState('');
  const [enteredAmount, setEnteredAmount] = useState(2);
  const [amountDraft, setAmountDraft] = useState('2');
  const [pendingTarget, setPendingTarget] = useState(null);
  const [activeFilter, setActiveFilter] = useState(FILTER_TYPES.ALL);
  const [selectedNumbers, setSelectedNumbers] = useState(() => new Set());
  const [familyMode, setFamilyMode] = useState(false);
  const [selectedMap, setSelectedMap] = useState({});
  const [rowPointDisplay, setRowPointDisplay] = useState(() => Array.from({ length: 10 }, () => ''));
  const [colPointDisplay, setColPointDisplay] = useState(() => Array.from({ length: 10 }, () => ''));
  const [timerSeconds, setTimerSeconds] = useState(DEFAULT_TIMER_SECONDS);
  /** Latest completed slot: quizId → winning position (00–99); empty if none / error. */
  const [lastSlotByQuiz, setLastSlotByQuiz] = useState({});
  /** Draw end time label for that slot (IST, same as Old Results chart), e.g. "4:00 PM". */
  const [prevSlotDrawEndLabel, setPrevSlotDrawEndLabel] = useState('');
  const [walletBalance, setWalletBalance] = useState(0);
  const ALL_QUIZZES = useMemo(() => Array.from({ length: 30 }, (_, i) => i + 1), []);

  useEffect(() => {
    const quiz = searchParams.get('quiz');
    const quizzes = searchParams.get('quizzes');
    const multiParam = searchParams.get('multi');
    if (!quiz && !quizzes) return;

    if (quizzes) {
      const nums = quizzes
        .split(',')
        .map((s) => parseInt(String(s).trim(), 10))
        .filter((n) => n >= 1 && n <= 30);
      if (nums.length) {
        setSelectedQuizzes(nums);
        setActiveQuiz(nums[0]);
        setMulti(multiParam === '1' || multiParam === 'true' || nums.length > 1);
      }
    } else {
      const n = parseInt(quiz, 10);
      if (n >= 1 && n <= 30) {
        setActiveQuiz(n);
        setSelectedQuizzes([n]);
        setMulti(false);
      }
    }
    appliedAmountByTargetRef.current = {};
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);
  const dashboardScaleX = useMemo(() => viewport.width / BASE_WIDTH, [viewport.width]);
  const dashboardScaleY = useMemo(() => viewport.height / BASE_HEIGHT, [viewport.height]);
  const effectiveScaleX = useMemo(() => dashboardScaleX, [dashboardScaleX]);
  const effectiveScaleY = useMemo(() => dashboardScaleY, [dashboardScaleY]);
  const getQuarterHourCountdown = useCallback((nowDate = new Date()) => {
    const mins = nowDate.getMinutes();
    const secs = nowDate.getSeconds();
    const elapsedInQuarter = (mins % 15) * 60 + secs;
    const remaining = DEFAULT_TIMER_SECONDS - elapsedInQuarter;
    return remaining <= 0 ? DEFAULT_TIMER_SECONDS : remaining;
  }, []);

  const loadStoredBalance = useCallback(() => {
    try {
      const user = getCurrentUser() || {};
      const b = user?.balance ?? user?.walletBalance ?? user?.wallet ?? 0;
      setWalletBalance(Number(b) || 0);
    } catch (_) {
      setWalletBalance(0);
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
      const shouldShowRotatePrompt = isMobile && isPortrait && !rotatePromptDismissed;
      setShowRotatePrompt(shouldShowRotatePrompt);

      // Allow showing the helper overlay again when user rotates to landscape.
      if (!isMobile || !isPortrait) {
        setRotatePromptDismissed(false);
      }

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
  }, [rotatePromptDismissed]);

  const handleRotateLandscape = useCallback(async () => {
    setRotatePromptDismissed(true);
    setShowRotatePrompt(false);
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

  useEffect(() => {
    const syncClockAndTimer = () => {
      const now = new Date();
      setClockNow(now);
      setTimerSeconds(getQuarterHourCountdown(now));
    };
    syncClockAndTimer();
    const timer = setInterval(syncClockAndTimer, 1000);
    return () => clearInterval(timer);
  }, [getQuarterHourCountdown]);

  useEffect(() => {
    let stop = false;
    const sync = () => {
      getQuizSlot()
        .then((j) => {
          if (stop) return;
          if (j.success && j.data) setServerSlot(j.data);
          else setServerSlot(null);
          setSlotSyncErr('');
        })
        .catch((e) => {
          if (!stop) setSlotSyncErr(e.message || '');
        });
    };
    sync();
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stop = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  useEffect(() => {
    if (!advanceSelectionNotice) return undefined;
    const t = setTimeout(() => setAdvanceSelectionNotice(''), 1400);
    return () => clearTimeout(t);
  }, [advanceSelectionNotice]);

  useEffect(() => {
    if (!uiToast) return undefined;
    const t = setTimeout(() => setUiToast(''), 1500);
    return () => clearTimeout(t);
  }, [uiToast]);

  useEffect(() => {
    let stop = false;
    const loadLastSlot = () => {
      getQuizSlotResults(1, '2d')
        .then((j) => {
          if (stop) return;
          const slot = Array.isArray(j?.data) ? j.data[0] : null;
          const timeLabel =
            typeof slot?.drawLabelEnd === 'string' && slot.drawLabelEnd.trim() !== ''
              ? slot.drawLabelEnd.trim()
              : '';
          setPrevSlotDrawEndLabel(timeLabel);
          const picks = slot?.picks;
          if (!Array.isArray(picks)) {
            setLastSlotByQuiz({});
            return;
          }
          const next = {};
          for (const p of picks) {
            const q = p?.quizId;
            if (Number.isInteger(q) && q >= 1 && q <= 30) {
              next[q] = p.winningPosition ?? null;
            }
          }
          setLastSlotByQuiz(next);
        })
        .catch(() => {
          if (!stop) {
            setLastSlotByQuiz({});
            setPrevSlotDrawEndLabel('');
          }
        });
    };
    loadLastSlot();
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadLastSlot();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stop = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    loadStoredBalance();
    refreshWalletBalance();

    const unsubscribe = subscribeUserSession(() => loadStoredBalance());
    const handleUserLogin = () => loadStoredBalance();
    const handleUserLogout = () => loadStoredBalance();
    const handleBalanceUpdated = (e) => {
      const nextBalance = e?.detail?.balance;
      if (nextBalance != null) {
        setWalletBalance(Number(nextBalance) || 0);
      } else {
        loadStoredBalance();
      }
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
  }, [loadStoredBalance, refreshWalletBalance]);

  const totals = useMemo(() => getTotals(selectedMap), [selectedMap]);
  const setTotals = useMemo(() => getLotterySetTotals(selectedMap), [selectedMap]);
  const betLines = useMemo(
    () => Object.entries(selectedMap)
      .map(([key, amt]) => {
        const parts = String(key).split('-');
        const quizId = parseInt(parts[0], 10);
        const num = parseInt(parts[1], 10);
        const amount = Number(amt);
        if (!Number.isFinite(amount) || amount <= 0) return null;
        if (!Number.isInteger(quizId) || quizId < 1 || quizId > 30) return null;
        if (!Number.isInteger(num) || num < 0 || num > 99) return null;
        return {
          key,
          quizId,
          num,
          amount: Math.min(MAX_LOTTERY_AMOUNT, Math.floor(amount)),
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a.quizId - b.quizId) || (a.num - b.num)),
    [selectedMap],
  );

  const exceedsMaxNumbersPerQuiz = useMemo(() => {
    const perQuiz = new Map();
    for (const key of Object.keys(selectedMap || {})) {
      const parts = String(key).split('-');
      const q = parseInt(parts[0], 10);
      const n = parseInt(parts[1], 10);
      if (!Number.isInteger(q) || q < 1 || q > 30 || !Number.isInteger(n) || n < 0 || n > 99) continue;
      if (!perQuiz.has(q)) perQuiz.set(q, new Set());
      perQuiz.get(q).add(n);
    }
    for (const set of perQuiz.values()) {
      if (set.size > MAX_QUIZ_NUMBERS_PER_SLOT) return true;
    }
    return false;
  }, [selectedMap]);

  /** Backend sends acceptsBets; older servers fall back to hint-only. */
  const slotOpenForBuy = useMemo(() => {
    if (!serverSlot?.slotStartIso) return false;
    if (serverSlot.acceptsBets === true) return true;
    if (serverSlot.acceptsBets === false) return false;
    return serverSlot.phase === 'hint';
  }, [serverSlot]);

  const buyHelpLines = useMemo(() => {
    const lines = [];
    if (slotSyncErr) {
      lines.push(`Server: ${slotSyncErr}`);
      return lines;
    }
    if (!serverSlot?.slotStartIso) {
      lines.push('Server slot is loading. Please wait.');
      return lines;
    }
    if (!slotOpenForBuy) {
      lines.push('BUY works only during the current 15-minute draw slot (not after slot closes).');
      const sec = Math.max(0, Number(serverSlot.secondsUntilSlotEnd) || 0);
      if (sec > 0) lines.push(`Time left in this slot: ${formatCountdown(sec)}`);
    }
    if (exceedsMaxNumbersPerQuiz) {
      lines.push(`Max ${MAX_QUIZ_NUMBERS_PER_SLOT} unique numbers (00-99) per quiz - reduce selection or RESET.`);
    }
    if (selectedAdvanceSlots.length) {
      lines.push(`Advance Draw: ${selectedAdvanceSlots.length} future slot(s) selected.`);
    }
    return lines;
  }, [slotSyncErr, serverSlot, exceedsMaxNumbersPerQuiz, slotOpenForBuy, selectedAdvanceSlots.length]);

  const formatAdvanceSlotLabel = useCallback((iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d).replace(/\s?(am|pm)$/i, (m) => ` ${m.trim().toUpperCase()}`);
  }, []);

  const advanceDrawSlots = useMemo(() => {
    const base = serverSlot?.slotStartIso ? new Date(serverSlot.slotStartIso) : new Date();
    if (Number.isNaN(base.getTime())) return [];
    const startMs = base.getTime() + (15 * 60 * 1000);
    return Array.from({ length: 47 }, (_, idx) => {
      const slotStartMs = startMs + (idx * 15 * 60 * 1000);
      const slotStartIso = new Date(slotStartMs).toISOString();
      return { slotStartIso, label: formatAdvanceSlotLabel(slotStartIso) };
    });
  }, [formatAdvanceSlotLabel, serverSlot?.slotStartIso]);
  const buyTargetSlotLabels = useMemo(() => {
    const targetSlots = selectedAdvanceSlots.length ? [...selectedAdvanceSlots] : [serverSlot?.slotStartIso].filter(Boolean);
    return targetSlots.map((slotStartIso) => formatAdvanceSlotLabel(new Date(new Date(slotStartIso).getTime() + (15 * 60 * 1000)).toISOString()));
  }, [formatAdvanceSlotLabel, selectedAdvanceSlots, serverSlot?.slotStartIso]);

  const buyDisabled =
    totals.totalAmount <= 0 ||
    !!slotSyncErr ||
    !serverSlot?.slotStartIso ||
    (!slotOpenForBuy && selectedAdvanceSlots.length === 0) ||
    exceedsMaxNumbersPerQuiz;

  const handleQuizToggle = useCallback((quizNo) => {
    setActiveQuiz(quizNo);
    if (!multi) {
      setSelectedQuizzes([quizNo]);
      appliedAmountByTargetRef.current = {};
      return;
    }
    setSelectedQuizzes((prev) => {
      if (!prev.includes(quizNo)) return [...prev, quizNo];
      if (prev.length === 1) return prev;
      return prev.filter((q) => q !== quizNo);
    });
    appliedAmountByTargetRef.current = {};
  }, [multi]);

  const handleAllToggle = useCallback((checked) => {
    appliedAmountByTargetRef.current = {};
    if (checked) {
      setMulti(true);
      setSelectedQuizzes(ALL_QUIZZES);
      return;
    }
    setSelectedQuizzes([activeQuiz]);
  }, [ALL_QUIZZES, activeQuiz]);

  const handleSetToggle = useCallback((setName, checked) => {
    const setRanges = {
      'Set A': [1, 10],
      'Set B': [11, 20],
      'Set C': [21, 30],
    };
    const [start, end] = setRanges[setName] || [];
    if (!Number.isInteger(start) || !Number.isInteger(end)) return;
    const setQuizNos = Array.from({ length: end - start + 1 }, (_, idx) => start + idx);

    appliedAmountByTargetRef.current = {};
    setMulti(true);
    setSelectedQuizzes((prev) => {
      if (checked) {
        return setQuizNos;
      }
      const next = (Array.isArray(prev) ? prev : []).filter((q) => !setQuizNos.includes(q));
      return next.length ? next : [activeQuiz];
    });
    if (checked) setActiveQuiz(start);
  }, [activeQuiz]);

  const setAmountFromNumber = useCallback((num) => {
    const safeAmount = Math.min(MAX_LOTTERY_AMOUNT, Math.max(1, Number(num) || 1));
    setEnteredAmount(safeAmount);
    setAmountDraft(String(safeAmount));
  }, []);

  const getTargetKey = useCallback((target) => {
    if (!target) return '';
    const quizzesKey = (multi ? [...selectedQuizzes].sort((a, b) => a - b) : [activeQuiz]).join(',');
    return `${quizzesKey}-${target.type}-${target.index}`;
  }, [activeQuiz, multi, selectedQuizzes]);

  const isNumberVisible = useCallback((num) => {
    if (activeFilter === FILTER_TYPES.EVEN) return num % 2 === 0;
    if (activeFilter === FILTER_TYPES.ODD) return num % 2 !== 0;
    return true;
  }, [activeFilter]);

  const handleSelectTarget = useCallback(
    (target) => {
      if (target?.type === 'cell') {
        const num = Number(target.index);
        const formatted = String(num).padStart(2, '0');
        setSelectedNumbers((prev) => {
          if (familyMode) {
            const family = getFamilyNumbers(num);
            const isSameFamilySelected =
              prev.size === family.size && [...family].every((n) => prev.has(n));
            if (isSameFamilySelected) return new Set();
            return new Set(family);
          }
          const next = new Set(prev);
          if (next.has(formatted)) next.delete(formatted);
          else next.add(formatted);
          return next;
        });
      }
      const currentKey = getTargetKey(pendingTarget);
      const nextKey = getTargetKey(target);

      if (currentKey !== nextKey) {
        let draftToSet = '';
        let enteredToSet = 0;
        if (target?.type === 'cell') {
          const quizzesToApply = multi ? selectedQuizzes : [activeQuiz];
          let existing = 0;
          quizzesToApply.forEach((quizNo) => {
            const key = getCellKey(quizNo, target.index);
            existing = Math.max(existing, Number(selectedMap[key] || 0));
          });
          existing = Math.min(MAX_LOTTERY_AMOUNT, Math.max(0, Math.floor(existing)));
          if (existing > 0) {
            draftToSet = String(existing);
            enteredToSet = existing;
            appliedAmountByTargetRef.current[nextKey] = existing;
          }
        } else if (target?.type === 'row') {
          // After ENTER the ref map is cleared but stakes remain; restore delta baseline from the blue box / board.
          const existing = Math.min(
            MAX_LOTTERY_AMOUNT,
            Math.max(0, Math.floor(Number(rowPointDisplay[target.index] || 0))),
          );
          appliedAmountByTargetRef.current[nextKey] = existing;
          if (existing > 0) {
            draftToSet = String(existing);
            enteredToSet = existing;
          }
        } else if (target?.type === 'col') {
          const existing = Math.min(
            MAX_LOTTERY_AMOUNT,
            Math.max(0, Math.floor(Number(colPointDisplay[target.index] || 0))),
          );
          appliedAmountByTargetRef.current[nextKey] = existing;
          if (existing > 0) {
            draftToSet = String(existing);
            enteredToSet = existing;
          }
        }

        setEnteredAmount(enteredToSet);
        setAmountDraft(draftToSet);
        if (autoApplyTimerRef.current) {
          clearTimeout(autoApplyTimerRef.current);
          autoApplyTimerRef.current = null;
        }
      }

      setPendingTarget(target);
    },
    [activeQuiz, colPointDisplay, familyMode, getTargetKey, multi, pendingTarget, rowPointDisplay, selectedMap, selectedQuizzes],
  );

  const applyAmountToTarget = useCallback(
    (amount, target) => {
      if (!target) return;

      // Cells: keypad amount is the absolute stake on this number (per selected quiz). Supports decrease and clear.
      if (target.type === 'cell') {
        if (!isNumberVisible(target.index)) return;
        const amt = Math.max(0, Math.min(MAX_LOTTERY_AMOUNT, Math.floor(Number(amount || 0))));
        const targetKey = getTargetKey(target);
        setSelectedMap((prev) => {
          const next = { ...prev };
          const quizzesToApply = multi ? selectedQuizzes : [activeQuiz];
          const targetsToApply = familyMode && selectedNumbers.size
            ? [...selectedNumbers]
              .map((code) => parseInt(String(code), 10))
              .filter((n) => Number.isInteger(n) && n >= 0 && n <= 99 && isNumberVisible(n))
            : [target.index];

          targetsToApply.forEach((num) => {
            quizzesToApply.forEach((quizNo) => {
              const key = getCellKey(quizNo, num);
              if (amt <= 0) delete next[key];
              else next[key] = amt;
            });
          });
          return next;
        });
        appliedAmountByTargetRef.current[targetKey] = amt;
        return;
      }

      const safeAmount = Math.max(0, Math.min(MAX_LOTTERY_AMOUNT, Math.floor(Number(amount || 0))));
      if (target.type === 'col') {
        const hasVisibleInColumn = Array.from({ length: 10 }, (_, row) => row * 10 + target.index).some((n) =>
          isNumberVisible(n),
        );
        if (!hasVisibleInColumn) return;
      }

      const targetKey = getTargetKey(target);
      const prevApplied = Number(appliedAmountByTargetRef.current[targetKey] || 0);
      const deltaAmount = safeAmount - prevApplied;
      if (deltaAmount === 0) {
        appliedAmountByTargetRef.current[targetKey] = safeAmount;
        return;
      }

      setSelectedMap((prev) => {
        const next = { ...prev };
        const quizzesToApply = multi ? selectedQuizzes : [activeQuiz];
        if (target.type === 'row') {
          setRowPointDisplay((rp) => {
            const rowNext = [...rp];
            rowNext[target.index] = String(Math.floor(safeAmount));
            return rowNext;
          });
          for (let col = 0; col < 10; col += 1) {
            const num = target.index * 10 + col;
            if (!isNumberVisible(num)) continue;
            quizzesToApply.forEach((quizNo) => {
              const key = getCellKey(quizNo, num);
              next[key] = Math.max(0, Number(next[key] || 0) + deltaAmount);
            });
          }
        } else if (target.type === 'col') {
          const hasVisibleInColumn = Array.from({ length: 10 }, (_, row) => row * 10 + target.index).some((n) =>
            isNumberVisible(n),
          );
          if (!hasVisibleInColumn) return next;
          setColPointDisplay((cp) => {
            const colNext = [...cp];
            colNext[target.index] = String(Math.floor(safeAmount));
            return colNext;
          });
          for (let row = 0; row < 10; row += 1) {
            const num = row * 10 + target.index;
            if (!isNumberVisible(num)) continue;
            quizzesToApply.forEach((quizNo) => {
              const key = getCellKey(quizNo, num);
              next[key] = Math.max(0, Number(next[key] || 0) + deltaAmount);
            });
          }
        }
        return next;
      });
      appliedAmountByTargetRef.current[targetKey] = safeAmount;
    },
    [activeQuiz, familyMode, getTargetKey, isNumberVisible, multi, selectedNumbers, selectedQuizzes],
  );

  useEffect(() => {
    if (!pendingTarget) return;
    const amount = Number(amountDraft || 0);
    if (amount <= 0) return;
    if (autoApplyTimerRef.current) clearTimeout(autoApplyTimerRef.current);
    autoApplyTimerRef.current = setTimeout(() => {
      applyAmountToTarget(amount, pendingTarget);
      autoApplyTimerRef.current = null;
    }, 100);
    return () => {
      if (autoApplyTimerRef.current) clearTimeout(autoApplyTimerRef.current);
    };
  }, [amountDraft, applyAmountToTarget, pendingTarget]);

  /** After backspace (X) clears the keypad, sync empty draft to zero stake on the focused cell. */
  useEffect(() => {
    if (!pendingTarget || pendingTarget.type !== 'cell') return;
    if (amountDraft !== '') return;
    applyAmountToTarget(0, pendingTarget);
  }, [amountDraft, applyAmountToTarget, pendingTarget]);

  /** Same for row/column targets: absolute draft maps to applied delta; skip when target just changed (draft cleared by navigation). */
  useEffect(() => {
    const targetKey = pendingTarget ? getTargetKey(pendingTarget) : '';
    const prevDraft = prevKeypadDraftRef.current;
    const prevTargetKey = prevPendingTargetKeyRef.current;
    prevKeypadDraftRef.current = amountDraft;
    prevPendingTargetKeyRef.current = targetKey;

    if (!pendingTarget || (pendingTarget.type !== 'row' && pendingTarget.type !== 'col')) return;
    if (amountDraft !== '') return;
    if (prevDraft === '') return;
    if (targetKey !== prevTargetKey) return;
    applyAmountToTarget(0, pendingTarget);
  }, [amountDraft, applyAmountToTarget, pendingTarget, getTargetKey]);

  const applyFilter = useCallback((filterType) => {
    setActiveFilter(filterType || FILTER_TYPES.ALL);
  }, []);
  const toggleFamilyMode = useCallback(() => {
    setFamilyMode((prev) => !prev);
  }, []);

  const handleAdvanceDraw = useCallback(() => {
    setShowAdvanceDrawModal(true);
  }, []);

  const handleReset = useCallback(() => {
    setSelectedMap({});
    setSelectedNumbers(new Set());
    setFamilyMode(false);
    setActiveFilter(FILTER_TYPES.ALL);
    setMulti(false);
    setActiveQuiz(1);
    setSelectedQuizzes([1]);
    setPendingTarget(null);
    setAmountDraft('');
    setEnteredAmount(0);
    appliedAmountByTargetRef.current = {};
    setRowPointDisplay(Array.from({ length: 10 }, () => ''));
    setColPointDisplay(Array.from({ length: 10 }, () => ''));
    setSelectedAdvanceSlots([]);
  }, []);
  const handleMultiToggle = useCallback((checked) => {
    setMulti(checked);
    if (!checked) setSelectedQuizzes([activeQuiz]);
  }, [activeQuiz]);

  const handleKeypad = useCallback(
    (key) => {
      if (key === 'C') {
        if (autoApplyTimerRef.current) {
          clearTimeout(autoApplyTimerRef.current);
          autoApplyTimerRef.current = null;
        }
        setAmountDraft('');
        if (pendingTarget) {
          applyAmountToTarget(0, pendingTarget);
        }
        return;
      }
      if (key === 'X') {
        if (autoApplyTimerRef.current) {
          clearTimeout(autoApplyTimerRef.current);
          autoApplyTimerRef.current = null;
        }
        setAmountDraft((prev) => prev.slice(0, -1));
        return;
      }
      setAmountDraft((prev) => {
        const nextValue = (prev === '0' ? key : `${prev}${key}`).slice(0, MAX_LOTTERY_AMOUNT_DIGITS);
        return nextValue;
      });
    },
    [applyAmountToTarget, pendingTarget],
  );

  const openResults = useCallback(() => {
    setShowResults(true);
  }, []);

  const handleBackToHome = useCallback(async () => {
    // Back button should only navigate to home, never logout.
    try {
      const doc = document;
      const isInFullscreen = Boolean(
        doc.fullscreenElement
          || doc.webkitFullscreenElement
          || doc.mozFullScreenElement
          || doc.msFullscreenElement,
      );
      if (isInFullscreen) {
        const exitFullscreen =
          doc.exitFullscreen
          || doc.webkitExitFullscreen
          || doc.mozCancelFullScreen
          || doc.msExitFullscreen;
        if (typeof exitFullscreen === 'function') {
          await exitFullscreen.call(doc);
        }
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

  const handleBoardBuy = useCallback(async () => {
    const fail = (msg) => {
      setUiNotice(msg);
      return { ok: false, error: msg };
    };
    if (!isUserLoggedIn()) {
      return fail('Please login to buy tickets (account / wallet).');
    }
    if (!serverSlot?.slotStartIso) {
      return fail('Server slot not available. Please try again.');
    }
    if (!slotOpenForBuy && selectedAdvanceSlots.length === 0) {
      return fail('BUY works only while the current 15-minute draw slot is open. Wait for next slot if closed.');
    }

    if (!betLines.length) {
      return fail('Please add amount on board first.');
    }

    const byQuiz = new Map();
    for (const s of betLines) {
      if (!byQuiz.has(s.quizId)) byQuiz.set(s.quizId, []);
      byQuiz.get(s.quizId).push({ num: s.num, amount: s.amount });
    }

    const quizIdsSorted = [...byQuiz.keys()].sort((a, b) => a - b);
    for (const quizId of quizIdsSorted) {
      const amountByNum = new Map();
      for (const { num, amount } of byQuiz.get(quizId)) {
        amountByNum.set(num, (amountByNum.get(num) || 0) + amount);
      }
      const bets = [...amountByNum.entries()].map(([number, amount]) => ({ number, amount }));
      if (bets.length > MAX_QUIZ_NUMBERS_PER_SLOT) {
        return fail(`Quiz ${String(quizId).padStart(2, '0')}: maximum ${MAX_QUIZ_NUMBERS_PER_SLOT} unique numbers allowed in one slot.`);
      }
    }

    try {
      const rounds = quizIdsSorted.map((quizId) => {
        const amountByNum = new Map();
        for (const { num, amount } of byQuiz.get(quizId)) {
          amountByNum.set(num, (amountByNum.get(num) || 0) + amount);
        }
        const bets = [...amountByNum.entries()].map(([number, amount]) => ({ number, amount }));
        return { quizId, bets };
      });
      const targetSlots = selectedAdvanceSlots.length ? [...selectedAdvanceSlots] : [serverSlot.slotStartIso];
      const totalStakePerTicket = rounds.reduce(
        (sum, round) => sum + round.bets.reduce((s, bet) => s + Number(bet.amount || 0), 0),
        0,
      );
      const requiredBalance = totalStakePerTicket * targetSlots.length;
      if ((Number(walletBalance) || 0) < requiredBalance) {
        return fail(`Insufficient balance for ${targetSlots.length} slot(s). Need ₹${requiredBalance}.`);
      }

      let latestBalance = null;
      for (const slotStartIso of targetSlots) {
        // eslint-disable-next-line no-await-in-loop
        const j = await postQuizBetsBatch(rounds, '2d', { slotStartIso });
        const bal = Number(j?.data?.balance);
        if (Number.isFinite(bal)) latestBalance = bal;
      }
      if (latestBalance != null) {
        updateUserBalance(latestBalance);
        setWalletBalance(Number(latestBalance));
        window.dispatchEvent(new CustomEvent('balanceUpdated', { detail: { balance: latestBalance } }));
      }
      setSelectedMap({});
      setSelectedNumbers(new Set());
      setPendingTarget(null);
      setAmountDraft('');
      setEnteredAmount(0);
      appliedAmountByTargetRef.current = {};
      setRowPointDisplay(Array.from({ length: 10 }, () => ''));
      setColPointDisplay(Array.from({ length: 10 }, () => ''));
      setSelectedAdvanceSlots([]);
      const n = rounds.reduce((sum, r) => sum + r.bets.length, 0);
      setUiToast(
        targetSlots.length === 1
          ? 'You can see bets in My Bets → Quiz Tickets anytime to review your picks.'
          : `Scheduled ${n} line(s) for ${targetSlots.length} future slot(s). Check My Bets → Quiz Tickets.`,
      );
      return { ok: true };
    } catch (e) {
      const msg =
        e.status === 401
          ? 'Please login.'
          : e.status === 403
            ? e.message || 'Bets are not being accepted right now.'
            : e.status === 409
              ? e.message || 'This number is already placed.'
              : e.message || 'BUY failed';
      return fail(msg);
    }
  }, [betLines, selectedAdvanceSlots, serverSlot, slotOpenForBuy, walletBalance]);

  const handleRemoveBetLine = useCallback((lineKey) => {
    setSelectedMap((prev) => {
      if (!prev?.[lineKey]) return prev;
      const next = { ...prev };
      delete next[lineKey];
      return next;
    });
    setRowPointDisplay(Array.from({ length: 10 }, () => ''));
    setColPointDisplay(Array.from({ length: 10 }, () => ''));
    setPendingTarget(null);
    setAmountDraft('');
    setEnteredAmount(0);
    appliedAmountByTargetRef.current = {};
  }, []);

  const handleOpenBuyConfirm = useCallback(() => {
    if (!betLines.length) {
      setUiNotice('Please add amount on board first.');
      return;
    }
    setBuyConfirmError('');
    setBuyProcessing(false);
    buyConfirmInFlightRef.current = false;
    setShowBuyConfirm(true);
  }, [betLines.length]);

  const handleConfirmBuy = useCallback(async () => {
    if (buyConfirmInFlightRef.current) return;
    buyConfirmInFlightRef.current = true;
    flushSync(() => {
      setBuyConfirmError('');
      setBuyProcessing(true);
    });
    await new Promise((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    try {
      const result = await handleBoardBuy();
      if (result?.ok) {
        setShowBuyConfirm(false);
        return;
      }
      setBuyConfirmError(result?.error || 'BUY failed. Please try again.');
    } finally {
      buyConfirmInFlightRef.current = false;
      setBuyProcessing(false);
    }
  }, [handleBoardBuy]);
  const handleIncrease = useCallback(() => setAmountFromNumber(Number(amountDraft || enteredAmount) + 1), [amountDraft, enteredAmount, setAmountFromNumber]);
  const handleDecrease = useCallback(() => setAmountFromNumber(Math.max(1, Number(amountDraft || enteredAmount) - 1)), [amountDraft, enteredAmount, setAmountFromNumber]);
  useEffect(() => {
    return () => {
      Object.values(colApplyTimersRef.current).forEach((t) => t && clearTimeout(t));
      Object.values(rowApplyTimersRef.current).forEach((t) => t && clearTimeout(t));
    };
  }, []);

  useEffect(() => {
    if (!pendingTarget) return;
    if (pendingTarget.type !== 'cell') return;
    if (isNumberVisible(pendingTarget.index)) return;
    setPendingTarget(null);
    setAmountDraft('');
    setEnteredAmount(0);
  }, [activeFilter, pendingTarget]);

  useEffect(() => {
    // Row/column blue input boxes are per active quiz context.
    // Clear stale display values when quiz selection mode changes.
    setRowPointDisplay(Array.from({ length: 10 }, () => ''));
    setColPointDisplay(Array.from({ length: 10 }, () => ''));
    setPendingTarget(null);
    setAmountDraft('');
    setEnteredAmount(0);
    appliedAmountByTargetRef.current = {};
  }, [activeQuiz, multi, selectedQuizzes]);

  return (
    <AppLayout>
      <div className="w-full min-h-screen min-h-[100dvh] h-[100dvh] relative overflow-hidden bg-[#111] rounded-[14px] sm:rounded-none">
        <div className="absolute inset-0 border border-[#4c4c4c] pointer-events-none rounded-[14px] sm:rounded-none" />
        <div
          className="absolute inset-0 overflow-auto"
          style={{
            width: `${viewport.width}px`,
            height: `${viewport.height}px`,
          }}
        >
          <div
            className="relative shrink-0"
            style={{
              width: `${BASE_WIDTH * effectiveScaleX}px`,
              height: `${BASE_HEIGHT * effectiveScaleY}px`,
            }}
          >
          <div
            className="absolute top-0 left-0 bg-[#111] border border-[#4c4c4c] flex flex-col overflow-hidden"
            style={{
              width: `${BASE_WIDTH}px`,
              height: `${BASE_HEIGHT}px`,
              transform: `scale(${effectiveScaleX}, ${effectiveScaleY})`,
              transformOrigin: 'top left',
            }}
          >
            <TopHeader
              now={clockNow}
              walletBalance={walletBalance}
              onOpenQuiz={() => navigate('/lottery/quiz')}
              onOpenThreeD={() => navigate('/lottery/3d')}
              onOpenMyBets={() => setShowMyBets(true)}
              onBack={handleBackToHome}
            />
            <QuizSelector
              activeQuiz={activeQuiz}
              selectedQuizzes={selectedQuizzes}
              multi={multi}
              lastDrawByQuiz={lastSlotByQuiz}
              previousSlotTimeLabel={prevSlotDrawEndLabel}
              onToggleQuiz={handleQuizToggle}
              onToggleSet={handleSetToggle}
              onToggleMulti={handleMultiToggle}
              onToggleAll={handleAllToggle}
              onOpenResult={openResults}
            />
            <StatusStrip />

            <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_148px_210px] overflow-hidden">
              <NumberBoard
                activeQuiz={activeQuiz}
                selectedMap={selectedMap}
                selectedNumbers={selectedNumbers}
                activeTarget={pendingTarget}
                activeFilter={activeFilter}
                rowPointDisplay={rowPointDisplay}
                colPointDisplay={colPointDisplay}
                onSelectTarget={handleSelectTarget}
              />
              <SummaryPanel
                totalAmount={totals.totalAmount}
                setTotals={setTotals}
                onBuy={handleOpenBuyConfirm}
                buyDisabled={buyDisabled}
                buyHelpLines={buyHelpLines}
              />
              <ControlPanel
                timerText={formatTimer(timerSeconds)}
                amountDraft={amountDraft || '0'}
                onAdvanceDraw={handleAdvanceDraw}
                onResetAll={handleReset}
                onApplyFilter={applyFilter}
                onToggleFamilyMode={toggleFamilyMode}
                activeFilter={activeFilter}
                familyMode={familyMode}
                onIncrease={handleIncrease}
                onDecrease={handleDecrease}
                onKeypad={handleKeypad}
              />
            </div>
          </div>
          </div>
        </div>
      </div>

      <ResultHistoryModal
        open={showResults}
        onClose={() => setShowResults(false)}
        defaultIstDay={serverSlot?.istDayKey}
      />
      <MyBetsModal open={showMyBets} onClose={() => setShowMyBets(false)} />
      <AdvanceDrawModal
        open={showAdvanceDrawModal}
        title="ADVANCE DRAW"
        currentLabel={formatAdvanceSlotLabel(serverSlot?.slotStartIso || new Date().toISOString())}
        nextLabel={serverSlot?.drawLabelNext || '-'}
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
          setShowAdvanceDrawModal(false);
          if (selectedAdvanceSlots.length > 0) {
            setAdvanceSelectionNotice(`Advance slot selected (${selectedAdvanceSlots.length})`);
          } else {
            setAdvanceSelectionNotice('No advance slot selected');
          }
        }}
        onClose={() => setShowAdvanceDrawModal(false)}
      />
      {showBuyConfirm ? (
        <div className="fixed inset-0 z-[86] flex items-center justify-center bg-[#020617]/75 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-xl rounded-2xl border border-[#334155] bg-gradient-to-b from-[#0f172a] to-[#111827] p-4 text-white shadow-[0_18px_50px_rgba(2,6,23,0.5)]">
            <h3 className="text-[20px] font-extrabold">You want to place bet?</h3>
            <p className="mt-2 text-sm text-[#cbd5e1]">
              Total Bets: <span className="font-bold text-white">{betLines.length}</span> | Total Amount:{' '}
              <span className="font-bold text-[#facc15]">₹{totals.totalAmount}</span>
            </p>
            <p className="mt-1 text-sm text-[#cbd5e1]">
              Draw Time: <span className="font-bold text-white">{buyTargetSlotLabels.join(', ') || '-'}</span>
            </p>
            {buyProcessing ? (
              <p className="mt-2 rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-sm font-semibold text-sky-200">
                Processing… please wait. Do not close this screen.
              </p>
            ) : null}
            {buyConfirmError ? (
              <p className="mt-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-300">
                {buyConfirmError}
              </p>
            ) : null}

            <div className="mt-3 max-h-[42vh] overflow-y-auto rounded-lg border border-[#334155] bg-[#0b1220]">
              {!betLines.length ? (
                <p className="p-3 text-sm text-[#cbd5e1]">No bets left to place.</p>
              ) : (
                betLines.map((line) => (
                  <div key={line.key} className="flex items-center justify-between gap-3 border-b border-[#1f2937] px-3 py-2 last:border-b-0">
                    <div className="text-sm">
                      <span className="font-semibold">Quiz {String(line.quizId).padStart(2, '0')}</span>
                      <span className="mx-2 text-[#64748b]">|</span>
                      <span>No. {String(line.num).padStart(2, '0')}</span>
                      <span className="mx-2 text-[#64748b]">|</span>
                      <span>₹{line.amount}</span>
                    </div>
                    <button
                      type="button"
                      disabled={buyProcessing}
                      onClick={() => setPendingRemoveBetLineKey(line.key)}
                      className="rounded-md border border-[#b91c1c] bg-[#7f1d1d] px-2 py-1 text-xs font-bold text-white hover:bg-[#991b1b] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                disabled={buyProcessing}
                onClick={() => setShowBuyConfirm(false)}
                className="h-10 flex-1 rounded-lg border border-[#475569] bg-[#1e293b] text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBuy}
                disabled={!betLines.length || buyProcessing}
                className="h-10 flex-1 rounded-lg border border-[#1c87cd] bg-gradient-to-b from-[#38bdf8] to-[#0ea5e9] text-sm font-extrabold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {buyProcessing ? 'Processing…' : 'BUY'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {pendingRemoveBetLineKey ? (
        <div className="fixed inset-0 z-[87] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-sm rounded-xl border border-[#334155] bg-[#0f172a] p-4 text-white shadow-2xl">
            <h4 className="text-lg font-bold">Are you sure?</h4>
            <p className="mt-2 text-sm text-[#cbd5e1]">
              Do you want to remove this bet line?
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPendingRemoveBetLineKey('')}
                className="h-10 flex-1 rounded-lg border border-[#475569] bg-[#1e293b] text-sm font-bold"
              >
                No
              </button>
              <button
                type="button"
                onClick={() => {
                  handleRemoveBetLine(pendingRemoveBetLineKey);
                  setPendingRemoveBetLineKey('');
                }}
                className="h-10 flex-1 rounded-lg border border-[#b91c1c] bg-[#991b1b] text-sm font-extrabold"
              >
                Yes, Remove
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {advanceSelectionNotice ? (
        <div className="fixed inset-0 z-[87] flex items-center justify-center bg-[#020617]/60 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-sm rounded-2xl border border-[#93c5fd] bg-gradient-to-b from-white to-[#eff6ff] p-5 shadow-[0_18px_45px_rgba(2,6,23,0.45)]">
            <h3 className="text-[22px] font-black text-[#1d4ed8]">Advance Draw</h3>
            <p className="mt-2 text-[16px] font-bold text-[#1e293b]">{advanceSelectionNotice}</p>
          </div>
        </div>
      ) : null}
      {showRotatePrompt && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-sm rounded-xl border border-[#3b3b3b] bg-[#111] p-4 text-center text-white shadow-2xl">
            <div className="phone-rotate-wrap phone-rotate-wrap--tap" aria-hidden>
              <div className="phone-rotate-icon" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Rotate Screen</h3>
            <p className="text-sm text-gray-300 mb-4">
              Lottery game works best in landscape mode.
              Tap below to go full screen, then rotate your phone horizontally.
            </p>
            <button
              type="button"
              onClick={handleRotateLandscape}
              className="h-11 w-full rounded-lg border border-[#d4372f] bg-gradient-to-b from-[#ef3f34] to-[#d83028] font-extrabold text-[15px] shadow-[0_8px_20px_rgba(239,63,52,0.35)]"
            >
              Tap Here
            </button>
          </div>
        </div>
      )}
      {uiNotice && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-[#020617]/75 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-sm rounded-2xl border border-[#334155] bg-gradient-to-b from-[#0f172a] to-[#111827] p-5 text-center text-white shadow-[0_18px_50px_rgba(2,6,23,0.5)]">
            <p className="mb-4 text-[15px] font-bold leading-relaxed">{uiNotice}</p>
            <button
              type="button"
              onClick={() => setUiNotice('')}
              className="h-11 w-full rounded-lg border border-[#1c87cd] bg-gradient-to-b from-[#38bdf8] to-[#0ea5e9] text-[15px] font-extrabold shadow-[0_8px_20px_rgba(14,165,233,0.35)]"
            >
              OK
            </button>
          </div>
        </div>
      )}
      {uiToast ? (
        <div className="pointer-events-none fixed inset-0 z-[84] flex items-center justify-center bg-[#020617]/62 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg rounded-2xl border border-[#334155] bg-gradient-to-b from-[#0f172a] to-[#111827] px-6 py-5 text-white shadow-[0_22px_60px_rgba(2,6,23,0.58)]">
            <div className="flex items-start gap-4">
              <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#16a34a] text-lg font-black text-white shadow-[0_8px_20px_rgba(22,163,74,0.35)]">
                ✓
              </div>
              <div className="min-w-0">
                <p className="text-[22px] font-black leading-none text-[#93c5fd]">Bet Placed</p>
                <p className="mt-2 text-[15px] font-semibold leading-relaxed text-[#e2e8f0] break-words">
                  {uiToast}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AppLayout>
  );
};

export default LotteryDashboard;
