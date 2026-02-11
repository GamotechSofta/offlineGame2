import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaTimes, FaListUl } from 'react-icons/fa';

export const SIDEBAR_MIN_WIDTH = 180;
export const SIDEBAR_MAX_WIDTH = 400;
export const SIDEBAR_DEFAULT_WIDTH = 224; // 14rem = 224px (w-56)
export const SIDEBAR_STORAGE_KEY = 'bookieSidebarWidth';

export const getStoredSidebarWidth = () => {
    try {
        const val = localStorage.getItem(SIDEBAR_STORAGE_KEY);
        if (val) {
            const n = Number(val);
            if (n >= SIDEBAR_MIN_WIDTH && n <= SIDEBAR_MAX_WIDTH) return n;
        }
    } catch (e) { /* ignore */ }
    return SIDEBAR_DEFAULT_WIDTH;
};

const GAME_TYPES_LIST = [
    { id: 'single-digit', title: 'Single Digit', icon: '1', color: 'bg-blue-500' },
    { id: 'single-digit-bulk', title: 'Single Digit Bulk', icon: '1+', color: 'bg-blue-600' },
    { id: 'jodi', title: 'Jodi', icon: '12', color: 'bg-purple-500' },
    { id: 'jodi-bulk', title: 'Jodi Bulk', icon: '12+', color: 'bg-purple-600' },
    { id: 'single-pana', title: 'Single Pana', icon: '123', color: 'bg-emerald-500' },
    { id: 'single-pana-bulk', title: 'Single Pana Bulk', icon: '123+', color: 'bg-emerald-600' },
    { id: 'double-pana', title: 'Double Pana', icon: '112', color: 'bg-orange-500' },
    { id: 'double-pana-bulk', title: 'Double Pana Bulk', icon: '112+', color: 'bg-orange-600' },
    { id: 'triple-pana', title: 'Triple Pana', icon: '111', color: 'bg-pink-500' },
    { id: 'full-sangam', title: 'Full Sangam', icon: 'F/S', color: 'bg-yellow-600' },
    { id: 'half-sangam', title: 'Half Sangam (O)', icon: 'H/S', color: 'bg-cyan-500' },
];

/**
 * GamesSidebar - Shows all game types for quick navigation.
 * Visible on desktop (lg+) as a fixed sidebar with a draggable right edge.
 * On mobile, slides in as an overlay when isOpen=true.
 */
const GamesSidebar = ({
    marketId,
    playerId,
    activeGameType,
    marketName,
    isOpen = false,
    onClose,
    width,
    onWidthChange,
}) => {
    const navigate = useNavigate();
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef(null);

    const buildUrl = (gameId) => {
        const query = playerId ? `?playerId=${playerId}` : '';
        return `/games/${marketId}/${gameId}${query}`;
    };

    const handleGameClick = (gameId) => {
        navigate(buildUrl(gameId));
        onClose?.();
    };

    const handleBackToMarkets = () => {
        const query = playerId ? `?playerId=${playerId}` : '';
        navigate(`/games${query}`);
        onClose?.();
    };

    // --- Drag resize logic (right edge) ---
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
            const diff = clientX - dragRef.current.startX; // dragging right = wider
            let newWidth = dragRef.current.startWidth + diff;
            newWidth = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, newWidth));
            onWidthChange?.(newWidth);
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

    return (
        <>
            {/* Sidebar */}
            <aside
                style={{ width: `${width}px` }}
                className={`
                    fixed left-0 top-0 h-screen bg-[#111215] border-r border-white/10 z-40
                    overflow-hidden flex flex-col
                    transform transition-transform duration-200 ease-in-out
                    lg:translate-x-0
                    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                `}
            >
                {/* Drag Handle — right edge (desktop only) */}
                <div
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                    className={`
                        hidden lg:flex absolute right-0 top-0 h-full w-2 cursor-col-resize z-50
                        items-center justify-center group
                    `}
                >
                    <div className={`w-[3px] h-12 rounded-full transition-colors ${
                        isDragging ? 'bg-yellow-500' : 'bg-white/10 group-hover:bg-yellow-500/60'
                    }`} />
                </div>

                {/* Header */}
                <div className="p-3 border-b border-white/10 shrink-0">
                    <div className="flex items-center justify-between mb-2">
                        <button
                            type="button"
                            onClick={handleBackToMarkets}
                            className="flex items-center gap-1.5 text-gray-400 hover:text-yellow-500 text-xs transition-colors"
                        >
                            <FaArrowLeft className="w-3 h-3" />
                            <span>Markets</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 text-gray-400"
                            aria-label="Close"
                        >
                            <FaTimes className="w-4 h-4" />
                        </button>
                    </div>
                    {marketName && (
                        <h3 className="text-sm font-bold text-white truncate">{marketName}</h3>
                    )}
                </div>

                {/* Game Types List */}
                <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold px-3 pt-1 pb-2">
                        Game Types
                    </p>
                    {GAME_TYPES_LIST.map((game) => (
                        <button
                            key={game.id}
                            type="button"
                            onClick={() => handleGameClick(game.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                                activeGameType === game.id
                                    ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-500/10 text-yellow-400 font-semibold border border-yellow-500/30'
                                    : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
                            }`}
                        >
                            <span
                                className={`w-7 h-7 ${game.color} rounded flex items-center justify-center text-white text-[9px] font-bold shrink-0 shadow-sm`}
                            >
                                {game.icon}
                            </span>
                            <span className="truncate text-left">{game.title}</span>
                        </button>
                    ))}
                </nav>
            </aside>

            {/* Mobile backdrop */}
            {isOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/60 z-30"
                    onClick={onClose}
                    aria-hidden
                />
            )}
        </>
    );
};

/**
 * GamesSidebarToggle - Floating button to open the games sidebar on mobile.
 * Only visible on screens smaller than lg.
 */
export const GamesSidebarToggle = ({ onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="lg:hidden fixed bottom-6 left-3 z-30 w-11 h-11 bg-[#d4af37] hover:bg-[#e5c04a] text-[#4b3608] rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95"
        aria-label="Open game types"
    >
        <FaListUl className="w-4 h-4" />
    </button>
);

export default GamesSidebar;
