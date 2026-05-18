import React, { useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayerBet } from './PlayerBetContext';
import { isPastOpeningTime } from '../../utils/marketTiming';

/**
 * BookieBidLayout - mirrors frontend's BidLayout interface but adapted for bookie panel.
 * Player selection is handled in the Cart Panel sidebar.
 */
const BookieBidLayout = ({
    title,
    children,
    bidsCount = 0,
    totalPoints = 0,
    showDateSession = true,
    extraHeader,
    session = 'OPEN',
    setSession = () => {},
    sessionOptionsOverride = null,
    lockSessionSelect = false,
    hideSessionSelectCaret = false,
    hideFooter = false,
    noHeader = false,
    noDateSession = false,
    noFooter = false,
    onSubmit = () => {},
    showFooterStats = true,
    submitLabel = 'Submit Bets',
    contentPaddingClass,
    selectedDate = null,
    setSelectedDate = null,
}) => {
    const navigate = useNavigate();
    const contentRef = useRef(null);
    const dateInputRef = useRef(null);
    const {
        market,
        marketId,
        selectedPlayerId,
        selectedPlayer,
        walletBalance,
    } = usePlayerBet();

    const wallet = walletBalance;

    const minDate = useMemo(() => new Date().toISOString().split('T')[0], []);

    const [internalDate, setInternalDate] = useState(() => {
        try {
            const savedDate = localStorage.getItem('bookieBetSelectedDate');
            if (savedDate && savedDate > new Date().toISOString().split('T')[0]) {
                return savedDate;
            }
        } catch (e) { /* ignore */ }
        return new Date().toISOString().split('T')[0];
    });

    const currentDate = selectedDate !== null ? selectedDate : internalDate;
    const setCurrentDate = setSelectedDate !== null ? setSelectedDate : (newDate) => {
        try { localStorage.setItem('bookieBetSelectedDate', newDate); } catch (e) { /* ignore */ }
        setInternalDate(newDate);
    };

    const isRunning = isPastOpeningTime(market);
    const isToday = currentDate === minDate;

    const sessionOptions =
        Array.isArray(sessionOptionsOverride) && sessionOptionsOverride.length
            ? sessionOptionsOverride
            : (isToday && isRunning ? ['CLOSE'] : ['OPEN', 'CLOSE']);

    React.useEffect(() => {
        if (Array.isArray(sessionOptionsOverride) && sessionOptionsOverride.length) {
            const desired = sessionOptionsOverride[0];
            if (desired && session !== desired) setSession(desired);
            return;
        }
        if (isToday && isRunning && session !== 'CLOSE') {
            setSession('CLOSE');
        }
    }, [isToday, isRunning, session, setSession, sessionOptionsOverride]);

    return (
        <div className="min-h-screen bg-white font-sans w-full max-w-full overflow-x-hidden">
            {!noHeader && (
            <div className="bg-white border-b-2 border-gray-200 py-2 flex items-center justify-between gap-2 sticky top-0 z-10 px-3 shadow-sm">
                <button
                    onClick={() => {
                        const query = selectedPlayerId ? `?playerId=${selectedPlayerId}` : '';
                        navigate(`/games/${marketId}${query}`);
                    }}
                    className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-600 hover:text-[#1B3150] rounded-full active:scale-95 transition-colors"
                    aria-label="Back"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                </button>
                <h1 className="text-xs sm:text-base md:text-lg font-bold uppercase tracking-wide truncate flex-1 text-center mx-1 text-gray-800 min-w-0">
                    {market?.gameName ? `${market.gameName} - ${title}` : title}
                </h1>
                <div className="bg-[#1B3150] text-white px-2 sm:px-3 py-1.5 rounded-full flex items-center gap-1.5 text-[11px] sm:text-sm font-bold shadow-md shrink-0">
                    <span className="text-white/90">₹</span>
                    {wallet.toFixed(1)}
                </div>
            </div>
            )}

            {extraHeader}

            {/* Date & Session Controls */}
            {!noDateSession && showDateSession && (
                <div className="pb-4 pt-2 flex flex-row flex-wrap gap-2 sm:gap-3 overflow-hidden px-3">
                    {/* Date Input */}
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
                                if (selected >= minDate) setCurrentDate(selected);
                            }}
                            onKeyDown={(e) => e.preventDefault()}
                            onPaste={(e) => e.preventDefault()}
                            className="w-full pl-9 sm:pl-10 pr-3 py-2.5 min-h-[44px] h-[44px] bg-white border-2 border-gray-200 text-gray-800 rounded-lg text-xs sm:text-sm font-bold text-center focus:outline-none focus:border-[#1B3150] focus:ring-1 focus:ring-[#1B3150] cursor-pointer truncate"
                            style={{ colorScheme: 'light' }}
                        />
                    </div>

                    {/* Session Select */}
                    <div className="relative flex-1 min-w-0">
                        <select
                            value={session}
                            onChange={(e) => setSession(e.target.value)}
                            disabled={lockSessionSelect || (isToday && isRunning)}
                            className={`w-full appearance-none bg-white border-2 border-gray-200 text-gray-800 font-bold text-xs sm:text-sm py-2.5 min-h-[44px] h-[44px] px-4 pr-8 rounded-lg text-center focus:outline-none focus:border-[#1B3150] focus:ring-1 focus:ring-[#1B3150] ${(lockSessionSelect || (isToday && isRunning)) ? 'opacity-80 cursor-not-allowed' : ''}`}
                        >
                            {sessionOptions.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
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
                </div>
            )}

            {/* Content */}
            <div
                ref={contentRef}
                className={`flex-1 overflow-y-auto overflow-x-hidden w-full max-w-full ${
                    noFooter ? 'pb-0' : (contentPaddingClass ?? (hideFooter ? 'pb-6' : 'pb-32'))
                }`}
                style={{ paddingLeft: 'max(0.75rem, env(safe-area-inset-left))', paddingRight: 'max(0.75rem, env(safe-area-inset-right))' }}
            >
                {children}
            </div>

            {/* Footer */}
            {!noFooter && !hideFooter && (
                <div className="fixed bottom-0 left-0 right-0 lg:left-56 z-10 py-3 px-3 bg-white border-t-2 border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
                    <div className="flex justify-center">
                        <div className={`w-full max-w-sm md:max-w-md rounded-2xl flex flex-col sm:flex-row items-center gap-4 sm:gap-6 ${
                            showFooterStats ? 'bg-gray-50 border-2 border-gray-200 shadow-lg px-4 py-4' : 'bg-transparent p-0'
                        }`}>
                            {showFooterStats && (
                                <div className="flex items-center gap-6 sm:gap-8 shrink-0">
                                    <div className="text-center">
                                    <div className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider">Bets</div>
                                    <div className="text-base sm:text-lg font-bold text-[#1B3150]">{bidsCount}</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider">Points</div>
                                    <div className="text-base sm:text-lg font-bold text-[#1B3150]">{totalPoints}</div>
                                    </div>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={onSubmit}
                                disabled={!bidsCount || !selectedPlayer}
                                className={`flex-1 w-full sm:w-auto sm:min-w-[140px] font-bold py-3 px-6 rounded-xl shadow-lg transition-all text-sm sm:text-base ${
                                    bidsCount && selectedPlayer
                                        ? 'bg-[#1B3150] text-white hover:bg-[#152842] active:scale-[0.98]'
                                        : 'bg-[#1B3150] text-white opacity-50 cursor-not-allowed'
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

export default BookieBidLayout;
