import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

/** Safe number for preview: avoids NaN in UI */
const safeNum = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

/** Format "10:15" or "10:15:00" to "10:15" for display */
const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const parts = String(timeStr).split(':');
    const h = parseInt(parts[0], 10);
    const m = parts[1] ? String(parseInt(parts[1], 10)).padStart(2, '0') : '00';
    return `${Number.isFinite(h) ? h : ''}:${m}`;
};

const AddResult = () => {
    const [markets, setMarkets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedMarket, setSelectedMarket] = useState(null);
    const [openPatti, setOpenPatti] = useState('');
    const [closePatti, setClosePatti] = useState('');
    const [preview, setPreview] = useState(null);
    const [previewClose, setPreviewClose] = useState(null);
    const [checkLoading, setCheckLoading] = useState(false);
    const [checkCloseLoading, setCheckCloseLoading] = useState(false);
    const [declareLoading, setDeclareLoading] = useState(false);
    const [clearLoading, setClearLoading] = useState(false);
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
                const all = data.data || [];
                setMarkets(all.filter((m) => m.marketType !== 'startline'));
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
        const admin = JSON.parse(localStorage.getItem('admin') || '{}');
        const password = sessionStorage.getItem('adminPassword') || '';
        return {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${btoa(`${admin.username}:${password}`)}`,
        };
    };

    const openPanelForEdit = (market) => {
        setSelectedMarket(market);
        setOpenPatti(market.openingNumber || '');
        setClosePatti(market.closingNumber || '');
        setPreview(null);
        setPreviewClose(null);
    };

    const closePanel = () => {
        setSelectedMarket(null);
        setOpenPatti('');
        setClosePatti('');
        setPreview(null);
        setPreviewClose(null);
    };

    const getMarketId = () => {
        if (!selectedMarket) return null;
        const id = selectedMarket._id ?? selectedMarket.id;
        return id != null ? String(id) : null;
    };

    const handleCheckOpen = async () => {
        if (!selectedMarket) return;
        const marketId = getMarketId();
        if (!marketId) return;
        const val = openPatti.replace(/\D/g, '').slice(0, 3);
        setCheckLoading(true);
        setPreview(null);
        const headers = getAuthHeaders();
        try {
            const [previewRes, statsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/markets/preview-declare-open/${encodeURIComponent(marketId)}?openingNumber=${encodeURIComponent(val)}`, { headers }),
                fetch(`${API_BASE_URL}/markets/get-market-stats/${encodeURIComponent(marketId)}`, { headers }),
            ]);
            const previewData = await previewRes.json();
            const statsData = await statsRes.json();
            if (previewData.success && previewData.data != null) {
                let totalBetAmount = safeNum(previewData.data.totalBetAmount);
                if (statsData.success && statsData.data) {
                    const d = statsData.data;
                    const openTotal =
                        safeNum(d.singleDigit?.totalAmount) + safeNum(d.singlePatti?.totalAmount) + safeNum(d.doublePatti?.totalAmount) + safeNum(d.triplePatti?.totalAmount) + safeNum(d.halfSangam?.totalAmount);
                    totalBetAmount = openTotal;
                }
                const totalWinAmount = safeNum(previewData.data.totalWinAmount);
                setPreview({
                    totalBetAmount,
                    totalWinAmount,
                    noOfPlayers: safeNum(previewData.data.noOfPlayers),
                });
            } else {
                setPreview({ totalBetAmount: 0, totalWinAmount: 0, noOfPlayers: 0 });
            }
        } catch (err) {
            setPreview(null);
        } finally {
            setCheckLoading(false);
        }
    };

    const handleCheckClose = async () => {
        if (!selectedMarket) return;
        const marketId = getMarketId();
        if (!marketId) return;
        const val = closePatti.replace(/\D/g, '').slice(0, 3);
        setCheckCloseLoading(true);
        setPreviewClose(null);
        const headers = getAuthHeaders();
        try {
            const [previewRes, statsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/markets/preview-declare-close/${encodeURIComponent(marketId)}?closingNumber=${encodeURIComponent(val)}`, { headers }),
                fetch(`${API_BASE_URL}/markets/get-market-stats/${encodeURIComponent(marketId)}`, { headers }),
            ]);
            const previewData = await previewRes.json();
            const statsData = await statsRes.json();
            if (previewData.success && previewData.data != null) {
                let totalBetAmount = safeNum(previewData.data.totalBetAmount);
                if (statsData.success && statsData.data) {
                    const d = statsData.data;
                    const closedTotal = safeNum(d.jodi?.totalAmount) + safeNum(d.fullSangam?.totalAmount);
                    totalBetAmount = closedTotal;
                }
                const totalWinAmount = safeNum(previewData.data.totalWinAmount);
                setPreviewClose({
                    totalBetAmount,
                    totalWinAmount,
                    noOfPlayers: safeNum(previewData.data.noOfPlayers),
                });
            } else {
                setPreviewClose({ totalBetAmount: 0, totalWinAmount: 0, noOfPlayers: 0 });
            }
        } catch (err) {
            setPreviewClose(null);
        } finally {
            setCheckCloseLoading(false);
        }
    };

    const handleDeclareOpen = async () => {
        if (!selectedMarket) return;
        const val = openPatti.replace(/\D/g, '').slice(0, 3);
        if (val.length !== 3) {
            alert('Please enter a 3-digit Open Patti.');
            return;
        }
        setDeclareLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/markets/declare-open/${selectedMarket._id}`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ openingNumber: val }),
            });
            const data = await res.json();
            if (data.success) {
                setSelectedMarket((prev) => (prev ? { ...prev, openingNumber: val } : null));
                setOpenPatti(val);
                fetchMarkets();
            } else {
                alert(data.message || 'Failed to declare open result');
            }
        } catch (err) {
            alert('Network error');
        } finally {
            setDeclareLoading(false);
        }
    };

    const handleDeclareClose = async () => {
        if (!selectedMarket) return;
        const val = closePatti.replace(/\D/g, '').slice(0, 3);
        if (val.length !== 3) {
            alert('Please enter a 3-digit Close Patti.');
            return;
        }
        setDeclareLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/markets/declare-close/${selectedMarket._id}`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ closingNumber: val }),
            });
            const data = await res.json();
            if (data.success) {
                setSelectedMarket((prev) => (prev ? { ...prev, closingNumber: val } : null));
                setClosePatti(val);
                fetchMarkets();
            } else {
                alert(data.message || 'Failed to declare close result');
            }
        } catch (err) {
            alert('Network error');
        } finally {
            setDeclareLoading(false);
        }
    };

    const handleClearResult = async () => {
        if (!selectedMarket) return;
        const hasOpen = selectedMarket.openingNumber && /^\d{3}$/.test(selectedMarket.openingNumber);
        const hasClose = selectedMarket.closingNumber && /^\d{3}$/.test(selectedMarket.closingNumber);
        if (!hasOpen && !hasClose) {
            alert('This market has no result to clear.');
            return;
        }
        const msg = hasOpen && hasClose
            ? 'Clear Opening & Closing result for this market?'
            : hasOpen
                ? 'Clear Opening result for this market?'
                : 'Clear Closing result for this market?';
        if (!window.confirm(msg)) return;
        setClearLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/markets/clear-result/${selectedMarket._id}`, {
                method: 'POST',
                headers: getAuthHeaders(),
            });
            const data = await res.json();
            if (data.success) {
                setSelectedMarket((prev) => (prev ? { ...prev, openingNumber: null, closingNumber: null } : null));
                setOpenPatti('');
                setClosePatti('');
                setPreview(null);
                setPreviewClose(null);
                fetchMarkets();
            } else {
                alert(data.message || 'Failed to clear result');
            }
        } catch (err) {
            alert('Network error');
        } finally {
            setClearLoading(false);
        }
    };

    const formatNum = (n) => (n != null && Number.isFinite(n) ? Number(n).toLocaleString('en-IN') : '0');

    return (
        <AdminLayout onLogout={handleLogout} title="Declare Result">
            <div className="w-full min-w-0 px-3 sm:px-4 md:px-6 pb-6 sm:pb-8">
                {error && (
                    <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm sm:text-base">
                        {error}
                    </div>
                )}

                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 sm:mb-6 text-white text-center sm:text-left">
                    Declare Result
                </h1>

                <div className="flex flex-col xl:flex-row gap-4 sm:gap-6">
                    {/* Left: Market list */}
                    <div className="flex-1 min-w-0 w-full">
                        {loading ? (
                            <div className="text-center py-8 sm:py-12 text-gray-400 text-sm sm:text-base">Loading markets...</div>
                        ) : markets.length === 0 ? (
                            <div className="text-center py-8 sm:py-12 text-gray-400 text-sm sm:text-base">No markets found.</div>
                        ) : (
                            <div className="overflow-x-auto -mx-3 sm:mx-0 rounded-lg sm:rounded-xl border border-gray-700 bg-gray-800/80 shadow-lg">
                                <table className="w-full border-collapse text-xs sm:text-sm md:text-base min-w-[520px]">
                                    <thead>
                                        <tr className="border-b border-gray-700">
                                            <th className="text-left py-2 sm:py-3 px-2 sm:px-3 md:px-4 font-semibold text-yellow-500 bg-gray-800 whitespace-nowrap">Market</th>
                                            <th className="text-left py-2 sm:py-3 px-2 sm:px-3 md:px-4 font-semibold text-yellow-500 bg-gray-800 border-l border-gray-700 whitespace-nowrap">Timeline</th>
                                            <th className="text-left py-2 sm:py-3 px-2 sm:px-3 md:px-4 font-semibold text-yellow-500 bg-gray-800 border-l border-gray-700 whitespace-nowrap min-w-[5rem] sm:min-w-[6.5rem] md:min-w-[7.5rem]">Result</th>
                                            <th className="text-left py-2 sm:py-3 px-2 sm:px-3 md:px-4 font-semibold text-yellow-500 bg-gray-800 border-l border-gray-700 whitespace-nowrap">Opening</th>
                                            <th className="text-left py-2 sm:py-3 px-2 sm:px-3 md:px-4 font-semibold text-yellow-500 bg-gray-800 border-l border-gray-700 whitespace-nowrap">Closing</th>
                                            <th className="text-left py-2 sm:py-3 px-2 sm:px-3 md:px-4 font-semibold text-yellow-500 bg-gray-800 border-l border-gray-700 whitespace-nowrap min-w-[5rem] sm:min-w-[6.5rem] md:min-w-[7.5rem]">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {markets.map((market) => {
                                            const isStartline = market.marketType === 'startline';
                                            const hasOpen = market.openingNumber && /^\d{3}$/.test(market.openingNumber);
                                            const hasClose = market.closingNumber && /^\d{3}$/.test(market.closingNumber);
                                            const isClosed = isStartline ? hasOpen : (hasOpen && hasClose);
                                            const timeline = isStartline ? `Closes ${formatTime(market.closingTime)}` : `${formatTime(market.startingTime)} - ${formatTime(market.closingTime)}`;
                                            const resultDisplay = market.displayResult || (isStartline ? '*** - *' : '***-**-***');
                                            return (
                                                <tr key={market._id} className="border-b border-gray-700 hover:bg-gray-700/50">
                                                    <td className="py-2 sm:py-3 px-2 sm:px-3 md:px-4 font-medium text-white whitespace-nowrap">
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            {market.marketName}
                                                            {isStartline && (
                                                                <span className="inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-600/80 text-black">Startline</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-2 sm:py-3 px-2 sm:px-3 md:px-4 text-gray-300 border-l border-gray-700 whitespace-nowrap text-xs sm:text-sm">{timeline}</td>
                                                    <td className="py-2 sm:py-3 px-2 sm:px-3 md:px-4 border-l border-gray-700 min-w-[5rem] sm:min-w-[6.5rem] md:min-w-[7.5rem]">
                                                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 sm:gap-x-2">
                                                            <span className="font-mono text-amber-400 text-[10px] min-[480px]:text-xs sm:text-sm md:text-base">{resultDisplay}</span>
                                                            {isClosed && (
                                                                <span className="inline-flex shrink-0 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-semibold rounded-full bg-red-600 text-white">Closed</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-2 sm:py-3 px-2 sm:px-3 md:px-4 border-l border-gray-700">
                                                        {hasOpen ? <span className="font-mono text-yellow-400">{market.openingNumber}</span> : <span className="text-gray-500">—</span>}
                                                    </td>
                                                    <td className="py-2 sm:py-3 px-2 sm:px-3 md:px-4 border-l border-gray-700">
                                                        {isStartline ? <span className="text-gray-500">N/A</span> : (hasClose ? <span className="font-mono text-yellow-400">{market.closingNumber}</span> : <span className="text-gray-500">—</span>)}
                                                    </td>
                                                    <td className="py-2 sm:py-3 px-2 sm:px-3 md:px-4 border-l border-gray-700 min-w-[5rem] sm:min-w-[6.5rem] md:min-w-[7.5rem]">
                                                        <div className="flex flex-wrap items-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => openPanelForEdit(market)}
                                                                className="px-2 sm:px-3 py-1.5 sm:py-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg transition-colors text-[10px] min-[480px]:text-xs sm:text-sm min-h-[32px] sm:min-h-[36px] md:min-h-[40px] touch-manipulation whitespace-nowrap"
                                                            >
                                                                Edit Result
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Right: Edit Result panel - Open & Close sections */}
                    {selectedMarket && (
                        <div className="w-full xl:w-[380px] xl:max-w-[400px] xl:shrink-0 bg-gray-800 rounded-xl border border-gray-700 shadow-xl p-4 sm:p-5 md:p-6">
                            <h2 className="text-lg sm:text-xl font-bold text-yellow-500 mb-3 sm:mb-4 border-b border-gray-700 pb-2 truncate" title={selectedMarket.marketName}>
                                {selectedMarket.marketName}
                                {selectedMarket.marketType === 'startline' && (
                                    <span className="ml-2 inline-flex px-2 py-0.5 text-xs font-semibold rounded bg-amber-600/80 text-black align-middle">Startline</span>
                                )}
                            </h2>

                            {selectedMarket.marketType === 'startline' && (
                                <p className="text-xs text-gray-400 mb-3 p-2 rounded bg-gray-700/50 border border-amber-500/20">
                                    Startline has only one result (Open Digit/Patti). To update <strong>closing time</strong>, edit the market from Markets.
                                </p>
                            )}

                            {/* Open Result section — for Startline this is the only result */}
                            <div className="mb-4 sm:mb-6">
                                <h3 className="text-xs sm:text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2 sm:mb-3">
                                    {selectedMarket.marketType === 'startline' ? 'Startline Result (Open Patti)' : 'Open Result'}
                                </h3>
                                <div className="mb-2 sm:mb-3">
                                    <label className="block text-xs sm:text-sm font-medium text-gray-400 mb-1">Open Patti</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={openPatti}
                                        onChange={(e) => setOpenPatti(e.target.value.replace(/\D/g, '').slice(0, 3))}
                                        placeholder="e.g. 156"
                                        className="w-full px-3 py-2.5 sm:py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-base sm:text-lg font-mono placeholder-gray-500 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 min-h-[44px] sm:min-h-[48px] touch-manipulation"
                                        maxLength={3}
                                    />
                                </div>
                                <div className="flex gap-2 mb-2 sm:mb-3">
                                    <button
                                        type="button"
                                        onClick={handleCheckOpen}
                                        disabled={checkLoading}
                                        className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg border border-gray-600 disabled:opacity-50 transition-colors text-sm sm:text-base min-h-[44px] sm:min-h-[48px] touch-manipulation"
                                    >
                                        {checkLoading ? 'Checking...' : 'Check'}
                                    </button>
                                </div>
                                {(preview != null) && (
                                    <div className="mb-2 sm:mb-3 rounded-xl bg-gray-700/50 border border-amber-500/30 overflow-hidden shadow-inner">
                                        <div className="bg-amber-500/10 border-b border-amber-500/20 px-3 py-2">
                                            <p className="text-amber-400 font-semibold text-sm">Open preview: <span className="font-mono text-white">{openPatti.replace(/\D/g, '').slice(0, 3) || '—'}</span></p>
                                            <p className="text-gray-500 text-[10px] mt-0.5">If you declare this as Open number, below is the settlement summary. Total bet amount matches Market Detail (Open view).</p>
                                        </div>
                                        <div className="p-3 sm:p-4 space-y-3">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-gray-400 text-xs font-medium">Total Bet Amount (Open view)</span>
                                                <p className="text-[10px] text-gray-500">Same as Market Detail: Single Digit + Single/Double/Triple Pana + Half Sangam.</p>
                                                <span className="font-mono text-white bg-gray-800 px-2 py-1.5 rounded border border-gray-600 text-sm">₹{formatNum(preview.totalBetAmount)}</span>
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-gray-400 text-xs font-medium">Total win amount (payout)</span>
                                                <p className="text-[10px] text-gray-500">Amount to be paid to winning players if you declare this open number.</p>
                                                <span className="font-mono text-amber-300 bg-gray-800 px-2 py-1.5 rounded border border-gray-600 text-sm">₹{formatNum(preview.totalWinAmount)}</span>
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-gray-400 text-xs font-medium">No. of players</span>
                                                <p className="text-[10px] text-gray-500">Unique players who have open-settled bets in this market.</p>
                                                <span className="font-mono text-white bg-gray-800 px-2 py-1.5 rounded border border-gray-600 text-sm">{formatNum(preview.noOfPlayers)}</span>
                                            </div>
                                            <div className="flex flex-col gap-0.5 pt-2 border-t border-gray-600">
                                                <span className="text-gray-400 text-xs font-medium">House profit / loss</span>
                                                <p className="text-[10px] text-gray-500">Bet amount minus payout. Positive = house profit; negative = house pays more than collected.</p>
                                                {(() => {
                                                    const profit = Math.round((Number(preview.totalBetAmount) - Number(preview.totalWinAmount)) * 100) / 100;
                                                    return (
                                                        <span className={`font-mono font-semibold px-2 py-1.5 rounded border text-sm ${profit >= 0 ? 'text-green-400 bg-green-900/20 border-green-600/50' : 'text-red-300 bg-red-900/20 border-red-600/50'}`}>
                                                            {profit >= 0 ? '₹' : '−₹'}{formatNum(Math.abs(profit))} {profit >= 0 ? '(profit)' : '(loss)'}
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={handleDeclareOpen}
                                    disabled={declareLoading || openPatti.replace(/\D/g, '').length !== 3}
                                    className="w-full px-4 py-2.5 sm:py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-black font-semibold rounded-lg shadow-lg disabled:opacity-50 transition-all text-sm sm:text-base min-h-[44px] sm:min-h-[48px] touch-manipulation"
                                >
                                    {declareLoading ? 'Declaring...' : 'Declare Open'}
                                </button>
                            </div>

                            {/* Close Result section - only for main market when opening is set; Startline has no closing result */}
                            {selectedMarket.marketType !== 'startline' && selectedMarket.openingNumber && /^\d{3}$/.test(selectedMarket.openingNumber) && (
                                <div className="mb-4 sm:mb-6">
                                    <h3 className="text-xs sm:text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2 sm:mb-3">Close Result</h3>
                                    <div className="mb-2 sm:mb-3">
                                        <label className="block text-xs sm:text-sm font-medium text-gray-400 mb-1">Close Patti</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={closePatti}
                                            onChange={(e) => setClosePatti(e.target.value.replace(/\D/g, '').slice(0, 3))}
                                            placeholder="e.g. 456"
                                            className="w-full px-3 py-2.5 sm:py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-base sm:text-lg font-mono placeholder-gray-500 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 min-h-[44px] sm:min-h-[48px] touch-manipulation"
                                            maxLength={3}
                                        />
                                    </div>
                                    <div className="flex gap-2 mb-2 sm:mb-3">
                                        <button
                                            type="button"
                                            onClick={handleCheckClose}
                                            disabled={checkCloseLoading}
                                            className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg border border-gray-600 disabled:opacity-50 transition-colors text-sm sm:text-base min-h-[44px] sm:min-h-[48px] touch-manipulation"
                                        >
                                            {checkCloseLoading ? 'Checking...' : 'Check'}
                                        </button>
                                    </div>
                                    {(previewClose != null) && (
                                        <div className="mb-2 sm:mb-3 rounded-xl bg-gray-700/50 border border-amber-500/30 overflow-hidden shadow-inner">
                                            <div className="bg-amber-500/10 border-b border-amber-500/20 px-3 py-2">
                                                <p className="text-amber-400 font-semibold text-sm">Close preview: <span className="font-mono text-white">{closePatti.replace(/\D/g, '').slice(0, 3) || '—'}</span></p>
                                                <p className="text-gray-500 text-[10px] mt-0.5">If you declare this as Close number, below is the settlement summary. Total bet amount matches Market Detail (Closed view).</p>
                                            </div>
                                            <div className="p-3 sm:p-4 space-y-3">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-gray-400 text-xs font-medium">Total Bet Amount (Closed view)</span>
                                                    <p className="text-[10px] text-gray-500">Same as Market Detail: Jodi + Full Sangam.</p>
                                                    <span className="font-mono text-white bg-gray-800 px-2 py-1.5 rounded border border-gray-600 text-sm">₹{formatNum(previewClose.totalBetAmount)}</span>
                                                </div>
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-gray-400 text-xs font-medium">Total win amount (payout)</span>
                                                    <p className="text-[10px] text-gray-500">Amount to be paid to winning players if you declare this close number.</p>
                                                    <span className="font-mono text-amber-300 bg-gray-800 px-2 py-1.5 rounded border border-gray-600 text-sm">₹{formatNum(previewClose.totalWinAmount)}</span>
                                                </div>
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-gray-400 text-xs font-medium">No. of players</span>
                                                    <p className="text-[10px] text-gray-500">Unique players who have close-settled bets in this market.</p>
                                                    <span className="font-mono text-white bg-gray-800 px-2 py-1.5 rounded border border-gray-600 text-sm">{formatNum(previewClose.noOfPlayers)}</span>
                                                </div>
                                                <div className="flex flex-col gap-0.5 pt-2 border-t border-gray-600">
                                                    <span className="text-gray-400 text-xs font-medium">House profit / loss</span>
                                                    <p className="text-[10px] text-gray-500">Bet amount minus payout. Positive = house profit; negative = house pays more than collected.</p>
                                                    {(() => {
                                                        const profit = Math.round((Number(previewClose.totalBetAmount) - Number(previewClose.totalWinAmount)) * 100) / 100;
                                                        return (
                                                            <span className={`font-mono font-semibold px-2 py-1.5 rounded border text-sm ${profit >= 0 ? 'text-green-400 bg-green-900/20 border-green-600/50' : 'text-red-300 bg-red-900/20 border-red-600/50'}`}>
                                                                {profit >= 0 ? '₹' : '−₹'}{formatNum(Math.abs(profit))} {profit >= 0 ? '(profit)' : '(loss)'}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={handleDeclareClose}
                                        disabled={declareLoading || closePatti.replace(/\D/g, '').length !== 3}
                                        className="w-full px-4 py-2.5 sm:py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-black font-semibold rounded-lg shadow-lg disabled:opacity-50 transition-all text-sm sm:text-base min-h-[44px] sm:min-h-[48px] touch-manipulation"
                                    >
                                        {declareLoading ? 'Declaring...' : 'Declare Close'}
                                    </button>
                                </div>
                            )}

                            {(selectedMarket.openingNumber && /^\d{3}$/.test(selectedMarket.openingNumber)) ||
                             (selectedMarket.closingNumber && /^\d{3}$/.test(selectedMarket.closingNumber)) ? (
                                <button
                                    type="button"
                                    onClick={handleClearResult}
                                    disabled={clearLoading}
                                    className="mt-3 sm:mt-4 w-full px-4 py-2.5 sm:py-3 bg-red-900/80 hover:bg-red-800 text-red-100 font-semibold rounded-lg border border-red-700 disabled:opacity-50 transition-colors text-sm sm:text-base min-h-[44px] sm:min-h-[48px] touch-manipulation"
                                >
                                    {clearLoading ? 'Clearing...' : 'Clear Result'}
                                </button>
                            ) : null}
                            <button
                                type="button"
                                onClick={closePanel}
                                className="mt-3 sm:mt-4 w-full px-4 py-2.5 sm:py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg border border-gray-600 transition-colors text-sm sm:text-base min-h-[44px] sm:min-h-[48px] touch-manipulation"
                            >
                                Close
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
};

export default AddResult;
