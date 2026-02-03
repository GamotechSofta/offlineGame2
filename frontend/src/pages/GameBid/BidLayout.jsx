import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const getWalletFromStorage = () => {
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
};

const BidLayout = ({
    market,
    title,
    children,
    bidsCount,
    totalPoints,
    showDateSession = true,
    extraHeader,
    session = 'OPEN',
    setSession = () => {},
    sessionRightSlot = null,
    // Optional: override allowed session options for this page (e.g. ['OPEN'])
    sessionOptionsOverride = null,
    // Optional: lock session dropdown (prevents selecting OPEN/CLOSE)
    lockSessionSelect = false,
    dateSessionControlClassName = '',
    dateSessionGridClassName = '',
    footerRightOnDesktop = false,
    hideFooter = false,
    walletBalance,
    onSubmit = () => {},
    showFooterStats = true,
    submitLabel = 'Submit Bids',
    contentPaddingClass,
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const contentRef = useRef(null);
    const todayDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
    const wallet = Number.isFinite(Number(walletBalance)) ? Number(walletBalance) : getWalletFromStorage();

    const marketStatus = market?.status;
    const isRunning = marketStatus === 'running'; // "CLOSED IS RUNNING"
    const sessionOptions =
        Array.isArray(sessionOptionsOverride) && sessionOptionsOverride.length
            ? sessionOptionsOverride
            : (isRunning ? ['CLOSE'] : ['OPEN', 'CLOSE']);

    useEffect(() => {
        // If market is "CLOSED IS RUNNING", force session to CLOSE and lock it.
        if (Array.isArray(sessionOptionsOverride) && sessionOptionsOverride.length) {
            const desired = sessionOptionsOverride[0];
            if (desired && session !== desired) setSession(desired);
            return;
        }
        if (isRunning && session !== 'CLOSE') setSession('CLOSE');
    }, [isRunning, session, setSession, sessionOptionsOverride]);

    // Scroll to top when route changes
    useEffect(() => {
        const timer = setTimeout(() => {
            // Scroll window
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            if (document.documentElement) document.documentElement.scrollTop = 0;
            if (document.body) document.body.scrollTop = 0;
            
            // Scroll content container
            if (contentRef.current) {
                contentRef.current.scrollTop = 0;
            }
        }, 0);
        return () => clearTimeout(timer);
    }, [location.pathname]);

    return (
        <div className="min-h-screen bg-black font-sans w-full max-w-full overflow-x-hidden">
            {/* Header - Home theme dark */}
            <div className="bg-[#202124] border-b border-white/10 px-4 sm:px-6 py-2 flex items-center justify-between gap-2 sticky top-0 z-10">
                <button
                    onClick={() => market ? navigate('/bidoptions', { state: { market } }) : navigate(-1)}
                    className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full active:scale-95 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                </button>
                <h1 className="text-sm sm:text-lg font-bold uppercase tracking-wide truncate flex-1 text-center mx-1 text-white">
                    {market?.gameName ? `${market.gameName} - ${title}` : title}
                </h1>
                <div className="bg-[#f2c14e] text-[#4b3608] px-2 sm:px-3 py-1 rounded-full flex items-center gap-1.5 text-[11px] sm:text-sm font-bold shadow-md shrink-0">
                    <div className="w-5 h-5 bg-[#4b3608] rounded flex items-center justify-center text-[#f2c14e] text-xs font-bold">₹</div>
                    {wallet.toFixed(1)}
                </div>
            </div>

            {extraHeader}

            {showDateSession && (
                <div className={`px-4 sm:px-6 pb-4 pt-2 grid grid-cols-2 gap-3 ${dateSessionGridClassName}`}>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            value={todayDate}
                            readOnly
                            className={`w-full pl-10 py-3 sm:py-2.5 min-h-[44px] bg-[#202124] border border-white/10 text-white rounded-full text-sm font-bold text-center focus:outline-none focus:border-[#d4af37] ${dateSessionControlClassName}`}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1 min-w-0">
                            <select
                                value={session}
                                onChange={(e) => setSession(e.target.value)}
                                disabled={lockSessionSelect || isRunning}
                                className={`w-full appearance-none bg-[#202124] border border-white/10 text-white font-bold text-sm py-3 sm:py-2.5 min-h-[44px] px-4 rounded-full text-center focus:outline-none focus:border-[#d4af37] ${(lockSessionSelect || isRunning) ? 'opacity-80 cursor-not-allowed' : ''} ${dateSessionControlClassName}`}
                            >
                                {sessionOptions.map((opt) => (
                                    <option key={opt} value={opt}>
                                        {opt}
                                    </option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 md:px-6 text-gray-400">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                </svg>
                            </div>
                        </div>

                        {sessionRightSlot}
                    </div>
                </div>
            )}

            <div
                ref={contentRef}
                className={`flex-1 overflow-y-auto overflow-x-hidden w-full max-w-full ${
                    contentPaddingClass ?? (hideFooter ? 'pb-6' : 'pb-44 md:pb-32')
                }`}
            >
                {children}
            </div>

            {/* Footer - Card centered in right 50% on desktop (hidden when submit card is in content) */}
            {!hideFooter && (
            <div className="fixed bottom-[88px] left-0 right-0 md:bottom-0 z-10 px-3 sm:px-4 py-3 md:grid md:grid-cols-2 md:gap-0">
                <div className="hidden md:block" />
                <div className="flex justify-center md:justify-center">
                    <div
                        className={`w-full max-w-sm md:max-w-md rounded-2xl flex flex-col sm:flex-row items-center gap-4 sm:gap-6 ${
                            showFooterStats
                                ? 'bg-[#202124]/95 backdrop-blur-sm border border-white/10 shadow-xl shadow-black/30 px-4 py-4'
                                : 'bg-transparent border-0 shadow-none p-0'
                        }`}
                    >
                        {showFooterStats && (
                            <div className="flex items-center gap-6 sm:gap-8 shrink-0">
                                <div className="text-center">
                                    <div className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider">Bids</div>
                                    <div className="text-base sm:text-lg font-bold text-[#f2c14e]">{bidsCount}</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider">Points</div>
                                    <div className="text-base sm:text-lg font-bold text-[#f2c14e]">{totalPoints}</div>
                                </div>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={onSubmit}
                            disabled={!bidsCount}
                            className={`flex-1 w-full sm:w-auto sm:min-w-[140px] font-bold py-3 px-6 rounded-xl shadow-lg transition-all text-sm sm:text-base ${
                                bidsCount
                                    ? 'bg-gradient-to-r from-[#d4af37] to-[#cca84d] text-[#4b3608] hover:from-[#e5c04a] hover:to-[#d4af37] active:scale-[0.98]'
                                    : 'bg-gradient-to-r from-[#d4af37] to-[#cca84d] text-[#4b3608] opacity-50 cursor-not-allowed'
                            }`}
                        >
                            {submitLabel}
                        </button>
                    </div>
                </div>
            </div>
            )}
        </div>
    );
};

export default BidLayout;
