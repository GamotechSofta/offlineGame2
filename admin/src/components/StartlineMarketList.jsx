import React from 'react';
import { useNavigate } from 'react-router-dom';

const formatTime = (time24) => {
    if (!time24) return '-';
    const [hours, minutes] = String(time24).trim().split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes || '00'} ${ampm}`;
};

const sumDigits = (s) => [...String(s)].reduce((acc, c) => acc + (Number(c) || 0), 0);
const openDigit = (open3) => (open3 && /^\d{3}$/.test(String(open3)) ? String(sumDigits(open3) % 10) : '*');

const StartlineMarketList = ({ markets, onEdit, apiBaseUrl, getAuthHeaders }) => {
    const navigate = useNavigate();

    const getMarketStatus = (market) => {
        const isStartline = market.marketType === 'startline';
        const hasOpening = market.openingNumber && /^\d{3}$/.test(String(market.openingNumber));
        const hasClosing = market.closingNumber && /^\d{3}$/.test(String(market.closingNumber));
        if (isStartline && hasOpening) return { status: 'closed', label: 'Closed', color: 'bg-red-600' };
        if (hasOpening && hasClosing) return { status: 'closed', label: 'Closed', color: 'bg-red-600' };
        if (hasOpening && !hasClosing) return { status: 'running', label: 'Running', color: 'bg-green-600' };
        return { status: 'open', label: 'Open', color: 'bg-green-600' };
    };

    return (
        <div className="space-y-3">
            {markets.map((market) => {
                const status = getMarketStatus(market);
                const open3 = market.openingNumber && /^\d{3}$/.test(String(market.openingNumber))
                    ? String(market.openingNumber)
                    : '***';
                const d = openDigit(market.openingNumber);
                const pill = `${open3} - ${d}`;

                return (
                    <div
                        key={market._id}
                        className="rounded-xl border-2 border-amber-500/40 bg-gray-800/90 p-4 sm:p-5 grid grid-cols-[100px_1fr_auto] sm:grid-cols-[120px_1fr_auto] items-center gap-3"
                    >
                        <div className="min-w-0">
                            <div className="text-xs font-semibold text-amber-400/90 uppercase tracking-wide">Time</div>
                            <div className="text-base sm:text-lg font-bold text-white leading-tight">{formatTime(market.startingTime)}</div>
                            <div className={`text-xs font-semibold ${status.status === 'closed' ? 'text-red-400' : 'text-green-400'}`}>
                                {status.label}
                            </div>
                        </div>

                        <div className="flex flex-col items-center justify-center min-w-0">
                            <div className="text-xs text-gray-400 mb-1 truncate w-full text-center" title={market.marketName}>{market.marketName}</div>
                            <div className="px-4 py-2 rounded-full bg-black border border-amber-500/30 text-amber-400 font-bold text-sm font-mono">
                                {pill}
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 justify-end">
                            <button
                                onClick={() => navigate(`/markets/${market._id}`)}
                                className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-black rounded-lg text-xs font-semibold"
                            >
                                View
                            </button>
                            <button
                                onClick={() => onEdit(market)}
                                className="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-black rounded-lg text-xs font-semibold"
                            >
                                Edit (closing time only)
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default StartlineMarketList;
