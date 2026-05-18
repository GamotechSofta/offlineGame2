import React, { useEffect, useMemo, useState } from 'react';
import BookieBidLayout from '../BookieBidLayout';
import { usePlayerBet } from '../PlayerBetContext';
import { useBetCart } from '../BetCartContext';
import { isPastOpeningTime } from '../../../utils/marketTiming';

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const QUICK_POINTS = [10, 20, 30, 40, 50];

const SingleDigitBid = ({ title, gameType, betType, embedInSingleScroll = false }) => {
    const { market } = usePlayerBet();
    const { addToCart } = useBetCart();
    const [session, setSession] = useState(() => (isPastOpeningTime(market) ? 'CLOSE' : 'OPEN'));
    const [inputPoints, setInputPoints] = useState('');
    const [bids, setBids] = useState([]);
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
        showWarning._t = window.setTimeout(() => setWarning(''), 2200);
    };

    const handleQuickPointClick = (points) => {
        setInputPoints(String(points));
    };

    const handleClearPoints = () => {
        setInputPoints('');
    };

    const hasInputPoints = Number(inputPoints) > 0;

    const handleDigitClick = (digit) => {
        const pts = Number(inputPoints);
        if (!pts || pts <= 0) {
            showWarning('Please enter points.');
            return;
        }

        setBids((prev) => {
            const digitStr = String(digit);
            const typeStr = String(session);
            const existingIndex = prev.findIndex((b) => String(b.number) === digitStr && String(b.type) === typeStr);

            if (existingIndex >= 0) {
                const next = [...prev];
                const currentPoints = Number(next[existingIndex]?.points || 0) || 0;
                next[existingIndex] = { ...next[existingIndex], points: String(currentPoints + pts) };
                return next;
            }

            return [...prev, { id: Date.now() + Math.random(), number: digitStr, points: String(pts), type: typeStr }];
        });
    };

    const isRunning = isPastOpeningTime(market);
    useEffect(() => { if (isRunning) setSession('CLOSE'); }, [isRunning]);

    const rows = useMemo(() => {
        return [...bids].sort((a, b) => {
            if (a.type !== b.type) return a.type.localeCompare(b.type);
            return a.number.localeCompare(b.number);
        });
    }, [bids]);

    const bidsCount = rows.length;
    const totalPoints = rows.reduce((sum, row) => sum + Number(row.points || 0), 0);

    const pointsByDigit = bids.reduce((acc, bid) => {
        const key = String(bid.number);
        acc[key] = (acc[key] || 0) + Number(bid.points || 0);
        return acc;
    }, {});

    const updateRowPoints = (id, value) => {
        const cleanValue = String(value ?? '').replace(/\D/g, '').slice(0, 6);
        setBids((prev) =>
            prev
                .map((row) => (row.id === id ? { ...row, points: cleanValue } : row))
                .filter((row) => Number(row.points) > 0)
        );
    };

    const removeRow = (id) => {
        setBids((prev) => prev.filter((row) => row.id !== id));
    };

    const handleAddToCart = () => {
        const toAdd = rows
            .filter((row) => Number(row.points) > 0)
            .map((row) => ({ number: row.number, points: String(row.points), type: row.type }));

        if (!toAdd.length) {
            showWarning('Please add at least one digit with points.');
            return;
        }

        const count = addToCart(toAdd, gameType, title, betType);
        if (count > 0) showWarning(`Added ${count} bet(s) to cart ✓`);
        setBids([]);
        setInputPoints('');
    };

    return (
        <BookieBidLayout
            title={title}
            bidsCount={bidsCount}
            totalPoints={totalPoints}
            showDateSession={!embedInSingleScroll}
            session={session}
            setSession={setSession}
            hideFooter
            noHeader={embedInSingleScroll}
            noDateSession={embedInSingleScroll}
            noFooter={embedInSingleScroll}
            selectedDate={selectedDate}
            setSelectedDate={handleDateChange}
            contentPaddingClass="pb-24"
        >
            <div className="px-3 sm:px-4 py-2 w-full max-w-full overflow-x-hidden">
                {warning && (
                    <div className="fixed top-16 sm:top-20 left-1/2 transform -translate-x-1/2 z-50 bg-white border border-green-200 text-green-600 rounded-lg px-3 py-2.5 text-xs sm:text-sm font-medium shadow-xl max-w-[calc(100%-2rem)] sm:max-w-md backdrop-blur-sm">
                        {warning}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 md:gap-6 md:items-start gap-3 w-full">
                    <div className="w-full min-w-0">
                        <div className="flex flex-col gap-2 mb-1 w-full md:max-w-sm">
                            <div className="flex flex-row items-center gap-2">
                                <label className="text-gray-600 text-xs font-medium shrink-0 w-20">Enter Points:</label>
                                <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto] gap-2">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={inputPoints}
                                        onChange={(e) => setInputPoints(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        placeholder="Point"
                                        className="w-full bg-white border-2 border-gray-300 text-gray-800 placeholder-gray-500 rounded-full py-2 min-h-[36px] px-4 text-center text-xs focus:ring-2 focus:ring-gray-400 focus:border-gray-400 focus:outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleClearPoints}
                                        className="px-3 min-h-[36px] rounded-full border-2 border-gray-300 bg-white text-sb-primary text-xs font-medium hover:border-sb-primary active:scale-95"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-row items-center gap-2">
                                <label className="text-gray-600 text-xs font-medium shrink-0 w-20">Quick Points:</label>
                                <div className="flex-1 min-w-0 grid grid-cols-5 gap-2">
                                    {QUICK_POINTS.map((pts) => (
                                        <button
                                            key={pts}
                                            type="button"
                                            onClick={() => handleQuickPointClick(pts)}
                                            className="py-2 min-h-[36px] rounded-lg border-2 border-gray-300 bg-white text-xs font-bold text-sb-primary hover:border-sb-primary active:scale-[0.98]"
                                        >
                                            {pts}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-5 gap-2 w-full max-w-[360px]">
                            {DIGITS.map((num) => (
                                <button
                                    key={num}
                                    type="button"
                                    disabled={!hasInputPoints}
                                    onClick={() => hasInputPoints && handleDigitClick(num)}
                                    className={`relative aspect-square min-h-[40px] bg-sb-primary border border-white/10 text-white rounded-lg font-bold text-sm flex items-center justify-center transition-all active:scale-90 shadow-md select-none ${
                                        hasInputPoints ? 'hover:border-[#d4af37]/50 cursor-pointer' : 'opacity-50 cursor-not-allowed'
                                    }`}
                                >
                                    {num}
                                    {pointsByDigit[num] > 0 && (
                                        <span className="absolute top-0.5 right-1 text-[10px] font-bold text-white">
                                            {pointsByDigit[num] > 999 ? '999+' : pointsByDigit[num]}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 w-full max-w-[320px]">
                            <div className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-center">
                                <div className="text-[11px] text-gray-600 font-medium">Count</div>
                                <div className="text-base font-bold text-sb-primary leading-tight">{bidsCount}</div>
                            </div>
                            <div className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-center">
                                <div className="text-[11px] text-gray-600 font-medium">Bet Amount</div>
                                <div className="text-base font-bold text-sb-primary leading-tight">{totalPoints}</div>
                            </div>
                        </div>
                    </div>

                    <div className="w-full min-w-0">
                        <div className="rounded-xl border border-gray-300 bg-white overflow-hidden w-full">
                            <div className="grid grid-cols-4 bg-gray-100 text-[11px] font-semibold text-sb-primary">
                                <div className="px-2 py-1.5">Pana</div>
                                <div className="px-2 py-1.5 text-center">Point</div>
                                <div className="px-2 py-1.5 text-center">Type</div>
                                <div className="px-2 py-1.5 text-center">Delete</div>
                            </div>
                            {rows.map((row) => (
                                <div key={row.id} className="grid grid-cols-4 border-t border-gray-200 text-xs items-center">
                                    <div className="px-2 py-1.5 font-semibold text-gray-800">{row.number}</div>
                                    <div className="px-1 py-1">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={row.points}
                                            onChange={(e) => updateRowPoints(row.id, e.target.value)}
                                            className="w-full h-7 rounded border border-gray-300 text-center font-semibold text-gray-800 focus:outline-none focus:border-sb-primary"
                                        />
                                    </div>
                                    <div className="px-2 py-1.5 text-center text-gray-700">{row.type}</div>
                                    <div className="px-2 py-1.5 text-center">
                                        <button type="button" onClick={() => removeRow(row.id)} className="text-red-500 hover:text-red-600" aria-label="Delete">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-4">
                    <button
                        type="button"
                        onClick={handleAddToCart}
                        disabled={!bidsCount}
                        className={`w-full bg-sb-primary text-white font-bold py-3.5 min-h-[48px] rounded-lg shadow-md hover:bg-sb-primary-dark transition-all active:scale-[0.98] ${
                            !bidsCount ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                    >
                        Add to Cart {bidsCount > 0 ? `(${bidsCount})` : ''}
                    </button>
                </div>
            </div>
        </BookieBidLayout>
    );
};

export default SingleDigitBid;
