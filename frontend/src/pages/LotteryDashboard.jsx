import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import TopHeader from '../components/TopHeader';
import QuizSelector from '../components/QuizSelector';
import StatusStrip from '../components/StatusStrip';
import NumberBoard from '../components/NumberBoard';
import SummaryPanel from '../components/SummaryPanel';
import ControlPanel from '../components/ControlPanel';
import ResultModal from '../components/ResultModal';
import { getBalance, updateUserBalance } from '../api/bets';
import { RESULT_HISTORY } from '../data/mockData';
import { DEFAULT_TIMER_SECONDS, FILTER_TYPES } from '../types';
import { formatTimer, getCellKey, getLotterySetTotals, getTotals } from '../utils/boardHelpers';

const LotteryDashboard = () => {
  const navigate = useNavigate();
  const BASE_WIDTH = 1536;
  const BASE_HEIGHT = 864;
  const colApplyTimersRef = useRef({});
  const rowApplyTimersRef = useRef({});
  const autoApplyTimerRef = useRef(null);
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
  const [showRotatePrompt, setShowRotatePrompt] = useState(false);
  const [enteredAmount, setEnteredAmount] = useState(2);
  const [amountDraft, setAmountDraft] = useState('2');
  const [pendingTarget, setPendingTarget] = useState(null);
  const [activeFilter, setActiveFilter] = useState(FILTER_TYPES.ALL);
  const [selectedMap, setSelectedMap] = useState({});
  const [rowPointDisplay, setRowPointDisplay] = useState(() => Array.from({ length: 10 }, () => ''));
  const [colPointDisplay, setColPointDisplay] = useState(() => Array.from({ length: 10 }, () => ''));
  const [timerSeconds, setTimerSeconds] = useState(DEFAULT_TIMER_SECONDS);
  const [walletBalance, setWalletBalance] = useState(0);
  const ALL_QUIZZES = useMemo(() => Array.from({ length: 30 }, (_, i) => i + 1), []);
  const dashboardScaleX = useMemo(() => viewport.width / BASE_WIDTH, [viewport.width]);
  const dashboardScaleY = useMemo(() => viewport.height / BASE_HEIGHT, [viewport.height]);
  const getQuarterHourCountdown = useCallback((nowDate = new Date()) => {
    const mins = nowDate.getMinutes();
    const secs = nowDate.getSeconds();
    const elapsedInQuarter = (mins % 15) * 60 + secs;
    const remaining = DEFAULT_TIMER_SECONDS - elapsedInQuarter;
    return remaining <= 0 ? DEFAULT_TIMER_SECONDS : remaining;
  }, []);

  const loadStoredBalance = useCallback(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const b = user?.balance ?? user?.walletBalance ?? user?.wallet ?? 0;
      setWalletBalance(Number(b) || 0);
    } catch (_) {
      setWalletBalance(0);
    }
  }, []);

  const refreshWalletBalance = useCallback(async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || 'null');
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
    loadStoredBalance();
    refreshWalletBalance();

    const handleStorage = () => loadStoredBalance();
    const handleUserLogin = () => loadStoredBalance();
    const handleBalanceUpdated = (e) => {
      const nextBalance = e?.detail?.balance;
      if (nextBalance != null) {
        setWalletBalance(Number(nextBalance) || 0);
      } else {
        loadStoredBalance();
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('userLogin', handleUserLogin);
    window.addEventListener('balanceUpdated', handleBalanceUpdated);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('userLogin', handleUserLogin);
      window.removeEventListener('balanceUpdated', handleBalanceUpdated);
    };
  }, [loadStoredBalance, refreshWalletBalance]);

  const totals = useMemo(() => getTotals(selectedMap), [selectedMap]);
  const setTotals = useMemo(() => getLotterySetTotals(selectedMap), [selectedMap]);

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

  const setAmountFromNumber = useCallback((num) => {
    const safeAmount = Math.max(1, Number(num) || 1);
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

  const handleSelectTarget = useCallback((target) => {
    const currentKey = getTargetKey(pendingTarget);
    const nextKey = getTargetKey(target);
    // Reset keypad only when switching to a different target.
    if (currentKey !== nextKey) {
      setEnteredAmount(0);
      setAmountDraft('');
      if (autoApplyTimerRef.current) {
        clearTimeout(autoApplyTimerRef.current);
        autoApplyTimerRef.current = null;
      }
    }
    setPendingTarget(target);
  }, [getTargetKey, pendingTarget]);

  const applyAmountToTarget = useCallback((amount, target) => {
    const safeAmount = Number(amount || 0);
    if (safeAmount <= 0 || !target) return;
    if (target.type === 'cell' && !isNumberVisible(target.index)) return;
    if (target.type === 'col') {
      const hasVisibleInColumn = Array.from({ length: 10 }, (_, row) => row * 10 + target.index).some((n) => isNumberVisible(n));
      if (!hasVisibleInColumn) return;
    }
    const targetKey = getTargetKey(target);
    const prevApplied = Number(appliedAmountByTargetRef.current[targetKey] || 0);
    const deltaAmount = safeAmount - prevApplied;
    if (deltaAmount <= 0) {
      appliedAmountByTargetRef.current[targetKey] = safeAmount;
      return;
    }
    setSelectedMap((prev) => {
      const next = { ...prev };
      const quizzesToApply = multi ? selectedQuizzes : [activeQuiz];
      if (target.type === 'cell') {
        quizzesToApply.forEach((quizNo) => {
          const key = getCellKey(quizNo, target.index);
          next[key] = Number(next[key] || 0) + deltaAmount;
        });
      } else if (target.type === 'row') {
        setRowPointDisplay((prev) => {
          const next = [...prev];
          next[target.index] = String(safeAmount);
          return next;
        });
        for (let col = 0; col < 10; col += 1) {
          const num = target.index * 10 + col;
          if (!isNumberVisible(num)) continue;
          quizzesToApply.forEach((quizNo) => {
            const key = getCellKey(quizNo, num);
            next[key] = Number(next[key] || 0) + deltaAmount;
          });
        }
      } else if (target.type === 'col') {
        const hasVisibleInColumn = Array.from({ length: 10 }, (_, row) => row * 10 + target.index).some((n) => isNumberVisible(n));
        if (!hasVisibleInColumn) return next;
        setColPointDisplay((prev) => {
          const next = [...prev];
          next[target.index] = String(safeAmount);
          return next;
        });
        for (let row = 0; row < 10; row += 1) {
          const num = row * 10 + target.index;
          if (!isNumberVisible(num)) continue;
          quizzesToApply.forEach((quizNo) => {
            const key = getCellKey(quizNo, num);
            next[key] = Number(next[key] || 0) + deltaAmount;
          });
        }
      }
      return next;
    });
    appliedAmountByTargetRef.current[targetKey] = safeAmount;
  }, [activeQuiz, getTargetKey, isNumberVisible, multi, selectedQuizzes]);

  useEffect(() => {
    if (!pendingTarget) return;
    const amount = Number(amountDraft || 0);
    if (amount <= 0) return;
    if (autoApplyTimerRef.current) clearTimeout(autoApplyTimerRef.current);
    autoApplyTimerRef.current = setTimeout(() => {
      applyAmountToTarget(amount, pendingTarget);
      autoApplyTimerRef.current = null;
    }, 180);
    return () => {
      if (autoApplyTimerRef.current) clearTimeout(autoApplyTimerRef.current);
    };
  }, [amountDraft, applyAmountToTarget, pendingTarget]);

  const applyFilter = useCallback((filterType) => {
    setActiveFilter(filterType || FILTER_TYPES.ALL);
  }, []);

  const handleAdvanceDraw = useCallback(() => {
    setActiveQuiz((prev) => {
      const next = prev >= 30 ? 1 : prev + 1;
      setSelectedQuizzes([next]);
      return next;
    });
    setSelectedMap({});
    setPendingTarget(null);
    setAmountDraft('');
    setEnteredAmount(0);
    appliedAmountByTargetRef.current = {};
    setRowPointDisplay(Array.from({ length: 10 }, () => ''));
    setColPointDisplay(Array.from({ length: 10 }, () => ''));
  }, []);

  const handleReset = useCallback(() => {
    setSelectedMap({});
    setPendingTarget(null);
    setAmountDraft('');
    setEnteredAmount(0);
    appliedAmountByTargetRef.current = {};
    setRowPointDisplay(Array.from({ length: 10 }, () => ''));
    setColPointDisplay(Array.from({ length: 10 }, () => ''));
  }, []);
  const handleMultiToggle = useCallback((checked) => {
    setMulti(checked);
    if (!checked) setSelectedQuizzes([activeQuiz]);
  }, [activeQuiz]);

  const handleKeypad = useCallback((key) => {
    if (key === 'C') return setAmountDraft('');
    if (key === 'X') return setAmountDraft((prev) => prev.slice(0, -1));
    const nextValue = (amountDraft === '0' ? key : `${amountDraft}${key}`).slice(0, 4);
    setAmountDraft(nextValue);
  }, [amountDraft]);

  const openResults = useCallback(() => setShowResults(true), []);
  const handleIncrease = useCallback(() => setAmountFromNumber(Number(amountDraft || enteredAmount) + 1), [amountDraft, enteredAmount, setAmountFromNumber]);
  const handleDecrease = useCallback(() => setAmountFromNumber(Math.max(1, Number(amountDraft || enteredAmount) - 1)), [amountDraft, enteredAmount, setAmountFromNumber]);
  const handleEnterAmount = useCallback(() => {
    if (pendingTarget) {
      applyAmountToTarget(Number(amountDraft || enteredAmount || 0), pendingTarget);
      appliedAmountByTargetRef.current = {};
      setPendingTarget(null);
      setAmountDraft('');
      setEnteredAmount(0);
    } else {
      setAmountDraft('');
      setEnteredAmount(0);
    }
  }, [amountDraft, applyAmountToTarget, enteredAmount, pendingTarget]);

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
      <div className="w-full h-full relative overflow-hidden bg-[#111] rounded-[14px] sm:rounded-none">
        <div className="absolute inset-0 border border-[#4c4c4c] pointer-events-none rounded-[14px] sm:rounded-none" />
        <div
          className="absolute inset-0 overflow-hidden"
          style={{
            width: `${viewport.width}px`,
            height: `${viewport.height}px`,
          }}
        >
          <div
            className="absolute top-0 left-0 bg-[#111] border border-[#4c4c4c] flex flex-col overflow-hidden"
            style={{
              width: `${BASE_WIDTH}px`,
              height: `${BASE_HEIGHT}px`,
              transform: `scale(${dashboardScaleX}, ${dashboardScaleY})`,
              transformOrigin: 'top left',
            }}
          >
            <TopHeader now={clockNow} walletBalance={walletBalance} onOpenThreeD={() => navigate('/lottery/3d')} />
            <QuizSelector
              activeQuiz={activeQuiz}
              selectedQuizzes={selectedQuizzes}
              multi={multi}
              onToggleQuiz={handleQuizToggle}
              onToggleMulti={handleMultiToggle}
              onToggleAll={handleAllToggle}
              onOpenResult={openResults}
            />
            <StatusStrip />

            <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_148px_210px] overflow-hidden">
              <NumberBoard
                activeQuiz={activeQuiz}
                selectedMap={selectedMap}
                activeTarget={pendingTarget}
                activeFilter={activeFilter}
                rowPointDisplay={rowPointDisplay}
                colPointDisplay={colPointDisplay}
                onSelectTarget={handleSelectTarget}
              />
              <SummaryPanel
                totalAmount={totals.totalAmount}
                setTotals={setTotals}
              />
              <ControlPanel
                timerText={formatTimer(timerSeconds)}
                amountDraft={amountDraft || '0'}
                onAdvanceDraw={handleAdvanceDraw}
                onResetAll={handleReset}
                onApplyFilter={applyFilter}
                activeFilter={activeFilter}
                onIncrease={handleIncrease}
                onDecrease={handleDecrease}
                onKeypad={handleKeypad}
                onEnterAmount={handleEnterAmount}
              />
            </div>
          </div>
        </div>
      </div>

      <ResultModal open={showResults} onClose={() => setShowResults(false)} rows={RESULT_HISTORY} />
      {showRotatePrompt && (
        <div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#111] border border-[#3b3b3b] text-white p-4 text-center">
            <div className="phone-rotate-wrap" aria-hidden>
              <div className="phone-rotate-icon" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Rotate Screen</h3>
            <p className="text-sm text-gray-300 mb-4">
              Lottery game works best in landscape mode.
              Please rotate your phone horizontally.
            </p>
            <button
              type="button"
              onClick={handleRotateLandscape}
              className="w-full h-10 bg-[#ef3f34] border border-[#d4372f] font-semibold"
            >
              Rotate + Full Screen
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default LotteryDashboard;
