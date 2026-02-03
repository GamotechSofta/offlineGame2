import React, { useMemo, useState } from 'react';
import BidLayout from '../BidLayout';
import BidReviewModal from './BidReviewModal';
import { isValidAnyPana } from './panaRules';

const sanitizeDigits = (v, maxLen) => (v ?? '').toString().replace(/\D/g, '').slice(0, maxLen);
const sanitizePoints = (v) => (v ?? '').toString().replace(/\D/g, '').slice(0, 6);

// Half Sangam (C): Open Ank (1 digit) + Close Pana (3 digits)
const HalfSangamBBid = ({ market, title }) => {
    const [session, setSession] = useState('CLOSE');
    const [openAnk, setOpenAnk] = useState('');
    const [closePana, setClosePana] = useState('');
    const [points, setPoints] = useState('');
    const [bids, setBids] = useState([]);
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [warning, setWarning] = useState('');

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
            ? 'w-full bg-gradient-to-r from-[#d4af37] to-[#cca84d] text-[#4b3608] font-bold py-3.5 min-h-[48px] rounded-lg shadow-md hover:from-[#e5c04a] hover:to-[#d4af37] transition-all active:scale-[0.98]'
            : 'w-full bg-gradient-to-r from-[#d4af37] to-[#cca84d] text-[#4b3608] font-bold py-3.5 min-h-[48px] rounded-lg shadow-md opacity-50 cursor-not-allowed';

    const computeOpenAnkFromPana = (pana) => {
        const s = (pana ?? '').toString().trim();
        if (!/^[0-9]{3}$/.test(s)) return '';
        const sum = Number(s[0]) + Number(s[1]) + Number(s[2]);
        return String(sum % 10);
    };

    const clearAll = () => {
        setIsReviewOpen(false);
        setOpenAnk('');
        setClosePana('');
        setPoints('');
        setBids([]);
    };

    const handleAdd = () => {
        const pts = Number(points);
        if (!pts || pts <= 0) {
            showWarning('Please enter points.');
            return;
        }
        if (!isValidAnyPana(closePana)) {
            showWarning('Close Pana must be a valid Pana (Single / Double / Triple).');
            return;
        }
        const derivedOpenAnk = computeOpenAnkFromPana(closePana);
        if (!/^[0-9]$/.test(derivedOpenAnk)) {
            showWarning('Open Ank could not be calculated. Please re-enter Close Pana.');
            return;
        }

        setBids((prev) => [
            ...prev,
            {
                id: Date.now() + Math.random(),
                number: `${derivedOpenAnk}-${closePana}`,
                points: String(pts),
                type: session,
            },
        ]);
        setOpenAnk('');
        setClosePana('');
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
            showDateSession
            session={session}
            setSession={setSession}
            sessionOptionsOverride={['CLOSE']}
            lockSessionSelect
            hideFooter
            walletBalance={walletBefore}
            contentPaddingClass="pb-24 md:pb-6"
        >
            <div className="px-3 sm:px-4 py-4 md:max-w-7xl md:mx-auto">
                <div className="md:grid md:grid-cols-2 md:gap-12 md:items-start">
                    {/* Left: inputs + actions */}
                    <div className="space-y-4">
                        {warning && (
                            <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-xl px-4 py-3 text-sm">
                                {warning}
                            </div>
                        )}

                        <div className="flex flex-col gap-3">
                            <div className="flex flex-row items-center gap-2">
                                <label className="text-gray-400 text-sm font-medium shrink-0 w-40">Enter Open Ank:</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={openAnk}
                                    readOnly
                                    placeholder="Ank"
                                    className="flex-1 min-w-0 bg-[#202124] border border-white/10 text-white placeholder-gray-500 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm opacity-80 cursor-not-allowed focus:outline-none"
                                />
                            </div>

                            <div className="flex flex-row items-center gap-2">
                                <label className="text-gray-400 text-sm font-medium shrink-0 w-40">Enter Close Pana:</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={closePana}
                                    onChange={(e) => {
                                        const next = sanitizeDigits(e.target.value, 3);
                                        setClosePana(next);
                                        setOpenAnk(computeOpenAnkFromPana(next));
                                    }}
                                    placeholder="Pana"
                                    className="flex-1 min-w-0 bg-[#202124] border border-white/10 text-white placeholder-gray-500 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm focus:ring-2 focus:ring-[#d4af37] focus:border-[#d4af37] focus:outline-none"
                                />
                            </div>

                            <div className="flex flex-row items-center gap-2">
                                <label className="text-gray-400 text-sm font-medium shrink-0 w-40">Enter Points:</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={points}
                                    onChange={(e) => setPoints(sanitizePoints(e.target.value))}
                                    placeholder="Point"
                                    className="no-spinner flex-1 min-w-0 bg-[#202124] border border-white/10 text-white placeholder-gray-500 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm focus:ring-2 focus:ring-[#d4af37] focus:border-[#d4af37] focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-5 sm:mb-6 md:grid-cols-1">
                            <button
                                type="button"
                                onClick={handleAdd}
                                className="w-full bg-gradient-to-r from-[#d4af37] to-[#cca84d] text-[#4b3608] font-bold py-3.5 min-h-[48px] rounded-lg shadow-md hover:from-[#e5c04a] hover:to-[#d4af37] transition-all active:scale-[0.98]"
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
                        <div className="grid grid-cols-[1.4fr_0.7fr_0.6fr] gap-2 sm:gap-3 text-center text-[#d4af37] font-bold text-xs sm:text-sm mb-2 px-2">
                            <div className="truncate">Sangam</div>
                            <div className="truncate">Amount</div>
                            <div className="truncate">Delete</div>
                        </div>
                        <div className="h-px bg-white/10 w-full mb-2" />

                        {bids.length === 0 ? null : (
                            <div className="space-y-2">
                                {bids.map((b) => (
                                    <div
                                        key={b.id}
                                        className="grid grid-cols-[1.4fr_0.7fr_0.6fr] gap-2 sm:gap-3 text-center items-center py-2.5 px-3 bg-[#202124] rounded-lg border border-white/10 text-sm"
                                    >
                                        <div className="font-bold text-white truncate">{b.number}</div>
                                        <div className="font-bold text-[#f2c14e] truncate">{b.points}</div>
                                        <div className="flex justify-center">
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(b.id)}
                                                className="p-2 text-red-400 hover:text-red-300 active:scale-95"
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
                onSubmit={clearAll}
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

export default HalfSangamBBid;
