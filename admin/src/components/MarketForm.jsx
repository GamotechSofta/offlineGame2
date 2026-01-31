import React, { useState, useEffect } from 'react';

const MarketForm = ({ market, onClose, onSuccess, apiBaseUrl, getAuthHeaders }) => {
    const [formData, setFormData] = useState({
        marketName: '',
        startingTime: '',
        closingTime: '',
        betClosureTime: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (market) {
            setFormData({
                marketName: market.marketName || '',
                startingTime: market.startingTime || '',
                closingTime: market.closingTime || '',
                betClosureTime: market.betClosureTime ?? '',
            });
        }
    }, [market]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
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

            const payload = {
                ...formData,
                betClosureTime: formData.betClosureTime ? Number(formData.betClosureTime) : null,
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto min-h-screen">
            <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-md border border-gray-700 my-auto max-h-[calc(100vh-1.5rem)] overflow-y-auto">
                <div className="p-4 sm:p-6">
                    <div className="flex justify-between items-center mb-4 sm:mb-6">
                        <h2 className="text-xl sm:text-2xl font-bold text-white">
                            {market ? 'Edit Market' : 'Create New Market'}
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white text-2xl"
                        >
                            ×
                        </button>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-gray-300 text-sm font-medium mb-2">
                                Market Name
                            </label>
                            <input
                                type="text"
                                name="marketName"
                                value={formData.marketName}
                                onChange={handleChange}
                                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 text-base"
                                placeholder="e.g., Rudraksh Morning"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-gray-300 text-sm font-medium mb-2">
                                Starting Time (HH:MM format)
                            </label>
                            <input
                                type="time"
                                name="startingTime"
                                value={formData.startingTime}
                                onChange={handleChange}
                                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 text-base"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-gray-300 text-sm font-medium mb-2">
                                Closing Time (HH:MM format)
                            </label>
                            <input
                                type="time"
                                name="closingTime"
                                value={formData.closingTime}
                                onChange={handleChange}
                                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 text-base"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-gray-300 text-sm font-medium mb-2">
                                Bet Closure Time
                            </label>
                            <div className="flex items-stretch w-full">
                                <input
                                    type="number"
                                    name="betClosureTime"
                                    value={formData.betClosureTime}
                                    onChange={handleChange}
                                    min="0"
                                    step="1"
                                    placeholder="e.g. 300"
                                    inputMode="numeric"
                                    className="flex-1 min-w-0 px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-700 border border-gray-600 rounded-l-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-base"
                                />
                                <span className="inline-flex items-center justify-center px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-600 border border-l-0 border-gray-600 rounded-r-lg text-gray-300 text-sm font-medium whitespace-nowrap">
                                    Seconds
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 w-full sm:w-auto bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2.5 sm:py-2 px-4 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 w-full sm:w-auto bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2.5 sm:py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
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
