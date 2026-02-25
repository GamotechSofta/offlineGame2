import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';
import { getAuthHeaders, clearAdminSession, fetchWithAuth } from '../lib/auth';

const formatNum = (n) => (n != null && Number.isFinite(n) ? Number(n).toLocaleString('en-IN') : '0');

const DeclareConfirm = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { market, declareType, number } = location.state || {};
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [data, setData] = useState(null);
    const [declaring, setDeclaring] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [secretPassword, setSecretPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [hasSecretDeclarePassword, setHasSecretDeclarePassword] = useState(false);

    useEffect(() => {
        fetchWithAuth(`${API_BASE_URL}/admin/me/secret-declare-password-status`)
            .then((res) => { if (res.status === 401) return; return res.json(); })
            .then((json) => {
                if (json && json.success) setHasSecretDeclarePassword(json.hasSecretDeclarePassword || false);
            })
            .catch(() => setHasSecretDeclarePassword(false));
    }, []);

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
        const marketIdStr = String(marketId);
        const query = declareType === 'open' ? `openingNumber=${encodeURIComponent(number)}` : `closingNumber=${encodeURIComponent(number)}`;
        const url = `${API_BASE_URL}/markets/winning-bets-preview/${encodeURIComponent(marketIdStr)}?${query}`;
        setLoading(true);
        setError('');
        fetchWithAuth(url)
            .then((res) => { if (res.status === 401) return; return res.json(); })
            .then((json) => {
                if (json && json.success && json.data) setData(json.data);
                else setError(json?.message || 'Failed to load winning players');
            })
            .catch(() => setError('Network error'))
            .finally(() => setLoading(false));
    }, [market, declareType, number, navigate]);

    const performDeclare = async (secretDeclarePasswordValue) => {
        const marketId = market._id ?? market.id;
        if (!marketId) return;
        const marketIdStr = String(marketId);
        setDeclaring(true);
        setPasswordError('');
        try {
            const endpoint = declareType === 'open' ? 'declare-open' : 'declare-close';
            const body = declareType === 'open' ? { openingNumber: number } : { closingNumber: number };
            if (secretDeclarePasswordValue) body.secretDeclarePassword = secretDeclarePasswordValue;
            const res = await fetchWithAuth(`${API_BASE_URL}/markets/${endpoint}/${marketIdStr}`, {
                method: 'POST',
                body: JSON.stringify(body),
            });
            if (res.status === 401) return;
            const json = await res.json();
            if (json.success) {
                setShowPasswordModal(false);
                setSecretPassword('');
                navigate('/declare-success', {
                    replace: true,
                    state: {
                        marketName: market.marketName || data?.marketName,
                        declareType,
                        number,
                    },
                });
            } else {
                if (json.code === 'INVALID_SECRET_DECLARE_PASSWORD') {
                    setPasswordError(json.message || 'Invalid secret password');
                } else {
                    alert(json.message || 'Failed to declare result');
                }
            }
        } catch {
            alert('Network error');
        } finally {
            setDeclaring(false);
        }
    };

    const handleConfirmDeclare = () => {
        if (hasSecretDeclarePassword) {
            setShowPasswordModal(true);
            setSecretPassword('');
            setPasswordError('');
        } else {
            performDeclare('');
        }
    };

    const handlePasswordSubmit = (e) => {
        e.preventDefault();
        const val = secretPassword.trim();
        if (hasSecretDeclarePassword && !val) {
            setPasswordError('Please enter the secret declare password');
            return;
        }
        performDeclare(val);
    };

    const handleBack = () => {
        navigate('/add-result');
    };

    const handleLogout = () => {
        clearAdminSession();
        navigate('/');
    };

    if (!market || !declareType || !number) return null;

    const title = declareType === 'open' ? `Declare Open: ${number}` : `Declare Close: ${number}`;
    const marketName = data?.marketName || market.marketName || 'Market';

    return (
        <AdminLayout onLogout={handleLogout} title="Confirm Declare">
            <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 md:px-6 pb-4 sm:pb-6 md:pb-8">
                <button
                    type="button"
                    onClick={handleBack}
                    className="inline-flex items-center gap-2 text-gray-400 hover:text-orange-500 text-xs sm:text-sm mb-4 transition-colors min-h-[44px] touch-manipulation"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Add Result
                </button>

                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 mb-2 break-words">{title}</h1>
                <p className="text-gray-400 text-xs sm:text-sm mb-4 sm:mb-6 truncate">{marketName}</p>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-200 border-t-yellow-500" />
                    </div>
                ) : data ? (
                    <>
                        <div className="rounded-xl border border-orange-200 bg-orange-500/10 p-3 sm:p-4 mb-4 sm:mb-6 overflow-hidden">
                            <p className="text-orange-500 font-semibold text-sm sm:text-base break-words">Total payout to winning players: ₹{formatNum(data.totalWinAmount)}</p>
                            <p className="text-gray-400 text-xs sm:text-sm mt-1">{data.winningBets?.length ?? 0} winning bet(s)</p>
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden mb-4 sm:mb-6">
                            <h2 className="text-base sm:text-lg font-bold text-orange-500 bg-white px-3 sm:px-4 py-2 sm:py-3 border-b border-gray-200">Winning players</h2>
                            <div className="overflow-x-auto overscroll-x-contain touch-pan-x">
                                <table className="w-full text-xs sm:text-sm border-collapse min-w-[340px] sm:min-w-[480px]">
                                    <thead>
                                        <tr className="bg-gray-100/70 border-b border-gray-200">
                                            <th className="text-left py-2 sm:py-3 px-2 sm:px-3 font-semibold text-orange-500 text-[11px] sm:text-sm">#</th>
                                            <th className="text-left py-2 sm:py-3 px-2 sm:px-3 font-semibold text-gray-600 text-[11px] sm:text-sm">Username</th>
                                            <th className="text-left py-2 sm:py-3 px-2 sm:px-3 font-semibold text-gray-600 text-[11px] sm:text-sm">Bet type</th>
                                            <th className="text-left py-2 sm:py-3 px-2 sm:px-3 font-semibold text-gray-600 text-[11px] sm:text-sm">Bet number</th>
                                            <th className="text-right py-2 sm:py-3 px-2 sm:px-3 font-semibold text-gray-600 text-[11px] sm:text-sm">Amount (₹)</th>
                                            <th className="text-right py-2 sm:py-3 px-2 sm:px-3 font-semibold text-orange-500 text-[11px] sm:text-sm">Payout (₹)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(data.winningBets || []).length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="py-8 text-center text-gray-500">No winning players for this result.</td>
                                            </tr>
                                        ) : (
                                            (data.winningBets || []).map((row, idx) => (
                                                <tr key={idx} className="border-b border-gray-200 hover:bg-gray-100/30">
                                                    <td className="py-2 sm:py-2.5 px-2 sm:px-3 text-gray-400 text-[11px] sm:text-sm">{idx + 1}</td>
                                                    <td className="py-2 sm:py-2.5 px-2 sm:px-3 font-medium text-gray-800 text-[11px] sm:text-sm truncate max-w-[90px] sm:max-w-[120px] md:max-w-none">{row.username}</td>
                                                    <td className="py-2 sm:py-2.5 px-2 sm:px-3 text-gray-600 capitalize text-[11px] sm:text-sm">{row.betType}</td>
                                                    <td className="py-2 sm:py-2.5 px-2 sm:px-3 font-mono text-amber-300 text-[11px] sm:text-sm">{row.betNumber}</td>
                                                    <td className="py-2 sm:py-2.5 px-2 sm:px-3 text-right font-mono text-gray-800 text-[11px] sm:text-sm">{formatNum(row.amount)}</td>
                                                    <td className="py-2 sm:py-2.5 px-2 sm:px-3 text-right font-mono font-semibold text-green-600 text-[11px] sm:text-sm">{formatNum(row.payout)}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">
                            <button
                                type="button"
                                onClick={handleConfirmDeclare}
                                disabled={declaring}
                                className="w-full sm:w-auto px-4 sm:px-6 py-3 min-h-[44px] bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-gray-800 font-semibold rounded-lg shadow-lg disabled:opacity-50 transition-all touch-manipulation"
                            >
                                {declaring ? 'Declaring...' : 'Confirm & Declare'}
                            </button>
                            <button
                                type="button"
                                onClick={handleBack}
                                className="w-full sm:w-auto px-4 sm:px-6 py-3 min-h-[44px] bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-lg border border-gray-200 transition-colors touch-manipulation"
                            >
                                Cancel
                            </button>
                        </div>

                        {/* Secret declare password modal */}
                        {showPasswordModal && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3 sm:p-4 overflow-y-auto">
                                <div className="bg-white rounded-xl border border-gray-200 shadow-xl max-w-md w-full p-4 sm:p-6 my-auto">
                                    <h3 className="text-base sm:text-lg font-bold text-orange-500 mb-2">Enter Secret Declare Password</h3>
                                    <p className="text-gray-400 text-xs sm:text-sm mb-4">
                                        Please enter the secret password to confirm and declare this result.
                                    </p>
                                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                                        <input
                                            type="password"
                                            value={secretPassword}
                                            onChange={(e) => { setSecretPassword(e.target.value); setPasswordError(''); }}
                                            placeholder="Secret password"
                                            autoFocus
                                            className="w-full px-4 py-3 min-h-[44px] rounded-lg bg-gray-100 border border-gray-200 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent touch-manipulation"
                                        />
                                        {passwordError && <p className="text-red-500 text-xs sm:text-sm">{passwordError}</p>}
                                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                                            <button
                                                type="submit"
                                                disabled={declaring}
                                                className="flex-1 px-4 py-3 min-h-[44px] bg-orange-500 hover:bg-orange-600 text-gray-800 font-semibold rounded-lg disabled:opacity-50 touch-manipulation"
                                            >
                                                {declaring ? 'Declaring...' : 'Confirm & Declare'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { setShowPasswordModal(false); setSecretPassword(''); setPasswordError(''); }}
                                                disabled={declaring}
                                                className="px-4 py-3 min-h-[44px] bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-lg border border-gray-200 touch-manipulation"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}
                    </>
                ) : null}
            </div>
        </AdminLayout>
    );
};

export default DeclareConfirm;
