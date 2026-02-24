import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BidLayout from '../BidLayout';
import BidReviewModal from './BidReviewModal';
import { placeBet, updateUserBalance } from '../../../api/bets';

const DIGITS = Array.from({ length: 10 }, (_, i) => String(i));

const sanitizePoints = (v) => (v ?? '').toString().replace(/\D/g, '').slice(0, 6);

const JodiBulkBid = ({ market, title }) => {
    const cellRefs = useRef({});
    const pendingFocusRef = useRef(null);

    const [session, setSession] = useState('OPEN');
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [warning, setWarning] = useState('');
    const [selectedDate, setSelectedDate] = useState(() => {
        try {
            const savedDate = localStorage.getItem('betSelectedDate');
            if (savedDate) {
                const today = new Date().toISOString().split('T')[0];
                // Only restore if saved date is in the future (not today)
                if (savedDate > today) {
                    return savedDate;
                }
            }
        } catch (e) {
            // Ignore errors
        }
        const today = new Date();
        return today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    });
    
    // Save to localStorage when date changes
    const handleDateChange = (newDate) => {
        try {
            localStorage.setItem('betSelectedDate', newDate);
        } catch (e) {
            // Ignore errors
        }
        setSelectedDate(newDate);
    };

    const showWarning = (msg) => {
        setWarning(msg);
        window.clearTimeout(showWarning._t);
        showWarning._t = window.setTimeout(() => setWarning(''), 2400);
    };

    useEffect(() => {
        // Jodi: allow OPEN only (no CLOSE bets)
        if (session !== 'OPEN') setSession('OPEN');
    }, [session]);

    // cell values: key "rc" (row digit + col digit) => points string
    const [cells, setCells] = useState(() => {
        const init = {};
        for (const r of DIGITS) for (const c of DIGITS) init[`${r}${c}`] = '';
        return init;
    });
    const [rowBulk, setRowBulk] = useState(() => Object.fromEntries(DIGITS.map((d) => [d, ''])));
    const [colBulk, setColBulk] = useState(() => Object.fromEntries(DIGITS.map((d) => [d, ''])));
    const [isDesktop, setIsDesktop] = useState(() => {
        if (typeof window === 'undefined') return true;
        return window.innerWidth >= 768;
    });
    const [columnStart, setColumnStart] = useState(0);
    const MOBILE_VISIBLE_COLS = 5;

    useEffect(() => {
        const onResize = () => setIsDesktop(window.innerWidth >= 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        // Reset view window when switching desktop/mobile
        if (isDesktop) {
            setColumnStart(0);
        } else {
            const maxStart = Math.max(0, DIGITS.length - MOBILE_VISIBLE_COLS);
            setColumnStart((prev) => Math.max(0, Math.min(prev, maxStart)));
        }
    }, [isDesktop]);

    const visibleDigits = isDesktop
        ? DIGITS
        : DIGITS.slice(columnStart, columnStart + MOBILE_VISIBLE_COLS);
    const canSlideLeft = !isDesktop && columnStart > 0;
    const canSlideRight = !isDesktop && columnStart + MOBILE_VISIBLE_COLS < DIGITS.length;

    // Auto-apply row/column Pts after typing (no Enter or blur needed)
    const rowApplyTimersRef = useRef({});
    const colApplyTimersRef = useRef({});
    const APPLY_DELAY_MS = 600;

    useEffect(() => {
        const timers = {};
        DIGITS.forEach((r) => {
            const val = rowBulk[r];
            if (!val || Number(val) <= 0) return;
            if (rowApplyTimersRef.current[r]) clearTimeout(rowApplyTimersRef.current[r]);
            timers[r] = setTimeout(() => {
                applyRow(r, val);
                rowApplyTimersRef.current[r] = null;
            }, APPLY_DELAY_MS);
            rowApplyTimersRef.current[r] = timers[r];
        });
        return () => DIGITS.forEach((r) => { if (rowApplyTimersRef.current[r]) clearTimeout(rowApplyTimersRef.current[r]); });
    }, [rowBulk]);

    useEffect(() => {
        const timers = {};
        DIGITS.forEach((c) => {
            const val = colBulk[c];
            if (!val || Number(val) <= 0) return;
            if (colApplyTimersRef.current[c]) clearTimeout(colApplyTimersRef.current[c]);
            timers[c] = setTimeout(() => {
                applyCol(c, val);
                colApplyTimersRef.current[c] = null;
            }, APPLY_DELAY_MS);
            colApplyTimersRef.current[c] = timers[c];
        });
        return () => DIGITS.forEach((c) => { if (colApplyTimersRef.current[c]) clearTimeout(colApplyTimersRef.current[c]); });
    }, [colBulk]);

    // After column slide on mobile, focus the pending cell
    useEffect(() => {
        const p = pendingFocusRef.current;
        if (!p) return;
        const el = cellRefs.current[`${p.r}-${p.c}`];
        if (el) {
            el.focus();
            pendingFocusRef.current = null;
        }
    }, [columnStart]);

    const handleCellKeyDown = useCallback(
        (e, r, c) => {
            const key = e.key;
            if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'ArrowUp' && key !== 'ArrowDown') return;
            const ri = DIGITS.indexOf(r);
            const ci = DIGITS.indexOf(c);
            if (ri === -1 || ci === -1) return;

            let nextR = ri;
            let nextC = ci;
            if (key === 'ArrowLeft') {
                if (ci <= 0) return;
                nextC = ci - 1;
            } else if (key === 'ArrowRight') {
                if (ci >= DIGITS.length - 1) return;
                nextC = ci + 1;
            } else if (key === 'ArrowUp') {
                if (ri <= 0) return;
                nextR = ri - 1;
            } else if (key === 'ArrowDown') {
                if (ri >= DIGITS.length - 1) return;
                nextR = ri + 1;
            }

            const nextRStr = DIGITS[nextR];
            const nextCStr = DIGITS[nextC];

            if (!isDesktop) {
                const colIdx = DIGITS.indexOf(nextCStr);
                const visibleStart = columnStart;
                const visibleEnd = columnStart + MOBILE_VISIBLE_COLS - 1;
                if (colIdx < visibleStart || colIdx > visibleEnd) {
                    const newStart = Math.max(0, Math.min(colIdx, DIGITS.length - MOBILE_VISIBLE_COLS));
                    pendingFocusRef.current = { r: nextRStr, c: nextCStr };
                    setColumnStart(newStart);
                    e.preventDefault();
                    return;
                }
            }

            e.preventDefault();
            const el = cellRefs.current[`${nextRStr}-${nextCStr}`];
            if (el) el.focus();
        },
        [isDesktop, columnStart]
    );

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

    const marketTitle = market?.gameName || market?.marketName || title;
    const dateText = new Date().toLocaleDateString('en-GB'); // dd/mm/yyyy

    const rows = useMemo(() => {
        const out = [];
        for (const r of DIGITS) {
            for (const c of DIGITS) {
                const key = `${r}${c}`;
                const pts = Number(cells[key] || 0);
                if (pts > 0) out.push({ id: `${key}-${pts}`, number: key, points: String(pts), type: session });
            }
        }
        return out;
    }, [cells, session]);

    const totalPoints = useMemo(() => rows.reduce((sum, b) => sum + Number(b.points || 0), 0), [rows]);
    const canSubmit = rows.length > 0;

    const applyRow = (r, pts) => {
        const p = Number(pts);
        if (!p || p <= 0) {
            showWarning('Please enter points.');
            return;
        }
        setCells((prev) => {
            const next = { ...prev };
            for (const c of DIGITS) {
                const key = `${r}${c}`;
                const cur = Number(next[key] || 0) || 0;
                next[key] = String(cur + p);
            }
            return next;
        });
        setRowBulk((prev) => ({ ...prev, [r]: '' }));
    };

    const applyCol = (c, pts) => {
        const p = Number(pts);
        if (!p || p <= 0) {
            showWarning('Please enter points.');
            return;
        }
        setCells((prev) => {
            const next = { ...prev };
            for (const r of DIGITS) {
                const key = `${r}${c}`;
                const cur = Number(next[key] || 0) || 0;
                next[key] = String(cur + p);
            }
            return next;
        });
        setColBulk((prev) => ({ ...prev, [c]: '' }));
    };

    const clearAll = () => {
        setIsReviewOpen(false);
        setCells(() => {
            const init = {};
            for (const r of DIGITS) for (const c of DIGITS) init[`${r}${c}`] = '';
            return init;
        });
        setRowBulk(Object.fromEntries(DIGITS.map((d) => [d, ''])));
        setColBulk(Object.fromEntries(DIGITS.map((d) => [d, ''])));
        // Reset scheduled date to today after bet is placed
        const today = new Date().toISOString().split('T')[0];
        setSelectedDate(today);
        try {
            localStorage.removeItem('betSelectedDate');
        } catch (e) {
            // Ignore errors
        }
    };

    const handleSubmitBet = () => {
        if (!rows.length) {
            showWarning('Please enter points for at least one Jodi.');
            return;
        }
        setIsReviewOpen(true);
    };

    const handleCloseReview = () => {
        // keep same behavior as other screens: cancel clears
        clearAll();
    };

    const handleConfirmReview = async () => {
        const marketId = market?._id || market?.id;
        if (!marketId) throw new Error('Market not found');
        const payload = rows.map((r) => ({
            betType: 'jodi',
            betNumber: String(r.number),
            amount: Number(r.points) || 0,
            betOn: 'open',
        }));
        
        // Check if date is in the future (scheduled bet)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selectedDateObj = new Date(selectedDate);
        selectedDateObj.setHours(0, 0, 0, 0);
        const scheduledDate = selectedDateObj > today ? selectedDate : null;
        
        const result = await placeBet(marketId, payload, scheduledDate);
        if (!result.success) throw new Error(result.message);
        if (result.data?.newBalance != null) updateUserBalance(result.data.newBalance);
        setIsReviewOpen(false);
        clearAll();
    };

    return (
        <BidLayout
            market={market}
            title={title}
            bidsCount={rows.length}
            totalPoints={totalPoints}
            session={session}
            setSession={setSession}
            sessionOptionsOverride={['OPEN']}
            lockSessionSelect
            hideSessionSelectCaret
            // Desktop only: make date ~1/3 width and keep controls same height
            dateSessionGridClassName="md:grid-cols-[1fr_2fr]"
            dateSessionControlClassName="md:min-h-[52px] md:text-base"
            selectedDate={selectedDate}
            setSelectedDate={handleDateChange}
            sessionRightSlot={
                <button
                    type="button"
                    onClick={handleSubmitBet}
                    disabled={!canSubmit}
                    className={`hidden md:inline-flex items-center justify-center font-bold text-base min-h-[52px] min-w-[280px] px-7 rounded-full shadow-lg transition-all whitespace-nowrap ${
                        canSubmit
                            ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 active:scale-[0.98]'
                            : 'bg-gradient-to-r from-orange-300 to-orange-400 text-white opacity-50 cursor-not-allowed'
                    }`}
                >
                    Submit Bet
                </button>
            }
            walletBalance={walletBefore}
            hideFooter
            contentPaddingClass="pb-[calc(7rem+env(safe-area-inset-bottom,0px))] md:pb-6"
        >
            <div className="px-2 sm:px-4 md:px-4 py-1 md:py-1 w-full">
                {warning && (
                    <div className="mb-3 bg-red-50 border-2 border-red-300 text-red-600 rounded-xl px-4 py-3 text-sm">
                        {warning}
                    </div>
                )}

                <div className="bg-white border-2 border-orange-200 rounded-2xl p-2 sm:p-3 md:p-3 overflow-hidden w-full">
                    <div className="flex justify-end mb-2">
                        <button
                            type="button"
                            onClick={clearAll}
                            className="px-4 py-2 rounded-lg text-sm font-semibold border-2 border-orange-200 text-orange-600 bg-white hover:bg-orange-50 active:scale-[0.98] transition-all"
                        >
                            Clear
                        </button>
                    </div>
                    {!isDesktop && (
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <button
                                type="button"
                                onClick={() => setColumnStart((prev) => Math.max(0, prev - 1))}
                                disabled={!canSlideLeft}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                                    canSlideLeft
                                        ? 'bg-white border-orange-200 text-orange-600'
                                        : 'bg-gray-100 border-orange-200 text-gray-400 cursor-not-allowed'
                                }`}
                            >
                                ← Prev
                            </button>
                            <span className="text-[11px] text-gray-500 font-semibold">
                                Jodi Columns {visibleDigits[0]} - {visibleDigits[visibleDigits.length - 1]}
                            </span>
                            <button
                                type="button"
                                onClick={() => setColumnStart((prev) => Math.min(DIGITS.length - MOBILE_VISIBLE_COLS, prev + 1))}
                                disabled={!canSlideRight}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                                    canSlideRight
                                        ? 'bg-white border-orange-200 text-orange-600'
                                        : 'bg-gray-100 border-orange-200 text-gray-400 cursor-not-allowed'
                                }`}
                            >
                                Next →
                            </button>
                        </div>
                    )}
                    <div className="overflow-x-hidden scrollbar-hidden">
                        <div
                            className="grid w-full gap-[2px] sm:gap-1 md:gap-1"
                            style={{
                                gridTemplateColumns:
                                    `clamp(34px, 10vw, 80px) clamp(6px, 1vw, 18px) repeat(${visibleDigits.length}, minmax(18px, 1fr))`
                            }}
                        >
                            {/* Header digits */}
                            <div className="h-6 md:h-7" />
                            <div className="h-6 md:h-7" />
                            {visibleDigits.map((c) => (
                                <div
                                    key={`h-${c}`}
                                    className="h-6 md:h-7 w-full flex items-center justify-center text-orange-500 font-medium text-[10px] md:text-sm"
                                >
                                    {c}
                                </div>
                            ))}

                            {/* Column bulk inputs */}
                            <div className="h-6 md:h-7 w-full flex items-center justify-center text-[9px] md:text-xs text-gray-600 font-normal px-1">
                                <span className="md:hidden leading-[10px] text-center">
                                    Enter
                                    <br />
                                    Points
                                </span>
                                <span className="hidden md:inline">Enter Points</span>
                            </div>
                            <div className="h-6 md:h-7" />
                            {visibleDigits.map((c) => (
                                <input
                                    key={`col-${c}`}
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="Pts"
                                    value={colBulk[c]}
                                    onChange={(e) => setColBulk((p) => ({ ...p, [c]: sanitizePoints(e.target.value) }))}
                                    onBlur={() => {
                                        if (colBulk[c]) applyCol(c, colBulk[c]);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && colBulk[c]) applyCol(c, colBulk[c]);
                                    }}
                                    className="no-spinner w-full min-w-0 h-6 md:h-7 bg-white border-2 border-orange-200 text-gray-800 font-bold rounded text-[9px] md:text-xs text-center placeholder:text-gray-900 placeholder:opacity-500 placeholder:font-normal focus:outline-none focus:border-orange-500"
                                />
                            ))}

                            {/* Matrix rows */}
                            {DIGITS.map((r) => (
                                <React.Fragment key={`row-${r}`}>
                                    {/* Row label + bulk */}
                                    <div className="flex items-center gap-1 min-w-0">
                                        <div className="w-4 md:w-6 h-6 md:h-7 flex items-center justify-center text-orange-500 font-medium text-[10px] md:text-sm">
                                            {r}
                                        </div>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="Pts"
                                            value={rowBulk[r]}
                                            onChange={(e) => setRowBulk((p) => ({ ...p, [r]: sanitizePoints(e.target.value) }))}
                                            onBlur={() => {
                                                if (rowBulk[r]) applyRow(r, rowBulk[r]);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && rowBulk[r]) applyRow(r, rowBulk[r]);
                                            }}
                                            className="no-spinner h-6 md:h-7 flex-1 min-w-0 bg-white border-2 border-orange-200 text-gray-800 font-bold rounded text-[9px] md:text-xs text-center placeholder:text-gray-600 placeholder:opacity-100 placeholder:font-normal focus:outline-none focus:border-orange-500"
                                        />
                                    </div>
                                    <div className="h-6 md:h-7" />

                                    {visibleDigits.map((c) => {
                                        const key = `${r}${c}`;
                                        return (
                                            <div key={key} className="flex flex-col items-center justify-center">
                                                <div className="text-[8px] md:text-[10px] leading-none text-gray-700 font-normal mb-0.5 select-none">
                                                    {key[0]} {key[1]}
                                                </div>
                                                <input
                                                    ref={(el) => {
                                                        cellRefs.current[`${r}-${c}`] = el;
                                                    }}
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={cells[key]}
                                                    onChange={(e) =>
                                                        setCells((p) => ({
                                                            ...p,
                                                            [key]: sanitizePoints(e.target.value),
                                                        }))
                                                    }
                                                    onKeyDown={(e) => handleCellKeyDown(e, r, c)}
                                                    className="no-spinner h-6 md:h-7 w-full bg-white border-2 border-orange-200 text-gray-800 font-bold rounded text-[9px] md:text-xs text-center placeholder:text-gray-600 placeholder:opacity-100 placeholder:font-normal focus:outline-none focus:border-orange-500"
                                                />
                                            </div>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Sticky Submit Bet button above mobile navbar */}
            <div className="fixed left-0 right-0 bottom-[88px] z-20 px-3 sm:px-4 md:hidden">
                <div className="flex">
                    <button
                        type="button"
                        onClick={handleSubmitBet}
                        disabled={!canSubmit}
                        className={`w-full font-bold text-base py-4 min-h-[56px] rounded-xl shadow-lg transition-all ${
                            canSubmit
                                ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 active:scale-[0.98]'
                                : 'bg-gradient-to-r from-orange-300 to-orange-400 text-white opacity-50 cursor-not-allowed'
                        }`}
                    >
                        Submit Bet
                    </button>
                </div>
            </div>

            <BidReviewModal
                open={isReviewOpen}
                onClose={handleCloseReview}
                onSubmit={handleConfirmReview}
                marketTitle={marketTitle}
                dateText={dateText}
                labelKey="Jodi"
                rows={rows}
                walletBefore={walletBefore}
                totalBids={rows.length}
                totalAmount={totalPoints}
            />
        </BidLayout>
    );
};

export default JodiBulkBid;
