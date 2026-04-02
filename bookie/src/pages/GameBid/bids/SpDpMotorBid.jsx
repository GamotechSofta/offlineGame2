import React, { useEffect, useState, useMemo } from 'react';
import BookieBidLayout from '../BookieBidLayout';
import { usePlayerBet } from '../PlayerBetContext';
import { useBetCart } from '../BetCartContext';
import { isPastOpeningTime } from '../../../utils/marketTiming';
import {
  generateSpMotorSinglePanas,
  isValidDoublePana,
  sanitizeMotorDigitsUnique,
} from '../panaRules';

const sanitizePoints = (v) => (v ?? '').toString().replace(/\D/g, '').slice(0, 6);

function generateDoublePanaCombinations(digitStr) {
  const digits = [...new Set(digitStr.replace(/\D/g, '').split('').sort())];
  if (digits.length < 2) return [];
  const out = [];
  const n = digits.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const a = digits[i];
      const b = digits[j];
      out.push(a + a + b);
      out.push(a + b + a);
      out.push(b + a + a);
    }
  }
  const unique = [...new Set(out)];
  return unique.filter((s) => isValidDoublePana(s));
}

function generateTriplePanaCombinations(digitStr) {
  const digits = [...new Set(digitStr.replace(/\D/g, '').split('').sort())];
  return digits.map((d) => `${d}${d}${d}`);
}

