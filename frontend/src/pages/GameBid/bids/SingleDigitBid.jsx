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
    const todayDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');

    const modeTabs = (
        <div className="grid grid-cols-2 gap-3">
            <button
                onClick={() => setActiveTab('easy')}
                className={`min-h-[44px] py-3 rounded-lg font-bold text-sm shadow-sm border active:scale-[0.98] transition-colors ${activeTab === 'easy' ? 'bg-[#d4af37] text-[#4b3608] border-[#d4af37]' : 'bg-[#202124] text-gray-400 border-white/10 hover:border-[#d4af37]/50'}`}
            >
                EASY MODE
            </button>
            <button
                onClick={() => setActiveTab('special')}
                className={`min-h-[44px] py-3 rounded-lg font-bold text-sm shadow-sm border active:scale-[0.98] transition-colors ${activeTab === 'special' ? 'bg-[#d4af37] text-[#4b3608] border-[#d4af37]' : 'bg-[#202124] text-gray-400 border-white/10 hover:border-[#d4af37]/50'}`}
            >
                SPECIAL MODE
            </button>
        </div>
    );

    const dateSessionRow = (
        <div className="grid grid-cols-2 gap-3">
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
                <input type="text" value={todayDate} readOnly className="w-full pl-10 py-3 sm:py-2.5 min-h-[44px] bg-[#202124] border border-white/10 text-white rounded-full text-sm font-bold text-center focus:outline-none" />
            </div>
            <div className="relative">
                <select value={session} onChange={(e) => setSession(e.target.value)} className="w-full appearance-none bg-[#202124] border border-white/10 text-white font-bold text-sm py-3 sm:py-2.5 min-h-[44px] px-4 rounded-full text-center focus:outline-none focus:border-[#d4af37]">
                    <option value="OPEN">OPEN</option>
                    <option value="CLOSE">CLOSE</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
            </div>
        </div>
    );

    const BidsTable = ({ labelKey }) => (
        <>
            <div className="grid grid-cols-4 gap-1 sm:gap-2 text-center text-[#d4af37] font-bold text-xs sm:text-sm mb-2 px-1">
                <div>{labelKey}</div>
                <div>Point</div>
                <div>Type</div>
                <div>Delete</div>
            </div>
            <div className="h-px bg-white/10 w-full mb-2"></div>
            <div className="space-y-2">
                {bids.map((bid) => (
                    <div key={bid.id} className="grid grid-cols-4 gap-1 sm:gap-2 text-center items-center py-2.5 px-2 bg-[#202124] rounded-lg border border-white/10 text-sm">
                        <div className="font-bold text-white">{bid.number}</div>
                        <div className="font-bold text-[#f2c14e]">{bid.points}</div>
                        <div className="text-sm text-gray-400">{bid.type}</div>
                        <div className="flex justify-center">
                            <button onClick={() => handleDeleteBid(bid.id)} className="p-2 text-red-400 hover:text-red-300 active:scale-95">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    </div>
                ))}
                {bids.length === 0 && <div className="text-center text-gray-500 py-10 sm:py-8 text-sm">No bids added yet</div>}
            </div>
        </>
    );

    const leftColumn = (
        <div className="space-y-4">
            {modeTabs}
            {dateSessionRow}
            {activeTab === 'easy' ? (
                <>
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-row items-center gap-2">
                            <label className="text-gray-400 text-sm font-medium shrink-0 w-32">Select Game Type:</label>
                            <div className="flex-1 min-w-0 bg-[#202124] border border-white/10 rounded-full py-2.5 min-h-[40px] px-4 flex items-center justify-center text-sm font-bold text-white">{session}</div>
                        </div>
                        <div className="flex flex-row items-center gap-2">
                            <label className="text-gray-400 text-sm font-medium shrink-0 w-32">Enter Single Digit:</label>
                            <input type="text" inputMode="numeric" value={inputNumber} onChange={handleNumberInputChange} placeholder="Digit" maxLength={1} className="flex-1 min-w-0 bg-[#202124] border border-white/10 text-white placeholder-gray-500 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm focus:ring-2 focus:ring-[#d4af37] focus:border-[#d4af37] focus:outline-none" />
                        </div>
                        <div className="flex flex-row items-center gap-2">
                            <label className="text-gray-400 text-sm font-medium shrink-0 w-32">Enter Points:</label>
                            <input type="number" value={inputPoints} onChange={(e) => setInputPoints(e.target.value)} placeholder="Point" className="flex-1 min-w-0 bg-[#202124] border border-white/10 text-white placeholder-gray-500 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm focus:ring-2 focus:ring-[#d4af37] focus:border-[#d4af37] focus:outline-none" />
                        </div>
                    </div>
                    <button onClick={handleAddBid} className="w-full bg-gradient-to-r from-[#d4af37] to-[#cca84d] text-[#4b3608] font-bold py-3.5 min-h-[48px] rounded-lg shadow-md hover:from-[#e5c04a] hover:to-[#d4af37] transition-all active:scale-[0.98]">Add</button>
                </>
            ) : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                            <div key={num} className="flex items-center gap-2">
                                <div className="w-10 h-10 bg-[#202124] border border-white/10 text-[#f2c14e] flex items-center justify-center rounded-l-md font-bold text-sm shrink-0">{num}</div>
                                <input type="number" min="0" placeholder="Pts" value={specialModeInputs[num]} onChange={(e) => setSpecialModeInputs((p) => ({ ...p, [num]: e.target.value }))} className="w-full h-10 bg-[#202124] border border-white/10 text-white placeholder-gray-500 rounded-r-md focus:outline-none focus:border-[#d4af37] px-3 text-sm font-semibold" />
                            </div>
                        ))}
                    </div>
                    <button onClick={handleAddSpecialModeBids} className="w-full bg-gradient-to-r from-[#d4af37] to-[#cca84d] text-[#4b3608] font-bold py-3 rounded-md shadow-md hover:from-[#e5c04a] hover:to-[#d4af37] transition-all">Add to List</button>
                </>
            )}
        </div>
    );

    const rightColumn = <BidsTable labelKey="Digit" />;

    return (
        <BidLayout market={market} title={title} bidsCount={bids.length} totalPoints={totalPoints} showDateSession={false} extraHeader={null} session={session} setSession={setSession} footerRightOnDesktop>
            <div className="px-3 sm:px-4 py-4 sm:py-2 md:grid md:grid-cols-2 md:gap-6 md:max-w-7xl md:mx-auto md:items-start">
                <div className="md:pr-4 md:border-r md:border-white/10">{leftColumn}</div>
                <div className="mt-6 md:mt-0 md:pl-4">{rightColumn}</div>
            </div>
        </BidLayout>
    );
};

export default SingleDigitBid;
