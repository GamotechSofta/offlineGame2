import React, { useEffect, useMemo, useState } from 'react';
import BookieBidLayout from '../BookieBidLayout';
import { usePlayerBet } from '../PlayerBetContext';
import { useBetCart } from '../BetCartContext';

const DIGITS = Array.from({ length: 10 }, (_, i) => String(i));
const sanitizePoints = (v) => (v ?? '').toString().replace(/\D/g, '').slice(0, 6);

const JodiBulkBid = ({ title, gameType, betType }) => {
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
            contentPaddingClass="pb-24"
        >
            <div className="px-2 sm:px-4 md:px-4 py-1 md:py-1 w-full">
                {warning && (
                    <div className="fixed top-16 sm:top-20 left-1/2 transform -translate-x-1/2 z-50 bg-black/95 border border-green-500/50 text-green-400 rounded-lg px-3 py-2.5 text-xs sm:text-sm font-medium shadow-xl max-w-[calc(100%-2rem)] sm:max-w-md backdrop-blur-sm">
                        {warning}
                    </div>
                )}

                <div className="bg-[#202124] border border-white/10 rounded-2xl p-2 sm:p-3 md:p-3 overflow-hidden w-full">
                    <div className="overflow-x-auto md:overflow-x-hidden scrollbar-hidden">
                        <div
                            className="grid w-full gap-[2px] sm:gap-1 md:gap-1"
                            style={{
                                gridTemplateColumns:
                                    'clamp(34px, 10vw, 80px) clamp(6px, 1vw, 18px) repeat(10, minmax(18px, 1fr))'
                            }}
                        >
                            {/* Header digits */}
                            <div className="h-6 md:h-7" />
                            <div className="h-6 md:h-7" />
                            {DIGITS.map((c) => (
                                <div key={`h-${c}`} className="h-6 md:h-7 w-full flex items-center justify-center text-[#f2c14e] font-bold text-[10px] md:text-sm">
                                    {c}
                                </div>
                            ))}

                            {/* Column bulk inputs */}
                            <div className="h-6 md:h-7 w-full flex items-center justify-center text-[9px] md:text-xs text-gray-400 font-semibold px-1">
                                <span className="md:hidden leading-[10px] text-center">Enter<br />Points</span>
                                <span className="hidden md:inline">Enter Points</span>
                            </div>
                            <div className="h-6 md:h-7" />
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
                                    className="no-spinner w-full min-w-0 h-6 md:h-7 bg-black/40 border border-white/10 text-white rounded text-[9px] md:text-xs text-center placeholder:text-white/15 focus:outline-none focus:border-[#d4af37]"
                                />
                            ))}

                            {/* Matrix rows */}
                            {DIGITS.map((r) => (
                                <React.Fragment key={`row-${r}`}>
                                    <div className="flex items-center gap-1 min-w-0">
                                        <div className="w-4 md:w-6 h-6 md:h-7 flex items-center justify-center text-[#f2c14e] font-bold text-[10px] md:text-sm">
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
                                            className="no-spinner h-6 md:h-7 flex-1 min-w-0 bg-black/40 border border-white/10 text-white rounded text-[9px] md:text-xs text-center placeholder:text-white/15 focus:outline-none focus:border-[#d4af37]"
                                        />
                                    </div>
                                    <div className="h-6 md:h-7" />

                                    {DIGITS.map((c) => {
                                        const key = `${r}${c}`;
                                        return (
                                            <div key={key} className="flex flex-col items-center justify-center">
                                                <div className="text-[8px] md:text-[10px] leading-none text-white/30 mb-0.5 select-none">
                                                    {key}
                                                </div>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={cells[key]}
                                                    onChange={(e) =>
                                                        setCells((p) => ({
                                                            ...p,
                                                            [key]: sanitizePoints(e.target.value),
                                                        }))
                                                    }
                                                    className="no-spinner h-6 md:h-7 w-full bg-black/40 border border-white/10 text-white rounded text-[9px] md:text-xs text-center focus:outline-none focus:border-[#d4af37]"
                                                />
                                            </div>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Add to Cart button */}
                <div className="mt-4 px-1">
                    <button
                        type="button"
                        onClick={handleAddToCart}
                        disabled={!canSubmit}
                        className={`w-full font-bold text-base py-4 min-h-[56px] rounded-xl shadow-lg transition-all ${
                            canSubmit
                                ? 'bg-gradient-to-r from-[#d4af37] to-[#cca84d] text-[#4b3608] hover:from-[#e5c04a] hover:to-[#d4af37] active:scale-[0.98]'
                                : 'bg-gradient-to-r from-[#d4af37] to-[#cca84d] text-[#4b3608] opacity-50 cursor-not-allowed'
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
