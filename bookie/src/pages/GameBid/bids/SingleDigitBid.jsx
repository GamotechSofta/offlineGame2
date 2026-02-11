import React, { useEffect, useRef, useState } from 'react';
import BookieBidLayout from '../BookieBidLayout';
import { usePlayerBet } from '../PlayerBetContext';
import { useBetCart } from '../BetCartContext';

const SingleDigitBid = ({ title, gameType, betType }) => {
    const { market } = usePlayerBet();
    const { addToCart } = useBetCart();
    const [activeTab, setActiveTab] = useState('special');
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
    const [specialModeInputs, setSpecialModeInputs] = useState(
        Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, '']))
    );
    const resetSpecialInputs = () => setSpecialModeInputs(Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, ''])));

    const handleAddToCart = () => {
        const pts = Number(inputPoints);
        if (!pts || pts <= 0) { showWarning('Please enter points.'); return; }
        const n = inputNumber.toString().trim();
        if (!n) { showWarning('Please enter digit (0-9).'); return; }
        if (!/^[0-9]$/.test(n)) { showWarning('Invalid digit. Use 0-9.'); return; }
        const count = addToCart([{ number: n, points: String(pts), type: session }], gameType, title, betType);
        if (count > 0) showWarning(`Added ${count} bet to cart ✓`);
        setInputNumber(''); setInputPoints('');
    };

    const handleNumberInputChange = (e) => {
        const prevLen = (inputNumber ?? '').toString().length;
        const digit = e.target.value.replace(/\D/g, '').slice(-1);
        setInputNumber(digit);
        if (digit && digit.length === 1 && prevLen === 0) {
            window.requestAnimationFrame(() => { pointsInputRef.current?.focus?.(); });
        }
    };

    const handleAddSpecialToCart = () => {
        const toAdd = Object.entries(specialModeInputs)
            .filter(([, pts]) => Number(pts) > 0)
            .map(([num, pts]) => ({ number: num, points: String(pts), type: session }));
        if (toAdd.length === 0) { showWarning('Please enter points for at least one digit (0-9).'); return; }
        const count = addToCart(toAdd, gameType, title, betType);
        if (count > 0) showWarning(`Added ${count} bet(s) to cart ✓`);
        resetSpecialInputs();
    };

    const todayDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
    const isRunning = market?.status === 'running';

    useEffect(() => { if (isRunning) setSession('CLOSE'); }, [isRunning]);

    const modeTabs = (
        <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setActiveTab('special')}
                className={`min-h-[44px] py-3 rounded-lg font-bold text-sm shadow-sm border active:scale-[0.98] transition-colors ${activeTab === 'special' ? 'bg-[#d4af37] text-[#4b3608] border-[#d4af37]' : 'bg-[#202124] text-gray-400 border-white/10 hover:border-[#d4af37]/50'}`}>
                SPECIAL MODE
            </button>
            <button onClick={() => setActiveTab('easy')}
                className={`min-h-[44px] py-3 rounded-lg font-bold text-sm shadow-sm border active:scale-[0.98] transition-colors ${activeTab === 'easy' ? 'bg-[#d4af37] text-[#4b3608] border-[#d4af37]' : 'bg-[#202124] text-gray-400 border-white/10 hover:border-[#d4af37]/50'}`}>
                EASY MODE
            </button>
        </div>
    );

    const dateSessionRow = (
        <div className="grid grid-cols-2 gap-3">
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <input type="text" value={todayDate} readOnly className="w-full pl-10 py-3 sm:py-2.5 min-h-[44px] bg-[#202124] border border-white/10 text-white rounded-full text-sm font-bold text-center focus:outline-none" />
            </div>
            <div className="relative">
                <select value={session} onChange={(e) => setSession(e.target.value)} disabled={isRunning}
                    className={`w-full appearance-none bg-[#202124] border border-white/10 text-white font-bold text-sm py-3 sm:py-2.5 min-h-[44px] px-4 rounded-full text-center focus:outline-none focus:border-[#d4af37] ${isRunning ? 'opacity-80 cursor-not-allowed' : ''}`}>
                    {isRunning ? <option value="CLOSE">CLOSE</option> : <><option value="OPEN">OPEN</option><option value="CLOSE">CLOSE</option></>}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
            </div>
        </div>
    );

    return (
        <BookieBidLayout title={title} bidsCount={0} totalPoints={0} showDateSession={true}
            session={session} setSession={setSession} hideFooter selectedDate={selectedDate} setSelectedDate={handleDateChange}
            contentPaddingClass="pb-24">
            <div className="px-3 sm:px-4 py-4 sm:py-2 md:max-w-3xl md:mx-auto md:items-start">
                <div className="space-y-4">
                    {warning && <div className="fixed top-16 sm:top-20 left-1/2 transform -translate-x-1/2 z-50 bg-black/95 border border-green-500/50 text-green-400 rounded-lg px-3 py-2.5 text-xs sm:text-sm font-medium shadow-xl max-w-[calc(100%-2rem)] sm:max-w-md backdrop-blur-sm">{warning}</div>}
                    {modeTabs}
                    {dateSessionRow}
                    {activeTab === 'easy' ? (
                        <>
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-row items-center gap-2">
                                    <label className="text-gray-400 text-sm font-medium shrink-0 w-32">Select Game Type:</label>
                                    <div className="flex-1 min-w-0 bg-[#202124] border border-white/10 rounded-full py-2.5 min-h-[40px] px-4 flex items-center justify-center text-sm font-bold text-white">{session}</div>
                                </div>
                                <div className="flex flex-row items-center gap-2">
                                    <label className="text-gray-400 text-sm font-medium shrink-0 w-32">Enter Single Digit:</label>
                                    <input type="text" inputMode="numeric" value={inputNumber} onChange={handleNumberInputChange} placeholder="Digit" maxLength={1}
                                        className="flex-1 min-w-0 bg-[#202124] border border-white/10 text-white placeholder-gray-500 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm focus:ring-2 focus:ring-[#d4af37] focus:border-[#d4af37] focus:outline-none" />
                                </div>
                                <div className="flex flex-row items-center gap-2">
                                    <label className="text-gray-400 text-sm font-medium shrink-0 w-32">Enter Points:</label>
                                    <input ref={pointsInputRef} type="text" inputMode="numeric" value={inputPoints}
                                        onChange={(e) => setInputPoints(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        placeholder="Point" className="no-spinner flex-1 min-w-0 bg-[#202124] border border-white/10 text-white placeholder-gray-500 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm focus:ring-2 focus:ring-[#d4af37] focus:border-[#d4af37] focus:outline-none" />
                                </div>
                            </div>
                            <button onClick={handleAddToCart} className="w-full bg-gradient-to-r from-[#d4af37] to-[#cca84d] text-[#4b3608] font-bold py-3.5 min-h-[48px] rounded-lg shadow-md hover:from-[#e5c04a] hover:to-[#d4af37] transition-all active:scale-[0.98]">
                                Add to Cart
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
                                {[0,1,2,3,4,5,6,7,8,9].map((num) => (
                                    <div key={num} className="flex items-center gap-2">
                                        <div className="w-10 h-10 bg-[#202124] border border-white/10 text-[#f2c14e] flex items-center justify-center rounded-l-md font-bold text-sm shrink-0">{num}</div>
                                        <input type="number" min="0" placeholder="Pts" value={specialModeInputs[num]}
                                            onChange={(e) => setSpecialModeInputs((p) => ({ ...p, [num]: e.target.value }))}
                                            className="w-full h-10 bg-[#202124] border border-white/10 text-white placeholder-gray-500 rounded-r-md focus:outline-none focus:border-[#d4af37] px-3 text-sm font-semibold" />
                                    </div>
                                ))}
                            </div>
                            <button onClick={handleAddSpecialToCart}
                                className="w-full bg-gradient-to-r from-[#d4af37] to-[#cca84d] text-[#4b3608] font-bold py-3 rounded-md shadow-md hover:from-[#e5c04a] hover:to-[#d4af37] transition-all active:scale-[0.98]">
                                Add to Cart
                            </button>
                        </>
                    )}
                </div>
            </div>
        </BookieBidLayout>
    );
};

export default SingleDigitBid;
