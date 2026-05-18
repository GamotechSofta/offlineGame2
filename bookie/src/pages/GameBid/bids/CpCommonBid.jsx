import React, { useEffect, useMemo, useRef, useState } from 'react';
import BookieBidLayout from '../BookieBidLayout';
import { usePlayerBet } from '../PlayerBetContext';
import { useBetCart } from '../BetCartContext';
import { isPastOpeningTime } from '../../../utils/marketTiming';
import { generateCPCommon } from './spCommonGenerator';
import { isValidSinglePana, isValidDoublePana, isValidTriplePana } from '../panaRules';

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const QUICK_POINTS = [10, 20, 30, 40, 50];

const getPanaType = (pana) => {
    if (isValidTriplePana(pana)) return 'T';
    if (isValidDoublePana(pana)) return 'DP';
    if (isValidSinglePana(pana)) return 'SP';
    return '';
};

const CpCommonBid = ({ title, gameType, betType, embedInSingleScroll = false }) => {
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
    const [includeSp, setIncludeSp] = useState(false);
    const [includeDp, setIncludeDp] = useState(false);
    const [includeTriple, setIncludeTriple] = useState(false);
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
        if (selectedDigits.includes(digit)) {
            setSelectedDigits((prev) => prev.filter((x) => x !== digit));
            return;
        }
        if (selectedDigits.length >= 2) {
            showWarning('Select at most 2 digits for CP.');
            return;
        }
        setSelectedDigits([...selectedDigits, digit].sort((a, b) => Number(a) - Number(b)));
    };

    const isRunning = isPastOpeningTime(market);
    useEffect(() => { if (isRunning) setSession('CLOSE'); }, [isRunning]);

    const bidsCount = generatedRows.length;
    const totalPoints = useMemo(
        () => generatedRows.reduce((sum, row) => sum + (Number(row.points) || 0), 0),
        [generatedRows]
    );

    const clearLocal = () => {
        setSelectedDigits([]);
        setPointsInput('');
        setGeneratedRows([]);
        setIncludeSp(false);
        setIncludeDp(false);
        setIncludeTriple(false);
    };

    // Auto-generate when inputs change
    const lastAutoWarnKeyRef = useRef('');
    useEffect(() => {
        const digitsInput = selectedDigits.join('');
        const pts = Number(pointsInput);
        const hasDigits = digitsInput.length >= 1 && digitsInput.length <= 2;
        const hasPoints = Number.isFinite(pts) && pts > 0;
        const hasAnyFilter = includeSp || includeDp || includeTriple;

        if (!hasDigits || !hasPoints || !hasAnyFilter) {
            setGeneratedRows([]);
            return;
        }

        const useSingles = includeSp || includeTriple;
        const useDoubles = includeDp || includeTriple;
        const result = generateCPCommon({
            digitsInput,
            points: pts,
            includeSingles: useSingles,
            includeDoubles: useDoubles,
            includeTriples: includeTriple,
        });

        const warnKey = `${digitsInput}|${pts}|${useSingles ? 1 : 0}|${useDoubles ? 1 : 0}|${includeTriple ? 1 : 0}`;
        if (!result.success) {
            setGeneratedRows([]);
            if (lastAutoWarnKeyRef.current !== warnKey) {
                lastAutoWarnKeyRef.current = warnKey;
                showWarning(result.message);
            }
            return;
        }

        lastAutoWarnKeyRef.current = '';
        const now = Date.now();
        setGeneratedRows(
            result.data.map((row, idx) => ({
                id: `${row.pana}-${now}-${idx}`,
                pana: row.pana,
                points: String(row.points),
            }))
        );
    }, [selectedDigits, pointsInput, includeSp, includeDp, includeTriple]);

    const updatePoint = (id, value) => {
        const clean = (value ?? '').toString().replace(/\D/g, '').slice(0, 6);
        setGeneratedRows((prev) => prev.map((row) => (row.id === id ? { ...row, points: clean } : row)));
    };

    const removeRow = (id) => {
        setGeneratedRows((prev) => prev.filter((row) => row.id !== id));
    };

    const handleAddToCart = () => {
        const items = generatedRows
            .filter((row) => Number(row.points) > 0)
            .map((row) => ({ number: row.pana, points: String(row.points), type: session }));
        if (!items.length) {
            showWarning('Select digits, check SP/DP/SPDPT, and enter points to generate rows.');
            return;
        }
        const count = addToCart(items, gameType, title, betType || 'cp-common');
        if (count > 0) showWarning(`Added ${count} bet(s) to cart ✓`);
        setGeneratedRows([]);
    };

    return (
        <BookieBidLayout
            title={title}
            bidsCount={bidsCount}
            totalPoints={totalPoints}
            session={session}
            setSession={setSession}
            selectedDate={selectedDate}
            setSelectedDate={handleDateChange}
            hideFooter
            showDateSession={!embedInSingleScroll}
            noHeader={embedInSingleScroll}
            noDateSession={embedInSingleScroll}
            noFooter={embedInSingleScroll}
            contentPaddingClass="pb-24"
        >
            <div className="px-2 sm:px-4 py-3 w-full max-w-full overflow-x-hidden">
                {warning && (
                    <div className="fixed top-16 sm:top-20 left-1/2 transform -translate-x-1/2 z-50 bg-white border border-green-200 text-green-600 rounded-lg px-3 py-2.5 text-xs sm:text-sm font-medium shadow-xl max-w-[calc(100%-2rem)] sm:max-w-md backdrop-blur-sm">
                        {warning}
                    </div>
                )}
                <div className="flex flex-col md:flex-row gap-4 sm:gap-5 items-stretch md:items-start">
                    <div className="flex flex-col gap-3 w-full md:w-1/2 shrink-0 min-w-0">
                        <div>
                            <div className="mb-2">
                                <div className="flex items-center justify-between mb-1 gap-3">
                                    <div className="block text-[11px] sm:text-xs font-semibold text-gray-500">
                                        Select Digits
                                    </div>
                                    <div className="flex items-center gap-2 sm:gap-3">
                                        <label className="inline-flex items-center gap-2 text-[12px] sm:text-sm font-semibold text-gray-800">
                                            <input
                                                type="checkbox"
                                                className="h-5 w-5 sm:h-6 sm:w-6 rounded border-2 border-gray-500 text-sb-primary focus:ring-sb-primary"
                                                checked={includeSp}
                                                onChange={(e) => setIncludeSp(e.target.checked)}
                                            />
                                            <span>SP</span>
                                        </label>
                                        <label className="inline-flex items-center gap-2 text-[12px] sm:text-sm font-semibold text-gray-800">
                                            <input
                                                type="checkbox"
                                                className="h-5 w-5 sm:h-6 sm:w-6 rounded border-2 border-gray-500 text-sb-primary focus:ring-sb-primary"
                                                checked={includeDp}
                                                onChange={(e) => setIncludeDp(e.target.checked)}
                                            />
                                            <span>DP</span>
                                        </label>
                                        <label className="inline-flex items-center gap-2 text-[12px] sm:text-sm font-semibold text-gray-800">
                                            <input
                                                type="checkbox"
                                                className="h-5 w-5 sm:h-6 sm:w-6 rounded border-2 border-gray-500 text-sb-primary focus:ring-sb-primary"
                                                checked={includeTriple}
                                                onChange={(e) => setIncludeTriple(e.target.checked)}
                                            />
                                            <span>SPDPT</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-5 gap-2">
                                {DIGITS.map((d) => {
                                    const selected = selectedDigits.includes(String(d));
                                    return (
                                        <button
                                            key={d}
                                            type="button"
                                            onClick={() => toggleDigit(d)}
                                            aria-pressed={selected}
                                            className={`min-h-[40px] h-10 rounded-md font-bold text-sm sm:text-base transition-all active:scale-[0.98] border ${
                                                selected
                                                    ? 'bg-sb-primary text-white border-sb-primary'
                                                    : 'bg-white text-sb-primary border-gray-300 hover:bg-sb-primary-dark/5'
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
                                    placeholder="e.g. 1,2"
                                    className="flex-1 min-w-0 min-h-[40px] h-10 sm:h-11 bg-white border border-gray-300 rounded-lg px-3 text-sm sm:text-base font-semibold text-gray-800"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs sm:text-sm font-semibold text-gray-600 mb-1.5">Enter Points</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={pointsInput}
                                    onChange={(e) => setPointsInput((e.target.value ?? '').replace(/\D/g, '').slice(0, 6))}
                                    placeholder="Points"
                                    className="flex-1 min-w-0 min-h-[44px] h-11 sm:h-12 bg-white border border-gray-300 rounded-lg px-3 text-sm sm:text-base font-semibold text-gray-800"
                                />
                                <button
                                    type="button"
                                    onClick={clearLocal}
                                    className="min-h-[44px] h-11 px-4 rounded-lg text-xs sm:text-sm font-semibold border-2 border-sb-primary/30 text-sb-primary bg-white hover:bg-sb-primary-dark/5 active:scale-[0.98] transition-all shrink-0"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs sm:text-sm font-semibold text-gray-600 mb-1.5">Quick Points</label>
                            <div className="grid grid-cols-5 gap-2">
                                {QUICK_POINTS.map((pts) => {
                                    const selected = String(pointsInput || '') === String(pts);
                                    return (
                                        <button
                                            key={pts}
                                            type="button"
                                            onClick={() => setPointsInput(String(pts))}
                                            className={`min-h-[40px] h-10 rounded-md font-bold text-sm sm:text-base border transition-all active:scale-[0.98] ${
                                                selected
                                                    ? 'bg-sb-primary text-white border-sb-primary'
                                                    : 'bg-white text-sb-primary border-gray-300 hover:bg-sb-primary-dark/5'
                                            }`}
                                        >
                                            {pts}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="w-full md:w-1/2 flex-1 min-w-0 rounded-lg border border-gray-200 overflow-hidden flex flex-col min-h-[200px] sm:min-h-[260px] bg-white">
                        <div className="grid grid-cols-[72px_1fr_56px_48px] gap-2 bg-sb-primary text-white font-bold text-xs sm:text-sm py-2.5 px-2 sm:px-3">
                            <div className="text-center">Pana</div>
                            <div className="text-center">Point</div>
                            <div className="text-center">Type</div>
                            <div className="text-center">Delete</div>
                        </div>
                        <div className="max-h-[240px] sm:max-h-[280px] overflow-y-auto flex-1 bg-white">
                            {generatedRows.length === 0 ? (
                                <div className="py-6 text-center text-gray-400 text-sm">Select 1-2 digits, check SP/DP/SPDPT, and enter points to generate</div>
                            ) : (
                                generatedRows.map((row) => (
                                    <div key={row.id} className="grid grid-cols-[72px_1fr_56px_48px] gap-2 items-center py-2.5 px-2 sm:px-3 border-b border-gray-200 min-h-[44px]">
                                        <div className="text-center font-bold text-gray-800 text-sm sm:text-base">{row.pana}</div>
                                        <div className="px-1 sm:px-2 min-w-0">
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={row.points}
                                                onChange={(e) => updatePoint(row.id, e.target.value)}
                                                className="w-full min-h-[40px] h-9 border border-gray-300 rounded-md px-2 text-center text-sm font-semibold text-gray-800"
                                            />
                                        </div>
                                        <div className="text-center text-sm font-semibold text-sb-primary">{getPanaType(row.pana)}</div>
                                        <button
                                            type="button"
                                            onClick={() => removeRow(row.id)}
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
                <div className="mt-3 mb-1 flex items-center gap-6 text-sb-primary">
                    <div className="text-center">
                        <div className="text-[11px] text-gray-500">Count</div>
                        <div className="text-2xl leading-none font-bold">{bidsCount}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-[11px] text-gray-500">Bet Amount</div>
                        <div className="text-2xl leading-none font-bold">{totalPoints}</div>
                    </div>
                </div>
                <div className={`flex flex-col gap-2 ${embedInSingleScroll ? 'mt-2' : 'mt-4'}`}>
                    <button type="button" onClick={clearLocal} className="px-4 py-2.5 rounded-xl text-sm font-semibold border-2 border-sb-primary/30 text-sb-primary bg-white hover:bg-sb-primary-dark/5 active:scale-[0.98] transition-all">
                        Clear
                    </button>
                    <button type="button" onClick={handleAddToCart} disabled={!bidsCount} className={`w-full bg-sb-primary text-white font-bold py-3.5 min-h-[52px] rounded-lg shadow-lg hover:bg-sb-primary-dark transition-all active:scale-[0.98] ${!bidsCount ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        Add to Cart {bidsCount > 0 && `(${bidsCount})`}
                    </button>
                </div>
            </div>
        </BookieBidLayout>
    );
};

export default CpCommonBid;
