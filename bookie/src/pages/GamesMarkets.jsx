import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { API_BASE_URL } from '../utils/api';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useRefreshOnMarketReset } from '../hooks/useRefreshOnMarketReset';
import { FaDice, FaClock, FaChevronRight, FaCheckCircle, FaTimesCircle, FaHourglassHalf } from 'react-icons/fa';
import { isMarketOpen, isPastClosingTime, isBeforeOpeningTime, getTimeUntilOpen, getTimeUntilClose, formatTimeRemaining } from '../utils/marketTiming';

const GamesMarkets = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const playerId = searchParams.get('playerId') || '';

    const [markets, setMarkets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());

    const fetchMarkets = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/markets/get-markets`);
            const data = await response.json();
            if (data.success) setMarkets(data.data || []);
            else setError('Failed to fetch markets');
        } catch (err) {
            setError('Network error. Please check if the server is running.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMarkets();
    }, []);

    // Update current time every second for real-time updates
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000); // Update every second for better UX
        return () => clearInterval(interval);
    }, []);

    useRefreshOnMarketReset(fetchMarkets);

    const getMarketStatus = (market) => {
        const hasOpening = market.openingNumber && /^\d{3}$/.test(String(market.openingNumber));
        const hasClosing = market.closingNumber && /^\d{3}$/.test(String(market.closingNumber));
        
        // If both results are declared, market is closed
        if (hasOpening && hasClosing) {
            return { 
                status: 'closed', 
                label: 'CLOSED', 
                color: 'bg-red-500', 
                textColor: 'text-red-500', 
                borderColor: 'border-red-500/30',
                icon: FaTimesCircle,
                reason: 'Results declared'
            };
        }
        
        // Check if market is past closing time
        if (isPastClosingTime(market, currentTime)) {
            return { 
                status: 'closed', 
                label: 'CLOSED', 
                color: 'bg-red-500', 
                textColor: 'text-red-500', 
                borderColor: 'border-red-500/30',
                icon: FaTimesCircle,
                reason: 'Market closed'
            };
        }
        
        // Market is open (from 12 AM until closing time)
        return { 
            status: 'open', 
            label: 'OPEN', 
            color: 'bg-green-500', 
            textColor: 'text-green-600', 
            borderColor: 'border-green-200',
            icon: FaCheckCircle,
            reason: 'Betting open'
        };
    };

    // Show all markets - closed markets will show CLOSED status
    const availableMarkets = markets;

    const handleMarketClick = (marketId) => {
        const query = playerId ? `?playerId=${playerId}` : '';
        navigate(`/games/${marketId}${query}`);
    };

    return (
        <Layout title="Games">
            <div className="min-w-0 max-w-full">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
                        <FaDice className="text-orange-500" />
                        Games
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">Select a market to place bets for your players</p>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600">{error}</div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                    </div>
                ) : (
                    <>
                        {/* Markets List */}
                        {availableMarkets.length === 0 ? (
                            <div className="text-center py-12">
                                <FaClock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                                <p className="text-gray-400 text-lg">No markets available right now</p>
                                <p className="text-gray-500 text-sm mt-1">Markets will appear here when they are created</p>
                            </div>
                        ) : (
                            <>
                                <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                                    Markets ({availableMarkets.length})
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {availableMarkets.map((market) => {
                                        const statusInfo = getMarketStatus(market);
                                        const { label, color, textColor, borderColor, status, icon: StatusIcon, reason } = statusInfo;
                                        const isClosed = status === 'closed';
                                        const isUpcoming = status === 'upcoming';
                                        const isClickable = !isClosed; // Only open/running/upcoming markets are clickable
                                        
                                        // Get time information
                                        const timeUntilOpen = getTimeUntilOpen(market, currentTime);
                                        const timeUntilClose = getTimeUntilClose(market, currentTime);
                                        
                                        return (
                                            <button
                                                key={market._id}
                                                type="button"
                                                onClick={() => isClickable && handleMarketClick(market._id)}
                                                disabled={!isClickable}
                                                className={`group text-left bg-white rounded-xl border-2 ${borderColor} p-5 transition-all duration-200 ${
                                                    !isClickable
                                                        ? 'opacity-60 cursor-not-allowed' 
                                                        : 'hover:bg-gradient-to-br hover:from-orange-50 hover:to-white hover:border-orange-400 hover:-translate-y-1 hover:shadow-xl hover:shadow-orange-500/20 cursor-pointer'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                        {StatusIcon && <StatusIcon className={`w-4 h-4 ${textColor}`} />}
                                                        <span className={`${color} text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm`}>
                                                            {label}
                                                        </span>
                                                    </div>
                                                    <FaChevronRight className={`w-4 h-4 transition-colors ${
                                                        isClosed || isUpcoming ? 'text-gray-400' : 'text-gray-600 group-hover:text-orange-500'
                                                    }`} />
                                                </div>
                                                
                                                <h3 className={`text-lg font-bold mb-3 transition-colors ${
                                                    isClosed || isUpcoming ? 'text-gray-600' : 'text-gray-800 group-hover:text-orange-600'
                                                }`}>
                                                    {market.marketName}
                                                </h3>
                                                
                                                <div className="space-y-2 text-sm mb-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-gray-500 font-medium">Opening Time</span>
                                                        <span className={`font-semibold ${isClosed || isUpcoming ? 'text-gray-600' : 'text-gray-800'}`}>
                                                            {market.startingTime || 'N/A'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-gray-500 font-medium">Closing Time</span>
                                                        <span className={`font-semibold ${isClosed || isUpcoming ? 'text-gray-600' : 'text-gray-800'}`}>
                                                            {market.closingTime || 'N/A'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-gray-500 font-medium">Result</span>
                                                        <span className={`font-mono font-bold ${isClosed ? 'text-orange-500/70' : 'text-orange-500'}`}>
                                                            {market.displayResult || '***-**-***'}
                                                        </span>
                                                    </div>
                                                    
                                                    {/* Time remaining indicator */}
                                                    {timeUntilClose && (
                                                        <div className="mt-2 pt-2 border-t border-gray-200">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-gray-500 text-xs">Time Remaining</span>
                                                                <span className="text-green-600 font-bold text-xs">
                                                                    {formatTimeRemaining(timeUntilClose)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    {timeUntilOpen && (
                                                        <div className="mt-2 pt-2 border-t border-gray-200">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-gray-500 text-xs">Opens In</span>
                                                                <span className="text-blue-600 font-bold text-xs">
                                                                    {formatTimeRemaining(timeUntilOpen)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                <div className="mt-3 pt-3 border-t border-gray-200">
                                                    <span className={`text-xs font-semibold ${
                                                        !isClickable ? 'text-gray-400' : isUpcoming ? 'text-blue-500' : 'text-orange-500'
                                                    } ${isClickable ? 'group-hover:text-orange-500' : ''}`}>
                                                        {isClosed ? 'Market is closed' : isUpcoming ? 'Market opens soon →' : 'Click to place bets →'}
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>
        </Layout>
    );
};

export default GamesMarkets;
