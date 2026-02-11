import React, { useEffect, useMemo, useState } from 'react';
import BookieBidLayout from '../BookieBidLayout';
import { usePlayerBet } from '../PlayerBetContext';
import { useBetCart } from '../BetCartContext';

const SingleDigitBulkBid = ({ title, gameType, betType }) => {
    const { market } = usePlayerBet();
    const { addToCart } = useBetCart();
    const [session, setSession] = useState(() => (market?.status === 'running' ? 'CLOSE' : 'OPEN'));
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

    const isRunning = market?.status === 'running';
    useEffect(() => {
        if (isRunning) setSession('CLOSE');
    }, [isRunning]);

    const handleDigitClick = (num) => {
        const pts = Number(inputPoints);
        if (!pts || pts <= 0) {
            showWarning('Please enter points.');
            return;
        }
        setBids((prev) => [
            ...prev,
            { id: Date.now() + Math.random(), number: String(num), points: String(pts), type: session }
        ]);
    };

    const bulkBidsCount = bids.length;

    // Merge bids by digit+type for display
    const rows = useMemo(() => {
        const map = new Map();
        for (const b of bids) {
            const num = String(b.number ?? '').trim();
            const type = String(b.type ?? '').trim();
            const key = `${num}__${type}`;
            const prev = map.get(key);
            const pts = Number(b.points || 0) || 0;
            if (prev) {
                prev.points = String((Number(prev.points || 0) || 0) + pts);
            } else {
                map.set(key, { id: key, number: num, points: String(pts), type });
            }
        }
        return Array.from(map.values());
    }, [bids]);

    const pointsByDigit = bids.reduce((acc, b) => {
        const k = String(b.number);
        acc[k] = (acc[k] || 0) + Number(b.points || 0);
        return acc;
    }, {});

    const clearLocal = () => {
        setBids([]);
        setInputPoints('');
    };

    const handleAddToCart = () => {
        if (!rows.length) { showWarning('Please click digits to add bets first.'); return; }
        const count = addToCart(rows, gameType, title, betType);
        if (count > 0) showWarning(`Added ${count} bet(s) to cart ✓`);
        clearLocal();
    };

    return (
        <BookieBidLayout
            title={title}
            bidsCount={0}
            totalPoints={0}
            showDateSession={true}
            selectedDate={selectedDate}
            setSelectedDate={handleDateChange}
            session={session}
            setSession={setSession}
            hideFooter
            contentPaddingClass="pb-24"
        >
            <div className="px-3 py-2 w-full max-w-full overflow-x-hidden">
                {warning && (
                    <div className="fixed top-16 sm:top-20 left-1/2 transform -translate-x-1/2 z-50 bg-white border border-green-200 text-green-600 rounded-lg px-3 py-2.5 text-xs sm:text-sm font-medium shadow-xl max-w-[calc(100%-2rem)] sm:max-w-md backdrop-blur-sm">
                        {warning}
                    </div>
                )}
                <div className="flex flex-col md:grid md:grid-cols-2 md:gap-6 md:items-center gap-3 md:gap-6 w-full">
                    <div className="w-full min-w-0 md:flex md:justify-center md:items-center">
                        <div className="flex flex-col gap-2 mb-1 md:mb-0 w-full md:max-w-sm">
                            <div className="flex flex-row items-center gap-2">
                                <label className="text-gray-400 text-xs font-medium shrink-0 w-16">Enter Points:</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={inputPoints}
                                    onChange={(e) => setInputPoints(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="Point"
                                    className="no-spinner flex-1 min-w-0 bg-gray-100 border border-gray-200 text-gray-800 placeholder-gray-400 rounded-full py-2 min-h-[36px] px-4 text-center text-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="w-full min-w-0 md:flex md:justify-center md:items-center pt-1 md:pt-6">
                        <div className="grid grid-cols-3 gap-2 w-full max-w-[260px] md:max-w-[200px] mx-auto">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                <button key={num} type="button" onClick={() => handleDigitClick(num)} className="relative aspect-square min-h-[40px] bg-gray-100 border border-gray-200 hover:border-orange-500/50 text-orange-500 rounded-lg font-bold text-sm flex items-center justify-center transition-all active:scale-95 shadow-md">
                                    {num}
                                    {pointsByDigit[num] > 0 && <span className="absolute top-0.5 right-1 text-[10px] font-bold text-orange-500">{pointsByDigit[num]}</span>}
                                </button>
                            ))}
                            <div className="col-span-3 flex justify-center">
                                <button type="button" onClick={() => handleDigitClick(0)} className="relative aspect-square min-w-[40px] min-h-[40px] w-14 bg-gray-100 border border-gray-200 hover:border-orange-500/50 text-orange-500 rounded-lg font-bold text-sm flex items-center justify-center transition-all active:scale-95 shadow-md">
                                    0
                                    {pointsByDigit[0] > 0 && <span className="absolute top-0.5 right-1 text-[10px] font-bold text-orange-500">{pointsByDigit[0]}</span>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Add to Cart button */}
                {bulkBidsCount > 0 && (
                    <div className="mt-4 px-1">
                        <button type="button" onClick={handleAddToCart}
                            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-3.5 min-h-[48px] rounded-lg shadow-md hover:from-orange-600 hover:to-orange-700 transition-all active:scale-[0.98]">
                            Add {rows.length} bet(s) to Cart
                        </button>
                    </div>
                )}
            </div>
        </BookieBidLayout>
    );
};

export default SingleDigitBulkBid;
