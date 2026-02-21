import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { PlayerBetProvider } from './PlayerBetContext';
import { BetCartProvider, useBetCart } from './BetCartContext';
import CartPanel, { CartToggleButton, getStoredWidth, STORAGE_KEY } from './CartPanel';
import GamesSidebar, { GamesSidebarToggle, getStoredSidebarWidth, SIDEBAR_STORAGE_KEY } from '../../components/GamesSidebar';
import { API_BASE_URL, getMarketDisplayName } from '../../utils/api';
import { useLanguage } from '../../context/LanguageContext';
import { GAME_TYPE_ORDER, BID_COMPONENTS } from './gameTypes';
import { useBetLayout } from '../../context/BetLayoutContext';
import { LAYOUT_SINGLE } from '../../utils/bookieLayout';
import SingleScrollGameBid from './SingleScrollGameBid';

/* Inner component that can access BetCartContext */
const GameBidInner = ({ marketId, gameType, playerId, betType, title, BidComponent }) => {
    const navigate = useNavigate();
    const { language } = useLanguage();
    const [gamesSidebarOpen, setGamesSidebarOpen] = useState(false);
    const [cartOpen, setCartOpen] = useState(false);
    const [market, setMarket] = useState(null);

    // Navigate to previous/next game type (by index)
    const goToPrevGame = useCallback(() => {
        const currentIdx = GAME_TYPE_ORDER.indexOf(gameType);
        if (currentIdx === -1) return;
        const nextIdx = (currentIdx - 1 + GAME_TYPE_ORDER.length) % GAME_TYPE_ORDER.length;
        const nextGame = GAME_TYPE_ORDER[nextIdx];
        const query = playerId ? `?playerId=${playerId}` : '';
        navigate(`/games/${marketId}/${nextGame}${query}`);
    }, [gameType, marketId, playerId, navigate]);

    const goToNextGame = useCallback(() => {
        const currentIdx = GAME_TYPE_ORDER.indexOf(gameType);
        if (currentIdx === -1) return;
        const nextIdx = (currentIdx + 1) % GAME_TYPE_ORDER.length;
        const nextGame = GAME_TYPE_ORDER[nextIdx];
        const query = playerId ? `?playerId=${playerId}` : '';
        navigate(`/games/${marketId}/${nextGame}${query}`);
    }, [gameType, marketId, playerId, navigate]);

    // ArrowLeft / ArrowRight (or Ctrl+Arrow) → previous/next game box; skip when focus is in input/textarea/select
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            const withCtrl = e.ctrlKey || e.metaKey;
            const target = e.target;
            const isEditable = target && (
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.tagName === 'SELECT' ||
                (target.isContentEditable && target.getAttribute('contenteditable') === 'true')
            );
            if (isEditable && !withCtrl) return;

            e.preventDefault();
            const currentIdx = GAME_TYPE_ORDER.indexOf(gameType);
            if (currentIdx === -1) return;

            if (e.key === 'ArrowRight') {
                goToNextGame();
            } else {
                goToPrevGame();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [gameType, goToPrevGame, goToNextGame]);

    // Sidebar width (left)
    const [sidebarWidth, setSidebarWidth] = useState(getStoredSidebarWidth);
    const handleSidebarWidthChange = useCallback((newWidth) => {
        setSidebarWidth(newWidth);
        try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(newWidth)); } catch (e) { /* ignore */ }
    }, []);

    // Cart width (right)
    const [cartWidth, setCartWidth] = useState(getStoredWidth);
    const handleCartWidthChange = useCallback((newWidth) => {
        setCartWidth(newWidth);
        try { localStorage.setItem(STORAGE_KEY, String(newWidth)); } catch (e) { /* ignore */ }
    }, []);

    const { cartCount } = useBetCart();

    useEffect(() => {
        const fetchMarketName = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/markets/get-markets`);
                const data = await res.json();
                if (data.success && Array.isArray(data.data)) {
                    const found = data.data.find((m) => m._id === marketId);
                    if (found) setMarketName(found.marketName || '');
                }
            } catch (err) { /* silent */ }
        };
        fetchMarketName();
    }, [marketId]);

    return (
        <div className="min-h-screen bg-white">
            {/* Dynamic CSS custom properties for sidebar & cart widths on desktop */}
            <style>{`
                @media (min-width: 1024px) {
                    :root { --sidebar-w: ${sidebarWidth}px; }
                }
                @media (max-width: 1023px) {
                    :root { --sidebar-w: 0px; }
                }
                @media (min-width: 1280px) {
                    :root { --cart-w: ${cartWidth}px; }
                }
                @media (max-width: 1279px) {
                    :root { --cart-w: 0px; }
                }
            `}</style>

            {/* Left Sidebar — Game Types */}
            <GamesSidebar
                marketId={marketId}
                playerId={playerId}
                activeGameType={gameType}
                marketName={market ? getMarketDisplayName(market, language) : ''}
                isOpen={gamesSidebarOpen}
                onClose={() => setGamesSidebarOpen(false)}
                width={sidebarWidth}
                onWidthChange={handleSidebarWidthChange}
            />

            {/* Mobile toggle for left sidebar */}
            <GamesSidebarToggle onClick={() => setGamesSidebarOpen(true)} />

            {/* Main content — dynamic margins for sidebar (left) and cart (right) */}
            <div
                style={{
                    marginLeft: 'var(--sidebar-w, 0px)',
                    marginRight: 'var(--cart-w, 0px)',
                }}
            >
                {/* Previous / Next game — keyboard: Arrow Left / Arrow Right; click or Tab+Enter on buttons */}
                <div className="flex items-center justify-center gap-2 py-2 px-2 border-b border-gray-100 bg-gray-50/80">
                    <button
                        type="button"
                        onClick={goToPrevGame}
                        className="p-2 min-w-[44px] min-h-[44px] rounded-full bg-white border border-gray-200 text-gray-600 hover:text-orange-500 hover:border-orange-300 hover:bg-orange-50 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-1"
                        aria-label="Previous game type"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <span className="text-xs text-gray-500 font-medium px-2 truncate max-w-[140px] sm:max-w-[200px]" title={title}>
                        {title}
                    </span>
                    <button
                        type="button"
                        onClick={goToNextGame}
                        className="p-2 min-w-[44px] min-h-[44px] rounded-full bg-white border border-gray-200 text-gray-600 hover:text-orange-500 hover:border-orange-300 hover:bg-orange-50 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-1"
                        aria-label="Next game type"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
                <BidComponent
                    title={title}
                    gameType={gameType}
                    betType={betType}
                    fitSingleScreen={gameType === 'jodi'}
                />
            </div>

            {/* Right Sidebar — Cart Panel */}
            <CartPanel
                isOpen={cartOpen}
                onClose={() => setCartOpen(false)}
                width={cartWidth}
                onWidthChange={handleCartWidthChange}
            />

            {/* Floating cart button for mobile/tablet */}
            <CartToggleButton onClick={() => setCartOpen(true)} cartCount={cartCount} />
        </div>
    );
};

const BookieGameBid = () => {
    const { marketId, gameType } = useParams();
    const [searchParams] = useSearchParams();
    const playerId = searchParams.get('playerId') || '';
    const navigate = useNavigate();

    const { layout: betLayout } = useBetLayout();
    if (betLayout === LAYOUT_SINGLE) {
        return (
            <BetCartProvider>
                <PlayerBetProvider>
                    <SingleScrollGameBid />
                </PlayerBetProvider>
            </BetCartProvider>
        );
    }

    const entry = BID_COMPONENTS[gameType];

    if (!entry) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center text-gray-800">
                <div className="text-center">
                    <p className="text-lg font-bold text-red-500 mb-2">Unknown Game Type</p>
                    <p className="text-gray-400 text-sm mb-4">The game type "{gameType}" is not recognized.</p>
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="text-orange-500 hover:underline text-sm"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <BetCartProvider>
            <PlayerBetProvider>
                <GameBidInner
                    marketId={marketId}
                    gameType={gameType}
                    playerId={playerId}
                    betType={entry.betType}
                    title={entry.title}
                    BidComponent={entry.component}
                />
            </PlayerBetProvider>
        </BetCartProvider>
    );
};

export default BookieGameBid;
