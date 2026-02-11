import React, { useEffect, useMemo, useRef, useState } from 'react';
import BookieBidLayout from '../BookieBidLayout';
import { usePlayerBet } from '../PlayerBetContext';
import { useBetCart } from '../BetCartContext';

const EasyModeBid = ({
    title,
    gameType,
    betType,
    label,
    maxLength = 3,
    validateInput,
    showModeTabs = false,
    specialModeType = null,
    validDoublePanas = [],
    validSinglePanas = [],
}) => {
    const { market } = usePlayerBet();
    const { addToCart } = useBetCart();
    const [activeTab, setActiveTab] = useState('easy');
    const lockSessionToOpen = specialModeType === 'jodi';
    const [session, setSession] = useState(() => (lockSessionToOpen ? 'OPEN' : (market?.status === 'running' ? 'CLOSE' : 'OPEN')));
    const [inputNumber, setInputNumber] = useState('');
    const [inputPoints, setInputPoints] = useState('');
    const pointsInputRef = useRef(null);
    const [warning, setWarning] = useState('');
    const [selectedDate, setSelectedDate] = useState(() => {
        try {
            const savedDate = localStorage.getItem('bookieBetSelectedDate');
            if (savedDate) {
                const today = new Date().toISOString().split('T')[0];
                if (savedDate > today) return savedDate;
            }
        } catch (e) { /* ignore */ }
        return new Date().toISOString().split('T')[0];
    });

    // For pana sum mode: local accumulation before adding to cart
    const [pendingBids, setPendingBids] = useState([]);

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
        if (lockSessionToOpen) {
            if (session !== 'OPEN') setSession('OPEN');
            return;
        }
        if (isRunning) setSession('CLOSE');
    }, [isRunning, lockSessionToOpen, session]);

    const jodiNumbers = useMemo(() => Array.from({ length: 100 }, (_, i) => String(i).padStart(2, '0')), []);
    const isPanaSumMode = specialModeType === 'doublePana' || specialModeType === 'singlePana';
    const validPanasForSumMode = specialModeType === 'doublePana' ? validDoublePanas : (specialModeType === 'singlePana' ? validSinglePanas : []);

    const [specialInputs, setSpecialInputs] = useState(() => {
        if (specialModeType === 'jodi') return Object.fromEntries(Array.from({ length: 100 }, (_, i) => [String(i).padStart(2, '0'), '']));
        if (isPanaSumMode && validPanasForSumMode.length > 0) return Object.fromEntries(validPanasForSumMode.map((pana) => [pana, '']));
        return {};
    });

    const [selectedSum, setSelectedSum] = useState(null);

    const defaultValidate = (n) => !!(n && n.toString().trim());
    const isValid = validateInput || defaultValidate;

    const handleAddToCart = () => {
        const pts = Number(inputPoints);
        const n = inputNumber?.toString().trim() || '';
        if (!pts || pts <= 0) { showWarning('Please enter points.'); return; }
        if (!n) { showWarning(maxLength === 2 ? 'Please enter Digit (00-99).' : `Please enter ${labelKey}.`); return; }
        if (maxLength === 2 && n.length !== 2) { showWarning('Please enter 2-digit Digit (00-99).'); return; }
        if (!isValid(n)) { showWarning(maxLength === 2 ? 'Invalid Digit. Use 00-99.' : 'Invalid number.'); return; }

        const count = addToCart([{ number: n, points: String(pts), type: session }], gameType, title, betType);
        if (count > 0) showWarning(`Added ${count} bet to cart ✓`);
        setInputNumber('');
        setInputPoints('');
    };

    const handleAddSpecialToCart = () => {
        if (specialModeType === 'jodi') {
            const toAdd = Object.entries(specialInputs)
                .filter(([, pts]) => Number(pts) > 0)
                .map(([num, pts]) => ({ number: num, points: String(pts), type: session }));
            if (!toAdd.length) { showWarning('Please enter points for at least one Digit (00-99).'); return; }
            const count = addToCart(toAdd, gameType, title, betType);
            if (count > 0) showWarning(`Added ${count} bet(s) to cart ✓`);
            setSpecialInputs(Object.fromEntries(jodiNumbers.map((n) => [n, ''])));
        } else if (isPanaSumMode && validPanasForSumMode.length > 0) {
            // For pana sum mode, add any pending bids + any filled special inputs
            const fromInputs = Object.entries(specialInputs)
                .filter(([, pts]) => Number(pts) > 0)
                .map(([num, pts]) => ({ number: num, points: String(pts), type: session }));
            const allBids = [...pendingBids.map(b => ({ number: b.number, points: String(b.points), type: b.type })), ...fromInputs];
            if (!allBids.length) { showWarning(`Please enter points for at least one ${specialModeType === 'doublePana' ? 'Double Pana' : 'Single Pana'}.`); return; }
            const count = addToCart(allBids, gameType, title, betType);
            if (count > 0) showWarning(`Added ${count} bet(s) to cart ✓`);
            setPendingBids([]);
            setSpecialInputs(Object.fromEntries(validPanasForSumMode.map((n) => [n, ''])));
        }
    };

    const findPanaBySum = (targetNum) => {
        if (!isPanaSumMode || !validPanasForSumMode || validPanasForSumMode.length === 0) return [];
        const matches = [];
        for (const pana of validPanasForSumMode) {
            const digits = pana.split('').map(Number);
            const sum = digits[0] + digits[1] + digits[2];
            const unitPlace = sum % 10;
            if (sum === targetNum || unitPlace === targetNum) matches.push(pana);
        }
        return matches;
    };

    const handleKeypadClick = (num) => {
        if (!isPanaSumMode) return;
        const pts = Number(inputPoints);
        const matches = findPanaBySum(num);
        setSelectedSum(num);
        if (pts && pts > 0) {
            if (matches.length > 0) {
                // Accumulate into pending bids
                setPendingBids((prev) => {
                    const bidsMap = new Map(prev.map(b => [b.number, { ...b, points: Number(b.points) || 0 }]));
                    matches.forEach((pana) => {
                        if (bidsMap.has(pana)) {
                            const existing = bidsMap.get(pana);
                            existing.points = existing.points + pts;
                        } else {
                            bidsMap.set(pana, { id: Date.now() + Math.random(), number: pana, points: pts, type: session });
                        }
                    });
                    return Array.from(bidsMap.values());
                });
                showWarning(`Added ${matches.length} ${specialModeType === 'doublePana' ? 'double' : 'single'} pana numbers with sum ${num}`);
            } else {
                showWarning(`No valid ${specialModeType === 'doublePana' ? 'double' : 'single'} pana numbers found with sum ${num}`);
            }
        } else {
            if (matches.length > 0) showWarning(`Found ${matches.length} numbers with sum ${num}. Enter points to add them.`);
            else showWarning(`No valid numbers found with sum ${num}`);
        }
    };

    const handleNumberInputChange = (e) => {
        const val = e.target.value;
        const prevLen = (inputNumber ?? '').toString().length;
        const focusPointsIfComplete = (nextVal) => {
            if (!maxLength) return;
            const nextLen = (nextVal ?? '').toString().length;
            if (nextLen === maxLength && nextLen > prevLen) {
                const ok = isValid(nextVal);
                if (!ok) { showWarning(maxLength === 2 ? 'Invalid Digit. Use 00-99.' : 'Invalid number.'); return; }
                window.requestAnimationFrame(() => { pointsInputRef.current?.focus?.(); });
            }
        };
        if (maxLength === 1) {
            const digit = val.replace(/\D/g, '').slice(-1);
            setInputNumber(digit);
            focusPointsIfComplete(digit);
        } else if (maxLength === 2) {
            const twoDigits = val.replace(/\D/g, '').slice(0, 2);
            setInputNumber(twoDigits);
            focusPointsIfComplete(twoDigits);
        } else if (maxLength === 3) {
            const threeDigits = val.replace(/\D/g, '').slice(0, 3);
            setInputNumber(threeDigits);
            focusPointsIfComplete(threeDigits);
        } else {
            setInputNumber(val);
        }
    };

    const labelKey = label?.split(' ').pop() || 'Number';
    const todayDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
    const showInvalidNumberStyle = maxLength === 3;
    const isNumberComplete = !!inputNumber && (!!maxLength ? String(inputNumber).length === maxLength : true);
    const isNumberInvalid = showInvalidNumberStyle && isNumberComplete && !isValid(inputNumber);

    const pointsBySum = useMemo(() => {
        if (!isPanaSumMode || !validPanasForSumMode || validPanasForSumMode.length === 0) return {};
        const sumMap = {};
        for (let i = 0; i <= 9; i++) sumMap[i] = 0;
        pendingBids.forEach((bid) => {
            const pana = bid.number;
            if (validPanasForSumMode.includes(pana)) {
                const digits = pana.split('').map(Number);
                const sum = digits[0] + digits[1] + digits[2];
                const unitPlace = sum % 10;
                if (sum <= 9) sumMap[sum] = (sumMap[sum] || 0) + (Number(bid.points) || 0);
                else sumMap[unitPlace] = (sumMap[unitPlace] || 0) + (Number(bid.points) || 0);
            }
        });
        return sumMap;
    }, [pendingBids, isPanaSumMode, validPanasForSumMode]);

    const modeHeader = showModeTabs ? (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setActiveTab('easy')}
                    className={`min-h-[44px] py-3 rounded-lg font-bold text-sm shadow-sm border active:scale-[0.98] transition-colors ${activeTab === 'easy' ? 'bg-[#d4af37] text-[#4b3608] border-[#d4af37]' : 'bg-[#202124] text-gray-400 border-white/10 hover:border-[#d4af37]/50'}`}>
                    EASY MODE
                </button>
                <button type="button" onClick={() => setActiveTab('special')}
                    className={`min-h-[44px] py-3 rounded-lg font-bold text-sm shadow-sm border active:scale-[0.98] transition-colors ${activeTab === 'special' ? 'bg-[#d4af37] text-[#4b3608] border-[#d4af37]' : 'bg-[#202124] text-gray-400 border-white/10 hover:border-[#d4af37]/50'}`}>
                    SPECIAL MODE
                </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <input type="text" value={todayDate} readOnly className="w-full pl-12 py-3 sm:py-2.5 min-h-[44px] bg-[#202124] border border-white/10 text-white rounded-full text-sm font-bold text-center focus:outline-none" />
                </div>
                <div className="relative">
                    <select value={session} onChange={(e) => setSession(e.target.value)} disabled={isRunning || lockSessionToOpen}
                        className={`w-full appearance-none bg-[#202124] border border-white/10 text-white font-bold text-sm py-3 sm:py-2.5 min-h-[44px] px-4 rounded-full text-center focus:outline-none focus:border-[#d4af37] ${(isRunning || lockSessionToOpen) ? 'opacity-80 cursor-not-allowed' : ''}`}>
                        {lockSessionToOpen ? <option value="OPEN">OPEN</option> : isRunning ? <option value="CLOSE">CLOSE</option> : <><option value="OPEN">OPEN</option><option value="CLOSE">CLOSE</option></>}
                    </select>
                    {!lockSessionToOpen && (
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    )}
                </div>
            </div>
        </div>
    ) : null;

    const addToCartBtnClass = 'w-full bg-gradient-to-r from-[#d4af37] to-[#cca84d] text-[#4b3608] font-bold py-3.5 min-h-[48px] rounded-lg shadow-md hover:from-[#e5c04a] hover:to-[#d4af37] transition-all active:scale-[0.98]';

    return (
        <BookieBidLayout
            title={title}
            bidsCount={0}
            totalPoints={0}
            session={session}
            setSession={setSession}
            sessionOptionsOverride={lockSessionToOpen ? ['OPEN'] : null}
            lockSessionSelect={lockSessionToOpen}
            hideSessionSelectCaret={lockSessionToOpen}
            hideFooter
            showDateSession={true}
            selectedDate={selectedDate}
            setSelectedDate={handleDateChange}
            contentPaddingClass="pb-24"
        >
            <div className="px-3 sm:px-4 py-4 sm:py-2 md:max-w-7xl md:mx-auto">
                {showModeTabs && <div className="mb-4">{modeHeader}</div>}
                {warning && (
                    <div className="fixed top-16 sm:top-20 left-1/2 transform -translate-x-1/2 z-50 bg-black/95 border border-green-500/50 text-green-400 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium shadow-xl max-w-[calc(100%-2rem)] sm:max-w-md backdrop-blur-sm">
                        {warning}
                    </div>
                )}

                {showModeTabs && activeTab === 'special' ? (
                    <>
                        {specialModeType === 'jodi' ? (
                            <>
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 xl:grid-rows-10 xl:grid-flow-col xl:gap-2">
                                    {jodiNumbers.map((num) => (
                                        <div key={num} className="flex items-center gap-1.5">
                                            <div className="w-10 h-9 bg-[#202124] border border-white/10 text-[#f2c14e] flex items-center justify-center rounded-l-md font-bold text-xs shrink-0">
                                                <span className="inline-flex items-center gap-1"><span>{num[0]}</span><span>{num[1]}</span></span>
                                            </div>
                                            <input type="number" min="0" placeholder="Pts" value={specialInputs[num] || ''}
                                                onChange={(e) => setSpecialInputs((p) => ({ ...p, [num]: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                                                className="w-full h-9 bg-[#202124] border border-white/10 text-white placeholder-gray-500 rounded-r-md focus:outline-none focus:border-[#d4af37] px-2 text-xs font-semibold" />
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4">
                                    <button type="button" onClick={handleAddSpecialToCart} className={addToCartBtnClass}>
                                        Add to Cart
                                    </button>
                                </div>
                            </>
                        ) : isPanaSumMode && validPanasForSumMode.length > 0 ? (
                            <>
                                <div className="flex flex-col gap-3 mb-4">
                                    <div className="flex flex-row items-center gap-2">
                                        <label className="text-gray-400 text-sm font-medium shrink-0 w-32">Select Game Type:</label>
                                        <div className="flex-1 min-w-0 bg-[#202124] border border-white/10 rounded-full py-2.5 min-h-[40px] px-4 flex items-center justify-center text-sm font-bold text-white">{session}</div>
                                    </div>
                                    <div className="flex flex-row items-center gap-2">
                                        <label className="text-gray-400 text-sm font-medium shrink-0 w-32">Enter Points:</label>
                                        <input ref={pointsInputRef} type="text" inputMode="numeric" value={inputPoints}
                                            onChange={(e) => setInputPoints(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            placeholder="Point" className="no-spinner flex-1 min-w-0 bg-[#202124] border border-white/10 text-white placeholder-gray-500 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm focus:ring-2 focus:ring-[#d4af37] focus:border-[#d4af37] focus:outline-none" />
                                    </div>
                                </div>
                                <div className="flex gap-4 mb-4">
                                    <div className="flex-1 bg-[#202124] border border-white/10 rounded-xl p-2">
                                        <h3 className="text-sm font-bold text-[#f2c14e] mb-3 text-center">Select Sum</h3>
                                        <div className="grid grid-cols-5 sm:grid-cols-5 gap-1.5 sm:gap-2 md:gap-3">
                                            {[0,1,2,3,4,5,6,7,8,9].map((num) => {
                                                const totalPointsForSum = pointsBySum[num] || 0;
                                                const hasPoints = Number(inputPoints) > 0;
                                                return (
                                                    <button key={num} type="button" disabled={!hasPoints}
                                                        onClick={(e) => { if (!hasPoints) return; e.preventDefault(); e.stopPropagation(); handleKeypadClick(num); }}
                                                        className={`relative aspect-square min-h-[40px] sm:min-h-[44px] text-white rounded-lg font-bold text-sm flex items-center justify-center transition-all active:scale-90 shadow-lg select-none bg-[#2a2d32] border-2 border-white/10 ${hasPoints ? 'cursor-pointer hover:border-[#d4af37]/60' : 'cursor-not-allowed opacity-50'}`}
                                                        style={{ touchAction: 'manipulation' }}>
                                                        {num}
                                                        {totalPointsForSum > 0 && (
                                                            <span className="absolute top-0.5 right-0.5 bg-[#d4af37] text-[#4b3608] text-[8px] font-bold rounded-full min-w-[14px] h-3.5 px-0.5 flex items-center justify-center shadow-md">
                                                                {totalPointsForSum > 999 ? '999+' : totalPointsForSum}
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="flex items-center">
                                        <button type="button"
                                            disabled={pendingBids.length === 0}
                                            onClick={handleAddSpecialToCart}
                                            className={`py-3 px-6 bg-gradient-to-r from-[#d4af37] to-[#cca84d] text-[#4b3608] font-bold rounded-xl shadow-md transition-all active:scale-[0.98] ${
                                                pendingBids.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                                            }`}>
                                            Add to Cart
                                        </button>
                                    </div>
                                </div>
                                {/* Show pending pana bids count */}
                                {pendingBids.length > 0 && (
                                    <div className="text-sm text-gray-400 text-center">
                                        {pendingBids.length} pana bet(s) ready to add to cart
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="bg-[#202124] border border-white/10 rounded-2xl p-4 text-center text-gray-300">
                                <div className="text-white font-semibold mb-1">Special Mode</div>
                                <div className="text-sm text-gray-400">This bet type uses Easy Mode only.</div>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <div className="flex flex-col gap-3 mb-4">
                            <div className="flex flex-row items-center gap-2">
                                <label className="text-gray-400 text-sm font-medium shrink-0 w-32">Select Game Type:</label>
                                <div className="flex-1 min-w-0 bg-[#202124] border border-white/10 rounded-full py-2.5 min-h-[40px] px-4 flex items-center justify-center text-sm font-bold text-white">{session}</div>
                            </div>
                            <div className="flex flex-row items-center gap-2">
                                <label className="text-gray-400 text-sm font-medium shrink-0 w-32">{label}:</label>
                                <input type={maxLength === 1 || maxLength === 2 ? 'text' : 'number'} inputMode="numeric" value={inputNumber}
                                    onChange={handleNumberInputChange} placeholder={labelKey} maxLength={maxLength}
                                    className={`flex-1 min-w-0 bg-[#202124] border border-white/10 text-white placeholder-gray-500 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm focus:ring-2 focus:outline-none ${
                                        isNumberInvalid ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'focus:ring-[#d4af37] focus:border-[#d4af37]'}`} />
                            </div>
                            <div className="flex flex-row items-center gap-2">
                                <label className="text-gray-400 text-sm font-medium shrink-0 w-32">Enter Points:</label>
                                <input ref={pointsInputRef} type="text" inputMode="numeric" value={inputPoints}
                                    onChange={(e) => setInputPoints(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="Point" className="no-spinner flex-1 min-w-0 bg-[#202124] border border-white/10 text-white placeholder-gray-500 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm focus:ring-2 focus:ring-[#d4af37] focus:border-[#d4af37] focus:outline-none" />
                            </div>
                        </div>
                        <button type="button" onClick={handleAddToCart} className={addToCartBtnClass}>
                            Add to Cart
                        </button>
                    </>
                )}
            </div>
        </BookieBidLayout>
    );
};

export default EasyModeBid;
