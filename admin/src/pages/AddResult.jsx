import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { useRefreshOnMarketReset } from '../hooks/useRefreshOnMarketReset';
import { FaExclamationTriangle, FaChartBar, FaStar, FaCrown } from 'react-icons/fa';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const ADD_RESULT_TABS = [
    { id: 'regular', label: 'Regular Market', icon: FaChartBar },
    { id: 'starline', label: 'Starline Market', icon: FaStar },
    { id: 'king', label: 'King Bazaar Market', icon: FaCrown },
];

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
    const [activeTab, setActiveTab] = useState('regular');
    const [starlineMarkets, setStarlineMarkets] = useState([]);
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
                setStarlineMarkets(all.filter((m) => m.marketType === 'startline'));
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
        const type = (location.state?.marketType || '').toString().toLowerCase();
        if (type === 'starline' || type === 'king') setActiveTab(type);
    }, [location.state?.marketType]);

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
        if (val.length !== 3) {
            setPreview(null);
            return;
        }
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
        if (val.length !== 3) {
            setPreviewClose(null);
            return;
        }
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
            <div className="w-full min-w-0 px-3 sm:px-4 md:px-6 pb-6 sm:pb-8">
                {error && (
                    <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-xs sm:text-sm md:text-base">
                        {error}
                    </div>
                )}

                {activeTab === 'regular' && marketsPendingResult > 0 && !isDirectEditMode && (
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

                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 sm:mb-6 text-white text-center sm:text-left">
                    {isDirectEditMode ? 'Edit Result' : 'Declare Result'}
                </h1>

                {/* Top tabs: Regular | Starline | King Bazaar */}
                <div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
                    {ADD_RESULT_TABS.map((tab) => {
                        const isActive = activeTab === tab.id;
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`inline-flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl font-semibold text-sm sm:text-base transition-all ${
                                    isActive
                                        ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white border border-gray-600'
                                }`}
                            >
                                <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {activeTab === 'starline' && (
                    <div className="flex flex-col xl:flex-row gap-4 sm:gap-6">
                        <div className="flex-1 min-w-0 w-full">
                            {loading ? (
                                <div className="text-center py-8 sm:py-12 text-gray-400 text-xs sm:text-sm rounded-xl border border-gray-700 bg-gray-800/50">Loading Starline slots...</div>
                            ) : starlineMarkets.length === 0 ? (
                                <div className="rounded-2xl border border-amber-500/40 bg-gray-800/50 p-6 sm:p-8 text-center">
                                    <p className="text-gray-400 text-sm mb-4">No Starline slots yet. Add markets and slots from Markets → Starline Market.</p>
                                    <Link to="/markets" state={{ marketType: 'starline' }} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm">
                                        <FaStar className="w-4 h-4" /> Go to Starline Market
                                    </Link>
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-lg sm:rounded-xl border border-gray-700 bg-gray-800/80 shadow-lg">
                                    <table className="w-full border-collapse text-[11px] sm:text-xs md:text-sm min-w-[320px]">
                                        <thead>
                                            <tr className="border-b border-gray-700">
                                                <th className="text-left py-2 sm:py-3 px-3 font-semibold text-yellow-500 bg-gray-800">Slot</th>
                                                <th className="text-left py-2 sm:py-3 px-3 font-semibold text-yellow-500 bg-gray-800 border-l border-gray-700">Closes</th>
                                                <th className="text-left py-2 sm:py-3 px-3 font-semibold text-yellow-500 bg-gray-800 border-l border-gray-700">Result</th>
                                                <th className="text-left py-2 sm:py-3 px-3 font-semibold text-yellow-500 bg-gray-800 border-l border-gray-700">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {starlineMarkets.map((m) => {
                                                const hasOpen = m.openingNumber && /^\d{3}$/.test(String(m.openingNumber));
                                                const resultDisplay = m.displayResult || (hasOpen ? '—' : '*** - *');
                                                const isPending = marketsPendingResultList.some((p) => String(p._id) === String(m._id) || p.marketName === m.marketName);
                                                return (
                                                    <tr key={m._id} className={`border-b border-gray-700 hover:bg-gray-700/50 ${isPending ? 'bg-amber-500/5' : ''}`}>
                                                        <td className="py-2 sm:py-3 px-3 font-medium text-white truncate max-w-[180px]">
                                                            {isPending && <FaExclamationTriangle className="inline w-3.5 h-3.5 text-amber-400 mr-1.5 align-middle" />}
                                                            {m.marketName}
                                                        </td>
                                                        <td className="py-2 sm:py-3 px-3 text-gray-300 border-l border-gray-700 whitespace-nowrap">{formatTime(m.closingTime)}</td>
                                                        <td className="py-2 sm:py-3 px-3 border-l border-gray-700 font-mono text-amber-400">{resultDisplay}</td>
                                                        <td className="py-2 sm:py-3 px-3 border-l border-gray-700">
                                                            <button
                                                                type="button"
                                                                onClick={() => openPanelForEdit(m)}
                                                                className="px-2 sm:px-3 py-1.5 sm:py-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg text-xs sm:text-sm"
                                                            >
                                                                {hasOpen ? 'Edit result' : 'Add result'}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                        {selectedMarket?.marketType === 'startline' && (
                            <div className="w-full xl:w-[380px] xl:max-w-[400px] xl:shrink-0 bg-gray-800 rounded-xl border border-gray-700 shadow-xl p-4 sm:p-5 md:p-6">
                                <h2 className="text-lg sm:text-xl font-bold text-yellow-500 mb-2 border-b border-gray-700 pb-2 truncate" title={selectedMarket.marketName}>{selectedMarket.marketName}</h2>
                                <p className="text-[11px] text-gray-500 mb-3">Enter 3 digits → Check (preview) → Declare Open</p>
                                <div className="mb-3">
                                    <label className="block text-xs sm:text-sm font-medium text-gray-400 mb-1">Open Patti (3 digits)</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={openPatti}
                                        onChange={(e) => setOpenPatti(e.target.value.replace(/\D/g, '').slice(0, 3))}
                                        placeholder="e.g. 156"
                                        className="w-full px-3 py-2.5 sm:py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-lg font-mono min-h-[44px]"
                                        maxLength={3}
                                    />
                                </div>
                                <button type="button" onClick={handleCheckOpen} disabled={checkLoading || openPatti.replace(/\D/g, '').length !== 3} className="w-full mb-2 px-3 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg text-sm disabled:opacity-50" title={openPatti.replace(/\D/g, '').length !== 3 ? 'Enter 3 digits to check' : 'Preview impact before declaring'}>
                                    {checkLoading ? 'Checking...' : 'Check'}
                                </button>
                                {preview != null && (
                                    <div className="space-y-1.5 mb-3 rounded-lg bg-gray-700/50 border border-gray-600 p-2.5 text-xs">
                                        <div className="flex justify-between"><span className="text-gray-400">Total Bet</span><span className="font-mono text-white">{formatNum(preview.totalBetAmount)}</span></div>
                                        <div className="flex justify-between"><span className="text-gray-400">Total Win</span><span className="font-mono text-white">{formatNum(preview.totalWinAmount)}</span></div>
                                        <div className="flex justify-between"><span className="text-gray-400">Players</span><span className="font-mono text-white">{formatNum(preview.noOfPlayers)}</span></div>
                                        <div className="flex justify-between"><span className="text-gray-400">Profit</span><span className="font-mono text-amber-400">{formatNum(preview.profit)}</span></div>
                                    </div>
                                )}
                                <button type="button" onClick={handleDeclareOpen} disabled={declareLoading || openPatti.replace(/\D/g, '').length !== 3} className="w-full mb-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg text-sm disabled:opacity-50" title={openPatti.replace(/\D/g, '').length !== 3 ? 'Enter 3-digit Open Patti to declare' : 'Go to confirm & declare'}>
                                    {declareLoading ? 'Declaring...' : 'Declare Open'}
                                </button>
                                {(selectedMarket.openingNumber && /^\d{3}$/.test(String(selectedMarket.openingNumber))) && (
                                    <button type="button" onClick={handleClearResult} disabled={clearLoading} className="w-full mb-2 px-4 py-2.5 bg-red-900/80 hover:bg-red-800 text-red-100 font-semibold rounded-lg text-sm disabled:opacity-50">
                                        {clearLoading ? 'Clearing...' : 'Clear result'}
                                    </button>
                                )}
                                <button type="button" onClick={closePanel} className="w-full px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg text-sm">Close</button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'king' && (
                    <div className="rounded-2xl border border-gray-700 bg-gray-800/50 p-6 sm:p-8 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                            <FaCrown className="w-8 h-8 text-amber-400" />
                        </div>
                        <h2 className="text-lg font-bold text-white mb-2">King Bazaar Result</h2>
                        <p className="text-gray-500 text-sm max-w-md mx-auto">Declare King Bazaar results here. Configure as needed.</p>
                    </div>
                )}

                {activeTab === 'regular' && (
                <div className="flex flex-col xl:flex-row gap-4 sm:gap-6">
                    {/* Left: Market list - hidden in direct edit mode */}
                    {!isDirectEditMode && (
                    <div className="flex-1 min-w-0 w-full">
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
                                            <th className="text-left py-2 sm:py-3 px-1.5 sm:px-3 md:px-4 font-semibold text-yellow-500 bg-gray-800 border-l border-gray-700 whitespace-nowrap">Opening</th>
                                            <th className="text-left py-2 sm:py-3 px-1.5 sm:px-3 md:px-4 font-semibold text-yellow-500 bg-gray-800 border-l border-gray-700 whitespace-nowrap">Closing</th>
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
                                                            className="px-2 sm:px-3 py-1.5 sm:py-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg transition-colors text-xs sm:text-sm"
                                                        >
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
                    </div>
                    )}

                    {/* Right: Edit Result panel - Open & Close sections */}
                    {selectedMarket && (
                        <div className={`bg-gray-800 rounded-xl border border-gray-700 shadow-xl p-4 sm:p-5 md:p-6 ${isDirectEditMode ? 'w-full max-w-lg mx-auto' : 'w-full xl:w-[380px] xl:max-w-[400px] xl:shrink-0'}`}>
                            <h2 className="text-lg sm:text-xl font-bold text-yellow-500 mb-3 sm:mb-4 border-b border-gray-700 pb-2 truncate" title={selectedMarket.marketName}>
                                {selectedMarket.marketName}
                                {selectedMarket.marketType === 'startline' && (
                                    <span className="ml-2 inline-flex px-2 py-0.5 text-xs font-semibold rounded bg-amber-600/80 text-black align-middle">Startline</span>
                                )}
                            </h2>

                            {selectedMarket.marketType === 'startline' && (
                                <p className="text-xs text-gray-400 mb-3 p-2 rounded bg-gray-700/50 border border-amber-500/20">
                                    Startline has only one result (Open Digit/Patti). To update <strong>closing time</strong>, use Markets and edit the market.
                                </p>
                            )}

                            {/* Open Result section */}
                            <div className="mb-4 sm:mb-6">
                                <h3 className="text-xs sm:text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                    {selectedMarket.marketType === 'startline' ? 'Startline Result (Open Patti)' : 'Open Result'}
                                </h3>
                                <p className="text-[11px] text-gray-500 mb-2 sm:mb-3">Enter 3 digits → Check (preview) → Declare Open</p>
                                <div className="mb-2 sm:mb-3">
                                    <label className="block text-xs sm:text-sm font-medium text-gray-400 mb-1">Open Patti (3 digits)</label>
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
                                <div className="flex gap-2 mb-2 sm:mb-3">
                                    <button
                                        type="button"
                                        onClick={handleCheckOpen}
                                        disabled={checkLoading || openPatti.replace(/\D/g, '').length !== 3}
                                        className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg border border-gray-600 disabled:opacity-50 transition-colors text-sm sm:text-base"
                                        title={openPatti.replace(/\D/g, '').length !== 3 ? 'Enter 3-digit Open Patti to check' : 'Preview impact before declaring'}
                                    >
                                        {checkLoading ? 'Checking...' : 'Check'}
                                    </button>
                                </div>
                                {(preview != null) && (
                                    <div className="space-y-1.5 sm:space-y-2 mb-2 sm:mb-3 rounded-lg bg-gray-700/50 border border-gray-600 p-2.5 sm:p-3">
                                        <div className="flex justify-between items-center gap-2">
                                            <span className="text-gray-400 text-xs sm:text-sm shrink-0">Total Bet Amount</span>
                                            <span className="font-mono text-white bg-gray-700 px-2 py-1 rounded text-xs sm:text-sm truncate">{formatNum(preview.totalBetAmount)}</span>
                                        </div>
                                        <div className="flex justify-between items-center gap-2">
                                            <span className="text-gray-400 text-xs sm:text-sm shrink-0">Total Bet Amount on Patti</span>
                                            <span className="font-mono text-white bg-gray-700 px-2 py-1 rounded text-xs sm:text-sm truncate">{formatNum(preview.totalBetAmountOnPatti)}</span>
                                        </div>
                                        <div className="flex justify-between items-center gap-2">
                                            <span className="text-gray-400 text-xs sm:text-sm shrink-0">Total Win Amount</span>
                                            <span className="font-mono text-white bg-gray-700 px-2 py-1 rounded text-xs sm:text-sm truncate">{formatNum(preview.totalWinAmount)}</span>
                                        </div>
                                        <div className="flex justify-between items-center gap-2">
                                            <span className="text-gray-400 text-xs sm:text-sm shrink-0">Total Win Amount on Patti</span>
                                            <span className="font-mono text-white bg-gray-700 px-2 py-1 rounded text-xs sm:text-sm truncate">{formatNum(preview.totalWinAmountOnPatti)}</span>
                                        </div>
                                        <div className="flex justify-between items-center gap-2">
                                            <span className="text-gray-400 text-xs sm:text-sm shrink-0">No Of Players</span>
                                            <span className="font-mono text-white bg-gray-700 px-2 py-1 rounded text-xs sm:text-sm">{formatNum(preview.noOfPlayers)}</span>
                                        </div>
                                        <div className="flex justify-between items-center gap-2">
                                            <span className="text-gray-400 text-xs sm:text-sm shrink-0">Total Players Bet on Patti</span>
                                            <span className="font-mono text-white bg-gray-700 px-2 py-1 rounded text-xs sm:text-sm">{formatNum(preview.totalPlayersBetOnPatti)}</span>
                                        </div>
                                        <div className="flex justify-between items-center gap-2">
                                            <span className="text-gray-400 text-xs sm:text-sm shrink-0">Total Profit</span>
                                            <span className="font-mono text-yellow-400 bg-gray-700 px-2 py-1 rounded text-xs sm:text-sm truncate">{formatNum(preview.profit)}</span>
                                        </div>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={handleDeclareOpen}
                                    disabled={declareLoading || openPatti.replace(/\D/g, '').length !== 3}
                                    className="w-full px-4 py-2.5 sm:py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-black font-semibold rounded-lg shadow-lg disabled:opacity-50 transition-all text-sm sm:text-base"
                                >
                                    {declareLoading ? 'Declaring...' : 'Declare Open'}
                                </button>
                            </div>

                            {/* Close Result section */}
                            {selectedMarket.marketType !== 'startline' && selectedMarket.openingNumber && /^\d{3}$/.test(selectedMarket.openingNumber) && (
                                <div className="mb-4 sm:mb-6">
                                    <h3 className="text-xs sm:text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">Close Result</h3>
                                    <p className="text-[11px] text-gray-500 mb-2 sm:mb-3">Enter 3 digits → Check (preview) → Declare Close</p>
                                    <div className="mb-2 sm:mb-3">
                                        <label className="block text-xs sm:text-sm font-medium text-gray-400 mb-1">Close Patti (3 digits)</label>
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
                                    <div className="flex gap-2 mb-2 sm:mb-3">
                                        <button
                                            type="button"
                                            onClick={handleCheckClose}
                                            disabled={checkCloseLoading || closePatti.replace(/\D/g, '').length !== 3}
                                            className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg border border-gray-600 disabled:opacity-50 transition-colors text-sm sm:text-base"
                                            title={closePatti.replace(/\D/g, '').length !== 3 ? 'Enter 3-digit Close Patti to check' : 'Preview impact before declaring'}
                                        >
                                            {checkCloseLoading ? 'Checking...' : 'Check'}
                                        </button>
                                    </div>
                                    {(previewClose != null) && (
                                        <div className="space-y-1.5 sm:space-y-2 mb-2 sm:mb-3 rounded-lg bg-gray-700/50 border border-gray-600 p-2.5 sm:p-3">
                                            <div className="flex justify-between items-center gap-2">
                                                <span className="text-gray-400 text-xs sm:text-sm shrink-0">Total Bet Amount</span>
                                                <span className="font-mono text-white bg-gray-700 px-2 py-1 rounded text-xs sm:text-sm truncate">{formatNum(previewClose.totalBetAmount)}</span>
                                            </div>
                                            <div className="flex justify-between items-center gap-2">
                                                <span className="text-gray-400 text-xs sm:text-sm shrink-0">Total Bet Amount on Patti</span>
                                                <span className="font-mono text-white bg-gray-700 px-2 py-1 rounded text-xs sm:text-sm truncate">{formatNum(previewClose.totalBetAmountOnPatti)}</span>
                                            </div>
                                            <div className="flex justify-between items-center gap-2">
                                                <span className="text-gray-400 text-xs sm:text-sm shrink-0">Total Win Amount</span>
                                                <span className="font-mono text-white bg-gray-700 px-2 py-1 rounded text-xs sm:text-sm truncate">{formatNum(previewClose.totalWinAmount)}</span>
                                            </div>
                                            <div className="flex justify-between items-center gap-2">
                                                <span className="text-gray-400 text-xs sm:text-sm shrink-0">Total Win Amount on Patti</span>
                                                <span className="font-mono text-white bg-gray-700 px-2 py-1 rounded text-xs sm:text-sm truncate">{formatNum(previewClose.totalWinAmountOnPatti)}</span>
                                            </div>
                                            <div className="flex justify-between items-center gap-2">
                                                <span className="text-gray-400 text-xs sm:text-sm shrink-0">No Of Players</span>
                                                <span className="font-mono text-white bg-gray-700 px-2 py-1 rounded text-xs sm:text-sm">{formatNum(previewClose.noOfPlayers)}</span>
                                            </div>
                                            <div className="flex justify-between items-center gap-2">
                                                <span className="text-gray-400 text-xs sm:text-sm shrink-0">Total Players Bet on Patti</span>
                                                <span className="font-mono text-white bg-gray-700 px-2 py-1 rounded text-xs sm:text-sm">{formatNum(previewClose.totalPlayersBetOnPatti)}</span>
                                            </div>
                                            <div className="flex justify-between items-center gap-2">
                                                <span className="text-gray-400 text-xs sm:text-sm shrink-0">Total Profit</span>
                                                <span className="font-mono text-yellow-400 bg-gray-700 px-2 py-1 rounded text-xs sm:text-sm truncate">{formatNum(previewClose.profit)}</span>
                                            </div>
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={handleDeclareClose}
                                        disabled={declareLoading || closePatti.replace(/\D/g, '').length !== 3}
                                        className="w-full px-4 py-2.5 sm:py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-black font-semibold rounded-lg shadow-lg disabled:opacity-50 transition-all text-sm sm:text-base"
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
                                    className="mt-3 sm:mt-4 w-full px-4 py-2.5 sm:py-3 bg-red-900/80 hover:bg-red-800 text-red-100 font-semibold rounded-lg border border-red-700 disabled:opacity-50 transition-colors text-sm sm:text-base"
                                >
                                    {clearLoading ? 'Clearing...' : 'Clear Result'}
                                </button>
                            ) : null}
                            {isDirectEditMode ? (
                                <button
                                    type="button"
                                    onClick={closePanel}
                                    className="mt-3 sm:mt-4 w-full px-4 py-2.5 sm:py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg border border-gray-600 transition-colors text-sm sm:text-base"
                                >
                                    Close
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={closePanel}
                                    className="mt-3 sm:mt-4 w-full px-4 py-2.5 sm:py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg border border-gray-600 transition-colors text-sm sm:text-base"
                                >
                                    Close
                                </button>
                            )}
                        </div>
                    )}
                </div>
                )}
            </div>
        </AdminLayout>
    );
};

export default AddResult;
