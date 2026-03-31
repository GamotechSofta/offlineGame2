import React, { useEffect, useMemo, useState } from 'react';
import BidLayout from '../BidLayout';
import BidReviewModal from './BidReviewModal';
import { placeBet, updateUserBalance } from '../../../api/bets';

const ODD_DIGITS = [1, 3, 5, 7, 9];
const EVEN_DIGITS = [0, 2, 4, 6, 8];

const OddEvenBid = ({ market, title }) => {
    const [session, setSession] = useState(() => (market?.status === 'running' ? 'CLOSE' : 'OPEN'));
    const [choice, setChoice] = useState('odd'); // 'odd' | 'even'
    const [inputPoints, setInputPoints] = useState('');
    const [bids, setBids] = useState([]);
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [warning, setWarning] = useState('');
    const [selectedDate, setSelectedDate] = useState(() => {
        try {
            const savedDate = localStorage.getItem('betSelectedDate');
            if (savedDate) {
                const today = new Date().toISOString().split('T')[0];
                if (savedDate > today) return savedDate;
            }
        } catch (e) {}
        return new Date().toISOString().split('T')[0];
    });

    const digits = choice === 'odd' ? ODD_DIGITS : EVEN_DIGITS;

    const handleDateChange = (newDate) => {
        try {
            localStorage.setItem('betSelectedDate', newDate);
        } catch (e) {}
        setSelectedDate(newDate);
    };

    const showWarning = (msg) => {
        setWarning(msg);
        window.clearTimeout(showWarning._t);
        showWarning._t = window.setTimeout(() => setWarning(''), 2200);
    };

    const clearAll = () => {
        setBids([]);
        setInputPoints('');
        const today = new Date().toISOString().split('T')[0];
        setSelectedDate(today);
        try {
            localStorage.removeItem('betSelectedDate');
        } catch (e) {}
    };

    const handleAddBid = () => {
        const pts = Number(inputPoints);
        if (!pts || pts <= 0) {
            showWarning('Please enter points.');
            return;
        }
        const nextMap = new Map();
        for (const b of bids) {
            nextMap.set(`${b.number}-${b.type}`, b);
        }
        for (const num of digits) {
            const row = {
                id: `${num}-${session}`,
                number: String(num),
                points: String(pts),
                type: session,
            };
            nextMap.set(`${row.number}-${row.type}`, row);
        }
        setBids(Array.from(nextMap.values()));
        setInputPoints('');
    };

    const totalPoints = bids.reduce((sum, b) => sum + Number(b.points), 0);
    const dateText = new Date().toLocaleDateString('en-GB');
    const marketTitle = market?.gameName || market?.marketName || title;
    const isRunning = market?.status === 'running';
    const sessionOptions = isRunning ? ['CLOSE'] : ['OPEN', 'CLOSE'];

    useEffect(() => {
        if (isRunning) setSession('CLOSE');
    }, [isRunning]);

    const walletBefore = useMemo(() => {
        try {
            const u = JSON.parse(localStorage.getItem('user') || 'null');
            const val = u?.wallet ?? u?.balance ?? u?.points ?? u?.walletAmount ?? u?.wallet_amount ?? u?.amount ?? 0;
            const n = Number(val);
            return Number.isFinite(n) ? n : 0;
        } catch (e) {
            return 0;
        }
    }, []);

    const handleSubmitBet = async () => {
        const marketId = market?._id || market?.id;
        if (!marketId) throw new Error('Market not found');
        const bets = bids.map((b) => ({
            betType: 'single',
            betNumber: String(b.number),
            amount: Number(b.points) || 0,
            betOn: String(b?.type || session).toUpperCase() === 'CLOSE' ? 'close' : 'open',
        }));

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selectedDateObj = new Date(selectedDate);
        selectedDateObj.setHours(0, 0, 0, 0);
        const scheduledDate = selectedDateObj > today ? selectedDate : null;

        const result = await placeBet(marketId, bets, scheduledDate);
        if (!result.success) throw new Error(result.message);
        if (result.data?.newBalance != null) updateUserBalance(result.data.newBalance);
        setIsReviewOpen(false);
        clearAll();
    };

    const handleCancelBet = () => {
        setIsReviewOpen(false);
    };

    const handleOpenSubmit = () => {
        if (!bids.length) {
            showWarning('Please add odd/even points first.');
            return;
        }
        setIsReviewOpen(true);
    };

    const handleDeleteBid = (id) => {
        setBids((prev) => prev.filter((b) => b.id !== id));
    };

    const dateRowStats = (
        <>
            <div className="w-full basis-full min-w-0 shrink-0 md:hidden px-3 py-1">
                <div className="grid grid-cols-2 gap-1.5">
                    <div className="rounded-xl border border-gray-300 bg-white px-2 py-1.5 text-center">
                        <div className="text-[11px] text-gray-600 font-medium">Count</div>
                        <div className="text-base font-bold text-[#1B3150] leading-tight">{bids.length}</div>
                    </div>
                    <div className="rounded-xl border border-gray-300 bg-white px-2 py-1.5 text-center">
                        <div className="text-[11px] text-gray-600 font-medium">Bet Amount</div>
                        <div className="text-base font-bold text-[#1B3150] leading-tight">{totalPoints}</div>
                    </div>
                </div>
            </div>
            <div className="hidden md:flex items-center gap-2 shrink-0">
                <div className="rounded-full border-2 border-gray-300 bg-white h-[44px] px-3 flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-500 uppercase leading-none">Bets</span>
                    <span className="text-sm font-bold text-[#1B3150]">{bids.length}</span>
                </div>
                <div className="rounded-full border-2 border-gray-300 bg-white h-[44px] px-3 flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-500 uppercase leading-none">Points</span>
                    <span className="text-sm font-bold text-[#1B3150]">{totalPoints}</span>
                </div>
            </div>
        </>
    );

    const leftColumn = (
        <div className="space-y-4">
            {warning && (
                <div className="bg-red-50 border-2 border-red-300 text-red-600 rounded-xl px-4 py-3 text-sm">
                    {warning}
                </div>
            )}
            <div className="grid grid-cols-2 gap-3">
                <button
                    type="button"
                    onClick={() => setChoice('odd')}
                    className={`h-10 rounded-lg font-bold text-xs border-2 transition-colors ${choice === 'odd' ? 'bg-[#1B3150] text-white border-[#1B3150]' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}
                >
                    Odd
                </button>
                <button
                    type="button"
                    onClick={() => setChoice('even')}
                    className={`h-10 rounded-lg font-bold text-xs border-2 transition-colors ${choice === 'even' ? 'bg-[#1B3150] text-white border-[#1B3150]' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}
                >
                    Even
                </button>
            </div>
            <div className="flex items-center gap-3">
                <label className="text-gray-700 text-sm font-medium shrink-0">Enter Points:</label>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Point"
                        value={inputPoints}
                        onChange={(e) => setInputPoints(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="w-full h-10 bg-white border-2 border-gray-300 text-gray-800 placeholder-gray-400 rounded-full focus:outline-none focus:border-[#1B3150] px-4 text-sm font-semibold text-center min-w-0"
                    />
                    <div className="relative shrink-0">
                        <select
                            value={session}
                            onChange={(e) => setSession(e.target.value)}
                            disabled={isRunning}
                            className={`h-10 rounded-full border-2 border-gray-300 bg-white text-[#1B3150] font-bold text-[10px] sm:text-xs px-3 pr-7 focus:outline-none focus:border-[#1B3150] appearance-none ${
                                isRunning ? 'opacity-60 cursor-not-allowed bg-gray-100' : ''
                            }`}
                        >
                            {sessionOptions.map((opt) => (
                                <option key={opt} value={opt}>
                                    {opt}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-500">
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
            <button onClick={handleAddBid} className="w-full bg-[#1B3150] text-white font-bold h-10 rounded-lg shadow-md hover:bg-[#152842] transition-all active:scale-[0.98] text-xs">
                Add
            </button>
            <div className="overflow-hidden rounded-xl border-2 border-gray-300 bg-white">
                <div className="grid grid-cols-4 bg-gray-100 text-[#1B3150] text-xs font-bold">
                    <div className="px-3 py-2">Ank</div>
                    <div className="px-3 py-2 text-center">Point</div>
                    <div className="px-3 py-2 text-center">Type</div>
                    <div className="px-3 py-2 text-center">Delete</div>
                </div>
                {bids.length ? (
                    bids.map((b) => (
                        <div key={b.id} className="grid grid-cols-4 border-t border-gray-200 text-sm">
                            <div className="px-3 py-2 font-semibold text-gray-800">{b.number}</div>
                            <div className="px-3 py-2 text-center text-gray-700">{b.points}</div>
                            <div className="px-3 py-2 text-center text-gray-700">{b.type}</div>
                            <div className="px-3 py-2 text-center">
                                <button
                                    type="button"
                                    onClick={() => handleDeleteBid(b.id)}
                                    className="inline-flex items-center justify-center text-red-500 hover:text-red-600"
                                    aria-label="Delete"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="px-3 py-4 text-center text-sm text-gray-400">No bids added yet.</div>
                )}
            </div>

            <button
                type="button"
                onClick={handleOpenSubmit}
                disabled={!bids.length}
                className={`hidden md:block w-full mt-3 rounded-xl font-bold text-sm py-2.5 transition-colors ${
                    bids.length
                        ? 'bg-gradient-to-r bg-[#1B3150] text-white hover:bg-[#152842] active:scale-[0.98]'
                        : 'bg-gradient-to-r bg-gray-400 text-white opacity-50 cursor-not-allowed'
                }`}
            >
                Submit
            </button>
        </div>
    );

    return (
        <BidLayout
            market={market}
            title={title}
            bidsCount={bids.length}
            totalPoints={totalPoints}
            showDateSession={true}
            extraHeader={null}
            session={session}
            setSession={setSession}
            sessionRightSlot={dateRowStats}
            hideFooter
            walletBalance={walletBefore}
            selectedDate={selectedDate}
            setSelectedDate={handleDateChange}
            contentPaddingClass="pb-28 md:pb-6"
        >
            <div className="px-3 sm:px-4 py-4 sm:py-2 md:max-w-3xl md:mx-auto md:items-start">
                {leftColumn}
            </div>

            <div className="fixed left-0 right-0 bottom-[88px] z-20 px-3 sm:px-4 md:hidden">
                <button
                    type="button"
                    onClick={handleOpenSubmit}
                    disabled={!bids.length}
                    className={`w-full rounded-xl font-bold text-sm py-3 transition-colors ${
                        bids.length
                            ? 'bg-gradient-to-r bg-[#1B3150] text-white hover:bg-[#152842] active:scale-[0.98]'
                            : 'bg-gradient-to-r bg-gray-400 text-white opacity-50 cursor-not-allowed'
                    }`}
                >
                    Submit
                </button>
            </div>

            <BidReviewModal
                open={isReviewOpen}
                onClose={handleCancelBet}
                onSubmit={handleSubmitBet}
                marketTitle={marketTitle}
                dateText={dateText}
                labelKey="Digit"
                rows={bids}
                walletBefore={walletBefore}
                totalBids={bids.length}
                totalAmount={totalPoints}
            />
        </BidLayout>
    );
};

export default OddEvenBid;
