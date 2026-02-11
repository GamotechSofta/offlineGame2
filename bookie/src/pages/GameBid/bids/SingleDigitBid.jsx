import React, { useEffect, useState } from 'react';
import BookieBidLayout from '../BookieBidLayout';
import { usePlayerBet } from '../PlayerBetContext';
import { useBetCart } from '../BetCartContext';

const SingleDigitBid = ({ title, gameType, betType }) => {
    const { market } = usePlayerBet();
    const { addToCart } = useBetCart();
    const [session, setSession] = useState(() => (market?.status === 'running' ? 'CLOSE' : 'OPEN'));
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
    const [digitInputs, setDigitInputs] = useState(
        Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, '']))
    );
    const resetInputs = () => setDigitInputs(Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, ''])));

    const handleAddToCart = () => {
        const toAdd = Object.entries(digitInputs)
            .filter(([, pts]) => Number(pts) > 0)
            .map(([num, pts]) => ({ number: num, points: String(pts), type: session }));
        if (toAdd.length === 0) { showWarning('Please enter points for at least one digit (0-9).'); return; }
        const count = addToCart(toAdd, gameType, title, betType);
        if (count > 0) showWarning(`Added ${count} bet(s) to cart ✓`);
        resetInputs();
    };

    const isRunning = market?.status === 'running';
    useEffect(() => { if (isRunning) setSession('CLOSE'); }, [isRunning]);

    return (
        <BookieBidLayout title={title} bidsCount={0} totalPoints={0} showDateSession={true}
            session={session} setSession={setSession} hideFooter selectedDate={selectedDate} setSelectedDate={handleDateChange}
            contentPaddingClass="pb-24">
            <div className="px-3 sm:px-4 py-4 sm:py-2 md:max-w-3xl md:mx-auto md:items-start">
                <div className="space-y-4">
                    {warning && <div className="fixed top-16 sm:top-20 left-1/2 transform -translate-x-1/2 z-50 bg-white border border-green-200 text-green-600 rounded-lg px-3 py-2.5 text-xs sm:text-sm font-medium shadow-xl max-w-[calc(100%-2rem)] sm:max-w-md backdrop-blur-sm">{warning}</div>}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
                        {[0,1,2,3,4,5,6,7,8,9].map((num) => (
                            <div key={num} className="flex items-center gap-2">
                                <div className="w-10 h-10 bg-gray-100 border border-gray-200 text-orange-500 flex items-center justify-center rounded-l-md font-bold text-sm shrink-0">{num}</div>
                                <input type="number" min="0" placeholder="Pts" value={digitInputs[num]}
                                    onChange={(e) => setDigitInputs((p) => ({ ...p, [num]: e.target.value }))}
                                    className="w-full h-10 bg-gray-100 border border-gray-200 text-gray-800 placeholder-gray-400 rounded-r-md focus:outline-none focus:border-orange-500 px-3 text-sm font-semibold" />
                            </div>
                        ))}
                    </div>
                    <button onClick={handleAddToCart}
                        className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-3.5 min-h-[48px] rounded-lg shadow-md hover:from-orange-600 hover:to-orange-700 transition-all active:scale-[0.98]">
                        Add to Cart
                    </button>
                </div>
            </div>
        </BookieBidLayout>
    );
};

export default SingleDigitBid;
