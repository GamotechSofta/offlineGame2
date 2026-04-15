import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BidLayout from '../BidLayout';
import BidReviewModal from './BidReviewModal';
import { placeBet, updateUserBalance } from '../../../api/bets';

const DIGITS = Array.from({ length: 10 }, (_, i) => String(i));
const QUICK_POINT_OPTIONS = [10, 20, 30, 40, 50];

const sanitizePoints = (v) => (v ?? '').toString().replace(/\D/g, '').slice(0, 6);

const JodiBulkBid = ({ market, title }) => {
    const cellRefs = useRef({});
    const pendingFocusRef = useRef(null);

    const [session, setSession] = useState('OPEN');
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [warning, setWarning] = useState('');
    const [selectedQuickPoint, setSelectedQuickPoint] = useState(null);
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
    const MOBILE_VISIBLE_COLS = 10;

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

    const visibleDigits = DIGITS;
    const canSlideLeft = false;
    const canSlideRight = false;

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
                next[key] = String(p);
            }
            return next;
        });
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
                next[key] = String(p);
            }
            return next;
        });
    };

    const clearRow = (r) => {
        setCells((prev) => {
            const next = { ...prev };
            for (const c of DIGITS) {
                next[`${r}${c}`] = '';
            }
            return next;
        });
    };

    const clearCol = (c) => {
        setCells((prev) => {
            const next = { ...prev };
            for (const r of DIGITS) {
                next[`${r}${c}`] = '';
            }
            return next;
        });
    };

    const applyQuickPointToCell = (key) => {
        const p = Number(selectedQuickPoint);
        if (!p || p <= 0) return;
        setCells((prev) => {
            const pointStr = String(p);
            return { ...prev, [key]: pointStr };
        });
    };

    const applyQuickPointToRow = (r) => {
        const p = Number(selectedQuickPoint);
        if (!p || p <= 0) return;
        const pointStr = String(p);
        setRowBulk((prev) => ({ ...prev, [r]: pointStr }));
        setCells((prev) => {
            const next = { ...prev };
            for (const c of DIGITS) next[`${r}${c}`] = pointStr;
            return next;
        });
    };

    const applyQuickPointToCol = (c) => {
        const p = Number(selectedQuickPoint);
        if (!p || p <= 0) return;
        const pointStr = String(p);
        setColBulk((prev) => ({ ...prev, [c]: pointStr }));
        setCells((prev) => {
            const next = { ...prev };
            for (const r of DIGITS) next[`${r}${c}`] = pointStr;
            return next;
        });
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
        setSelectedQuickPoint(null);
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
                            ? 'bg-gradient-to-r bg-[#1B3150] text-white hover:bg-[#152842] active:scale-[0.98]'
                            : 'bg-gradient-to-r bg-gray-400 text-white opacity-50 cursor-not-allowed'
                    }`}
                >
                    Submit Bet
                </button>
            }
            walletBalance={walletBefore}
            hideFooter
            contentPaddingClass="pb-[calc(7rem+env(safe-area-inset-bottom,0px))] md:pb-6"
        >
            <div className="px-2 sm:px-4 md:px-1 py-1 md:py-1 w-full">
                {warning && (
                    <div className="mb-3 bg-red-50 border-2 border-red-300 text-red-600 rounded-xl px-4 py-3 text-sm">
                        {warning}
                    </div>
                )}
                <div className="grid grid-cols-2 gap-1.5 md:hidden px-1 mb-3">
                    <div className="rounded-xl border border-gray-300 bg-white px-2 py-1.5 md:px-3 md:py-2 text-center">
                        <div className="text-[11px] text-gray-600 font-medium">Count</div>
                        <div className="text-base font-bold text-[#1B3150] leading-tight">{rows.length}</div>
                    </div>
                    <div className="rounded-xl border border-gray-300 bg-white px-2 py-1.5 md:px-3 md:py-2 text-center">
                        <div className="text-[11px] text-gray-600 font-medium">Bet Amount</div>
                        <div className="text-base font-bold text-[#1B3150] leading-tight">{totalPoints}</div>
                    </div>
                </div>

                <div className="hidden md:flex md:items-center md:gap-2 mb-3 px-1">
                    <div className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-center min-w-[110px]">
                        <div className="text-[11px] text-gray-600 font-medium">Count</div>
                        <div className="text-base font-bold text-[#1B3150] leading-tight">{rows.length}</div>
                    </div>
                    <div className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-center min-w-[130px]">
                        <div className="text-[11px] text-gray-600 font-medium">Bet Amount</div>
                        <div className="text-base font-bold text-[#1B3150] leading-tight">{totalPoints}</div>
                    </div>
                    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hidden whitespace-nowrap flex-1">
                        <span className="mr-1 text-sm font-semibold text-gray-700 shrink-0 leading-tight flex flex-col">
                            <span>Quick</span>
                            <span>Points</span>
                        </span>
                        {QUICK_POINT_OPTIONS.map((pts) => (
                            <button
                                key={`jodi-quick-desktop-${pts}`}
                                type="button"
                                onClick={() => setSelectedQuickPoint(pts)}
                                className={`h-8 px-3 rounded-md font-semibold text-xs border transition-colors shrink-0 ${
                                    selectedQuickPoint === pts
                                        ? 'border-[#1B3150] bg-[#1B3150] text-white'
                                        : 'border-gray-300 text-[#1B3150] bg-white hover:bg-gray-100'
                                }`}
                            >
                                {pts}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={clearAll}
                            className="ml-1 px-3 py-1.5 rounded-md text-sm font-semibold border border-gray-300 text-[#1B3150] bg-white hover:bg-gray-100 active:scale-[0.98] transition-all shrink-0"
                        >
                            Clear
                        </button>
                    </div>
                </div>

                <div className="bg-transparent border-0 rounded-none p-0 md:bg-white md:border-2 md:border-gray-300 md:rounded-2xl md:p-3 overflow-hidden w-full pt-5">
                    <div className="mb-2 md:hidden">
                        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hidden whitespace-nowrap">
                            <span className="mr-1 text-xs sm:text-sm font-semibold text-gray-700 shrink-0 leading-tight flex flex-col">
                                <span>Quick</span>
                                <span>Points</span>
                            </span>
                            {QUICK_POINT_OPTIONS.map((pts) => (
                                <button
                                    key={`jodi-quick-${pts}`}
                                    type="button"
                                    onClick={() => setSelectedQuickPoint(pts)}
                                    className={`h-7 px-2.5 rounded-md font-semibold text-[11px] border transition-colors shrink-0 ${
                                        selectedQuickPoint === pts
                                            ? 'border-[#1B3150] bg-[#1B3150] text-white'
                                            : 'border-gray-300 text-[#1B3150] bg-white hover:bg-gray-100'
                                    }`}
                                >
                                    {pts}
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={clearAll}
                                className="ml-1 px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold border border-gray-300 text-[#1B3150] bg-white hover:bg-gray-100 active:scale-[0.98] transition-all shrink-0"
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                    <div className="md:hidden overflow-x-hidden rounded-md border border-[#b9c0c7] bg-[#d9dde1] p-1">
                        <div
                            className="grid w-full gap-x-1 gap-y-1 sm:gap-x-2 sm:gap-y-1.5"
                            style={{ gridTemplateColumns: `56px repeat(${visibleDigits.length}, minmax(0, 1fr))` }}
                        >
                            <div className="h-6 sm:h-7 flex items-center justify-center text-[#2a9cd9] font-extrabold text-[11px] sm:text-sm tracking-wide">
                                BLOCK
                            </div>
                            {visibleDigits.map((c) => (
                                <input
                                    key={`col-${c}`}
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="Pts"
                                    value={colBulk[c]}
                                    onChange={(e) => {
                                        const nextVal = sanitizePoints(e.target.value);
                                        setColBulk((p) => ({ ...p, [c]: nextVal }));
                                        if (!nextVal) clearCol(c);
                                    }}
                                    onPointerDown={(e) => {
                                        if (!selectedQuickPoint) return;
                                        e.preventDefault();
                                        applyQuickPointToCol(c);
                                    }}
                                    onBlur={() => {
                                        if (colBulk[c]) applyCol(c, colBulk[c]);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && colBulk[c]) applyCol(c, colBulk[c]);
                                    }}
                                    className="no-spinner h-6 sm:h-7 w-full rounded-[2px] border border-[#2a9cd9] bg-[#e8f6ff] px-0.5 sm:px-1 text-center text-base sm:text-xs font-semibold text-[#1f2937] placeholder:text-center focus:outline-none focus:ring-1 focus:ring-[#2a9cd9] touch-manipulation"
                                />
                            ))}

                            {DIGITS.map((r) => (
                                <React.Fragment key={`row-${r}`}>
                                    <div className="grid grid-rows-[10px_minmax(24px,1fr)] sm:grid-rows-[12px_minmax(28px,1fr)]">
                                        <div />
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="Pts"
                                            value={rowBulk[r]}
                                            onChange={(e) => {
                                                const nextVal = sanitizePoints(e.target.value);
                                                setRowBulk((p) => ({ ...p, [r]: nextVal }));
                                                if (!nextVal) clearRow(r);
                                            }}
                                            onPointerDown={(e) => {
                                                if (!selectedQuickPoint) return;
                                                e.preventDefault();
                                                applyQuickPointToRow(r);
                                            }}
                                            onBlur={() => {
                                                if (rowBulk[r]) applyRow(r, rowBulk[r]);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && rowBulk[r]) applyRow(r, rowBulk[r]);
                                            }}
                                            className="no-spinner h-6 sm:h-7 w-full rounded-[2px] border border-[#2a9cd9] bg-[#e8f6ff] px-0.5 sm:px-1 text-center text-base sm:text-xs font-semibold text-[#1f2937] placeholder:text-center focus:outline-none focus:ring-1 focus:ring-[#2a9cd9] touch-manipulation"
                                        />
                                    </div>

                                    {visibleDigits.map((c) => {
                                        const key = `${r}${c}`;
                                        const hasBet = Number(cells[key] || 0) > 0;
                                        return (
                                            <div key={key} className="grid grid-rows-[10px_minmax(24px,1fr)] sm:grid-rows-[12px_minmax(28px,1fr)]">
                                                <div
                                                    className={`pointer-events-none text-[9px] sm:text-[11px] font-bold leading-none text-center ${
                                                        hasBet ? 'text-[#0f2f56]' : 'text-[#353b42]'
                                                    }`}
                                                >
                                                    {key}
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
                                                    onPointerDown={(e) => {
                                                        if (!selectedQuickPoint) return;
                                                        e.preventDefault();
                                                        applyQuickPointToCell(key);
                                                    }}
                                                    onKeyDown={(e) => handleCellKeyDown(e, r, c)}
                                                    className={`no-spinner h-6 sm:h-7 w-full rounded-[2px] px-0.5 sm:px-1 text-center text-base sm:text-xs font-semibold text-[#1f2937] focus:outline-none focus:ring-1 focus:ring-[#2a9cd9] touch-manipulation ${
                                                        hasBet
                                                            ? 'border border-[#2a9cd9] bg-[#eaf6ff]'
                                                            : 'border border-[#8e9499] bg-white'
                                                    }`}
                                                />
                                            </div>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>

                    <div className="hidden md:block rounded-md border border-[#d1d5db] bg-[#e5e7eb] p-2">
                        <div className="mb-3 grid grid-cols-[84px_repeat(10,minmax(0,1fr))] gap-2">
                            <div className="h-8 flex items-center justify-center text-[#2a9cd9] font-extrabold text-xs tracking-wide">
                                BLOCK
                            </div>
                            {visibleDigits.map((c) => (
                                <div key={`desktop-col-${c}`} className="grid grid-cols-[32px_minmax(0,1fr)] gap-0 min-w-0">
                                    <div />
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="Pts"
                                        value={colBulk[c]}
                                        onChange={(e) => {
                                            const nextVal = sanitizePoints(e.target.value);
                                            setColBulk((p) => ({ ...p, [c]: nextVal }));
                                            if (!nextVal) clearCol(c);
                                        }}
                                        onPointerDown={(e) => {
                                            if (!selectedQuickPoint) return;
                                            e.preventDefault();
                                            applyQuickPointToCol(c);
                                        }}
                                        onBlur={() => {
                                            if (colBulk[c]) applyCol(c, colBulk[c]);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && colBulk[c]) applyCol(c, colBulk[c]);
                                        }}
                                        className="no-spinner h-8 w-full min-w-0 rounded-md border border-[#2a9cd9] bg-[#e8f6ff] px-2 text-center text-[11px] font-semibold text-[#1f2937] placeholder:text-center placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2a9cd9]"
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-[84px_1fr] gap-2">
                            <div className="grid grid-rows-10 gap-3">
                                {DIGITS.map((r) => (
                                    <input
                                        key={`desktop-row-${r}`}
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="Pts"
                                        value={rowBulk[r]}
                                        onChange={(e) => {
                                            const nextVal = sanitizePoints(e.target.value);
                                            setRowBulk((p) => ({ ...p, [r]: nextVal }));
                                            if (!nextVal) clearRow(r);
                                        }}
                                        onPointerDown={(e) => {
                                            if (!selectedQuickPoint) return;
                                            e.preventDefault();
                                            applyQuickPointToRow(r);
                                        }}
                                        onBlur={() => {
                                            if (rowBulk[r]) applyRow(r, rowBulk[r]);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && rowBulk[r]) applyRow(r, rowBulk[r]);
                                        }}
                                        className="no-spinner h-8 w-full rounded-md border border-[#2a9cd9] bg-[#e8f6ff] px-2 text-center text-[11px] font-semibold text-[#1f2937] placeholder:text-center placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2a9cd9]"
                                    />
                                ))}
                            </div>

                            <div className="grid grid-cols-10 gap-x-2 gap-y-3">
                                {DIGITS.flatMap((r) =>
                                    visibleDigits.map((c) => {
                                        const key = `${r}${c}`;
                                        const hasBet = Number(cells[key] || 0) > 0;
                                        return (
                                            <div key={`desktop-${key}`} className="ml-8 grid w-[calc(100%-32px)] grid-cols-[32px_minmax(0,1fr)] min-w-0">
                                                <button
                                                    type="button"
                                                    onClick={() => applyQuickPointToCell(key)}
                                                    className={`h-8 w-8 rounded-l-md rounded-r-none px-1 text-[10px] font-bold tracking-wide text-white ${
                                                        hasBet ? 'bg-[#0f4d8a]' : 'bg-[#1b3558]'
                                                    }`}
                                                >
                                                    {key}
                                                </button>
                                                <input
                                                    ref={(el) => {
                                                        cellRefs.current[`${r}-${c}`] = el;
                                                    }}
                                                    type="text"
                                                    inputMode="numeric"
                                                    placeholder="Pts"
                                                    value={cells[key]}
                                                    onChange={(e) =>
                                                        setCells((p) => ({
                                                            ...p,
                                                            [key]: sanitizePoints(e.target.value),
                                                        }))
                                                    }
                                                    onPointerDown={(e) => {
                                                        if (!selectedQuickPoint) return;
                                                        e.preventDefault();
                                                        applyQuickPointToCell(key);
                                                    }}
                                                    onKeyDown={(e) => handleCellKeyDown(e, r, c)}
                                                    className={`no-spinner h-8 w-full min-w-0 rounded-l-none rounded-r-md px-2 text-center text-[11px] font-semibold text-[#1f2937] placeholder:text-center placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2a9cd9] ${
                                                        hasBet ? 'border border-[#2a9cd9] bg-[#eaf6ff]' : 'border border-[#c6cbd2] bg-white'
                                                    }`}
                                                />
                                            </div>
                                        );
                                    })
                                )}
                            </div>
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
                                ? 'bg-gradient-to-r bg-[#1B3150] text-white hover:bg-[#152842] active:scale-[0.98]'
                                : 'bg-gradient-to-r bg-gray-400 text-white opacity-50 cursor-not-allowed'
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
