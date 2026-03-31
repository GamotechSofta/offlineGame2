import React, { useEffect, useMemo, useRef, useState } from 'react';
import BidLayout from '../BidLayout';
import BidReviewModal from './BidReviewModal';
import { placeBet, updateUserBalance } from '../../../api/bets';

const isValidTriplePana = (n) => {
    const s = (n ?? '').toString().trim();
    if (!/^[0-9]{3}$/.test(s)) return false;
    return s[0] === s[1] && s[1] === s[2]; // 000, 111, ... 999
};

const TriplePanaBid = ({ market, title }) => {
    const [activeTab, setActiveTab] = useState('easy'); // easy | special
    const [session, setSession] = useState(() => (market?.status === 'running' ? 'CLOSE' : 'OPEN'));
    const [bids, setBids] = useState([]);
    const [inputNumber, setInputNumber] = useState('');
    const [inputPoints, setInputPoints] = useState('');
    const pointsInputRef = useRef(null);
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [warning, setWarning] = useState('');
    const [selectedDate, setSelectedDate] = useState(() => {
        try {
            const savedDate = localStorage.getItem('betSelectedDate');
            if (savedDate) {
                const today = new Date().toISOString().split('T')[0];
                // Only restore if saved date is in the future (not today)
                if (savedDate > today) {
                    return savedDate;
                }
            }
        } catch (e) {
            // Ignore errors
        }
        const today = new Date();
        return today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    });
    
    // Save to localStorage when date changes
    const handleDateChange = (newDate) => {
        try {
            localStorage.setItem('betSelectedDate', newDate);
        } catch (e) {
            // Ignore errors
        }
        setSelectedDate(newDate);
    };

    const showWarning = (msg) => {
        setWarning(msg);
        window.clearTimeout(showWarning._t);
        showWarning._t = window.setTimeout(() => setWarning(''), 2200);
    };

    const tripleNumbers = useMemo(
        () => Array.from({ length: 10 }, (_, i) => `${i}${i}${i}`),
        []
    );
    const [specialInputs, setSpecialInputs] = useState(() =>
        Object.fromEntries(tripleNumbers.map((n) => [n, '']))
    );

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

    const totalPoints = bids.reduce((sum, b) => sum + Number(b.points || 0), 0);

    const mergeBids = (prev, incoming) => {
        const map = new Map();
        for (const b of prev || []) {
            const num = (b?.number ?? '').toString().trim();
            const type = (b?.type ?? '').toString().trim();
            const key = `${num}__${type}`;
            map.set(key, { ...b, number: num, type, points: String(Number(b?.points || 0) || 0) });
        }
        for (const b of incoming || []) {
            const num = (b?.number ?? '').toString().trim();
            const type = (b?.type ?? '').toString().trim();
            const key = `${num}__${type}`;
            const pts = Number(b?.points || 0) || 0;
            const existing = map.get(key);
            if (existing) {
                existing.points = String((Number(existing.points || 0) || 0) + pts);
            } else {
                map.set(key, {
                    id: b?.id ?? `${Date.now()}-${Math.random()}`,
                    number: num,
                    points: String(pts),
                    type,
                });
            }
        }
        return Array.from(map.values());
    };

    const quickPointValues = [10, 20, 30, 40, 50];
    const handleQuickPointClick = (pts) => {
        setInputPoints(String(pts));
    };

    const handleFormClearEasy = () => {
        setBids([]);
        setInputNumber('');
        setInputPoints('');
        setSpecialInputs(Object.fromEntries(tripleNumbers.map((n) => [n, ''])));
    };

    const handleDeleteBid = (id) => setBids((prev) => prev.filter((b) => b.id !== id));

    const submitBtnClass = (enabled) =>
        enabled
            ? 'w-full bg-[#1B3150] text-white font-bold py-3.5 min-h-[48px] rounded-lg shadow-md hover:bg-[#152842] transition-all active:scale-[0.98]'
            : 'w-full bg-gray-400 text-white font-bold py-3.5 min-h-[48px] rounded-lg shadow-md opacity-50 cursor-not-allowed';

    const todayDate = new Date()
        .toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
        .replace(/\//g, '-');
    const dateText = new Date().toLocaleDateString('en-GB');
    const marketTitle = market?.gameName || market?.marketName || title;
    const isRunning = market?.status === 'running'; // "CLOSED IS RUNNING"

    useEffect(() => {
        if (isRunning) setSession('CLOSE');
    }, [isRunning]);

    const clearAll = () => {
        setBids([]);
        setInputNumber('');
        setInputPoints('');
        setSpecialInputs(Object.fromEntries(tripleNumbers.map((n) => [n, ''])));
        // Reset scheduled date to today after bet is placed
        const today = new Date().toISOString().split('T')[0];
        setSelectedDate(today);
        try {
            localStorage.removeItem('betSelectedDate');
        } catch (e) {
            // Ignore errors
        }
    };

    const handleCancelBet = () => {
        setIsReviewOpen(false);
        clearAll();
    };

    const handleSubmitBet = async () => {
        const marketId = market?._id || market?.id;
        if (!marketId) throw new Error('Market not found');
        const payload = bids.map((b) => ({
            betType: 'panna',
            betNumber: String(b.number),
            amount: Number(b.points) || 0,
            betOn: String(b?.type || session).toUpperCase() === 'CLOSE' ? 'close' : 'open',
        }));
        
        // Check if date is in the future (scheduled bet)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selectedDateObj = new Date(selectedDate);
        selectedDateObj.setHours(0, 0, 0, 0);
        const scheduledDate = selectedDateObj > today ? selectedDate : null;
        
        const result = await placeBet(marketId, payload, scheduledDate);
        if (!result.success) throw new Error(result.message);
        if (result.data?.newBalance != null) updateUserBalance(result.data.newBalance);
        setIsReviewOpen(false);
        clearAll();
    };

    const handleAddBid = () => {
        const pts = Number(inputPoints);
        if (!pts || pts <= 0) {
            showWarning('Please enter points.');
            return;
        }
        const n = inputNumber?.toString().trim() || '';
        if (!n) {
            showWarning('Please enter triple pana (000-999).');
            return;
        }
        if (!isValidTriplePana(n)) {
            showWarning('Invalid triple pana. Use 000, 111, 222 ... 999.');
            return;
        }

        const bid = { id: Date.now() + Math.random(), number: n, points: String(pts), type: session };
        setBids((prev) => mergeBids(prev, [bid]));
        setInputNumber('');
        setInputPoints('');
    };

    const handleSubmitReview = () => {
        if (!bids.length) return;
        setIsReviewOpen(true);
    };

    const handleAddSpecialModeBids = () => {
        const toAdd = Object.entries(specialInputs)
            .filter(([, pts]) => Number(pts) > 0)
            .map(([num, pts]) => ({ id: Date.now() + Number(num[0]), number: num, points: String(pts), type: session }));

        if (!toAdd.length) {
            showWarning('Please enter points for at least one triple pana (000-999).');
            return;
        }

        const next = [...bids, ...toAdd];
        setBids(next);
        setSpecialInputs(Object.fromEntries(tripleNumbers.map((n) => [n, ''])));
    };

    const handleNumberInputChange = (e) => {
        // Allow backspace/editing, but restrict to special-mode values (000,111,...,999)
        // - When typing: auto-expand single digit to 3x (e.g. 2 -> 222)
        // - When deleting: allow partial values so backspace works (222 -> 22 -> 2 -> '')
        const raw = e.target.value.replace(/\D/g, '').slice(0, 3);

        // deletion/backspace path: clear fully as requested
        if (raw.length < inputNumber.length) {
            setInputNumber('');
            return;
        }

        if (!raw) {
            setInputNumber('');
            return;
        }

        // typing path: if user types at least one digit, snap to triple
        const d = raw[0];
        const nextVal = `${d}${d}${d}`;
        const prevVal = (inputNumber ?? '').toString();
        setInputNumber(nextVal);
        if (nextVal.length === 3 && prevVal !== nextVal) {
            window.requestAnimationFrame(() => {
                pointsInputRef.current?.focus?.();
            });
        }
    };
    const isPanaInvalid = !!inputNumber && inputNumber.length === 3 && !isValidTriplePana(inputNumber);

    const modeTabs = (
        <div className="space-y-2 md:space-y-3">
            <div className="grid grid-cols-2 gap-2 md:gap-3">
                <button
                    type="button"
                    onClick={() => setActiveTab('easy')}
                    className={`min-h-[40px] py-2 md:min-h-[44px] md:py-3 rounded-lg font-bold text-sm shadow-sm border-2 active:scale-[0.98] transition-colors ${
                        activeTab === 'easy'
                            ? 'bg-[#1B3150] text-white border-[#1B3150]'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                    }`}
                >
                    EASY MODE
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('special')}
                    className={`min-h-[40px] py-2 md:min-h-[44px] md:py-3 rounded-lg font-bold text-sm shadow-sm border-2 active:scale-[0.98] transition-colors ${
                        activeTab === 'special'
                            ? 'bg-[#1B3150] text-white border-[#1B3150]'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                    }`}
                >
                    SPECIAL MODE
                </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 md:gap-2 px-1">
                <div className="rounded-xl border border-gray-300 bg-white px-2 py-1.5 md:px-3 md:py-2 text-center">
                    <div className="text-[11px] text-gray-600 font-medium">Count</div>
                    <div className="text-base font-bold text-[#1B3150] leading-tight">{bids.length}</div>
                </div>
                <div className="rounded-xl border border-gray-300 bg-white px-2 py-1.5 md:px-3 md:py-2 text-center">
                    <div className="text-[11px] text-gray-600 font-medium">Bet Amount</div>
                    <div className="text-base font-bold text-[#1B3150] leading-tight">{totalPoints}</div>
                </div>
            </div>
        </div>
    );

    const easyBidsList = (
        <>
            <div className="grid grid-cols-4 gap-1 sm:gap-2 text-center text-[#1B3150] font-bold text-xs sm:text-sm mb-2 px-1">
                <div>Pana</div>
                <div>Point</div>
                <div>Type</div>
                <div>Delete</div>
            </div>
            <div className="h-px bg-[#1B3150] w-full mb-2" />
            <div className="space-y-2">
                {bids.map((bid) => (
                    <div
                        key={bid.id}
                        className="grid grid-cols-4 gap-1 sm:gap-2 text-center items-center py-2.5 px-2 bg-gray-50 rounded-lg border-2 border-gray-300 text-sm"
                    >
                        <div className="font-bold text-gray-800">{bid.number}</div>
                        <div className="font-bold text-[#1B3150]">{bid.points}</div>
                        <div className="text-sm text-gray-600">{bid.type}</div>
                        <div className="flex justify-center">
                            <button
                                type="button"
                                onClick={() => handleDeleteBid(bid.id)}
                                className="p-2 text-red-500 hover:text-red-600 active:scale-95"
                                aria-label="Delete"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
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
    );

    const dateSessionRow = (
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
                    className="w-full pl-10 py-3 sm:py-2.5 min-h-[44px] bg-white border-2 border-gray-300 text-gray-800 rounded-full text-sm font-bold text-center focus:outline-none"
                />
            </div>
            <div className="relative">
                <select
                    value={session}
                    onChange={(e) => setSession(e.target.value)}
                    disabled={isRunning}
                    className={`w-full appearance-none bg-white border-2 border-gray-300 text-gray-800 font-bold text-sm py-3 sm:py-2.5 min-h-[44px] px-4 rounded-full text-center focus:outline-none focus:border-[#1B3150] ${isRunning ? 'opacity-60 cursor-not-allowed bg-gray-100' : ''}`}
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
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                </div>
            </div>
        </div>
    );

    return (
        <BidLayout
            market={market}
            title={title}
            bidsCount={bids.length}
            totalPoints={totalPoints}
            showDateSession={true}
            showSessionOnMobile
            selectedDate={selectedDate}
            setSelectedDate={handleDateChange}
            extraHeader={null}
            session={session}
            setSession={setSession}
            hideFooter
            walletBalance={walletBefore}
        >
            <div className="px-3 sm:px-4 py-2 sm:py-2 md:max-w-7xl md:mx-auto md:items-start">
                <div className="space-y-4">
                    {warning && (
                        <div className="bg-red-50 border-2 border-red-300 text-red-600 rounded-xl px-4 py-3 text-sm">
                            {warning}
                        </div>
                    )}
                    {activeTab === 'easy' ? (
                        <>
                            <div className="md:grid md:grid-cols-2 md:gap-6 md:items-start">
                                <div>
                                    {modeTabs}
                                    <div className="flex flex-col gap-3 mt-2 mb-4 px-1">
                                        <div className="flex flex-row items-center gap-2">
                                            <label className="text-gray-700 text-sm font-medium shrink-0 w-28">Enter Pana:</label>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={inputNumber}
                                                onChange={handleNumberInputChange}
                                                placeholder="Pana"
                                                maxLength={3}
                                                className={`flex-1 min-w-0 bg-white border-2 border-gray-300 text-gray-800 placeholder-gray-400 rounded-xl py-2.5 min-h-[40px] px-4 text-left text-sm focus:ring-2 focus:outline-none ${
                                                    isPanaInvalid ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'focus:ring-[#1B3150] focus:border-[#1B3150]'
                                                }`}
                                            />
                                        </div>
                                        <div className="flex flex-row items-center gap-2">
                                            <label className="text-gray-700 text-sm font-medium shrink-0 w-28">Enter Points</label>
                                            <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto] gap-2">
                                                <input
                                                    ref={pointsInputRef}
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={inputPoints}
                                                    onChange={(e) => setInputPoints(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                    placeholder="Points"
                                                    className="no-spinner w-full bg-white border-2 border-gray-300 text-gray-800 placeholder-gray-400 rounded-xl py-2.5 min-h-[40px] px-4 text-left text-sm focus:ring-2 focus:ring-[#1B3150] focus:border-[#1B3150] focus:outline-none"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleFormClearEasy}
                                                    className="px-4 min-h-[40px] rounded-xl border-2 border-gray-300 bg-white text-[#1B3150] text-sm font-medium hover:border-[#1B3150] active:scale-95"
                                                >
                                                    Clear
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex flex-row items-center gap-2">
                                            <label className="text-gray-700 text-sm font-medium shrink-0 w-28">Quick Points</label>
                                            <div className="flex-1 min-w-0 grid grid-cols-5 gap-2">
                                                {quickPointValues.map((pts) => (
                                                    <button
                                                        key={pts}
                                                        type="button"
                                                        onClick={() => handleQuickPointClick(pts)}
                                                        className="py-2 min-h-[36px] rounded-lg border-2 border-gray-300 bg-white text-sm font-medium text-[#1B3150] hover:border-[#1B3150] active:scale-95"
                                                    >
                                                        {pts}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 mb-5 sm:mb-6 md:grid-cols-2">
                                        <button
                                            type="button"
                                            onClick={handleAddBid}
                                            className="w-full bg-[#1B3150] text-white font-bold py-3.5 min-h-[48px] rounded-lg shadow-md hover:bg-[#152842] transition-all active:scale-[0.98]"
                                        >
                                            Add to List
                                        </button>
                                        <button
                                            type="button"
                                            disabled={!bids.length}
                                            onClick={handleSubmitReview}
                                            className={submitBtnClass(!!bids.length)}
                                        >
                                            Submit Bet
                                        </button>
                                    </div>
                                    <div className="md:hidden">{easyBidsList}</div>
                                </div>
                                <div className="hidden md:block">{easyBidsList}</div>
                            </div>
                        </>
                    ) : (
                        <>
                            {modeTabs}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
                                {tripleNumbers.map((num) => (
                                    <div key={num} className="flex items-center gap-2">
                                        <div className="w-12 h-10 bg-[#1B3150] border-2 border-gray-300 text-white flex items-center justify-center rounded-l-md font-bold text-sm shrink-0">
                                            {num}
                                        </div>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="Pts"
                                            value={specialInputs[num] || ''}
                                            onChange={(e) =>
                                                setSpecialInputs((p) => ({
                                                    ...p,
                                                    [num]: e.target.value.replace(/\D/g, '').slice(0, 6),
                                                }))
                                            }
                                            className="w-full h-10 bg-white border-2 border-gray-300 text-gray-800 placeholder-gray-400 rounded-r-md focus:outline-none focus:border-[#1B3150] px-3 text-sm font-semibold"
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-2 gap-3 mb-5 sm:mb-6 md:grid-cols-2">
                                <button
                                    type="button"
                                    onClick={handleAddSpecialModeBids}
                                    className="w-full bg-[#1B3150] text-white font-bold py-3.5 min-h-[48px] rounded-lg shadow-md hover:bg-[#152842] transition-all active:scale-[0.98]"
                                >
                                    Add to List
                                </button>
                                <button
                                    type="button"
                                    disabled={!bids.length}
                                    onClick={handleSubmitReview}
                                    className={submitBtnClass(!!bids.length)}
                                >
                                    Submit Bet
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <BidReviewModal
                open={isReviewOpen}
                onClose={handleCancelBet}
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

export default TriplePanaBid;
