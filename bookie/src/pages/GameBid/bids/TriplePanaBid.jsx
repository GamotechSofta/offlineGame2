import React, { useEffect, useMemo, useRef, useState } from 'react';
import BookieBidLayout from '../BookieBidLayout';
import { usePlayerBet } from '../PlayerBetContext';
import { useBetCart } from '../BetCartContext';
import { isValidTriplePana } from '../panaRules';

const TriplePanaBid = ({ title, gameType, betType, embedInSingleScroll = false }) => {
    const { market } = usePlayerBet();
    const { addToCart } = useBetCart();
    const [activeTab, setActiveTab] = useState('easy');
    const [session, setSession] = useState(() => (market?.status === 'running' ? 'CLOSE' : 'OPEN'));
    const [inputNumber, setInputNumber] = useState('');
    const [inputPoints, setInputPoints] = useState('');
    const pointsInputRef = useRef(null);
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

    const isRunning = market?.status === 'running';
    useEffect(() => { if (isRunning) setSession('CLOSE'); }, [isRunning]);

    const handleAddToCart = () => {
        const pts = Number(inputPoints);
        if (!pts || pts <= 0) { showWarning('Please enter points.'); return; }
        const n = inputNumber?.toString().trim() || '';
        if (!n) { showWarning('Please enter triple pana (000-999).'); return; }
        if (!isValidTriplePana(n)) { showWarning('Invalid triple pana. Use 000, 111, 222 ... 999.'); return; }
        const count = addToCart([{ number: n, points: String(pts), type: session }], gameType, title, betType);
        if (count > 0) showWarning(`Added ${count} bet to cart ✓`);
        setInputNumber(''); setInputPoints('');
    };

    const handleAddSpecialToCart = () => {
        const toAdd = Object.entries(specialInputs)
            .filter(([, pts]) => Number(pts) > 0)
            .map(([num, pts]) => ({ number: num, points: String(pts), type: session }));
        if (!toAdd.length) { showWarning('Please enter points for at least one triple pana.'); return; }
        const count = addToCart(toAdd, gameType, title, betType);
        if (count > 0) showWarning(`Added ${count} bet(s) to cart ✓`);
        setSpecialInputs(Object.fromEntries(tripleNumbers.map((n) => [n, ''])));
    };

    const handleNumberInputChange = (e) => {
        const raw = e.target.value.replace(/\D/g, '').slice(0, 3);
        if (raw.length < inputNumber.length) { setInputNumber(''); return; }
        if (!raw) { setInputNumber(''); return; }
        const d = raw[0];
        const nextVal = `${d}${d}${d}`;
        const prevVal = (inputNumber ?? '').toString();
        setInputNumber(nextVal);
        if (nextVal.length === 3 && prevVal !== nextVal) {
            window.requestAnimationFrame(() => { pointsInputRef.current?.focus?.(); });
        }
    };
    const isPanaInvalid = !!inputNumber && inputNumber.length === 3 && !isValidTriplePana(inputNumber);

    const modeTabs = (
        <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setActiveTab('easy')}
                className={`min-h-[44px] py-3 rounded-lg font-bold text-sm shadow-sm border active:scale-[0.98] transition-colors ${activeTab === 'easy' ? 'bg-orange-500 text-white border-orange-500' : 'bg-gray-100 text-gray-400 border-gray-200 hover:border-orange-500/50'}`}>
                EASY MODE
            </button>
            <button type="button" onClick={() => setActiveTab('special')}
                className={`min-h-[44px] py-3 rounded-lg font-bold text-sm shadow-sm border active:scale-[0.98] transition-colors ${activeTab === 'special' ? 'bg-orange-500 text-white border-orange-500' : 'bg-gray-100 text-gray-400 border-gray-200 hover:border-orange-500/50'}`}>
                SPECIAL MODE
            </button>
        </div>
    );

    const addToCartBtnClass = 'w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-3.5 min-h-[48px] rounded-lg shadow-md hover:from-orange-600 hover:to-orange-700 transition-all active:scale-[0.98]';

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
                    {modeTabs}
                    {activeTab === 'easy' ? (
                        <>
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-row items-center gap-2">
                                    <label className="text-gray-400 text-sm font-medium shrink-0 w-32">Select Game Type:</label>
                                    <div className="flex-1 min-w-0 bg-gray-100 border border-gray-200 rounded-full py-2.5 min-h-[40px] px-4 flex items-center justify-center text-sm font-bold text-gray-800">{session}</div>
                                </div>
                                <div className="flex flex-row items-center gap-2">
                                    <label className="text-gray-400 text-sm font-medium shrink-0 w-32">Enter Pana:</label>
                                    <input type="text" inputMode="numeric" value={inputNumber} onChange={handleNumberInputChange} placeholder="Pana" maxLength={3}
                                        className={`flex-1 min-w-0 bg-gray-100 border border-gray-200 text-gray-800 placeholder-gray-400 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm focus:ring-2 focus:outline-none ${isPanaInvalid ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'focus:ring-orange-500 focus:border-orange-500'}`} />
                                </div>
                                <div className="flex flex-row items-center gap-2">
                                    <label className="text-gray-400 text-sm font-medium shrink-0 w-32">Enter Points:</label>
                                    <input ref={pointsInputRef} type="text" inputMode="numeric" value={inputPoints}
                                        onChange={(e) => setInputPoints(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        placeholder="Point" className="no-spinner flex-1 min-w-0 bg-gray-100 border border-gray-200 text-gray-800 placeholder-gray-400 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none" />
                                </div>
                            </div>
                            <button type="button" onClick={handleAddToCart} className={addToCartBtnClass}>
                                Add to Cart
                            </button>
                        </>
                    ) : (
                        <>
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
                                            className="w-full h-10 bg-gray-100 border border-gray-200 text-gray-800 placeholder-gray-400 rounded-r-md focus:outline-none focus:border-orange-500 px-3 text-sm font-semibold"
                                        />
                                    </div>
                                ))}
                            </div>
                            <button type="button" onClick={handleAddSpecialToCart} className={addToCartBtnClass}>
                                Add to Cart
                            </button>
                        </>
                    )}
                </div>
            </div>
        </BookieBidLayout>
    );
};

export default TriplePanaBid;
