import React, { useMemo, useRef, useState } from 'react';
import BidLayout from '../BidLayout';
import BidReviewModal from './BidReviewModal';
import { isValidAnyPana } from './panaRules';
import { placeBet, updateUserBalance } from '../../../api/bets';

const sanitizeDigits = (v, maxLen) => (v ?? '').toString().replace(/\D/g, '').slice(0, maxLen);
const sanitizePoints = (v) => (v ?? '').toString().replace(/\D/g, '').slice(0, 6);

// Half Sangam: single form with Flip to toggle (O) Open Pana+Close Ank ↔ (C) Open Ank+Close Pana
const HalfSangamBid = ({ market, title }) => {
    const [flipped, setFlipped] = useState(false);
    const [session, setSession] = useState('OPEN');
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
        try { localStorage.setItem('betSelectedDate', newDate); } catch (e) {}
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
        } catch (e) { return 0; }
    }, []);

    const marketTitle = market?.gameName || market?.marketName || title;
    const dateText = new Date().toLocaleDateString('en-GB');
    const totalPoints = useMemo(() => bids.reduce((sum, b) => sum + Number(b.points || 0), 0), [bids]);
    const submitBtnClass = (enabled) =>
        enabled
            ? 'w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-3.5 min-h-[48px] rounded-lg shadow-md hover:from-orange-600 hover:to-orange-700 transition-all active:scale-[0.98]'
            : 'w-full bg-gradient-to-r from-orange-300 to-orange-400 text-white font-bold py-3.5 min-h-[48px] rounded-lg shadow-md opacity-50 cursor-not-allowed';

    const clearAll = () => {
        setIsReviewOpen(false);
        setBids([]);
        const today = new Date().toISOString().split('T')[0];
        setSelectedDate(today);
        try { localStorage.removeItem('betSelectedDate'); } catch (e) {}
    };

    const handleSubmitBet = async () => {
        const marketId = market?._id || market?.id;
        if (!marketId) throw new Error('Market not found');
        if (!bids.length) throw new Error('No bets to place');
        const payload = bids.map((b) => ({
            betType: 'half-sangam',
            betNumber: String(b?.number ?? '').trim(),
            amount: Number(b?.points) || 0,
            betOn: String(b?.type || session).toUpperCase() === 'CLOSE' ? 'close' : 'open',
        })).filter((b) => b.betNumber && b.amount > 0);
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
        if (!bids.length) { showWarning('Please add at least one Sangam.'); return; }
        setIsReviewOpen(true);
    };

    const inputCl = 'flex-1 min-w-0 bg-white border-2 border-gray-800 text-gray-800 placeholder-gray-400 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm focus:ring-2 focus:outline-none focus:ring-gray-500 focus:border-gray-800';
    const labelCl = 'text-gray-900 text-sm font-medium shrink-0 w-40';

    return (
        <BidLayout
            market={market}
            title={title}
            bidsCount={bids.length}
            totalPoints={totalPoints}
            showDateSession={true}
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
            <div className="px-3 sm:px-4 py-4 md:max-w-7xl md:mx-auto">
                {warning && (
                    <div className="mb-4 bg-red-50 border-2 border-red-300 text-red-600 rounded-xl px-4 py-3 text-sm">
                        {warning}
                    </div>
                )}

                <div className="md:grid md:grid-cols-2 md:gap-12 md:items-start space-y-8 md:space-y-0">
                    {/* Left: Single form with Flip toggle (O)/(C) */}
                    <div className="space-y-6 [&>div:last-child]:-mt-3">
                        <HalfSangamFormSection
                            flipped={flipped}
                            setFlipped={setFlipped}
                            bids={bids}
                            setBids={setBids}
                            session={session}
                            showWarning={showWarning}
                            inputCl={inputCl}
                            labelCl={labelCl}
                            sanitizeDigits={sanitizeDigits}
                            sanitizePoints={sanitizePoints}
                            isValidAnyPana={isValidAnyPana}
                        />

                        <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
                            <button
                                type="button"
                                onClick={openReview}
                                disabled={!bids.length}
                                className={submitBtnClass(!!bids.length)}
                            >
                                Submit Bet
                            </button>
                        </div>
                    </div>

                    {/* Right: combined list */}
                    <div className="mt-10 md:mt-0">
                        <div className="grid grid-cols-[1.4fr_0.7fr_0.6fr] gap-2 sm:gap-3 text-center text-orange-500 font-bold text-xs sm:text-sm mb-2 px-2">
                            <div className="truncate">Sangam</div>
                            <div className="truncate">Amount</div>
                            <div className="truncate">Delete</div>
                        </div>
                        <div className="h-px bg-orange-200 w-full mb-2" />
                        {bids.length === 0 ? null : (
                            <div className="space-y-2">
                                {bids.map((b) => (
                                    <div
                                        key={b.id}
                                        className="grid grid-cols-[1.4fr_0.7fr_0.6fr] gap-2 sm:gap-3 text-center items-center py-2.5 px-3 bg-orange-50 rounded-lg border-2 border-gray-800 text-sm"
                                    >
                                        <div className="font-bold text-gray-800 truncate">{b.number}</div>
                                        <div className="font-bold text-orange-500 truncate">{b.points}</div>
                                        <div className="flex justify-center">
                                            <button type="button" onClick={() => handleDelete(b.id)} className="p-2 text-red-500 hover:text-red-600 active:scale-95" aria-label="Delete">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <BidReviewModal
                open={isReviewOpen}
                onClose={clearAll}
                onSubmit={handleSubmitBet}
                marketTitle={marketTitle}
                dateText={dateText}
                labelKey="Sangam"
                rows={bids}
                walletBefore={walletBefore}
                totalBids={bids.length}
                totalAmount={totalPoints}
            />
        </BidLayout>
    );
};

// Single form: Flip toggles between (O) Open Pana+Close Ank and (C) Open Ank+Close Pana
function HalfSangamFormSection({ flipped, setFlipped, bids, setBids, session, showWarning, inputCl, labelCl, sanitizeDigits, sanitizePoints, isValidAnyPana }) {
    // (O): first=pana, second=ank | (C): first=ank, second=pana
    const [first, setFirst] = useState('');
    const [second, setSecond] = useState('');
    const [points, setPoints] = useState('');
    const [panaInvalid, setPanaInvalid] = useState(false);
    const pointsInputRef = useRef(null);

    const handleFlip = () => {
        setFlipped((prev) => !prev);
        setFirst('');
        setSecond('');
        setPoints('');
        setPanaInvalid(false);
    };

    const handleAdd = () => {
        const pts = Number(points);
        if (!pts || pts <= 0) { showWarning('Please enter points.'); return; }
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
        setBids((prev) => {
            const next = [...prev];
            const idx = next.findIndex((b) => String(b.number) === numberKey && String(b.type) === String(session));
            if (idx >= 0) {
                const cur = Number(next[idx].points || 0) || 0;
                next[idx] = { ...next[idx], points: String(cur + pts) };
                return next;
            }
            return [...next, { id: Date.now() + Math.random(), number: numberKey, points: String(pts), type: session }];
        });
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

    const firstLabel = flipped ? 'Open Ank:' : 'Open Pana:';
    const secondLabel = flipped ? 'Close Pana:' : 'Close Ank:';
    const firstPlaceholder = flipped ? 'Ank' : 'Pana';
    const secondPlaceholder = flipped ? 'Pana' : 'Ank';
    const titleText = flipped ? 'Half Sangam (C) — Open Ank + Close Pana' : 'Half Sangam (O) — Open Pana + Close Ank';
    const panaInputInvalid = flipped ? (second.length === 3 && panaInvalid) : (first.length === 3 && panaInvalid);

    return (
        <div className="p-4 space-y-3">
            <h3 className="text-orange-600 font-semibold text-sm">{titleText}</h3>
            <div className="flex flex-row items-center gap-2">
                <label className={labelCl}>{firstLabel}</label>
                <input
                    type="text"
                    inputMode="numeric"
                    value={first}
                    onChange={(e) => handleFirstChange(e.target.value)}
                    placeholder={firstPlaceholder}
                    className={`${inputCl} ${!flipped && panaInputInvalid ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                />
            </div>
            <div className="flex flex-row items-center gap-2">
                <span className="shrink-0 w-40" />
                <button
                    type="button"
                    onClick={handleFlip}
                    className="flex-1 min-w-0 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2.5 min-h-[40px] rounded-full shadow-sm transition-all active:scale-[0.98]"
                >
                    Flip
                </button>
            </div>
            <div className="flex flex-row items-center gap-2">
                <label className={labelCl}>{secondLabel}</label>
                <input
                    type="text"
                    inputMode="numeric"
                    value={second}
                    onChange={(e) => handleSecondChange(e.target.value)}
                    placeholder={secondPlaceholder}
                    className={`${inputCl} ${flipped && panaInputInvalid ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                />
            </div>
            <div className="flex flex-row items-center gap-2">
                <label className={labelCl}>Points:</label>
                <input
                    ref={pointsInputRef}
                    type="text"
                    inputMode="numeric"
                    value={points}
                    onChange={(e) => setPoints(sanitizePoints(e.target.value))}
                    placeholder="Point"
                    className={`no-spinner ${inputCl}`}
                />
            </div>
            <button type="button" onClick={handleAdd} className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-3 min-h-[44px] rounded-lg shadow-md hover:from-orange-600 hover:to-orange-700 transition-all active:scale-[0.98]">
                Add to List
            </button>
        </div>
    );
}

export default HalfSangamBid;
