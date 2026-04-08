import React, { useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '../components/AppLayout';
import TopHeader from '../components/TopHeader';
import QuizSelector from '../components/QuizSelector';
import StatusStrip from '../components/StatusStrip';
import NumberBoard from '../components/NumberBoard';
import SummaryPanel from '../components/SummaryPanel';
import ControlPanel from '../components/ControlPanel';
import ResultModal from '../components/ResultModal';
import { RESULT_HISTORY } from '../data/mockData';
import { DEFAULT_TIMER_SECONDS, FILTER_TYPES } from '../types';
import { formatTimer, getCellKey, getTotals } from '../utils/boardHelpers';

const LotteryDashboard = () => {
  const colApplyTimersRef = useRef({});
  const rowApplyTimersRef = useRef({});
  const autoApplyTimerRef = useRef(null);
  const appliedAmountByTargetRef = useRef({});
  const [clockNow, setClockNow] = useState('07:59:44');
  const [activeQuiz, setActiveQuiz] = useState(1);
  const [selectedQuizzes, setSelectedQuizzes] = useState([1]);
  const [multi, setMulti] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [enteredAmount, setEnteredAmount] = useState(2);
  const [amountDraft, setAmountDraft] = useState('2');
  const [pendingTarget, setPendingTarget] = useState(null);
  const [activeFilter, setActiveFilter] = useState(FILTER_TYPES.ALL);
  const [selectedMap, setSelectedMap] = useState({});
  const [rowPointDisplay, setRowPointDisplay] = useState(() => Array.from({ length: 10 }, () => ''));
  const [colPointDisplay, setColPointDisplay] = useState(() => Array.from({ length: 10 }, () => ''));
  const [timerSeconds, setTimerSeconds] = useState(DEFAULT_TIMER_SECONDS);
  const ALL_QUIZZES = useMemo(() => Array.from({ length: 30 }, (_, i) => i + 1), []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimerSeconds((prev) => (prev <= 0 ? DEFAULT_TIMER_SECONDS : prev - 1));
      setClockNow(new Date().toLocaleTimeString('en-GB', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const totals = useMemo(() => getTotals(selectedMap), [selectedMap]);

  const handleQuizToggle = (quizNo) => {
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
  };

  const handleAllToggle = (checked) => {
    appliedAmountByTargetRef.current = {};
    if (checked) {
      setMulti(true);
      setSelectedQuizzes(ALL_QUIZZES);
      return;
    }
    setSelectedQuizzes([activeQuiz]);
  };

  const setAmountFromNumber = (num) => {
    const safeAmount = Math.max(1, Number(num) || 1);
    setEnteredAmount(safeAmount);
    setAmountDraft(String(safeAmount));
  };

  const getTargetKey = (target) => {
    if (!target) return '';
    const quizzesKey = (multi ? [...selectedQuizzes].sort((a, b) => a - b) : [activeQuiz]).join(',');
    return `${quizzesKey}-${target.type}-${target.index}`;
  };

  const isNumberVisible = (num) => {
    if (activeFilter === FILTER_TYPES.EVEN) return num % 2 === 0;
    if (activeFilter === FILTER_TYPES.ODD) return num % 2 !== 0;
    return true;
  };

  const handleSelectTarget = (target) => {
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
  };

  const applyAmountToTarget = (amount, target) => {
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
  };

  useEffect(() => {
    if (!pendingTarget) return;
    const amount = Number(amountDraft || 0);
    if (amount <= 0) return;
    if (autoApplyTimerRef.current) clearTimeout(autoApplyTimerRef.current);
    autoApplyTimerRef.current = setTimeout(() => {
      applyAmountToTarget(amount, pendingTarget);
      autoApplyTimerRef.current = null;
    }, 450);
    return () => {
      if (autoApplyTimerRef.current) clearTimeout(autoApplyTimerRef.current);
    };
  }, [amountDraft, pendingTarget]);

  const applyFilter = (filterType) => {
    setActiveFilter(filterType || FILTER_TYPES.ALL);
  };

  const handleAdvanceDraw = () => {
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
  };

  const handleReset = () => {
    setSelectedMap({});
    setPendingTarget(null);
    setAmountDraft('');
    setEnteredAmount(0);
    appliedAmountByTargetRef.current = {};
    setRowPointDisplay(Array.from({ length: 10 }, () => ''));
    setColPointDisplay(Array.from({ length: 10 }, () => ''));
  };
  const handleMultiToggle = (checked) => {
    setMulti(checked);
    if (!checked) setSelectedQuizzes([activeQuiz]);
  };

  const handleKeypad = (key) => {
    if (key === 'C') return setAmountDraft('');
    if (key === 'X') return setAmountDraft((prev) => prev.slice(0, -1));
    const nextValue = (amountDraft === '0' ? key : `${amountDraft}${key}`).slice(0, 4);
    setAmountDraft(nextValue);
  };

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

  return (
    <AppLayout>
      <div className="h-full flex flex-col overflow-hidden">
        <TopHeader now={clockNow} />
        <QuizSelector
          activeQuiz={activeQuiz}
          selectedQuizzes={selectedQuizzes}
          multi={multi}
          onToggleQuiz={handleQuizToggle}
          onToggleMulti={handleMultiToggle}
          onToggleAll={handleAllToggle}
          onOpenResult={() => setShowResults(true)}
        />
        <StatusStrip />

        <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_140px_200px] xl:grid-cols-[minmax(0,1fr)_148px_210px] overflow-hidden">
          <NumberBoard
            activeQuiz={activeQuiz}
            selectedMap={selectedMap}
            activeTarget={pendingTarget}
            activeFilter={activeFilter}
            rowPointDisplay={rowPointDisplay}
            colPointDisplay={colPointDisplay}
            onSelectTarget={handleSelectTarget}
          />
          <SummaryPanel count={totals.count} totalAmount={totals.totalAmount} />
          <ControlPanel
            timerText={formatTimer(timerSeconds)}
            amountDraft={amountDraft || '0'}
            onAdvanceDraw={handleAdvanceDraw}
            onResetAll={handleReset}
            onApplyFilter={applyFilter}
            activeFilter={activeFilter}
            onIncrease={() => setAmountFromNumber(Number(amountDraft || enteredAmount) + 1)}
            onDecrease={() => setAmountFromNumber(Math.max(1, Number(amountDraft || enteredAmount) - 1))}
            onKeypad={handleKeypad}
            onEnterAmount={() => {
              if (pendingTarget) {
                applyAmountToTarget(Number(amountDraft || enteredAmount || 0), pendingTarget);
              } else {
                setAmountFromNumber(amountDraft);
              }
            }}
          />
        </div>
      </div>

      <ResultModal open={showResults} onClose={() => setShowResults(false)} rows={RESULT_HISTORY} />
    </AppLayout>
  );
};

export default LotteryDashboard;
