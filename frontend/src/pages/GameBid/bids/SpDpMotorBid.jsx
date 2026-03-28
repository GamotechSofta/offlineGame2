import React, { useEffect, useState, useMemo } from 'react';
import BidLayout from '../BidLayout';
import BidReviewModal from './BidReviewModal';
import { useBettingWindow } from '../BettingWindowContext';
import { placeBet, updateUserBalance } from '../../../api/bets';
import { generateSpMotorSinglePanas, sanitizeMotorDigitsUnique } from './panaRules';

const sanitizePoints = (v) => (v ?? '').toString().replace(/\D/g, '').slice(0, 6);

function validateDoublePana(n) {
  if (!n) return false;
  const str = n.toString().trim();
  if (!/^[0-9]{3}$/.test(str)) return false;
  const digits = str.split('').map(Number);
  const [first, second, third] = digits;
  const hasConsecutiveSame = (first === second) || (second === third);
  if (!hasConsecutiveSame) return false;
  if (first === 0) return false;
  if (second === 0 && third === 0) return true;
  if (first === second && third === 0) return true;
  if (third <= first) return false;
  return true;
}

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
  return unique.filter(validateDoublePana);
}

const SpDpMotorBid = ({ market, title }) => {
  const [session, setSession] = useState(() =>
    market?.status === 'running' ? 'CLOSE' : 'OPEN'
  );
  const [digitInput, setDigitInput] = useState('');
  const [pointsInput, setPointsInput] = useState('');
  const [combinations, setCombinations] = useState([]);
  const [warning, setWarning] = useState('');
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewRows, setReviewRows] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    try {
      const savedDate = localStorage.getItem('betSelectedDate');
      if (savedDate) {
        const today = new Date().toISOString().split('T')[0];
        if (savedDate > today) return savedDate;
      }
    } catch (e) {}
    return new Date().toISOString().split('T')[0];
  });
  const [sortMode, setSortMode] = useState('none'); // 'none' | 'sp-first' | 'dp-first'

  const handleDateChange = (newDate) => {
    try {
      localStorage.setItem('betSelectedDate', newDate);
    } catch (e) {}
    setSelectedDate(newDate);
  };

  const isRunning = market?.status === 'running';
  useEffect(() => {
    if (isRunning) setSession('CLOSE');
  }, [isRunning]);

  const showWarning = (msg) => {
    setWarning(msg);
    window.clearTimeout(showWarning._t);
    showWarning._t = window.setTimeout(() => setWarning(''), 2200);
  };

  const handleGenerate = () => {
    const digits = sanitizeMotorDigitsUnique(digitInput);
    if (digits.length < 2) {
      showWarning('Enter at least 3 digits for SP and 2 digits for DP.');
      return;
    }
    const defaultPoints = sanitizePoints(pointsInput) || '10';
    const pts = Math.max(1, parseInt(defaultPoints, 10));

    const singleCombos = generateSpMotorSinglePanas(digits);
    const doubleCombos = generateDoublePanaCombinations(digits);

    if (!singleCombos.length && !doubleCombos.length) {
      showWarning('Could not generate SP/DP combinations from these digits.');
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
    ];

    setCombinations(all);
  };

  const updatePoint = (id, value) => {
    setCombinations((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, points: sanitizePoints(value) } : c
      )
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

  const openReview = () => {
    if (!rowsWithPoints.length) {
      showWarning('Add at least one combination with points, or generate and then submit.');
      return;
    }
    setReviewRows(
      rowsWithPoints.map((c) => ({
        id: c.id,
        number: c.pana,
        points: c.points,
        type: session,
        kind: c.kind,
      }))
    );
    setIsReviewOpen(true);
  };

  const totalPointsForFooter = useMemo(
    () => reviewRows.reduce((sum, r) => sum + Number(r.points || 0), 0),
    [reviewRows]
  );

  const handleSubmitBet = async () => {
    const marketId = market?._id || market?.id;
    if (!marketId) throw new Error('Market not found');
    const payload = reviewRows
      .map((r) => ({
        betType: r.kind === 'DP' ? 'dp-motor' : 'sp-motor',
        betNumber: String(r.number ?? '').trim(),
        amount: Number(r.points) || 0,
        betOn: String(r?.type || session).toUpperCase() === 'CLOSE' ? 'close' : 'open',
      }))
      .filter((b) => b.betNumber.length > 0 && b.amount > 0);

    if (payload.length === 0) {
      throw new Error('No valid bets to submit. Each bet needs a pana number and points > 0.');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDateObj = new Date(selectedDate);
    selectedDateObj.setHours(0, 0, 0, 0);
    const scheduledDate = selectedDateObj > today ? selectedDate : null;

    const result = await placeBet(marketId, payload, scheduledDate);
    if (!result.success) throw new Error(result.message);
    if (result.data?.newBalance != null)
      updateUserBalance(result.data.newBalance);
    setIsReviewOpen(false);
    setCombinations([]);
    setReviewRows([]);
    const todayStr = new Date().toISOString().split('T')[0];
    setSelectedDate(todayStr);
    try {
      localStorage.setItem('betSelectedDate', todayStr);
    } catch (e) {}
  };

  const dateText = new Date().toLocaleDateString('en-GB');
  const marketTitle = market?.gameName || market?.marketName || title;
  const { allowed: bettingAllowed } = useBettingWindow();
  const walletBefore = useMemo(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || 'null');
      const val =
        u?.wallet ||
        u?.balance ||
        u?.points ||
        u?.walletAmount ||
        u?.wallet_amount ||
        u?.amount ||
        0;
      const n = Number(val);
      return Number.isFinite(n) ? n : 0;
    } catch (e) {
      return 0;
    }
  }, []);

  return (
    <BidLayout
      market={market}
      title={title}
      bidsCount={bidsCount}
      totalPoints={totalPoints}
      showDateSession
      session={session}
      setSession={setSession}
      selectedDate={selectedDate}
      setSelectedDate={handleDateChange}
      hideFooter
      walletBalance={walletBefore}
    >
      <div className="p-3 sm:p-4 pb-24 md:pb-6 sm:pb-8 min-h-0">
        {warning ? (
          <div className="mb-3 p-3 rounded-xl bg-red-50/50 border border-red-200">
            <p className="text-red-600 text-sm">{warning}</p>
          </div>
        ) : null}

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
                className="w-full min-h-[44px] h-11 sm:h-12 bg-white border border-gray-300 rounded-lg px-3 text-sm sm:text-base font-semibold text-gray-800 touch-manipulation focus:border-[#1B3150] focus:outline-none focus:ring-1 focus:ring-[#1B3150]"
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
                className="w-full min-h-[44px] h-11 sm:h-12 bg-white border border-gray-300 rounded-lg px-3 text-sm sm:text-base font-semibold text-gray-800 touch-manipulation focus:border-[#1B3150] focus:outline-none focus:ring-1 focus:ring-[#1B3150]"
              />
            </div>
            <button
              type="button"
              onClick={handleGenerate}
              className="w-full min-h-[48px] py-3.5 rounded-lg bg-[#1B3150] text-white font-bold text-base touch-manipulation active:opacity-90"
            >
              GENERATE
            </button>

            <div className="hidden md:flex flex-col">
              <div className="flex gap-6 mt-2">
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
                onClick={openReview}
                disabled={!bidsCount || !bettingAllowed}
                className={`w-full min-h-[48px] mt-3 py-3 rounded-xl font-bold text-white text-sm touch-manipulation ${
                  bidsCount && bettingAllowed ? 'bg-[#1B3150] active:opacity-90' : 'bg-gray-400 opacity-50 cursor-not-allowed'
                }`}
              >
                SUBMIT
              </button>
            </div>
          </div>

          <div className="w-full md:w-1/2 flex-1 min-w-0 rounded-lg border border-gray-200 overflow-hidden flex flex-col min-h-[200px] sm:min-h-[260px]">
            <div className="overflow-x-auto shrink-0">
              <div className="flex items-stretch justify-between gap-2 bg-[#1B3150] text-white min-w-0 px-2 sm:px-3 py-2">
                <div className="grid grid-cols-[minmax(64px,72px)_minmax(56px,72px)_1fr_minmax(44px,48px)] sm:grid-cols-[72px_72px_1fr_48px] gap-2 flex-1 text-xs sm:text-sm font-bold">
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
                      sortMode === 'sp-first' ? 'bg-white text-[#1B3150]' : 'bg-[#1B3150] text-white'
                    }`}
                  >
                    SP First
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortMode('dp-first')}
                    className={`px-2 py-1 rounded text-[10px] sm:text-xs font-semibold border border-white/40 ${
                      sortMode === 'dp-first' ? 'bg-white text-[#1B3150]' : 'bg-[#1B3150] text-white'
                    }`}
                  >
                    DP First
                  </button>
                </div>
              </div>
            </div>
            <div className="max-h-[240px] sm:max-h-[280px] overflow-y-auto overflow-x-auto flex-1 bg-white">
              {sortedCombinations.length === 0 ? (
                <div className="py-6 text-center text-gray-400 text-sm">Generate to add</div>
              ) : (
                <div className="min-w-0">
                  {sortedCombinations.map((c) => (
                    <div
                      key={c.id}
                      className="grid grid-cols-[minmax(64px,72px)_minmax(56px,72px)_1fr_minmax(44px,48px)] sm:grid-cols-[72px_72px_1fr_48px] gap-2 items-center py-2.5 px-2 sm:px-3 border-b border-gray-200 min-h-[44px]"
                    >
                      <div className="text-center font-bold text-gray-800 text-sm sm:text-base">{c.pana}</div>
                      <div className="text-center font-semibold text-gray-700 text-xs sm:text-sm">
                        {c.kind === 'DP' ? 'DP' : 'SP'}
                      </div>
                      <div className="px-1 sm:px-2 min-w-0">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={c.points}
                          onChange={(e) => updatePoint(c.id, e.target.value)}
                          className="w-full min-h-[40px] h-9 border border-gray-300 rounded-md px-2 text-center text-sm font-semibold text-gray-800 touch-manipulation focus:border-[#1B3150] focus:outline-none focus:ring-1 focus:ring-[#1B3150]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCombination(c.id)}
                        className="min-h-[40px] h-9 flex items-center justify-center rounded-md bg-red-50/80 text-red-600 touch-manipulation active:opacity-80"
                        aria-label="Delete"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          className="md:hidden fixed left-0 right-0 z-10 px-3 py-2 bg-[#E8ECEF] border-t border-[#e5e7eb] flex items-center justify-between gap-2"
          style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
        >
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
            onClick={openReview}
            disabled={!bidsCount || !bettingAllowed}
            className={`shrink-0 min-h-[36px] px-4 py-1.5 rounded-lg font-bold text-white text-xs touch-manipulation ${
              bidsCount && bettingAllowed ? 'bg-[#1B3150] active:opacity-90' : 'bg-gray-400 opacity-50 cursor-not-allowed'
            }`}
          >
            SUBMIT
          </button>
        </div>
      </div>

      <BidReviewModal
        open={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        onSubmit={handleSubmitBet}
        marketTitle={marketTitle}
        dateText={dateText}
        labelKey="SP/DP Motar"
        rows={reviewRows}
        walletBefore={walletBefore}
        totalBids={reviewRows.length}
        totalAmount={totalPointsForFooter}
      />
    </BidLayout>
  );
};

export default SpDpMotorBid;

