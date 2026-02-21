import React, { useState, useEffect } from 'react';

// Parse "HH:MM" or "H:MM" (24h) to { hour12, minute, ampm }
const from24Hour = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return { hour12: '12', minute: '00', ampm: 'AM' };
    const parts = timeStr.trim().split(':');
    const h24 = parseInt(parts[0], 10) || 0;
    const minute = parts[1] ? String(parseInt(parts[1], 10) || 0).padStart(2, '0') : '00';
    const hour12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
    const ampm = h24 < 12 ? 'AM' : 'PM';
    return { hour12: String(hour12), minute: minute.slice(-2), ampm };
};

// For startline: parse "10:00 PM" / "10:00 AM" from market name
const parseTimeFromStartlineName = (marketName) => {
    if (!marketName || typeof marketName !== 'string') return null;
    const match = marketName.trim().match(/\b(\d{1,2}):(\d{2})\s*(AM|PM)\s*$/i);
    if (!match) return null;
    const hour12 = String(parseInt(match[1], 10) || 12);
    const minute = String(parseInt(match[2], 10) || 0).padStart(2, '0').slice(0, 2);
    const ampm = (match[3] || 'AM').toUpperCase();
    return { hour12, minute, ampm };
};

// Build 24h "HH:MM" from 12h selection
const to24Hour = (hour12, minute, ampm) => {
    let h = parseInt(hour12, 10) || 12;
    const m = String(parseInt(minute, 10) || 0).padStart(2, '0').slice(0, 2);
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}`;
};

const HOURS_12 = ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

const MarketForm = ({ market, defaultMarketType = 'main', onClose, onSuccess, apiBaseUrl, getAuthHeaders }) => {
    const [formData, setFormData] = useState({
        marketName: '',
        marketNameHi: '',
        startingTime: '00:00',
        closingTime: '12:00',
        betClosureTime: '',
        marketType: defaultMarketType,
    });
    const [start12, setStart12] = useState({ hour12: '12', minute: '00', ampm: 'AM' });
    const [close12, setClose12] = useState({ hour12: '12', minute: '00', ampm: 'PM' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (market) {
            const isStartline = market.marketType === 'startline';
            const closeFromName = isStartline ? parseTimeFromStartlineName(market.marketName) : null;
            const close12Initial = closeFromName || from24Hour(market.closingTime);
            const closing24 = closeFromName
                ? to24Hour(closeFromName.hour12, closeFromName.minute, closeFromName.ampm)
                : (market.closingTime || '');

            setFormData((prev) => ({
                ...prev,
                marketName: market.marketName || '',
                marketNameHi: market.marketNameHi || '',
                startingTime: market.startingTime || '',
                closingTime: closing24 || market.closingTime || '',
                betClosureTime: market.betClosureTime ?? '',
                marketType: isStartline ? 'startline' : 'main',
            }));
            setStart12(from24Hour(market.startingTime));
            setClose12(close12Initial);
        } else {
            setFormData((prev) => ({ ...prev, marketType: defaultMarketType }));
        }
    }, [market, defaultMarketType]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleStart12Change = (field, value) => {
        const next = { ...start12, [field]: value };
        setStart12(next);
        setFormData((prev) => ({ ...prev, startingTime: to24Hour(next.hour12, next.minute, next.ampm) }));
    };
    const handleClose12Change = (field, value) => {
        const next = { ...close12, [field]: value };
        setClose12(next);
        const newClosing = to24Hour(next.hour12, next.minute, next.ampm);
        setFormData((prev) => {
            const updated = { ...prev, closingTime: newClosing };
            if (prev.marketType === 'startline' && !market) updated.startingTime = newClosing;
            return updated;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const headers = getAuthHeaders();
            const url = market
                ? `${apiBaseUrl}/markets/update-market/${market._id}`
                : `${apiBaseUrl}/markets/create-market`;

            const isStartlineEdit = market && market.marketType === 'startline';
            const startlineClosingTime = (formData.closingTime && String(formData.closingTime).trim()) || (market && market.closingTime) || '12:00';
            const payload = isStartlineEdit
                ? {
                    closingTime: startlineClosingTime,
                    betClosureTime: formData.betClosureTime !== '' && formData.betClosureTime != null ? Number(formData.betClosureTime) : null,
                }
                : {
                    ...formData,
                    betClosureTime: formData.betClosureTime ? Number(formData.betClosureTime) : null,
                    marketType: formData.marketType === 'startline' ? 'startline' : 'main',
                };

            const response = await fetch(url, {
                method: market ? 'PATCH' : 'POST',
                headers,
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (data.success) {
                onSuccess();
            } else {
                setError(data.message || 'Operation failed');
            }
        } catch (err) {
            setError('Network error. Please check if the server is running.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 z-50 overflow-y-auto min-h-screen">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 sm:my-auto max-h-[90vh] sm:max-h-[calc(100vh-2rem)] overflow-y-auto flex flex-col">
                <div className="p-4 sm:p-6 flex-1 min-h-0 overflow-y-auto">
                    <div className="flex justify-between items-center mb-4 sm:mb-6">
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
                            {market ? 'Edit Market' : 'Create New Market'}
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 text-2xl"
                        >
                            ×
                        </button>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Startline edit: fixed market */}
                        {market && market.marketType === 'startline' ? (
                            <>
                                <div className="rounded-lg bg-orange-50 border border-orange-200 px-3 py-2 text-sm text-orange-700">
                                    Fixed Startline market – only <strong>Closing Time</strong> and result (Declare Result page) can be changed.
                                </div>
                                <div>
                                    <label className="block text-gray-500 text-sm font-medium mb-1">Market Name (fixed)</label>
                                    <p className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 font-medium">
                                        {formData.marketName}
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                <div>
                                    <label className="block text-gray-600 text-sm font-medium mb-2">
                                        Market Type
                                    </label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="marketType"
                                                value="main"
                                                checked={formData.marketType === 'main'}
                                                onChange={() => setFormData((p) => ({ ...p, marketType: 'main' }))}
                                                className="text-orange-500 focus:ring-orange-500"
                                            />
                                            <span className="text-gray-700">Main / Daily Market</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="marketType"
                                                value="startline"
                                                checked={formData.marketType === 'startline'}
                                                onChange={() => setFormData((p) => ({ ...p, marketType: 'startline' }))}
                                                className="text-orange-500 focus:ring-orange-500"
                                            />
                                            <span className="text-gray-700">Startline</span>
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-gray-600 text-sm font-medium mb-2">
                                        Market Name
                                    </label>
                                    <input
                                        type="text"
                                        name="marketName"
                                        value={formData.marketName}
                                        onChange={handleChange}
                                        className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 text-base"
                                        placeholder="e.g., Rudraksh Morning"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-600 text-sm font-medium mb-2">
                                        Market Name (Hindi)
                                    </label>
                                    <input
                                        type="text"
                                        name="marketNameHi"
                                        value={formData.marketNameHi}
                                        onChange={handleChange}
                                        className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 text-base"
                                        placeholder="e.g., नाइट मार्केट"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Optional. Shown when bookie language is Hindi.</p>
                                </div>
                            </>
                        )}

                        {formData.marketType !== 'startline' && (
                            <div>
                                <label className="block text-gray-600 text-sm font-medium mb-2">
                                    Starting Time
                                </label>
                                <div className="grid grid-cols-[1fr_auto_1fr_auto_auto] gap-1 sm:gap-2 items-center">
                                    <select
                                        value={start12.hour12}
                                        onChange={(e) => handleStart12Change('hour12', e.target.value)}
                                        className="w-full min-w-0 px-2 sm:px-3 py-2.5 sm:py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500 text-sm sm:text-base"
                                    >
                                        {HOURS_12.map((h) => (
                                            <option key={h} value={h}>{h}</option>
                                        ))}
                                    </select>
                                    <span className="text-gray-400 text-sm sm:text-base">:</span>
                                    <select
                                        value={start12.minute}
                                        onChange={(e) => handleStart12Change('minute', e.target.value)}
                                        className="w-full min-w-0 px-2 sm:px-3 py-2.5 sm:py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500 text-sm sm:text-base"
                                    >
                                        {MINUTES.map((m) => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                    <span className="w-1" />
                                    <select
                                        value={start12.ampm}
                                        onChange={(e) => handleStart12Change('ampm', e.target.value)}
                                        className="w-full min-w-[4rem] px-2 sm:px-3 py-2.5 sm:py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500 text-sm sm:text-base"
                                    >
                                        <option value="AM">AM</option>
                                        <option value="PM">PM</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {formData.marketType === 'startline' && (
                            <p className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                                Startline has no opening time. Only <strong>Closing Time</strong> (bet cutoff) can be updated below.
                            </p>
                        )}

                        <div>
                            <label className="block text-gray-600 text-sm font-medium mb-2">
                                Closing Time {formData.marketType === 'startline' && <span className="text-orange-500">(bet cutoff)</span>}
                            </label>
                            <div className="grid grid-cols-[1fr_auto_1fr_auto_auto] gap-1 sm:gap-2 items-center">
                                <select
                                    value={close12.hour12}
                                    onChange={(e) => handleClose12Change('hour12', e.target.value)}
                                    className="w-full min-w-0 px-2 sm:px-3 py-2.5 sm:py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500 text-sm sm:text-base"
                                >
                                    {HOURS_12.map((h) => (
                                        <option key={h} value={h}>{h}</option>
                                    ))}
                                </select>
                                <span className="text-gray-400 text-sm sm:text-base">:</span>
                                <select
                                    value={close12.minute}
                                    onChange={(e) => handleClose12Change('minute', e.target.value)}
                                    className="w-full min-w-0 px-2 sm:px-3 py-2.5 sm:py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500 text-sm sm:text-base"
                                >
                                    {MINUTES.map((m) => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                                <span className="w-1" />
                                <select
                                    value={close12.ampm}
                                    onChange={(e) => handleClose12Change('ampm', e.target.value)}
                                    className="w-full min-w-[4rem] px-2 sm:px-3 py-2.5 sm:py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-orange-500 text-sm sm:text-base"
                                >
                                    <option value="AM">AM</option>
                                    <option value="PM">PM</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-gray-600 text-sm font-medium mb-2">
                                Bet Closure Time
                            </label>
                            <div className="flex flex-wrap gap-0 rounded-lg overflow-hidden border border-gray-300">
                                <input
                                    type="number"
                                    name="betClosureTime"
                                    value={formData.betClosureTime}
                                    onChange={handleChange}
                                    min="0"
                                    step="1"
                                    placeholder="e.g. 300"
                                    inputMode="numeric"
                                    className="flex-1 min-w-[80px] sm:min-w-[100px] px-3 sm:px-4 py-2.5 sm:py-2.5 bg-gray-50 text-gray-800 placeholder-gray-400 text-sm sm:text-base border-0 focus:ring-2 focus:ring-orange-500 focus:ring-inset"
                                />
                                <span className="inline-flex items-center justify-center px-3 sm:px-4 py-2.5 sm:py-2.5 bg-gray-100 text-gray-500 text-xs sm:text-sm font-medium whitespace-nowrap">
                                    Seconds
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-4 pb-4 sm:pb-0">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 w-full sm:w-auto bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 sm:py-2 px-4 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 sm:py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                            >
                                {loading ? 'Saving...' : market ? 'Update' : 'Create'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default MarketForm;
