import React, { useEffect, useMemo, useState } from 'react';
import BookieBidLayout from '../BookieBidLayout';
import { usePlayerBet } from '../PlayerBetContext';
import { useBetCart } from '../BetCartContext';

const sanitizePoints = (v) => (v ?? '').toString().replace(/\D/g, '').slice(0, 6);

const validatePana = (n) => {
    if (!n) return false;
    const str = n.toString().trim();
    if (!/^[0-9]{3}$/.test(str)) return false;
    const digits = str.split('').map(Number);
    const [first, second, third] = digits;
    const hasConsecutiveSame = (first === second) || (second === third);
    if (!hasConsecutiveSame) return false;
    if (first === 0) return false;
    if (second === 0 && third === 0) return true;
    if (first === second && third === 0) return true;
    if (third <= first) return false;
    return true;
};

const buildDoublePanas = () => {
    const validPanas = [];
    for (let i = 0; i <= 999; i++) {
        const str = String(i).padStart(3, '0');
        if (validatePana(str)) validPanas.push(str);
    }
    return validPanas;
};

const DoublePanaBulkBid = ({ title, gameType, betType }) => {
    const { market } = usePlayerBet();
    const { addToCart } = useBetCart();
    const [session, setSession] = useState(() => (market?.status === 'running' ? 'CLOSE' : 'OPEN'));
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

    const isRunning = market?.status === 'running';
    useEffect(() => { if (isRunning) setSession('CLOSE'); }, [isRunning]);

    const doublePanas = useMemo(() => buildDoublePanas(), []);
    const [specialInputs, setSpecialInputs] = useState(() =>
        Object.fromEntries(doublePanas.map((n) => [n, '']))
    );
    const [groupBulk, setGroupBulk] = useState(() =>
        Object.fromEntries(Array.from({ length: 10 }, (_, d) => [String(d), '']))
    );

    const panasBySumDigit = useMemo(() => {
        const groups = Object.fromEntries(Array.from({ length: 10 }, (_, d) => [String(d), []]));
        for (const n of doublePanas) {
            const digits = n.split('').map(Number);
            const sum = digits[0] + digits[1] + digits[2];
            const s = sum % 10;
            groups[String(s)].push(n);
        }
        return groups;
    }, [doublePanas]);

    const specialCount = useMemo(
        () => Object.values(specialInputs).filter((v) => Number(v) > 0).length,
        [specialInputs]
    );
    const canSubmit = specialCount > 0;

    const clearLocal = () => {
        setSpecialInputs(Object.fromEntries(doublePanas.map((n) => [n, ''])));
        setGroupBulk(Object.fromEntries(Array.from({ length: 10 }, (_, d) => [String(d), ''])));
    };

    const handleAddToCart = () => {
        const items = Object.entries(specialInputs)
            .filter(([, pts]) => Number(pts) > 0)
            .map(([num, pts]) => ({ number: num, points: String(pts), type: session }));
        if (!items.length) { showWarning('Please enter points for at least one Double Pana.'); return; }
        const count = addToCart(items, gameType, title, betType);
        if (count > 0) showWarning(`Added ${count} bet(s) to cart ✓`);
        clearLocal();
    };

    return (
        <BookieBidLayout
            title={title}
            bidsCount={0}
            totalPoints={0}
            session={session}
            setSession={setSession}
            selectedDate={selectedDate}
            setSelectedDate={handleDateChange}
            hideFooter
            contentPaddingClass="pb-24"
        >
            <div className="px-2 sm:px-4 py-3 w-full max-w-full overflow-x-hidden">
                {warning && (
                    <div className="fixed top-16 sm:top-20 left-1/2 transform -translate-x-1/2 z-50 bg-white border border-green-200 text-green-600 rounded-lg px-3 py-2.5 text-xs sm:text-sm font-medium shadow-xl max-w-[calc(100%-2rem)] sm:max-w-md backdrop-blur-sm">
                        {warning}
                    </div>
                )}

                <div className="space-y-5">
                    {Array.from({ length: 10 }, (_, d) => String(d)).map((groupKey) => {
                        const list = panasBySumDigit[groupKey] || [];
                        if (!list.length) return null;

                        const applyGroup = (pts) => {
                            const p = sanitizePoints(pts);
                            const n = Number(p);
                            if (!n || n <= 0) { showWarning('Please enter points.'); return; }
                            setSpecialInputs((prev) => {
                                const next = { ...prev };
                                for (const num of list) next[num] = String(n);
                                return next;
                            });
                            setGroupBulk((prev) => ({ ...prev, [groupKey]: '' }));
                        };

                        return (
                            <div key={groupKey} className="bg-gray-50 rounded-xl border border-gray-200 p-3 overflow-hidden">
                                {/* Group header with bulk apply */}
                                <div className="flex items-center gap-2 mb-3 flex-wrap">
                                    <div className="w-9 h-9 bg-orange-500 text-white flex items-center justify-center rounded-lg font-bold text-sm shrink-0 shadow-sm">
                                        {groupKey}
                                    </div>
                                    <span className="text-gray-400 text-xs font-medium shrink-0">Sum {groupKey}</span>
                                    <div className="flex items-center gap-1.5 ml-auto">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={groupBulk[groupKey]}
                                            onChange={(e) => setGroupBulk((p) => ({ ...p, [groupKey]: sanitizePoints(e.target.value) }))}
                                            onBlur={() => { if (groupBulk[groupKey]) applyGroup(groupBulk[groupKey]); }}
                                            onKeyDown={(e) => { if (e.key === 'Enter' && groupBulk[groupKey]) applyGroup(groupBulk[groupKey]); }}
                                            placeholder="Pts"
                                            className="no-spinner w-16 h-8 bg-gray-100 border border-gray-200 text-gray-800 placeholder-gray-400 rounded focus:outline-none focus:border-orange-500 px-2 text-xs font-semibold text-center"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => groupBulk[groupKey] && applyGroup(groupBulk[groupKey])}
                                            disabled={!groupBulk[groupKey]}
                                            className={`h-8 px-2.5 rounded font-bold text-[10px] border transition-colors shrink-0 ${
                                                groupBulk[groupKey]
                                                    ? 'bg-orange-500/20 border-orange-500/40 text-orange-500 hover:border-orange-500'
                                                    : 'bg-gray-100 border-gray-200 text-gray-600 cursor-not-allowed'
                                            }`}
                                        >
                                            Apply All
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSpecialInputs((prev) => {
                                                    const next = { ...prev };
                                                    for (const num of list) next[num] = '';
                                                    return next;
                                                });
                                                setGroupBulk((prev) => ({ ...prev, [groupKey]: '' }));
                                            }}
                                            className="h-8 px-2.5 rounded font-bold text-[10px] border border-red-200 bg-red-50 text-red-500 hover:border-red-500 hover:bg-red-100 transition-colors shrink-0"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>

                                {/* Pana number inputs — responsive grid that wraps properly */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-1.5">
                                    {list.map((num) => (
                                        <div key={num} className="flex items-center min-w-0">
                                            <div className="w-10 h-8 bg-gray-100 border border-gray-200 text-orange-500 flex items-center justify-center rounded-l font-bold text-[11px] shrink-0">
                                                {num}
                                            </div>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                placeholder="Pts"
                                                value={specialInputs[num]}
                                                onChange={(e) =>
                                                    setSpecialInputs((p) => ({
                                                        ...p,
                                                        [num]: sanitizePoints(e.target.value),
                                                    }))
                                                }
                                                className="no-spinner flex-1 min-w-0 h-8 bg-gray-100 border border-l-0 border-gray-200 text-gray-800 placeholder-gray-400 rounded-r focus:outline-none focus:border-orange-500 px-2 text-[11px] font-semibold text-center"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Add to Cart Button */}
                <div className="mt-5 sticky bottom-3 z-10">
                    <button type="button" onClick={handleAddToCart} disabled={!canSubmit}
                        className={`w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-3.5 min-h-[52px] rounded-lg shadow-lg transition-all active:scale-[0.98] ${!canSubmit ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        Add to Cart {specialCount > 0 && `(${specialCount})`}
                    </button>
                </div>
            </div>
        </BookieBidLayout>
    );
};

export default DoublePanaBulkBid;
