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
import { applyFilterNumbers, formatTimer, getCellKey, getTotals } from '../utils/boardHelpers';

const LotteryDashboard = () => {
  const colApplyTimersRef = useRef({});
  const rowApplyTimersRef = useRef({});
  const [clockNow, setClockNow] = useState('07:59:44');
  const [activeQuiz, setActiveQuiz] = useState(1);
  const [selectedQuizzes, setSelectedQuizzes] = useState([1]);
  const [multi, setMulti] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [enteredAmount, setEnteredAmount] = useState(2);
  const [amountDraft, setAmountDraft] = useState('2');
  const [selectedMap, setSelectedMap] = useState({});
  const [columnDrafts, setColumnDrafts] = useState(() => Array.from({ length: 10 }, () => ''));
  const [rowDrafts, setRowDrafts] = useState(() => Array.from({ length: 10 }, () => ''));
  const [timerSeconds, setTimerSeconds] = useState(DEFAULT_TIMER_SECONDS);

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
      return;
    }
    setSelectedQuizzes((prev) => {
      if (!prev.includes(quizNo)) return [...prev, quizNo];
      if (prev.length === 1) return prev;
      return prev.filter((q) => q !== quizNo);
    });
  };

  const setAmountFromNumber = (num) => {
    const safeAmount = Math.max(1, Number(num) || 1);
    setEnteredAmount(safeAmount);
    setAmountDraft(String(safeAmount));
  };

  const handleCellClick = (num) => {
    const key = getCellKey(activeQuiz, num);
    setSelectedMap((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = enteredAmount;
      return next;
    });
  };

  const applyFilter = (filterType) => {
    const normalized = filterType || FILTER_TYPES.ALL;
    const nums = applyFilterNumbers(normalized);
    setSelectedMap((prev) => {
      const next = { ...prev };
      nums.forEach((n) => {
        next[getCellKey(activeQuiz, n)] = enteredAmount;
      });
      return next;
    });
  };

  const handleAdvanceDraw = () => {
    setActiveQuiz((prev) => {
      const next = prev >= 30 ? 1 : prev + 1;
      setSelectedQuizzes([next]);
      return next;
    });
    setSelectedMap({});
  };

  const handleReset = () => setSelectedMap({});
  const handleMultiToggle = (checked) => {
    setMulti(checked);
    if (!checked) setSelectedQuizzes([activeQuiz]);
  };

  const handleKeypad = (key) => {
    if (key === 'C') return setAmountDraft('');
    if (key === 'X') return setAmountDraft((prev) => prev.slice(0, -1));
    setAmountDraft((prev) => (prev === '0' ? key : `${prev}${key}`).slice(0, 4));
  };

  const handleColumnDraftChange = (colIndex, value) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 4);
    setColumnDrafts((prev) => {
      const next = [...prev];
      next[colIndex] = cleaned;
      return next;
    });
  };

  const handleRowDraftChange = (rowIndex, value) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 4);
    setRowDrafts((prev) => {
      const next = [...prev];
      next[rowIndex] = cleaned;
      return next;
    });
  };

  const applyColumnPoints = (colIndex) => {
    if (colApplyTimersRef.current[colIndex]) {
      clearTimeout(colApplyTimersRef.current[colIndex]);
      colApplyTimersRef.current[colIndex] = null;
    }
    const amount = Number(columnDrafts[colIndex] || 0);
    if (amount <= 0) return;
    setSelectedMap((prev) => {
      const next = { ...prev };
      for (let row = 0; row < 10; row += 1) {
        const num = row * 10 + colIndex;
        const key = getCellKey(activeQuiz, num);
        next[key] = Number(next[key] || 0) + amount;
      }
      return next;
    });
  };

  const applyRowPoints = (rowIndex) => {
    if (rowApplyTimersRef.current[rowIndex]) {
      clearTimeout(rowApplyTimersRef.current[rowIndex]);
      rowApplyTimersRef.current[rowIndex] = null;
    }
    const amount = Number(rowDrafts[rowIndex] || 0);
    if (amount <= 0) return;
    setSelectedMap((prev) => {
      const next = { ...prev };
      for (let col = 0; col < 10; col += 1) {
        const num = rowIndex * 10 + col;
        const key = getCellKey(activeQuiz, num);
        next[key] = Number(next[key] || 0) + amount;
      }
      return next;
    });
  };

  useEffect(() => {
    return () => {
      Object.values(colApplyTimersRef.current).forEach((t) => t && clearTimeout(t));
      Object.values(rowApplyTimersRef.current).forEach((t) => t && clearTimeout(t));
    };
  }, []);

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
          onOpenResult={() => setShowResults(true)}
        />
        <StatusStrip />

        <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_140px_200px] xl:grid-cols-[minmax(0,1fr)_148px_210px] overflow-hidden">
          <NumberBoard
            activeQuiz={activeQuiz}
            selectedMap={selectedMap}
            onCellClick={handleCellClick}
            columnDrafts={columnDrafts}
            rowDrafts={rowDrafts}
            onColumnDraftChange={handleColumnDraftChange}
            onRowDraftChange={handleRowDraftChange}
            onApplyColumn={applyColumnPoints}
            onApplyRow={applyRowPoints}
          />
          <SummaryPanel count={totals.count} totalAmount={totals.totalAmount} />
          <ControlPanel
            timerText={formatTimer(timerSeconds)}
            amountDraft={amountDraft || '0'}
            onAdvanceDraw={handleAdvanceDraw}
            onResetAll={handleReset}
            onApplyFilter={applyFilter}
            onIncrease={() => setAmountFromNumber(Number(amountDraft || enteredAmount) + 1)}
            onDecrease={() => setAmountFromNumber(Math.max(1, Number(amountDraft || enteredAmount) - 1))}
            onKeypad={handleKeypad}
            onEnterAmount={() => setAmountFromNumber(amountDraft)}
          />
        </div>
      </div>

      <ResultModal open={showResults} onClose={() => setShowResults(false)} rows={RESULT_HISTORY} />
    </AppLayout>
  );
};

export default LotteryDashboard;
