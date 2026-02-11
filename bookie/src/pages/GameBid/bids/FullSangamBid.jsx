import React, { useMemo, useRef, useState } from 'react';
import BookieBidLayout from '../BookieBidLayout';
import BidReviewModal from '../BidReviewModal';
import { usePlayerBet } from '../PlayerBetContext';
import { isValidAnyPana } from '../panaRules';

const sanitizeDigits = (v, maxLen) => (v ?? '').toString().replace(/\D/g, '').slice(0, maxLen);
const sanitizePoints = (v) => (v ?? '').toString().replace(/\D/g, '').slice(0, 6);

const formatFullSangamDisplay = (val) => {
    const s = (val ?? '').toString().trim();
    if (!/^\d{3}-\d{3}$/.test(s)) return s || '-';
    const [open, close] = s.split('-');
    const sumDigits = (x) => [...String(x)].reduce((acc, c) => acc + (Number(c) || 0), 0);
    const j1 = sumDigits(open) % 10;
    const j2 = sumDigits(close) % 10;
    return `${open}-${j1}${j2}-${close}`;
};

const FullSangamBid = ({ title }) => {
    const { market, placeBet, updatePlayerBalance, walletBalance, playerName, selectedPlayer } = usePlayerBet();
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
            const savedDate = localStorage.getItem('bookieBetSelectedDate');
            if (savedDate && savedDate > new Date().toISOString().split('T')[0]) return savedDate;
        } catch (e) { /* ignore */ }
        return new Date().toISOString().split('T')[0];
    });

    const handleDateChange = (newDate) => {
        try { localStorage.setItem('bookieBetSelectedDate', newDate); } catch (e) { /* ignore */ }
        setSelectedDate(newDate);
    };

    const showWarning = (msg) => {
        setWarning(msg);
        window.clearTimeout(showWarning._t);
        showWarning._t = window.setTimeout(() => setWarning(''), 2200);
    };

    const marketTitle = market?.gameName || market?.marketName || title;
    const dateText = new Date().toLocaleDateString('en-GB');
    const totalPoints = useMemo(() => bids.reduce((sum, b) => sum + Number(b.points || 0), 0), [bids]);

    const clearAll = () => {
        setIsReviewOpen(false); setOpenPana(''); setClosePana(''); setPoints(''); setBids([]);
        const today = new Date().toISOString().split('T')[0];
        setSelectedDate(today);
        try { localStorage.removeItem('bookieBetSelectedDate'); } catch (e) { /* ignore */ }
    };

    const handleSubmitBet = async () => {
        const marketId = market?._id || market?.id;
        if (!marketId) throw new Error('Market not found');
        if (!selectedPlayer) throw new Error('No player selected');
        if (!bids.length) throw new Error('No bets to place');
        const payload = bids.map((b) => ({
            betType: 'full-sangam', betNumber: String(b?.number ?? '').trim(), amount: Number(b?.points) || 0,
            betOn: String(b?.type || session).toUpperCase() === 'CLOSE' ? 'close' : 'open',
        })).filter((b) => b.betNumber && b.amount > 0);
        if (!payload.length) throw new Error('No valid bets to place');
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const selectedDateObj = new Date(selectedDate); selectedDateObj.setHours(0, 0, 0, 0);
        const scheduledDate = selectedDateObj > today ? selectedDate : null;
        const result = await placeBet(marketId, payload, scheduledDate);
        if (!result.success) throw new Error(result.message || 'Failed to place bet');
        if (result.data?.newBalance != null) updatePlayerBalance(result.data.newBalance);
        clearAll();
    };

    const handleAdd = () => {
        const pts = Number(points);
        if (!pts || pts <= 0) { showWarning('Please enter points.'); return; }
        if (!isValidAnyPana(openPana)) { showWarning('Open Pana must be a valid Single / Double / Triple Pana (3 digits).'); return; }
        if (!isValidAnyPana(closePana)) { showWarning('Close Pana must be a valid Single / Double / Triple Pana (3 digits).'); return; }
        const numberKey = `${openPana}-${closePana}`;
        setBids((prev) => {
            const next = [...prev];
            const idx = next.findIndex((b) => String(b.number) === numberKey && String(b.type) === String(session));
            if (idx >= 0) { next[idx] = { ...next[idx], points: String((Number(next[idx].points || 0) || 0) + pts) }; return next; }
            return [...next, { id: Date.now() + Math.random(), number: numberKey, points: String(pts), type: session }];
        });
        setOpenPana(''); setClosePana(''); setPoints('');
    };

    const handleDelete = (id) => setBids((prev) => prev.filter((b) => b.id !== id));
    const openReview = () => { if (!bids.length) { showWarning('Please add at least one Sangam.'); return; } setIsReviewOpen(true); };

    return (
        <BookieBidLayout title={title} bidsCount={bids.length} totalPoints={totalPoints} showDateSession={true}
            selectedDate={selectedDate} setSelectedDate={handleDateChange} session={session} setSession={setSession}
            sessionOptionsOverride={['OPEN']} lockSessionSelect hideFooter contentPaddingClass="pb-6">
            <div className="px-3 sm:px-4 py-4 md:max-w-7xl md:mx-auto">
                <div className="md:grid md:grid-cols-2 md:gap-12 md:items-start">
                    <div className="space-y-4">
                        {warning && <div className="bg-red-500/10 border border-red-500/30 text-red-200 rounded-xl px-4 py-3 text-sm">{warning}</div>}
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-row items-center gap-2">
                                <label className="text-gray-400 text-sm font-medium shrink-0 w-40">Enter Open Pana:</label>
                                <input type="text" inputMode="numeric" value={openPana}
                                    onChange={(e) => { const next = sanitizeDigits(e.target.value, 3); setOpenPana(next); setOpenPanaInvalid(!!next && next.length === 3 && !isValidAnyPana(next)); }}
                                    placeholder="Pana"
                                    className={`flex-1 min-w-0 bg-[#202124] border border-white/10 text-white placeholder-gray-500 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm focus:ring-2 focus:outline-none ${openPanaInvalid ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'focus:ring-[#d4af37] focus:border-[#d4af37]'}`} />
                            </div>
                            <div className="flex flex-row items-center gap-2">
                                <label className="text-gray-400 text-sm font-medium shrink-0 w-40">Enter Close Pana:</label>
                                <input type="text" inputMode="numeric" value={closePana}
                                    onChange={(e) => {
                                        const prevLen = (closePana ?? '').toString().length;
                                        const next = sanitizeDigits(e.target.value, 3);
                                        setClosePana(next); setClosePanaInvalid(!!next && next.length === 3 && !isValidAnyPana(next));
                                        if (next.length === 3 && prevLen < 3 && isValidAnyPana(next)) {
                                            window.requestAnimationFrame(() => { pointsInputRef.current?.focus?.(); });
                                        }
                                    }}
                                    placeholder="Pana"
                                    className={`flex-1 min-w-0 bg-[#202124] border border-white/10 text-white placeholder-gray-500 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm focus:ring-2 focus:outline-none ${closePanaInvalid ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'focus:ring-[#d4af37] focus:border-[#d4af37]'}`} />
                            </div>
                            <div className="flex flex-row items-center gap-2">
                                <label className="text-gray-400 text-sm font-medium shrink-0 w-40">Enter Points:</label>
                                <input ref={pointsInputRef} type="text" inputMode="numeric" value={points}
                                    onChange={(e) => setPoints(sanitizePoints(e.target.value))}
                                    placeholder="Point" className="no-spinner flex-1 min-w-0 bg-[#202124] border border-white/10 text-white placeholder-gray-500 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm focus:ring-2 focus:ring-[#d4af37] focus:border-[#d4af37] focus:outline-none" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
                            <button type="button" onClick={handleAdd}
                                className="w-full bg-gradient-to-r from-[#d4af37] to-[#cca84d] text-[#4b3608] font-bold py-3.5 min-h-[48px] rounded-lg shadow-md hover:from-[#e5c04a] hover:to-[#d4af37] transition-all active:scale-[0.98]">
                                Add to List
                            </button>
                            <button type="button" onClick={openReview} disabled={!bids.length}
                                className={`w-full bg-gradient-to-r from-[#d4af37] to-[#cca84d] text-[#4b3608] font-bold py-3.5 min-h-[48px] rounded-lg shadow-md transition-all ${bids.length ? 'hover:from-[#e5c04a] hover:to-[#d4af37] active:scale-[0.98]' : 'opacity-50 cursor-not-allowed'}`}>
                                Submit Bet
                            </button>
                        </div>
                    </div>
                    <div className="mt-10 md:mt-0">
                        <div className="grid grid-cols-[1.4fr_0.7fr_0.7fr_0.5fr] gap-2 sm:gap-3 text-center text-[#d4af37] font-bold text-xs sm:text-sm mb-2 px-2">
                            <div className="truncate">Sangam</div><div className="truncate">Point</div><div className="truncate">Type</div><div className="truncate">Delete</div>
                        </div>
                        <div className="h-px bg-white/10 w-full mb-2"></div>
                        {bids.length > 0 && (
                            <div className="space-y-2">
                                {bids.map((b) => (
                                    <div key={b.id} className="grid grid-cols-[1.4fr_0.7fr_0.7fr_0.5fr] gap-2 sm:gap-3 text-center items-center py-2.5 px-3 bg-[#202124] rounded-lg border border-white/10 text-sm">
                                        <div className="font-bold text-white truncate">{formatFullSangamDisplay(b.number)}</div>
                                        <div className="font-bold text-[#f2c14e] truncate">{b.points}</div>
                                        <div className="text-sm text-gray-400 uppercase truncate">{b.type}</div>
                                        <div className="flex justify-center">
                                            <button type="button" onClick={() => handleDelete(b.id)} className="p-2 text-red-400 hover:text-red-300 active:scale-95" aria-label="Delete">
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
            <BidReviewModal open={isReviewOpen} onClose={clearAll} onSubmit={handleSubmitBet}
                marketTitle={marketTitle} dateText={dateText} labelKey="Sangam" rows={bids}
                walletBefore={walletBalance} totalBids={bids.length} totalAmount={totalPoints} playerName={playerName} />
        </BookieBidLayout>
    );
};

export default FullSangamBid;
