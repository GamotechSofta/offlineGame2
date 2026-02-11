import React, { useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayerBet } from './PlayerBetContext';
import { FaSearch, FaUser, FaCheck } from 'react-icons/fa';

/**
 * BookieBidLayout - mirrors frontend's BidLayout interface but adapted for bookie panel.
 * Key differences:
 *   - Shows player selector at top
 *   - Wallet shows player's balance
 *   - No BettingWindow dependency
 *   - Wrapped in dark theme matching frontend bid screens
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
        players,
        selectedPlayerId,
        setSelectedPlayerId,
        selectedPlayer,
        walletBalance,
        loadingPlayers,
    } = usePlayerBet();

    const [playerSearch, setPlayerSearch] = useState('');
    const [showPlayerList, setShowPlayerList] = useState(!selectedPlayerId);

    const filteredPlayers = useMemo(() => {
        if (!playerSearch.trim()) return players;
        const q = playerSearch.trim().toLowerCase();
        return players.filter((p) =>
            (p.username || '').toLowerCase().includes(q) ||
            (p.email || '').toLowerCase().includes(q) ||
            (p.phone || '').includes(q)
        );
    }, [players, playerSearch]);

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

    const isRunning = market?.status === 'running';
    const isToday = currentDate === minDate;
    const isScheduled = currentDate > minDate;

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
        <div className="min-h-screen bg-black font-sans w-full max-w-full overflow-x-hidden">
            {/* Header */}
            <div className="bg-[#202124] border-b border-white/10 py-2 flex items-center justify-between gap-2 sticky top-0 z-10 px-3">
                <button
                    onClick={() => {
                        const query = selectedPlayerId ? `?playerId=${selectedPlayerId}` : '';
                        navigate(`/games/${marketId}${query}`);
                    }}
                    className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full active:scale-95 transition-colors"
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

            {/* Player Selector */}
            <div className="mx-3 mt-2">
                {selectedPlayer && !showPlayerList ? (
                    <div className="flex items-center gap-3 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-xl">
                        <div className="w-9 h-9 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
                            <FaUser className="w-3.5 h-3.5 text-yellow-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-white font-semibold text-sm truncate">{selectedPlayer.username}</p>
                            <p className="text-xs text-gray-400">{selectedPlayer.phone || selectedPlayer.email || ''}</p>
                        </div>
                        <div className="text-right shrink-0 mr-2">
                            <p className="text-green-400 font-mono font-bold text-sm">₹{wallet.toLocaleString('en-IN')}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowPlayerList(true)}
                            className="text-xs text-yellow-500 hover:text-yellow-400 font-semibold shrink-0"
                        >
                            Change
                        </button>
                    </div>
                ) : (
                    <div className="bg-[#202124] border border-white/10 rounded-xl p-3">
                        <p className="text-yellow-500 font-semibold text-sm mb-2 flex items-center gap-2">
                            <FaUser className="w-3 h-3" /> Select Player
                        </p>
                        {loadingPlayers ? (
                            <p className="text-gray-400 text-sm">Loading players...</p>
                        ) : players.length === 0 ? (
                            <p className="text-gray-400 text-sm">
                                No players found.{' '}
                                <button type="button" onClick={() => navigate('/add-user')} className="text-yellow-500 hover:underline">
                                    Add a player first
                                </button>
                            </p>
                        ) : (
                            <>
                                <div className="relative mb-2">
                                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-3 h-3" />
                                    <input
                                        type="text"
                                        placeholder="Search players..."
                                        value={playerSearch}
                                        onChange={(e) => setPlayerSearch(e.target.value)}
                                        className="w-full pl-8 pr-3 py-2 bg-black/50 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50 text-sm"
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                                    {filteredPlayers.map((p) => (
                                        <button
                                            key={p._id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedPlayerId(p._id);
                                                setShowPlayerList(false);
                                                setPlayerSearch('');
                                            }}
                                            className={`text-left px-3 py-2 rounded-lg border transition-all text-sm ${
                                                selectedPlayerId === p._id
                                                    ? 'bg-yellow-500/20 border-yellow-500 text-yellow-300'
                                                    : 'bg-black/30 border-white/10 text-gray-300 hover:border-white/30'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium truncate">{p.username}</span>
                                                {selectedPlayerId === p._id && <FaCheck className="w-3 h-3 text-yellow-500 shrink-0 ml-1" />}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-xs text-gray-500">{p.phone || p.email || ''}</span>
                                                <span className="text-xs font-mono text-green-400 ml-auto">₹{Number(p.walletBalance ?? 0).toLocaleString('en-IN')}</span>
                                            </div>
                                        </button>
                                    ))}
                                    {filteredPlayers.length === 0 && (
                                        <p className="text-gray-500 text-sm col-span-2 text-center py-2">No match</p>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* No player warning */}
            {!selectedPlayer && !showPlayerList && (
                <div className="mx-3 mt-2 p-3 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-200 text-sm">
                    Please select a player to place bets.
                </div>
            )}

            {extraHeader}

            {/* Date & Session Controls */}
            {showDateSession && (
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
                            className="w-full pl-9 sm:pl-10 pr-3 py-2.5 min-h-[44px] h-[44px] bg-[#202124] border border-white/10 text-white rounded-full text-xs sm:text-sm font-bold text-center focus:outline-none focus:border-[#d4af37] cursor-pointer truncate"
                            style={{ colorScheme: 'dark' }}
                        />
                    </div>

                    {/* Schedule Button */}
                    <button
                        type="button"
                        onClick={() => {
                            if (dateInputRef.current) {
                                if (typeof dateInputRef.current.showPicker === 'function') {
                                    dateInputRef.current.showPicker().catch(() => {
                                        dateInputRef.current.focus();
                                        dateInputRef.current.click();
                                    });
                                } else {
                                    dateInputRef.current.focus();
                                    dateInputRef.current.click();
                                }
                            }
                        }}
                        className={`shrink-0 px-2 sm:px-3 py-2.5 min-h-[44px] h-[44px] font-bold text-xs sm:text-sm rounded-full transition-all active:scale-[0.98] shadow-md flex items-center justify-center gap-1.5 min-w-[44px] ${
                            isScheduled
                                ? 'bg-gradient-to-r from-green-500 to-green-600 text-white'
                                : 'bg-gradient-to-r from-[#d4af37] to-[#cca84d] text-[#4b3608]'
                        }`}
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

                    {/* Session Select */}
                    <div className="relative flex-1 min-w-0">
                        <select
                            value={session}
                            onChange={(e) => setSession(e.target.value)}
                            disabled={lockSessionSelect || (isToday && isRunning)}
                            className={`w-full appearance-none bg-[#202124] border border-white/10 text-white font-bold text-xs sm:text-sm py-2.5 min-h-[44px] h-[44px] px-4 pr-8 rounded-full text-center focus:outline-none focus:border-[#d4af37] ${(lockSessionSelect || (isToday && isRunning)) ? 'opacity-80 cursor-not-allowed' : ''}`}
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
                    contentPaddingClass ?? (hideFooter ? 'pb-6' : 'pb-32')
                }`}
                style={{ paddingLeft: 'max(0.75rem, env(safe-area-inset-left))', paddingRight: 'max(0.75rem, env(safe-area-inset-right))' }}
            >
                {children}
            </div>

            {/* Footer */}
            {!hideFooter && (
                <div className="fixed bottom-0 left-0 right-0 lg:left-56 z-10 py-3 px-3 bg-black/90 backdrop-blur-sm border-t border-white/10">
                    <div className="flex justify-center">
                        <div className={`w-full max-w-sm md:max-w-md rounded-2xl flex flex-col sm:flex-row items-center gap-4 sm:gap-6 ${
                            showFooterStats ? 'bg-[#202124]/95 border border-white/10 shadow-xl px-4 py-4' : 'bg-transparent p-0'
                        }`}>
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
                                disabled={!bidsCount || !selectedPlayer}
                                className={`flex-1 w-full sm:w-auto sm:min-w-[140px] font-bold py-3 px-6 rounded-xl shadow-lg transition-all text-sm sm:text-base ${
                                    bidsCount && selectedPlayer
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

export default BookieBidLayout;
