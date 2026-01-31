import React, { useState } from 'react';
import BidLayout from '../BidLayout';

const SingleDigitBid = ({ market, title }) => {
    const [activeTab, setActiveTab] = useState('easy');
    const [session, setSession] = useState('OPEN');
    const [bids, setBids] = useState([]);
    const [inputNumber, setInputNumber] = useState('');
    const [inputPoints, setInputPoints] = useState('');
    const [specialModeInputs, setSpecialModeInputs] = useState(
        Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, '']))
    );

    const handleAddBid = () => {
        if (!inputPoints || Number(inputPoints) <= 0) return;
        const n = inputNumber.toString().trim();
        if (!n || !/^[0-9]$/.test(n)) return;
        setBids([...bids, { id: Date.now(), number: n, points: inputPoints, type: session }]);
        setInputNumber('');
        setInputPoints('');
    };

    const handleDeleteBid = (id) => setBids(bids.filter((b) => b.id !== id));

    const handleNumberInputChange = (e) => {
        const digit = e.target.value.replace(/\D/g, '').slice(-1);
        setInputNumber(digit);
    };

    const handleAddSpecialModeBids = () => {
        const toAdd = Object.entries(specialModeInputs)
            .filter(([, pts]) => Number(pts) > 0)
            .map(([num, pts]) => ({ id: Date.now() + parseInt(num, 10), number: num, points: String(pts), type: session }));
        if (toAdd.length === 0) return;
        setBids([...bids, ...toAdd]);
        setSpecialModeInputs(Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, ''])));
    };

    const totalPoints = bids.reduce((sum, b) => sum + Number(b.points), 0);

    const extraHeader = (
        <div className="px-3 sm:px-4 py-3 grid grid-cols-2 gap-3">
            <button
                onClick={() => setActiveTab('easy')}
                className={`min-h-[44px] py-3 rounded-lg font-bold text-sm shadow-sm border active:scale-[0.98] ${activeTab === 'easy' ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-white text-gray-700 border-gray-300'}`}
            >
                EASY MODE
            </button>
            <button
                onClick={() => setActiveTab('special')}
                className={`min-h-[44px] py-3 rounded-lg font-bold text-sm shadow-sm border active:scale-[0.98] ${activeTab === 'special' ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-white text-gray-700 border-gray-300'}`}
            >
                SPECIAL MODE
            </button>
        </div>
    );

    const BidsTable = ({ labelKey }) => (
        <>
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
        </>
    );

    return (
        <BidLayout market={market} title={title} bidsCount={bids.length} totalPoints={totalPoints} extraHeader={extraHeader} session={session} setSession={setSession}>
            <div className="px-3 sm:px-4 py-4 sm:py-2">
                {activeTab === 'easy' ? (
                    <>
                        <div className="flex flex-col md:flex-row md:items-end gap-3 sm:gap-4 mb-4">
                            <div className="flex-1 flex flex-row md:flex-col items-center gap-2 md:gap-1.5 md:items-stretch">
                                <label className="text-gray-700 text-sm font-medium shrink-0 w-32 md:w-auto md:pl-1">Select Game Type:</label>
                                <div className="flex-1 w-full min-w-0 bg-white border border-gray-300 rounded-full py-2.5 min-h-[40px] px-4 flex items-center justify-center text-sm font-bold text-gray-800 shadow-sm">{session}</div>
                            </div>
                            <div className="flex-1 flex flex-row md:flex-col items-center gap-2 md:gap-1.5 md:items-stretch">
                                <label className="text-gray-700 text-sm font-medium shrink-0 w-32 md:w-auto md:pl-1">Enter Single Digit:</label>
                                <input type="text" inputMode="numeric" value={inputNumber} onChange={handleNumberInputChange} placeholder="Digit" maxLength={1} className="flex-1 w-full min-w-0 bg-white border border-gray-300 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm shadow-sm focus:ring-2 focus:ring-blue-900 focus:outline-none" />
                            </div>
                            <div className="flex-1 flex flex-row md:flex-col items-center gap-2 md:gap-1.5 md:items-stretch">
                                <label className="text-gray-700 text-sm font-medium shrink-0 w-32 md:w-auto md:pl-1">Enter Points:</label>
                                <input type="number" value={inputPoints} onChange={(e) => setInputPoints(e.target.value)} placeholder="Point" className="flex-1 w-full min-w-0 bg-white border border-gray-300 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm shadow-sm focus:ring-2 focus:ring-blue-900 focus:outline-none" />
                            </div>
                        </div>
                        <button onClick={handleAddBid} className="w-full bg-[#0F172A] text-white font-bold py-3.5 min-h-[48px] rounded-lg shadow-md hover:bg-black transition-colors active:scale-[0.98] mb-5 sm:mb-6">Add</button>
                        <BidsTable labelKey="Digit" />
                    </>
                ) : (
                    <>
                        {/* Mobile: 2 per row; Desktop (md+): 5 per horizontal line */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 max-w-sm md:max-w-none mx-auto mb-4">
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                <div key={num} className="flex items-center gap-2">
                                    <div className="w-10 h-10 bg-[#0F172A] text-white flex items-center justify-center rounded-l-md font-bold text-sm shrink-0">{num}</div>
                                    <input type="number" min="0" placeholder="Points" value={specialModeInputs[num]} onChange={(e) => setSpecialModeInputs((p) => ({ ...p, [num]: e.target.value }))} className="w-full h-10 bg-gray-200 rounded-r-md border border-gray-300 focus:outline-none focus:bg-white focus:border-blue-500 px-3 text-sm font-semibold" />
                                </div>
                            ))}
                        </div>
                        <button onClick={handleAddSpecialModeBids} className="w-full max-w-sm md:max-w-none mx-auto block bg-[#0F172A] text-white font-bold py-3 rounded-md shadow-md hover:bg-black transition-colors mb-4">Add to List</button>
                        <BidsTable labelKey="Digit" />
                    </>
                )}
            </div>
        </BidLayout>
    );
};

export default SingleDigitBid;
