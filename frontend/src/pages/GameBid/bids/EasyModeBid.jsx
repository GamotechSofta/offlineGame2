import React, { useEffect, useMemo, useState } from 'react';
import BidLayout from '../BidLayout';
import BidReviewModal from './BidReviewModal';

const EasyModeBid = ({
    market,
    title,
    label,
    maxLength = 3,
    validateInput,
    showBidsList = false,
    openReviewOnAdd = true,
    showFooterSubmit = false,
    showInlineSubmit = false,
    showModeTabs = false,
    specialModeType = null, // 'jodi' | 'doublePana'
    desktopSplit = false,
    validDoublePanas = [],
}) => {
    const [activeTab, setActiveTab] = useState('easy'); // easy | special
    const [session, setSession] = useState(() => (market?.status === 'running' ? 'CLOSE' : 'OPEN'));
    const [bids, setBids] = useState([]);
    const [reviewRows, setReviewRows] = useState([]);
    const [inputNumber, setInputNumber] = useState('');
    const [inputPoints, setInputPoints] = useState('');
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [warning, setWarning] = useState('');
    const [matchingPanas, setMatchingPanas] = useState([]);
    const [selectedSum, setSelectedSum] = useState(null);
    const showWarning = (msg) => {
        setWarning(msg);
        window.clearTimeout(showWarning._t);
        showWarning._t = window.setTimeout(() => setWarning(''), 2200);
    };

    const isRunning = market?.status === 'running'; // "CLOSED IS RUNNING"
    useEffect(() => {
        if (isRunning) setSession('CLOSE');
    }, [isRunning]);

    const jodiNumbers = useMemo(
        () => Array.from({ length: 100 }, (_, i) => String(i).padStart(2, '0')),
        []
    );
    const [specialInputs, setSpecialInputs] = useState(() => {
        if (specialModeType === 'jodi') {
            return Object.fromEntries(Array.from({ length: 100 }, (_, i) => [String(i).padStart(2, '0'), '']));
        } else if (specialModeType === 'doublePana' && validDoublePanas && validDoublePanas.length > 0) {
            return Object.fromEntries(validDoublePanas.map(pana => [pana, '']));
        }
        return {};
    });

    const defaultValidate = (n) => {
        if (!n || !n.toString().trim()) return false;
        return true;
    };
    const isValid = validateInput || defaultValidate;

    const handleAddBid = () => {
        const pts = Number(inputPoints);
        const n = inputNumber?.toString().trim() || '';

        if (!pts || pts <= 0) {
            showWarning('Please enter points.');
            return;
        }

        if (!n) {
            showWarning(maxLength === 2 ? 'Please enter Jodi (00-99).' : `Please enter ${labelKey}.`);
            return;
        }

        // Jodi specific: must be exactly 2 digits (00-99)
        if (maxLength === 2 && n.length !== 2) {
            showWarning('Please enter 2-digit Jodi (00-99).');
            return;
        }

        if (!isValid(n)) {
            showWarning(maxLength === 2 ? 'Invalid Jodi. Use 00-99.' : 'Invalid number.');
            return;
        }

        const next = [...bids, { id: Date.now(), number: inputNumber.toString().trim(), points: inputPoints, type: session }];
        setBids(next);
        setInputNumber('');
        setInputPoints('');
        if (openReviewOnAdd) {
            setReviewRows(next);
            setIsReviewOpen(true);
        }
    };

    const handleDeleteBid = (id) => setBids((prev) => prev.filter((b) => b.id !== id));

    const handleAddSpecialToList = () => {
        if (specialModeType !== 'jodi' && specialModeType !== 'doublePana') return;
        const toAdd = Object.entries(specialInputs)
            .filter(([, pts]) => Number(pts) > 0)
            .map(([num, pts]) => ({
                id: Date.now() + Number(num) + Math.random(),
                number: num,
                points: String(pts),
                type: session,
            }));
        if (!toAdd.length) {
            const label = specialModeType === 'jodi' ? 'Jodi (00-99)' : 'Double Pana';
            showWarning(`Please enter points for at least one ${label}.`);
            return;
        }
        setBids((prev) => [...prev, ...toAdd]);
        if (specialModeType === 'jodi') {
            setSpecialInputs(Object.fromEntries(jodiNumbers.map((n) => [n, ''])));
        } else if (specialModeType === 'doublePana' && validDoublePanas.length > 0) {
            setSpecialInputs(Object.fromEntries(validDoublePanas.map((n) => [n, ''])));
        }
    };

    const handleSubmitFromSpecial = () => {
        if (specialModeType !== 'jodi' && specialModeType !== 'doublePana') return;
        const toAdd = Object.entries(specialInputs)
            .filter(([, pts]) => Number(pts) > 0)
            .map(([num, pts]) => ({
                id: Date.now() + Number(num) + Math.random(),
                number: num,
                points: String(pts),
                type: session,
            }));

        if (!toAdd.length && bids.length === 0) {
            const label = specialModeType === 'jodi' ? 'Jodi (00-99)' : 'Double Pana';
            showWarning(`Please enter points for at least one ${label}.`);
            return;
        }

        const next = [...bids, ...toAdd];
        setBids(next);
        setReviewRows(next);
        setIsReviewOpen(true);
        if (specialModeType === 'jodi') {
            setSpecialInputs(Object.fromEntries(jodiNumbers.map((n) => [n, ''])));
        } else if (specialModeType === 'doublePana' && validDoublePanas.length > 0) {
            setSpecialInputs(Object.fromEntries(validDoublePanas.map((n) => [n, ''])));
        }
    };

    // Find all double pana numbers whose digit sum matches the target (or unit place matches)
    const findDoublePanaBySum = (targetNum) => {
        if (specialModeType !== 'doublePana' || !validDoublePanas || validDoublePanas.length === 0) return [];
        const matches = [];
        for (const pana of validDoublePanas) {
            const digits = pana.split('').map(Number);
            const sum = digits[0] + digits[1] + digits[2];
            // Check if sum equals target, or if unit place of sum equals target
            const unitPlace = sum % 10;
            if (sum === targetNum || unitPlace === targetNum) {
                matches.push(pana);
            }
        }
        return matches;
    };

    const handleKeypadClick = (num) => {
        if (specialModeType !== 'doublePana') return;
        const pts = Number(inputPoints);
        
        // Find all matching double pana numbers
        const matches = findDoublePanaBySum(num);
        setMatchingPanas(matches);
        setSelectedSum(num);
        
        // If points are entered, add all matching numbers to bids (increase points if already exists)
        if (pts && pts > 0) {
            if (matches.length > 0) {
                setBids((prev) => {
                    const bidsMap = new Map(prev.map(b => [b.number, { ...b, points: Number(b.points) || 0 }]));
                    
                    // For each matching pana, either add new bid or increase points
                    matches.forEach((pana) => {
                        if (bidsMap.has(pana)) {
                            // Increase points for existing bid
                            const existingBid = bidsMap.get(pana);
                            existingBid.points = existingBid.points + pts;
                            existingBid.points = String(existingBid.points);
                        } else {
                            // Add new bid
                            bidsMap.set(pana, {
                                id: Date.now() + Math.random() + Math.random() * matches.indexOf(pana),
                                number: pana,
                                points: String(pts),
                                type: session
                            });
                        }
                    });
                    
                    return Array.from(bidsMap.values());
                });
                showWarning(`Added ${matches.length} double pana numbers with sum ${num}`);
            } else {
                showWarning(`No valid double pana numbers found with sum ${num}`);
            }
        } else {
            // If no points, just show the matching numbers
            if (matches.length > 0) {
                showWarning(`Found ${matches.length} double pana numbers with sum ${num}. Enter points to add them.`);
            } else {
                showWarning(`No valid double pana numbers found with sum ${num}`);
            }
        }
    };

    const walletBefore = useMemo(() => {
        try {
            const u = JSON.parse(localStorage.getItem('user') || 'null');
            const val =
                u?.wallet ||
                u?.balance ||
                u?.points ||
                u?.walletAmount ||
                u?.wallet_amount ||
                u?.amount ||
                0;
            const n = Number(val);
            return Number.isFinite(n) ? n : 0;
        } catch (e) {
            return 0;
        }
    }, []);

    const handleNumberInputChange = (e) => {
        const val = e.target.value;
        if (maxLength === 1) {
            const digit = val.replace(/\D/g, '').slice(-1);
            setInputNumber(digit);
        } else if (maxLength === 2) {
            // Allow only 2 digits (00-99) and keep leading zeros
            const twoDigits = val.replace(/\D/g, '').slice(0, 2);
            setInputNumber(twoDigits);
        } else if (maxLength === 3) {
            // Allow only 3 digits
            const threeDigits = val.replace(/\D/g, '').slice(0, 3);
            setInputNumber(threeDigits);
        } else {
            setInputNumber(val);
        }
    };

    const totalPoints = bids.reduce((sum, b) => sum + Number(b.points), 0);
    const labelKey = label?.split(' ').pop() || 'Number';
    const dateText = new Date().toLocaleDateString('en-GB'); // dd/mm/yyyy
    const marketTitle = market?.gameName || market?.marketName || title;
    const todayDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');

    // Calculate total points betted for each sum number (0-9)
    const pointsBySum = useMemo(() => {
        if (specialModeType !== 'doublePana' || !validDoublePanas || validDoublePanas.length === 0) {
            return Object.fromEntries(Array.from({ length: 10 }, (_, d) => [d, 0]));
        }
        
        const pointsMap = Object.fromEntries(Array.from({ length: 10 }, (_, d) => [d, 0]));
        const bidsMap = new Map(bids.map(b => [b.number, Number(b.points) || 0]));
        
        // For each sum number (0-9), find matching panas and sum their points
        for (let targetNum = 0; targetNum < 10; targetNum++) {
            let totalPoints = 0;
            // Find matching panas (same logic as findDoublePanaBySum)
            for (const pana of validDoublePanas) {
                const digits = pana.split('').map(Number);
                const sum = digits[0] + digits[1] + digits[2];
                const unitPlace = sum % 10;
                if (sum === targetNum || unitPlace === targetNum) {
                    totalPoints += bidsMap.get(pana) || 0;
                }
            }
            pointsMap[targetNum] = totalPoints;
        }
        
        return pointsMap;
    }, [bids, validDoublePanas, specialModeType]);

    const submitBtnClass = (enabled) =>
        enabled
            ? 'w-full bg-gradient-to-r from-[#d4af37] to-[#cca84d] text-[#4b3608] font-bold py-3.5 min-h-[48px] rounded-lg shadow-md hover:from-[#e5c04a] hover:to-[#d4af37] transition-all active:scale-[0.98]'
            : 'w-full bg-gradient-to-r from-[#d4af37] to-[#cca84d] text-[#4b3608] font-bold py-3.5 min-h-[48px] rounded-lg shadow-md opacity-50 cursor-not-allowed';

    const modeHeader = showModeTabs ? (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
                <button
                    type="button"
                    onClick={() => setActiveTab('easy')}
                    className={`min-h-[44px] py-3 rounded-lg font-bold text-sm shadow-sm border active:scale-[0.98] transition-colors ${
                        activeTab === 'easy'
                            ? 'bg-[#d4af37] text-[#4b3608] border-[#d4af37]'
                            : 'bg-[#202124] text-gray-400 border-white/10 hover:border-[#d4af37]/50'
                    }`}
                >
                    EASY MODE
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('special')}
                    className={`min-h-[44px] py-3 rounded-lg font-bold text-sm shadow-sm border active:scale-[0.98] transition-colors ${
                        activeTab === 'special'
                            ? 'bg-[#d4af37] text-[#4b3608] border-[#d4af37]'
                            : 'bg-[#202124] text-gray-400 border-white/10 hover:border-[#d4af37]/50'
                    }`}
                >
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
                    <input
                        type="text"
                        value={todayDate}
                        readOnly
                        className="w-full pl-10 py-3 sm:py-2.5 min-h-[44px] bg-[#202124] border border-white/10 text-white rounded-full text-sm font-bold text-center focus:outline-none"
                    />
                </div>
                <div className="relative">
                    <select
                        value={session}
                        onChange={(e) => setSession(e.target.value)}
                        disabled={isRunning}
                        className={`w-full appearance-none bg-[#202124] border border-white/10 text-white font-bold text-sm py-3 sm:py-2.5 min-h-[44px] px-4 rounded-full text-center focus:outline-none focus:border-[#d4af37] ${isRunning ? 'opacity-80 cursor-not-allowed' : ''}`}
                    >
                        {isRunning ? (
                            <option value="CLOSE">CLOSE</option>
                        ) : (
                            <>
                                <option value="OPEN">OPEN</option>
                                <option value="CLOSE">CLOSE</option>
                            </>
                        )}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    ) : null;

    const bidsList = showBidsList ? (
        <>
            <div className="grid grid-cols-4 gap-1 sm:gap-2 text-center text-[#d4af37] font-bold text-[10px] sm:text-xs md:text-sm mb-2 px-1">
                <div className="truncate">{labelKey}</div>
                <div className="truncate">Point</div>
                <div className="truncate">Type</div>
                <div className="truncate">Delete</div>
            </div>
            <div className="h-px bg-white/10 w-full mb-2"></div>
            <div className="space-y-1.5 sm:space-y-2 max-h-[400px] sm:max-h-[500px] overflow-y-auto custom-scrollbar pb-20 md:pb-0">
                {bids.map((bid) => (
                    <div
                        key={bid.id}
                        className="grid grid-cols-4 gap-1 sm:gap-2 text-center items-center py-2 sm:py-2.5 px-1.5 sm:px-2 bg-[#202124] rounded-lg border border-white/10 text-xs sm:text-sm"
                    >
                        <div className="font-bold text-white truncate">{bid.number}</div>
                        <div className="font-bold text-[#f2c14e] truncate">{bid.points}</div>
                        <div className="text-xs sm:text-sm text-gray-400 truncate">{bid.type}</div>
                        <div className="flex justify-center">
                            <button
                                type="button"
                                onClick={() => handleDeleteBid(bid.id)}
                                className="p-1.5 sm:p-2 text-red-400 hover:text-red-300 active:scale-95 transition-transform"
                                aria-label="Delete"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path
                                        fillRule="evenodd"
                                        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </>
    ) : null;

    const clearAll = () => {
        setBids([]);
        setInputNumber('');
        setInputPoints('');
        setMatchingPanas([]);
        setSelectedSum(null);
        if (specialModeType === 'jodi') {
            setSpecialInputs(Object.fromEntries(jodiNumbers.map((n) => [n, ''])));
        } else if (specialModeType === 'doublePana' && validDoublePanas.length > 0) {
            setSpecialInputs(Object.fromEntries(validDoublePanas.map((n) => [n, ''])));
        }
    };

    const handleCancelBet = () => {
        setIsReviewOpen(false);
        clearAll();
    };

    const handleSubmitBet = () => {
        // Integrate API later. For now, close modal and clear current bets.
        setIsReviewOpen(false);
        clearAll();
    };

    return (
        <BidLayout
            market={market}
            title={title}
            bidsCount={bids.length}
            totalPoints={totalPoints}
            session={session}
            setSession={setSession}
            hideFooter={!showFooterSubmit}
            walletBalance={walletBefore}
            onSubmit={() => {
                setReviewRows(bids);
                setIsReviewOpen(true);
            }}
            showDateSession={!showModeTabs}
            extraHeader={null}
        >
            <div className="px-3 sm:px-4 py-4 sm:py-2 md:max-w-7xl md:mx-auto">
                {showModeTabs && !desktopSplit && <div className="mb-4">{modeHeader}</div>}
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
                                                {num}
                                            </div>
                                            <input
                                                type="number"
                                                min="0"
                                                placeholder="Pts"
                                                value={specialInputs[num] || ''}
                                                onChange={(e) =>
                                                    setSpecialInputs((p) => ({
                                                        ...p,
                                                        [num]: e.target.value.replace(/\D/g, '').slice(0, 6),
                                                    }))
                                                }
                                                className="w-full h-9 bg-[#202124] border border-white/10 text-white placeholder-gray-500 rounded-r-md focus:outline-none focus:border-[#d4af37] px-2 text-xs font-semibold"
                                            />
                                        </div>
                                    ))}
                                </div>
                                {/* Mobile-only spacer so sticky button doesn't overlap last row */}
                                {showInlineSubmit && (
                                    <div className="md:hidden h-24" />
                                )}
                            </>
                        ) : specialModeType === 'doublePana' && validDoublePanas.length > 0 ? (
                            <>
                                <div className={desktopSplit ? 'md:grid md:grid-cols-2 md:gap-6 md:items-start' : ''}>
                                    <div>
                                        {showModeTabs && desktopSplit && <div className="mb-4">{modeHeader}</div>}

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-4">
                                            <div className="flex items-center gap-2">
                                                <label className="text-gray-400 text-xs sm:text-sm font-medium shrink-0 w-20 sm:w-24">Game Type:</label>
                                                <div className="flex-1 min-w-0 bg-[#202124] border border-white/10 rounded-lg py-1.5 sm:py-2 min-h-[36px] sm:min-h-[40px] px-2 sm:px-3 flex items-center justify-center text-xs sm:text-sm font-bold text-white">
                                                    {session}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <label className="text-gray-400 text-xs sm:text-sm font-medium shrink-0 w-20 sm:w-24">Points:</label>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={inputPoints}
                                                    onChange={(e) => setInputPoints(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                    placeholder="Enter"
                                                    className="no-spinner flex-1 min-w-0 bg-[#202124] border border-white/10 text-white placeholder-gray-500 rounded-lg py-1.5 sm:py-2 min-h-[36px] sm:min-h-[40px] px-2 sm:px-3 text-center text-xs sm:text-sm focus:ring-2 focus:ring-[#d4af37] focus:border-[#d4af37] focus:outline-none"
                                                />
                                            </div>
                                        </div>

                                        {/* Select Sum Keypad with Submit Button - Responsive */}
                                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4">
                                            <div className="flex-1 bg-[#202124] border border-white/10 rounded-xl p-3 sm:p-4">
                                                <h3 className="text-sm sm:text-base font-bold text-[#f2c14e] mb-3 sm:mb-4 text-center">Select Sum</h3>
                                                <div className="grid grid-cols-5 sm:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
                                                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
                                                        const totalPointsForSum = pointsBySum[num] || 0;
                                                        const hasPoints = Number(inputPoints) > 0;
                                                        return (
                                                            <button
                                                                key={num}
                                                                type="button"
                                                                disabled={!hasPoints}
                                                                onClick={(e) => {
                                                                    if (!hasPoints) return;
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    handleKeypadClick(num);
                                                                }}
                                                                onTouchStart={(e) => {
                                                                    if (!hasPoints) return;
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    handleKeypadClick(num);
                                                                }}
                                                                className={`relative aspect-square min-h-[44px] sm:min-h-[50px] md:min-h-[56px] text-white rounded-lg sm:rounded-xl font-bold text-base sm:text-lg flex items-center justify-center transition-all active:scale-90 shadow-lg select-none bg-[#2a2d32] border-2 border-white/10 ${
                                                                    hasPoints 
                                                                        ? 'cursor-pointer hover:border-[#d4af37]/60 hover:bg-[#2a2d32]/80 active:bg-[#2a2d32]' 
                                                                        : 'cursor-not-allowed opacity-50'
                                                                }`}
                                                                style={{ 
                                                                    touchAction: 'manipulation',
                                                                    WebkitTapHighlightColor: 'transparent',
                                                                    userSelect: 'none',
                                                                    WebkitUserSelect: 'none'
                                                                }}
                                                            >
                                                                {num}
                                                                {totalPointsForSum > 0 && (
                                                                    <span className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 bg-[#d4af37] text-[#4b3608] text-[9px] sm:text-[10px] font-bold rounded-full min-w-[16px] sm:min-w-[18px] h-4 sm:h-4.5 px-1 sm:px-1.5 flex items-center justify-center shadow-md">
                                                                        {totalPointsForSum > 999 ? '999+' : totalPointsForSum}
                                                                    </span>
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            <div className="hidden md:flex items-center justify-center sm:justify-start">
                                                <button
                                                    type="button"
                                                    disabled={
                                                        (specialModeType === 'jodi' || specialModeType === 'doublePana')
                                                            ? bids.length === 0 && !Object.values(specialInputs).some((v) => Number(v) > 0)
                                                            : !bids.length
                                                    }
                                                    onClick={(specialModeType === 'jodi' || specialModeType === 'doublePana') ? handleSubmitFromSpecial : () => { setReviewRows(bids); setIsReviewOpen(true); }}
                                                    className={`w-full sm:w-auto py-3 px-4 sm:px-6 bg-gradient-to-r from-[#d4af37] to-[#cca84d] text-[#4b3608] font-bold rounded-lg sm:rounded-xl shadow-md hover:from-[#e5c04a] hover:to-[#d4af37] transition-all active:scale-[0.98] text-sm sm:text-base ${
                                                        (specialModeType === 'jodi' || specialModeType === 'doublePana')
                                                            ? (bids.length === 0 && !Object.values(specialInputs).some((v) => Number(v) > 0))
                                                                ? 'opacity-50 cursor-not-allowed'
                                                                : ''
                                                            : !bids.length
                                                                ? 'opacity-50 cursor-not-allowed'
                                                                : ''
                                                    }`}
                                                >
                                                    Submit Bet
                                                </button>
                                            </div>
                                        </div>

                                        {/* Mobile: keep list below on small screens */}
                                        {desktopSplit && <div className="md:hidden mt-4">{bidsList}</div>}
                                        {!desktopSplit && bidsList}
                                    </div>

                                    {/* Desktop: list on right side */}
                                    {desktopSplit && <div className="hidden md:block">{bidsList}</div>}
                                </div>
                            </>
                        ) : (
                            <div className="bg-[#202124] border border-white/10 rounded-2xl p-4 text-center text-gray-300">
                                <div className="text-white font-semibold mb-1">Special Mode</div>
                                <div className="text-sm text-gray-400">This bet type uses Easy Mode only.</div>
                            </div>
                        )}

                        {showInlineSubmit && (
                            <>
                                {/* Mobile sticky submit above bottom navbar */}
                                <div className="md:hidden fixed left-0 right-0 bottom-[88px] z-20 px-3">
                                    {(() => {
                                        const enabled =
                                            (specialModeType === 'jodi' || specialModeType === 'doublePana')
                                                ? bids.length > 0 || Object.values(specialInputs).some((v) => Number(v) > 0)
                                                : bids.length > 0;
                                        return (
                                    <button
                                        type="button"
                                        disabled={
                                            (specialModeType === 'jodi' || specialModeType === 'doublePana')
                                                ? bids.length === 0 && !Object.values(specialInputs).some((v) => Number(v) > 0)
                                                : !bids.length
                                        }
                                        onClick={(specialModeType === 'jodi' || specialModeType === 'doublePana') ? handleSubmitFromSpecial : () => { setReviewRows(bids); setIsReviewOpen(true); }}
                                        className={submitBtnClass(enabled)}
                                    >
                                        Submit Bet
                                    </button>
                                        );
                                    })()}
                                </div>

                                {/* Desktop/Tablet inline submit */}
                                <div className="hidden md:block mt-4">
                                    {(() => {
                                        const enabled =
                                            (specialModeType === 'jodi' || specialModeType === 'doublePana')
                                                ? bids.length > 0 || Object.values(specialInputs).some((v) => Number(v) > 0)
                                                : bids.length > 0;
                                        return (
                                    <button
                                        type="button"
                                        disabled={
                                            (specialModeType === 'jodi' || specialModeType === 'doublePana')
                                                ? bids.length === 0 && !Object.values(specialInputs).some((v) => Number(v) > 0)
                                                : !bids.length
                                        }
                                        onClick={(specialModeType === 'jodi' || specialModeType === 'doublePana') ? handleSubmitFromSpecial : () => { setReviewRows(bids); setIsReviewOpen(true); }}
                                        className={submitBtnClass(enabled)}
                                    >
                                        Submit Bet
                                    </button>
                                        );
                                    })()}
                                </div>
                            </>
                        )}
                    </>
                ) : (
                    <>
                        <div className={desktopSplit ? 'md:grid md:grid-cols-2 md:gap-6 md:items-start' : ''}>
                            <div>
                                {showModeTabs && desktopSplit && <div className="mb-4">{modeHeader}</div>}

                <div className="flex flex-col gap-3 mb-4">
                    <div className="flex flex-row items-center gap-2">
                        <label className="text-gray-400 text-sm font-medium shrink-0 w-32">Select Game Type:</label>
                                        <div className="flex-1 min-w-0 bg-[#202124] border border-white/10 rounded-full py-2.5 min-h-[40px] px-4 flex items-center justify-center text-sm font-bold text-white">
                                            {session}
                                        </div>
                    </div>
                    <div className="flex flex-row items-center gap-2">
                        <label className="text-gray-400 text-sm font-medium shrink-0 w-32">{label}:</label>
                        <input
                                            type={maxLength === 1 || maxLength === 2 ? 'text' : 'number'}
                            inputMode="numeric"
                            value={inputNumber}
                            onChange={handleNumberInputChange}
                            placeholder={labelKey}
                            maxLength={maxLength}
                            className="flex-1 min-w-0 bg-[#202124] border border-white/10 text-white placeholder-gray-500 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm focus:ring-2 focus:ring-[#d4af37] focus:border-[#d4af37] focus:outline-none"
                        />
                    </div>
                    <div className="flex flex-row items-center gap-2">
                        <label className="text-gray-400 text-sm font-medium shrink-0 w-32">Enter Points:</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={inputPoints}
                                            onChange={(e) => setInputPoints(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            placeholder="Point"
                                            className="no-spinner flex-1 min-w-0 bg-[#202124] border border-white/10 text-white placeholder-gray-500 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm focus:ring-2 focus:ring-[#d4af37] focus:border-[#d4af37] focus:outline-none"
                                        />
                    </div>
                </div>

                                <button
                                    onClick={handleAddBid}
                                    className="w-full bg-gradient-to-r from-[#d4af37] to-[#cca84d] text-[#4b3608] font-bold py-3.5 min-h-[48px] rounded-lg shadow-md hover:from-[#e5c04a] hover:to-[#d4af37] transition-all active:scale-[0.98] mb-5 sm:mb-6"
                                >
                                    Add to List
                                </button>

                                {showInlineSubmit && (
                                    <button
                                        type="button"
                                        disabled={!bids.length}
                                        onClick={() => { setReviewRows(bids); setIsReviewOpen(true); }}
                                        className={`mb-5 sm:mb-6 ${submitBtnClass(!!bids.length)}`}
                                    >
                                        Submit Bet
                                    </button>
                                )}

                                {/* Mobile: keep list below on small screens */}
                                {desktopSplit && <div className="md:hidden">{bidsList}</div>}
                                {!desktopSplit && bidsList}
                            </div>

                            {/* Desktop: list on right side */}
                            {desktopSplit && <div className="hidden md:block">{bidsList}</div>}
                        </div>
                    </>
                )}
            </div>

            <BidReviewModal
                open={isReviewOpen}
                onClose={handleCancelBet}
                onSubmit={handleSubmitBet}
                marketTitle={marketTitle}
                dateText={dateText}
                labelKey={labelKey}
                rows={bids}
                walletBefore={walletBefore}
                totalBids={bids.length}
                totalAmount={totalPoints}
            />
        </BidLayout>
    );
};

export default EasyModeBid;
