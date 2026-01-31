import React, { useState } from 'react';
import BidLayout from '../BidLayout';

const EasyModeBid = ({ market, title, label, maxLength = 3, validateInput }) => {
    const [session, setSession] = useState('OPEN');
    const [bids, setBids] = useState([]);
    const [inputNumber, setInputNumber] = useState('');
    const [inputPoints, setInputPoints] = useState('');

    const defaultValidate = (n) => {
        if (!n || !n.toString().trim()) return false;
        return true;
    };
    const isValid = validateInput || defaultValidate;

    const handleAddBid = () => {
        if (!inputPoints || Number(inputPoints) <= 0) return;
        if (!isValid(inputNumber)) return;
        setBids([...bids, { id: Date.now(), number: inputNumber.toString().trim(), points: inputPoints, type: session }]);
        setInputNumber('');
        setInputPoints('');
    };

    const handleDeleteBid = (id) => setBids(bids.filter((b) => b.id !== id));

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

    return (
        <BidLayout market={market} title={title} bidsCount={bids.length} totalPoints={totalPoints} session={session} setSession={setSession}>
            <div className="px-3 sm:px-4 py-4 sm:py-2">
                <div className="flex flex-col md:flex-row md:items-end gap-3 sm:gap-4 mb-4">
                    <div className="flex-1 flex flex-row md:flex-col items-center gap-2 md:gap-1.5 md:items-stretch">
                        <label className="text-gray-700 text-sm font-medium shrink-0 w-32 md:w-auto md:pl-1">Select Game Type:</label>
                        <div className="flex-1 w-full min-w-0 bg-white border border-gray-300 rounded-full py-2.5 min-h-[40px] px-4 flex items-center justify-center text-sm font-bold text-gray-800 shadow-sm">{session}</div>
                    </div>
                    <div className="flex-1 flex flex-row md:flex-col items-center gap-2 md:gap-1.5 md:items-stretch">
                        <label className="text-gray-700 text-sm font-medium shrink-0 w-32 md:w-auto md:pl-1">{label}:</label>
                        <input
                            type={maxLength === 1 ? 'text' : 'number'}
                            inputMode="numeric"
                            value={inputNumber}
                            onChange={handleNumberInputChange}
                            placeholder={labelKey}
                            maxLength={maxLength}
                            className="flex-1 w-full min-w-0 bg-white border border-gray-300 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm shadow-sm focus:ring-2 focus:ring-blue-900 focus:outline-none"
                        />
                    </div>
                    <div className="flex-1 flex flex-row md:flex-col items-center gap-2 md:gap-1.5 md:items-stretch">
                        <label className="text-gray-700 text-sm font-medium shrink-0 w-32 md:w-auto md:pl-1">Enter Points:</label>
                        <input type="number" value={inputPoints} onChange={(e) => setInputPoints(e.target.value)} placeholder="Point" className="flex-1 w-full min-w-0 bg-white border border-gray-300 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm shadow-sm focus:ring-2 focus:ring-blue-900 focus:outline-none" />
                    </div>
                </div>
                <button onClick={handleAddBid} className="w-full bg-[#0F172A] text-white font-bold py-3.5 min-h-[48px] rounded-lg shadow-md hover:bg-black transition-colors active:scale-[0.98] mb-5 sm:mb-6">Add</button>
                <div className="grid grid-cols-4 gap-1 sm:gap-2 text-center text-[#0F172A] font-bold text-xs sm:text-sm mb-2 px-1">
                    <div>{labelKey}</div>
                    <div>Point</div>
                    <div>Type</div>
                    <div>Delete</div>
                </div>
                <div className="h-px bg-[#0F172A] w-full mb-2"></div>
                <div className="space-y-2">
                    {bids.map((bid) => (
                        <div key={bid.id} className="grid grid-cols-4 gap-1 sm:gap-2 text-center items-center py-2.5 px-2 bg-white rounded-lg shadow-sm border border-gray-100 text-sm">
                            <div className="font-bold text-gray-800">{bid.number}</div>
                            <div className="font-bold text-gray-800">{bid.points}</div>
                            <div className="text-sm text-gray-600">{bid.type}</div>
                            <div className="flex justify-center">
                                <button onClick={() => handleDeleteBid(bid.id)} className="p-2 text-red-500 hover:text-red-700 active:scale-95">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                    {bids.length === 0 && <div className="text-center text-gray-400 py-10 sm:py-8 text-sm">No bids added yet</div>}
                </div>
            </div>
        </BidLayout>
    );
};

export default EasyModeBid;
