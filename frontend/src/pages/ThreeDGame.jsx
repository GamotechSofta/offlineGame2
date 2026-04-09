import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ResultPanel from '../components/threeD/ResultPanel';
import Keypad from '../components/threeD/Keypad';
import {
  GAME_INTERVAL_SECONDS,
  checkWinningBets,
  formatTimer,
  generate3DResult,
  getNextDrawTime,
  getSlotMeta,
  validateBetForMode,
} from '../components/threeD/helpers';

const MODE_OPTIONS = ['all', 'box', 'str', 'sp', 'fp', 'bp', 'ap', 'single', 'duplicates', 'triples'];
const MODE_OPTIONS_WITHOUT_ALL = MODE_OPTIONS.filter((m) => m !== 'all');
const RATE_OPTIONS = [10, 20, 30, 50, 100, 200];
const STORAGE_KEY = 'matka3d-bets';
const TAB_BUTTONS = ['Result', 'Account', 'Quiz', 'Ticket List', 'Cancel', 'Password', 'Refresh', 'Logout'];
const PANEL_OPTIONS = ['A', 'B', 'C'];
const DIGIT_OPTIONS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const VALID_MODES = new Set(['single', 'str', 'box', 'sp', 'fp', 'bp', 'ap', 'duplicates', 'dp', 'triples', 'tp']);
const LPICK_OPTIONS = ['single', 'box', 'str', 'sp', 'fp', 'bp', 'ap', 'duplicates', 'triples'];
const BASE_WIDTH = 1536;
const BASE_HEIGHT = 864;

