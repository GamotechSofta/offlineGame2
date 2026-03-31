import React, { useEffect, useState, useMemo } from 'react';
import BidLayout from '../BidLayout';
import BidReviewModal from './BidReviewModal';
import { useBettingWindow } from '../BettingWindowContext';
import { placeBet, updateUserBalance } from '../../../api/bets';

const sanitizeDigits = (v) => (v ?? '').toString().replace(/\D/g, '').slice(0, 10);
const sanitizePoints = (v) => (v ?? '').toString().replace(/\D/g, '').slice(0, 6);

/** Same validation as Double Pana: 3 digits, two consecutive same, first !== 0, digit ordering rules. */
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

/** Generate all 3-digit double pana combinations from unique digits (aab, aba, baa per pair), then filter to valid double pana only (same rules as Double Pana). */
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

const DpMotorBid = ({ market, title }) => {
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

  const toggleDigit = (d) => {
    const digit = String(d);
    setDigitInput((prev) => {
      const current = sanitizeDigits(prev);
      if (current.includes(digit)) {
        return current.split('').filter((x) => x !== digit).join('');
      }
      return sanitizeDigits(current + digit);
    });
  };

  const handleGenerate = () => {
    const digits = sanitizeDigits(digitInput);
    if (digits.length < 2) {
      showWarning('Enter at least 2 digits to generate double pana combinations.');
      return;
    }
    const rawPoints = sanitizePoints(pointsInput);
    const pts = parseInt(rawPoints, 10);
    if (!Number.isFinite(pts) || pts < 1) {
      showWarning('Please enter points.');
      return;
    }
    const combos = generateDoublePanaCombinations(digits);
    if (!combos.length) {
      showWarning('No valid double pana from these digits. Use same rules as Double Pana (e.g. 112, 220).');
      return;
    }
    setCombinations(
      combos.map((pana) => ({
        id: `${pana}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        pana,
        points: String(pts),
      }))
    );
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

  const rowsWithPoints = useMemo(
    () => combinations.filter((c) => Number(c.points) > 0),
    [combinations]
  );
  const bidsCount = rowsWithPoints.length;
  const totalPoints = useMemo(
    () => rowsWithPoints.reduce((sum, c) => sum + Number(c.points || 0), 0),
    [rowsWithPoints]
  );

  const clearLocal = () => {
    setDigitInput('');
    setPointsInput('');
    setCombinations([]);
  };

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
        betType: 'dp-motor',
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
      showSessionOnMobile
      session={session}
      setSession={setSession}
      selectedDate={selectedDate}
      setSelectedDate={handleDateChange}
      hideFooter
      walletBalance={walletBefore}
      contentPaddingClass="pb-10"
      dateSessionGridClassName="!pb-1"
      dateSessionControlClassName="!min-h-[36px] !h-[36px] !py-1.5 !text-[11px] sm:!text-xs"
      extraHeader={
        <>
          <div className="md:hidden w-full px-3 py-1">
            <div className="grid grid-cols-2 gap-1.5 md:gap-2">
              <div className="rounded-xl border border-gray-300 bg-white px-2 py-1.5 md:px-3 md:py-2 text-center">
                <div className="text-[11px] text-gray-600 font-medium">Count</div>
                <div className="text-base font-bold text-[#1B3150] leading-tight">{bidsCount}</div>
              </div>
              <div className="rounded-xl border border-gray-300 bg-white px-2 py-1.5 md:px-3 md:py-2 text-center">
                <div className="text-[11px] text-gray-600 font-medium">Bet Amount</div>
                <div className="text-base font-bold text-[#1B3150] leading-tight">{totalPoints}</div>
              </div>
            </div>
          </div>
          <div className="hidden md:flex pr-12 pl-1 pb-0 justify-end w-full">
            <div className="inline-flex items-center gap-2 md:gap-4">
              <div className="text-center">
                <div className="text-[10px] md:text-xs text-gray-500">Count</div>
                <div className="text-xs md:text-base font-bold text-[#1B3150]">{bidsCount}</div>
              </div>
              <div className="w-px h-6 md:h-8 bg-gray-200" />
              <div className="text-center">
                <div className="text-[10px] md:text-xs text-gray-500">Bet Amount</div>
                <div className="text-xs md:text-base font-bold text-[#1B3150]">{totalPoints}</div>
              </div>
            </div>
          </div>
        </>
      }
    >
      <div className="px-3 sm:px-4 pt-0 pb-2 min-h-0">
        {warning && (
          <div className="fixed top-16 sm:top-20 left-1/2 transform -translate-x-1/2 z-50 bg-white border border-green-200 text-green-600 rounded-lg px-3 py-2.5 text-xs sm:text-sm font-medium shadow-xl max-w-[calc(100%-2rem)] sm:max-w-md backdrop-blur-sm">
            {warning}
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4 sm:gap-5 items-stretch md:items-start">
          <div className="flex flex-col gap-3 w-full md:w-1/2 shrink-0 min-w-0">
            <div>
              <div className="block text-[11px] sm:text-xs font-semibold text-gray-500 mb-2">Select Digits</div>
              <div className="grid grid-cols-5 gap-2 mb-3">
                {Array.from({ length: 10 }, (_, i) => i).map((d) => {
                  const selected = sanitizeDigits(digitInput).includes(String(d));
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDigit(d)}
                      aria-pressed={selected}
                      className={`min-h-[40px] h-10 rounded-md font-bold text-sm sm:text-base transition-all active:scale-[0.98] border ${
                        selected
                          ? 'bg-[#1B3150] text-white border-[#1B3150]'
                          : 'bg-white text-[#1B3150] border-gray-300 hover:bg-[#1B3150]/5'
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <label className="shrink-0 w-24 text-xs sm:text-sm font-semibold text-gray-600">Enter digits</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={digitInput}
                  onChange={(e) => setDigitInput(sanitizeDigits(e.target.value))}
                  placeholder="e.g. 12345"
                  className="flex-1 min-w-0 min-h-[40px] h-10 sm:h-11 bg-white border border-gray-300 rounded-lg px-3 text-sm sm:text-base font-semibold text-gray-800"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="shrink-0 w-24 text-xs sm:text-sm font-semibold text-gray-600">Enter Points</label>
              <input
                type="text"
                inputMode="numeric"
                value={pointsInput}
                onChange={(e) => setPointsInput(sanitizePoints(e.target.value))}
                placeholder="Points"
                className="flex-1 min-w-0 min-h-[40px] h-10 sm:h-11 bg-white border border-gray-300 rounded-lg px-3 text-sm sm:text-base font-semibold text-gray-800"
              />
              <button
                type="button"
                onClick={clearLocal}
                className="min-h-[40px] h-10 px-4 rounded-md text-[11px] sm:text-xs font-semibold border-2 border-[#1B3150]/30 text-[#1B3150] bg-white hover:bg-[#1B3150]/5 active:scale-[0.98] transition-all shrink-0"
              >
                Clear
              </button>
            </div>
            <div className="flex items-center gap-2">
              <label className="shrink-0 w-24 text-xs sm:text-sm font-semibold text-gray-600">Quick Points</label>
              <div className="flex-1 min-w-0 grid grid-cols-5 gap-2">
                {[10, 20, 30, 40, 50].map((pts) => {
                  const selected = String(pointsInput || '') === String(pts);
                  return (
                    <button
                      key={pts}
                      type="button"
                      onClick={() => setPointsInput(String(pts))}
                      className={`min-h-[40px] h-10 rounded-md font-bold text-sm sm:text-base border transition-all active:scale-[0.98] ${
                        selected
                          ? 'bg-[#1B3150] text-white border-[#1B3150]'
                          : 'bg-white text-[#1B3150] border-gray-300 hover:bg-[#1B3150]/5'
                      }`}
                    >
                      {pts}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleGenerate}
                className="flex-1 min-h-[40px] h-10 py-2.5 rounded-lg bg-[#1B3150] text-white font-semibold text-sm sm:text-base"
              >
                GENERATE
              </button>
              <button
                type="button"
                onClick={openReview}
                disabled={!bidsCount || !bettingAllowed}
                className={`flex-1 bg-[#1B3150] text-white font-semibold text-sm sm:text-base py-2.5 min-h-[40px] h-10 rounded-lg shadow-lg hover:bg-[#152842] transition-all active:scale-[0.98] ${
                  !bidsCount || !bettingAllowed ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                Submit Bet {bidsCount > 0 && `(${bidsCount})`}
              </button>
            </div>
          </div>

          <div className="w-full md:w-1/2 flex-1 min-w-0 rounded-lg border border-gray-200 overflow-hidden flex flex-col min-h-[200px] sm:min-h-[260px] bg-white">
            <div className="grid grid-cols-[72px_1fr_48px] gap-2 bg-[#1B3150] text-white font-bold text-xs sm:text-sm py-2.5 px-2 sm:px-3">
                <div className="text-center">Dp Motor</div>
                <div className="text-center">Point</div>
                <div className="text-center">Delete</div>
            </div>
            <div className="max-h-[520px] sm:max-h-[560px] overflow-y-auto flex-1 bg-white">
              {combinations.length === 0 ? (
                <div className="py-6 text-center text-gray-400 text-sm">Generate to add</div>
              ) : (
                combinations.map((c) => (
                  <div
                    key={c.id}
                    className="grid grid-cols-[72px_1fr_48px] gap-2 items-center py-2.5 px-2 sm:px-3 border-b border-gray-200 min-h-[44px]"
                  >
                    <div className="text-center font-bold text-gray-800 text-sm sm:text-base">{c.pana}</div>
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
      </div>

      <BidReviewModal
        open={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        onSubmit={handleSubmitBet}
        marketTitle={marketTitle}
        dateText={dateText}
        labelKey="Dp Motar"
        rows={reviewRows}
        walletBefore={walletBefore}
        totalBids={reviewRows.length}
        totalAmount={totalPointsForFooter}
      />
    </BidLayout>
  );
};

export default DpMotorBid;
