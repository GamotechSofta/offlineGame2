import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { useRefreshOnMarketReset } from '../hooks/useRefreshOnMarketReset';
import { FaExclamationTriangle, FaSearch, FaCheckCircle, FaEdit2, FaArrowRight, FaInfoCircle } from 'react-icons/fa';

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
    const location = useLocation();
    const preselectedFromNav = location.state?.preselectedMarket;
    const [markets, setMarkets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedMarket, setSelectedMarket] = useState(() => preselectedFromNav || null);
    const [openPatti, setOpenPatti] = useState(() => (preselectedFromNav?.openingNumber ?? '').toString().replace(/\D/g, '').slice(0, 3));
    const [closePatti, setClosePatti] = useState(() => (preselectedFromNav?.closingNumber ?? '').toString().replace(/\D/g, '').slice(0, 3));
    const [preview, setPreview] = useState(null);
    const [previewClose, setPreviewClose] = useState(null);
    const [checkLoading, setCheckLoading] = useState(false);
    const [checkCloseLoading, setCheckCloseLoading] = useState(false);
    const [declareLoading, setDeclareLoading] = useState(false);
    const [clearLoading, setClearLoading] = useState(false);
    const [marketsPendingResult, setMarketsPendingResult] = useState(0);
    const [marketsPendingResultList, setMarketsPendingResultList] = useState([]);
    const [isDirectEditMode, setIsDirectEditMode] = useState(() => !!(preselectedFromNav?._id));
    const navigate = useNavigate();

    const getAuthHeaders = () => {
        const admin = JSON.parse(localStorage.getItem('admin') || '{}');
        const password = sessionStorage.getItem('adminPassword') || '';
        return {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${btoa(`${admin.username}:${password}`)}`,
        };
    };

    const fetchMarketsPendingResult = async () => {
        try {
            const d = new Date();
            const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const res = await fetch(`${API_BASE_URL}/dashboard/stats?from=${from}&to=${from}`, {
                headers: getAuthHeaders(),
            });
            const data = await res.json();
            if (data.success && data.data) {
                setMarketsPendingResult(data.data.marketsPendingResult || 0);
                setMarketsPendingResultList(data.data.marketsPendingResultList || []);
            }
        } catch (_) {
            setMarketsPendingResult(0);
            setMarketsPendingResultList([]);
        }
    };

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

    useEffect(() => {
        const admin = localStorage.getItem('admin');
        if (!admin) {
            navigate('/');
            return;
        }
        fetchMarkets();
        fetchMarketsPendingResult();
    }, [navigate]);

    useEffect(() => {
        if (!preselectedFromNav?._id) return;
        navigate('/add-result', { replace: true, state: {} });
    }, [preselectedFromNav?._id, navigate]);

    useRefreshOnMarketReset(() => {
        fetchMarkets();
        fetchMarketsPendingResult();
    });

    const handleLogout = () => {
        localStorage.removeItem('admin');
        sessionStorage.removeItem('adminPassword');
        navigate('/');
    };

    const openPanelForEdit = (market) => {
        setSelectedMarket(market);
        setOpenPatti(market.openingNumber || '');
        setClosePatti(market.closingNumber || '');
        setPreview(null);
        setPreviewClose(null);
    };

    const closePanel = () => {
        setIsDirectEditMode(false);
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
            const previewRes = await fetch(`${API_BASE_URL}/markets/preview-declare-open/${encodeURIComponent(marketId)}?openingNumber=${encodeURIComponent(val)}`, { headers });
            const previewData = await previewRes.json();
            if (previewData.success && previewData.data != null) {
                const totalBetAmount = safeNum(previewData.data.totalBetAmount);
                const totalWinAmount = safeNum(previewData.data.totalWinAmount);
                const totalBetAmountOnPatti = safeNum(previewData.data.totalBetAmountOnPatti);
                const totalWinAmountOnPatti = safeNum(previewData.data.totalWinAmountOnPatti);
                const totalPlayersBetOnPatti = safeNum(previewData.data.totalPlayersBetOnPatti);
                setPreview({
                    totalBetAmount,
                    totalWinAmount,
                    totalBetAmountOnPatti,
                    totalWinAmountOnPatti,
                    noOfPlayers: safeNum(previewData.data.noOfPlayers),
                    totalPlayersBetOnPatti,
                    profit: safeNum(previewData.data.profit),
                });
            } else {
                setPreview({
                    totalBetAmount: 0,
                    totalWinAmount: 0,
                    totalBetAmountOnPatti: 0,
                    totalWinAmountOnPatti: 0,
                    noOfPlayers: 0,
                    totalPlayersBetOnPatti: 0,
                    profit: 0,
                });
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
            const url = `${API_BASE_URL}/markets/preview-declare-close/${encodeURIComponent(marketId)}?closingNumber=${encodeURIComponent(val)}`;
            const res = await fetch(url, { headers });
            const data = await res.json();
            if (data.success && data.data != null) {
                setPreviewClose({
                    totalBetAmount: safeNum(data.data.totalBetAmount),
                    totalWinAmount: safeNum(data.data.totalWinAmount),
                    totalBetAmountOnPatti: safeNum(data.data.totalBetAmountOnPatti),
                    totalWinAmountOnPatti: safeNum(data.data.totalWinAmountOnPatti),
                    noOfPlayers: safeNum(data.data.noOfPlayers),
                    totalPlayersBetOnPatti: safeNum(data.data.totalPlayersBetOnPatti),
                    profit: safeNum(data.data.profit),
                });
            } else {
                setPreviewClose({
                    totalBetAmount: 0,
                    totalWinAmount: 0,
                    totalBetAmountOnPatti: 0,
                    totalWinAmountOnPatti: 0,
                    noOfPlayers: 0,
                    totalPlayersBetOnPatti: 0,
                    profit: 0,
                });
            }
        } catch (err) {
            setPreviewClose(null);
        } finally {
            setCheckCloseLoading(false);
        }
    };

    const handleDeclareOpen = () => {
        if (!selectedMarket) return;
        const val = openPatti.replace(/\D/g, '').slice(0, 3);
        if (val.length !== 3) {
            alert('Please enter a 3-digit Open Patti.');
            return;
        }
        navigate('/declare-confirm', { state: { market: selectedMarket, declareType: 'open', number: val } });
    };

    const handleDeclareClose = () => {
        if (!selectedMarket) return;
        const val = closePatti.replace(/\D/g, '').slice(0, 3);
        if (val.length !== 3) {
            alert('Please enter a 3-digit Close Patti.');
            return;
        }
        navigate('/declare-confirm', { state: { market: selectedMarket, declareType: 'close', number: val } });
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
            <div className="w-full min-w-0 max-w-full overflow-x-hidden px-2 sm:px-4 md:px-6 pb-4 sm:pb-6 md:pb-8">
                {error && (
                    <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-xs sm:text-sm md:text-base">
                        {error}
                    </div>
                )}

                {marketsPendingResult > 0 && !isDirectEditMode && (
                    <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-amber-500/10 border border-amber-500/40 rounded-lg overflow-hidden">
                        <h3 className="text-xs sm:text-sm font-semibold text-amber-400 flex items-center gap-2 mb-2 flex-wrap">
                            <FaExclamationTriangle className="w-4 h-4 shrink-0" />
                            Result declaration pending
                        </h3>
                        <p className="text-amber-200/90 text-xs sm:text-sm break-words">
                            {marketsPendingResult} market{marketsPendingResult !== 1 ? 's' : ''} need{marketsPendingResult === 1 ? 's' : ''} result declaration: {marketsPendingResultList.map((m) => m.marketName).join(', ')}
                        </p>
                        <p className="text-amber-200/70 text-[11px] sm:text-xs mt-2">
                            Betting has closed for these markets. Declare the result below to settle bets.
                        </p>
                    </div>
                )}

                <div className="mb-4 sm:mb-6">
                    <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white text-center sm:text-left break-words">
                        {isDirectEditMode ? 'Edit Result' : 'Declare Result'}
                    </h1>
                    <p className="mt-1 text-xs sm:text-sm text-gray-400 text-center sm:text-left">
                        {isDirectEditMode
                            ? 'Enter the result numbers below, check the impact, then declare.'
                            : 'Select a market from the list, enter the result, check impact, then declare.'}
                    </p>
                </div>

                <div className="flex flex-col xl:flex-row gap-4 sm:gap-6">
                    {/* Left: Market list - hidden in direct edit mode */}
                    {!isDirectEditMode && (
                    <div className="flex-1 min-w-0 w-full overflow-hidden">
                        <h2 className="text-sm sm:text-base md:text-lg font-semibold text-gray-300 mb-2 sm:mb-3 flex items-center gap-2 flex-wrap">
                            <FaEdit2 className="text-amber-500 w-4 h-4 shrink-0" />
                            Step 1: Select market
                            {markets.length > 0 && (
                                <span className="text-[11px] sm:text-xs font-normal text-gray-500">({markets.length} market{markets.length !== 1 ? 's' : ''})</span>
                            )}
                        </h2>
                        {loading ? (
                            <div className="text-center py-8 sm:py-12 text-gray-400 text-xs sm:text-sm md:text-base rounded-xl border border-gray-700 bg-gray-800/50">Loading markets...</div>
                        ) : markets.length === 0 ? (
                            <div className="text-center py-8 sm:py-12 text-gray-400 text-xs sm:text-sm md:text-base rounded-xl border border-gray-700 bg-gray-800/50">No markets found.</div>
                        ) : (
                            <div className="overflow-x-auto -mx-2 sm:mx-0 rounded-lg sm:rounded-xl border border-gray-700 bg-gray-800/80 shadow-lg overscroll-x-contain touch-pan-x">
                                <table className="w-full border-collapse text-[11px] sm:text-xs md:text-sm lg:text-base min-w-[380px] sm:min-w-[520px]">
                                    <thead>
                                        <tr className="border-b border-gray-700">
                                            <th className="text-left py-2 sm:py-3 px-1.5 sm:px-3 md:px-4 font-semibold text-yellow-500 bg-gray-800 whitespace-nowrap">Market</th>
                                            <th className="text-left py-2 sm:py-3 px-1.5 sm:px-3 md:px-4 font-semibold text-yellow-500 bg-gray-800 border-l border-gray-700 whitespace-nowrap">Timeline</th>
                                            <th className="text-left py-2 sm:py-3 px-1.5 sm:px-3 md:px-4 font-semibold text-yellow-500 bg-gray-800 border-l border-gray-700 whitespace-nowrap min-w-[4rem] sm:min-w-[5rem] md:min-w-[6.5rem]">Result</th>
                                            <th className="text-left py-2 sm:py-3 px-1.5 sm:px-3 md:px-4 font-semibold text-yellow-500 bg-gray-800 border-l border-gray-700 whitespace-nowrap">Open</th>
                                            <th className="text-left py-2 sm:py-3 px-1.5 sm:px-3 md:px-4 font-semibold text-yellow-500 bg-gray-800 border-l border-gray-700 whitespace-nowrap">Close</th>
                                            <th className="text-left py-2 sm:py-3 px-1.5 sm:px-3 md:px-4 font-semibold text-yellow-500 bg-gray-800 border-l border-gray-700 whitespace-nowrap min-w-[4.5rem] sm:min-w-[5.5rem] md:min-w-[6.5rem]">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {markets.map((market) => {
                                            const isStartline = market.marketType === 'startline';
                                            const hasOpen = market.openingNumber && /^\d{3}$/.test(market.openingNumber);
                                            const hasClose = market.closingNumber && /^\d{3}$/.test(market.closingNumber);
                                            const isClosed = isStartline ? hasOpen : (hasOpen && hasClose);
                                            const isPendingResult = marketsPendingResultList.some((m) => String(m._id) === String(market._id) || m.marketName === market.marketName);
                                            const timeline = isStartline ? `Closes ${formatTime(market.closingTime)}` : `${formatTime(market.startingTime)} - ${formatTime(market.closingTime)}`;
                                            const resultDisplay = market.displayResult || (isStartline ? '*** - *' : '***-**-***');
                                            return (
                                                <tr key={market._id} className={`border-b border-gray-700 hover:bg-gray-700/50 ${isPendingResult ? 'bg-amber-500/5' : ''}`}>
                                                    <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-4 font-medium text-white whitespace-nowrap min-w-0 max-w-[110px] sm:max-w-[180px] md:max-w-none">
                                                        <div className="flex flex-wrap items-center gap-1.5 truncate">
                                                            {isPendingResult && (
                                                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/30 text-amber-400 shrink-0" title="Result declaration pending">
                                                                    <FaExclamationTriangle className="w-3 h-3" />
                                                                </span>
                                                            )}
                                                            {market.marketName}
                                                            {isStartline && (
                                                                <span className="inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-600/80 text-black">Startline</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-4 text-gray-300 border-l border-gray-700 whitespace-nowrap text-[10px] sm:text-xs md:text-sm">{timeline}</td>
                                                    <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-4 border-l border-gray-700 min-w-[4rem] sm:min-w-[5rem] md:min-w-[6.5rem]">
                                                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 sm:gap-x-2">
                                                            <span className="font-mono text-amber-400 text-[10px] sm:text-xs md:text-sm">{resultDisplay}</span>
                                                            {isClosed && (
                                                                <span className="inline-flex shrink-0 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-semibold rounded-full bg-red-600 text-white">Closed</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-4 border-l border-gray-700">
                                                        {hasOpen ? <span className="font-mono text-yellow-400 text-[10px] sm:text-xs md:text-sm">{market.openingNumber}</span> : <span className="text-gray-500">—</span>}
                                                    </td>
                                                    <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-4 border-l border-gray-700">
                                                        {isStartline ? <span className="text-gray-500">N/A</span> : (hasClose ? <span className="font-mono text-yellow-400 text-[10px] sm:text-xs md:text-sm">{market.closingNumber}</span> : <span className="text-gray-500">—</span>)}
                                                    </td>
                                                    <td className="py-2 sm:py-3 px-1.5 sm:px-3 md:px-4 border-l border-gray-700 min-w-[4.5rem] sm:min-w-[5.5rem] md:min-w-[6.5rem]">
                                                        <button
                                                            type="button"
                                                            onClick={() => openPanelForEdit(market)}
                                                            className="inline-flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-2 sm:py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg transition-colors text-[10px] sm:text-xs md:text-sm min-h-[36px] sm:min-h-[40px] touch-manipulation whitespace-nowrap"
                                                        >
                                                            <FaEdit2 className="w-3.5 h-3.5 shrink-0" />
                                                            Edit Result
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {!loading && markets.length > 0 && (
                            <p className="mt-2 text-[11px] sm:text-xs text-gray-500 flex items-center gap-1.5 flex-wrap">
                                <FaInfoCircle className="w-3.5 h-3.5 shrink-0 flex-shrink-0" />
                                <span>Click <strong>Edit Result</strong> on any market to open the declare form.</span>
                            </p>
                        )}
                    </div>
                    )}

                    {/* Right: Edit Result panel - Open & Close sections */}
                    {selectedMarket && (
                        <div className={`bg-gray-800 rounded-xl border border-gray-700 shadow-xl p-3 sm:p-5 md:p-6 w-full min-w-0 ${isDirectEditMode ? 'max-w-lg mx-auto' : 'xl:w-[380px] xl:max-w-[400px] xl:shrink-0'}`}>
                            <h2 className="text-base sm:text-lg md:text-xl font-bold text-yellow-500 mb-1 sm:mb-2 truncate" title={selectedMarket.marketName}>
                                {selectedMarket.marketName}
                                {selectedMarket.marketType === 'startline' && (
                                    <span className="ml-2 inline-flex px-2 py-0.5 text-xs font-semibold rounded bg-amber-600/80 text-black align-middle">Startline</span>
                                )}
                            </h2>
                            <p className="text-xs text-gray-500 mb-3 sm:mb-4 pb-3 border-b border-gray-700">
                                {isDirectEditMode ? 'Step 2: Enter result → Check → Declare' : 'Step 2 & 3: Enter result, check impact, then declare'}
                            </p>

                            {selectedMarket.marketType === 'startline' && (
                                <p className="text-xs text-gray-400 mb-3 p-2 rounded bg-gray-700/50 border border-amber-500/20 flex items-start gap-2">
                                    <FaInfoCircle className="mt-0.5 shrink-0 text-amber-400" />
                                    <span>Startline has only one result (Open Patti). To update closing time, edit the market from Markets.</span>
                                </p>
                            )}

                            {/* Open Result section — for Startline this is the only result */}
                            <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl bg-gray-700/30 border border-gray-600/50">
                                <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/30 text-amber-400 text-xs font-bold">1</span>
                                    {selectedMarket.marketType === 'startline' ? 'Startline Result (Open Patti)' : 'Open Result'}
                                </h3>
                                <div className="mb-3">
                                    <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5">Enter 3-digit Open Patti</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={openPatti}
                                        onChange={(e) => setOpenPatti(e.target.value.replace(/\D/g, '').slice(0, 3))}
                                        placeholder="e.g. 156"
                                        className="w-full px-3 py-2.5 sm:py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-lg sm:text-xl font-mono placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 min-h-[44px] sm:min-h-[48px] touch-manipulation"
                                        maxLength={3}
                                    />
                                </div>
                                <div className="flex gap-2 mb-3">
                                    <button
                                        type="button"
                                        onClick={handleCheckOpen}
                                        disabled={checkLoading || openPatti.replace(/\D/g, '').length !== 3}
                                        className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg border border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm sm:text-base min-h-[44px] sm:min-h-[48px] touch-manipulation flex items-center justify-center gap-2"
                                    >
                                        <FaSearch className="w-4 h-4 shrink-0" />
                                        {checkLoading ? 'Checking...' : 'Preview Impact'}
                                    </button>
                                </div>
                                {(preview != null) && (
                                    <div className="space-y-2 mb-3 rounded-lg bg-gray-800/80 border border-gray-600 p-2.5 sm:p-3 min-w-0 overflow-hidden">
                                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-600">
                                            <FaCheckCircle className="text-green-400 w-4 h-4 shrink-0" />
                                            <span className="text-[11px] sm:text-xs font-semibold text-gray-300 uppercase">Preview</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-x-2 sm:gap-x-4 gap-y-1.5 sm:gap-y-2 text-[11px] sm:text-xs md:text-sm min-w-0">
                                            <div className="text-gray-400 truncate pr-1">Total Bet</div>
                                            <div className="font-mono text-white text-right truncate">{formatNum(preview.totalBetAmount)}</div>
                                            <div className="text-gray-400 truncate pr-1">Bet on Patti</div>
                                            <div className="font-mono text-white text-right truncate">{formatNum(preview.totalBetAmountOnPatti)}</div>
                                            <div className="text-gray-400 truncate pr-1">Total Win</div>
                                            <div className="font-mono text-white text-right truncate">{formatNum(preview.totalWinAmount)}</div>
                                            <div className="text-gray-400 truncate pr-1">Win on Patti</div>
                                            <div className="font-mono text-white text-right truncate">{formatNum(preview.totalWinAmountOnPatti)}</div>
                                            <div className="text-gray-400 truncate pr-1">Players</div>
                                            <div className="font-mono text-white text-right truncate">{formatNum(preview.noOfPlayers)}</div>
                                            <div className="text-gray-400 truncate pr-1">On Patti</div>
                                            <div className="font-mono text-white text-right truncate">{formatNum(preview.totalPlayersBetOnPatti)}</div>
                                        </div>
                                        <div className="flex justify-between items-center pt-2 mt-2 border-t border-gray-600 gap-2 min-w-0">
                                            <span className="text-xs sm:text-sm font-semibold text-gray-300 shrink-0">Profit</span>
                                            <span className="font-mono text-sm sm:text-base font-bold text-amber-400 truncate">{formatNum(preview.profit)}</span>
                                        </div>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={handleDeclareOpen}
                                    disabled={declareLoading || openPatti.replace(/\D/g, '').length !== 3}
                                    className="w-full px-4 py-2.5 sm:py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-black font-bold rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm sm:text-base min-h-[44px] sm:min-h-[48px] touch-manipulation flex items-center justify-center gap-2"
                                >
                                    {declareLoading ? 'Declaring...' : 'Declare Open'}
                                    <FaArrowRight className="w-4 h-4 shrink-0" />
                                </button>
                            </div>

                            {/* Close Result section - only for main market when opening is set; Startline has no closing result */}
                            {selectedMarket.marketType !== 'startline' && selectedMarket.openingNumber && /^\d{3}$/.test(selectedMarket.openingNumber) && (
                                <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl bg-gray-700/30 border border-gray-600/50">
                                    <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
                                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/30 text-amber-400 text-xs font-bold">2</span>
                                        Close Result
                                    </h3>
                                    <p className="text-xs text-gray-500 mb-3">Open is already declared. Now declare the 3-digit Close Patti.</p>
                                    <div className="mb-3">
                                        <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5">Enter 3-digit Close Patti</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={closePatti}
                                            onChange={(e) => setClosePatti(e.target.value.replace(/\D/g, '').slice(0, 3))}
                                            placeholder="e.g. 456"
                                            className="w-full px-3 py-2.5 sm:py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-lg sm:text-xl font-mono placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 min-h-[44px] sm:min-h-[48px] touch-manipulation"
                                            maxLength={3}
                                        />
                                    </div>
                                    <div className="flex gap-2 mb-3">
                                        <button
                                            type="button"
                                            onClick={handleCheckClose}
                                            disabled={checkCloseLoading || closePatti.replace(/\D/g, '').length !== 3}
                                            className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg border border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm sm:text-base min-h-[44px] sm:min-h-[48px] touch-manipulation flex items-center justify-center gap-2"
                                        >
                                            <FaSearch className="w-4 h-4 shrink-0" />
                                            {checkCloseLoading ? 'Checking...' : 'Preview Impact'}
                                        </button>
                                    </div>
                                    {(previewClose != null) && (
                                        <div className="space-y-2 mb-3 rounded-lg bg-gray-800/80 border border-gray-600 p-2.5 sm:p-3 min-w-0 overflow-hidden">
                                            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-600">
                                                <FaCheckCircle className="text-green-400 w-4 h-4 shrink-0" />
                                                <span className="text-[11px] sm:text-xs font-semibold text-gray-300 uppercase">Preview</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-x-2 sm:gap-x-4 gap-y-1.5 sm:gap-y-2 text-[11px] sm:text-xs md:text-sm min-w-0">
                                                <div className="text-gray-400 truncate pr-1">Total Bet</div>
                                                <div className="font-mono text-white text-right truncate">{formatNum(previewClose.totalBetAmount)}</div>
                                                <div className="text-gray-400 truncate pr-1">Bet on Patti</div>
                                                <div className="font-mono text-white text-right truncate">{formatNum(previewClose.totalBetAmountOnPatti)}</div>
                                                <div className="text-gray-400 truncate pr-1">Total Win</div>
                                                <div className="font-mono text-white text-right truncate">{formatNum(previewClose.totalWinAmount)}</div>
                                                <div className="text-gray-400 truncate pr-1">Win on Patti</div>
                                                <div className="font-mono text-white text-right truncate">{formatNum(previewClose.totalWinAmountOnPatti)}</div>
                                                <div className="text-gray-400 truncate pr-1">Players</div>
                                                <div className="font-mono text-white text-right truncate">{formatNum(previewClose.noOfPlayers)}</div>
                                                <div className="text-gray-400 truncate pr-1">On Patti</div>
                                                <div className="font-mono text-white text-right truncate">{formatNum(previewClose.totalPlayersBetOnPatti)}</div>
                                            </div>
                                            <div className="flex justify-between items-center pt-2 mt-2 border-t border-gray-600 gap-2 min-w-0">
                                                <span className="text-xs sm:text-sm font-semibold text-gray-300 shrink-0">Profit</span>
                                                <span className="font-mono text-sm sm:text-base font-bold text-amber-400 truncate">{formatNum(previewClose.profit)}</span>
                                            </div>
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={handleDeclareClose}
                                        disabled={declareLoading || closePatti.replace(/\D/g, '').length !== 3}
                                        className="w-full px-4 py-2.5 sm:py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-black font-bold rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm sm:text-base min-h-[44px] sm:min-h-[48px] touch-manipulation flex items-center justify-center gap-2"
                                    >
                                        {declareLoading ? 'Declaring...' : 'Declare Close'}
                                        <FaArrowRight className="w-4 h-4 shrink-0" />
                                    </button>
                                </div>
                            )}

                            <div className="space-y-2 pt-2 border-t border-gray-700">
                                {(selectedMarket.openingNumber && /^\d{3}$/.test(selectedMarket.openingNumber)) ||
                                 (selectedMarket.closingNumber && /^\d{3}$/.test(selectedMarket.closingNumber)) ? (
                                    <button
                                        type="button"
                                        onClick={handleClearResult}
                                        disabled={clearLoading}
                                        className="w-full px-4 py-2.5 sm:py-3 bg-red-900/60 hover:bg-red-800/80 text-red-200 font-semibold rounded-lg border border-red-700/60 disabled:opacity-50 transition-colors text-sm sm:text-base min-h-[40px] sm:min-h-[44px] touch-manipulation"
                                    >
                                        {clearLoading ? 'Clearing...' : 'Clear Result (Reset)'}
                                    </button>
                                ) : null}
                                {isDirectEditMode ? (
                                    <Link
                                        to={`/markets/${selectedMarket._id}`}
                                        className="w-full inline-block text-center px-4 py-2.5 sm:py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg border border-gray-600 transition-colors text-sm sm:text-base min-h-[40px] sm:min-h-[44px] touch-manipulation"
                                    >
                                        ← Back to Market Overview
                                    </Link>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={closePanel}
                                        className="w-full px-4 py-2.5 sm:py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg border border-gray-600 transition-colors text-sm sm:text-base min-h-[40px] sm:min-h-[44px] touch-manipulation"
                                    >
                                        ← Close panel
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
};

export default AddResult;
