import React, { useEffect, useMemo, useState } from 'react';
import BidLayout from '../BidLayout';
import BidReviewModal from './BidReviewModal';
import { placeBet, updateUserBalance } from '../../../api/bets';

const ODD_DIGITS = [1, 3, 5, 7, 9];
const EVEN_DIGITS = [0, 2, 4, 6, 8];

const OddEvenBid = ({ market, title }) => {
    const [session, setSession] = useState(() => (market?.status === 'running' ? 'CLOSE' : 'OPEN'));
    const [choice, setChoice] = useState('odd'); // 'odd' | 'even'
    const [digitInputs, setDigitInputs] = useState(() => Object.fromEntries([...ODD_DIGITS, ...EVEN_DIGITS].map((d) => [d, ''])));
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

    const digits = choice === 'odd' ? ODD_DIGITS : EVEN_DIGITS;

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
        setDigitInputs(() => Object.fromEntries([...ODD_DIGITS, ...EVEN_DIGITS].map((d) => [d, ''])));
        const today = new Date().toISOString().split('T')[0];
        setSelectedDate(today);
        try {
            localStorage.removeItem('betSelectedDate');
        } catch (e) {}
    };

    const handleAddBid = () => {
        const toAdd = digits
            .filter((num) => Number(digitInputs[num]) > 0)
            .map((num) => ({ id: Date.now() + num, number: String(num), points: String(digitInputs[num]), type: session }));
        if (toAdd.length === 0) {
            showWarning(`Please enter points for at least one ${choice === 'odd' ? 'odd' : 'even'} number.`);
            return;
        }
        setBids((prev) => [...prev, ...toAdd]);
        setDigitInputs((p) => ({ ...p, ...Object.fromEntries(digits.map((d) => [d, ''])) }));
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
            betType: 'single',
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

    const leftColumn = (
        <div className="space-y-4">
            {warning && (
                <div className="bg-red-50 border-2 border-red-300 text-red-600 rounded-xl px-4 py-3 text-sm">
                    {warning}
                </div>
            )}
            <div className="grid grid-cols-2 gap-3">
                <button
                    type="button"
                    onClick={() => setChoice('odd')}
                    className={`min-h-[44px] py-3 rounded-lg font-bold text-sm border-2 transition-colors ${choice === 'odd' ? 'bg-[#1B3150] text-white border-[#1B3150]' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}
                >
                    Odd
                </button>
                <button
                    type="button"
                    onClick={() => setChoice('even')}
                    className={`min-h-[44px] py-3 rounded-lg font-bold text-sm border-2 transition-colors ${choice === 'even' ? 'bg-[#1B3150] text-white border-[#1B3150]' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}
                >
                    Even
                </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
                {digits.map((num) => (
                    <div key={num} className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-[#1B3150] border-2 border-gray-300 text-white flex items-center justify-center rounded-l-md font-bold text-sm shrink-0">{num}</div>
                        <input
                            type="text"
                            inputMode="numeric"
                            placeholder="Pts"
                            value={digitInputs[num]}
                            onChange={(e) => setDigitInputs((p) => ({ ...p, [num]: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                            className="w-full h-10 bg-white border-2 border-gray-300 text-gray-800 placeholder-gray-400 rounded-r-md focus:outline-none focus:border-[#1B3150] px-3 text-sm font-semibold"
                        />
                    </div>
                ))}
            </div>
            <button onClick={handleAddBid} className="w-full bg-[#1B3150] text-white font-bold py-3.5 min-h-[48px] rounded-lg shadow-md hover:bg-[#152842] transition-all active:scale-[0.98]">
                Add to List
            </button>
        </div>
    );

    return (
        <BidLayout market={market} title={title} bidsCount={bids.length} totalPoints={totalPoints} showDateSession={true} extraHeader={null} session={session} setSession={setSession} hideFooter walletBalance={walletBefore} selectedDate={selectedDate} setSelectedDate={handleDateChange}>
            <div className="px-3 sm:px-4 py-4 sm:py-2 md:max-w-3xl md:mx-auto md:items-start">
                {leftColumn}
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

export default OddEvenBid;
