import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useBettingWindow } from './BettingWindowContext';

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
    // Optional: hide the session dropdown caret icon
    hideSessionSelectCaret = false,
    dateSessionControlClassName = '',
    dateSessionGridClassName = '',
    footerRightOnDesktop = false,
    hideFooter = false,
    walletBalance,
    onSubmit = () => {},
    showFooterStats = true,
    submitLabel = 'Submit Bets',
    contentPaddingClass,
    selectedDate = null,
    setSelectedDate = null,
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const contentRef = useRef(null);
    const dateInputRef = React.useRef(null);
    const { allowed: bettingAllowed, message: bettingMessage } = useBettingWindow();
    const todayDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
    const wallet = Number.isFinite(Number(walletBalance)) ? Number(walletBalance) : getWalletFromStorage();
    
    // Get minimum date (today) for date picker - calculate once
    const minDate = React.useMemo(() => {
        return new Date().toISOString().split('T')[0];
    }, []); // Only calculate once on mount
    
    // Internal state for date if not provided via props
    // Try to restore from localStorage, otherwise default to today
    const [internalDate, setInternalDate] = React.useState(() => {
        try {
            const savedDate = localStorage.getItem('betSelectedDate');
            if (savedDate) {
                const today = new Date().toISOString().split('T')[0];
                // Only restore if saved date is in the future (not today)
                if (savedDate > today) {
                    return savedDate;
                }
            }
        } catch (e) {
            // Ignore errors
        }
        const today = new Date();
        return today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    });
    
    const currentDate = selectedDate !== null ? selectedDate : internalDate;
    const setCurrentDate = setSelectedDate !== null ? setSelectedDate : (newDate) => {
        // Save to localStorage when date changes
        try {
            localStorage.setItem('betSelectedDate', newDate);
        } catch (e) {
            // Ignore errors
        }
        setInternalDate(newDate);
    };

    const marketStatus = market?.status;
    const isRunning = marketStatus === 'running'; // "CLOSED IS RUNNING"
    
    // Check if selected date is today or in the future
    // Compare dates as strings (YYYY-MM-DD format)
    const isToday = currentDate === minDate;
    // Schedule button should only show if date is in the future (not today)
    const isScheduled = currentDate > minDate;
    
    // Determine session options based on date selection:
    // - If today and market is running: only CLOSE
    // - If today and market is open: both OPEN and CLOSE
    // - If scheduled (future date): always both OPEN and CLOSE
    const sessionOptions =
        Array.isArray(sessionOptionsOverride) && sessionOptionsOverride.length
            ? sessionOptionsOverride
            : (isToday && isRunning ? ['CLOSE'] : ['OPEN', 'CLOSE']);

    useEffect(() => {
        // If market is "CLOSED IS RUNNING" and it's today, force session to CLOSE and lock it.
        if (Array.isArray(sessionOptionsOverride) && sessionOptionsOverride.length) {
            const desired = sessionOptionsOverride[0];
            if (desired && session !== desired) setSession(desired);
            return;
        }
        // Only force CLOSE if it's today and market is running
        if (isToday && isRunning && session !== 'CLOSE') {
            setSession('CLOSE');
        }
        // If scheduled (future date) and session was locked to CLOSE, allow OPEN option
        if (isScheduled && sessionOptions.includes('OPEN') && session === 'CLOSE' && isRunning) {
            // Don't force change, but allow user to choose OPEN for scheduled bets
        }
    }, [isToday, isScheduled, isRunning, session, setSession, sessionOptionsOverride, sessionOptions, currentDate]);

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
        <div className="min-h-screen min-h-ios-screen bg-black font-sans w-full max-w-full overflow-x-hidden">
            {/* Header - Home theme dark - iOS safe area padding */}
            <div
                className="bg-[#202124] border-b border-white/10 py-2 flex items-center justify-between gap-2 sticky top-0 z-10 mt-4"
                style={{ paddingLeft: 'max(0.75rem, env(safe-area-inset-left))', paddingRight: 'max(0.75rem, env(safe-area-inset-right))' }}
            >
                <button
                    onClick={() => market ? navigate('/bidoptions', { state: { market } }) : navigate(-1)}
                    className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full active:scale-95 transition-colors touch-manipulation"
                    aria-label="Back"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                </button>
                <h1 className="text-xs sm:text-base md:text-lg font-bold uppercase tracking-wide truncate flex-1 text-center mx-1 text-white min-w-0">
                    {market?.gameName ? `${market.gameName} - ${title}` : title}
                </h1>
                <div className="bg-[#f2c14e] text-[#4b3608] px-2 sm:px-3 py-1 rounded-full flex items-center gap-1.5 text-[11px] sm:text-sm font-bold shadow-md shrink-0">
                    <div className="w-5 h-5 bg-[#4b3608] rounded flex items-center justify-center text-[#f2c14e] text-xs font-bold">₹</div>
                    {wallet.toFixed(1)}
                </div>
            </div>

            {!bettingAllowed && bettingMessage && (
                <div className="mx-3 sm:mx-6 mt-2 p-3 rounded-xl bg-red-900/40 border border-red-500/60 text-red-200 text-sm font-medium flex items-center gap-2">
                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    {bettingMessage}
                </div>
            )}

            {extraHeader}

            {showDateSession && (
                <div
                    className={`pb-4 pt-2 flex flex-row flex-wrap gap-2 sm:gap-3 overflow-hidden ${dateSessionGridClassName}`}
                    style={{ paddingLeft: 'max(0.75rem, env(safe-area-inset-left))', paddingRight: 'max(0.75rem, env(safe-area-inset-right))' }}
                >
                    {/* Date Input Button */}
                    <div className="relative flex-1 min-w-0 shrink overflow-hidden">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                            <svg className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <input
                            ref={dateInputRef}
                            type="date"
                            value={currentDate}
                            min={minDate}
                            max="2099-12-31"
                            onChange={(e) => {
                                const selected = e.target.value;
                                // Ensure selected date is not in the past
                                if (selected >= minDate) {
                                    setCurrentDate(selected);
                                }
                            }}
                            onKeyDown={(e) => {
                                // Prevent manual typing - only allow calendar selection
                                e.preventDefault();
                                return false;
                            }}
                            onPaste={(e) => {
                                // Prevent pasting dates
                                e.preventDefault();
                                return false;
                            }}
                            className={`w-full pl-9 sm:pl-10 pr-3 py-2.5 min-h-[44px] h-[44px] bg-[#202124] border border-white/10 text-white rounded-full text-xs sm:text-sm font-bold text-center focus:outline-none focus:border-[#d4af37] cursor-pointer truncate ${dateSessionControlClassName}`}
                            style={{
                                colorScheme: 'dark',
                            }}
                            title="Select date for scheduling your bet"
                        />
                    </div>
                    
                    {/* Schedule Button */}
                    <button
                        type="button"
                        onClick={() => {
                            // Open the date picker when Schedule button is clicked
                            if (dateInputRef.current) {
                                // Try modern showPicker API first
                                if (typeof dateInputRef.current.showPicker === 'function') {
                                    dateInputRef.current.showPicker().catch(() => {
                                        // Fallback if showPicker fails
                                        dateInputRef.current.focus();
                                        dateInputRef.current.click();
                                    });
                                } else {
                                    // Fallback for browsers that don't support showPicker
                                    dateInputRef.current.focus();
                                    dateInputRef.current.click();
                                }
                            }
                        }}
                        className={`shrink-0 px-2 sm:px-3 py-2.5 min-h-[44px] h-[44px] font-bold text-xs sm:text-sm rounded-full transition-all active:scale-[0.98] shadow-md flex items-center justify-center gap-1.5 min-w-[44px] ${
                            isScheduled
                                ? 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-400 hover:to-green-500 cursor-pointer'
                                : 'bg-gradient-to-r from-[#d4af37] to-[#cca84d] text-[#4b3608] hover:from-[#e5c04a] hover:to-[#d4af37] cursor-pointer'
                        }`}
                        title={isScheduled ? "Bet scheduled! Click to change date" : "Click to open calendar and schedule bet"}
                    >
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="hidden sm:inline whitespace-nowrap truncate max-w-[70px]">{isScheduled ? 'Scheduled' : 'Schedule'}</span>
                        {isScheduled && (
                            <svg className="hidden sm:block w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        )}
                    </button>
                    
                    {/* Session Select - hidden on mobile, each bid screen has its own session control */}
                    <div className="relative flex-1 min-w-0 hidden md:block">
                        <select
                            value={session}
                            onChange={(e) => setSession(e.target.value)}
                            disabled={lockSessionSelect || (isToday && isRunning)}
                            className={`w-full appearance-none bg-[#202124] border border-white/10 text-white font-bold text-xs sm:text-sm py-2.5 min-h-[44px] h-[44px] px-4 pr-8 rounded-full text-center focus:outline-none focus:border-[#d4af37] ${(lockSessionSelect || (isToday && isRunning)) ? 'opacity-80 cursor-not-allowed' : ''} ${dateSessionControlClassName}`}
                        >
                            {sessionOptions.map((opt) => (
                                <option key={opt} value={opt}>
                                    {opt}
                                </option>
                            ))}
                        </select>
                        {!hideSessionSelectCaret && (
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                </svg>
                            </div>
                        )}
                    </div>

                    {sessionRightSlot}
                </div>
            )}

            <div
                ref={contentRef}
                className={`flex-1 overflow-y-auto overflow-x-hidden w-full max-w-full ios-scroll-touch ${
                    contentPaddingClass ?? (hideFooter ? 'pb-6' : 'pb-[calc(7rem+env(safe-area-inset-bottom,0px))] md:pb-32')
                }`}
                style={{ paddingLeft: 'max(0.75rem, env(safe-area-inset-left))', paddingRight: 'max(0.75rem, env(safe-area-inset-right))' }}
            >
                {children}
            </div>

            {/* Footer - Card centered in right 50% on desktop (hidden when submit card is in content) - iOS safe area */}
            {!hideFooter && (
            <div
                className="fixed bottom-[calc(80px+env(safe-area-inset-bottom,0px))] left-0 right-0 md:bottom-0 z-10 py-3 md:grid md:grid-cols-2 md:gap-0"
                style={{
                    paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
                    paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
                }}
            >
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
                                    <div className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider">Bets</div>
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
                            disabled={!bidsCount || !bettingAllowed}
                            className={`flex-1 w-full sm:w-auto sm:min-w-[140px] font-bold py-3 px-6 rounded-xl shadow-lg transition-all text-sm sm:text-base ${
                                bidsCount && bettingAllowed
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
