import React, { useMemo, useRef, useState } from 'react';
import BidLayout from '../BidLayout';
import BidReviewModal from './BidReviewModal';
import { isValidAnyPana } from './panaRules';
import { placeBet, updateUserBalance } from '../../../api/bets';

const sanitizeDigits = (v, maxLen) => (v ?? '').toString().replace(/\D/g, '').slice(0, maxLen);
const sanitizePoints = (v) => (v ?? '').toString().replace(/\D/g, '').slice(0, 6);

// Half Sangam (O): Open Pana (3 digits) + Close Ank (1 digit)
const HalfSangamABid = ({ market, title }) => {
    const [session, setSession] = useState('OPEN');
    const [openPana, setOpenPana] = useState('');
    const [closeAnk, setCloseAnk] = useState('');
    const [points, setPoints] = useState('');
    const pointsInputRef = useRef(null);
    const [openPanaInvalid, setOpenPanaInvalid] = useState(false);
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

    const marketTitle = market?.gameName || market?.marketName || title;
    const dateText = new Date().toLocaleDateString('en-GB');

    const totalPoints = useMemo(() => bids.reduce((sum, b) => sum + Number(b.points || 0), 0), [bids]);
    const submitBtnClass = (enabled) =>
        enabled
            ? 'w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-3.5 min-h-[48px] rounded-lg shadow-md hover:from-orange-600 hover:to-orange-700 transition-all active:scale-[0.98]'
            : 'w-full bg-gradient-to-r from-orange-300 to-orange-400 text-white font-bold py-3.5 min-h-[48px] rounded-lg shadow-md opacity-50 cursor-not-allowed';

    const clearAll = () => {
        setIsReviewOpen(false);
        setOpenPana('');
        setCloseAnk('');
        setPoints('');
        setBids([]);
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
        if (!bids.length) throw new Error('No bets to place');
        const payload = bids.map((b) => ({
            betType: 'half-sangam',
            betNumber: String(b?.number ?? '').trim(),
            amount: Number(b?.points) || 0,
            betOn: String(b?.type || session).toUpperCase() === 'CLOSE' ? 'close' : 'open',
        })).filter((b) => b.betNumber && b.amount > 0);
        if (!payload.length) throw new Error('No valid bets to place');
        
        // Check if date is in the future (scheduled bet)
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
            showWarning('Open Pana must be a valid Pana (Single / Double / Triple).');
            return;
        }
        const enteredCloseAnk = (closeAnk ?? '').toString().trim();
        if (!/^[0-9]$/.test(enteredCloseAnk)) {
            showWarning('Please enter a valid Close Ank (0-9).');
            return;
        }

        const numberKey = `${openPana}-${enteredCloseAnk}`;
        setBids((prev) => {
            const next = [...prev];
            const idx = next.findIndex((b) => String(b.number) === numberKey && String(b.type) === String(session));
            if (idx >= 0) {
                const cur = Number(next[idx].points || 0) || 0;
                next[idx] = { ...next[idx], points: String(cur + pts) };
                return next;
            }
            return [
                ...next,
                {
                    id: Date.now() + Math.random(),
                    number: numberKey,
                    points: String(pts),
                    type: session,
                },
            ];
        });
        setOpenPana('');
        setCloseAnk('');
        setPoints('');
    };

    const handleDelete = (id) => setBids((prev) => prev.filter((b) => b.id !== id));

    const openReview = () => {
        if (!bids.length) {
            showWarning('Please add at least one Sangam.');
            return;
        }
        setIsReviewOpen(true);
    };

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
                <div className="md:grid md:grid-cols-2 md:gap-12 md:items-start">
                    {/* Left: inputs + actions */}
                    <div className="space-y-4">
                        {warning && (
                            <div className="bg-red-50 border-2 border-red-300 text-red-600 rounded-xl px-4 py-3 text-sm">
                                {warning}
                            </div>
                        )}

                        <div className="flex flex-col gap-3">
                            <div className="flex flex-row items-center gap-2">
                                <label className="text-gray-700 text-sm font-medium shrink-0 w-40">Enter Open Pana:</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={openPana}
                                    onChange={(e) => {
                                        const prevLen = (openPana ?? '').toString().length;
                                        const next = sanitizeDigits(e.target.value, 3);
                                        setOpenPana(next);
                                        setOpenPanaInvalid(!!next && next.length === 3 && !isValidAnyPana(next));
                                        if (next.length === 3 && prevLen < 3) {
                                            if (!isValidAnyPana(next)) {
                                                showWarning('Open Pana must be a valid Single / Double / Triple Pana (3 digits).');
                                                return;
                                            }
                                            window.requestAnimationFrame(() => {
                                                pointsInputRef.current?.focus?.();
                                            });
                                        }
                                    }}
                                    placeholder="Pana"
                                    className={`flex-1 min-w-0 bg-white border-2 border-orange-200 text-gray-800 placeholder-gray-400 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm focus:ring-2 focus:outline-none ${
                                        openPanaInvalid ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'focus:ring-orange-500 focus:border-orange-500'
                                    }`}
                                />
                            </div>

                            <div className="flex flex-row items-center gap-2">
                                <label className="text-gray-700 text-sm font-medium shrink-0 w-40">Enter Close Ank:</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={closeAnk}
                                    onChange={(e) => setCloseAnk(sanitizeDigits(e.target.value, 1))}
                                    placeholder="Ank"
                                    className="flex-1 min-w-0 bg-white border-2 border-orange-200 text-gray-800 placeholder-gray-400 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none"
                                />
                            </div>

                            <div className="flex flex-row items-center gap-2">
                                <label className="text-gray-700 text-sm font-medium shrink-0 w-40">Enter Points:</label>
                                <input
                                    ref={pointsInputRef}
                                    type="text"
                                    inputMode="numeric"
                                    value={points}
                                    onChange={(e) => setPoints(sanitizePoints(e.target.value))}
                                    placeholder="Point"
                                    className="no-spinner flex-1 min-w-0 bg-white border-2 border-orange-200 text-gray-800 placeholder-gray-400 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-5 sm:mb-6 md:grid-cols-1">
                            <button
                                type="button"
                                onClick={handleAdd}
                                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-3.5 min-h-[48px] rounded-lg shadow-md hover:from-orange-600 hover:to-orange-700 transition-all active:scale-[0.98]"
                            >
                                Add to List
                            </button>

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

                    {/* Right: list */}
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
                                        className="grid grid-cols-[1.4fr_0.7fr_0.6fr] gap-2 sm:gap-3 text-center items-center py-2.5 px-3 bg-orange-50 rounded-lg border-2 border-orange-200 text-sm"
                                    >
                                        <div className="font-bold text-gray-800 truncate">{b.number}</div>
                                        <div className="font-bold text-orange-500 truncate">{b.points}</div>
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

export default HalfSangamABid;