const SpDpMotorBid = ({ title, gameType, betType, embedInSingleScroll = false }) => {
  const isSpDpTMotor = String(title || '').toLowerCase().includes('sp dp t motor');
  const { market } = usePlayerBet();
  const { addToCart } = useBetCart();
  const [session, setSession] = useState(() => (isPastOpeningTime(market) ? 'CLOSE' : 'OPEN'));
  const [digitInput, setDigitInput] = useState('');
  const [pointsInput, setPointsInput] = useState('');
  const [combinations, setCombinations] = useState([]);
  const [warning, setWarning] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    try {
      const savedDate = localStorage.getItem('bookieBetSelectedDate');
      if (savedDate && savedDate > new Date().toISOString().split('T')[0]) return savedDate;
    } catch (e) {}
    return new Date().toISOString().split('T')[0];
  });
  const [sortMode, setSortMode] = useState('none');

  const handleDateChange = (newDate) => {
    try { localStorage.setItem('bookieBetSelectedDate', newDate); } catch (e) {}
    setSelectedDate(newDate);
  };

  useEffect(() => {
    if (isPastOpeningTime(market)) setSession('CLOSE');
  }, [market]);

  const showWarning = (msg) => {
    setWarning(msg);
    window.clearTimeout(showWarning._t);
    showWarning._t = window.setTimeout(() => setWarning(''), 2200);
  };

  const handleGenerate = () => {
    const digits = sanitizeMotorDigitsUnique(digitInput);
    if (digits.length < 2) {
      showWarning(`Enter at least 3 digits for SP and 2 digits for DP${isSpDpTMotor ? ', and selected digits for T' : ''}.`);
      return;
    }
    const rawPoints = sanitizePoints(pointsInput);
    const pts = parseInt(rawPoints, 10);
    if (!Number.isFinite(pts) || pts < 1) {
      showWarning('Please enter points.');
      return;
    }
    const singleCombos = generateSpMotorSinglePanas(digits);
    const doubleCombos = generateDoublePanaCombinations(digits);
    const tripleCombos = isSpDpTMotor ? generateTriplePanaCombinations(digits) : [];
    if (!singleCombos.length && !doubleCombos.length && !tripleCombos.length) {
      showWarning(`Could not generate ${isSpDpTMotor ? 'SP/DP/T' : 'SP/DP'} combinations from these digits.`);
      return;
    }
    const now = Date.now();
    const all = [
      ...singleCombos.map((pana, idx) => ({
        id: `sp-${pana}-${now}-${idx}-${Math.random().toString(36).slice(2)}`,
        pana,
        kind: 'SP',
        points: String(pts),
      })),
      ...doubleCombos.map((pana, idx) => ({
        id: `dp-${pana}-${now}-${idx}-${Math.random().toString(36).slice(2)}`,
        pana,
        kind: 'DP',
        points: String(pts),
      })),
      ...tripleCombos.map((pana, idx) => ({
        id: `tp-${pana}-${now}-${idx}-${Math.random().toString(36).slice(2)}`,
        pana,
        kind: 'TP',
        points: String(pts),
      })),
    ];
    setCombinations(all);
  };

  const updatePoint = (id, value) => {
    setCombinations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, points: sanitizePoints(value) } : c))
    );
  };

  const removeCombination = (id) => {
    setCombinations((prev) => prev.filter((c) => c.id !== id));
  };

  const sortedCombinations = useMemo(() => {
    const base = [...combinations];
    if (sortMode === 'sp-first') {
      base.sort((a, b) => {
        if (a.kind === b.kind) return Number(a.pana) - Number(b.pana);
        return a.kind === 'SP' ? -1 : 1;
      });
    } else if (sortMode === 'dp-first') {
      base.sort((a, b) => {
        if (a.kind === b.kind) return Number(a.pana) - Number(b.pana);
        return a.kind === 'DP' ? -1 : 1;
      });
    } else {
      base.sort((a, b) => Number(a.pana) - Number(b.pana));
    }
    return base;
  }, [combinations, sortMode]);

  const rowsWithPoints = useMemo(
    () => sortedCombinations.filter((c) => Number(c.points) > 0),
    [sortedCombinations]
  );
  const bidsCount = rowsWithPoints.length;
  const totalPoints = useMemo(
    () => rowsWithPoints.reduce((sum, c) => sum + Number(c.points || 0), 0),
    [rowsWithPoints]
  );

  const handleAddToCart = () => {
    if (!rowsWithPoints.length) {
      showWarning('Add at least one combination with points, or generate and then add to cart.');
      return;
    }
    const spItems = rowsWithPoints.filter((c) => c.kind === 'SP').map((c) => ({ number: c.pana, points: c.points, type: session }));
    const dpItems = rowsWithPoints.filter((c) => c.kind === 'DP').map((c) => ({ number: c.pana, points: c.points, type: session }));
    const tpItems = rowsWithPoints.filter((c) => c.kind === 'TP').map((c) => ({ number: c.pana, points: c.points, type: session }));
    let count = 0;
    if (spItems.length) count += addToCart(spItems, gameType, title, 'sp-motor');
    if (dpItems.length) count += addToCart(dpItems, gameType, title, 'dp-motor');
    // Keep triple bets as panna for backward compatibility with older backend betType validators.
    if (tpItems.length) count += addToCart(tpItems, gameType, title, 'panna');
    if (count > 0) {
      showWarning(`Added ${count} bet(s) to cart ✓`);
      setCombinations([]);
    }
  };

  return (
    <BookieBidLayout
      title={title}
      bidsCount={bidsCount}
      totalPoints={totalPoints}
      showDateSession={!embedInSingleScroll}
      session={session}
      setSession={setSession}
      selectedDate={selectedDate}
      setSelectedDate={handleDateChange}
      hideFooter
      noHeader={embedInSingleScroll}
      noDateSession={embedInSingleScroll}
      noFooter={embedInSingleScroll}
      contentPaddingClass="pb-24"
    >
      <div className="px-2 sm:px-4 py-3 w-full max-w-full overflow-x-hidden">
        {warning && (
          <div className="fixed top-16 sm:top-20 left-1/2 transform -translate-x-1/2 z-50 bg-white border border-green-200 text-green-600 rounded-lg px-3 py-2.5 text-xs sm:text-sm font-medium shadow-xl max-w-[calc(100%-2rem)] sm:max-w-md">
            {warning}
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4 sm:gap-5 items-stretch md:items-start">
          <div className="flex flex-col gap-3 w-full md:w-1/2 shrink-0 min-w-0">
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-600 mb-1.5">Enter digits (0–9, no repeats)</label>
              <input
                type="text"
                inputMode="numeric"
                value={digitInput}
                onChange={(e) => setDigitInput(sanitizeMotorDigitsUnique(e.target.value))}
                placeholder="e.g. 0389"
                className="w-full min-h-[44px] h-11 sm:h-12 bg-white border border-gray-300 rounded-lg px-3 text-sm sm:text-base font-semibold text-gray-800"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-600 mb-1.5">Enter Points</label>
              <input
                type="text"
                inputMode="numeric"
                value={pointsInput}
                onChange={(e) => setPointsInput(sanitizePoints(e.target.value))}
                placeholder="Points"
                className="w-full min-h-[44px] h-11 sm:h-12 bg-white border border-gray-300 rounded-lg px-3 text-sm sm:text-base font-semibold text-gray-800"
              />
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              className="w-full min-h-[48px] py-3.5 rounded-lg bg-[#1B3150] text-white font-bold text-base"
            >
              GENERATE
            </button>
            <div className="hidden md:flex flex-col gap-2 mt-2">
              <div className="flex gap-6">
                <div className="flex flex-col items-center">
                  <span className="text-xs text-gray-500">Bets</span>
                  <span className="text-base sm:text-lg font-bold text-[#1B3150]">{bidsCount}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-xs text-gray-500">Points</span>
                  <span className="text-base sm:text-lg font-bold text-[#1B3150]">{totalPoints}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!bidsCount}
                className={`w-full min-h-[48px] py-3 rounded-xl font-bold text-white text-sm ${
                  bidsCount ? 'bg-[#1B3150] hover:bg-[#152842]' : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                Add to Cart
              </button>
            </div>
          </div>

          <div className="w-full md:w-1/2 flex-1 min-w-0 rounded-lg border border-gray-200 overflow-hidden flex flex-col min-h-[200px] sm:min-h-[260px]">
            <div className="flex items-stretch justify-between gap-2 bg-[#1B3150] text-white min-w-0 px-2 sm:px-3 py-2">
              <div className="grid grid-cols-[72px_56px_1fr_48px] gap-2 flex-1 text-xs sm:text-sm font-bold">
                <div className="text-center">Pana</div>
                <div className="text-center">Type</div>
                <div className="text-center">Point</div>
                <div className="text-center">Delete</div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setSortMode('sp-first')}
                  className={`px-2 py-1 rounded text-[10px] sm:text-xs font-semibold border border-white/40 ${
                    sortMode === 'sp-first' ? 'bg-white text-[#1B3150]' : 'bg-transparent'
                  }`}
                >
                  SP First
                </button>
                <button
                  type="button"
                  onClick={() => setSortMode('dp-first')}
                  className={`px-2 py-1 rounded text-[10px] sm:text-xs font-semibold border border-white/40 ${
                    sortMode === 'dp-first' ? 'bg-white text-[#1B3150]' : 'bg-transparent'
                  }`}
                >
                  DP First
                </button>
              </div>
            </div>
            <div className="max-h-[240px] sm:max-h-[280px] overflow-y-auto flex-1 bg-white">
              {sortedCombinations.length === 0 ? (
                <div className="py-6 text-center text-gray-400 text-sm">Generate to add</div>
              ) : (
                sortedCombinations.map((c) => (
                  <div
                    key={c.id}
                    className="grid grid-cols-[72px_56px_1fr_48px] gap-2 items-center py-2.5 px-2 sm:px-3 border-b border-gray-200 min-h-[44px]"
                  >
                    <div className="text-center font-bold text-gray-800 text-sm sm:text-base">{c.pana}</div>
                    <div className="text-center font-semibold text-gray-700 text-xs sm:text-sm">{c.kind === 'DP' ? 'DP' : (c.kind === 'TP' ? 'TP' : 'SP')}</div>
                    <div className="px-1 sm:px-2 min-w-0">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={c.points}
                        onChange={(e) => updatePoint(c.id, e.target.value)}
                        className="w-full min-h-[40px] h-9 border border-gray-300 rounded-md px-2 text-center text-sm font-semibold text-gray-800"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCombination(c.id)}
                      className="min-h-[40px] h-9 flex items-center justify-center rounded-md bg-red-50/80 text-red-600"
                      aria-label="Delete"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="md:hidden fixed left-0 right-0 z-10 px-3 py-2 bg-gray-100 border-t border-gray-200 flex items-center justify-between gap-2" style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center leading-tight">
              <span className="text-[10px] text-gray-500">Bets</span>
              <span className="text-sm font-bold text-[#1B3150]">{bidsCount}</span>
            </div>
            <div className="flex flex-col items-center leading-tight">
              <span className="text-[10px] text-gray-500">Points</span>
              <span className="text-sm font-bold text-[#1B3150]">{totalPoints}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!bidsCount}
            className={`shrink-0 min-h-[36px] px-4 py-1.5 rounded-lg font-bold text-white text-xs ${
              bidsCount ? 'bg-[#1B3150]' : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            Add to Cart
          </button>
        </div>
      </div>
    </BookieBidLayout>
  );
};

export default SpDpMotorBid;
