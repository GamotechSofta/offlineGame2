import React, { useState } from 'react';

const MarketList = ({ markets, onEdit, onDelete, apiBaseUrl, getAuthHeaders }) => {
    const [settingNumber, setSettingNumber] = useState(null);
    const [numberType, setNumberType] = useState('');
    const [numberValue, setNumberValue] = useState('');
    const [winNumber, setWinNumber] = useState('');

    const handleSetNumber = async (marketId, type) => {
        setSettingNumber(marketId);
        setNumberType(type);
        setNumberValue('');
        setWinNumber('');
    };

    const handleSubmitNumber = async (marketId) => {
        try {
            const headers = getAuthHeaders();
            let endpoint = '';
            let body = {};

            if (numberType === 'opening') {
                endpoint = `${apiBaseUrl}/markets/set-opening-number/${marketId}`;
                body = { openingNumber: numberValue };
            } else if (numberType === 'closing') {
                endpoint = `${apiBaseUrl}/markets/set-closing-number/${marketId}`;
                body = { closingNumber: numberValue };
            } else if (numberType === 'win') {
                endpoint = `${apiBaseUrl}/markets/set-win-number/${marketId}`;
                body = { winNumber: winNumber };
            }

            const response = await fetch(endpoint, {
                method: 'PATCH',
                headers,
                body: JSON.stringify(body),
            });

            const data = await response.json();
            if (data.success) {
                setSettingNumber(null);
                setNumberType('');
                setNumberValue('');
                setWinNumber('');
                onDelete(); // Refresh list
            } else {
                alert(data.message || 'Failed to set number');
            }
        } catch (err) {
            alert('Network error');
        }
    };

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

    const getMarketStatus = (market) => {
        try {
            const now = new Date();
            const currentHour = now.getHours();
            const currentMin = now.getMinutes();
            const currentTime = currentHour * 60 + currentMin; // minutes since midnight

            // Parse starting time (format: "HH:MM" or "HH:MM AM/PM")
            let startTime = parseTimeToMinutes(market.startingTime);
            let endTime = parseTimeToMinutes(market.closingTime);

            if (startTime === null || endTime === null) {
                return { status: 'unknown', color: 'bg-gray-600' };
            }

            if (currentTime < startTime) return { status: 'upcoming', color: 'bg-blue-600' };
            if (currentTime >= startTime && currentTime <= endTime) return { status: 'open', color: 'bg-green-600' };
            return { status: 'closed', color: 'bg-red-600' };
        } catch (err) {
            return { status: 'unknown', color: 'bg-gray-600' };
        }
    };

    const parseTimeToMinutes = (timeStr) => {
        if (!timeStr) return null;
        
        // Handle "HH:MM" format (24-hour)
        if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
            const [hour, min] = timeStr.split(':').map(Number);
            if (hour >= 0 && hour < 24 && min >= 0 && min < 60) {
                return hour * 60 + min;
            }
        }
        
        // Handle "HH:MM AM/PM" format (12-hour)
        const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (match) {
            let hour = parseInt(match[1]);
            const min = parseInt(match[2]);
            const period = match[3].toUpperCase();
            
            if (period === 'PM' && hour !== 12) hour += 12;
            if (period === 'AM' && hour === 12) hour = 0;
            
            if (hour >= 0 && hour < 24 && min >= 0 && min < 60) {
                return hour * 60 + min;
            }
        }
        
        return null;
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {markets.map((market) => {
                const status = getMarketStatus(market);
                const isSettingNumber = settingNumber === market._id;

                return (
                    <div
                        key={market._id}
                        className="bg-gray-800 rounded-lg border border-gray-700 p-6 hover:border-yellow-500 transition-colors"
                    >
                        {/* Status Badge */}
                        <div className={`${status.color} text-white text-xs font-semibold px-3 py-1 rounded-full inline-block mb-4`}>
                            {status.status.toUpperCase()}
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

                        {/* Number Setting Form */}
                        {isSettingNumber && (
                            <div className="mb-4 p-4 bg-gray-700 rounded-lg space-y-3">
                                {numberType === 'opening' && (
                                    <div>
                                        <label className="block text-xs text-gray-300 mb-1">Opening Number (3 digits)</label>
                                        <input
                                            type="text"
                                            value={numberValue}
                                            onChange={(e) => setNumberValue(e.target.value.replace(/\D/g, '').slice(0, 3))}
                                            className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white text-sm"
                                            placeholder="123"
                                            maxLength="3"
                                        />
                                    </div>
                                )}
                                {numberType === 'closing' && (
                                    <div>
                                        <label className="block text-xs text-gray-300 mb-1">Closing Number (3 digits)</label>
                                        <input
                                            type="text"
                                            value={numberValue}
                                            onChange={(e) => setNumberValue(e.target.value.replace(/\D/g, '').slice(0, 3))}
                                            className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white text-sm"
                                            placeholder="456"
                                            maxLength="3"
                                        />
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleSubmitNumber(market._id)}
                                        className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm font-semibold"
                                    >
                                        Set
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSettingNumber(null);
                                            setNumberType('');
                                            setNumberValue('');
                                            setWinNumber('');
                                        }}
                                        className="flex-1 px-3 py-1.5 bg-gray-600 hover:bg-gray-700 rounded text-sm"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => handleSetNumber(market._id, 'opening')}
                                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-semibold"
                                >
                                    Opening
                                </button>
                                <button
                                    onClick={() => handleSetNumber(market._id, 'closing')}
                                    className="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm font-semibold"
                                >
                                    Closing
                                </button>
                            </div>
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
