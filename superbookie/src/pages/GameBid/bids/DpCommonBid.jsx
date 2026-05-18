import React, { useEffect, useMemo, useRef, useState } from 'react';
import BookieBidLayout from '../BookieBidLayout';
import { usePlayerBet } from '../PlayerBetContext';
import { useBetCart } from '../BetCartContext';
import { generateDPCommon } from './dpCommonGenerator';
import { isPastOpeningTime } from '../../../utils/marketTiming';

const DpCommonBid = ({ title, gameType, betType }) => {
    const { market } = usePlayerBet();
    const { addToCart } = useBetCart();
    const [session, setSession] = useState(() => (isPastOpeningTime(market) ? 'CLOSE' : 'OPEN'));
    const [warning, setWarning] = useState('');
    const [selectedDate, setSelectedDate] = useState(() => {
        try {
            const savedDate = localStorage.getItem('bookieBetSelectedDate');
            if (savedDate && savedDate > new Date().toISOString().split('T')[0]) return savedDate;
        } catch (e) { /* ignore */ }
        return new Date().toISOString().split('T')[0];
    });
    const [selectedDigits, setSelectedDigits] = useState([]);
    const [pointsInput, setPointsInput] = useState('');
    const [generatedRows, setGeneratedRows] = useState([]);

    const handleDateChange = (newDate) => {
        try { localStorage.setItem('bookieBetSelectedDate', newDate); } catch (e) { /* ignore */ }
        setSelectedDate(newDate);
    };

    const showWarning = (msg) => {
        setWarning(msg);
        window.clearTimeout(showWarning._t);
        showWarning._t = window.setTimeout(() => setWarning(''), 2200);
    };

    const toggleDigit = (d) => {
        const digit = String(d);
        setSelectedDigits((prev) => {
            if (prev.includes(digit)) return prev.filter((x) => x !== digit);
            return [...prev, digit].sort((a, b) => Number(a) - Number(b));
        });
    };

    const isRunning = isPastOpeningTime(market);
    useEffect(() => {
        if (isRunning) setSession('CLOSE');
    }, [isRunning]);

    const rowsWithPoints = useMemo(
        () => generatedRows.filter((row) => Number(row.points) > 0),
        [generatedRows]
    );
    const bidsCount = rowsWithPoints.length;
    const totalPoints = useMemo(
        () => rowsWithPoints.reduce((sum, row) => sum + (Number(row.points) || 0), 0),
        [rowsWithPoints]
    );

    const clearLocal = () => {
        setSelectedDigits([]);
        setPointsInput('');
        setGeneratedRows([]);
    };

    const lastAutoWarnKeyRef = useRef('');

    // Auto-generate rows when inputs are ready (no Generate button).
    useEffect(() => {
        const pts = Number(pointsInput);
        const hasDigits = selectedDigits.length > 0;
        const hasPoints = Number.isFinite(pts) && pts > 0;
        if (!hasDigits || !hasPoints) {
            setGeneratedRows([]);
            return;
        }

        const panaMap = new Map();
        for (const digit of selectedDigits) {
            const result = generateDPCommon({ digit, points: pts });
            if (!result.success) {
                const warnKey = `${selectedDigits.join(',')}|${pts}`;
                setGeneratedRows([]);
                if (lastAutoWarnKeyRef.current !== warnKey) {
                    lastAutoWarnKeyRef.current = warnKey;
                    showWarning(result.message);
                }
                return;
            }
            for (const row of result.data) {
                const existing = panaMap.get(row.pana);
                const addPoints = Number(row.points) || 0;
                if (!existing) {
                    panaMap.set(row.pana, { pana: row.pana, points: addPoints });
                } else {
                    existing.points = (Number(existing.points) || 0) + addPoints;
                    panaMap.set(row.pana, existing);
                }
            }
        }

        const panas = Array.from(panaMap.values()).sort((a, b) => Number(a.pana) - Number(b.pana));
        if (panas.length === 0) {
            const warnKey = `${selectedDigits.join(',')}|${pts}|empty`;
            setGeneratedRows([]);
            if (lastAutoWarnKeyRef.current !== warnKey) {
                lastAutoWarnKeyRef.current = warnKey;
                showWarning('No panna matches for selected digit(s).');
            }
            return;
        }

        lastAutoWarnKeyRef.current = '';
        const now = Date.now();
        setGeneratedRows(
            panas.map((row, idx) => ({
                id: `${row.pana}-${now}-${idx}`,
                pana: row.pana,
                points: String(row.points),
            }))
        );
    }, [selectedDigits, pointsInput]);

    const updatePoint = (id, value) => {
        const clean = (value ?? '').toString().replace(/\D/g, '').slice(0, 6);
        setGeneratedRows((prev) => prev.map((row) => (row.id === id ? { ...row, points: clean } : row)));
    };

    const removeRow = (id) => {
        setGeneratedRows((prev) => prev.filter((row) => row.id !== id));
    };

    const handleAddToCart = () => {
        const items = rowsWithPoints.map((row) => ({
            number: row.pana,
            points: String(row.points),
            type: session,
        }));
        if (!items.length) {
            showWarning('Select digit(s) and enter points to generate rows.');
            return;
        }
        const count = addToCart(items, gameType, title, betType);
        if (count > 0) {
            showWarning(`Added ${count} bets to cart`);
            clearLocal();
        }
    };

    return (
        <BookieBidLayout
            title={title}
            bidsCount={bidsCount}
            totalPoints={totalPoints}
            session={session}
            setSession={setSession}
            showDateSession
            selectedDate={selectedDate}
            setSelectedDate={handleDateChange}
            hideFooter
            contentPaddingClass="pb-10"
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
                            <div className="grid grid-cols-5 gap-2">
                                {Array.from({ length: 10 }, (_, i) => i).map((d) => {
                                    const selected = selectedDigits.includes(String(d));
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
                            <div className="flex items-center gap-2 mt-3">
                                <label className="shrink-0 w-24 text-xs sm:text-sm font-semibold text-gray-600">Enter Digit</label>
                                <input
                                    type="text"
                                    value={selectedDigits.join(',')}
                                    readOnly
                                    placeholder="e.g. 2"
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
                                onChange={(e) => setPointsInput((e.target.value ?? '').replace(/\D/g, '').slice(0, 6))}
                                placeholder="Points"
                                className="flex-1 min-w-0 min-h-[40px] h-10 sm:h-11 bg-white border border-gray-300 rounded-lg px-3 text-sm sm:text-base font-semibold text-gray-800"
                            />
                            <button
                                type="button"
                                onClick={clearLocal}
                                className="min-h-[40px] h-10 px-4 rounded-md text-xs sm:text-sm font-bold border-2 border-[#1B3150]/30 text-[#1B3150] bg-white hover:bg-[#1B3150]/5 active:scale-[0.98] transition-all shrink-0"
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
                                            className={`min-h-[34px] h-9 rounded-md text-xs sm:text-sm font-semibold border transition-all active:scale-[0.98] ${
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
                                onClick={handleAddToCart}
                                disabled={!bidsCount}
                                className={`flex-1 bg-[#1B3150] text-white font-bold py-3.5 min-h-[48px] rounded-lg shadow-lg hover:bg-[#152842] transition-all active:scale-[0.98] ${
                                    !bidsCount ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                            >
                                Add to Cart {bidsCount > 0 && `(${bidsCount})`}
                            </button>
                        </div>
                    </div>

                    <div className="w-full md:w-1/2 flex-1 min-w-0">
                        <div className="grid grid-cols-4 gap-1 sm:gap-2 text-center text-[#1B3150] font-bold text-xs sm:text-sm mb-2 px-1">
                            <div>Pana</div>
                            <div>Point</div>
                            <div>Type</div>
                            <div>Delete</div>
                        </div>
                        <div className="h-px bg-[#1B3150] w-full mb-2" />
                        <div className="max-h-[520px] sm:max-h-[560px] overflow-y-auto space-y-2 pr-0.5">
                            {generatedRows.length === 0 ? (
                                <div className="py-6 text-center text-gray-400 text-sm">
                                    Select digit(s) and enter points to generate
                                </div>
                            ) : (
                                generatedRows.map((row) => (
                                    <div key={row.id} className="grid grid-cols-4 gap-1 sm:gap-2 text-center items-center py-2.5 px-2 bg-gray-50 rounded-lg border-2 border-gray-300 text-sm">
                                        <div className="font-bold text-gray-800">{row.pana}</div>
                                        <div className="px-0.5 min-w-0">
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={row.points}
                                                onChange={(e) => updatePoint(row.id, e.target.value)}
                                                className="w-full h-8 rounded-lg border border-gray-300 text-center font-bold text-[#1B3150] text-sm focus:outline-none focus:border-[#1B3150]"
                                            />
                                        </div>
                                        <div className="text-sm font-semibold text-[#1B3150]">{session}</div>
                                        <div className="flex justify-center">
                                            <button
                                                type="button"
                                                onClick={() => removeRow(row.id)}
                                                className="p-2 text-red-500 hover:text-red-600 active:scale-95"
                                                aria-label="Delete"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </BookieBidLayout>
    );
};

export default DpCommonBid;
