import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { PlayerBetProvider } from './PlayerBetContext';
import { BetCartProvider, useBetCart } from './BetCartContext';
import CartPanel, { CartToggleButton, getStoredWidth, STORAGE_KEY } from './CartPanel';
import GamesSidebar, { GamesSidebarToggle, getStoredSidebarWidth, SIDEBAR_STORAGE_KEY } from '../../components/GamesSidebar';
import { API_BASE_URL } from '../../utils/api';
import SingleDigitBid from './bids/SingleDigitBid';
import SingleDigitBulkBid from './bids/SingleDigitBulkBid';
import JodiBid from './bids/JodiBid';
import JodiBulkBid from './bids/JodiBulkBid';
import SinglePanaBid from './bids/SinglePanaBid';
import SinglePanaBulkBid from './bids/SinglePanaBulkBid';
import DoublePanaBid from './bids/DoublePanaBid';
import DoublePanaBulkBid from './bids/DoublePanaBulkBid';
import TriplePanaBid from './bids/TriplePanaBid';
import FullSangamBid from './bids/FullSangamBid';
import HalfSangamABid from './bids/HalfSangamABid';

const BID_COMPONENTS = {
    'single-digit': { component: SingleDigitBid, title: 'Single Digit', betType: 'single' },
    'single-digit-bulk': { component: SingleDigitBulkBid, title: 'Single Digit Bulk', betType: 'single' },
    'jodi': { component: JodiBid, title: 'Jodi', betType: 'jodi' },
    'jodi-bulk': { component: JodiBulkBid, title: 'Jodi Bulk', betType: 'jodi' },
    'single-pana': { component: SinglePanaBid, title: 'Single Pana', betType: 'panna' },
    'single-pana-bulk': { component: SinglePanaBulkBid, title: 'Single Pana Bulk', betType: 'panna' },
    'double-pana': { component: DoublePanaBid, title: 'Double Pana', betType: 'panna' },
    'double-pana-bulk': { component: DoublePanaBulkBid, title: 'Double Pana Bulk', betType: 'panna' },
    'triple-pana': { component: TriplePanaBid, title: 'Triple Pana', betType: 'panna' },
    'full-sangam': { component: FullSangamBid, title: 'Full Sangam', betType: 'full-sangam' },
    'half-sangam': { component: HalfSangamABid, title: 'Half Sangam (O)', betType: 'half-sangam' },
};

/* Inner component that can access BetCartContext */
const GameBidInner = ({ marketId, gameType, playerId, betType, title, BidComponent }) => {
    const [gamesSidebarOpen, setGamesSidebarOpen] = useState(false);
    const [cartOpen, setCartOpen] = useState(false);
    const [marketName, setMarketName] = useState('');

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
        <div className="min-h-screen bg-black">
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
                marketName={marketName}
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
                <BidComponent
                    title={title}
                    gameType={gameType}
                    betType={betType}
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

    const entry = BID_COMPONENTS[gameType];

    if (!entry) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center text-white">
                <div className="text-center">
                    <p className="text-lg font-bold text-red-400 mb-2">Unknown Game Type</p>
                    <p className="text-gray-400 text-sm mb-4">The game type "{gameType}" is not recognized.</p>
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="text-yellow-500 hover:underline text-sm"
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
