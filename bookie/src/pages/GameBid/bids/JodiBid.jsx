import React, { useEffect, useMemo, useRef, useState } from 'react';
import BookieBidLayout from '../BookieBidLayout';
import { usePlayerBet } from '../PlayerBetContext';
import { useBetCart } from '../BetCartContext';

const DIGITS = Array.from({ length: 10 }, (_, i) => String(i));
const sanitizePoints = (v) => (v ?? '').toString().replace(/\D/g, '').slice(0, 6);
const validateJodi = (n) => n && /^[0-9]{2}$/.test(n.toString().trim());

const JodiBid = ({ title, gameType, betType }) => {
    const { market } = usePlayerBet();
    const { addToCart } = useBetCart();
    const [activeTab, setActiveTab] = useState('easy');
    const [session, setSession] = useState('OPEN');
    const [warning, setWarning] = useState('');
    const pointsInputRef = useRef(null);
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

    /* ── Easy Mode state ── */
    const [inputNumber, setInputNumber] = useState('');
    const [inputPoints, setInputPoints] = useState('');

    const handleNumberInputChange = (e) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 2);
        setInputNumber(val);
        if (val.length === 2 && (inputNumber ?? '').length < 2) {
            if (validateJodi(val)) {
                window.requestAnimationFrame(() => { pointsInputRef.current?.focus?.(); });
            } else {
                showWarning('Invalid Jodi. Use 00-99.');
            }
        }
    };

    const handleEasyAddToCart = () => {
        const pts = Number(inputPoints);
        const n = inputNumber?.toString().trim() || '';
        if (!pts || pts <= 0) { showWarning('Please enter points.'); return; }
        if (!n || n.length !== 2) { showWarning('Please enter 2-digit Jodi (00-99).'); return; }
        if (!validateJodi(n)) { showWarning('Invalid Jodi. Use 00-99.'); return; }
        const count = addToCart([{ number: n, points: String(pts), type: session }], gameType, title, betType);
        if (count > 0) showWarning(`Added ${count} bet to cart ✓`);
        setInputNumber('');
        setInputPoints('');
    };

    /* ── Bulk Mode state (matrix) ── */
    const [cells, setCells] = useState(() => {
        const init = {};
        for (const r of DIGITS) for (const c of DIGITS) init[`${r}${c}`] = '';
        return init;
    });
    const [rowBulk, setRowBulk] = useState(() => Object.fromEntries(DIGITS.map((d) => [d, ''])));
    const [colBulk, setColBulk] = useState(() => Object.fromEntries(DIGITS.map((d) => [d, ''])));

    const bulkRows = useMemo(() => {
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

    const canSubmitBulk = bulkRows.length > 0;

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

    const clearBulk = () => {
        setCells(() => {
            const init = {};
            for (const r of DIGITS) for (const c of DIGITS) init[`${r}${c}`] = '';
            return init;
        });
        setRowBulk(Object.fromEntries(DIGITS.map((d) => [d, ''])));
        setColBulk(Object.fromEntries(DIGITS.map((d) => [d, ''])));
    };

    const handleBulkAddToCart = () => {
        if (!bulkRows.length) { showWarning('Please enter points for at least one Jodi.'); return; }
        const count = addToCart(bulkRows, gameType, title, betType);
        if (count > 0) showWarning(`Added ${count} Jodi bet(s) to cart ✓`);
        clearBulk();
    };

    const addToCartBtnClass = (enabled) =>
        `w-full font-bold py-3.5 min-h-[48px] rounded-lg shadow-md transition-all active:scale-[0.98] ${
            enabled
                ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700'
                : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white opacity-50 cursor-not-allowed'
        }`;

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
            showDateSession={true}
            contentPaddingClass="pb-24"
        >
            <div className="px-2 sm:px-4 py-2 w-full">
                {warning && (
                    <div className="fixed top-16 sm:top-20 left-1/2 transform -translate-x-1/2 z-50 bg-white border border-green-200 text-green-600 rounded-lg px-3 py-2.5 text-xs sm:text-sm font-medium shadow-xl max-w-[calc(100%-2rem)] sm:max-w-md backdrop-blur-sm">
                        {warning}
                    </div>
                )}

                {/* Mode Tabs */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <button type="button" onClick={() => setActiveTab('easy')}
                        className={`min-h-[44px] py-3 rounded-lg font-bold text-sm shadow-sm border active:scale-[0.98] transition-colors ${activeTab === 'easy' ? 'bg-orange-500 text-white border-orange-500' : 'bg-gray-100 text-gray-400 border-gray-200 hover:border-orange-500/50'}`}>
                        EASY MODE
                    </button>
                    <button type="button" onClick={() => setActiveTab('bulk')}
                        className={`min-h-[44px] py-3 rounded-lg font-bold text-sm shadow-sm border active:scale-[0.98] transition-colors ${activeTab === 'bulk' ? 'bg-orange-500 text-white border-orange-500' : 'bg-gray-100 text-gray-400 border-gray-200 hover:border-orange-500/50'}`}>
                        BULK MODE
                    </button>
                </div>

                {activeTab === 'easy' ? (
                    /* ── Easy Mode ── */
                    <div className="px-1 sm:px-0 md:max-w-3xl md:mx-auto">
                        <div className="flex flex-col gap-3 mb-4">
                            <div className="flex flex-row items-center gap-2">
                                <label className="text-gray-400 text-sm font-medium shrink-0 w-32">Select Game Type:</label>
                                <div className="flex-1 min-w-0 bg-gray-100 border border-gray-200 rounded-full py-2.5 min-h-[40px] px-4 flex items-center justify-center text-sm font-bold text-gray-800">{session}</div>
                            </div>
                            <div className="flex flex-row items-center gap-2">
                                <label className="text-gray-400 text-sm font-medium shrink-0 w-32">Enter Jodi:</label>
                                <input type="text" inputMode="numeric" value={inputNumber}
                                    onChange={handleNumberInputChange} placeholder="Jodi" maxLength={2}
                                    className="flex-1 min-w-0 bg-gray-100 border border-gray-200 text-gray-800 placeholder-gray-400 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none" />
                            </div>
                            <div className="flex flex-row items-center gap-2">
                                <label className="text-gray-400 text-sm font-medium shrink-0 w-32">Enter Points:</label>
                                <input ref={pointsInputRef} type="text" inputMode="numeric" value={inputPoints}
                                    onChange={(e) => setInputPoints(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="Point" className="no-spinner flex-1 min-w-0 bg-gray-100 border border-gray-200 text-gray-800 placeholder-gray-400 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none" />
                            </div>
                        </div>
                        <button type="button" onClick={handleEasyAddToCart} className={addToCartBtnClass(true)}>
                            Add to Cart
                        </button>
                    </div>
                ) : (
                    /* ── Bulk Mode (matrix) — compact single-screen layout ── */
                    <div className="flex flex-col w-full" style={{ maxHeight: 'calc(100vh - 200px)' }}>
                        <div className="bg-gray-100 border border-gray-200 rounded-2xl p-1.5 sm:p-2 overflow-hidden w-full flex-1 min-h-0">
                            <div className="overflow-x-auto md:overflow-x-hidden scrollbar-hidden h-full">
                                <div
                                    className="grid w-full gap-[1px] sm:gap-[2px]"
                                    style={{
                                        gridTemplateColumns:
                                            'clamp(30px, 8vw, 70px) clamp(4px, 0.5vw, 10px) repeat(10, minmax(16px, 1fr))'
                                    }}
                                >
                                    {/* Header digits */}
                                    <div className="h-5" />
                                    <div className="h-5" />
                                    {DIGITS.map((c) => (
                                        <div key={`h-${c}`} className="h-5 w-full flex items-center justify-center text-orange-500 font-bold text-[9px] md:text-xs">
                                            {c}
                                        </div>
                                    ))}

                                    {/* Column bulk inputs */}
                                    <div className="h-5 w-full flex items-center justify-center text-[8px] md:text-[10px] text-gray-400 font-semibold px-0.5">
                                        <span className="leading-[9px] text-center">Pts</span>
                                    </div>
                                    <div className="h-5" />
                                    {DIGITS.map((c) => (
                                        <input
                                            key={`col-${c}`}
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="·"
                                            value={colBulk[c]}
                                            onChange={(e) => setColBulk((p) => ({ ...p, [c]: sanitizePoints(e.target.value) }))}
                                            onBlur={() => { if (colBulk[c]) applyCol(c, colBulk[c]); }}
                                            onKeyDown={(e) => { if (e.key === 'Enter' && colBulk[c]) applyCol(c, colBulk[c]); }}
                                            className="no-spinner w-full min-w-0 h-5 bg-gray-100 border border-gray-200 text-gray-800 rounded text-[8px] md:text-[10px] text-center placeholder:text-gray-600 focus:outline-none focus:border-orange-500"
                                        />
                                    ))}

                                    {/* Matrix rows */}
                                    {DIGITS.map((r) => (
                                        <React.Fragment key={`row-${r}`}>
                                            <div className="flex items-center gap-0.5 min-w-0">
                                                <div className="w-3 md:w-4 h-5 flex items-center justify-center text-orange-500 font-bold text-[9px] md:text-xs">
                                                    {r}
                                                </div>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    placeholder="·"
                                                    value={rowBulk[r]}
                                                    onChange={(e) => setRowBulk((p) => ({ ...p, [r]: sanitizePoints(e.target.value) }))}
                                                    onBlur={() => { if (rowBulk[r]) applyRow(r, rowBulk[r]); }}
                                                    onKeyDown={(e) => { if (e.key === 'Enter' && rowBulk[r]) applyRow(r, rowBulk[r]); }}
                                                    className="no-spinner h-5 flex-1 min-w-0 bg-gray-100 border border-gray-200 text-gray-800 rounded text-[8px] md:text-[10px] text-center placeholder:text-gray-600 focus:outline-none focus:border-orange-500"
                                                />
                                            </div>
                                            <div className="h-5" />

                                            {DIGITS.map((c) => {
                                                const key = `${r}${c}`;
                                                const hasValue = !!cells[key];
                                                return (
                                                    <input
                                                        key={key}
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
                                                        className={`no-spinner h-5 w-full rounded text-[8px] md:text-[10px] text-center focus:outline-none focus:border-orange-500 ${
                                                            hasValue
                                                                ? 'bg-orange-500/15 border border-orange-500/40 text-gray-800 font-semibold'
                                                                : 'bg-gray-100 border border-gray-200 text-gray-800 placeholder:text-gray-600'
                                                        }`}
                                                    />
                                                );
                                            })}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Add to Cart button — always visible */}
                        <div className="mt-2 px-0.5 shrink-0">
                            <button
                                type="button"
                                onClick={handleBulkAddToCart}
                                disabled={!canSubmitBulk}
                                className={addToCartBtnClass(canSubmitBulk)}
                            >
                                Add to Cart {canSubmitBulk ? `(${bulkRows.length})` : ''}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </BookieBidLayout>
    );
};

export default JodiBid;
