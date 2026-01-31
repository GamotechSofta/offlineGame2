import React, { useMemo, useState } from 'react';
import BidLayout from '../BidLayout';
import BidReviewModal from './BidReviewModal';

const EasyModeBid = ({ market, title, label, maxLength = 3, validateInput }) => {
    const [session, setSession] = useState('OPEN');
    const [bids, setBids] = useState([]);
    const [inputNumber, setInputNumber] = useState('');
    const [inputPoints, setInputPoints] = useState('');
    const [isReviewOpen, setIsReviewOpen] = useState(false);

    const defaultValidate = (n) => {
        if (!n || !n.toString().trim()) return false;
        return true;
    };
    const isValid = validateInput || defaultValidate;

    const handleAddBid = () => {
        if (!inputPoints || Number(inputPoints) <= 0) return;
        if (!isValid(inputNumber)) return;
        const next = [...bids, { id: Date.now(), number: inputNumber.toString().trim(), points: inputPoints, type: session }];
        setBids(next);
        setInputNumber('');
        setInputPoints('');
        setIsReviewOpen(true);
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
        } else {
            setInputNumber(val);
        }
    };

    const totalPoints = bids.reduce((sum, b) => sum + Number(b.points), 0);
    const labelKey = label?.split(' ').pop() || 'Number';
    const dateText = new Date().toLocaleDateString('en-GB'); // dd/mm/yyyy
    const marketTitle = market?.gameName || market?.marketName || title;

    const clearAll = () => {
        setBids([]);
        setInputNumber('');
        setInputPoints('');
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
            hideFooter
            walletBalance={walletBefore}
        >
            <div className="px-3 sm:px-4 py-4 sm:py-2">
                <div className="flex flex-col gap-3 mb-4">
                    <div className="flex flex-row items-center gap-2">
                        <label className="text-gray-400 text-sm font-medium shrink-0 w-32">Select Game Type:</label>
                        <div className="flex-1 min-w-0 bg-[#202124] border border-white/10 rounded-full py-2.5 min-h-[40px] px-4 flex items-center justify-center text-sm font-bold text-white">{session}</div>
                    </div>
                    <div className="flex flex-row items-center gap-2">
                        <label className="text-gray-400 text-sm font-medium shrink-0 w-32">{label}:</label>
                        <input
                            type={maxLength === 1 ? 'text' : 'number'}
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
                        <input type="number" value={inputPoints} onChange={(e) => setInputPoints(e.target.value)} placeholder="Point" className="flex-1 min-w-0 bg-[#202124] border border-white/10 text-white placeholder-gray-500 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm focus:ring-2 focus:ring-[#d4af37] focus:border-[#d4af37] focus:outline-none" />
                    </div>
                </div>
                <button onClick={handleAddBid} className="w-full bg-gradient-to-r from-[#d4af37] to-[#cca84d] text-[#4b3608] font-bold py-3.5 min-h-[48px] rounded-lg shadow-md hover:from-[#e5c04a] hover:to-[#d4af37] transition-all active:scale-[0.98] mb-5 sm:mb-6">Add</button>
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
