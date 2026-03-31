import React, { useMemo, useRef, useState } from 'react';
import BidLayout from '../BidLayout';
import BidReviewModal from './BidReviewModal';
import { placeBet, updateUserBalance } from '../../../api/bets';
import { isValidAnyPana } from './panaRules';

const sanitizeDigits = (v, maxLen) => (v ?? '').toString().replace(/\D/g, '').slice(0, maxLen);
const sanitizePoints = (v) => (v ?? '').toString().replace(/\D/g, '').slice(0, 6);
const quickPointValues = [10, 20, 30, 40, 50];

const FullSangamBid = ({ market, title }) => {
    const [session, setSession] = useState('OPEN');
    const [openPana, setOpenPana] = useState('');
    const [closePana, setClosePana] = useState('');
    const [points, setPoints] = useState('');
    const pointsInputRef = useRef(null);
    const [openPanaInvalid, setOpenPanaInvalid] = useState(false);
    const [closePanaInvalid, setClosePanaInvalid] = useState(false);
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

    const walletBefore = useMemo(() => {
        try {
            const u = JSON.parse(localStorage.getItem('user') || 'null');
            const val = u?.wallet || u?.balance || u?.points || u?.walletAmount || u?.wallet_amount || u?.amount || 0;
            const n = Number(val);
            return Number.isFinite(n) ? n : 0;
        } catch (e) {
            return 0;
        }
    }, []);

    const marketTitle = market?.gameName || market?.marketName || title;
    const dateText = new Date().toLocaleDateString('en-GB');
    const totalPoints = useMemo(() => bids.reduce((sum, b) => sum + Number(b.points || 0), 0), [bids]);

    const submitBtnClass = (enabled) =>
        enabled
            ? 'w-full bg-[#1B3150] text-white font-bold py-3.5 min-h-[48px] rounded-lg shadow-md hover:bg-[#152842] transition-all active:scale-[0.98]'
            : 'w-full bg-gray-400 text-white font-bold py-3.5 min-h-[48px] rounded-lg shadow-md opacity-50 cursor-not-allowed';

    const clearAll = () => {
        setIsReviewOpen(false);
        setOpenPana('');
        setClosePana('');
        setPoints('');
        setOpenPanaInvalid(false);
        setClosePanaInvalid(false);
        setBids([]);
        const today = new Date().toISOString().split('T')[0];
        setSelectedDate(today);
        try {
            localStorage.removeItem('betSelectedDate');
        } catch (e) {}
    };

    const handleSubmitBet = async () => {
        const marketId = market?._id || market?.id;
        if (!marketId) throw new Error('Market not found');
        if (!bids.length) throw new Error('No bets to place');
        const payload = bids
            .map((b) => ({
                betType: 'full-sangam',
                betNumber: String(b?.number ?? '').trim(),
                amount: Number(b?.points) || 0,
                betOn: 'open',
            }))
            .filter((b) => b.betNumber && b.amount > 0);
        if (!payload.length) throw new Error('No valid bets to place');

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selectedDateObj = new Date(selectedDate);
        selectedDateObj.setHours(0, 0, 0, 0);
        const scheduledDate = selectedDateObj > today ? selectedDate : null;

        const result = await placeBet(marketId, payload, scheduledDate);
        if (!result.success) throw new Error(result.message || 'Failed to place bet');
        if (result.data?.newBalance != null) updateUserBalance(result.data.newBalance);
        clearAll();
    };

    const handleAdd = () => {
        const pts = Number(points);
        if (!pts || pts <= 0) {
            showWarning('Please enter points.');
            return;
        }
        if (!isValidAnyPana(openPana)) {
            showWarning('Open Pana must be valid (3 digits).');
            return;
        }
        if (!isValidAnyPana(closePana)) {
            showWarning('Close Pana must be valid (3 digits).');
            return;
        }

        const numberKey = `${openPana}-${closePana}`;
        setBids((prev) => {
            const next = [...prev];
            const idx = next.findIndex((b) => String(b.number) === numberKey);
            if (idx >= 0) {
                const cur = Number(next[idx].points || 0) || 0;
                next[idx] = { ...next[idx], points: String(cur + pts) };
                return next;
            }
            return [...next, { id: Date.now() + Math.random(), number: numberKey, points: String(pts), type: 'OPEN' }];
        });

        setOpenPana('');
        setClosePana('');
        setPoints('');
        setOpenPanaInvalid(false);
        setClosePanaInvalid(false);
    };

    const handleDelete = (id) => setBids((prev) => prev.filter((b) => b.id !== id));
    const openReview = () => {
        if (!bids.length) {
            showWarning('Please add at least one Sangam.');
            return;
        }
        setIsReviewOpen(true);
    };

    const handleQuickPointClick = (pts) => {
        setPoints(String(pts));
    };

    const handleFormClear = () => {
        setBids([]);
        setOpenPana('');
        setClosePana('');
        setPoints('');
        setOpenPanaInvalid(false);
        setClosePanaInvalid(false);
    };

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
            session={session}
            setSession={setSession}
            sessionOptionsOverride={['OPEN']}
            lockSessionSelect
            hideSessionSelectCaret
            hideFooter
            walletBalance={walletBefore}
            contentPaddingClass="pb-[calc(7rem+env(safe-area-inset-bottom,0px))] md:pb-6"
        >
            <div className="px-3 sm:px-4 py-2 sm:py-2 md:max-w-7xl md:mx-auto md:items-start">
                <div className="space-y-4">
                    {warning && (
                        <div className="bg-red-50 border-2 border-red-300 text-red-600 rounded-xl px-4 py-3 text-sm">
                            {warning}
                        </div>
                    )}

                    <div className="md:grid md:grid-cols-2 md:gap-6 md:items-start">
                        <div>
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

                            <div className="flex flex-col gap-3 mt-2 mb-4 px-1">
                                <div className="flex flex-row items-center gap-2">
                                    <label className="text-gray-700 text-sm font-medium shrink-0 w-28">Enter Open:</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={openPana}
                                        onChange={(e) => {
                                            const next = sanitizeDigits(e.target.value, 3);
                                            setOpenPana(next);
                                            setOpenPanaInvalid(!!next && next.length === 3 && !isValidAnyPana(next));
                                            if (next.length === 3 && isValidAnyPana(next)) {
                                                window.requestAnimationFrame(() => pointsInputRef.current?.focus?.());
                                            }
                                        }}
                                        placeholder="Pana"
                                        maxLength={3}
                                        className={`flex-1 min-w-0 bg-white border-2 border-gray-300 text-gray-800 placeholder-gray-400 rounded-xl py-2.5 min-h-[40px] px-4 text-left text-sm focus:ring-2 focus:outline-none ${
                                            openPanaInvalid ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'focus:ring-[#1B3150] focus:border-[#1B3150]'
                                        }`}
                                    />
                                </div>

                                <div className="flex flex-row items-center gap-2">
                                    <label className="text-gray-700 text-sm font-medium shrink-0 w-28">Enter Close:</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={closePana}
                                        onChange={(e) => {
                                            const next = sanitizeDigits(e.target.value, 3);
                                            setClosePana(next);
                                            setClosePanaInvalid(!!next && next.length === 3 && !isValidAnyPana(next));
                                        }}
                                        placeholder="Pana"
                                        maxLength={3}
                                        className={`flex-1 min-w-0 bg-white border-2 border-gray-300 text-gray-800 placeholder-gray-400 rounded-xl py-2.5 min-h-[40px] px-4 text-left text-sm focus:ring-2 focus:outline-none ${
                                            closePanaInvalid ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'focus:ring-[#1B3150] focus:border-[#1B3150]'
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
                                            value={points}
                                            onChange={(e) => setPoints(sanitizePoints(e.target.value))}
                                            placeholder="Points"
                                            className="no-spinner w-full bg-white border-2 border-gray-300 text-gray-800 placeholder-gray-400 rounded-xl py-2.5 min-h-[40px] px-4 text-left text-sm focus:ring-2 focus:ring-[#1B3150] focus:border-[#1B3150] focus:outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleFormClear}
                                            className="px-4 min-h-[40px] rounded-xl border-2 border-gray-300 bg-white text-[#1B3150] text-sm font-medium hover:border-[#1B3150] active:scale-95"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-row items-center gap-2">
                                    <label className="text-gray-700 text-sm font-medium shrink-0 w-28">Quick Points</label>
                                    <div className="flex-1 min-w-0 grid grid-cols-5 gap-2">
                                        {quickPointValues.map((v) => (
                                            <button
                                                key={v}
                                                type="button"
                                                onClick={() => handleQuickPointClick(v)}
                                                className="py-2 min-h-[36px] rounded-lg border-2 border-gray-300 bg-white text-sm font-medium text-[#1B3150] hover:border-[#1B3150] active:scale-95"
                                            >
                                                {v}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-5 sm:mb-6 px-1">
                                <button
                                    type="button"
                                    onClick={handleAdd}
                                    className="w-full bg-[#1B3150] text-white font-bold py-3.5 min-h-[48px] rounded-lg shadow-md hover:bg-[#152842] transition-all active:scale-[0.98]"
                                >
                                    Add to List
                                </button>
                                <button type="button" onClick={openReview} disabled={!bids.length} className={submitBtnClass(!!bids.length)}>
                                    Submit Bet
                                </button>
                            </div>

                            <div className="md:hidden">
                                <div className="grid grid-cols-4 gap-1 sm:gap-2 text-center text-[#1B3150] font-bold text-xs sm:text-sm mb-2 px-1">
                                    <div>Pana</div>
                                    <div>Point</div>
                                    <div>Type</div>
                                    <div>Delete</div>
                                </div>
                                <div className="h-px bg-[#1B3150] w-full mb-2" />
                                <div className="space-y-2">
                                    {bids.map((b) => (
                                        <div
                                            key={b.id}
                                            className="grid grid-cols-4 gap-1 sm:gap-2 text-center items-center py-2.5 px-2 bg-gray-50 rounded-lg border-2 border-gray-300 text-sm"
                                        >
                                            <div className="font-bold text-gray-800">{b.number}</div>
                                            <div className="font-bold text-[#1B3150]">{b.points}</div>
                                            <div className="text-sm text-gray-600">{b.type}</div>
                                            <div className="flex justify-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(b.id)}
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
                            </div>
                        </div>

                        <div className="hidden md:block">
                            <div className="grid grid-cols-4 gap-1 sm:gap-2 text-center text-[#1B3150] font-bold text-xs sm:text-sm mb-2 px-1">
                                <div>Pana</div>
                                <div>Point</div>
                                <div>Type</div>
                                <div>Delete</div>
                            </div>
                            <div className="h-px bg-[#1B3150] w-full mb-2" />
                            <div className="space-y-2">
                                {bids.map((b) => (
                                    <div
                                        key={b.id}
                                        className="grid grid-cols-4 gap-1 sm:gap-2 text-center items-center py-2.5 px-2 bg-gray-50 rounded-lg border-2 border-gray-300 text-sm"
                                    >
                                        <div className="font-bold text-gray-800">{b.number}</div>
                                        <div className="font-bold text-[#1B3150]">{b.points}</div>
                                        <div className="text-sm text-gray-600">{b.type}</div>
                                        <div className="flex justify-center">
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(b.id)}
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

export default FullSangamBid;
