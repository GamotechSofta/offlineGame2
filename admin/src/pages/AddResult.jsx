import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const AddResult = () => {
    const [markets, setMarkets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editingMarketId, setEditingMarketId] = useState(null);
    const [openingNumber, setOpeningNumber] = useState('');
    const [closingNumber, setClosingNumber] = useState('');
    const [submitLoading, setSubmitLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const admin = localStorage.getItem('admin');
        if (!admin) {
            navigate('/');
            return;
        }
        fetchMarkets();
    }, [navigate]);

    const fetchMarkets = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await fetch(`${API_BASE_URL}/markets/get-markets`);
            const data = await response.json();
            if (data.success) {
                setMarkets(data.data || []);
            } else {
                setError('Failed to fetch markets');
            }
        } catch (err) {
            setError('Network error. Please check if the server is running.');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('admin');
        sessionStorage.removeItem('adminPassword');
        navigate('/');
    };

    const getAuthHeaders = () => {
        const admin = JSON.parse(localStorage.getItem('admin'));
        const password = sessionStorage.getItem('adminPassword') || '';
        return {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${btoa(`${admin.username}:${password}`)}`,
        };
    };

    const startEdit = (market) => {
        setEditingMarketId(market._id);
        setOpeningNumber(market.openingNumber || '');
        setClosingNumber(market.closingNumber || '');
    };

    const cancelEdit = () => {
        setEditingMarketId(null);
        setOpeningNumber('');
        setClosingNumber('');
    };

    /**
     * Opening/Closing: digits non-descending (d1 <= d2 <= d3).
     * Exception: last digit "0" is always allowed (e.g. 120, 890).
     * So valid if (d1 <= d2 && d2 <= d3) OR (d1 <= d2 && d3 === 0).
     */
    const isDigitsValid = (str) => {
        if (!str || str.length !== 3) return false;
        const a = parseInt(str[0], 10);
        const b = parseInt(str[1], 10);
        const c = parseInt(str[2], 10);
        if (a <= b && b <= c) return true;
        if (c === 0 && a <= b) return true; // last digit 0 always allowed
        return false;
    };

    const handleSave = async () => {
        if (!editingMarketId) return;

        const openingVal = (openingNumber || '').trim();
        const closingVal = (closingNumber || '').trim();
        const hasValidOpening = openingVal && /^\d{3}$/.test(openingVal);
        const hasValidClosing = closingVal && /^\d{3}$/.test(closingVal);

        if (hasValidClosing && !hasValidOpening) {
            alert('Opening number is required before closing number. Please add opening number first.');
            return;
        }

        if (hasValidOpening && !isDigitsValid(openingVal)) {
            alert('Opening: digits must be non-descending (e.g. 123, 112, 120 OK; 321, 132 NO). The last digit can always be 0 (e.g. 120, 890).');
            return;
        }

        if (hasValidClosing && !isDigitsValid(closingVal)) {
            alert('Closing: digits must be non-descending (e.g. 123, 112, 120 OK; 321, 132 NO). The last digit can always be 0 (e.g. 120, 890).');
            return;
        }

        const headers = getAuthHeaders();
        setSubmitLoading(true);

        try {
            const res1 = await fetch(`${API_BASE_URL}/markets/set-opening-number/${editingMarketId}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ openingNumber: hasValidOpening ? openingVal : null }),
            });
            const data1 = await res1.json();
            if (!data1.success) {
                alert(data1.message || 'Failed to set opening number');
                setSubmitLoading(false);
                return;
            }

            const res2 = await fetch(`${API_BASE_URL}/markets/set-closing-number/${editingMarketId}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ closingNumber: hasValidClosing ? closingVal : null }),
            });
            const data2 = await res2.json();
            if (!data2.success) {
                alert(data2.message || 'Failed to set closing number');
                setSubmitLoading(false);
                return;
            }

            cancelEdit();
            fetchMarkets();
        } catch (err) {
            alert('Network error');
        } finally {
            setSubmitLoading(false);
        }
    };

    return (
        <AdminLayout onLogout={handleLogout} title="Add Result">
                    {error && (
                        <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
                            {error}
                        </div>
                    )}

                    <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Add / Edit Result</h1>
                    <p className="text-gray-400 mb-2">
                        All markets – add or edit opening and closing numbers here.
                    </p>
                    <div className="mb-6 p-3 sm:p-4 bg-amber-900/30 border border-amber-700 rounded-lg text-amber-200 text-sm space-y-2">
                        <p><strong>Note:</strong> Opening number must be added before closing number. You cannot add closing number without opening number.</p>
                        <p><strong>Validation:</strong> Opening and closing digits must be non-descending (each digit &le; the next). Examples: 123, 112, 120 OK; 321, 132 NO. The last digit can always be 0 (e.g. 120, 890).</p>
                    </div>

                    {loading ? (
                        <div className="text-center py-12">
                            <p className="text-gray-400">Loading markets...</p>
                        </div>
                    ) : markets.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            No markets found. Add markets first.
                        </div>
                    ) : (
                        <div className="overflow-x-auto -mx-4 sm:mx-0">
                            <table className="w-full min-w-[640px] border border-gray-700 rounded-lg overflow-hidden text-sm sm:text-base">
                                <thead>
                                    <tr className="bg-gray-800">
                                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold">Market</th>
                                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold">Timeline</th>
                                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold">Result</th>
                                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold">Opening</th>
                                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold">Closing</th>
                                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold w-32 sm:w-40">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {markets.map((market) => (
                                        <tr
                                            key={market._id}
                                            className="border-b border-gray-700 hover:bg-gray-800/50"
                                        >
                                            <td className="py-2 sm:py-3 px-2 sm:px-4 font-medium">{market.marketName}</td>
                                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-300">
                                                {market.startingTime} – {market.closingTime}
                                            </td>
                                            <td className="py-2 sm:py-3 px-2 sm:px-4">
                                                <span className="font-mono text-yellow-400">
                                                    {market.displayResult || '***-**-***'}
                                                </span>
                                                {market.openingNumber && market.closingNumber && /^\d{3}$/.test(market.openingNumber) && /^\d{3}$/.test(market.closingNumber) && (
                                                    <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-red-600">Closed</span>
                                                )}
                                            </td>
                                            <td className="py-2 sm:py-3 px-2 sm:px-4">
                                                {editingMarketId === market._id ? (
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        autoComplete="off"
                                                        value={openingNumber}
                                                        onChange={(e) => setOpeningNumber(e.target.value.replace(/\D/g, '').slice(0, 3))}
                                                        className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm font-mono"
                                                        placeholder="123"
                                                        maxLength={3}
                                                    />
                                                ) : (
                                                    <span className="font-mono">{market.openingNumber || '—'}</span>
                                                )}
                                            </td>
                                            <td className="py-2 sm:py-3 px-2 sm:px-4">
                                                {editingMarketId === market._id ? (
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        autoComplete="off"
                                                        value={closingNumber}
                                                        onChange={(e) => setClosingNumber(e.target.value.replace(/\D/g, '').slice(0, 3))}
                                                        className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm font-mono"
                                                        placeholder="456"
                                                        maxLength={3}
                                                    />
                                                ) : (
                                                    <span className="font-mono">{market.closingNumber || '—'}</span>
                                                )}
                                            </td>
                                            <td className="py-2 sm:py-3 px-2 sm:px-4">
                                                {editingMarketId === market._id ? (
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={handleSave}
                                                            disabled={submitLoading}
                                                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm font-semibold disabled:opacity-50"
                                                        >
                                                            {submitLoading ? 'Saving...' : 'Save'}
                                                        </button>
                                                        <button
                                                            onClick={cancelEdit}
                                                            className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 rounded text-sm"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => startEdit(market)}
                                                        className="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-sm font-semibold"
                                                    >
                                                        Edit Result
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
        </AdminLayout>
    );
};

export default AddResult;
