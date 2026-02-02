import React, { useEffect, useMemo, useState } from 'react';
import BidLayout from '../BidLayout';
import BidReviewModal from './BidReviewModal';

const validatePana = (n) => {
    if (!n) return false;
    const str = n.toString().trim();
    
    // Must be exactly 3 digits
    if (!/^[0-9]{3}$/.test(str)) return false;
    
    const digits = str.split('').map(Number);
    const [first, second, third] = digits;
    
    // Two consecutive digits must be the same (positions 0-1 or 1-2)
    const hasConsecutiveSame = (first === second) || (second === third);
    if (!hasConsecutiveSame) return false;
    
    // Special case: Two zeros at the start are not allowed (001-009)
    if (first === 0 && second === 0) {
        return false; // All numbers starting with 00 are disallowed
    }
    
    // Special case: Two zeros at the end are allowed (300, 900, 100)
    // For these cases, third (0) is not > first, but they're explicitly allowed
    if (second === 0 && third === 0) {
        return true;
    }
    
    // Special case: Numbers ending with zero where first two digits are the same (220, 990, 880, 660)
    if (first === second && third === 0) {
        return true;
    }
    
    // For all other cases, last digit must be greater than first
    if (third <= first) return false;
    
    return true;
};

const DoublePanaBulkBid = ({ market, title }) => {
    const [session, setSession] = useState(() => (market?.status === 'running' ? 'CLOSE' : 'OPEN'));
    const [inputPana, setInputPana] = useState('');
    const [inputPoints, setInputPoints] = useState('');
    const [bids, setBids] = useState([]);
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [warning, setWarning] = useState('');
    const [matchingPanas, setMatchingPanas] = useState([]);
    const [selectedSum, setSelectedSum] = useState(null);
    
    const showWarning = (msg) => {
        setWarning(msg);
        window.clearTimeout(showWarning._t);
        showWarning._t = window.setTimeout(() => setWarning(''), 2200);
    };

    const isRunning = market?.status === 'running';
    useEffect(() => {
        if (isRunning) setSession('CLOSE');
    }, [isRunning]);

    // Generate all valid double pana numbers
    const getAllValidDoublePana = useMemo(() => {
        const validPanas = [];
        for (let i = 0; i <= 999; i++) {
            const str = String(i).padStart(3, '0');
            if (validatePana(str)) {
                validPanas.push(str);
            }
        }
        return validPanas;
    }, []);

    // Find all double pana numbers whose digit sum matches the target (or unit place matches)
    const findDoublePanaBySum = (targetNum) => {
        const matches = [];
        for (const pana of getAllValidDoublePana) {
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
        const pts = Number(inputPoints);
        
        // Find all matching double pana numbers
        const matches = findDoublePanaBySum(num);
        setMatchingPanas(matches);
        setSelectedSum(num);
        
        // If points are entered, add all matching numbers to bids (avoid duplicates)
        if (pts && pts > 0) {
            if (matches.length > 0) {
                setBids((prev) => {
                    const existingNumbers = new Set(prev.map(b => b.number));
                    const newBids = matches
                        .filter(pana => !existingNumbers.has(pana))
                        .map((pana) => ({
                            id: Date.now() + Math.random() + Math.random() * matches.indexOf(pana),
                            number: pana,
                            points: String(pts),
                            type: session
                        }));
                    const addedCount = newBids.length;
                    if (addedCount > 0) {
                        showWarning(`Added ${addedCount} double pana numbers with sum ${num}${addedCount < matches.length ? ` (${matches.length - addedCount} already in list)` : ''}`);
                    } else {
                        showWarning(`All ${matches.length} double pana numbers with sum ${num} are already in the list`);
                    }
                    return [...prev, ...newBids];
                });
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

    const handleAddBid = (panaValue = null, pointsValue = null) => {
        const pana = (panaValue || inputPana).toString().trim();
        const pts = Number(pointsValue || inputPoints);

        if (!pts || pts <= 0) {
            showWarning('Please enter points.');
            return;
        }

        if (!pana || pana.length !== 3) {
            showWarning('Please enter a 3-digit Pana.');
            return;
        }

        if (!validatePana(pana)) {
            showWarning('Invalid Pana. Check the rules.');
            return;
        }

        setBids((prev) => [
            ...prev,
            { id: Date.now() + Math.random(), number: pana, points: String(pts), type: session }
        ]);
        
        setInputPana('');
        // Keep points for next bid
    };

    const handleDeleteBid = (id) => {
        setBids((prev) => prev.filter((b) => b.id !== id));
    };

    const totalPoints = bids.reduce((sum, b) => sum + Number(b.points || 0), 0);
    const todayDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
    const dateText = new Date().toLocaleDateString('en-GB');
    const marketTitle = market?.gameName || market?.marketName || title;

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

    const clearAll = () => {
        setIsReviewOpen(false);
        setBids([]);
        setInputPana('');
        setInputPoints('');
    };

    const handleSubmitBet = () => {
        clearAll();
    };

    const handlePanaInputChange = (e) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 3);
        setInputPana(val);
    };

    return (
        <BidLayout
            market={market}
            title={title}
            bidsCount={bids.length}
            totalPoints={totalPoints}
            showDateSession={false}
            extraHeader={null}
            session={session}
            setSession={setSession}
            onSubmit={() => setIsReviewOpen(true)}
            hideFooter={false}
            showFooterStats={true}
            submitLabel="Submit"
            contentPaddingClass="pb-24 md:pb-32"
            walletBalance={walletBefore}
        >
            <div className="px-3 sm:px-4 py-4 w-full max-w-full overflow-x-hidden">
                {warning && (
                    <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-200 rounded-xl px-4 py-3 text-sm">
                        {warning}
                    </div>
                )}

                {/* Two Column Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                    {/* Left Side - Controls & Keypad */}
                    <div className="space-y-4 flex flex-col">
                        {/* Game Type & Points Input */}
                        <div className="bg-[#202124] border border-white/10 rounded-xl p-4 space-y-3">
                            <div className="flex flex-row items-center gap-3">
                                <label className="text-gray-400 text-sm font-medium shrink-0 w-24">Game Type:</label>
                                <div className="relative flex-1 min-w-0">
                                    <select
                                        value={session}
                                        onChange={(e) => setSession(e.target.value)}
                                        disabled={isRunning}
                                        className={`w-full appearance-none bg-[#2a2d32] border border-white/10 text-white font-bold text-sm py-2.5 min-h-[44px] px-4 rounded-lg text-center focus:outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20 ${isRunning ? 'opacity-80 cursor-not-allowed' : ''}`}
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
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                        </svg>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-row items-center gap-3">
                                <label className="text-gray-400 text-sm font-medium shrink-0 w-24">Points:</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={inputPoints}
                                    onChange={(e) => setInputPoints(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="Enter Points"
                                    className="flex-1 min-w-0 bg-[#2a2d32] border border-white/10 text-white placeholder-gray-500 rounded-lg py-2.5 min-h-[44px] px-4 text-center text-sm font-bold focus:ring-2 focus:ring-[#d4af37]/20 focus:border-[#d4af37] focus:outline-none"
                                />
                            </div>
                        </div>

                        {/* Select Sum Keypad - Prominent */}
                        <div className="bg-[#202124] border border-white/10 rounded-xl p-4">
                            <h3 className="text-base font-bold text-[#f2c14e] mb-4 text-center">Select Sum</h3>
                            <div className="grid grid-cols-10 gap-3">
                                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                    <button
                                        key={num}
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleKeypadClick(num);
                                        }}
                                        onTouchStart={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleKeypadClick(num);
                                        }}
                                        className={`aspect-square min-h-[50px] text-white rounded-xl font-bold text-lg flex items-center justify-center transition-all active:scale-90 shadow-lg cursor-pointer select-none ${
                                            selectedSum === num 
                                                ? 'bg-gradient-to-br from-[#d4af37] to-[#cca84d] text-[#4b3608] ring-2 ring-[#f2c14e] shadow-[#d4af37]/50 scale-105 z-10' 
                                                : 'bg-[#2a2d32] border-2 border-white/10 hover:border-[#d4af37]/60 hover:bg-[#2a2d32]/80 active:bg-[#2a2d32]'
                                        }`}
                                        style={{ 
                                            touchAction: 'manipulation',
                                            WebkitTapHighlightColor: 'transparent',
                                            userSelect: 'none',
                                            WebkitUserSelect: 'none'
                                        }}
                                    >
                                        {num}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Display Matching Panas - Well Organized */}
                        {matchingPanas.length > 0 && (
                            <div className="bg-[#202124] border border-white/10 rounded-xl p-4 shadow-lg flex-1 flex flex-col min-h-0">
                                <div className="flex justify-between items-center mb-3 pb-3 border-b border-white/10">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-bold text-[#f2c14e]">Sum {selectedSum}</h3>
                                        <span className="text-xs text-gray-400 bg-[#2a2d32] px-2.5 py-1 rounded-full border border-white/10">
                                            {matchingPanas.length} numbers
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMatchingPanas([]);
                                            setSelectedSum(null);
                                        }}
                                        className="text-xs text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10"
                                    >
                                        Hide
                                    </button>
                                </div>
                                <div className="grid grid-cols-3 gap-2.5 flex-1 overflow-y-auto custom-scrollbar">
                                    {matchingPanas.map((pana) => {
                                        const isInBids = bids.some(b => b.number === pana);
                                        return (
                                            <div
                                                key={pana}
                                                className={`text-center py-2.5 px-2 text-sm font-bold rounded-lg transition-all ${
                                                    isInBids
                                                        ? 'bg-[#d4af37]/25 border-2 border-[#d4af37] text-[#f2c14e]'
                                                        : 'bg-[#2a2d32] border border-white/15 text-white hover:border-[#d4af37]/60 hover:bg-[#2a2d32]/90'
                                                }`}
                                            >
                                                {pana}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Side - Bids List */}
                    <div className="space-y-4">
                        <div className="bg-[#202124] border border-white/10 rounded-xl p-4">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-base font-bold text-[#f2c14e]">
                                    Your Bids {bids.length > 0 && <span className="text-gray-400 font-normal text-sm">({bids.length})</span>}
                                </h3>
                                {bids.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (window.confirm('Clear all bids?')) {
                                                setBids([]);
                                            }
                                        }}
                                        className="text-xs text-gray-400 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-500/10 border border-white/10 hover:border-red-500/30"
                                    >
                                        Clear All
                                    </button>
                                )}
                            </div>
                            {bids.length > 0 ? (
                                <>
                                    <div className="grid grid-cols-4 gap-2 text-center text-[#f2c14e] font-bold text-xs mb-3 px-2">
                                        <div>Pana</div>
                                        <div>Point</div>
                                        <div>Type</div>
                                        <div>Delete</div>
                                    </div>
                                    <div className="h-px bg-white/10 w-full mb-3"></div>
                                    <div className="space-y-2 max-h-[calc(100vh-350px)] overflow-y-auto custom-scrollbar">
                                        {bids.map((bid) => (
                                            <div
                                                key={bid.id}
                                                className="grid grid-cols-4 gap-2 text-center items-center py-3 px-3 bg-[#2a2d32] border border-white/10 rounded-lg text-sm hover:border-[#d4af37]/50 transition-colors"
                                            >
                                                <div className="font-bold text-white">{bid.number}</div>
                                                <div className="font-bold text-[#f2c14e]">{bid.points}</div>
                                                <div className="text-sm text-gray-400 lowercase">{bid.type}</div>
                                                <div className="flex justify-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteBid(bid.id)}
                                                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 active:scale-95 rounded-lg transition-colors"
                                                        aria-label="Delete"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
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
                            ) : (
                                <div className="py-12 text-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                    <p className="text-gray-400 text-sm">No bids yet. Enter points and click a number to add double pana numbers.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <BidReviewModal
                open={isReviewOpen}
                onClose={clearAll}
                onSubmit={handleSubmitBet}
                marketTitle={marketTitle}
                dateText={dateText}
                labelKey="Pana"
                rows={bids}
                walletBefore={walletBefore}
                totalBids={bids.length}
                totalAmount={totalPoints}
            />
        </BidLayout>
    );
};

export default DoublePanaBulkBid;
