import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { usePlayerBet } from './PlayerBetContext';
import { useBetCart } from './BetCartContext';
import { useLanguage } from '../../context/LanguageContext';
import { getMarketDisplayName } from '../../utils/api';
import BidReviewModal from './BidReviewModal';
import { GAME_TYPE_ORDER, BID_COMPONENTS } from './gameTypes';

const SingleScrollGameBid = () => {
    const { marketId } = useParams();
    const [searchParams] = useSearchParams();
    const playerId = searchParams.get('playerId') || '';
    const navigate = useNavigate();
    const dateInputRef = useRef(null);

    const {
        market,
        selectedPlayer,
        walletBalance,
        playerName,
        placeBet,
        updatePlayerBalance,
    } = usePlayerBet();
    const { cartItems, cartCount, cartTotal, clearCart } = useBetCart();

    const { language } = useLanguage();
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const marketDisplayName = market ? getMarketDisplayName(market, language) : '';

    const handlePlaceBet = async () => {
        const mktId = market?._id || market?.id;
        if (!mktId) throw new Error('Market not found');
        if (!selectedPlayer) throw new Error('No player selected');
        if (!cartItems.length) throw new Error('Cart is empty');

        const payload = cartItems.map((item) => ({
            betType: item.betType,
            betNumber: item.number,
            amount: item.points,
            betOn: item.session === 'CLOSE' ? 'close' : 'open',
        }));

        let scheduledDate = null;
        try {
            const savedDate = localStorage.getItem('bookieBetSelectedDate');
            if (savedDate) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const savedDateObj = new Date(savedDate);
                savedDateObj.setHours(0, 0, 0, 0);
                if (savedDateObj > today) scheduledDate = savedDate;
            }
        } catch (e) { /* ignore */ }

        const result = await placeBet(mktId, payload, scheduledDate);
        if (!result.success) throw new Error(result.message || 'Failed to place bets');
        if (result.data?.newBalance != null) updatePlayerBalance(result.data.newBalance);
        clearCart();
    };

    const reviewRows = cartItems.map((item) => ({
        id: item.id,
        number: item.number,
        points: String(item.points),
        type: item.session,
        gameTypeLabel: item.gameTypeLabel,
    }));

    const minDate = new Date().toISOString().split('T')[0];
    const [currentDate, setCurrentDate] = useState(() => {
        try {
            const savedDate = localStorage.getItem('bookieBetSelectedDate');
            if (savedDate) return savedDate;
        } catch (e) { /* ignore */ }
        return minDate;
    });

    useEffect(() => {
        try {
            localStorage.setItem('bookieBetSelectedDate', currentDate);
        } catch (e) { /* ignore */ }
    }, [currentDate]);

    const dateText = new Date().toLocaleDateString('en-GB');

    return (
        <div className="flex flex-col h-screen bg-gray-100 font-sans text-gray-800 w-full max-w-full overflow-hidden antialiased">
            {/* Sticky top bar: header + date row (non-scrollable) */}
            <header className="shrink-0 sticky top-0 z-20 bg-white border-b border-gray-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-3">
                    <button
                        type="button"
                        onClick={() => navigate(playerId ? `/games?playerId=${playerId}` : '/games')}
                        className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
                        aria-label="Back to markets"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <h1 className="flex-1 text-center mx-2 text-sm sm:text-base md:text-lg font-bold uppercase tracking-tight truncate text-gray-900 min-w-0">
                        {marketDisplayName ? `${marketDisplayName} — All Games` : 'All Games'}
                    </h1>
                    <div className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs sm:text-sm font-bold shadow-sm">
                        <span className="w-5 h-5 rounded-md bg-white/20 flex items-center justify-center text-white font-bold">₹</span>
                        <span className="tabular-nums">{Number(walletBalance ?? 0).toFixed(1)}</span>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 px-3 sm:px-4 py-2 bg-gray-50/80 border-t border-gray-100">
                    <div className="relative flex-1 min-w-[130px] max-w-[220px] sm:max-w-none">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10 text-gray-400">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <input
                            ref={dateInputRef}
                            type="date"
                            value={currentDate}
                            min={minDate}
                            max="2099-12-31"
                            onChange={(e) => { const v = e.target.value; if (v >= minDate) setCurrentDate(v); }}
                            className="w-full h-10 pl-9 pr-3 rounded-lg bg-white border border-gray-200 text-gray-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 cursor-pointer transition-shadow"
                            style={{ colorScheme: 'light' }}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => { try { dateInputRef.current?.showPicker?.(); } catch { dateInputRef.current?.focus?.(); } }}
                        className="flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg font-semibold text-sm bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-colors"
                    >
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="hidden sm:inline">Schedule</span>
                    </button>
                </div>
            </header>

            {/* Scrollable content */}
            <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-behavior-y-contain px-3 sm:px-4 py-3 pb-28">
                <div className="space-y-3 max-w-4xl mx-auto">
                    {GAME_TYPE_ORDER.map((gt, i) => {
                        const entry = BID_COMPONENTS[gt];
                        if (!entry) return null;
                        const BidComponent = entry.component;
                        return (
                            <section key={gt}>
                                <div className="flex items-center gap-3 px-0 py-2 sm:py-2.5">
                                    <span className="flex items-center justify-center w-6 h-6 rounded-md bg-orange-500/10 text-orange-600 text-xs font-bold tabular-nums">
                                        {i + 1}
                                    </span>
                                    <h2 className="text-base sm:text-lg font-bold text-gray-900">
                                        {entry.title}
                                    </h2>
                                </div>
                                <div className="px-0 pb-2">
                                    <BidComponent
                                        title={entry.title}
                                        gameType={gt}
                                        betType={entry.betType}
                                        embedInSingleScroll
                                    />
                                </div>
                            </section>
                        );
                    })}
                </div>
            </main>

            {/* Submit bet: right-aligned, no strip */}
            <div className="fixed bottom-4 right-4 z-20 flex flex-col items-end gap-1">
                {!selectedPlayer && cartCount > 0 && (
                    <p className="text-xs text-amber-600 font-medium">Select a player to place bets</p>
                )}
                <div className="flex items-center gap-2">
                    {cartCount > 0 && (
                        <span className="text-sm text-gray-500 tabular-nums">₹{cartTotal.toLocaleString('en-IN')}</span>
                    )}
                    <button
                        type="button"
                        onClick={() => setIsReviewOpen(true)}
                        disabled={cartCount === 0 || !selectedPlayer}
                        className={`min-w-[120px] font-bold py-3 px-5 rounded-xl text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                            cartCount > 0 && selectedPlayer
                                ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md hover:from-orange-600 hover:to-orange-700 focus-visible:ring-orange-500 active:scale-[0.98]'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed focus-visible:ring-gray-400'
                        }`}
                    >
                        Submit bet
                    </button>
                </div>
            </div>

            <BidReviewModal
                open={isReviewOpen}
                onClose={() => setIsReviewOpen(false)}
                onSubmit={handlePlaceBet}
                marketTitle={marketDisplayName}
                dateText={dateText}
                labelKey="Number"
                rows={reviewRows}
                walletBefore={walletBalance}
                totalBids={cartCount}
                totalAmount={cartTotal}
                playerName={playerName}
                showGameType
            />
        </div>
    );
};

export default SingleScrollGameBid;