const ThreeDGame = () => {
  const navigate = useNavigate();
  const slotRef = useRef('');
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : BASE_WIDTH,
    height: typeof window !== 'undefined' ? window.innerHeight : BASE_HEIGHT,
  }));
  const [now, setNow] = useState(() => new Date());
  const [timerSeconds, setTimerSeconds] = useState(GAME_INTERVAL_SECONDS);
  const [nextDrawAt, setNextDrawAt] = useState(() => getNextDrawTime(new Date()));
  const [results, setResults] = useState(() => generate3DResult());
  const [lastResults, setLastResults] = useState({ A: '---', B: '---', C: '---' });
  const [resultUpdatedAt, setResultUpdatedAt] = useState(0);
  const [inputNumber, setInputNumber] = useState('');
  const [points, setPoints] = useState('10');
  const [selectedModes, setSelectedModes] = useState(['single']);
  const [selectedRate, setSelectedRate] = useState(10);
  const [selectedPanels, setSelectedPanels] = useState(['A', 'B', 'C']);
  const [selectedDigits, setSelectedDigits] = useState([]);
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [lPickType, setLPickType] = useState('box');
  const [qty, setQty] = useState('');
  const [allowDuplicates, setAllowDuplicates] = useState(false);
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

  const isResultFresh = useMemo(() => Date.now() - resultUpdatedAt < 1400, [resultUpdatedAt, now]);
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
  const getDisplayBetNumber = useCallback(
    (bet) => (String(bet?.mode || '').toLowerCase() === 'fp' ? String(bet?.number || '').slice(0, 2) : bet?.number),
    [],
  );
  const dashboardScaleX = useMemo(() => viewport.width / BASE_WIDTH, [viewport.width]);
  const dashboardScaleY = useMemo(() => viewport.height / BASE_HEIGHT, [viewport.height]);

  const applyFreshResult = useCallback((newResult) => {
    setLastResults({
      A: results.A.join(''),
      B: results.B.join(''),
      C: results.C.join(''),
    });
    setResults(newResult);
    setResultUpdatedAt(Date.now());
  }, [results]);

  const runClockTick = useCallback(() => {
    const current = new Date();
    const meta = getSlotMeta(current);
    setNow(current);
    setTimerSeconds(meta.remainingSeconds);
    setNextDrawAt(meta.nextDraw);
    if (slotRef.current !== meta.slotKey) {
      slotRef.current = meta.slotKey;
      applyFreshResult(generate3DResult());
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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bets));
    } catch (_) {}
  }, [bets]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 1800);
    return () => clearTimeout(t);
  }, [toast]);

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

  const timeToDrawText = useMemo(
    () =>
      new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
        .format(nextDrawAt)
        .replace(/\s?(am|pm)$/i, (m) => ` ${m.trim().toUpperCase()}`),
    [nextDrawAt],
  );

  const handleDigitInput = useCallback((digit) => {
    setInputNumber((prev) => {
      const next = (prev + digit).slice(0, 3);
      return next;
    });
    if (validationMsg) setValidationMsg('');
  }, [validationMsg]);

  const toggleMode = useCallback((mode) => {
    setSelectedModes((prev) => {
      if (mode === 'all') {
        return prev.includes('all') ? [] : [...MODE_OPTIONS];
      }

      const next = prev.includes(mode)
        ? prev.filter((m) => m !== mode && m !== 'all')
        : [...prev.filter((m) => m !== 'all'), mode];

      const hasEveryNonAll = MODE_OPTIONS_WITHOUT_ALL.every((m) => next.includes(m));
      return hasEveryNonAll ? ['all', ...MODE_OPTIONS_WITHOUT_ALL] : next;
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
    const existing = new Set(bets.map((b) => `${b.number}|${b.mode}`));
    const created = [];
    const skipped = [];
    numbers.forEach((num, idx) => {
      normalizedTypes.forEach((betType, tIdx) => {
        const modeValidation = validateBetForMode(num, betType);
        if (!modeValidation.valid) {
          skipped.push(`${num}:${betType}`);
          return;
        }
        const key = `${num}|${betType}`;
        if (!allowDuplicates && existing.has(key)) {
          skipped.push(`${num}:${betType}`);
          return;
        }
        existing.add(key);
        created.push({
          id: `${Date.now()}-${idx}-${tIdx}-${num}`,
          number: num,
          mode: betType,
          points: pts,
          basePoints: pts,
          rate: rateValue,
          outcome: null,
          justAdded: true,
          panels: (selectedPanels.length ? selectedPanels : ['A', 'B', 'C']).join(','),
        });
      });
    });
    if (created.length) {
      setBets((prev) => [...prev, ...created]);
    }
    return { createdCount: created.length, skippedCount: skipped.length };
  }, [allowDuplicates, bets, selectedPanels]);

  const addBet = useCallback(() => {
    const cleanNum = (inputNumber || '').trim();
    const pts = Number(points);
    const selectedBetTypes = getNormalizedSelectedModes();

    console.debug('[3D addBet] snapshot', { inputNumber, rangeFrom, rangeTo, qty, lPickType, points, selectedModes, selectedPanels, selectedRate });

    if (!Number.isFinite(pts) || pts <= 0) {
      setValidationMsg('Points must be greater than 0.');
      return;
    }
    if (!selectedBetTypes.length) {
      setValidationMsg('Please select at least one mode.');
      return;
    }
    if ((rangeFrom && !rangeTo) || (!rangeFrom && rangeTo)) {
      setValidationMsg('Please enter complete range (FROM and TO).');
      return;
    }

    // Priority: Range -> Lucky Pick -> Single number.
    if (rangeFrom && rangeTo) {
      const r = generateRangeNumbers(rangeFrom, rangeTo);
      if (!r.ok) {
        setValidationMsg(r.error);
        return;
      }
      const result = addNumbersToBetState(r.nums, selectedBetTypes, pts, selectedRate);
      if (!result.createdCount) {
        setValidationMsg('No valid numbers/modes generated from selected range.');
        return;
      }
      setValidationMsg(result.skippedCount ? `${result.skippedCount} duplicate numbers skipped.` : '');
      setToast('Range numbers added');
      setRangeFrom('');
      setRangeTo('');
      return;
    }

    if (qty) {
      const lType = String(lPickType || 'single').toLowerCase();
      const r = generateLuckyPickNumbers(Number(qty), lType);
      if (!r.ok) {
        setValidationMsg(r.error);
        return;
      }
      const result = addNumbersToBetState(r.nums, [lType], pts, selectedRate);
      setValidationMsg(result.skippedCount ? `${result.skippedCount} duplicate numbers skipped.` : '');
      setToast('Lucky pick numbers added');
      setQty('');
      return;
    }

    if (!/^\d{1,3}$/.test(cleanNum)) {
      setValidationMsg('Please enter a valid number (000-999).');
      return;
    }
    const singleNum = toThreeDigit(cleanNum);
    const atLeastOneValidMode = selectedBetTypes.some((t) => validateBetForMode(singleNum, t).valid);
    if (!atLeastOneValidMode) {
      const firstReason = validateBetForMode(singleNum, selectedBetTypes[0]).reason || 'Selected mode is not valid for this number.';
      setValidationMsg(firstReason);
      return;
    }
    const result = addNumbersToBetState([singleNum], selectedBetTypes, pts, selectedRate);
    if (!result.createdCount) {
      setValidationMsg('Duplicate entry blocked.');
      return;
    }
    setInputNumber('');
    setRangeFrom('');
    setValidationMsg('');
    setToast('Bet Added Successfully');
  }, [
    inputNumber,
    points,
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
    toThreeDigit,
  ]);

  const handleBuy = useCallback(() => {
    if (!bets.length) {
      setValidationMsg('Add at least one bet before BUY.');
      return;
    }
    const { updatedBets, totalWinPoints, totalLossPoints } = checkWinningBets(bets, results);
    setBets(updatedBets);
    const matched = updatedBets.filter((b) => b.outcome === 'win').length;
    setLastTxnId(`GM${Date.now()}`);
    setLastPoints(totalPoints);
    setValidationMsg('');
    setBuySummary({ totalBets: updatedBets.length, matched, totalWinPoints, totalLossPoints });
  }, [bets, results, totalPoints]);

  const handleClearAll = useCallback(() => {
    setBets([]);
    setInputNumber('');
    setPoints('10');
    setSelectedModes(['single']);
    setSelectedRate(10);
    setSelectedPanels(['A', 'B', 'C']);
    setSelectedDigits([]);
    setRangeFrom('');
    setRangeTo('');
    setLPickType('box');
    setQty('');
    setAllowDuplicates(false);
    setValidationMsg('');
    setToast('');
    setBuySummary(null);
  }, []);

  const handleAdvance = useCallback(() => {
    if (!window.confirm('Are you sure to generate next result?')) return;
    applyFreshResult(generate3DResult());
    setTimerSeconds(GAME_INTERVAL_SECONDS);
    setNextDrawAt(getNextDrawTime(new Date()));
  }, [applyFreshResult]);

  const handleHeaderAction = useCallback((label) => {
    if (label.toLowerCase() === 'refresh') {
      applyFreshResult(generate3DResult());
      setToast('Result Refreshed');
      return;
    }
    if (label.toLowerCase() === 'logout') {
      localStorage.removeItem(STORAGE_KEY);
      window.alert('Demo logout action triggered.');
      return;
    }
    setToast(`${label} clicked`);
  }, [applyFreshResult]);

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
    if (canAddBet) addBet();
    else setValidationMsg('Please complete number, points and at least one mode.');
  }, [addBet, canAddBet]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#efefef]">
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
        <div className="w-full h-full bg-white border border-[#d2d2d2] rounded-xl shadow-[0_6px_18px_rgba(0,0,0,0.08)] p-3 overflow-hidden grid grid-rows-[1.6fr_0.75fr_1fr_0.2fr_6.45fr] gap-2">
        {toast ? (
          <div className="fixed top-4 right-4 z-50 bg-[#2ca44f] text-white px-4 py-2 rounded-md shadow-md text-[14px] font-semibold">
            {toast}
          </div>
        ) : null}

        <div className="grid grid-cols-[280px_1fr] gap-2 items-stretch min-h-0">
          <div className="bg-[#fffbe8] border border-[#ead278] rounded-lg p-3 shadow-sm">
            <div className="text-[30px] md:text-[34px] font-bold text-[#d31b1b] leading-none">Mahalaxmi</div>
            <div className="text-[36px] md:text-[40px] font-bold text-[#d31b1b] leading-none mt-1">3D Quiz</div>
            <div className="mt-2 text-[13px] text-[#333]">Last Draw: <span className="font-semibold">{timeToDrawText}</span></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <ResultPanel title="A" digits={results.A} isUpdated={isResultFresh} lastResultText={lastResults.A} />
            <ResultPanel title="B" digits={results.B} isUpdated={isResultFresh} lastResultText={lastResults.B} />
            <ResultPanel title="C" digits={results.C} isUpdated={isResultFresh} lastResultText={lastResults.C} />
          </div>
        </div>

        <div className="h-full bg-[#f4c12d] border border-[#c79300] rounded-lg p-1 grid grid-cols-8 gap-1 min-h-0">
          {TAB_BUTTONS.map((tab) => (
            <button key={tab} type="button" onClick={() => handleHeaderAction(tab)} className="h-full bg-[#efbb2f] border border-[#d39f1a] rounded text-[14px] font-semibold text-[#1d2b4d]">
              {tab}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-8 gap-1 text-center min-h-0">
          <div className="bg-white border border-[#ddd] rounded py-1">
            <div className="text-[12px] text-[#444]">Time To Draw</div>
            <div className={`text-[24px] font-bold leading-none ${timerSeconds <= 10 ? 'text-[#d4372f] animate-pulse' : 'text-[#111]'}`}>{formatTimer(timerSeconds)}</div>
          </div>
          <div className="bg-white border border-[#ddd] rounded py-1">
            <div className="text-[12px] text-[#444]">Dr.Time</div>
            <div className="text-[20px] font-semibold leading-none">{timeToDrawText}</div>
          </div>
          <div className="bg-white border border-[#ddd] rounded py-1">
            <div className="text-[12px] text-[#444]">Id</div>
            <div className="text-[18px] font-semibold leading-none">user</div>
          </div>
          <div className="bg-white border border-[#ddd] rounded py-1">
            <div className="text-[12px] text-[#444]">Time</div>
            <div className="text-[18px] font-semibold leading-none">{currentTimeText}</div>
          </div>
          <div className="bg-white border border-[#ddd] rounded py-1">
            <div className="text-[12px] text-[#444]">Limit</div>
            <div className="text-[18px] font-semibold leading-none">657968</div>
          </div>
          <div className="bg-white border border-[#ddd] rounded py-1">
            <div className="text-[12px] text-[#444]">Last Trn</div>
            <div className="text-[18px] font-semibold leading-none">{lastTxnId}</div>
          </div>
          <div className="bg-white border border-[#ddd] rounded py-1">
            <div className="text-[12px] text-[#444]">Last Pts</div>
            <div className="text-[18px] font-semibold leading-none">{lastPoints}</div>
          </div>
        </div>

        <div className="h-full w-full bg-[#efefef] rounded overflow-hidden min-h-0">
          <div className={`h-full transition-all duration-700 ${timerSeconds <= 10 ? 'bg-[#d4372f]' : 'bg-[#2e59c6]'}`} style={{ width: `${Math.max(0, Math.min(100, (timerSeconds / GAME_INTERVAL_SECONDS) * 100))}%` }} />
        </div>

        <div className="grid grid-cols-[1fr_250px] gap-2 min-h-0 h-full">
          <div className="h-full min-h-0 grid grid-rows-[1fr_1fr_1.3fr_3.2fr_1fr] gap-2">
            <div className="bg-[#f4c12d] border border-[#c79300] rounded-lg p-2 flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#176da8] text-white rounded text-[15px]">
                <input type="checkbox" checked={selectedPanels.length === 3} onChange={() => setSelectedPanels(selectedPanels.length === 3 ? [] : [...PANEL_OPTIONS])} />
                ALL
              </label>
              {PANEL_OPTIONS.map((panel) => (
                <label key={panel} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-white text-[15px] ${panel === 'A' ? 'bg-[#1f5ea8]' : panel === 'B' ? 'bg-[#b42a1d]' : 'bg-[#1f7a57]'}`}>
                  <input type="checkbox" checked={selectedPanels.includes(panel)} onChange={() => togglePanel(panel)} />
                  {panel}
                </label>
              ))}
              <button
                type="button"
                onClick={handleToggleAllDigits}
                className={`px-2.5 py-1.5 rounded-full border text-[14px] font-semibold ${
                  selectedDigits.length === DIGIT_OPTIONS.length
                    ? 'bg-[#ef3f34] border-[#d4372f] text-white'
                    : 'bg-[#f5d06a] border-[#cf9d21] text-[#1d2b4d]'
                }`}
              >
                All
              </button>
              {DIGIT_OPTIONS.map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => toggleDigit(digit)}
                  className={`w-9 h-9 rounded-full border text-[15px] font-semibold ${selectedDigits.includes(digit) ? 'bg-[#ef3f34] border-[#d4372f] text-white' : 'bg-[#f5d06a] border-[#cf9d21] text-[#1d2b4d]'}`}
                >
                  {digit}
                </button>
              ))}
              <button type="button" onClick={() => navigate('/lottery')} className="ml-auto px-3.5 h-9 rounded bg-[#c22c1f] border border-[#a52318] text-white text-[15px] font-semibold">2D</button>
            </div>

            <div className="bg-white border border-[#d9d9d9] rounded-lg p-2.5 grid grid-cols-10 gap-2 items-center">
              {MODE_OPTIONS.map((mode) => (
                <label key={mode} className="inline-flex items-center justify-center gap-1.5 h-10 px-1 border border-[#d8d8d8] rounded-md bg-[#fbfbfb] text-[15px] uppercase font-semibold whitespace-nowrap">
                  <input type="checkbox" className="w-4 h-4" checked={selectedModes.includes(mode)} onChange={() => toggleMode(mode)} />
                  <span>{mode}</span>
                </label>
              ))}
            </div>

            <div className="bg-white border border-[#d9d9d9] rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-3">
                <input
                  value={inputNumber}
                  onChange={(e) => {
                    const next = e.target.value.replace(/\D/g, '').slice(0, 3);
                    setInputNumber(next);
                    if (validationMsg) setValidationMsg('');
                  }}
                  placeholder="ADD NUMBER"
                  className="h-12 w-[190px] px-4 border-2 border-[#2e59c6] rounded-full text-center text-[18px] font-semibold tracking-[1px]"
                />
                <button type="button" disabled={!canAddBet} onClick={addBet} className={`h-12 px-6 rounded-full border text-[17px] font-semibold ${canAddBet ? 'bg-white border-[#2e59c6] text-[#2e59c6]' : 'bg-[#f0f2f7] border-[#c6cede] text-[#8d96ac]'}`}>
                  ADD
                </button>
                <span className="font-semibold text-[18px] text-[#1d2b4d]">Range:</span>
                <input
                  value={rangeFrom}
                  onChange={(e) => {
                    const next = e.target.value.replace(/\D/g, '').slice(0, 3);
                    setRangeFrom(next);
                    if (validationMsg) setValidationMsg('');
                  }}
                  placeholder="NUM."
                  className="h-11 w-[76px] px-2 border border-[#d1d1d1] rounded-full text-center text-[16px]"
                />
                <span className="font-semibold text-[18px] text-[#1d2b4d]">To</span>
                <input value={rangeTo} onChange={(e) => setRangeTo(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="NUM." className="h-11 w-[76px] px-2 border border-[#d1d1d1] rounded-full text-center text-[16px]" />
                <span className="font-semibold text-[18px] text-[#1d2b4d]">L-Pick:</span>
                <select value={lPickType} onChange={(e) => setLPickType(e.target.value)} className="h-11 px-4 border border-[#d1d1d1] rounded-full text-[16px]">
                  {LPICK_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt.toUpperCase()}
                    </option>
                  ))}
                </select>
                <input value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="Qty" className="h-11 w-[76px] px-2 border border-[#d1d1d1] rounded-full text-center text-[16px]" />
              </div>
              <div className="grid grid-cols-[74px_repeat(6,minmax(0,1fr))] gap-2 items-center">
                <span className="font-semibold text-[19px] text-[#1d2b4d]">Rate:</span>
                {RATE_OPTIONS.map((rate) => (
                  <label key={rate} className="inline-flex items-center justify-center gap-1.5 h-10 px-2 border border-[#d8d8d8] rounded-md bg-[#fbfbfb] text-[18px] font-semibold whitespace-nowrap">
                    <input type="radio" className="w-4 h-4" checked={selectedRate === rate} onChange={() => setSelectedRate(rate)} />
                    <span className="text-[18px] leading-none text-[#222]">{rate}</span>
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#1d2b4d]">
                  <input type="checkbox" checked={allowDuplicates} onChange={(e) => setAllowDuplicates(e.target.checked)} />
                  Allow Duplicates
                </label>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="h-9 px-4 rounded border border-[#d4372f] text-[#d4372f] font-semibold"
                >
                  Clear All
                </button>
                <div className="text-[14px] text-[#334155] font-semibold">
                  Total Count: {bets.length}
                </div>
              </div>
              {validationMsg ? <div className="text-[13px] text-[#d4372f] font-semibold">{validationMsg}</div> : null}
            </div>

            <div className="bg-white border-2 border-[#d9d9d9] rounded-lg p-3 h-full min-h-0 overflow-y-auto">
              {!bets.length ? (
                <div className="h-full flex items-center justify-center text-[42px] text-[#9a9a9a]">No bets placed yet</div>
              ) : (
                <div className="space-y-2">
                  {bets.map((bet) => (
                    <div
                      key={bet.id}
                      className={`grid grid-cols-[1fr_90px_90px_80px] items-center gap-2 px-3 py-2 rounded border ${
                        bet.outcome === 'win' ? 'bg-[#eaf8ea] border-[#80c980]' : bet.outcome === 'loss' ? 'bg-[#ffecec] border-[#e9a0a0]' : 'bg-[#fafafa] border-[#dcdcdc]'
                      } ${bet.justAdded ? 'animate-pulse' : ''}`}
                    >
                      <div className="font-semibold text-[20px]">{getDisplayBetNumber(bet)}</div>
                      <div className="uppercase text-[16px] font-semibold">{bet.mode}</div>
                      <div className="text-[18px] font-semibold">{bet.points}</div>
                      <button type="button" onClick={() => setBets((prev) => prev.filter((x) => x.id !== bet.id))} className="h-9 rounded bg-[#ef3f34] border border-[#d4372f] text-white font-semibold">
                        Remove
                      </button>
                      {bet.outcome ? (
                        <div className="col-span-4 text-[12px] pt-1">
                          <span className={`font-semibold ${bet.outcome === 'win' ? 'text-[#2ca44f]' : 'text-[#d4372f]'}`}>
                            {bet.outcome.toUpperCase()}
                          </span>
                          <span className="ml-2">Panel: {bet.matchedPanel || '-'}</span>
                          <span className="ml-2">Result: {bet.matchedResult || '-'}</span>
                          <div className="text-[#444] mt-0.5">Reason: {bet.matchReason || '-'}</div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 h-full">
              <button type="button" onClick={handleBuy} className="h-12 px-6 bg-[#2ca44f] border border-[#248a42] rounded-lg text-white text-[26px] font-semibold">BUY</button>
              <button type="button" onClick={handleClearAll} className="h-12 px-6 bg-[#ef3f34] border border-[#d4372f] rounded-lg text-white text-[26px] font-semibold">Clear</button>
              <button type="button" onClick={handleAdvance} className="h-12 px-6 bg-[#1f6d98] border border-[#19597c] rounded-lg text-white text-[26px] font-semibold">Advance</button>
              <div className="ml-auto h-12 min-w-[92px] rounded-lg border-2 border-[#d54d44] text-[34px] font-semibold text-[#1d2b4d] px-4 flex items-center justify-center bg-white">
                {totalPoints}
              </div>
            </div>

          </div>

          <div className="h-full min-h-0 grid grid-rows-[auto_1fr_auto] gap-2">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={handleMotorPick} className="h-12 rounded-lg bg-[#c22c1f] border border-[#a52318] text-white text-[24px] font-semibold">Motor</button>
              <button type="button" onClick={handleLuckyPick} className="h-12 rounded-lg bg-[#f4c12d] border border-[#c79300] text-[#1d2b4d] text-[24px] font-semibold">Lucky Pick</button>
            </div>
            <Keypad
              onDigit={handleDigitInput}
              onClear={() => {
                setInputNumber('');
                if (validationMsg) setValidationMsg('');
              }}
              onDelete={() => {
                setInputNumber((prev) => prev.slice(0, -1));
                if (validationMsg) setValidationMsg('');
              }}
              onIncreasePoint={() => setPoints((prev) => String(Number(prev || 0) + 1))}
              onDecreasePoint={() => setPoints((prev) => String(Math.max(0, Number(prev || 0) - 1)))}
              onNext={handleNextFromKeypad}
              points={points}
            />
            <button type="button" onClick={() => navigate('/lottery')} className="w-full h-12 bg-[#f0b420] border border-[#d69d15] rounded text-[18px] font-semibold text-[#111]">
              Back To Lottery
            </button>
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
              </div>
              <button type="button" onClick={() => setBuySummary(null)} className="mt-4 w-full h-11 bg-[#2e59c6] border border-[#264ca7] rounded text-white font-semibold">
                Close
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
