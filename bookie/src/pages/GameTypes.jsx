import React, { useState, useEffect } from 'react';
import { API_BASE_URL, getMarketDisplayName } from '../utils/api';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

const GAME_OPTIONS = [
    {
        id: 'single-digit',
        title: 'Single Digit',
        icon: (
            <img
                src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769756244/Untitled_90_x_160_px_1080_x_1080_px_1_yinraf.svg"
                alt="Single Digit"
                className="w-full h-full object-contain"
            />
        ),
    },
    {
        id: 'jodi',
        title: 'Jodi Bulk',
        icon: (
            <img
                src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769714108/Untitled_1080_x_1080_px_1080_x_1080_px_7_rpzykt.svg"
                alt="Jodi Bulk"
                className="w-full h-full object-contain"
            />
        ),
    },
    {
        id: 'single-pana-bulk',
        title: 'Single Pana Bulk',
        icon: (
            <img
                src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769714254/Untitled_1080_x_1080_px_1080_x_1080_px_8_jdbxyd.svg"
                alt="Single Pana Bulk"
                className="w-full h-full object-contain"
            />
        ),
    },
    {
        id: 'double-pana-bulk',
        title: 'Double Pana Bulk',
        icon: (
            <img
                src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769713943/Untitled_1080_x_1080_px_1080_x_1080_px_6_uccv7o.svg"
                alt="Double Pana Bulk"
                className="w-full h-full object-contain"
            />
        ),
    },
    {
        id: 'triple-pana',
        title: 'Triple Pana',
        icon: (
            <img
                src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769714392/Untitled_1080_x_1080_px_1080_x_1080_px_9_ugcdef.svg"
                alt="Triple Pana"
                className="w-full h-full object-contain"
            />
        ),
    },
    {
        id: 'full-sangam',
        title: 'Full Sangam',
        icon: (
            <img
                src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1770033671/Untitled_design_2_kr1imj.svg"
                alt="Full Sangam"
                className="w-full h-full object-contain"
            />
        ),
    },
    {
        id: 'half-sangam',
        title: 'Half Sangam (O)',
        icon: (
            <img
                src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1770033165/Untitled_design_c5hag8.svg"
                alt="Half Sangam (O)"
                className="w-full h-full object-contain"
            />
        ),
    },
];

const GameTypes = () => {
    const navigate = useNavigate();
    const { marketId } = useParams();
    const [searchParams] = useSearchParams();
    const { language } = useLanguage();
    const playerId = searchParams.get('playerId') || '';
    const [market, setMarket] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMarket = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/markets/get-markets`);
                const data = await res.json();
                if (data.success && Array.isArray(data.data)) {
                    const found = data.data.find((m) => m._id === marketId);
                    if (found) {
                        const hasOpening = found.openingNumber && /^\d{3}$/.test(String(found.openingNumber));
                        const hasClosing = found.closingNumber && /^\d{3}$/.test(String(found.closingNumber));
                        found.status = hasOpening && hasClosing ? 'closed' : hasOpening ? 'running' : 'open';
                    }
                    setMarket(found || null);
                }
            } catch (err) {
                // silent
            } finally {
                setLoading(false);
            }
        };
        fetchMarket();
    }, [marketId]);

    const handleGameClick = (game) => {
        const query = playerId ? `?playerId=${playerId}` : '';
        navigate(`/games/${marketId}/${game.id}${query}`);
    };

    // When market is "CLOSED IS RUNNING", hide options that require OPEN session
    const isRunning = market?.status === 'running';
    const visibleOptions = isRunning
        ? GAME_OPTIONS.filter((opt) => {
              const t = (opt.title || '').toLowerCase().trim();
              const hideWhenRunning = new Set([
                  'jodi', 'jodi bulk', 'full sangam', 'half sangam (o)',
              ]);
              return !hideWhenRunning.has(t);
          })
        : GAME_OPTIONS;

    return (
        <div className="min-h-screen bg-white">
            {/* Main content */}
            <div>
                <div className="min-h-screen bg-white flex flex-col items-center">
                    {/* Header */}
                    <div className="w-full flex items-center px-3 sm:px-4 pt-4 sm:pt-5 pb-3 sm:pb-4 bg-white border-b border-gray-200 relative">
                        <button
                            onClick={() => {
                                const query = playerId ? `?playerId=${playerId}` : '';
                                navigate(`/games${query}`);
                            }}
                            className="absolute left-3 sm:left-4 flex items-center justify-center min-w-[44px] min-h-[44px] -ml-1 text-gray-400 hover:text-gray-800 active:scale-95 touch-manipulation"
                            aria-label="Back"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </button>
                        <div className="w-full text-center pr-12 pl-12 min-w-0">
                            {loading ? (
                                <h1 className="text-gray-800 font-bold text-base sm:text-lg tracking-wider uppercase">Loading...</h1>
                            ) : market ? (
                                <>
                                    <h1 className="text-gray-800 font-bold text-base sm:text-lg tracking-wider uppercase inline-block border-b-2 border-orange-500 pb-1 px-2 py-1 truncate max-w-full">
                                        {market ? getMarketDisplayName(market, language) : 'SELECT GAME'}
                                    </h1>
                                    <div className="mt-1 flex items-center justify-center gap-3 text-xs text-gray-400">
                                        <span>{market.startingTime} - {market.closingTime}</span>
                                        <span className="text-orange-500 font-mono font-bold">{market.displayResult || '***-**-***'}</span>
                                    </div>
                                </>
                            ) : (
                                <h1 className="text-gray-800 font-bold text-base sm:text-lg tracking-wider uppercase">Market Not Found</h1>
                            )}
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                        </div>
                    ) : !market ? (
                        <div className="text-center py-12">
                            <p className="text-gray-400 text-lg">Market not found</p>
                            <button
                                type="button"
                                onClick={() => navigate('/games')}
                                className="mt-3 text-orange-500 hover:underline text-sm"
                            >
                                Go back to markets
                            </button>
                        </div>
                    ) : (
                        /* Grid Content - matching frontend BidOptions style */
                        <div className="w-full max-w-md lg:max-w-none px-3 sm:px-4 pt-3 sm:pt-4 pb-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                            {visibleOptions.map((option) => (
                                <div
                                    key={option.id}
                                    onClick={() => handleGameClick(option)}
                                    className="relative rounded-2xl bg-white border-2 border-gray-100 p-3.5 sm:p-4 flex flex-col items-center justify-center gap-2 sm:gap-2.5 hover:border-orange-400 hover:shadow-lg hover:shadow-orange-500/15 active:scale-[0.97] transition-all cursor-pointer group touch-manipulation min-h-[104px] sm:min-h-[120px] md:min-h-[132px] shadow-sm"
                                >
                                    {/* Icon Container */}
                                    <div className="flex items-center justify-center w-[72px] h-[72px] sm:w-[84px] sm:h-[84px] md:w-[96px] md:h-[96px] group-hover:scale-[1.05] transition-transform duration-300">
                                        {option.icon}
                                    </div>

                                    {/* Title */}
                                    <span className="text-gray-700 group-hover:text-orange-600 text-[10px] sm:text-[11px] md:text-sm font-bold tracking-[0.12em] sm:tracking-[0.15em] uppercase text-center line-clamp-2 leading-tight transition-colors">
                                        {option.title}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GameTypes;
