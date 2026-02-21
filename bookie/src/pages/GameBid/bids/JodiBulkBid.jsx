import React, { useEffect, useMemo, useRef, useState } from 'react';
import BookieBidLayout from '../BookieBidLayout';
import { usePlayerBet } from '../PlayerBetContext';
import { useBetCart } from '../BetCartContext';

const DIGITS = Array.from({ length: 10 }, (_, i) => String(i));
const sanitizePoints = (v) => (v ?? '').toString().replace(/\D/g, '').slice(0, 6);

const getNextCell = (row, col, direction) => {
    let r = DIGITS.indexOf(String(row));
    let c = DIGITS.indexOf(String(col));
    if (r === -1 || c === -1) return null;
    switch (direction) {
        case 'ArrowLeft': c--; break;
        case 'ArrowRight': c++; break;
        case 'ArrowUp': r--; break;
        case 'ArrowDown': r++; break;
        default: return null;
    }
    if (r < 0 || r > 9 || c < 0 || c > 9) return null;
    return { row: DIGITS[r], col: DIGITS[c] };
};

const JodiBulkBid = ({ title, gameType, betType, embedInSingleScroll = false, fitSingleScreen = false }) => {
    const { market } = usePlayerBet();
    const { addToCart } = useBetCart();
    const [session, setSession] = useState('OPEN');
    const [warning, setWarning] = useState('');
    const [selectedDate, setSelectedDate] = useState(() => {
        try {
            const savedDate = localStorage.getItem('bookieBetSelectedDate');
            if (savedDate && savedDate > new Date().toISOString().split('T')[0]) return savedDate;
        } catch (e) { /* ignore */ }
        return new Date().toISOString().split('T')[0];
    });

    const handleDateChange = (newDate) => {
        try { localStorage.setItem('bookieBetSelectedDate', newDate); } catch (e) { /* ignore */ }
        setSelectedDate(newDate);
    };

    const showWarning = (msg) => {
        setWarning(msg);
        window.clearTimeout(showWarning._t);
        showWarning._t = window.setTimeout(() => setWarning(''), 2400);
    };

    useEffect(() => {
        if (session !== 'OPEN') setSession('OPEN');
    }, [session]);

    const [cells, setCells] = useState(() => {
        const init = {};
        for (const r of DIGITS) for (const c of DIGITS) init[`${r}${c}`] = '';
        return init;
    });
    const [rowBulk, setRowBulk] = useState(() => Object.fromEntries(DIGITS.map((d) => [d, ''])));
    const [colBulk, setColBulk] = useState(() => Object.fromEntries(DIGITS.map((d) => [d, ''])));
    const cellRefs = useRef({});

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

    const canSubmit = rows.length > 0;

    const applyRow = (r, pts) => {
        const p = Number(pts);
        if (!p || p <= 0) { showWarning('Please enter points.'); return; }
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
        if (!p || p <= 0) { showWarning('Please enter points.'); return; }
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

    const clearLocal = () => {
        setCells(() => {
            const init = {};
            for (const r of DIGITS) for (const c of DIGITS) init[`${r}${c}`] = '';
            return init;
        });
        setRowBulk(Object.fromEntries(DIGITS.map((d) => [d, ''])));
        setColBulk(Object.fromEntries(DIGITS.map((d) => [d, ''])));
    };

    const handleAddToCart = () => {
        if (!rows.length) { showWarning('Please enter points for at least one Jodi.'); return; }
        const count = addToCart(rows, gameType, title, betType);
        if (count > 0) showWarning(`Added ${count} Jodi bet(s) to cart ✓`);
        clearLocal();
    };

    return (
        <BookieBidLayout
            title={title}
            bidsCount={0}
            totalPoints={0}
            session={session}
            setSession={setSession}
            sessionOptionsOverride={['OPEN']}
            lockSessionSelect
            hideSessionSelectCaret
            selectedDate={selectedDate}
            setSelectedDate={handleDateChange}
            hideFooter
            showDateSession={!embedInSingleScroll}
            noHeader={embedInSingleScroll}
            noDateSession={embedInSingleScroll}
            noFooter={embedInSingleScroll}
            contentPaddingClass={fitSingleScreen ? 'pb-4' : 'pb-24'}
        >
            <div className={`w-full font-['Inter',sans-serif] ${embedInSingleScroll ? 'px-0 py-0' : fitSingleScreen ? 'px-2 sm:px-3 py-2' : 'px-3 sm:px-5 py-3'}`}>
                {warning && (
                    <div className="fixed top-16 sm:top-20 left-1/2 transform -translate-x-1/2 z-50 bg-white text-gray-800 rounded-xl px-4 py-3 text-sm font-medium shadow-lg max-w-[calc(100%-2rem)] backdrop-blur-sm">
                        {warning}
                    </div>
                )}

                {(() => {
                    const compact = embedInSingleScroll || fitSingleScreen;
                    const rowH = compact ? 'h-[28px] min-h-[28px]' : 'h-10 min-h-10';
                    const cellBase = 'no-spinner w-full min-w-0 bg-white text-gray-800 text-center placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:ring-offset-0 rounded-lg shadow-sm';
                    const cellCl = compact
                        ? `${cellBase} h-[28px] min-h-[28px] text-[10px] py-1.5 px-0.5`
                        : `${cellBase} h-10 min-h-10 text-sm py-2 px-1.5`;
                    const headerDigitCl = 'text-blue-900 font-bold';
                    const labelCl = compact ? 'text-[8px] leading-none text-gray-400 select-none' : 'text-[9px] md:text-[10px] leading-none text-gray-400 mb-0.5 select-none';
                    return (
                        <div className={`overflow-hidden w-full rounded-2xl bg-gray-50/80 ${compact ? 'p-2' : 'p-4 sm:p-5'} ${(embedInSingleScroll || fitSingleScreen) ? 'shadow-none' : 'shadow-md'}`}>
                            <div className="overflow-x-auto overflow-y-hidden scrollbar-hidden">
                                <div
                                    className={`grid w-full min-w-0 ${compact ? 'gap-1' : 'gap-2'}`}
                                    style={{ gridTemplateColumns: 'minmax(56px, 0.4fr) minmax(4px, 0.1fr) repeat(10, minmax(0, 1fr))' }}
                                >
                                    <div className={`${rowH} min-w-0`} />
                                    <div className={`${rowH} min-w-0`} />
                                    {DIGITS.map((c) => (
                                        <div key={`h-${c}`} className={`${rowH} w-full min-w-0 flex items-center justify-center ${headerDigitCl} ${compact ? 'text-[10px]' : 'text-sm'}`}>
                                            {c}
                                        </div>
                                    ))}
                                    <div className={`${rowH} w-full min-w-0 flex items-center justify-center text-gray-500 font-medium ${compact ? 'text-[8px]' : 'text-xs'}`}>
                                        {compact ? 'Pts' : <><span className="md:hidden">Pts</span><span className="hidden md:inline">Points</span></>}
                                    </div>
                                    <div className={`${rowH} min-w-0`} />
                                    {DIGITS.map((c) => (
                                        <input
                                            key={`col-${c}`}
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="Pts"
                                            value={colBulk[c]}
                                            onChange={(e) => setColBulk((p) => ({ ...p, [c]: sanitizePoints(e.target.value) }))}
                                            onBlur={() => { if (colBulk[c]) applyCol(c, colBulk[c]); }}
                                            onKeyDown={(e) => { if (e.key === 'Enter' && colBulk[c]) applyCol(c, colBulk[c]); }}
                                            className={cellCl}
                                        />
                                    ))}
                                    {DIGITS.map((r) => (
                                        <React.Fragment key={`row-${r}`}>
                                            <div className="flex items-center gap-1 min-w-0 w-full">
                                                <div className={`${compact ? 'w-5 shrink-0' : 'w-6 shrink-0'} ${rowH} flex items-center justify-center ${headerDigitCl} ${compact ? 'text-[10px]' : 'text-sm'}`}>
                                                    {r}
                                                </div>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    placeholder="Pts"
                                                    value={rowBulk[r]}
                                                    onChange={(e) => setRowBulk((p) => ({ ...p, [r]: sanitizePoints(e.target.value) }))}
                                                    onBlur={() => { if (rowBulk[r]) applyRow(r, rowBulk[r]); }}
                                                    onKeyDown={(e) => { if (e.key === 'Enter' && rowBulk[r]) applyRow(r, rowBulk[r]); }}
                                                    className={`${cellCl} flex-1 min-w-[2rem]`}
                                                />
                                            </div>
                                            <div className={`${rowH} min-w-0`} />
                                            {DIGITS.map((c) => {
                                                const key = `${r}${c}`;
                                                const nextCell = (dir) => getNextCell(r, c, dir);
                                                return (
                                                    <div key={key} className="flex flex-col items-center justify-center min-w-0">
                                                        {!compact && <div className={labelCl}>{key}</div>}
                                                        <input
                                                            ref={(el) => {
                                                                if (!cellRefs.current[r]) cellRefs.current[r] = {};
                                                                cellRefs.current[r][c] = el;
                                                            }}
                                                            type="text"
                                                            inputMode="numeric"
                                                            placeholder={key}
                                                            value={cells[key]}
                                                            onChange={(e) =>
                                                                setCells((p) => ({
                                                                    ...p,
                                                                    [key]: sanitizePoints(e.target.value),
                                                                }))
                                                            }
                                                            onKeyDown={(e) => {
                                                                const dir = e.key;
                                                                if (dir !== 'ArrowLeft' && dir !== 'ArrowRight' && dir !== 'ArrowUp' && dir !== 'ArrowDown') return;
                                                                const next = nextCell(dir);
                                                                if (!next) return;
                                                                e.preventDefault();
                                                                const el = cellRefs.current[next.row]?.[next.col];
                                                                if (el && typeof el.focus === 'function') el.focus();
                                                            }}
                                                            className={cellCl}
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Add to Cart — Safety Orange primary action */}
                <div className={`${(embedInSingleScroll || fitSingleScreen) ? 'mt-2' : 'mt-6'}`}>
                    <button
                        type="button"
                        onClick={handleAddToCart}
                        disabled={!canSubmit}
                        className={`w-full font-bold rounded-xl transition-all ${(embedInSingleScroll || fitSingleScreen) ? 'text-sm py-2.5 min-h-[44px]' : 'text-base py-4 min-h-[56px]'} shadow-md ${
                            canSubmit
                                ? 'bg-[#FF6600] text-white hover:bg-[#E55C00] active:scale-[0.98] shadow-orange-500/25'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                        }`}
                    >
                        Add to Cart
                    </button>
                </div>
            </div>
        </BookieBidLayout>
    );
};

export default JodiBulkBid;
