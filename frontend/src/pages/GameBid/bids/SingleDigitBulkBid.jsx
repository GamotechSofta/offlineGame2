import React, { useState } from 'react';
import BidLayout from '../BidLayout';

const SingleDigitBulkBid = ({ market, title }) => {
    const [session, setSession] = useState('OPEN');
    const [inputPoints, setInputPoints] = useState('');
    const [specialBids, setSpecialBids] = useState(Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, 0])));

    const handleDigitClick = (num) => {
        const pts = Number(inputPoints);
        if (!pts || pts <= 0) return;
        setSpecialBids((prev) => ({ ...prev, [num]: (prev[num] || 0) + pts }));
    };

    const bulkBidsCount = Object.values(specialBids).filter((v) => Number(v) > 0).length;
    const bulkTotalPoints = Object.values(specialBids).reduce((sum, v) => sum + Number(v || 0), 0);
    const todayDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');

    const extraHeader = null;

    return (
        <BidLayout market={market} title={title} bidsCount={bulkBidsCount} totalPoints={bulkTotalPoints} showDateSession={false} extraHeader={extraHeader} session={session} setSession={setSession}>
            <div className="px-3 sm:px-4 py-4 sm:py-2">
                <div className="flex flex-col md:grid md:grid-cols-2 md:gap-6 md:items-center gap-4 md:gap-6">
                    <div className="w-full md:flex md:justify-center md:items-center">
                        <div className="flex flex-col md:grid md:grid-cols-2 gap-3 sm:gap-4 mb-2 md:mb-0 max-w-sm w-full">
                            <div className="flex flex-row md:flex-col items-center gap-2 md:gap-1.5 md:items-stretch">
                                <label className="text-gray-700 text-sm font-medium shrink-0 w-24 md:w-auto md:pl-1">Date:</label>
                                <div className="relative flex-1 w-full min-w-0">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <svg className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    </div>
                                    <input type="text" value={todayDate} readOnly className="w-full pl-9 py-2.5 min-h-[40px] bg-white border border-gray-300 rounded-full text-sm font-bold text-center text-gray-800" />
                                </div>
                            </div>
                            <div className="flex flex-row md:flex-col items-center gap-2 md:gap-1.5 md:items-stretch">
                                <label className="text-gray-700 text-sm font-medium shrink-0 w-24 md:w-auto md:pl-1">Select Game Type:</label>
                                <select value={session} onChange={(e) => setSession(e.target.value)} className="flex-1 w-full min-w-0 appearance-none bg-white border border-gray-300 text-gray-800 font-bold text-sm py-2.5 min-h-[40px] px-4 rounded-full text-center shadow-sm focus:outline-none">
                                    <option value="OPEN">OPEN</option>
                                    <option value="CLOSE">CLOSE</option>
                                </select>
                            </div>
                            <div className="flex flex-row md:flex-col items-center gap-2 md:gap-1.5 md:items-stretch md:col-span-2">
                                <label className="text-gray-700 text-sm font-medium shrink-0 w-24 md:w-auto md:pl-1">Enter Points:</label>
                                <input type="number" min="1" value={inputPoints} onChange={(e) => setInputPoints(e.target.value)} placeholder="Point" className="flex-1 w-full min-w-0 bg-white border border-gray-300 rounded-full py-2.5 min-h-[40px] px-4 text-center text-sm shadow-sm focus:ring-2 focus:ring-blue-900 focus:outline-none" />
                            </div>
                        </div>
                    </div>
                    <div className="w-full md:flex md:justify-center md:items-center pt-2 md:pt-6">
                        <div className="grid grid-cols-3 gap-2 sm:gap-2 md:gap-3 max-w-[180px] sm:max-w-[160px] md:max-w-[200px] w-full mx-auto">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                <button key={num} type="button" onClick={() => handleDigitClick(num)} className="relative aspect-square min-h-[44px] sm:min-h-[38px] md:min-h-[44px] bg-[#0F172A] hover:bg-[#1e293b] text-white rounded-lg font-bold text-base flex items-center justify-center transition-all active:scale-95 shadow-md">
                                    {num}
                                    {specialBids[num] > 0 && <span className="absolute top-0.5 right-1 text-[10px] font-bold text-yellow-300">{specialBids[num]}</span>}
                                </button>
                            ))}
                            <div className="col-span-3 flex justify-center">
                                <button type="button" onClick={() => handleDigitClick(0)} className="relative aspect-square min-w-[44px] min-h-[44px] sm:min-w-[38px] sm:min-h-[38px] md:min-w-[44px] md:min-h-[44px] w-16 sm:w-14 bg-[#0F172A] hover:bg-[#1e293b] text-white rounded-lg font-bold text-base flex items-center justify-center transition-all active:scale-95 shadow-md">
                                    0
                                    {specialBids[0] > 0 && <span className="absolute top-0.5 right-1 text-[10px] font-bold text-yellow-300">{specialBids[0]}</span>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </BidLayout>
    );
};

export default SingleDigitBulkBid;
