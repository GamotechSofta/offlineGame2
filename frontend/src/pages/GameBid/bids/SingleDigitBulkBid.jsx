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
    const quickPointValues = [10, 20, 30, 40, 50];
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

    const hasInputPoints = Number(inputPoints) > 0;
    const handleQuickPointClick = (pts) => {
        // Do not accumulate on repeated taps; set exact quick value.
        setInputPoints(String(pts));
    };
    const handleClearPoints = () => setInputPoints('');

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

    const submitBtnClass = (enabled) =>
        enabled
            ? 'w-full bg-[#1B3150] text-white font-bold py-3.5 min-h-[48px] rounded-lg shadow-md hover:bg-[#152842] transition-all active:scale-[0.98]'
            : 'w-full bg-gray-400 text-white font-bold py-3.5 min-h-[48px] rounded-lg shadow-md opacity-50 cursor-not-allowed';

    const mobileModeHeader = (
        <div className="grid grid-cols-2 gap-1.5 md:gap-2 px-1">
            <div className="rounded-xl border border-gray-300 bg-white px-2 py-1.5 md:px-3 md:py-2 text-center">
                <div className="text-[11px] text-gray-600 font-medium">Count</div>
                <div className="text-base font-bold text-[#1B3150] leading-tight">{bulkBidsCount}</div>
            </div>
            <div className="rounded-xl border border-gray-300 bg-white px-2 py-1.5 md:px-3 md:py-2 text-center">
                <div className="text-[11px] text-gray-600 font-medium">Bet Amount</div>
                <div className="text-base font-bold text-[#1B3150] leading-tight">{bulkTotalPoints}</div>
            </div>
        </div>
    );

    const mobileBidsList = (
        <>
            <div className="grid grid-cols-4 gap-1 sm:gap-2 text-center text-[#1B3150] font-bold text-xs sm:text-sm mb-2 px-1">
                <div>Pana</div>
                <div>Point</div>
                <div>Type</div>
                <div>Delete</div>
            </div>
            <div className="h-px bg-[#1B3150] w-full mb-2" />
            <div className="space-y-2">
                {rows.map((bid) => (
                    <div
                        key={bid.id}
                        className="grid grid-cols-4 gap-1 sm:gap-2 text-center items-center py-2.5 px-2 bg-gray-50 rounded-lg border-2 border-gray-300 text-sm"
                    >
                        <div className="font-bold text-gray-800">{bid.number}</div>
                        <div className="px-0.5 min-w-0">
                            <input
                                type="text"
                                inputMode="numeric"
                                value={bid.points}
                                onChange={(e) => updateRowPoints(bid.id, e.target.value)}
                                className="w-full h-8 rounded-lg border border-gray-300 text-center font-bold text-[#1B3150] text-sm focus:outline-none focus:border-[#1B3150]"
                            />
                        </div>
                        <div className="text-sm text-gray-600">{bid.type}</div>
                        <div className="flex justify-center">
                            <button
                                type="button"
                                onClick={() => removeRow(bid.id)}
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

    return (
        <BidLayout
            market={market}
            title={title}
            bidsCount={bulkBidsCount}
            totalPoints={bulkTotalPoints}
            showDateSession={true}
            showSessionOnMobile
            selectedDate={selectedDate}
            setSelectedDate={handleDateChange}
            session={session}
            setSession={setSession}
            onSubmit={() => setIsReviewOpen(true)}
            hideFooter={false}
            showFooterStats={false}
            submitLabel="Submit Bet"
            contentPaddingClass="pb-[calc(7rem+env(safe-area-inset-bottom,0px))] md:pb-32"
            walletBalance={walletBefore}
        >
            <div className="px-3 sm:px-4 py-2 w-full max-w-full overflow-x-hidden">
                {warning && (
                    <div className="mb-3 bg-red-50 border-2 border-red-300 text-red-600 rounded-xl px-4 py-3 text-sm md:mb-4">
                        {warning}
                    </div>
                )}

                {/* Mobile: match Single Pana special layout (screenshot) */}
                <div className="md:hidden space-y-3">
                    {mobileModeHeader}
                    <div className="flex flex-col gap-3 px-1">
                        <div className="flex flex-row items-center gap-2">
                            <label className="text-gray-700 text-sm font-medium shrink-0 w-28">Enter Points</label>
                            <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto] gap-2">
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={inputPoints}
                                    onChange={(e) => setInputPoints(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="Points"
                                    className="no-spinner w-full bg-white border-2 border-gray-300 text-gray-800 placeholder-gray-400 rounded-xl py-2.5 min-h-[40px] px-4 text-left text-sm focus:ring-2 focus:ring-[#1B3150] focus:border-[#1B3150] focus:outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={handleClearPoints}
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
                    <div className="grid grid-cols-5 gap-2 w-full px-1">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                            <button
                                key={num}
                                type="button"
                                disabled={!hasInputPoints}
                                onClick={() => hasInputPoints && handleDigitClick(num)}
                                className={`relative aspect-square min-h-[44px] sm:min-h-[48px] rounded-lg sm:rounded-xl font-bold text-sm sm:text-base flex items-center justify-center transition-all active:scale-90 shadow-lg select-none border border-white/10 ${
                                    hasInputPoints
                                        ? 'text-white bg-[#1B3150] cursor-pointer hover:border-[#d4af37]/50'
                                        : 'text-white bg-[#1B3150] opacity-50 cursor-not-allowed'
                                }`}
                                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                            >
                                {num}
                                {pointsByDigit[num] > 0 && (
                                    <span className="absolute top-0.5 right-0.5 bg-[#1B3150] text-white text-[8px] sm:text-[9px] font-bold rounded-full min-w-[14px] sm:min-w-[16px] h-3.5 sm:h-4 px-0.5 flex items-center justify-center shadow-md">
                                        {pointsByDigit[num] > 999 ? '999+' : pointsByDigit[num]}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                    <div className="mt-2 px-1">{mobileBidsList}</div>
                </div>

                <div className="hidden md:grid md:grid-cols-2 md:gap-6 md:items-start w-full">
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
                                <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto] gap-2">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={inputPoints}
                                        onChange={(e) => setInputPoints(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        placeholder="Point"
                                        className="no-spinner w-full bg-white border-2 border-gray-300 text-gray-800 placeholder-gray-500 rounded-full py-2 min-h-[36px] px-4 text-center text-xs focus:ring-2 focus:ring-gray-400 focus:border-gray-400 focus:outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleClearPoints}
                                        className="px-3 min-h-[36px] rounded-full border-2 border-gray-300 bg-white text-[#1B3150] text-xs font-medium hover:border-[#1B3150] active:scale-95"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                            <div className="flex flex-row items-center gap-2">
                                <label className="text-gray-600 text-xs font-medium shrink-0 w-20">Quick Points:</label>
                                <div className="flex-1 min-w-0 grid grid-cols-5 gap-2">
                                    {quickPointValues.map((pts) => (
                                        <button
                                            key={pts}
                                            type="button"
                                            onClick={() => handleQuickPointClick(pts)}
                                            className="py-2 min-h-[36px] rounded-lg border-2 border-gray-300 bg-white text-xs font-bold text-[#1B3150] hover:border-[#1B3150] active:scale-[0.98]"
                                        >
                                            {pts}
                                        </button>
                                    ))}
                                </div>
                            </div>

                    {/* Desktop: 2 rows (5 columns) */}
                    <div className="hidden md:grid grid-cols-5 gap-2 w-full max-w-[360px] mx-auto">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                            <button
                                key={num}
                                type="button"
                                disabled={!hasInputPoints}
                                onClick={() => hasInputPoints && handleDigitClick(num)}
                                className={`relative aspect-square min-h-[40px] bg-[#1B3150] border border-white/10 text-white rounded-lg font-bold text-sm flex items-center justify-center transition-all active:scale-90 shadow-md select-none ${
                                    hasInputPoints ? 'hover:border-[#d4af37]/50 cursor-pointer' : 'opacity-50 cursor-not-allowed'
                                }`}
                            >
                                {num}
                                {pointsByDigit[num] > 0 && (
                                    <span className="absolute top-0.5 right-1 text-[10px] font-bold text-white">
                                        {pointsByDigit[num] > 999 ? '999+' : pointsByDigit[num]}
                                    </span>
                                )}
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