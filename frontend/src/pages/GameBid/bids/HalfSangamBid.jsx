import React, { useEffect, useMemo, useRef, useState } from 'react';
import BidLayout from '../BidLayout';
import BidReviewModal from './BidReviewModal';
import { isValidAnyPana } from './panaRules';
import { placeBet, updateUserBalance } from '../../../api/bets';

const sanitizeDigits = (v, maxLen) => (v ?? '').toString().replace(/\D/g, '').slice(0, maxLen);
const sanitizePoints = (v) => (v ?? '').toString().replace(/\D/g, '').slice(0, 6);

const quickPointValues = [10, 20, 30, 40, 50];

const emptyAnkPts = () =>
    Object.fromEntries(Array.from({ length: 10 }, (_, i) => [String(i), '']));

// Half Sangam — UI aligned with Triple Pana / Double Pana easy layout
const HalfSangamBid = ({ market, title }) => {
    const [flipped, setFlipped] = useState(false);
    const [session, setSession] = useState(() => (market?.status === 'running' ? 'CLOSE' : 'OPEN'));
    const [bids, setBids] = useState([]);
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [warning, setWarning] = useState('');
    const [easyFormKey, setEasyFormKey] = useState(0);
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

    const [specialFlipped, setSpecialFlipped] = useState(false);
    const [specialPana, setSpecialPana] = useState('');
    const [specialAnkPts, setSpecialAnkPts] = useState(emptyAnkPts);
    const [specialPanaInvalid, setSpecialPanaInvalid] = useState(false);

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
            const val = u?.wallet ?? u?.balance ?? u?.points ?? u?.walletAmount ?? u?.wallet_amount ?? u?.amount ?? 0;
            const n = Number(val);
            return Number.isFinite(n) ? n : 0;
        } catch (e) {
            return 0;
        }
    }, []);

    const marketTitle = market?.gameName || market?.marketName || title;
    const dateText = new Date().toLocaleDateString('en-GB');
    const totalPoints = useMemo(() => bids.reduce((sum, b) => sum + Number(b.points || 0), 0), [bids]);
    const isRunning = market?.status === 'running';

    useEffect(() => {
        if (isRunning) setSession('CLOSE');
    }, [isRunning]);

    const submitBtnClass = (enabled) =>
        enabled
            ? 'w-full bg-[#1B3150] text-white font-bold py-3.5 min-h-[48px] rounded-lg shadow-md hover:bg-[#152842] transition-all active:scale-[0.98]'
            : 'w-full bg-gray-400 text-white font-bold py-3.5 min-h-[48px] rounded-lg shadow-md opacity-50 cursor-not-allowed';

    const mergeBidRow = (prev, numberKey, pts) => {
        const next = [...prev];
        const idx = next.findIndex((b) => String(b.number) === numberKey && String(b.type) === String(session));
        if (idx >= 0) {
            const cur = Number(next[idx].points || 0) || 0;
            next[idx] = { ...next[idx], points: String(cur + pts) };
            return next;
        }
        return [...next, { id: Date.now() + Math.random(), number: numberKey, points: String(pts), type: session }];
    };

    const clearAll = () => {
        setIsReviewOpen(false);
        setBids([]);
        setEasyFormKey((k) => k + 1);
        setSpecialPana('');
        setSpecialAnkPts(emptyAnkPts());
        setSpecialPanaInvalid(false);
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
                betType: 'half-sangam',
                betNumber: String(b?.number ?? '').trim(),
                amount: Number(b?.points) || 0,
                betOn: String(b?.type || session).toUpperCase() === 'CLOSE' ? 'close' : 'open',
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

    const handleDelete = (id) => setBids((prev) => prev.filter((b) => b.id !== id));

    const openReview = () => {
        if (!bids.length) {
            showWarning('Please add at least one Sangam.');
            return;
        }
        setIsReviewOpen(true);
    };

    const handleFormClearEasy = () => {
        setBids([]);
        setEasyFormKey((k) => k + 1);
    };

    const handleAddSpecialBulk = () => {
        const pana = specialPana.toString().trim();
        if (!isValidAnyPana(pana)) {
            showWarning(specialFlipped ? 'Close Pana must be valid (3 digits).' : 'Open Pana must be valid (3 digits).');
            return;
        }
        const toMerge = [];
        for (let d = 0; d <= 9; d += 1) {
            const key = String(d);
            const pts = Number(specialAnkPts[key] || 0) || 0;
            if (pts <= 0) continue;
            const numberKey = specialFlipped ? `${key}-${pana}` : `${pana}-${key}`;
            toMerge.push({ numberKey, pts });
        }
        if (!toMerge.length) {
            showWarning('Enter points for at least one digit (0–9).');
            return;
        }
        setBids((prev) => {
            let next = prev;
            for (const { numberKey, pts } of toMerge) {
                next = mergeBidRow(next, numberKey, pts);
            }
            return next;
        });
        setSpecialPana('');
        setSpecialAnkPts(emptyAnkPts());
        setSpecialPanaInvalid(false);
    };

    // Count / Bet Amount cards only (EASY MODE / SPECIAL MODE removed as requested)
    const modeTabs = (
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
                                onClick={() => handleDelete(bid.id)}
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
            bidsCount={bids.length}
            totalPoints={totalPoints}
            showDateSession={true}
            showSessionOnMobile
            selectedDate={selectedDate}
            setSelectedDate={handleDateChange}
            session={session}
            setSession={setSession}
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
                            {modeTabs}
                            <HalfSangamEasyForm
                                key={easyFormKey}
                                flipped={flipped}
                                setFlipped={setFlipped}
                                setBids={setBids}
                                mergeBidRow={mergeBidRow}
                                showWarning={showWarning}
                                onClearAll={handleFormClearEasy}
                                onSubmitClick={openReview}
                                submitBtnClass={submitBtnClass}
                                bidsLength={bids.length}
                            />
                            <div className="md:hidden mt-4">{easyBidsList}</div>
                        </div>
                        <div className="hidden md:block">{easyBidsList}</div>
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

function HalfSangamEasyForm({
    flipped,
    setFlipped,
    setBids,
    mergeBidRow,
    showWarning,
    onClearAll,
    onSubmitClick,
    submitBtnClass,
    bidsLength,
}) {
    const [first, setFirst] = useState('');
    const [second, setSecond] = useState('');
    const [points, setPoints] = useState('');
    const [panaInvalid, setPanaInvalid] = useState(false);
    const pointsInputRef = useRef(null);

    const handleQuickPointClick = (pts) => {
        setPoints(String(pts));
    };

    const handleFlip = () => {
        setFlipped((prev) => !prev);
        setFirst('');
        setSecond('');
        setPoints('');
        setPanaInvalid(false);
    };

    const handleAdd = () => {
        const pts = Number(points);
        if (!pts || pts <= 0) {
            showWarning('Please enter points.');
            return;
        }
        const pana = flipped ? second : first;
        const ank = flipped ? first : second;
        if (!isValidAnyPana(pana)) {
            showWarning(flipped ? 'Close Pana must be a valid Pana.' : 'Open Pana must be a valid Pana.');
            return;
        }
        const ankStr = (ank ?? '').toString().trim();
        if (!/^[0-9]$/.test(ankStr)) {
            showWarning(flipped ? 'Please enter a valid Open Ank (0-9).' : 'Please enter a valid Close Ank (0-9).');
            return;
        }
        const numberKey = flipped ? `${ankStr}-${pana}` : `${pana}-${ankStr}`;
        setBids((prev) => mergeBidRow(prev, numberKey, pts));
        setFirst('');
        setSecond('');
        setPoints('');
        setPanaInvalid(false);
    };

    const handleFirstChange = (v) => {
        if (flipped) {
            setFirst(sanitizeDigits(v, 1));
        } else {
            const next = sanitizeDigits(v, 3);
            setFirst(next);
            setPanaInvalid(!!next && next.length === 3 && !isValidAnyPana(next));
            if (next.length === 3) pointsInputRef.current?.focus?.();
        }
    };

    const handleSecondChange = (v) => {
        if (flipped) {
            const next = sanitizeDigits(v, 3);
            setSecond(next);
            setPanaInvalid(!!next && next.length === 3 && !isValidAnyPana(next));
            if (next.length === 3) pointsInputRef.current?.focus?.();
        } else {
            setSecond(sanitizeDigits(v, 1));
        }
    };

    const firstLabel = flipped ? 'Open Ank:' : 'Enter Pana:';
    const secondLabel = flipped ? 'Close Pana:' : 'Close Ank:';
    const firstPlaceholder = flipped ? 'Ank' : 'Pana';
    const secondPlaceholder = flipped ? 'Pana' : 'Ank';
    const panaInputInvalid = flipped ? second.length === 3 && panaInvalid : first.length === 3 && panaInvalid;

    const inputBase =
        'flex-1 min-w-0 bg-white border-2 border-gray-300 text-gray-800 placeholder-gray-400 rounded-xl py-2.5 min-h-[40px] px-4 text-left text-sm focus:ring-2 focus:outline-none';

    return (
        <div className="flex flex-col gap-3 mt-2 mb-4 px-1">
            <div className="flex flex-row items-center gap-2">
                <button
                    type="button"
                    onClick={handleFlip}
                    aria-label="Flip between Open Pana plus Close Ank and Open Ank plus Close Pana"
                    className="w-full min-w-0 flex flex-row items-center justify-between gap-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2.5 min-h-[40px] rounded-xl border-2 border-gray-300 transition-all active:scale-[0.98]"
                >
                    <span>Flip (O) ↔ (C)</span>
                    <span className="shrink-0 text-[#1B3150]" aria-hidden>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                            />
                        </svg>
                    </span>
                </button>
            </div>
            <div className="flex flex-row items-center gap-2">
                <label className="text-gray-700 text-sm font-medium shrink-0 w-28">{firstLabel}</label>
                <input
                    type="text"
                    inputMode="numeric"
                    value={first}
                    onChange={(e) => handleFirstChange(e.target.value)}
                    placeholder={firstPlaceholder}
                    maxLength={flipped ? 1 : 3}
                    className={`${inputBase} ${
                        !flipped && panaInputInvalid
                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                            : 'focus:ring-[#1B3150] focus:border-[#1B3150]'
                    }`}
                />
            </div>
            <div className="flex flex-row items-center gap-2">
                <label className="text-gray-700 text-sm font-medium shrink-0 w-28">{secondLabel}</label>
                <input
                    type="text"
                    inputMode="numeric"
                    value={second}
                    onChange={(e) => handleSecondChange(e.target.value)}
                    placeholder={secondPlaceholder}
                    maxLength={flipped ? 3 : 1}
                    className={`${inputBase} ${
                        flipped && panaInputInvalid
                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                            : 'focus:ring-[#1B3150] focus:border-[#1B3150]'
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
                        className={`no-spinner w-full bg-white border-2 border-gray-300 text-gray-800 placeholder-gray-400 rounded-xl py-2.5 min-h-[40px] px-4 text-left text-sm focus:ring-2 focus:ring-[#1B3150] focus:border-[#1B3150] focus:outline-none`}
                    />
                    <button
                        type="button"
                        onClick={onClearAll}
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
            <div className="grid grid-cols-2 gap-3 mb-5 sm:mb-6">
                <button
                    type="button"
                    onClick={handleAdd}
                    className="w-full bg-[#1B3150] text-white font-bold py-3.5 min-h-[48px] rounded-lg shadow-md hover:bg-[#152842] transition-all active:scale-[0.98]"
                >
                    Add to List
                </button>
                <button type="button" disabled={!bidsLength} onClick={onSubmitClick} className={submitBtnClass(!!bidsLength)}>
                    Submit Bet
                </button>
            </div>
        </div>
    );
}

export default HalfSangamBid;
