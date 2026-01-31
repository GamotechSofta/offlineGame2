import React from 'react';
import { useNavigate } from 'react-router-dom';

const BidLayout = ({ market, title, children, bidsCount, totalPoints, showDateSession = true, extraHeader, session = 'OPEN', setSession = () => {} }) => {
    const navigate = useNavigate();
    const todayDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');

    return (
        <div className="min-h-screen bg-gray-100 font-sans">
            {/* Header */}
            <div className="bg-gray-200 px-3 sm:px-4 py-3 flex items-center justify-between gap-2 shadow-sm sticky top-0 z-10">
                <button
                    onClick={() => market ? navigate('/bidoptions', { state: { market } }) : navigate(-1)}
                    className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center bg-white rounded-full shadow-sm hover:bg-gray-50 active:scale-95"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                </button>
                <h1 className="text-base sm:text-lg font-bold uppercase tracking-wide truncate flex-1 text-center mx-1">
                    {market?.gameName ? `${market.gameName} - ${title}` : title}
                </h1>
                <div className="bg-black text-white px-2.5 sm:px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs sm:text-sm font-bold shadow-md shrink-0">
                    <div className="w-5 h-5 bg-white rounded flex items-center justify-center">
                        <div className="w-3 h-2 border-2 border-black border-t-0 border-l-0 transform rotate-45 mb-1"></div>
                    </div>
                    96.0
                </div>
            </div>

            {extraHeader}

            {showDateSession && (
                <div className="px-3 sm:px-4 pb-4 grid grid-cols-2 gap-3">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            value={todayDate}
                            readOnly
                            className="w-full pl-10 py-3 sm:py-2.5 min-h-[44px] bg-white border border-gray-300 rounded-full text-sm font-bold text-center shadow-sm text-gray-800 focus:outline-none"
                        />
                    </div>
                    <div className="relative">
                        <select
                            value={session}
                            onChange={(e) => setSession(e.target.value)}
                            className="w-full appearance-none bg-white border border-gray-300 text-gray-800 font-bold text-sm py-3 sm:py-2.5 min-h-[44px] px-4 rounded-full text-center shadow-sm focus:outline-none"
                        >
                            <option value="OPEN">OPEN</option>
                            <option value="CLOSE">CLOSE</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 md:px-6 text-gray-700">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto pb-44 md:pb-32">
                {children}
            </div>

            {/* Footer */}
            <div className="fixed bottom-[88px] left-0 right-0 md:bottom-0 bg-gray-200 px-3 sm:px-4 py-4 border-t border-gray-300 z-10">
                <div className="flex justify-between items-center px-2 mb-3 text-sm font-bold text-gray-700">
                    <div className="text-center">
                        <div className="text-xs text-gray-500 uppercase">Bids</div>
                        <div className="text-lg text-gray-900">{bidsCount}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs text-gray-500 uppercase">Points</div>
                        <div className="text-lg text-gray-900">{totalPoints}</div>
                    </div>
                </div>
                <button className="w-full bg-[#0F172A] text-white font-bold py-3.5 min-h-[48px] rounded-lg shadow-lg hover:bg-black transition-transform active:scale-[0.98]">
                    Submit
                </button>
            </div>
        </div>
    );
};

export default BidLayout;
