import React from 'react';
import { useNavigate } from 'react-router-dom';

const MarketList = ({ markets, onEdit, onDelete, apiBaseUrl, getAuthHeaders }) => {
    const navigate = useNavigate();
    const handleDelete = async (marketId) => {
        if (!window.confirm('Are you sure you want to delete this market?')) {
            return;
        }

        try {
            const headers = getAuthHeaders();
            const response = await fetch(`${apiBaseUrl}/markets/delete-market/${marketId}`, {
                method: 'DELETE',
                headers,
            });

            const data = await response.json();
            if (data.success) {
                onDelete();
            } else {
                alert(data.message || 'Failed to delete market');
            }
        } catch (err) {
            alert('Network error');
        }
    };

    // ***-**-*** → Open (green), 156-2*-*** → Running (green), 987-45-456 → Closed (red)
    const getMarketStatus = (market) => {
        const hasOpening = market.openingNumber && /^\d{3}$/.test(String(market.openingNumber));
        const hasClosing = market.closingNumber && /^\d{3}$/.test(String(market.closingNumber));
        if (hasOpening && hasClosing) return { status: 'closed', color: 'bg-red-600' };
        if (hasOpening && !hasClosing) return { status: 'running', color: 'bg-green-600' };
        return { status: 'open', color: 'bg-green-600' };
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
            {markets.map((market) => {
                const status = getMarketStatus(market);

                return (
                    <div
                        key={market._id}
                        className="bg-gray-800 rounded-xl border border-gray-700 p-4 sm:p-5 lg:p-6 hover:border-yellow-500/50 transition-colors min-w-0 overflow-hidden"
                    >
                        {/* Status Badge */}
                        <div className={`${status.color} text-white text-[10px] sm:text-xs font-semibold px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full inline-block mb-3 sm:mb-4`}>
                            {status.status === 'open' && 'OPEN'}
                            {status.status === 'running' && 'CLOSED IS RUNNING'}
                            {status.status === 'closed' && 'CLOSED'}
                        </div>

                        {/* Market Info */}
                        <h3 className="text-base sm:text-lg lg:text-xl font-bold text-white mb-2 truncate" title={market.marketName}>{market.marketName}</h3>
                        <div className="space-y-1.5 sm:space-y-2 mb-4 text-xs sm:text-sm text-gray-300 min-w-0">
                            <p className="truncate"><span className="font-semibold">Opening:</span> {market.startingTime}</p>
                            <p className="truncate"><span className="font-semibold">Closing:</span> {market.closingTime}</p>
                            {market.betClosureTime != null && market.betClosureTime !== '' && (
                                <p><span className="font-semibold">Bet Closure:</span> {market.betClosureTime} sec</p>
                            )}
                            {market.winNumber && (
                                <p><span className="font-semibold">Win Number:</span> <span className="text-green-400 font-mono">{market.winNumber}</span></p>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                            <button
                                onClick={() => navigate(`/markets/${market._id}`)}
                                className="px-2 sm:px-3 py-2 bg-amber-600 hover:bg-amber-500 text-black rounded-lg text-xs sm:text-sm font-semibold min-h-[40px] sm:min-h-0"
                            >
                                View
                            </button>
                            <button
                                onClick={() => onEdit(market)}
                                className="px-2 sm:px-3 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-xs sm:text-sm font-semibold min-h-[40px] sm:min-h-0"
                            >
                                Edit
                            </button>
                            <button
                                onClick={() => handleDelete(market._id)}
                                className="px-2 sm:px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-xs sm:text-sm font-semibold min-h-[40px] sm:min-h-0"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default MarketList;
