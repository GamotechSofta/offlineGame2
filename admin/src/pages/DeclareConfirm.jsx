import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const getAuthHeaders = () => {
    const admin = JSON.parse(localStorage.getItem('admin') || '{}');
    const password = sessionStorage.getItem('adminPassword') || '';
    return {
        'Content-Type': 'application/json',
        Authorization: `Basic ${btoa(`${admin.username}:${password}`)}`,
    };
};

const formatNum = (n) => (n != null && Number.isFinite(n) ? Number(n).toLocaleString('en-IN') : '0');

const DeclareConfirm = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { market, declareType, number } = location.state || {};
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [data, setData] = useState(null);
    const [declaring, setDeclaring] = useState(false);

    useEffect(() => {
        if (!market || !declareType || !number) {
            navigate('/add-result', { replace: true });
            return;
        }
        const marketId = market._id ?? market.id;
        if (!marketId) {
            navigate('/add-result', { replace: true });
            return;
        }
        const query = declareType === 'open' ? `openingNumber=${encodeURIComponent(number)}` : `closingNumber=${encodeURIComponent(number)}`;
        const url = `${API_BASE_URL}/markets/winning-bets-preview/${encodeURIComponent(marketId)}?${query}`;
        setLoading(true);
        setError('');
        fetch(url, { headers: getAuthHeaders() })
            .then((res) => res.json())
            .then((json) => {
                if (json.success && json.data) setData(json.data);
                else setError(json.message || 'Failed to load winning players');
            })
            .catch(() => setError('Network error'))
            .finally(() => setLoading(false));
    }, [market, declareType, number, navigate]);

    const handleConfirmDeclare = async () => {
        const marketId = market._id ?? market.id;
        if (!marketId) return;
        setDeclaring(true);
        try {
            const endpoint = declareType === 'open' ? 'declare-open' : 'declare-close';
            const body = declareType === 'open' ? { openingNumber: number } : { closingNumber: number };
            const res = await fetch(`${API_BASE_URL}/markets/${endpoint}/${marketId}`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(body),
            });
            const json = await res.json();
            if (json.success) {
                navigate('/add-result', { replace: true });
            } else {
                alert(json.message || 'Failed to declare result');
            }
        } catch {
            alert('Network error');
        } finally {
            setDeclaring(false);
        }
    };

    const handleBack = () => {
        navigate('/add-result');
    };

    const handleLogout = () => {
        localStorage.removeItem('admin');
        sessionStorage.removeItem('adminPassword');
        navigate('/');
    };

    if (!market || !declareType || !number) return null;

    const title = declareType === 'open' ? `Declare Open: ${number}` : `Declare Close: ${number}`;
    const marketName = data?.marketName || market.marketName || 'Market';

    return (
        <AdminLayout onLogout={handleLogout} title="Confirm Declare">
            <div className="w-full min-w-0 px-3 sm:px-4 md:px-6 pb-6 sm:pb-8">
                <button
                    type="button"
                    onClick={handleBack}
                    className="inline-flex items-center gap-2 text-gray-400 hover:text-yellow-500 text-sm mb-4 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Add Result
                </button>

                <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">{title}</h1>
                <p className="text-gray-400 text-sm mb-6">{marketName}</p>

                {error && (
                    <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">{error}</div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-600 border-t-yellow-500" />
                    </div>
                ) : data ? (
                    <>
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 mb-6">
                            <p className="text-amber-400 font-semibold">Total payout to winning players: ₹{formatNum(data.totalWinAmount)}</p>
                            <p className="text-gray-400 text-sm mt-1">{data.winningBets?.length ?? 0} winning bet(s)</p>
                        </div>

                        <div className="rounded-xl border border-gray-700 bg-gray-800/80 shadow-lg overflow-hidden mb-6">
                            <h2 className="text-lg font-bold text-yellow-500 bg-gray-800 px-4 py-3 border-b border-gray-700">Winning players</h2>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="bg-gray-700/70 border-b border-gray-600">
                                            <th className="text-left py-3 px-3 font-semibold text-yellow-500">#</th>
                                            <th className="text-left py-3 px-3 font-semibold text-gray-300">Username</th>
                                            <th className="text-left py-3 px-3 font-semibold text-gray-300">Bet type</th>
                                            <th className="text-left py-3 px-3 font-semibold text-gray-300">Bet number</th>
                                            <th className="text-right py-3 px-3 font-semibold text-gray-300">Amount (₹)</th>
                                            <th className="text-right py-3 px-3 font-semibold text-amber-400">Payout (₹)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(data.winningBets || []).length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="py-8 text-center text-gray-500">No winning players for this result.</td>
                                            </tr>
                                        ) : (
                                            (data.winningBets || []).map((row, idx) => (
                                                <tr key={idx} className="border-b border-gray-700 hover:bg-gray-700/30">
                                                    <td className="py-2.5 px-3 text-gray-400">{idx + 1}</td>
                                                    <td className="py-2.5 px-3 font-medium text-white">{row.username}</td>
                                                    <td className="py-2.5 px-3 text-gray-300 capitalize">{row.betType}</td>
                                                    <td className="py-2.5 px-3 font-mono text-amber-300">{row.betNumber}</td>
                                                    <td className="py-2.5 px-3 text-right font-mono text-white">{formatNum(row.amount)}</td>
                                                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-green-400">{formatNum(row.payout)}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={handleConfirmDeclare}
                                disabled={declaring}
                                className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-black font-semibold rounded-lg shadow-lg disabled:opacity-50 transition-all"
                            >
                                {declaring ? 'Declaring...' : 'Confirm & Declare'}
                            </button>
                            <button
                                type="button"
                                onClick={handleBack}
                                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg border border-gray-600 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </>
                ) : null}
            </div>
        </AdminLayout>
    );
};

export default DeclareConfirm;
