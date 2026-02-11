import React, { useRef, useState } from 'react';
import BookieBidLayout from '../BookieBidLayout';
import { usePlayerBet } from '../PlayerBetContext';
import { useBetCart } from '../BetCartContext';
import { isValidAnyPana } from '../panaRules';

const sanitizeDigits = (v, maxLen) => (v ?? '').toString().replace(/\D/g, '').slice(0, maxLen);
const sanitizePoints = (v) => (v ?? '').toString().replace(/\D/g, '').slice(0, 6);

const HalfSangamABid = ({ title, gameType, betType }) => {
    const { market } = usePlayerBet();
    const { addToCart } = useBetCart();
    const [session, setSession] = useState('OPEN');
    const [openPana, setOpenPana] = useState('');
    const [closeAnk, setCloseAnk] = useState('');
    const [points, setPoints] = useState('');
    const pointsInputRef = useRef(null);
    const [openPanaInvalid, setOpenPanaInvalid] = useState(false);
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

    const computeCloseAnkFromPana = (pana) => {
        const s = (pana ?? '').toString().trim();
        if (!/^[0-9]{3}$/.test(s)) return '';
        const sum = Number(s[0]) + Number(s[1]) + Number(s[2]);
        return String(sum % 10);
    };

    const handleAddToCart = () => {
        const pts = Number(points);
        if (!pts || pts <= 0) { showWarning('Please enter points.'); return; }
        if (!isValidAnyPana(openPana)) { showWarning('Open Pana must be a valid Pana (Single / Double / Triple).'); return; }
        const derivedCloseAnk = computeCloseAnkFromPana(openPana);
        if (!/^[0-9]$/.test(derivedCloseAnk)) { showWarning('Close Ank could not be calculated. Please re-enter Open Pana.'); return; }
        const numberKey = `${openPana}-${derivedCloseAnk}`;
        const count = addToCart([{ number: numberKey, points: String(pts), type: session }], gameType, title, betType);
        if (count > 0) showWarning(`Added ${count} bet to cart ✓`);
        setOpenPana(''); setCloseAnk(''); setPoints('');
    };

    return (
        <BookieBidLayout title={title} bidsCount={0} totalPoints={0} showDateSession={true}
            selectedDate={selectedDate} setSelectedDate={handleDateChange} session={session} setSession={setSession}
            sessionOptionsOverride={['OPEN']} lockSessionSelect hideSessionSelectCaret hideFooter contentPaddingClass="pb-24">
            <div className="px-3 sm:px-4 py-4 md:max-w-3xl md:mx-auto">
                <div className="space-y-4">
                    {warning && (
                        <div className="fixed top-16 sm:top-20 left-1/2 transform -translate-x-1/2 z-50 bg-white border border-green-200 text-green-600 rounded-lg px-3 py-2.5 text-xs sm:text-sm font-medium shadow-xl max-w-[calc(100%-2rem)] sm:max-w-md backdrop-blur-sm">
                            {warning}
                        </div>
                    )}
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-row items-center gap-2">
                            <label className="text-gray-400 text-sm font-medium shrink-0 w-40">Enter Open Pana:</label>
                            <input type="text" inputMode="numeric" value={openPana}
                                onChange={(e) => {
                                    const prevLen = (openPana ?? '').toString().length;
                                    const next = sanitizeDigits(e.target.value, 3);
                                    setOpenPana(next); setOpenPanaInvalid(!!next && next.length === 3 && !isValidAnyPana(next));
                                    setCloseAnk(computeCloseAnkFromPana(next));
                                    if (next.length === 3 && prevLen < 3 && isValidAnyPana(next)) {
                                        window.requestAnimationFrame(() => { pointsInputRef.current?.focus?.(); });
                                    }
                                }}
                                placeholder="Pana"
                                className={`flex-1 min-w-0 bg-gray-100 border border-gray-200 text-gray-800 placeholder-gray-400 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm focus:ring-2 focus:outline-none ${openPanaInvalid ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'focus:ring-orange-500 focus:border-orange-500'}`} />
                        </div>
                        <div className="flex flex-row items-center gap-2">
                            <label className="text-gray-400 text-sm font-medium shrink-0 w-40">Close Ank:</label>
                            <input type="text" inputMode="numeric" value={closeAnk} readOnly placeholder="Ank"
                                className="flex-1 min-w-0 bg-gray-100 border border-gray-200 text-gray-800 placeholder-gray-400 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm opacity-80 cursor-not-allowed focus:outline-none" />
                        </div>
                        <div className="flex flex-row items-center gap-2">
                            <label className="text-gray-400 text-sm font-medium shrink-0 w-40">Enter Points:</label>
                            <input ref={pointsInputRef} type="text" inputMode="numeric" value={points}
                                onChange={(e) => setPoints(sanitizePoints(e.target.value))}
                                placeholder="Point" className="no-spinner flex-1 min-w-0 bg-gray-100 border border-gray-200 text-gray-800 placeholder-gray-400 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:outline-none" />
                        </div>
                    </div>
                    <button type="button" onClick={handleAddToCart}
                        className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-3.5 min-h-[48px] rounded-lg shadow-md hover:from-orange-600 hover:to-orange-700 transition-all active:scale-[0.98]">
                        Add to Cart
                    </button>
                </div>
            </div>
        </BookieBidLayout>
    );
};

export default HalfSangamABid;
