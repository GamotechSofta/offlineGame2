import React, { useEffect, useMemo, useState } from 'react';
import BidLayout from '../BidLayout';
import BidReviewModal from './BidReviewModal';

const SingleDigitBulkBid = ({ market, title }) => {
    const [session, setSession] = useState(() => (market?.status === 'running' ? 'CLOSE' : 'OPEN'));
    const [inputPoints, setInputPoints] = useState('');
    const [bids, setBids] = useState([]);
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [warning, setWarning] = useState('');
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

        // Each click adds a new bid (bids count increases for all numbers)
        setBids((prev) => [
            ...prev,
            { id: Date.now() + Math.random(), number: String(num), points: String(pts), type: session }
        ]);
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

    // For review popup history: merge same digit entries by (number + type),
    // so digit doesn't repeat and points get summed.
    const rows = useMemo(() => {
        const map = new Map();
        for (const b of bids) {
            const num = String(b.number ?? '').trim();
            const type = String(b.type ?? '').trim();
            const key = `${num}__${type}`;
            const prev = map.get(key);
            const pts = Number(b.points || 0) || 0;
            if (prev) {
                prev.points = String((Number(prev.points || 0) || 0) + pts);
            } else {
                map.set(key, { id: key, number: num, points: String(pts), type });
            }
        }
        // Keep a stable order: by type then number
        return Array.from(map.values()).sort((a, c) => {
            if (a.type !== c.type) return a.type.localeCompare(c.type);
            return a.number.localeCompare(c.number);
        });
    }, [bids]);

    const pointsByDigit = bids.reduce((acc, b) => {
        const k = String(b.number);
        acc[k] = (acc[k] || 0) + Number(b.points || 0);
        return acc;
    }, {});

    const clearAll = () => {
        setIsReviewOpen(false);
        setBids([]);
        setInputPoints('');
    };

    const handleSubmitBet = () => {
        // Integrate API later. For now, close and clear.
        clearAll();
    };

    const extraHeader = null;

    return (
        <BidLayout
            market={market}
            title={title}
            bidsCount={bulkBidsCount}
            totalPoints={bulkTotalPoints}
            showDateSession={false}
            extraHeader={extraHeader}
            session={session}
            setSession={setSession}
            onSubmit={() => setIsReviewOpen(true)}
            hideFooter={false}
            showFooterStats={false}
            submitLabel="Submit Bet"
            contentPaddingClass="pb-24 md:pb-32"
            walletBalance={walletBefore}
        >
            <div className="px-3 py-2 w-full max-w-full overflow-x-hidden">
                {warning && (
                    <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-200 rounded-xl px-4 py-3 text-sm">
                        {warning}
                    </div>
                )}
                <div className="flex flex-col md:grid md:grid-cols-2 md:gap-6 md:items-center gap-3 md:gap-6 w-full">
                    <div className="w-full min-w-0 md:flex md:justify-center md:items-center">
                        <div className="flex flex-col gap-2 mb-1 md:mb-0 w-full md:max-w-sm">
                            <div className="flex flex-row items-center gap-2">
                                <label className="text-gray-400 text-xs font-medium shrink-0 w-16">Date:</label>
                                <div className="relative flex-1 min-w-0">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    </div>
                                    <input type="text" value={todayDate} readOnly className="w-full pl-9 py-2 min-h-[36px] bg-[#202124] border border-white/10 rounded-full text-xs font-bold text-center text-white focus:outline-none" />
                                </div>
                            </div>
                            <div className="flex flex-row items-center gap-2">
                                <label className="text-gray-400 text-xs font-medium shrink-0 w-16">Type:</label>
                                <select
                                    value={session}
                                    onChange={(e) => setSession(e.target.value)}
                                    disabled={isRunning}
                                    className={`flex-1 min-w-0 appearance-none bg-[#202124] border border-white/10 text-white font-bold text-xs py-2 min-h-[36px] px-4 rounded-full text-center focus:outline-none focus:border-[#d4af37] ${isRunning ? 'opacity-80 cursor-not-allowed' : ''}`}
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
                                <label className="text-gray-400 text-xs font-medium shrink-0 w-16">Enter Points:</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={inputPoints}
                                    onChange={(e) => setInputPoints(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="Point"
                                    className="no-spinner flex-1 min-w-0 bg-[#202124] border border-white/10 text-white placeholder-gray-500 rounded-full py-2 min-h-[36px] px-4 text-center text-xs focus:ring-2 focus:ring-[#d4af37] focus:border-[#d4af37] focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="w-full min-w-0 md:flex md:justify-center md:items-center pt-1 md:pt-6">
                        <div className="grid grid-cols-3 gap-2 w-full max-w-[260px] md:max-w-[200px] mx-auto">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                <button key={num} type="button" onClick={() => handleDigitClick(num)} className="relative aspect-square min-h-[40px] bg-[#202124] border border-white/10 hover:border-[#d4af37]/50 text-[#f2c14e] rounded-lg font-bold text-sm flex items-center justify-center transition-all active:scale-95 shadow-md">
                                    {num}
                                    {pointsByDigit[num] > 0 && <span className="absolute top-0.5 right-1 text-[10px] font-bold text-[#f2c14e]">{pointsByDigit[num]}</span>}
                                </button>
                            ))}
                            <div className="col-span-3 flex justify-center">
                                <button type="button" onClick={() => handleDigitClick(0)} className="relative aspect-square min-w-[40px] min-h-[40px] w-14 bg-[#202124] border border-white/10 hover:border-[#d4af37]/50 text-[#f2c14e] rounded-lg font-bold text-sm flex items-center justify-center transition-all active:scale-95 shadow-md">
                                    0
                                    {pointsByDigit[0] > 0 && <span className="absolute top-0.5 right-1 text-[10px] font-bold text-[#f2c14e]">{pointsByDigit[0]}</span>}
                                </button>
                            </div>
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
