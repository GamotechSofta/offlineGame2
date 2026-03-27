import React, { useEffect, useMemo, useState } from 'react';
import BidLayout from '../BidLayout';
import BidReviewModal from './BidReviewModal';
import { placeBet, updateUserBalance } from '../../../api/bets';
import { generateSPCommon } from './spCommonGenerator';

const sanitizePoints = (v) => (v ?? '').toString().replace(/\D/g, '').slice(0, 6);

/**
 * SP Common: bet on the result digit (0-9) derived from the 3-digit result.
 * Win when (sum of digits of open/close panel) % 10 equals your chosen digit.
 * e.g. SP Common 1 wins if result is 128, 137, 470, 560, etc. (all give digit 1).
 */
const SpCommonBid = ({ market, title }) => {
    const [session, setSession] = useState(() => (market?.status === 'running' ? 'CLOSE' : 'OPEN'));
    const [digitInput, setDigitInput] = useState('');
    const [pointsInput, setPointsInput] = useState('');
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

    const clearAll = () => {
        setBids([]);
        setDigitInput('');
        setPointsInput('');
        const today = new Date().toISOString().split('T')[0];
        setSelectedDate(today);
        try {
            localStorage.removeItem('betSelectedDate');
        } catch (e) {}
    };

    const handleGenerate = () => {
        const result = generateSPCommon({ digit: digitInput, points: Number(pointsInput) });
        if (!result.success) {
            showWarning(result.message);
            return;
        }
        if (result.data.length === 0) {
            showWarning('No panna matches for selected digit(s).');
            setBids([]);
            return;
        }
        setBids(
            result.data.map((row, idx) => ({
                id: `${row.pana}-${Date.now()}-${idx}`,
                number: row.pana,
                points: String(row.points),
                type: session,
            }))
        );
    };

    const updatePoint = (id, value) => {
        const clean = sanitizePoints(value);
        setBids((prev) => prev.map((row) => (row.id === id ? { ...row, points: clean } : row)));
    };

    const removeRow = (id) => {
        setBids((prev) => prev.filter((row) => row.id !== id));
    };

    const handleAddBid = () => {
        if (!bids.length) {
            showWarning('Please generate combinations first.');
            return;
        }
        setIsReviewOpen(true);
    };

    const totalPoints = bids.reduce((sum, b) => sum + Number(b.points), 0);
    const dateText = new Date().toLocaleDateString('en-GB');
    const marketTitle = market?.gameName || market?.marketName || title;
    const isRunning = market?.status === 'running';

    useEffect(() => {
        if (isRunning) setSession('CLOSE');
    }, [isRunning]);

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

    const handleSubmitBet = async () => {
        const marketId = market?._id || market?.id;
        if (!marketId) throw new Error('Market not found');
        const bets = bids.map((b) => ({
            betType: 'sp-common',
            betNumber: String(b.number),
            amount: Number(b.points) || 0,
            betOn: String(b?.type || session).toUpperCase() === 'CLOSE' ? 'close' : 'open',
        }));

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selectedDateObj = new Date(selectedDate);
        selectedDateObj.setHours(0, 0, 0, 0);
        const scheduledDate = selectedDateObj > today ? selectedDate : null;

        const result = await placeBet(marketId, bets, scheduledDate);
        if (!result.success) throw new Error(result.message);
        if (result.data?.newBalance != null) updateUserBalance(result.data.newBalance);
        setIsReviewOpen(false);
        clearAll();
    };

    const handleCancelBet = () => {
        setIsReviewOpen(false);
        clearAll();
    };

    return (
        <BidLayout market={market} title={title} bidsCount={bids.length} totalPoints={totalPoints} showDateSession={true} extraHeader={null} session={session} setSession={setSession} hideFooter walletBalance={walletBefore} selectedDate={selectedDate} setSelectedDate={handleDateChange}>
            <div className="px-3 sm:px-4 py-4 sm:py-2 md:max-w-3xl md:mx-auto md:items-start">
                {warning && (
                    <div className="bg-red-50 border-2 border-red-300 text-red-600 rounded-xl px-4 py-3 text-sm mb-4">
                        {warning}
                    </div>
                )}
                <p className="text-gray-600 text-sm mb-3">Enter a single digit (0-9), points and click Generate.</p>
                <div className="flex flex-col md:flex-row gap-3 sm:gap-4 items-stretch md:items-start">
                    <div className="flex flex-col gap-2.5 w-full md:w-[52%] shrink-0 min-w-0">
                        <div>
                            <label className="block text-xs sm:text-sm font-semibold text-gray-600 mb-1.5">Enter Digit</label>
                            <input
                                type="text"
                                placeholder="e.g. 2"
                                value={digitInput}
                                onChange={(e) => setDigitInput((e.target.value ?? '').replace(/\D/g, '').slice(0, 1))}
                                className="w-full h-10 bg-white border-2 border-gray-300 text-gray-800 placeholder-gray-400 rounded-md focus:outline-none focus:border-[#1B3150] px-3 text-sm font-semibold"
                            />
                        </div>
                        <div>
                            <label className="block text-xs sm:text-sm font-semibold text-gray-600 mb-1.5">Enter Points</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                placeholder="Points"
                                value={pointsInput}
                                onChange={(e) => setPointsInput(sanitizePoints(e.target.value))}
                                className="w-full h-10 bg-white border-2 border-gray-300 text-gray-800 placeholder-gray-400 rounded-md focus:outline-none focus:border-[#1B3150] px-3 text-sm font-semibold"
                            />
                        </div>
                        <button onClick={handleGenerate} className="w-full mt-1 bg-[#1B3150] text-white font-bold py-3.5 min-h-[48px] rounded-lg shadow-md hover:bg-[#152842] transition-all active:scale-[0.98]">
                            Generate
                        </button>
                    </div>

                    <div className="w-full md:w-[48%] rounded-lg border border-gray-200 bg-white overflow-hidden min-h-[240px]">
                        <div className="bg-[#1B3150] text-white font-bold text-sm py-2.5 px-3 text-center">
                            <div className="grid grid-cols-[72px_1fr_48px] gap-2">
                                <div className="text-center">Pana</div>
                                <div className="text-center">Point</div>
                                <div className="text-center">Delete</div>
                            </div>
                        </div>
                        <div className="max-h-[280px] overflow-y-auto p-0">
                            {bids.length === 0 ? (
                                <div className="py-8 text-center text-gray-400 text-sm">Click Generate to show combinations</div>
                            ) : (
                                bids.map((row) => (
                                    <div key={row.id} className="grid grid-cols-[72px_1fr_48px] gap-2 items-center py-2.5 px-2 sm:px-3 border-b border-gray-200 min-h-[44px]">
                                        <div className="text-center font-bold text-gray-800 text-sm sm:text-base">{row.number}</div>
                                        <div className="px-1 sm:px-2 min-w-0">
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={row.points}
                                                onChange={(e) => updatePoint(row.id, e.target.value)}
                                                className="w-full min-h-[40px] h-9 border border-gray-300 rounded-md px-2 text-center text-sm font-semibold text-gray-800"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeRow(row.id)}
                                            className="min-h-[40px] h-9 flex items-center justify-center rounded-md bg-red-50/80 text-red-600"
                                            aria-label="Delete"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
                <div className="mt-3 mb-2 flex items-center gap-5 text-[#1B3150]">
                    <div className="text-center">
                        <div className="text-[11px] text-gray-500">Count</div>
                        <div className="text-2xl leading-none font-bold">{bids.length}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-[11px] text-gray-500">Bet Amount</div>
                        <div className="text-2xl leading-none font-bold">{totalPoints}</div>
                    </div>
                </div>
                <button onClick={handleAddBid} disabled={!bids.length} className={`w-full mt-4 text-white font-bold py-3.5 min-h-[48px] rounded-lg shadow-md transition-all active:scale-[0.98] ${bids.length ? 'bg-[#1B3150] hover:bg-[#152842]' : 'bg-gray-400 cursor-not-allowed'}`}>
                    Add to List
                </button>
            </div>

            <BidReviewModal
                open={isReviewOpen}
                onClose={handleCancelBet}
                onSubmit={handleSubmitBet}
                marketTitle={marketTitle}
                dateText={dateText}
                labelKey="Digit"
                rows={bids}
                walletBefore={walletBefore}
                totalBids={bids.length}
                totalAmount={totalPoints}
            />
        </BidLayout>
    );
};

export default SpCommonBid;
