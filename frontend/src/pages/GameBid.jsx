import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const GameBid = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { title = "RADHA NIGHT", gameMode = "easy" } = location.state || {}; // Default logic

    const [activeTab, setActiveTab] = useState('special');
    const [session, setSession] = useState('OPEN');
    const [bids, setBids] = useState([]);

    // Easy Mode State
    const [inputNumber, setInputNumber] = useState('');
    const [inputPoints, setInputPoints] = useState('');

    // Special Mode State (for 0-9)
    const [specialBids, setSpecialBids] = useState(
        Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, '']))
    );

    const handleAddBid = () => {
        if (!inputNumber || !inputPoints) return;
        setBids([...bids, {
            id: Date.now(),
            number: inputNumber,
            points: inputPoints,
            type: session
        }]);
        setInputNumber('');
        setInputPoints('');
    };

    const handleDeleteBid = (id) => {
        setBids(bids.filter(bid => bid.id !== id));
    };

    const handleSpecialChange = (num, value) => {
        setSpecialBids(prev => ({ ...prev, [num]: value }));
    };

    const totalPoints = bids.reduce((sum, bid) => sum + Number(bid.points), 0);

    // Determine input label/validation based on title
    const getInputConfig = () => {
        const t = title.toLowerCase();
        if (t.includes('single digit')) return { label: 'Enter Single Digit', maxLength: 1 };
        if (t.includes('jodi')) return { label: 'Enter Jodi', maxLength: 2 };
        if (t.includes('pana') || t.includes('panna')) return { label: 'Enter Pana', maxLength: 3 };
        return { label: 'Enter Number', maxLength: 3 };
    };

    const { label, maxLength } = getInputConfig();

    // Special Mode is mainly relevant for Single Digit in the screenshot's specific 0-9 format. 
    // For others, we might want to disable it or adapt it, but adhering to the user's request for "related", 
    // we will render the 0-9 grid ONLY if "Single Digit" is involved, or maybe standard rows for others.
    // However, strict adherence to the screenshot 1 (0-9 grid) suggests simpler logic.
    // We'll show the grid for Single Digit and a placeholder for others to avoid confusion.
    const isSingleDigit = title.toLowerCase().includes('single digit');

    return (
        <div className="min-h-screen bg-gray-100 font-sans">
            {/* Header */}
            <div className="bg-gray-200 px-4 py-3 flex items-center justify-between shadow-sm sticky top-0 z-10">
                <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-50">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                </button>
                <h1 className="text-lg font-bold uppercase tracking-wide">{title}</h1>
                <div className="bg-black text-white px-3 py-1.5 rounded-full flex items-center gap-2 text-sm font-bold shadow-md">
                    <div className="w-5 h-5 bg-white rounded flex items-center justify-center">
                        <div className="w-3 h-2 border-2 border-black border-t-0 border-l-0 transform rotate-45 mb-1"></div>
                    </div>
                    96.0
                </div>
            </div>

            {/* Tabs */}
            <div className="p-4 grid grid-cols-2 gap-3">
                <button
                    onClick={() => setActiveTab('special')}
                    className={`py-2.5 rounded-md font-bold text-sm shadow-sm transition-colors border ${activeTab === 'special'
                            ? 'bg-[#0F172A] text-white border-[#0F172A]'
                            : 'bg-white text-gray-700 border-gray-300'
                        }`}
                >
                    SPECIAL MODE
                </button>
                <button
                    onClick={() => setActiveTab('easy')}
                    className={`py-2.5 rounded-md font-bold text-sm shadow-sm transition-colors border ${activeTab === 'easy'
                            ? 'bg-[#0F172A] text-white border-[#0F172A]'
                            : 'bg-white text-gray-700 border-gray-300'
                        }`}
                >
                    EASY MODE
                </button>
            </div>

            {/* Controls: Date & Session */}
            <div className="px-4 pb-4 grid grid-cols-2 gap-3">
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        value="30-01-2026"
                        readOnly
                        className="w-full pl-10 py-2.5 bg-white border border-gray-300 rounded-full text-sm font-bold text-center shadow-sm text-gray-800 focus:outline-none"
                    />
                </div>
                <div className="relative">
                    <select
                        value={session}
                        onChange={(e) => setSession(e.target.value)}
                        className="w-full appearance-none bg-white border border-gray-300 text-gray-800 font-bold text-sm py-2.5 px-4 rounded-full text-center shadow-sm focus:outline-none"
                    >
                        <option value="OPEN">OPEN</option>
                        <option value="CLOSE">CLOSE</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 md:px-6 text-gray-700">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto pb-32">
                {activeTab === 'easy' ? (
                    /* EASY MODE CONTENT */
                    <div className="px-4">
                        <div className="mb-4">
                            <label className="block text-gray-700 text-sm font-medium mb-1 pl-1">Select Game Type:</label>
                            <div className="w-full bg-white border border-gray-300 rounded-full py-2.5 px-4 text-center text-sm font-bold text-gray-800 shadow-sm">
                                {session}
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 text-sm font-medium mb-1 pl-1">{label}:</label>
                            <input
                                type="number"
                                value={inputNumber}
                                onChange={(e) => setInputNumber(e.target.value)}
                                placeholder={label.split(' ')[1]}
                                className="w-full bg-white border border-gray-300 rounded-full py-2.5 px-4 text-center text-sm shadow-sm focus:ring-2 focus:ring-blue-900 focus:outline-none"
                                maxLength={maxLength}
                            />
                        </div>

                        <div className="mb-6">
                            <label className="block text-gray-700 text-sm font-medium mb-1 pl-1">Enter Points:</label>
                            <input
                                type="number"
                                value={inputPoints}
                                onChange={(e) => setInputPoints(e.target.value)}
                                placeholder="Point"
                                className="w-full bg-white border border-gray-300 rounded-full py-2.5 px-4 text-center text-sm shadow-sm focus:ring-2 focus:ring-blue-900 focus:outline-none"
                            />
                        </div>

                        <button
                            onClick={handleAddBid}
                            className="w-full bg-[#0F172A] text-white font-bold py-3 rounded-md shadow-md hover:bg-black transition-colors mb-6"
                        >
                            Add
                        </button>

                        {/* Table Header */}
                        <div className="grid grid-cols-4 gap-2 text-center text-[#0F172A] font-bold text-sm mb-2 px-2">
                            <div>{label.split(' ').pop()}</div>
                            <div>Point</div>
                            <div>Type</div>
                            <div>Delete</div>
                        </div>

                        {/* Table Divider */}
                        <div className="h-px bg-[#0F172A] w-full mb-2"></div>

                        {/* Table Rows */}
                        <div className="space-y-2">
                            {bids.map((bid) => (
                                <div key={bid.id} className="grid grid-cols-4 gap-2 text-center items-center py-2 bg-white rounded shadow-sm border border-gray-100">
                                    <div className="font-bold text-gray-800">{bid.number}</div>
                                    <div className="font-bold text-gray-800">{bid.points}</div>
                                    <div className="text-sm text-gray-600">{bid.type}</div>
                                    <div className="flex justify-center">
                                        <button onClick={() => handleDeleteBid(bid.id)} className="text-red-500 hover:text-red-700">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {bids.length === 0 && (
                                <div className="text-center text-gray-400 py-8 text-sm">
                                    No bids added yet
                                </div>
                            )}
                        </div>

                    </div>
                ) : (
                    /* SPECIAL MODE CONTENT */
                    <div className="px-4">
                        {isSingleDigit ? (
                            <div className="grid grid-cols-2 gap-4">
                                {/* Left Column (Evens basically, per screenshot 0,2,4,6,8) */}
                                <div className="space-y-3">
                                    {[0, 2, 4, 6, 8].map(num => (
                                        <div key={num} className="flex items-center">
                                            <div className="w-10 h-10 bg-[#0F172A] text-white flex items-center justify-center rounded-l-md font-bold text-sm">
                                                {num}
                                            </div>
                                            <input
                                                type="number"
                                                value={specialBids[num]}
                                                onChange={(e) => handleSpecialChange(num, e.target.value)}
                                                className="w-full h-10 bg-gray-200 rounded-r-md border-y border-r border-gray-300 focus:outline-none focus:bg-white focus:border-blue-500 px-3 text-sm font-semibold"
                                            />
                                        </div>
                                    ))}
                                </div>
                                {/* Right Column (Odds basically, per screenshot 1,3,5,7,9) */}
                                <div className="space-y-3">
                                    {[1, 3, 5, 7, 9].map(num => (
                                        <div key={num} className="flex items-center">
                                            <div className="w-10 h-10 bg-[#0F172A] text-white flex items-center justify-center rounded-l-md font-bold text-sm">
                                                {num}
                                            </div>
                                            <input
                                                type="number"
                                                value={specialBids[num]}
                                                onChange={(e) => handleSpecialChange(num, e.target.value)}
                                                className="w-full h-10 bg-gray-200 rounded-r-md border-y border-r border-gray-300 focus:outline-none focus:bg-white focus:border-blue-500 px-3 text-sm font-semibold"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white p-6 rounded-lg shadow text-center">
                                <p className="text-gray-500 mb-2">Bulk entry mode is optimized for Single Digit.</p>
                                <p className="text-sm text-gray-400">Please use Easy Mode for {title}.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="fixed bottom-[65px] left-0 right-0 bg-gray-200 p-4 border-t border-gray-300 md:bottom-0">
                <div className="flex justify-between items-center px-2 mb-3 text-sm font-bold text-gray-700">
                    <div className="text-center">
                        <div className="text-xs text-gray-500 uppercase">Bids</div>
                        <div className="text-lg text-gray-900">{bids.length}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs text-gray-500 uppercase">Points</div>
                        <div className="text-lg text-gray-900">{totalPoints}</div>
                    </div>
                </div>
                <button className="w-full bg-[#0F172A] text-white font-bold py-3 rounded-md shadow-lg hover:bg-black transition-transform active:scale-95">
                    Submit
                </button>
            </div>
        </div>
    );
};

export default GameBid;
