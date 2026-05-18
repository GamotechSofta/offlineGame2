import React, { useEffect, useState } from 'react';
import BookieBidLayout from '../BookieBidLayout';
import { usePlayerBet } from '../PlayerBetContext';
import { useBetCart } from '../BetCartContext';
import { isPastOpeningTime } from '../../../utils/marketTiming';

const ODD_DIGITS = [1, 3, 5, 7, 9];
const EVEN_DIGITS = [0, 2, 4, 6, 8];

const OddEvenBid = ({ title, gameType, betType, embedInSingleScroll = false }) => {
    const { market } = usePlayerBet();
    const { addToCart } = useBetCart();
    const [session, setSession] = useState(() => (isPastOpeningTime(market) ? 'CLOSE' : 'OPEN'));
    const [choice, setChoice] = useState('odd');
    const [digitInputs, setDigitInputs] = useState(() => Object.fromEntries([...ODD_DIGITS, ...EVEN_DIGITS].map((d) => [d, ''])));
    const [warning, setWarning] = useState('');
    const [selectedDate, setSelectedDate] = useState(() => {
        try {
            const savedDate = localStorage.getItem('bookieBetSelectedDate');
            if (savedDate && savedDate > new Date().toISOString().split('T')[0]) return savedDate;
        } catch (e) { /* ignore */ }
        return new Date().toISOString().split('T')[0];
    });

    const digits = choice === 'odd' ? ODD_DIGITS : EVEN_DIGITS;

    const handleDateChange = (newDate) => {
        try { localStorage.setItem('bookieBetSelectedDate', newDate); } catch (e) { /* ignore */ }
        setSelectedDate(newDate);
    };
    const showWarning = (msg) => {
        setWarning(msg);
        window.clearTimeout(showWarning._t);
        showWarning._t = window.setTimeout(() => setWarning(''), 2200);
    };

    const handleAddToCart = () => {
        const toAdd = digits
            .filter((num) => Number(digitInputs[num]) > 0)
            .map((num) => ({ number: String(num), points: String(digitInputs[num]), type: session }));
        if (toAdd.length === 0) {
            showWarning(`Please enter points for at least one ${choice === 'odd' ? 'odd' : 'even'} number.`);
            return;
        }
        // Odd Even screen places single-digit bets (one per digit)
        const count = addToCart(toAdd, gameType, title, 'single');
        if (count > 0) showWarning(`Added ${count} bet(s) to cart ✓`);
        setDigitInputs((p) => ({ ...p, ...Object.fromEntries(digits.map((d) => [d, ''])) }));
    };

    const isRunning = isPastOpeningTime(market);
    useEffect(() => { if (isRunning) setSession('CLOSE'); }, [isRunning]);

    return (
        <BookieBidLayout
            title={title}
            bidsCount={0}
            totalPoints={0}
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
            <div className="px-3 sm:px-4 py-4 sm:py-2 md:max-w-3xl md:mx-auto md:items-start">
                <div className="space-y-4">
                    {warning && <div className="fixed top-16 sm:top-20 left-1/2 transform -translate-x-1/2 z-50 bg-white border border-green-200 text-green-600 rounded-lg px-3 py-2.5 text-xs sm:text-sm font-medium shadow-xl max-w-[calc(100%-2rem)] sm:max-w-md backdrop-blur-sm">{warning}</div>}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => setChoice('odd')}
                            className={`min-h-[44px] py-3 rounded-lg font-bold text-sm border-2 transition-colors ${choice === 'odd' ? 'bg-[#1B3150] text-white border-[#1B3150]' : 'bg-gray-100 text-gray-600 border-gray-200 hover:border-gray-400'}`}
                        >
                            Odd
                        </button>
                        <button
                            type="button"
                            onClick={() => setChoice('even')}
                            className={`min-h-[44px] py-3 rounded-lg font-bold text-sm border-2 transition-colors ${choice === 'even' ? 'bg-[#1B3150] text-white border-[#1B3150]' : 'bg-gray-100 text-gray-600 border-gray-200 hover:border-gray-400'}`}
                        >
                            Even
                        </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
                        {digits.map((num) => (
                            <div key={num} className="flex items-center gap-2">
                                <div className="w-10 h-10 bg-[#1B3150] border border-gray-200 text-white flex items-center justify-center rounded-l-md font-bold text-sm shrink-0">{num}</div>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="Pts"
                                    value={digitInputs[num]}
                                    onChange={(e) => setDigitInputs((p) => ({ ...p, [num]: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                                    className="w-full h-10 bg-gray-100 border border-gray-200 text-gray-800 placeholder-gray-400 rounded-r-md focus:outline-none focus:border-[#1B3150] px-3 text-sm font-semibold"
                                />
                            </div>
                        ))}
                    </div>
                    <button onClick={handleAddToCart} className="w-full bg-[#1B3150] text-white font-bold py-3.5 min-h-[48px] rounded-lg shadow-md hover:bg-[#152842] transition-all active:scale-[0.98]">
                        Add to Cart
                    </button>
                </div>
            </div>
        </BookieBidLayout>
    );
};

export default OddEvenBid;
