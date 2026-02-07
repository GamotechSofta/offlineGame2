import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const MarketList = ({ markets, onEdit, onDelete, apiBaseUrl, getAuthHeaders }) => {
    const navigate = useNavigate();
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [secretPassword, setSecretPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [hasSecretDeclarePassword, setHasSecretDeclarePassword] = useState(false);
    const [marketToDelete, setMarketToDelete] = useState(null);

    useEffect(() => {
        fetch(`${apiBaseUrl}/admin/me/secret-declare-password-status`, { headers: getAuthHeaders() })
            .then((res) => res.json())
            .then((json) => {
                if (json.success) setHasSecretDeclarePassword(json.hasSecretDeclarePassword || false);
            })
            .catch(() => setHasSecretDeclarePassword(false));
    }, [apiBaseUrl, getAuthHeaders]);

    const performDelete = async (marketId, secretDeclarePasswordValue, skipConfirm = false) => {
        if (!skipConfirm && !window.confirm('Are you sure you want to delete this market?')) return;
        try {
            const headers = getAuthHeaders();
            const options = { method: 'DELETE', headers };
            if (secretDeclarePasswordValue) {
                headers['Content-Type'] = 'application/json';
                options.body = JSON.stringify({ secretDeclarePassword: secretDeclarePasswordValue });
            }
            const response = await fetch(`${apiBaseUrl}/markets/delete-market/${marketId}`, options);
            const data = await response.json();
            if (data.success) {
                setShowPasswordModal(false);
                setMarketToDelete(null);
                setSecretPassword('');
                setPasswordError('');
                onDelete();
            } else {
                if (data.code === 'INVALID_SECRET_DECLARE_PASSWORD') {
                    setPasswordError(data.message || 'Invalid secret password');
                } else {
                    alert(data.message || 'Failed to delete market');
                }
            }
        } catch (err) {
            alert('Network error');
        }
    };

    const handleDelete = (marketId) => {
        if (hasSecretDeclarePassword) {
            setMarketToDelete(marketId);
            setShowPasswordModal(true);
            setSecretPassword('');
            setPasswordError('');
        } else {
            performDelete(marketId, '');
        }
    };

    const handlePasswordSubmit = (e) => {
        e.preventDefault();
        if (!marketToDelete) return;
        const val = secretPassword.trim();
        if (hasSecretDeclarePassword && !val) {
            setPasswordError('Please enter the secret declare password');
            return;
        }
        performDelete(marketToDelete, val, true);
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
        <>
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

        {/* Secret declare password modal for delete */}
        {showPasswordModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl max-w-md w-full p-6">
                    <h3 className="text-lg font-bold text-yellow-500 mb-2">Enter Secret Password to Delete Market</h3>
                    <p className="text-gray-400 text-sm mb-4">
                        Please enter the secret password to confirm market deletion.
                    </p>
                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                        <input
                            type="password"
                            value={secretPassword}
                            onChange={(e) => { setSecretPassword(e.target.value); setPasswordError(''); }}
                            placeholder="Secret password"
                            autoFocus
                            className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-500 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                        />
                        {passwordError && <p className="text-red-400 text-sm">{passwordError}</p>}
                        <div className="flex gap-3">
                            <button
                                type="submit"
                                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg"
                            >
                                Delete Market
                            </button>
                            <button
                                type="button"
                                onClick={() => { setShowPasswordModal(false); setMarketToDelete(null); setSecretPassword(''); setPasswordError(''); }}
                                className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg border border-gray-600"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
        </>
    );
};

export default MarketList;
