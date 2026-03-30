import React, { useEffect, useMemo, useState } from 'react';
import BidLayout from '../BidLayout';
import BidReviewModal from './BidReviewModal';
import { placeBet, updateUserBalance } from '../../../api/bets';

const SingleDigitBulkBid = ({ market, title }) => {
    const [session, setSession] = useState(() => (market?.status === 'running' ? 'CLOSE' : 'OPEN'));
    const [inputPoints, setInputPoints] = useState('');
    const [bids, setBids] = useState([]);
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

    const isRunning = market?.status === 'running'; // "CLOSED IS RUNNING"
    useEffect(() => {
        if (isRunning) setSession('CLOSE');
    }, [isRunning]);

    const handleDigitClick = (num) => {
        const pts = Number(inputPoints);
        if (!pts || pts <= 0) {
            showWarning('Please enter points.');
            return;
        }
        setBids((prev) => {
            const numberStr = String(num);
            const typeStr = String(session);
            const idx = prev.findIndex((b) => String(b.number) === numberStr && String(b.type) === typeStr);

            // If same (number + type) already exists, add points to that row
            if (idx >= 0) {
                const next = [...prev];
                const curPoints = Number(next[idx]?.points || 0) || 0;
                next[idx] = { ...next[idx], points: String(curPoints + pts) };
                return next;
            }

            // Otherwise create a new row
            return [
                ...prev,
                { id: Date.now() + Math.random(), number: numberStr, points: String(pts), type: typeStr }
            ];
        });
    };

    const bulkBidsCount = bids.length;
    const bulkTotalPoints = bids.reduce((sum, b) => sum + Number(b.points || 0), 0);
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

    const rows = useMemo(() => {
        return [...bids].sort((a, c) => {
            if (a.type !== c.type) return a.type.localeCompare(c.type);
            return a.number.localeCompare(c.number);
        });
    }, [bids]);

    const pointsByDigit = bids.reduce((acc, b) => {
        const k = String(b.number);
        acc[k] = (acc[k] || 0) + Number(b.points || 0);
        return acc;
    }, {});

    const updateRowPoints = (id, value) => {
        const sanitized = String(value ?? '').replace(/\D/g, '').slice(0, 6);
        setBids((prev) =>
            prev
                .map((b) => (b.id === id ? { ...b, points: sanitized } : b))
                .filter((b) => Number(b.points) > 0)
        );
    };

    const removeRow = (id) => {
        setBids((prev) => prev.filter((b) => b.id !== id));
    };

    const clearAll = () => {
        setIsReviewOpen(false);
        setBids([]);
        setInputPoints('');
        // Reset scheduled date to today after bet is placed
        const today = new Date().toISOString().split('T')[0];
        setSelectedDate(today);
        try {
            localStorage.removeItem('betSelectedDate');
        } catch (e) {
            // Ignore errors
        }
    };

    const handleSubmitBet = async () => {
        const marketId = market?._id || market?.id;
        if (!marketId) throw new Error('Market not found');
        const payload = rows.map((r) => ({
            betType: 'single',
            betNumber: String(r.number),
            amount: Number(r.points) || 0,
            betOn: String(r?.type || session).toUpperCase() === 'CLOSE' ? 'close' : 'open',
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

    const extraHeader = null;

    return (
        <BidLayout
            market={market}
            title={title}
            bidsCount={bulkBidsCount}
            totalPoints={bulkTotalPoints}
            showDateSession={true}
            dateSessionGridClassName="hidden md:flex"
            selectedDate={selectedDate}
            setSelectedDate={handleDateChange}
            extraHeader={extraHeader}
            session={session}
            setSession={setSession}
            onSubmit={() => setIsReviewOpen(true)}
            hideFooter={false}
            showFooterStats={false}
            submitLabel="Submit Bet"
            contentPaddingClass="pb-[calc(7rem+env(safe-area-inset-bottom,0px))] md:pb-32"
            walletBalance={walletBefore}
        >
            <div className="px-3 py-2 w-full max-w-full overflow-x-hidden">
                {warning && (
                    <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-200 rounded-xl px-4 py-3 text-sm">
                        {warning}
                    </div>
                )}
                <div className="mb-3 grid grid-cols-2 gap-2 md:hidden">
                    <div className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-center">
                        <div className="text-[11px] text-gray-600 font-medium">Count</div>
                        <div className="text-base font-bold text-[#1B3150] leading-tight">{bulkBidsCount}</div>
                    </div>
                    <div className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-center">
                        <div className="text-[11px] text-gray-600 font-medium">Bet Amount</div>
                        <div className="text-base font-bold text-[#1B3150] leading-tight">{bulkTotalPoints}</div>
                    </div>
                </div>
                <div className="flex flex-col md:grid md:grid-cols-2 md:gap-6 md:items-start gap-0 w-full">
                    <div className="w-full min-w-0 md:flex md:justify-start md:items-center">
                        <div className="flex flex-col gap-2 mb-1 md:mb-0 w-full md:max-w-sm">
                            <div className="flex flex-row items-center gap-2">
                                <label className="text-gray-600 text-xs font-medium shrink-0 w-20">Date:</label>
                                <div className="relative flex-1 min-w-0">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    </div>
                                    <input type="text" value={todayDate} readOnly className="w-full pl-9 py-2 min-h-[36px] bg-white border-2 border-gray-300 rounded-full text-xs font-bold text-center text-gray-800 focus:outline-none focus:border-gray-400" />
                                </div>
                            </div>
                            <div className="flex flex-row items-center gap-2">
                                <label className="text-gray-600 text-xs font-medium shrink-0 w-20">Type:</label>
                                <select
                                    value={session}
                                    onChange={(e) => setSession(e.target.value)}
                                    disabled={isRunning}
                                    className={`flex-1 min-w-0 appearance-none bg-white border-2 border-gray-300 text-gray-800 font-bold text-xs py-2 min-h-[36px] px-4 rounded-full text-center focus:outline-none focus:border-gray-400 ${isRunning ? 'opacity-80 cursor-not-allowed' : ''}`}
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
                            </div>
                            <div className="flex flex-row items-center gap-2">
                                <label className="text-gray-600 text-xs font-medium shrink-0 w-20">Enter Points:</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={inputPoints}
                                    onChange={(e) => setInputPoints(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="Point"
                                    className="no-spinner flex-1 min-w-0 bg-white border-2 border-gray-300 text-gray-800 placeholder-gray-500 rounded-full py-2 min-h-[36px] px-4 text-center text-xs focus:ring-2 focus:ring-gray-400 focus:border-gray-400 focus:outline-none"
                                />
                            </div>
                    {/* Mobile: 2 rows (5 columns). Keep 0 in the center by ordering */}
                    <div className="md:hidden grid grid-cols-5 gap-2 w-full max-w-[260px] mx-auto">
                        {[1, 2, 3, 4, 5, 6, 7, 0, 8, 9].map((num) => (
                            <button
                                key={num}
                                type="button"
                                onClick={() => handleDigitClick(num)}
                                className="relative aspect-square min-h-[40px] bg-[#1B3150] border border-white/10 hover:border-[#d4af37]/50 text-white rounded-lg font-bold text-sm flex items-center justify-center transition-all active:scale-95 shadow-md"
                            >
                                {num}
                                {pointsByDigit[num] > 0 && <span className="absolute top-0.5 right-1 text-[10px] font-bold text-white">{pointsByDigit[num]}</span>}
                            </button>
                        ))}
                    </div>

                    {/* Desktop: 2 rows (5 columns) */}
                    <div className="hidden md:grid grid-cols-5 gap-2 w-full max-w-[360px] mx-auto">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((num) => (
                            <button
                                key={num}
                                type="button"
                                onClick={() => handleDigitClick(num)}
                                className="relative aspect-square min-h-[40px] bg-[#1B3150] border border-white/10 hover:border-[#d4af37]/50 text-white rounded-lg font-bold text-sm flex items-center justify-center transition-all active:scale-95 shadow-md"
                            >
                                {num}
                                {pointsByDigit[num] > 0 && <span className="absolute top-0.5 right-1 text-[10px] font-bold text-white">{pointsByDigit[num]}</span>}
                            </button>
                        ))}
                    </div>
                    <div className="hidden md:grid mt-3 grid-cols-2 gap-2 w-full max-w-[320px] mx-auto">
                        <div className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-center">
                            <div className="text-[11px] text-gray-600 font-medium">Count</div>
                            <div className="text-base font-bold text-[#1B3150] leading-tight">{bulkBidsCount}</div>
                        </div>
                        <div className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-center">
                            <div className="text-[11px] text-gray-600 font-medium">Bet Amount</div>
                            <div className="text-base font-bold text-[#1B3150] leading-tight">{bulkTotalPoints}</div>
                        </div>
                    </div>
                        </div>
                    </div>
                    <div className="w-full min-w-0 md:flex md:justify-start md:items-start">
                        <div className="rounded-xl border border-gray-300 bg-white overflow-hidden w-full">
                            <div className="grid grid-cols-4 bg-gray-100 text-[11px] font-semibold text-[#1B3150]">
                                <div className="px-2 py-1.5">Pana</div>
                                <div className="px-2 py-1.5 text-center">Point</div>
                                <div className="px-2 py-1.5 text-center">Type</div>
                                <div className="px-2 py-1.5 text-center">Delete</div>
                            </div>
                            {rows.map((row) => (
                                <div key={row.id} className="grid grid-cols-4 border-t border-gray-200 text-xs items-center">
                                    <div className="px-2 py-1.5 font-semibold text-gray-800">{row.number}</div>
                                    <div className="px-1 py-1">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={row.points}
                                            onChange={(e) => updateRowPoints(row.id, e.target.value)}
                                            className="w-full h-7 rounded border border-gray-300 text-center font-semibold text-gray-800 focus:outline-none focus:border-[#1B3150]"
                                        />
                                    </div>
                                    <div className="px-2 py-1.5 text-center text-gray-700">{row.type}</div>
                                    <div className="px-2 py-1.5 text-center">
                                        <button type="button" onClick={() => removeRow(row.id)} className="text-red-500 hover:text-red-600" aria-label="Delete">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
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
                labelKey="Digit"
                rows={rows}
                walletBefore={walletBefore}
                totalBids={bulkBidsCount}
                totalAmount={bulkTotalPoints}
            />
        </BidLayout>
    );
};

export default SingleDigitBulkBid;