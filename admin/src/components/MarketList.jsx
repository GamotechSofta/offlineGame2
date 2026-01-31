import React from 'react';

const MarketList = ({ markets, onEdit, onDelete, apiBaseUrl, getAuthHeaders }) => {
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {markets.map((market) => {
                const status = getMarketStatus(market);

                return (
                    <div
                        key={market._id}
                        className="bg-gray-800 rounded-lg border border-gray-700 p-6 hover:border-yellow-500 transition-colors"
                    >
                        {/* Status Badge */}
                        <div className={`${status.color} text-white text-xs font-semibold px-3 py-1 rounded-full inline-block mb-4`}>
                            {status.status === 'open' && 'OPEN'}
                            {status.status === 'running' && 'CLOSED IS RUNNING'}
                            {status.status === 'closed' && 'CLOSED'}
                        </div>

                        {/* Market Info */}
                        <h3 className="text-xl font-bold text-white mb-2">{market.marketName}</h3>
                        <div className="space-y-2 mb-4 text-sm text-gray-300">
                            <p><span className="font-semibold">Opening:</span> {market.startingTime}</p>
                            <p><span className="font-semibold">Closing:</span> {market.closingTime}</p>
                            <p><span className="font-semibold">Result:</span> <span className="text-yellow-400 font-mono">{market.displayResult || '***-**-***'}</span></p>
                            {market.winNumber && (
                                <p><span className="font-semibold">Win Number:</span> <span className="text-green-400 font-mono">{market.winNumber}</span></p>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => onEdit(market)}
                                    className="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-sm font-semibold"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => handleDelete(market._id)}
                                    className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-sm font-semibold"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default MarketList;
