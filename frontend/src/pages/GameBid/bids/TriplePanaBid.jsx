import React, { useEffect, useMemo, useState } from 'react';
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

        const next = [...bids, { id: Date.now(), number: n, points: String(pts), type: session }];
        setBids(next);
        setInputNumber('');
        setInputPoints('');
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
        setIsReviewOpen(true);
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
        setInputNumber(`${d}${d}${d}`);
    };

    const modeTabs = (
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
    );

    return (
        <BidLayout
            market={market}
            title={title}
            bidsCount={bids.length}
            totalPoints={totalPoints}
            showDateSession={true}
            selectedDate={selectedDate}
            setSelectedDate={handleDateChange}
            extraHeader={null}
            session={session}
            setSession={setSession}
            hideFooter
            walletBalance={walletBefore}
        >
            <div className="px-3 sm:px-4 py-4 sm:py-2 md:max-w-3xl md:mx-auto md:items-start">
                <div className="space-y-4">
                    {warning && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-xl px-4 py-3 text-sm">
                            {warning}
                        </div>
                    )}
                    {modeTabs}
                    {dateSessionRow}

                    {activeTab === 'easy' ? (
                        <>
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-row items-center gap-2">
                                    <label className="text-gray-400 text-sm font-medium shrink-0 w-32">Select Game Type:</label>
                                    <div className="flex-1 min-w-0 bg-[#202124] border border-white/10 rounded-full py-2.5 min-h-[40px] px-4 flex items-center justify-center text-sm font-bold text-white">
                                        {session}
                                    </div>
                                </div>
                                <div className="flex flex-row items-center gap-2">
                                    <label className="text-gray-400 text-sm font-medium shrink-0 w-32">Enter Pana:</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={inputNumber}
                                        onChange={handleNumberInputChange}
                                        placeholder="Pana"
                                        maxLength={3}
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
                                type="button"
                                onClick={handleAddBid}
                                className="w-full bg-gradient-to-r from-[#d4af37] to-[#cca84d] text-[#4b3608] font-bold py-3.5 min-h-[48px] rounded-lg shadow-md hover:from-[#e5c04a] hover:to-[#d4af37] transition-all active:scale-[0.98]"
                            >
                                Add
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
                                {tripleNumbers.map((num) => (
                                    <div key={num} className="flex items-center gap-2">
                                        <div className="w-12 h-10 bg-[#202124] border border-white/10 text-[#f2c14e] flex items-center justify-center rounded-l-md font-bold text-sm shrink-0">
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
                                            className="w-full h-10 bg-[#202124] border border-white/10 text-white placeholder-gray-500 rounded-r-md focus:outline-none focus:border-[#d4af37] px-3 text-sm font-semibold"
                                        />
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={handleAddSpecialModeBids}
                                className="w-full bg-gradient-to-r from-[#d4af37] to-[#cca84d] text-[#4b3608] font-bold py-3 rounded-md shadow-md hover:from-[#e5c04a] hover:to-[#d4af37] transition-all"
                            >
                                Add to List
                            </button>
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
