import React, { useEffect, useMemo, useRef, useState } from 'react';
import BookieBidLayout from '../BookieBidLayout';
import { usePlayerBet } from '../PlayerBetContext';
import { useBetCart } from '../BetCartContext';
import { isPastOpeningTime } from '../../../utils/marketTiming';

const TriplePanaBid = ({ title, gameType, betType, embedInSingleScroll = false }) => {
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

    const handleDateChange = (newDate) => {
        try { localStorage.setItem('bookieBetSelectedDate', newDate); } catch (e) { /* ignore */ }
        setSelectedDate(newDate);
    };

    const showWarning = (msg) => {
        setWarning(msg);
        window.clearTimeout(showWarning._t);
        showWarning._t = window.setTimeout(() => setWarning(''), 2200);
    };

    const tripleNumbers = useMemo(() => Array.from({ length: 10 }, (_, i) => `${i}${i}${i}`), []);
    const [specialInputs, setSpecialInputs] = useState(() =>
        Object.fromEntries(tripleNumbers.map((n) => [n, '']))
    );
    const specialInputRefs = useRef({});

    const isRunning = isPastOpeningTime(market);
    useEffect(() => { if (isRunning) setSession('CLOSE'); }, [isRunning]);

    const handleAddSpecialToCart = () => {
        const toAdd = Object.entries(specialInputs)
            .filter(([, pts]) => Number(pts) > 0)
            .map(([num, pts]) => ({ number: num, points: String(pts), type: session }));
        if (!toAdd.length) { showWarning('Please enter points for at least one triple pana.'); return; }
        const count = addToCart(toAdd, gameType, title, betType);
        if (count > 0) showWarning(`Added ${count} bet(s) to cart ✓`);
        setSpecialInputs(Object.fromEntries(tripleNumbers.map((n) => [n, ''])));
    };

    const addToCartBtnClass = 'w-full bg-sb-primary text-white font-bold py-3.5 min-h-[48px] rounded-lg shadow-lg hover:bg-sb-primary-dark transition-all active:scale-[0.98]';

    return (
        <BookieBidLayout title={title} bidsCount={0} totalPoints={0} showDateSession={!embedInSingleScroll}
            selectedDate={selectedDate} setSelectedDate={handleDateChange} session={session} setSession={setSession}
            hideFooter noHeader={embedInSingleScroll} noDateSession={embedInSingleScroll} noFooter={embedInSingleScroll} contentPaddingClass="pb-24">
            <div className="px-3 sm:px-4 py-4 sm:py-2 md:max-w-3xl md:mx-auto md:items-start">
                <div className="space-y-4">
                    {warning && (
                        <div className="fixed top-16 sm:top-20 left-1/2 transform -translate-x-1/2 z-50 bg-white border border-green-200 text-green-600 rounded-lg px-3 py-2.5 text-xs sm:text-sm font-medium shadow-xl max-w-[calc(100%-2rem)] sm:max-w-md backdrop-blur-sm">
                            {warning}
                        </div>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
                                {tripleNumbers.map((num, idx) => (
                                    <div key={num} className="flex items-center gap-2">
                                        <div className="w-12 h-10 bg-gray-100 border border-gray-200 text-orange-500 flex items-center justify-center rounded-l-md font-bold text-sm shrink-0">{num}</div>
                                        <input
                                            ref={(el) => { specialInputRefs.current[idx] = el; }}
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="Pts"
                                            value={specialInputs[num] || ''}
                                            onChange={(e) => setSpecialInputs((p) => ({ ...p, [num]: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                                            onKeyDown={(e) => {
                                                if (e.key === 'ArrowRight' && idx < tripleNumbers.length - 1) { e.preventDefault(); specialInputRefs.current[idx + 1]?.focus?.(); }
                                                else if (e.key === 'ArrowLeft' && idx > 0) { e.preventDefault(); specialInputRefs.current[idx - 1]?.focus?.(); }
                                            }}
                                            className="w-full h-10 bg-gray-100 border border-gray-200 text-gray-800 placeholder-gray-400 rounded-r-md focus:outline-none focus:border-sb-primary px-3 text-sm font-semibold"
                                        />
                                    </div>
                                ))}
                            </div>
                            <button type="button" onClick={handleAddSpecialToCart} className={addToCartBtnClass}>
                                Add to Cart
                            </button>
                </div>
            </div>
        </BookieBidLayout>
    );
};

export default TriplePanaBid;
