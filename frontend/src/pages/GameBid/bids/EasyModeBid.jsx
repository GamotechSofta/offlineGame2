import React, { useMemo, useState } from 'react';
import BidLayout from '../BidLayout';
import BidReviewModal from './BidReviewModal';

const EasyModeBid = ({
    market,
    title,
    label,
    maxLength = 3,
    validateInput,
    showBidsList = false,
    openReviewOnAdd = true,
    showFooterSubmit = false,
    showInlineSubmit = false,
    showModeTabs = false,
    specialModeType = null, // 'jodi'
    desktopSplit = false,
}) => {
    const [activeTab, setActiveTab] = useState('easy'); // easy | special
    const [session, setSession] = useState('OPEN');
    const [bids, setBids] = useState([]);
    const [reviewRows, setReviewRows] = useState([]);
    const [inputNumber, setInputNumber] = useState('');
    const [inputPoints, setInputPoints] = useState('');
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [warning, setWarning] = useState('');
    const showWarning = (msg) => {
        setWarning(msg);
        window.clearTimeout(showWarning._t);
        showWarning._t = window.setTimeout(() => setWarning(''), 2200);
    };

    const jodiNumbers = useMemo(
        () => Array.from({ length: 100 }, (_, i) => String(i).padStart(2, '0')),
        []
    );
    const [specialInputs, setSpecialInputs] = useState(() =>
        Object.fromEntries(Array.from({ length: 100 }, (_, i) => [String(i).padStart(2, '0'), '']))
    );

    const defaultValidate = (n) => {
        if (!n || !n.toString().trim()) return false;
        return true;
    };
    const isValid = validateInput || defaultValidate;

    const handleAddBid = () => {
        const pts = Number(inputPoints);
        const n = inputNumber?.toString().trim() || '';

        if (!pts || pts <= 0) {
            showWarning('Please enter points.');
            return;
        }

        if (!n) {
            showWarning(maxLength === 2 ? 'Please enter Jodi (00-99).' : `Please enter ${labelKey}.`);
            return;
        }

        // Jodi specific: must be exactly 2 digits (00-99)
        if (maxLength === 2 && n.length !== 2) {
            showWarning('Please enter 2-digit Jodi (00-99).');
            return;
        }

        if (!isValid(n)) {
            showWarning(maxLength === 2 ? 'Invalid Jodi. Use 00-99.' : 'Invalid number.');
            return;
        }

        const next = [...bids, { id: Date.now(), number: inputNumber.toString().trim(), points: inputPoints, type: session }];
        setBids(next);
        setInputNumber('');
        setInputPoints('');
        if (openReviewOnAdd) {
            setReviewRows(next);
            setIsReviewOpen(true);
        }
    };

    const handleDeleteBid = (id) => setBids((prev) => prev.filter((b) => b.id !== id));

    const handleAddSpecialToList = () => {
        if (specialModeType !== 'jodi') return;
        const toAdd = Object.entries(specialInputs)
            .filter(([, pts]) => Number(pts) > 0)
            .map(([num, pts]) => ({
                id: Date.now() + Number(num),
                number: num,
                points: String(pts),
                type: session,
            }));
        if (!toAdd.length) {
            showWarning('Please enter points for at least one Jodi (00-99).');
            return;
        }
        setBids((prev) => [...prev, ...toAdd]);
        setSpecialInputs(Object.fromEntries(jodiNumbers.map((n) => [n, ''])));
    };

    const handleSubmitFromSpecial = () => {
        if (specialModeType !== 'jodi') return;
        const toAdd = Object.entries(specialInputs)
            .filter(([, pts]) => Number(pts) > 0)
            .map(([num, pts]) => ({
                id: Date.now() + Number(num),
                number: num,
                points: String(pts),
                type: session,
            }));

        if (!toAdd.length && bids.length === 0) {
            showWarning('Please enter points for at least one Jodi (00-99).');
            return;
        }

        const next = [...bids, ...toAdd];
        setBids(next);
        setReviewRows(next);
        setIsReviewOpen(true);
        setSpecialInputs(Object.fromEntries(jodiNumbers.map((n) => [n, ''])));
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

    const handleNumberInputChange = (e) => {
        const val = e.target.value;
        if (maxLength === 1) {
            const digit = val.replace(/\D/g, '').slice(-1);
            setInputNumber(digit);
        } else if (maxLength === 2) {
            // Allow only 2 digits (00-99) and keep leading zeros
            const twoDigits = val.replace(/\D/g, '').slice(0, 2);
            setInputNumber(twoDigits);
        } else {
            setInputNumber(val);
        }
    };

    const totalPoints = bids.reduce((sum, b) => sum + Number(b.points), 0);
    const labelKey = label?.split(' ').pop() || 'Number';
    const dateText = new Date().toLocaleDateString('en-GB'); // dd/mm/yyyy
    const marketTitle = market?.gameName || market?.marketName || title;
    const todayDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');

    const submitBtnClass = (enabled) =>
        enabled
            ? 'w-full bg-gradient-to-r from-[#d4af37] to-[#cca84d] text-[#4b3608] font-bold py-3.5 min-h-[48px] rounded-lg shadow-md hover:from-[#e5c04a] hover:to-[#d4af37] transition-all active:scale-[0.98]'
            : 'w-full bg-gradient-to-r from-[#d4af37] to-[#cca84d] text-[#4b3608] font-bold py-3.5 min-h-[48px] rounded-lg shadow-md opacity-50 cursor-not-allowed';

    const modeHeader = showModeTabs ? (
        <div className="space-y-3">
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
                        className="w-full appearance-none bg-[#202124] border border-white/10 text-white font-bold text-sm py-3 sm:py-2.5 min-h-[44px] px-4 rounded-full text-center focus:outline-none focus:border-[#d4af37]"
                    >
                        <option value="OPEN">OPEN</option>
                        <option value="CLOSE">CLOSE</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    ) : null;

    const bidsList = showBidsList ? (
        <>
            <div className="grid grid-cols-4 gap-1 sm:gap-2 text-center text-[#d4af37] font-bold text-xs sm:text-sm mb-2 px-1">
                <div>{labelKey}</div>
                <div>Point</div>
                <div>Type</div>
                <div>Delete</div>
            </div>
            <div className="h-px bg-white/10 w-full mb-2"></div>
            <div className="space-y-2">
                {bids.map((bid) => (
                    <div
                        key={bid.id}
                        className="grid grid-cols-4 gap-1 sm:gap-2 text-center items-center py-2.5 px-2 bg-[#202124] rounded-lg border border-white/10 text-sm"
                    >
                        <div className="font-bold text-white">{bid.number}</div>
                        <div className="font-bold text-[#f2c14e]">{bid.points}</div>
                        <div className="text-sm text-gray-400">{bid.type}</div>
                        <div className="flex justify-center">
                            <button
                                type="button"
                                onClick={() => handleDeleteBid(bid.id)}
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
        </>
    ) : null;

    const clearAll = () => {
        setBids([]);
        setInputNumber('');
        setInputPoints('');
        if (specialModeType === 'jodi') {
            setSpecialInputs(Object.fromEntries(jodiNumbers.map((n) => [n, ''])));
        }
    };

    const handleCancelBet = () => {
        setIsReviewOpen(false);
        clearAll();
    };

    const handleSubmitBet = () => {
        // Integrate API later. For now, close modal and clear current bets.
        setIsReviewOpen(false);
        clearAll();
    };

    return (
        <BidLayout
            market={market}
            title={title}
            bidsCount={bids.length}
            totalPoints={totalPoints}
            session={session}
            setSession={setSession}
            hideFooter={!showFooterSubmit}
            walletBalance={walletBefore}
            onSubmit={() => {
                setReviewRows(bids);
                setIsReviewOpen(true);
            }}
            showDateSession={!showModeTabs}
            extraHeader={null}
        >
            <div className="px-3 sm:px-4 py-4 sm:py-2 md:max-w-7xl md:mx-auto">
                {showModeTabs && !desktopSplit && <div className="mb-4">{modeHeader}</div>}
                {warning && (
                    <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-200 rounded-xl px-4 py-3 text-sm">
                        {warning}
                    </div>
                )}

                {showModeTabs && activeTab === 'special' ? (
                    <>
                        {showModeTabs && desktopSplit && <div className="mb-4">{modeHeader}</div>}

                        {specialModeType === 'jodi' ? (
                            <>
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 xl:grid-rows-10 xl:grid-flow-col xl:gap-2">
                                    {jodiNumbers.map((num) => (
                                        <div key={num} className="flex items-center gap-1.5">
                                            <div className="w-10 h-9 bg-[#202124] border border-white/10 text-[#f2c14e] flex items-center justify-center rounded-l-md font-bold text-xs shrink-0">
                                                {num}
                                            </div>
                                            <input
                                                type="number"
                                                min="0"
                                                placeholder="Pts"
                                                value={specialInputs[num] || ''}
                                                onChange={(e) =>
                                                    setSpecialInputs((p) => ({
                                                        ...p,
                                                        [num]: e.target.value.replace(/\D/g, '').slice(0, 6),
                                                    }))
                                                }
                                                className="w-full h-9 bg-[#202124] border border-white/10 text-white placeholder-gray-500 rounded-r-md focus:outline-none focus:border-[#d4af37] px-2 text-xs font-semibold"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="bg-[#202124] border border-white/10 rounded-2xl p-4 text-center text-gray-300">
                                <div className="text-white font-semibold mb-1">Special Mode</div>
                                <div className="text-sm text-gray-400">This bet type uses Easy Mode only.</div>
                            </div>
                        )}

                        {showInlineSubmit && (
                            <>
                                {/* Mobile sticky submit above bottom navbar */}
                                <div className="md:hidden fixed left-0 right-0 bottom-[88px] z-20 px-3">
                                    {(() => {
                                        const enabled =
                                            specialModeType === 'jodi'
                                                ? bids.length > 0 || Object.values(specialInputs).some((v) => Number(v) > 0)
                                                : bids.length > 0;
                                        return (
                                    <button
                                        type="button"
                                        disabled={
                                            specialModeType === 'jodi'
                                                ? bids.length === 0 && !Object.values(specialInputs).some((v) => Number(v) > 0)
                                                : !bids.length
                                        }
                                        onClick={specialModeType === 'jodi' ? handleSubmitFromSpecial : () => { setReviewRows(bids); setIsReviewOpen(true); }}
                                        className={submitBtnClass(enabled)}
                                    >
                                        Submit Bet
                                    </button>
                                        );
                                    })()}
                                </div>

                                {/* Desktop/Tablet inline submit */}
                                <div className="hidden md:block mt-4">
                                    {(() => {
                                        const enabled =
                                            specialModeType === 'jodi'
                                                ? bids.length > 0 || Object.values(specialInputs).some((v) => Number(v) > 0)
                                                : bids.length > 0;
                                        return (
                                    <button
                                        type="button"
                                        disabled={
                                            specialModeType === 'jodi'
                                                ? bids.length === 0 && !Object.values(specialInputs).some((v) => Number(v) > 0)
                                                : !bids.length
                                        }
                                        onClick={specialModeType === 'jodi' ? handleSubmitFromSpecial : () => { setReviewRows(bids); setIsReviewOpen(true); }}
                                        className={submitBtnClass(enabled)}
                                    >
                                        Submit Bet
                                    </button>
                                        );
                                    })()}
                                </div>
                            </>
                        )}

                        {showBidsList && bids.length > 0 && (
                            <div className="mt-4 space-y-2">
                                {bidsList}
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <div className={desktopSplit ? 'md:grid md:grid-cols-2 md:gap-6 md:items-start' : ''}>
                            <div>
                                {showModeTabs && desktopSplit && <div className="mb-4">{modeHeader}</div>}

                                <div className="flex flex-col gap-3 mb-4">
                                    <div className="flex flex-row items-center gap-2">
                                        <label className="text-gray-400 text-sm font-medium shrink-0 w-32">Select Game Type:</label>
                                        <div className="flex-1 min-w-0 bg-[#202124] border border-white/10 rounded-full py-2.5 min-h-[40px] px-4 flex items-center justify-center text-sm font-bold text-white">
                                            {session}
                                        </div>
                                    </div>
                                    <div className="flex flex-row items-center gap-2">
                                        <label className="text-gray-400 text-sm font-medium shrink-0 w-32">{label}:</label>
                                        <input
                                            type={maxLength === 1 || maxLength === 2 ? 'text' : 'number'}
                                            inputMode="numeric"
                                            value={inputNumber}
                                            onChange={handleNumberInputChange}
                                            placeholder={labelKey}
                                            maxLength={maxLength}
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
                                    onClick={handleAddBid}
                                    className="w-full bg-gradient-to-r from-[#d4af37] to-[#cca84d] text-[#4b3608] font-bold py-3.5 min-h-[48px] rounded-lg shadow-md hover:from-[#e5c04a] hover:to-[#d4af37] transition-all active:scale-[0.98] mb-5 sm:mb-6"
                                >
                                    Add to List
                                </button>

                                {showInlineSubmit && (
                                    <button
                                        type="button"
                                        disabled={!bids.length}
                                        onClick={() => { setReviewRows(bids); setIsReviewOpen(true); }}
                                        className={`mb-5 sm:mb-6 ${submitBtnClass(!!bids.length)}`}
                                    >
                                        Submit Bet
                                    </button>
                                )}

                                {/* Mobile: keep list below on small screens */}
                                {desktopSplit && <div className="md:hidden">{bidsList}</div>}
                                {!desktopSplit && bidsList}
                            </div>

                            {/* Desktop: list on right side */}
                            {desktopSplit && <div className="hidden md:block">{bidsList}</div>}
                        </div>
                    </>
                )}
            </div>

            <BidReviewModal
                open={isReviewOpen}
                onClose={handleCancelBet}
                onSubmit={handleSubmitBet}
                marketTitle={marketTitle}
                dateText={dateText}
                labelKey={labelKey}
                rows={bids}
                walletBefore={walletBefore}
                totalBids={bids.length}
                totalAmount={totalPoints}
            />
        </BidLayout>
    );
};

export default EasyModeBid;
