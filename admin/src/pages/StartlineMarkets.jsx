import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import MarketForm from '../components/MarketForm';
import StartlineMarketList from '../components/StartlineMarketList';
import { useRefreshOnMarketReset } from '../hooks/useRefreshOnMarketReset';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const safeNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const parts = String(timeStr).split(':');
    const h = parseInt(parts[0], 10);
    const m = parts[1] ? String(parseInt(parts[1], 10)).padStart(2, '0') : '00';
    return `${Number.isFinite(h) ? h : ''}:${m}`;
};

// Add Starline Market: 12h time -> 24h "HH:MM"
const to24Hour = (hour12, minute, ampm) => {
    let h = parseInt(hour12, 10) || 12;
    const m = String(parseInt(minute, 10) || 0).padStart(2, '0').slice(0, 2);
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}`;
};
// 24h "HH:MM" -> display "10:00 PM" for market name
const toDisplayTime = (hour12, minute, ampm) => {
    const h = parseInt(hour12, 10) || 12;
    const m = String(parseInt(minute, 10) || 0).padStart(2, '0').slice(0, 2);
    const ampmStr = ampm === 'PM' ? 'PM' : 'AM';
    const h12 = h === 12 ? 12 : h % 12;
    return `${h12}:${m} ${ampmStr}`;
};
const HOURS_12 = ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

const StartlineMarkets = () => {
    const [markets, setMarkets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingMarket, setEditingMarket] = useState(null);
    const [error, setError] = useState('');
    const [seedLoading, setSeedLoading] = useState(false);
    const [selectedResultMarket, setSelectedResultMarket] = useState(null);
    const [openPatti, setOpenPatti] = useState('');
    const [preview, setPreview] = useState(null);
    const [checkLoading, setCheckLoading] = useState(false);
    const [declareLoading, setDeclareLoading] = useState(false);
    const [clearLoading, setClearLoading] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [secretPassword, setSecretPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [hasSecretDeclarePassword, setHasSecretDeclarePassword] = useState(false);
    const [showAddStarlineForm, setShowAddStarlineForm] = useState(false);
    const [addFormTime, setAddFormTime] = useState({ hour12: '10', minute: '00', ampm: 'PM' });
    const [addFormBetClosure, setAddFormBetClosure] = useState('');
    const [addFormLoading, setAddFormLoading] = useState(false);
    const [addFormError, setAddFormError] = useState('');
    const [deleteMarket, setDeleteMarket] = useState(null);
    const [showDeletePasswordModal, setShowDeletePasswordModal] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deletePasswordError, setDeletePasswordError] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        fetch(`${API_BASE_URL}/admin/me/secret-declare-password-status`, { headers: getAuthHeaders() })
            .then((res) => res.json())
            .then((json) => {
                if (json.success) setHasSecretDeclarePassword(json.hasSecretDeclarePassword || false);
            })
            .catch(() => setHasSecretDeclarePassword(false));
    }, []);

    const startlineMarkets = useMemo(() => {
        const list = (markets || []).filter((m) => m.marketType === 'startline');
        return list.sort((a, b) => {
            const tA = (a.startingTime || a.closingTime || '').toString().trim().slice(0, 5);
            const tB = (b.startingTime || b.closingTime || '').toString().trim().slice(0, 5);
            return String(tA).localeCompare(String(tB), undefined, { numeric: true });
        });
    }, [markets]);

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

    useEffect(() => {
        const admin = localStorage.getItem('admin');
        if (!admin) {
            navigate('/');
            return;
        }
        fetchMarkets();
    }, [navigate]);

    useRefreshOnMarketReset(fetchMarkets);

    const handleLogout = () => {
        localStorage.removeItem('admin');
        sessionStorage.removeItem('adminPassword');
        navigate('/');
    };

    const handleEdit = (market) => {
        setEditingMarket(market);
        setShowForm(true);
    };

    const handleFormClose = () => {
        setShowForm(false);
        setEditingMarket(null);
        fetchMarkets();
    };

    const handleAddStarlineSubmit = async (e) => {
        e.preventDefault();
        setAddFormError('');
        setAddFormLoading(true);
        try {
            const time24 = to24Hour(addFormTime.hour12, addFormTime.minute, addFormTime.ampm);
            const marketName = `STARLINE ${toDisplayTime(addFormTime.hour12, addFormTime.minute, addFormTime.ampm)}`;
            const payload = {
                marketName,
                startingTime: time24,
                closingTime: time24,
                marketType: 'startline',
            };
            if (addFormBetClosure !== '' && addFormBetClosure != null) {
                const sec = Number(addFormBetClosure);
                if (Number.isFinite(sec) && sec >= 0) payload.betClosureTime = sec;
            }
            const res = await fetch(`${API_BASE_URL}/markets/create-market`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.success) {
                setShowAddStarlineForm(false);
                setAddFormTime({ hour12: '10', minute: '00', ampm: 'PM' });
                setAddFormBetClosure('');
                fetchMarkets();
            } else {
                setAddFormError(data.message || 'Failed to create market');
            }
        } catch (err) {
            setAddFormError('Network error.');
        } finally {
            setAddFormLoading(false);
        }
    };

    const getAuthHeaders = () => {
        const admin = JSON.parse(localStorage.getItem('admin') || '{}');
        const password = sessionStorage.getItem('adminPassword') || '';
        return {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${btoa(`${admin.username}:${password}`)}`,
        };
    };

    const performDeleteMarket = async (secretDeclarePasswordValue, marketToDelete = null) => {
        const target = marketToDelete || deleteMarket;
        if (!target) return;
        const marketId = target._id ?? target.id;
        if (!marketId) return;
        setDeleteLoading(true);
        setDeletePasswordError('');
        try {
            const body = secretDeclarePasswordValue ? { secretDeclarePassword: secretDeclarePasswordValue } : {};
            const res = await fetch(`${API_BASE_URL}/markets/delete-market/${encodeURIComponent(marketId)}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (data.success) {
                setDeleteMarket(null);
                setShowDeletePasswordModal(false);
                setDeletePassword('');
                setSelectedResultMarket((prev) => (prev && (String(prev._id) === String(marketId) || String(prev.id) === String(marketId))) ? null : prev);
                fetchMarkets();
            } else {
                if (data.code === 'INVALID_SECRET_DECLARE_PASSWORD' || res.status === 403) {
                    setDeletePasswordError(data.message || 'Invalid secret password');
                } else {
                    alert(data.message || 'Failed to delete market');
                }
            }
        } catch {
            alert('Network error');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleDelete = (market) => {
        if (!window.confirm(`Delete Starline market "${market.marketName}"? This cannot be undone.`)) return;
        setDeleteMarket(market);
        setDeletePassword('');
        setDeletePasswordError('');
        if (hasSecretDeclarePassword) {
            setShowDeletePasswordModal(true);
        } else {
            performDeleteMarket('', market);
        }
    };

    const handleDeletePasswordSubmit = (e) => {
        e.preventDefault();
        if (hasSecretDeclarePassword && !deletePassword.trim()) {
            setDeletePasswordError('Please enter the secret declare password');
            return;
        }
        performDeleteMarket(deletePassword.trim(), deleteMarket);
    };

    const handleSeedStartline = async () => {
        setSeedLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE_URL}/markets/seed-startline`, {
                method: 'POST',
                headers: getAuthHeaders(),
            });
            const data = await res.json();
            if (data.success) {
                fetchMarkets();
            } else {
                setError(data.message || 'Failed to create startline markets');
            }
        } catch (err) {
            setError('Network error.');
        } finally {
            setSeedLoading(false);
        }
    };

    const openResultPanel = (market) => {
        setSelectedResultMarket(market);
        setOpenPatti(market.openingNumber || '');
        setPreview(null);
    };
    const closeResultPanel = () => {
        setSelectedResultMarket(null);
        setOpenPatti('');
        setPreview(null);
    };

    const handleCheckOpen = async () => {
        if (!selectedResultMarket) return;
        const marketId = selectedResultMarket._id ?? selectedResultMarket.id;
        if (!marketId) return;
        const val = openPatti.replace(/\D/g, '').slice(0, 3);
        setCheckLoading(true);
        setPreview(null);
        try {
            const url = `${API_BASE_URL}/markets/preview-declare-open/${encodeURIComponent(marketId)}?openingNumber=${encodeURIComponent(val)}`;
            const res = await fetch(url, { headers: getAuthHeaders() });
            const data = await res.json();
            if (data.success && data.data != null) {
                setPreview({
                    totalBetAmount: safeNum(data.data.totalBetAmount),
                    totalWinAmount: safeNum(data.data.totalWinAmount),
                    noOfPlayers: safeNum(data.data.noOfPlayers),
                    profit: safeNum(data.data.profit),
                });
            } else {
                setPreview({ totalBetAmount: 0, totalWinAmount: 0, noOfPlayers: 0, profit: 0 });
            }
        } catch {
            setPreview(null);
        } finally {
            setCheckLoading(false);
        }
    };

    const performDeclareOpen = async (secretDeclarePasswordValue) => {
        if (!selectedResultMarket) return;
        const val = openPatti.replace(/\D/g, '').slice(0, 3);
        if (val.length !== 3) {
            alert('Please enter a 3-digit Open Patti.');
            return;
        }
        setDeclareLoading(true);
        setPasswordError('');
        try {
            const body = { openingNumber: val };
            if (secretDeclarePasswordValue) body.secretDeclarePassword = secretDeclarePasswordValue;
            const res = await fetch(`${API_BASE_URL}/markets/declare-open/${selectedResultMarket._id}`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (data.success) {
                setShowPasswordModal(false);
                setSecretPassword('');
                setSelectedResultMarket((prev) => (prev ? { ...prev, openingNumber: val } : null));
                setOpenPatti(val);
                fetchMarkets();
            } else {
                if (data.code === 'INVALID_SECRET_DECLARE_PASSWORD') {
                    setPasswordError(data.message || 'Invalid secret password');
                } else {
                    alert(data.message || 'Failed to declare result');
                }
            }
        } catch {
            alert('Network error');
        } finally {
            setDeclareLoading(false);
        }
    };

    const handleDeclareOpen = () => {
        if (!selectedResultMarket) return;
        const val = openPatti.replace(/\D/g, '').slice(0, 3);
        if (val.length !== 3) {
            alert('Please enter a 3-digit Open Patti.');
            return;
        }
        if (hasSecretDeclarePassword) {
            setShowPasswordModal(true);
            setSecretPassword('');
            setPasswordError('');
        } else {
            performDeclareOpen('');
        }
    };

    const handlePasswordSubmit = (e) => {
        e.preventDefault();
        const val = secretPassword.trim();
        if (hasSecretDeclarePassword && !val) {
            setPasswordError('Please enter the secret declare password');
            return;
        }
        performDeclareOpen(val);
    };

    const handleClearResult = async () => {
        if (!selectedResultMarket) return;
        const hasOpen = selectedResultMarket.openingNumber && /^\d{3}$/.test(String(selectedResultMarket.openingNumber));
        if (!hasOpen) {
            alert('This market has no result to clear.');
            return;
        }
        if (!window.confirm('Clear result for this Starline market?')) return;
        setClearLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/markets/clear-result/${selectedResultMarket._id}`, {
                method: 'POST',
                headers: getAuthHeaders(),
            });
            const data = await res.json();
            if (data.success) {
                setSelectedResultMarket((prev) => (prev ? { ...prev, openingNumber: null, closingNumber: null } : null));
                setOpenPatti('');
                setPreview(null);
                fetchMarkets();
            } else {
                alert(data.message || 'Failed to clear result');
            }
        } catch {
            alert('Network error');
        } finally {
            setClearLoading(false);
        }
    };

    const formatNum = (n) => (n != null && Number.isFinite(n) ? Number(n).toLocaleString('en-IN') : '0');

    return (
        <AdminLayout onLogout={handleLogout} title="Starline Markets">
            <div className="min-w-0">
                {error && (
                    <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm sm:text-base">
                        {error}
                    </div>
                )}

                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2 truncate text-amber-400">
                    Starline – All Management
                </h1>
                <p className="text-gray-400 text-sm mb-6">
                    Single tab: add Starline markets (timing only), edit closing time, and declare result. Only non-deleted Starline markets are listed.
                </p>

                {showForm && editingMarket && (
                    <MarketForm
                        market={editingMarket}
                        defaultMarketType="startline"
                        onClose={handleFormClose}
                        onSuccess={handleFormClose}
                        apiBaseUrl={API_BASE_URL}
                        getAuthHeaders={getAuthHeaders}
                    />
                )}

                {loading ? (
                    <div className="text-center py-8 sm:py-12">
                        <p className="text-gray-400 text-sm sm:text-base">Loading...</p>
                    </div>
                ) : (
                    <div className="flex flex-col xl:flex-row xl:gap-6">
                        <div className="flex-1 min-w-0 space-y-8">
                            {/* Section 1: Starline Markets list (non-deleted only) + Add Starline Market */}
                            <section>
                                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                                    <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                                        <span className="inline-block w-1 h-6 bg-amber-500 rounded-full" />
                                        Markets & Closing Time
                                    </h2>
                                    <button
                                        type="button"
                                        onClick={() => { setShowAddStarlineForm(true); setAddFormError(''); }}
                                        className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-black font-semibold rounded-xl transition-colors text-sm"
                                    >
                                        + Add Starline Market
                                    </button>
                                </div>
                                {startlineMarkets.length === 0 ? (
                                    <div className="rounded-xl border-2 border-dashed border-amber-500/30 bg-gray-800/50 p-6 text-center">
                                        <p className="text-gray-400 text-sm mb-4">No startline markets. Seed defaults or add one with timing only.</p>
                                        <div className="flex flex-wrap justify-center gap-3">
                                            <button
                                                type="button"
                                                onClick={handleSeedStartline}
                                                disabled={seedLoading}
                                                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-black font-semibold rounded-xl transition-colors text-sm"
                                            >
                                                {seedLoading ? 'Creating...' : 'Create default Starline markets'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { setShowAddStarlineForm(true); setAddFormError(''); }}
                                                className="px-4 py-2.5 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-xl transition-colors text-sm"
                                            >
                                                + Add Starline Market
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <StartlineMarketList
                                        markets={startlineMarkets}
                                        onEdit={handleEdit}
                                        onDelete={handleDelete}
                                        apiBaseUrl={API_BASE_URL}
                                        getAuthHeaders={getAuthHeaders}
                                    />
                                )}
                            </section>

                            {/* Section 2: Declare Result table */}
                            <section>
                                <h2 className="text-lg font-bold text-amber-400 mb-3 flex items-center gap-2">
                                    <span className="inline-block w-1 h-6 bg-amber-500 rounded-full" />
                                    Declare Result
                                </h2>
                                {startlineMarkets.length === 0 ? (
                                    <p className="text-gray-500 text-sm">Create Starline markets above first.</p>
                                ) : (
                                    <div className="overflow-x-auto rounded-xl border border-gray-700 bg-gray-800/80">
                                        <table className="w-full border-collapse text-sm min-w-[400px]">
                                            <thead>
                                                <tr className="border-b border-gray-700">
                                                    <th className="text-left py-2.5 px-3 font-semibold text-yellow-500 bg-gray-800">Market</th>
                                                    <th className="text-left py-2.5 px-3 font-semibold text-yellow-500 bg-gray-800 border-l border-gray-700">Closes</th>
                                                    <th className="text-left py-2.5 px-3 font-semibold text-yellow-500 bg-gray-800 border-l border-gray-700">Result</th>
                                                    <th className="text-left py-2.5 px-3 font-semibold text-yellow-500 bg-gray-800 border-l border-gray-700">Opening</th>
                                                    <th className="text-left py-2.5 px-3 font-semibold text-yellow-500 bg-gray-800 border-l border-gray-700">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {startlineMarkets.map((market) => {
                                                    const hasOpen = market.openingNumber && /^\d{3}$/.test(String(market.openingNumber));
                                                    const resultDisplay = market.displayResult || '*** - *';
                                                    const timeline = `Closes ${formatTime(market.closingTime)}`;
                                                    return (
                                                        <tr key={market._id} className="border-b border-gray-700 hover:bg-gray-700/50">
                                                            <td className="py-2.5 px-3 font-medium text-white">{market.marketName}</td>
                                                            <td className="py-2.5 px-3 text-gray-300 border-l border-gray-700 text-xs">{timeline}</td>
                                                            <td className="py-2.5 px-3 border-l border-gray-700">
                                                                <span className="font-mono text-amber-400">{resultDisplay}</span>
                                                                {hasOpen && <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-red-600 text-white">Closed</span>}
                                                            </td>
                                                            <td className="py-2.5 px-3 border-l border-gray-700">
                                                                {hasOpen ? <span className="font-mono text-yellow-400">{market.openingNumber}</span> : <span className="text-gray-500">—</span>}
                                                            </td>
                                                            <td className="py-2.5 px-3 border-l border-gray-700">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openResultPanel(market)}
                                                                    className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg text-xs"
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
                            </section>
                        </div>

                        {/* Right: Declare Result panel */}
                        {selectedResultMarket && (
                            <div className="w-full xl:w-[360px] xl:max-w-[380px] xl:shrink-0 bg-gray-800 rounded-xl border-2 border-amber-500/40 shadow-xl p-4 sm:p-5 mt-6 xl:mt-0">
                                <h2 className="text-lg font-bold text-amber-400 mb-3 border-b border-gray-700 pb-2 truncate" title={selectedResultMarket.marketName}>
                                    {selectedResultMarket.marketName}
                                </h2>
                                <p className="text-xs text-gray-400 mb-3 p-2 rounded bg-gray-700/50 border border-amber-500/20">
                                    Starline has only one result (Open Patti). Declare below.
                                </p>
                                <div className="mb-3">
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Open Patti (3 digits)</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={openPatti}
                                        onChange={(e) => setOpenPatti(e.target.value.replace(/\D/g, '').slice(0, 3))}
                                        placeholder="e.g. 156"
                                        className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono focus:ring-2 focus:ring-yellow-500 min-h-[42px]"
                                        maxLength={3}
                                    />
                                </div>
                                <div className="flex gap-2 mb-3">
                                    <button
                                        type="button"
                                        onClick={handleCheckOpen}
                                        disabled={checkLoading}
                                        className="flex-1 px-3 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg text-sm disabled:opacity-50"
                                    >
                                        {checkLoading ? 'Checking...' : 'Check'}
                                    </button>
                                </div>
                                {preview != null && (
                                    <div className="space-y-1.5 mb-3 rounded-lg bg-gray-700/50 border border-gray-600 p-2.5 text-xs">
                                        <div className="flex justify-between"><span className="text-gray-400">Total Bet</span><span className="font-mono text-white">{formatNum(preview.totalBetAmount)}</span></div>
                                        <div className="flex justify-between"><span className="text-gray-400">Total Win</span><span className="font-mono text-white">{formatNum(preview.totalWinAmount)}</span></div>
                                        <div className="flex justify-between"><span className="text-gray-400">Players</span><span className="font-mono text-white">{formatNum(preview.noOfPlayers)}</span></div>
                                        <div className="flex justify-between"><span className="text-gray-400">Profit</span><span className="font-mono text-yellow-400">{formatNum(preview.profit)}</span></div>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={handleDeclareOpen}
                                    disabled={declareLoading || openPatti.replace(/\D/g, '').length !== 3}
                                    className="w-full px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 text-black font-semibold rounded-lg text-sm disabled:opacity-50"
                                >
                                    {declareLoading ? 'Declaring...' : 'Declare Result'}
                                </button>
                                {(selectedResultMarket.openingNumber && /^\d{3}$/.test(String(selectedResultMarket.openingNumber))) && (
                                    <button
                                        type="button"
                                        onClick={handleClearResult}
                                        disabled={clearLoading}
                                        className="mt-2 w-full px-4 py-2.5 bg-red-900/80 hover:bg-red-800 text-red-100 font-semibold rounded-lg text-sm disabled:opacity-50"
                                    >
                                        {clearLoading ? 'Clearing...' : 'Clear Result'}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={closeResultPanel}
                                    className="mt-3 w-full px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg text-sm"
                                >
                                    Close
                                </button>
                            </div>
                        )}

                        {/* Add Starline Market modal (timing only) */}
                        {showAddStarlineForm && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                                <div className="bg-gray-800 rounded-xl border-2 border-amber-500/40 shadow-xl max-w-md w-full p-6">
                                    <h3 className="text-lg font-bold text-amber-400 mb-2">Add Starline Market</h3>
                                    <p className="text-gray-400 text-sm mb-4">Add a single Starline market with closing time only. Name is auto-generated (e.g. STARLINE 10:00 PM).</p>
                                    <form onSubmit={handleAddStarlineSubmit} className="space-y-4">
                                        {addFormError && (
                                            <div className="p-2.5 rounded-lg bg-red-900/50 border border-red-700 text-red-200 text-sm">{addFormError}</div>
                                        )}
                                        <div>
                                            <label className="block text-gray-300 text-sm font-medium mb-2">Closing Time</label>
                                            <div className="grid grid-cols-[1fr_auto_1fr_auto_auto] gap-1 sm:gap-2 items-center">
                                                <select
                                                    value={addFormTime.hour12}
                                                    onChange={(e) => setAddFormTime((p) => ({ ...p, hour12: e.target.value }))}
                                                    className="w-full min-w-0 px-2 sm:px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500 text-sm"
                                                >
                                                    {HOURS_12.map((h) => (
                                                        <option key={h} value={h}>{h}</option>
                                                    ))}
                                                </select>
                                                <span className="text-gray-400 text-sm">:</span>
                                                <select
                                                    value={addFormTime.minute}
                                                    onChange={(e) => setAddFormTime((p) => ({ ...p, minute: e.target.value }))}
                                                    className="w-full min-w-0 px-2 sm:px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500 text-sm"
                                                >
                                                    {MINUTES.map((m) => (
                                                        <option key={m} value={m}>{m}</option>
                                                    ))}
                                                </select>
                                                <span className="w-1" />
                                                <select
                                                    value={addFormTime.ampm}
                                                    onChange={(e) => setAddFormTime((p) => ({ ...p, ampm: e.target.value }))}
                                                    className="w-full min-w-[4rem] px-2 sm:px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500 text-sm"
                                                >
                                                    <option value="AM">AM</option>
                                                    <option value="PM">PM</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-gray-300 text-sm font-medium mb-2">Bet Closure (seconds, optional)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={addFormBetClosure}
                                                onChange={(e) => setAddFormBetClosure(e.target.value)}
                                                placeholder="e.g. 300"
                                                className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 text-sm"
                                            />
                                        </div>
                                        <div className="flex gap-3 pt-2">
                                            <button
                                                type="submit"
                                                disabled={addFormLoading}
                                                className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg text-sm disabled:opacity-50"
                                            >
                                                {addFormLoading ? 'Creating...' : 'Create'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { setShowAddStarlineForm(false); setAddFormError(''); }}
                                                disabled={addFormLoading}
                                                className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg text-sm"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        {/* Delete market – secret password modal */}
                        {showDeletePasswordModal && deleteMarket && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                                <div className="bg-gray-800 rounded-xl border border-red-500/40 shadow-xl max-w-md w-full p-6">
                                    <h3 className="text-lg font-bold text-red-400 mb-2">Delete Starline Market</h3>
                                    <p className="text-gray-400 text-sm mb-2 truncate" title={deleteMarket.marketName}>{deleteMarket.marketName}</p>
                                    <p className="text-gray-400 text-sm mb-4">
                                        Enter the secret declare password to confirm deletion.
                                    </p>
                                    <form onSubmit={handleDeletePasswordSubmit} className="space-y-4">
                                        <input
                                            type="password"
                                            value={deletePassword}
                                            onChange={(e) => { setDeletePassword(e.target.value); setDeletePasswordError(''); }}
                                            placeholder="Secret password"
                                            autoFocus
                                            className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-500 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                        />
                                        {deletePasswordError && <p className="text-red-400 text-sm">{deletePasswordError}</p>}
                                        <div className="flex gap-3">
                                            <button
                                                type="submit"
                                                disabled={deleteLoading}
                                                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg disabled:opacity-50"
                                            >
                                                {deleteLoading ? 'Deleting...' : 'Delete'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { setShowDeletePasswordModal(false); setDeleteMarket(null); setDeletePassword(''); setDeletePasswordError(''); }}
                                                disabled={deleteLoading}
                                                className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg border border-gray-600"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        {/* Secret declare password modal */}
                        {showPasswordModal && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                                <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl max-w-md w-full p-6">
                                    <h3 className="text-lg font-bold text-yellow-500 mb-2">Enter Secret Declare Password</h3>
                                    <p className="text-gray-400 text-sm mb-4">
                                        Please enter the secret password to declare this result.
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
                                                disabled={declareLoading}
                                                className="flex-1 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg disabled:opacity-50"
                                            >
                                                {declareLoading ? 'Declaring...' : 'Declare Result'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { setShowPasswordModal(false); setSecretPassword(''); setPasswordError(''); }}
                                                disabled={declareLoading}
                                                className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg border border-gray-600"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
};

export default StartlineMarkets;
