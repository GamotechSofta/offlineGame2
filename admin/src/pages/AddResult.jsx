import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

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

    const handleSave = async () => {
        if (!editingMarketId) return;

        const openingVal = (openingNumber || '').trim();
        const closingVal = (closingNumber || '').trim();
        const hasValidOpening = openingVal && /^\d{3}$/.test(openingVal);
        const hasValidClosing = closingVal && /^\d{3}$/.test(closingVal);

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
        <div className="min-h-screen bg-gray-900 text-white">
            <Sidebar onLogout={handleLogout} />
            <div className="ml-64">
                <div className="p-8">
                    {error && (
                        <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
                            {error}
                        </div>
                    )}

                    <h1 className="text-3xl font-bold mb-6">Add / Edit Result</h1>
                    <p className="text-gray-400 mb-6">
                        All markets – add or edit opening and closing numbers here.
                    </p>

                    {loading ? (
                        <div className="text-center py-12">
                            <p className="text-gray-400">Loading markets...</p>
                        </div>
                    ) : markets.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            No markets found. Add markets first.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full border border-gray-700 rounded-lg overflow-hidden">
                                <thead>
                                    <tr className="bg-gray-800">
                                        <th className="text-left py-3 px-4 font-semibold">Market</th>
                                        <th className="text-left py-3 px-4 font-semibold">Timeline</th>
                                        <th className="text-left py-3 px-4 font-semibold">Result</th>
                                        <th className="text-left py-3 px-4 font-semibold">Opening</th>
                                        <th className="text-left py-3 px-4 font-semibold">Closing</th>
                                        <th className="text-left py-3 px-4 font-semibold w-40">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {markets.map((market) => (
                                        <tr
                                            key={market._id}
                                            className="border-b border-gray-700 hover:bg-gray-800/50"
                                        >
                                            <td className="py-3 px-4 font-medium">{market.marketName}</td>
                                            <td className="py-3 px-4 text-gray-300">
                                                {market.startingTime} – {market.closingTime}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="font-mono text-yellow-400">
                                                    {market.displayResult || '***-**-***'}
                                                </span>
                                                {market.openingNumber && market.closingNumber && /^\d{3}$/.test(market.openingNumber) && /^\d{3}$/.test(market.closingNumber) && (
                                                    <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-red-600">Closed</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
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
                                            <td className="py-3 px-4">
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
                                            <td className="py-3 px-4">
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
                </div>
            </div>
        </div>
    );
};

export default AddResult;
