import React, { useEffect, useMemo, useState } from 'react';
import BidLayout from '../BidLayout';
import BidReviewModal from './BidReviewModal';
import { useBettingWindow } from '../BettingWindowContext';
import { placeBet, updateUserBalance } from '../../../api/bets';
import { generateCPCommon } from './cpCommonGenerator';

const CpCommonBid = ({ market, title }) => {
    const [session, setSession] = useState(() => (market?.status === 'running' ? 'CLOSE' : 'OPEN'));
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
    const [selectedDigits, setSelectedDigits] = useState([]);
    const [pointsInput, setPointsInput] = useState('');
    const [generatedRows, setGeneratedRows] = useState([]);
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [reviewRows, setReviewRows] = useState([]);

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

    const toggleDigit = (d) => {
        const digit = String(d);
        if (selectedDigits.includes(digit)) {
            setSelectedDigits((prev) => prev.filter((x) => x !== digit));
            return;
        }
        if (selectedDigits.length >= 2) {
            showWarning('Select at most 2 digits for CP (Common Pana).');
            return;
        }
        setSelectedDigits([...selectedDigits, digit].sort((a, b) => Number(a) - Number(b)));
    };

    const isRunning = market?.status === 'running';
    useEffect(() => {
        if (isRunning) setSession('CLOSE');
    }, [isRunning]);

    const rowsWithPoints = useMemo(
        () => generatedRows.filter((row) => Number(row.points) > 0),
        [generatedRows]
    );
    const bidsCount = rowsWithPoints.length;
    const totalPoints = useMemo(
        () => rowsWithPoints.reduce((sum, row) => sum + (Number(row.points) || 0), 0),
        [rowsWithPoints]
    );

    const clearLocal = () => {
        setSelectedDigits([]);
        setPointsInput('');
        setGeneratedRows([]);
    };

    const handleGenerate = () => {
        const pts = Number(pointsInput);
        const digitsInput = selectedDigits.join('');
        if (!digitsInput) {
            showWarning('Please select at least one digit (0-9), at most two.');
            return;
        }
        const result = generateCPCommon({ digitsInput, points: pts });
        if (!result.success) {
            showWarning(result.message);
            return;
        }

        const now = Date.now();
        setGeneratedRows(
            result.data.map((row, idx) => ({
                id: `${row.pana}-${now}-${idx}`,
                pana: row.pana,
                points: String(row.points),
            }))
        );
    };

    const updatePoint = (id, value) => {
        const clean = (value ?? '').toString().replace(/\D/g, '').slice(0, 6);
        setGeneratedRows((prev) => prev.map((row) => (row.id === id ? { ...row, points: clean } : row)));
    };

    const removeRow = (id) => {
        setGeneratedRows((prev) => prev.filter((row) => row.id !== id));
    };

    const openReview = () => {
        const items = rowsWithPoints.map((row) => ({
            id: row.id,
            number: row.pana,
            points: String(row.points),
            type: session,
        }));
        if (!items.length) {
            showWarning('Generate and keep at least one row with points.');
            return;
        }
        setReviewRows(items);
        setIsReviewOpen(true);
    };

    const totalPointsForFooter = useMemo(
        () => reviewRows.reduce((sum, r) => sum + Number(r.points || 0), 0),
        [reviewRows]
    );

    const handleSubmitBet = async () => {
        const marketId = market?._id || market?.id;
        if (!marketId) throw new Error('Market not found');
        const payload = reviewRows
            .map((row) => ({
                betType: 'cp-common',
                betNumber: String(row.number || '').trim(),
                amount: Number(row.points) || 0,
                betOn: String(row?.type || session).toUpperCase() === 'CLOSE' ? 'close' : 'open',
            }))
            .filter((bet) => /^[0-9]{3}$/.test(bet.betNumber) && bet.amount > 0);
        if (!payload.length) throw new Error('No valid bets to place');

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selectedDateObj = new Date(selectedDate);
        selectedDateObj.setHours(0, 0, 0, 0);
        const scheduledDate = selectedDateObj > today ? selectedDate : null;

        const result = await placeBet(marketId, payload, scheduledDate);
        if (!result.success) throw new Error(result.message || 'Failed to place bet');
        if (result.data?.newBalance != null) updateUserBalance(result.data.newBalance);

        setIsReviewOpen(false);
        setReviewRows([]);
        clearLocal();
        const todayStr = new Date().toISOString().split('T')[0];
        setSelectedDate(todayStr);
        try {
            localStorage.setItem('betSelectedDate', todayStr);
        } catch (e) {}
    };

    const dateText = new Date().toLocaleDateString('en-GB');
    const marketTitle = market?.gameName || market?.marketName || title;
    const { allowed: bettingAllowed } = useBettingWindow();

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

    return (
        <BidLayout
            market={market}
            title={title}
            bidsCount={bidsCount}
            totalPoints={totalPoints}
            session={session}
            setSession={setSession}
            showDateSession
            showSessionOnMobile
            selectedDate={selectedDate}
            setSelectedDate={handleDateChange}
            hideFooter
            walletBalance={walletBefore}
            contentPaddingClass="pb-10"
            dateSessionGridClassName="!pb-1"
            dateSessionControlClassName="!min-h-[36px] !h-[36px] !py-1.5 !text-[11px] sm:!text-xs"
            extraHeader={
                <>
                    <div className="md:hidden w-full px-3 py-1">
                        <div className="grid grid-cols-2 gap-1.5 md:gap-2">
                            <div className="rounded-xl border border-gray-300 bg-white px-2 py-1.5 md:px-3 md:py-2 text-center">
                                <div className="text-[11px] text-gray-600 font-medium">Count</div>
                                <div className="text-base font-bold text-[#1B3150] leading-tight">{bidsCount}</div>
                            </div>
                            <div className="rounded-xl border border-gray-300 bg-white px-2 py-1.5 md:px-3 md:py-2 text-center">
                                <div className="text-[11px] text-gray-600 font-medium">Bet Amount</div>
                                <div className="text-base font-bold text-[#1B3150] leading-tight">{totalPoints}</div>
                            </div>
                        </div>
                    </div>
                    <div className="hidden md:flex pr-12 pl-1 pb-0 justify-end w-full">
                        <div className="inline-flex items-center gap-2 md:gap-4">
                            <div className="text-center">
                                <div className="text-[10px] md:text-xs text-gray-500">Count</div>
                                <div className="text-xs md:text-base font-bold text-[#1B3150]">{bidsCount}</div>
                            </div>
                            <div className="w-px h-6 md:h-8 bg-gray-200" />
                            <div className="text-center">
                                <div className="text-[10px] md:text-xs text-gray-500">Bet Amount</div>
                                <div className="text-xs md:text-base font-bold text-[#1B3150]">{totalPoints}</div>
                            </div>
                        </div>
                    </div>
                </>
            }
        >
            <div className="px-3 sm:px-4 pt-0 pb-2 min-h-0">
                {warning && (
                    <div className="fixed top-16 sm:top-20 left-1/2 transform -translate-x-1/2 z-50 bg-white border border-green-200 text-green-600 rounded-lg px-3 py-2.5 text-xs sm:text-sm font-medium shadow-xl max-w-[calc(100%-2rem)] sm:max-w-md backdrop-blur-sm">
                        {warning}
                    </div>
                )}

                <div className="flex flex-col md:flex-row gap-4 sm:gap-5 items-stretch md:items-start">
                    <div className="flex flex-col gap-3 w-full md:w-1/2 shrink-0 min-w-0">
                        <div>
                            <div className="block text-[11px] sm:text-xs font-semibold text-gray-500 mb-2">Select Digits</div>
                            <div className="grid grid-cols-5 gap-2">
                                {Array.from({ length: 10 }, (_, i) => i).map((d) => {
                                    const selected = selectedDigits.includes(String(d));
                                    return (
                                        <button
                                            key={d}
                                            type="button"
                                            onClick={() => toggleDigit(d)}
                                            aria-pressed={selected}
                                            className={`min-h-[40px] h-10 rounded-md font-bold text-sm sm:text-base transition-all active:scale-[0.98] border ${
                                                selected
                                                    ? 'bg-[#1B3150] text-white border-[#1B3150]'
                                                    : 'bg-white text-[#1B3150] border-gray-300 hover:bg-[#1B3150]/5'
                                            }`}
                                        >
                                            {d}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="flex items-center gap-2 mt-3">
                                <label className="shrink-0 w-24 text-xs sm:text-sm font-semibold text-gray-600">Enter Digit</label>
                                <input
                                    type="text"
                                    value={selectedDigits.join(',')}
                                    readOnly
                                    placeholder="e.g. 1,2"
                                    className="flex-1 min-w-0 min-h-[40px] h-10 sm:h-11 bg-white border border-gray-300 rounded-lg px-3 text-sm sm:text-base font-semibold text-gray-800"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="shrink-0 w-24 text-xs sm:text-sm font-semibold text-gray-600">Enter Points</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={pointsInput}
                                onChange={(e) => setPointsInput((e.target.value ?? '').replace(/\D/g, '').slice(0, 6))}
                                placeholder="Points"
                                className="flex-1 min-w-0 min-h-[40px] h-10 sm:h-11 bg-white border border-gray-300 rounded-lg px-3 text-sm sm:text-base font-semibold text-gray-800"
                            />
                            <button
                                type="button"
                                onClick={clearLocal}
                                className="min-h-[40px] h-10 px-4 rounded-md text-[11px] sm:text-xs font-semibold border-2 border-[#1B3150]/30 text-[#1B3150] bg-white hover:bg-[#1B3150]/5 active:scale-[0.98] transition-all shrink-0"
                            >
                                Clear
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="shrink-0 w-24 text-xs sm:text-sm font-semibold text-gray-600">Quick Points</label>
                            <div className="flex-1 min-w-0 grid grid-cols-5 gap-2">
                                {[10, 20, 30, 40, 50].map((pts) => {
                                    const selected = String(pointsInput || '') === String(pts);
                                    return (
                                        <button
                                            key={pts}
                                            type="button"
                                            onClick={() => setPointsInput(String(pts))}
                                            className={`min-h-[34px] h-9 rounded-md text-xs sm:text-sm font-semibold border transition-all active:scale-[0.98] ${
                                                selected
                                                    ? 'bg-[#1B3150] text-white border-[#1B3150]'
                                                    : 'bg-white text-[#1B3150] border-gray-300 hover:bg-[#1B3150]/5'
                                            }`}
                                        >
                                            {pts}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={handleGenerate}
                                className="flex-1 min-h-[40px] h-10 py-2.5 rounded-lg bg-[#1B3150] text-white font-semibold text-sm sm:text-base"
                            >
                                GENERATE
                            </button>
                            <button
                                type="button"
                                onClick={openReview}
                                disabled={!bidsCount || !bettingAllowed}
                                className={`flex-1 bg-[#1B3150] text-white font-semibold text-sm sm:text-base py-2.5 min-h-[40px] h-10 rounded-lg shadow-lg hover:bg-[#152842] transition-all active:scale-[0.98] ${
                                    !bidsCount || !bettingAllowed ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                            >
                                Submit Bet {bidsCount > 0 && `(${bidsCount})`}
                            </button>
                        </div>
                    </div>

                    <div className="w-full md:w-1/2 flex-1 min-w-0">
                        <div className="grid grid-cols-4 gap-1 sm:gap-2 text-center text-[#1B3150] font-bold text-xs sm:text-sm mb-2 px-1">
                            <div>Pana</div>
                            <div>Point</div>
                            <div>Type</div>
                            <div>Delete</div>
                        </div>
                        <div className="h-px bg-[#1B3150] w-full mb-2" />
                        <div className="max-h-[520px] sm:max-h-[560px] overflow-y-auto space-y-2 pr-0.5">
                            {generatedRows.length === 0 ? (
                                <div className="py-6 text-center text-gray-400 text-sm">Generate to add</div>
                            ) : (
                                generatedRows.map((row) => (
                                    <div key={row.id} className="grid grid-cols-4 gap-1 sm:gap-2 text-center items-center py-2.5 px-2 bg-gray-50 rounded-lg border-2 border-gray-300 text-sm">
                                        <div className="font-bold text-gray-800">{row.pana}</div>
                                        <div className="px-0.5 min-w-0">
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={row.points}
                                                onChange={(e) => updatePoint(row.id, e.target.value)}
                                                className="w-full h-8 rounded-lg border border-gray-300 text-center font-bold text-[#1B3150] text-sm focus:outline-none focus:border-[#1B3150]"
                                            />
                                        </div>
                                        <div className="text-sm font-semibold text-[#1B3150]">{session}</div>
                                        <div className="flex justify-center">
                                            <button
                                                type="button"
                                                onClick={() => removeRow(row.id)}
                                                className="p-2 text-red-500 hover:text-red-600 active:scale-95"
                                                aria-label="Delete"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

            </div>

            <BidReviewModal
                open={isReviewOpen}
                onClose={() => setIsReviewOpen(false)}
                onSubmit={handleSubmitBet}
                marketTitle={marketTitle}
                dateText={dateText}
                labelKey="Pana"
                rows={reviewRows}
                walletBefore={walletBefore}
                totalBids={reviewRows.length}
                totalAmount={totalPointsForFooter}
            />
        </BidLayout>
    );
};

export default CpCommonBid;




