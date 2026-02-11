import React, { useState, useRef, useCallback, useEffect } from 'react';
import { FaShoppingCart, FaTimes, FaTrash } from 'react-icons/fa';
import { useBetCart } from './BetCartContext';
import { usePlayerBet } from './PlayerBetContext';
import BidReviewModal from './BidReviewModal';

const MIN_WIDTH = 240;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 320;
const STORAGE_KEY = 'bookieCartPanelWidth';

const getStoredWidth = () => {
    try {
        const val = localStorage.getItem(STORAGE_KEY);
        if (val) {
            const n = Number(val);
            if (n >= MIN_WIDTH && n <= MAX_WIDTH) return n;
        }
    } catch (e) { /* ignore */ }
    return DEFAULT_WIDTH;
};

const CartPanel = ({ isOpen, onClose, width, onWidthChange }) => {
    const { cartItems, cartCount, cartTotal, removeFromCart, clearCart } = useBetCart();
    const { market, placeBet, updatePlayerBalance, walletBalance, playerName, selectedPlayer } = usePlayerBet();
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef(null);

    const marketTitle = market?.gameName || market?.marketName || '';
    const dateText = new Date().toLocaleDateString('en-GB');

    // --- Drag resize logic ---
    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        setIsDragging(true);
        dragRef.current = { startX: e.clientX, startWidth: width };
    }, [width]);

    const handleTouchStart = useCallback((e) => {
        const touch = e.touches[0];
        setIsDragging(true);
        dragRef.current = { startX: touch.clientX, startWidth: width };
    }, [width]);

    useEffect(() => {
        if (!isDragging) return;

        const handleMove = (clientX) => {
            if (!dragRef.current) return;
            const diff = dragRef.current.startX - clientX; // dragging left = wider
            let newWidth = dragRef.current.startWidth + diff;
            newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));
            onWidthChange(newWidth);
        };

        const onMouseMove = (e) => handleMove(e.clientX);
        const onTouchMove = (e) => handleMove(e.touches[0].clientX);

        const onEnd = () => {
            setIsDragging(false);
            dragRef.current = null;
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onEnd);
        window.addEventListener('touchmove', onTouchMove, { passive: true });
        window.addEventListener('touchend', onEnd);

        // Prevent text selection while dragging
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onEnd);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onEnd);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };
    }, [isDragging, onWidthChange]);

    // Group cart items by game type label for display
    const groupedItems = {};
    cartItems.forEach((item) => {
        const key = item.gameTypeLabel;
        if (!groupedItems[key]) groupedItems[key] = [];
        groupedItems[key].push(item);
    });

    // Convert cart items to review modal format
    const reviewRows = cartItems.map((item) => ({
        id: item.id,
        number: item.number,
        points: String(item.points),
        type: item.session,
        gameTypeLabel: item.gameTypeLabel,
    }));

    const handlePlaceBet = async () => {
        const marketId = market?._id || market?.id;
        if (!marketId) throw new Error('Market not found');
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

        const result = await placeBet(marketId, payload, scheduledDate);
        if (!result.success) throw new Error(result.message || 'Failed to place bets');
        if (result.data?.newBalance != null) updatePlayerBalance(result.data.newBalance);
        clearCart();
    };

    const handleCloseReview = () => {
        setIsReviewOpen(false);
    };

    return (
        <>
            {/* Right Sidebar Cart — always visible on xl+, slide-in overlay on smaller screens */}
            <aside
                style={{ width: `${width}px` }}
                className={`
                    fixed top-0 right-0 h-screen bg-white border-l border-gray-200 z-40
                    overflow-hidden flex flex-col
                    transform transition-transform duration-200 ease-in-out
                    xl:translate-x-0
                    ${isOpen ? 'translate-x-0' : 'translate-x-full'}
                `}
            >
                {/* Drag Handle — left edge (desktop only) */}
                <div
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                    className={`
                        hidden xl:flex absolute left-0 top-0 h-full w-2 cursor-col-resize z-50
                        items-center justify-center group
                    `}
                >
                    {/* Visual indicator line */}
                    <div className={`w-[3px] h-12 rounded-full transition-colors ${
                        isDragging ? 'bg-orange-500' : 'bg-gray-200 group-hover:bg-orange-400'
                    }`} />
                </div>

                {/* Cart Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0 bg-white">
                    <div className="flex items-center gap-2">
                        <FaShoppingCart className="w-4 h-4 text-orange-500" />
                        <h3 className="text-gray-800 font-bold text-sm">
                            Bet Cart ({cartCount})
                        </h3>
                    </div>
                    <div className="flex items-center gap-2">
                        {cartCount > 0 && (
                            <button
                                type="button"
                                onClick={clearCart}
                                className="text-xs text-red-500 hover:text-red-300 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                            >
                                Clear All
                            </button>
                        )}
                        {/* Close button — only on mobile/tablet */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="xl:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
                            aria-label="Close cart"
                        >
                            <FaTimes className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Summary Stats */}
                {cartCount > 0 && (
                    <div className="px-4 py-2.5 border-b border-gray-200 bg-gray-50 shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="text-xs text-gray-400">
                                Total Bets: <span className="text-gray-800 font-bold">{cartCount}</span>
                            </div>
                            <div className="text-xs text-gray-400">
                                Total: <span className="text-orange-500 font-bold">₹{cartTotal.toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Cart Items — scrollable */}
                <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
                    {cartCount === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <FaShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-20" />
                            <p className="text-sm font-medium">Your cart is empty</p>
                            <p className="text-xs mt-1 text-gray-600">Add bets from game types on the left</p>
                        </div>
                    ) : (
                        Object.entries(groupedItems).map(([label, items]) => (
                            <div key={label} className="bg-gray-100 rounded-xl border border-gray-200 overflow-hidden">
                                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                                    <div>
                                        <span className="text-orange-500 font-semibold text-[10px] uppercase tracking-wide">
                                            {label}
                                        </span>
                                        <span className="text-gray-500 text-[10px] ml-1.5">
                                            ({items.length})
                                        </span>
                                    </div>
                                    <span className="text-orange-500 text-[10px] font-bold">
                                        ₹{items.reduce((s, i) => s + i.points, 0).toLocaleString('en-IN')}
                                    </span>
                                </div>
                                <div className="divide-y divide-gray-100">
                                    {items.map((item) => (
                                        <div key={item.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                                            <span className="text-gray-800 font-bold min-w-[40px]">{item.number}</span>
                                            <span className="text-orange-500 font-bold">₹{item.points}</span>
                                            <span className="text-gray-500 uppercase text-[10px]">{item.session}</span>
                                            <button
                                                type="button"
                                                onClick={() => removeFromCart(item.id)}
                                                className="ml-auto p-1 text-red-500/60 hover:text-red-300 hover:bg-red-50 rounded transition-colors"
                                            >
                                                <FaTrash className="w-2.5 h-2.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Cart Footer — Place Bet button */}
                {cartCount > 0 && (
                    <div className="px-3 py-3 border-t border-gray-200 bg-white shrink-0 space-y-2">
                        <div className="flex items-center justify-between text-xs px-1">
                            <span className="text-gray-400">
                                Wallet: <span className="text-gray-800 font-bold">₹{Number(walletBalance || 0).toLocaleString('en-IN')}</span>
                            </span>
                            <span className={`font-bold ${(walletBalance - cartTotal) < 0 ? 'text-red-500' : 'text-green-600'}`}>
                                After: ₹{(walletBalance - cartTotal).toLocaleString('en-IN')}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsReviewOpen(true)}
                            disabled={!selectedPlayer}
                            className={`w-full font-bold py-3 rounded-xl shadow-lg transition-all text-sm ${
                                selectedPlayer
                                    ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 active:scale-[0.98]'
                                    : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white opacity-50 cursor-not-allowed'
                            }`}
                        >
                            Place All Bets
                        </button>
                        {!selectedPlayer && (
                            <p className="text-[10px] text-orange-500 text-center">Select a player first</p>
                        )}
                    </div>
                )}
            </aside>

            {/* Mobile backdrop */}
            {isOpen && (
                <div
                    className="xl:hidden fixed inset-0 bg-black/30 z-30"
                    onClick={onClose}
                    aria-hidden
                />
            )}

            {/* Review Modal */}
            <BidReviewModal
                open={isReviewOpen}
                onClose={handleCloseReview}
                onSubmit={handlePlaceBet}
                marketTitle={marketTitle}
                dateText={dateText}
                labelKey="Number"
                rows={reviewRows}
                walletBefore={walletBalance}
                totalBids={cartCount}
                totalAmount={cartTotal}
                playerName={playerName}
                showGameType
            />
        </>
    );
};

/**
 * CartToggleButton - Floating button to open the cart on mobile/tablet.
 * Shows cart count badge. Only visible on screens smaller than xl.
 */
export const CartToggleButton = ({ onClick, cartCount = 0 }) => (
    <button
        type="button"
        onClick={onClick}
        className="xl:hidden fixed bottom-6 right-4 z-30 w-14 h-14 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-full shadow-lg shadow-orange-500/30 flex items-center justify-center transition-all active:scale-95"
        aria-label="Open cart"
    >
        <FaShoppingCart className="w-5 h-5" />
        {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 shadow-md">
                {cartCount > 99 ? '99+' : cartCount}
            </span>
        )}
    </button>
);

export { getStoredWidth, MIN_WIDTH, MAX_WIDTH, DEFAULT_WIDTH, STORAGE_KEY };
export default CartPanel;
