import React, { useEffect, useMemo, useRef, useState } from 'react';
import BookieBidLayout from '../BookieBidLayout';
import { usePlayerBet } from '../PlayerBetContext';
import { useBetCart } from '../BetCartContext';
import { isValidAnyPana } from '../panaRules';

const sanitizeDigits = (v, maxLen) => (v ?? '').toString().replace(/\D/g, '').slice(0, maxLen);
const sanitizePoints = (v) => (v ?? '').toString().replace(/\D/g, '').slice(0, 6);

// Half Sangam (C): Open Ank (1 digit) + Close Pana (3 digits)
const HalfSangamBBid = ({ title, gameType, betType }) => {
    const { market } = usePlayerBet();
    const { addToCart } = useBetCart();
    const [session, setSession] = useState('OPEN');
    const [openAnk, setOpenAnk] = useState('');
    const [closePana, setClosePana] = useState('');
    const [points, setPoints] = useState('');
    const pointsInputRef = useRef(null);
    const [closePanaInvalid, setClosePanaInvalid] = useState(false);
    const [bids, setBids] = useState([]);
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

    const totalPoints = useMemo(() => bids.reduce((sum, b) => sum + Number(b.points || 0), 0), [bids]);

    const clearAll = () => {
        setOpenAnk('');
        setClosePana('');
        setPoints('');
        setBids([]);
    };

    const handleAddToCart = () => {
        if (!bids.length) {
            showWarning('Please add at least one Sangam.');
            return;
        }
        const count = addToCart(
            bids.map((b) => ({ number: b.number, points: b.points, type: session })),
            gameType,
            title,
            betType
        );
        if (count > 0) {
            showWarning(`Added ${count} bet(s) to cart`);
            clearAll();
        }
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
        const enteredOpenAnk = (openAnk ?? '').toString().trim();
        if (!/^[0-9]$/.test(enteredOpenAnk)) {
            showWarning('Please enter a valid Open Ank (0-9).');
            return;
        }

        const numberKey = `${enteredOpenAnk}-${closePana}`;
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
        setOpenAnk('');
        setClosePana('');
        setPoints('');
    };

    const lastAutoAddKeyRef = useRef('');

    // Auto-add when inputs are valid and points entered (no Add-to-List button).
    useEffect(() => {
        const pts = Number(points);
        if (!Number.isFinite(pts) || pts <= 0) return;
        if (!/^[0-9]$/.test((openAnk ?? '').toString().trim())) return;
        if (!isValidAnyPana(closePana)) return;
        const enteredOpenAnk = (openAnk ?? '').toString().trim();
        const key = `${enteredOpenAnk}-${closePana}|${session}|${pts}`;
        if (lastAutoAddKeyRef.current === key) return;
        lastAutoAddKeyRef.current = key;
        handleAdd();
    }, [openAnk, closePana, points, session]);

    const handleDelete = (id) => setBids((prev) => prev.filter((b) => b.id !== id));

    return (
        <BookieBidLayout
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
                                <label className="text-gray-700 text-sm font-medium shrink-0 w-40">Enter Open Ank:</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={openAnk}
                                    onChange={(e) => setOpenAnk(sanitizeDigits(e.target.value, 1))}
                                    placeholder="Ank"
                                    className="flex-1 min-w-0 bg-white border-2 border-gray-300 text-gray-800 placeholder-gray-400 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm focus:ring-2 focus:ring-sb-primary focus:border-sb-primary focus:outline-none"
                                />
                            </div>

                            <div className="flex flex-row items-center gap-2">
                                <label className="text-gray-700 text-sm font-medium shrink-0 w-40">Enter Close Pana:</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={closePana}
                                    onChange={(e) => {
                                        const prevLen = (closePana ?? '').toString().length;
                                        const next = sanitizeDigits(e.target.value, 3);
                                        setClosePana(next);
                                        setClosePanaInvalid(!!next && next.length === 3 && !isValidAnyPana(next));
                                        if (next.length === 3 && prevLen < 3) {
                                            if (!isValidAnyPana(next)) {
                                                showWarning('Close Pana must be a valid Single / Double / Triple Pana (3 digits).');
                                                return;
                                            }
                                            window.requestAnimationFrame(() => {
                                                pointsInputRef.current?.focus?.();
                                            });
                                        }
                                    }}
                                    placeholder="Pana"
                                    className={`flex-1 min-w-0 bg-white border-2 border-gray-300 text-gray-800 placeholder-gray-400 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm focus:ring-2 focus:outline-none ${
                                        closePanaInvalid ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'focus:ring-sb-primary focus:border-sb-primary'
                                    }`}
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
                                    className="no-spinner flex-1 min-w-0 bg-white border-2 border-gray-300 text-gray-800 placeholder-gray-400 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm focus:ring-2 focus:ring-sb-primary focus:border-sb-primary focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 mb-5 sm:mb-6 md:grid-cols-1">
                            <button
                                type="button"
                                onClick={handleAddToCart}
                                disabled={!bids.length}
                                className={`w-full font-bold py-3.5 min-h-[48px] rounded-lg shadow-md transition-all active:scale-[0.98] ${
                                    bids.length
                                        ? 'bg-sb-primary text-white hover:bg-sb-primary-dark'
                                        : 'bg-gray-400 text-white opacity-50 cursor-not-allowed'
                                }`}
                            >
                                Add to Cart
                            </button>
                        </div>
                    </div>

                    {/* Right: list */}
                    <div className="mt-10 md:mt-0">
                        <div className="grid grid-cols-[1.4fr_0.7fr_0.6fr] gap-2 sm:gap-3 text-center text-sb-primary font-bold text-xs sm:text-sm mb-2 px-2">
                            <div className="truncate">Sangam</div>
                            <div className="truncate">Amount</div>
                            <div className="truncate">Delete</div>
                        </div>
                        <div className="h-px bg-sb-primary w-full mb-2" />

                        {bids.length === 0 ? null : (
                            <div className="space-y-2">
                                {bids.map((b) => (
                                    <div
                                        key={b.id}
                                        className="grid grid-cols-[1.4fr_0.7fr_0.6fr] gap-2 sm:gap-3 text-center items-center py-2.5 px-3 bg-gray-50 rounded-lg border-2 border-gray-300 text-sm"
                                    >
                                        <div className="font-bold text-gray-800 truncate">{b.number}</div>
                                        <div className="font-bold text-sb-primary truncate">{b.points}</div>
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
        </BookieBidLayout>
    );
};

export default HalfSangamBBid;
