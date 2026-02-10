import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import MarketForm from '../components/MarketForm';
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

const to24Hour = (hour12, minute, ampm) => {
    let h = parseInt(hour12, 10) || 12;
    const m = String(parseInt(minute, 10) || 0).padStart(2, '0').slice(0, 2);
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}`;
};
const toDisplayTime = (hour12, minute, ampm) => {
    const h = parseInt(hour12, 10) || 12;
    const m = String(parseInt(minute, 10) || 0).padStart(2, '0').slice(0, 2);
    return `${h}:${m} ${ampm === 'PM' ? 'PM' : 'AM'}`;
};
const HOURS_12 = ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

const StarlineManagement = ({ embedded = false }) => {
    const [markets, setMarkets] = useState([]);
    const [starlineGroups, setStarlineGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingGroups, setLoadingGroups] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingMarket, setEditingMarket] = useState(null);
    const [showAddSlot, setShowAddSlot] = useState(false);
    const [addTime, setAddTime] = useState({ hour12: '10', minute: '00', ampm: 'PM' });
    const [addBetClosure, setAddBetClosure] = useState('');
    const [addLoading, setAddLoading] = useState(false);
    const [addError, setAddError] = useState('');
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
    const [deleteMarket, setDeleteMarket] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deletePasswordError, setDeletePasswordError] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [showAddMarket, setShowAddMarket] = useState(false);
    const [newMarketLabel, setNewMarketLabel] = useState('');
    const [addMarketLoading, setAddMarketLoading] = useState(false);
    const [addMarketError, setAddMarketError] = useState('');
    const [deleteGroupKey, setDeleteGroupKey] = useState(null);
    const [showDeleteGroupModal, setShowDeleteGroupModal] = useState(false);
    const [deleteGroupPassword, setDeleteGroupPassword] = useState('');
    const [deleteGroupPasswordError, setDeleteGroupPasswordError] = useState('');
    const [deleteGroupLoading, setDeleteGroupLoading] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    const getAuthHeaders = () => {
        const admin = JSON.parse(localStorage.getItem('admin') || '{}');
        const password = sessionStorage.getItem('adminPassword') || '';
        return {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${btoa(`${admin.username}:${password}`)}`,
        };
    };

    const fetchMarkets = async () => {
        try {
            setLoading(true);
            setError('');
            const res = await fetch(`${API_BASE_URL}/markets/get-markets`);
            const data = await res.json();
            if (data.success) setMarkets(data.data || []);
            else setError('Failed to fetch markets');
        } catch (err) {
            setError('Network error.');
        } finally {
            setLoading(false);
        }
    };

    const fetchStarlineGroups = async () => {
        try {
            setLoadingGroups(true);
            const res = await fetch(`${API_BASE_URL}/markets/starline-groups`);
            const data = await res.json();
            if (data.success) {
                const list = data.data || [];
                setStarlineGroups(list);
                if (list.length === 0) setActiveTab('');
                else if (activeTab && !list.some((g) => g.key === activeTab)) setActiveTab('');
            }
        } catch (err) {
            setStarlineGroups([]);
        } finally {
            setLoadingGroups(false);
        }
    };

    useEffect(() => {
        const admin = localStorage.getItem('admin');
        if (!admin) {
            navigate('/');
            return;
        }
        fetchMarkets();
        fetchStarlineGroups();
    }, [navigate]);

    // When coming from MarketDetail "Back to Starline", open that market's tab
    useEffect(() => {
        const key = (location.state?.starlineMarketKey || '').toString().trim().toLowerCase();
        if (!key || !starlineGroups.length) return;
        if (starlineGroups.some((g) => (g.key || '').toLowerCase() === key)) {
            setActiveTab(key);
        }
    }, [starlineGroups, location.state?.starlineMarketKey]);

    // When entering a group's detail view, refetch markets so slots are current for that group
    useEffect(() => {
        const key = (activeTab || '').toString().trim().toLowerCase();
        if (key) fetchMarkets();
    }, [activeTab]);

    useEffect(() => {
        fetch(`${API_BASE_URL}/admin/me/secret-declare-password-status`, { headers: getAuthHeaders() })
            .then((res) => res.json())
            .then((json) => { if (json.success) setHasSecretDeclarePassword(!!json.hasSecretDeclarePassword); })
            .catch(() => setHasSecretDeclarePassword(false));
    }, []);

    useRefreshOnMarketReset(fetchMarkets);

    const activeGroup = useMemo(() => starlineGroups.find((g) => g.key === activeTab) || starlineGroups[0] || null, [starlineGroups, activeTab]);

    const normalizedActiveTab = (activeTab || '').toString().trim().toLowerCase();
    const slotsForTab = useMemo(() => {
        if (!normalizedActiveTab) return [];
        const list = (markets || []).filter((m) => {
            if (m.marketType !== 'startline') return false;
            const group = (m.starlineGroup || '').toString().trim().toLowerCase();
            return group === normalizedActiveTab;
        });
        return list.sort((a, b) => String(a.closingTime || a.startingTime || '').localeCompare(String(b.closingTime || b.startingTime || ''), undefined, { numeric: true }));
    }, [markets, normalizedActiveTab]);

    const handleAddMarketSubmit = async (e) => {
        e.preventDefault();
        const label = newMarketLabel.trim();
        if (!label) {
            setAddMarketError('Enter market name');
            return;
        }
        setAddMarketLoading(true);
        setAddMarketError('');
        try {
            const res = await fetch(`${API_BASE_URL}/markets/starline-groups`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ label }),
            });
            const data = await res.json();
            if (data.success) {
                setShowAddMarket(false);
                setNewMarketLabel('');
                await fetchStarlineGroups();
                await fetchMarkets();
                const newKey = (data.data?.key || '').toString().trim().toLowerCase();
                if (newKey) setActiveTab(newKey);
            } else {
                setAddMarketError(data.message || 'Failed to add market');
            }
        } catch (err) {
            setAddMarketError('Network error.');
        } finally {
            setAddMarketLoading(false);
        }
    };

    const handleDeleteGroup = async (pwd = '') => {
        if (!deleteGroupKey) return;
        if (hasSecretDeclarePassword && !pwd.trim()) {
            setDeleteGroupPasswordError('Enter secret declare password');
            return;
        }
        setDeleteGroupPasswordError('');
        setDeleteGroupLoading(true);
        try {
            const opts = { method: 'DELETE', headers: getAuthHeaders() };
            if (pwd.trim()) opts.body = JSON.stringify({ secretDeclarePassword: pwd.trim() });
            const res = await fetch(`${API_BASE_URL}/markets/starline-groups/${encodeURIComponent(deleteGroupKey)}`, opts);
            const data = await res.json();
            if (data.success) {
                setShowDeleteGroupModal(false);
                setDeleteGroupKey(null);
                setDeleteGroupPassword('');
                setDeleteGroupPasswordError('');
                await fetchStarlineGroups();
                await fetchMarkets();
                if (activeTab === deleteGroupKey && starlineGroups.length > 1) {
                    const next = starlineGroups.find((g) => g.key !== deleteGroupKey);
                    setActiveTab(next ? next.key : '');
                } else if (activeTab === deleteGroupKey) {
                    setActiveTab('');
                }
            } else {
                if (data.code === 'INVALID_SECRET_DECLARE_PASSWORD') setDeleteGroupPasswordError(data.message || 'Invalid password');
                else alert(data.message || 'Failed to delete market');
            }
        } catch (err) {
            alert('Network error');
        } finally {
            setDeleteGroupLoading(false);
        }
    };

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

    const handleAddSlotSubmit = async (e) => {
        e.preventDefault();
        setAddError('');
        setAddLoading(true);
        try {
            const time24 = to24Hour(addTime.hour12, addTime.minute, addTime.ampm);
            const marketName = `${(activeGroup?.label || activeTab) || 'Starline'} ${toDisplayTime(addTime.hour12, addTime.minute, addTime.ampm)}`;
            const payload = {
                marketName,
                startingTime: time24,
                closingTime: time24,
                marketType: 'startline',
                starlineGroup: activeTab,
            };
            if (addBetClosure !== '' && addBetClosure != null) {
                const sec = Number(addBetClosure);
                if (Number.isFinite(sec) && sec >= 0) payload.betClosureTime = sec;
            }
            const res = await fetch(`${API_BASE_URL}/markets/create-market`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.success) {
                setShowAddSlot(false);
                setAddTime({ hour12: '10', minute: '00', ampm: 'PM' });
                setAddBetClosure('');
                await fetchMarkets();
            } else {
                setAddError(data.message || 'Failed to create slot');
            }
        } catch (err) {
            setAddError('Network error.');
        } finally {
            setAddLoading(false);
        }
    };

    const performDelete = async (pwd) => {
        if (!deleteMarket) return;
        const id = deleteMarket._id ?? deleteMarket.id;
        setDeleteLoading(true);
        setDeletePasswordError('');
        try {
            const body = pwd ? { secretDeclarePassword: pwd } : {};
            const res = await fetch(`${API_BASE_URL}/markets/delete-market/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (data.success) {
                setDeleteMarket(null);
                setShowDeleteModal(false);
                setDeletePassword('');
                if (selectedResultMarket && (String(selectedResultMarket._id) === String(id) || String(selectedResultMarket.id) === String(id)))
                    setSelectedResultMarket(null);
                fetchMarkets();
            } else {
                if (data.code === 'INVALID_SECRET_DECLARE_PASSWORD' || res.status === 403)
                    setDeletePasswordError(data.message || 'Invalid password');
                else alert(data.message || 'Failed to delete');
            }
        } catch {
            alert('Network error');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleDelete = (market) => {
        if (!window.confirm(`Delete slot "${market.marketName}"?`)) return;
        setDeleteMarket(market);
        setDeletePassword('');
        setDeletePasswordError('');
        if (hasSecretDeclarePassword) setShowDeleteModal(true);
        else performDelete('');
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
        const id = selectedResultMarket._id ?? selectedResultMarket.id;
        const val = openPatti.replace(/\D/g, '').slice(0, 3);
        setCheckLoading(true);
        setPreview(null);
        try {
            const res = await fetch(`${API_BASE_URL}/markets/preview-declare-open/${id}?openingNumber=${encodeURIComponent(val)}`, { headers: getAuthHeaders() });
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

    const performDeclareOpen = async (pwd) => {
        if (!selectedResultMarket) return;
        const val = openPatti.replace(/\D/g, '').slice(0, 3);
        if (val.length !== 3) {
            alert('Enter 3-digit Open Patti.');
            return;
        }
        setDeclareLoading(true);
        setPasswordError('');
        try {
            const body = { openingNumber: val };
            if (pwd) body.secretDeclarePassword = pwd;
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
                if (data.code === 'INVALID_SECRET_DECLARE_PASSWORD') setPasswordError(data.message || 'Invalid password');
                else alert(data.message || 'Failed to declare');
            }
        } catch {
            alert('Network error');
        } finally {
            setDeclareLoading(false);
        }
    };

    const handleDeclareOpen = () => {
        if (!selectedResultMarket) return;
        if (openPatti.replace(/\D/g, '').length !== 3) {
            alert('Enter 3-digit Open Patti.');
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
        if (hasSecretDeclarePassword && !secretPassword.trim()) {
            setPasswordError('Enter secret declare password');
            return;
        }
        performDeclareOpen(secretPassword.trim());
    };

    const handleClearResult = async () => {
        if (!selectedResultMarket) return;
        if (!selectedResultMarket.openingNumber || !/^\d{3}$/.test(String(selectedResultMarket.openingNumber))) {
            alert('No result to clear.');
            return;
        }
        if (!window.confirm('Clear result for this slot?')) return;
        setClearLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/markets/clear-result/${selectedResultMarket._id}`, { method: 'POST', headers: getAuthHeaders() });
            const data = await res.json();
            if (data.success) {
                setSelectedResultMarket((prev) => (prev ? { ...prev, openingNumber: null, closingNumber: null } : null));
                setOpenPatti('');
                setPreview(null);
                fetchMarkets();
            } else {
                alert(data.message || 'Failed to clear');
            }
        } catch {
            alert('Network error');
        } finally {
            setClearLoading(false);
        }
    };

    const formatNum = (n) => (n != null && Number.isFinite(n) ? Number(n).toLocaleString('en-IN') : '0');

    const content = (
            <div className="min-w-0">
                {error && (
                    <div className="mb-3 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">{error}</div>
                )}

                {/* ═══ List view: choose market ═══ */}
                {!activeTab ? (
                    <>
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                            <h1 className="text-xl sm:text-2xl font-bold text-amber-400">Starline</h1>
                            {!loadingGroups && starlineGroups.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => { setShowAddMarket(true); setNewMarketLabel(''); setAddMarketError(''); }}
                                    className="px-4 py-2.5 rounded-xl font-semibold text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30"
                                >
                                    + Add market
                                </button>
                            )}
                        </div>
                        <p className="text-gray-400 text-sm mb-6">
                            Choose a market to add time slots, edit closing times, view details, and declare results.
                        </p>
                        {loadingGroups ? (
                            <div className="flex items-center gap-3 py-10 text-gray-400">
                                <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                                Loading markets…
                            </div>
                        ) : starlineGroups.length === 0 ? (
                            <div className="rounded-2xl border-2 border-dashed border-amber-500/40 bg-gray-800/60 p-10 text-center">
                                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <p className="text-gray-300 font-medium mb-1">No Starline markets yet</p>
                                <p className="text-gray-500 text-sm mb-5">Add your first market, then add time slots and declare results.</p>
                                <button
                                    type="button"
                                    onClick={() => { setShowAddMarket(true); setNewMarketLabel(''); setAddMarketError(''); }}
                                    className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm"
                                >
                                    + Add Starline market
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {[...starlineGroups]
                                    .sort((a, b) => (safeNum(a.order) - safeNum(b.order)) || (a.label || '').localeCompare(b.label || ''))
                                    .map((g) => {
                                        const groupSlots = (markets || []).filter((m) => m.marketType === 'startline' && (m.starlineGroup || '').toLowerCase() === g.key);
                                        const slotCount = groupSlots.length;
                                        const declaredCount = groupSlots.filter((m) => m.openingNumber && /^\d{3}$/.test(String(m.openingNumber))).length;
                                        const openCount = slotCount - declaredCount;
                                        const statusLabel = slotCount === 0 ? 'No slots' : openCount > 0 ? `${openCount} open` : 'All declared';
                                        const statusVariant = slotCount === 0 ? 'gray' : openCount > 0 ? 'emerald' : 'amber';
                                        return (
                                            <div
                                                key={g.key}
                                                className="group relative bg-gray-800 rounded-2xl border border-gray-700 hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/5 transition-all overflow-hidden flex flex-col"
                                            >
                                                {/* Top accent */}
                                                <div className="h-1 w-full bg-gradient-to-r from-amber-500/80 to-amber-400/50" />
                                                <div className="p-5 flex flex-col flex-1 min-h-0">
                                                    <div className="flex items-start justify-between gap-3 mb-3">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide ${
                                                                    statusVariant === 'gray' ? 'bg-gray-700 text-gray-400' :
                                                                    statusVariant === 'emerald' ? 'bg-emerald-900/60 text-emerald-300' : 'bg-amber-900/50 text-amber-300'
                                                                }`}>
                                                                    {statusLabel}
                                                                </span>
                                                            </div>
                                                            <h3 className="text-lg font-bold text-white truncate mt-2" title={g.label}>{g.label}</h3>
                                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 text-xs text-gray-500">
                                                                <span className="font-medium text-gray-400">{slotCount} slot{slotCount !== 1 ? 's' : ''}</span>
                                                                {slotCount > 0 && openCount > 0 && <span>{openCount} open for bets</span>}
                                                                {declaredCount > 0 && <span>{declaredCount} declared</span>}
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); setDeleteGroupKey(g.key); setShowDeleteGroupModal(true); }}
                                                            className="p-2 rounded-xl text-gray-400 hover:bg-red-900/30 hover:text-red-400 transition-colors shrink-0"
                                                            title="Delete this market"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setActiveTab(g.key)}
                                                        className="w-full mt-auto px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm flex items-center justify-center gap-2 shadow-md shadow-amber-900/20"
                                                    >
                                                        Manage slots & result
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        {/* ═══ Detail view: breadcrumb + title ═══ */}
                        <nav className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                            <button type="button" onClick={() => { setActiveTab(''); setSelectedResultMarket(null); }} className="hover:text-amber-400 transition-colors">Starline</button>
                            <span>/</span>
                            <span className="text-white font-medium">{activeGroup?.label || activeTab}</span>
                        </nav>
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                            <div>
                                <h1 className="text-xl sm:text-2xl font-bold text-white">{activeGroup?.label || activeTab}</h1>
                                <p className="text-gray-400 text-sm mt-0.5">Add time slots, edit closing time, view details, and declare result per slot.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setActiveTab(''); setSelectedResultMarket(null); }}
                                className="px-3 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 text-sm font-medium"
                            >
                                ← Back to list
                            </button>
                        </div>
                    </>
                )}

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

                {/* Detail view: timing & declare (only when a market is open) */}
                {activeTab && (
                    loading ? (
                        <div className="text-center py-8 text-gray-400">Loading slots...</div>
                    ) : (
                    <div className="flex flex-col xl:flex-row xl:gap-6">
                        <div className="flex-1 min-w-0 space-y-8">
                            {/* 1. Time slots */}
                            <section className="rounded-2xl border border-gray-700 bg-gray-800/50 p-5 sm:p-6">
                                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                    <div>
                                        <h2 className="text-base font-bold text-white flex items-center gap-2">
                                            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 font-mono text-sm">1</span>
                                            Time slots
                                        </h2>
                                        <p className="text-gray-500 text-xs mt-1">Add slots and set when each closes. Edit or delete below.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => { setShowAddSlot(true); setAddError(''); }}
                                        className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm"
                                    >
                                        + Add slot
                                    </button>
                                </div>
                                {slotsForTab.length === 0 ? (
                                    <div className="rounded-xl border-2 border-dashed border-amber-500/30 bg-gray-800/80 p-8 text-center">
                                        <p className="text-gray-400 text-sm mb-4">No time slots yet. Add one to set closing time and accept bets.</p>
                                        <button
                                            type="button"
                                            onClick={() => { setShowAddSlot(true); setAddError(''); }}
                                            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm"
                                        >
                                            + Add time slot
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {slotsForTab.map((m) => {
                                            const hasOpen = m.openingNumber && /^\d{3}$/.test(String(m.openingNumber));
                                            return (
                                                <div key={m._id} className="bg-gray-800 rounded-xl border border-gray-600 p-4 hover:border-amber-500/40 transition-colors">
                                                    <div className="flex items-center justify-between gap-2 mb-2">
                                                        <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${hasOpen ? 'bg-red-900/50 text-red-300' : 'bg-emerald-900/50 text-emerald-300'}`}>
                                                            {hasOpen ? 'Result declared' : 'Open'}
                                                        </span>
                                                    </div>
                                                    <h3 className="text-sm font-bold text-white truncate mb-1" title={m.marketName}>{m.marketName}</h3>
                                                    <p className="text-xs text-gray-500 mb-3">Closes {formatTime(m.closingTime)}</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        <button type="button" onClick={() => navigate(`/markets/${m._id}`)} className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium">View details</button>
                                                        <button type="button" onClick={() => handleEdit(m)} className="px-3 py-1.5 rounded-lg bg-amber-600/80 hover:bg-amber-600 text-black text-xs font-medium">Edit time</button>
                                                        <button type="button" onClick={() => handleDelete(m)} className="px-3 py-1.5 rounded-lg bg-red-900/60 hover:bg-red-800 text-red-200 text-xs font-medium">Delete</button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>
                        </div>

                        {/* Add slot modal */}
                        {showAddSlot && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                                <div className="bg-gray-800 rounded-2xl border border-amber-500/40 shadow-xl max-w-md w-full p-6">
                                    <h3 className="text-base font-bold text-white mb-1">Add time slot</h3>
                                    <p className="text-gray-500 text-sm mb-4">Set closing time for a new slot. Name will be e.g. &quot;{activeGroup?.label || ''} 10:00 PM&quot;.</p>
                                    <form onSubmit={handleAddSlotSubmit} className="space-y-4">
                                        {addError && <div className="p-3 rounded-xl bg-red-900/40 border border-red-700/50 text-red-200 text-sm">{addError}</div>}
                                        <div>
                                            <label className="block text-gray-400 text-xs font-medium mb-1">Closing time</label>
                                            <div className="grid grid-cols-[1fr_auto_1fr_auto_auto] gap-2 items-center">
                                                <select value={addTime.hour12} onChange={(e) => setAddTime((p) => ({ ...p, hour12: e.target.value }))} className="px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-white text-sm">
                                                    {HOURS_12.map((h) => <option key={h} value={h}>{h}</option>)}
                                                </select>
                                                <span className="text-gray-400">:</span>
                                                <select value={addTime.minute} onChange={(e) => setAddTime((p) => ({ ...p, minute: e.target.value }))} className="px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-white text-sm">
                                                    {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
                                                </select>
                                                <select value={addTime.ampm} onChange={(e) => setAddTime((p) => ({ ...p, ampm: e.target.value }))} className="px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-white text-sm">
                                                    <option value="AM">AM</option>
                                                    <option value="PM">PM</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-gray-400 text-xs font-medium mb-1">Bet closure (seconds, optional)</label>
                                            <input type="number" min="0" value={addBetClosure} onChange={(e) => setAddBetClosure(e.target.value)} placeholder="e.g. 300" className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-white text-sm" />
                                        </div>
                                        <div className="flex gap-3 pt-1">
                                            <button type="submit" disabled={addLoading} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm disabled:opacity-50">
                                                {addLoading ? 'Creating...' : 'Create slot'}
                                            </button>
                                            <button type="button" onClick={() => { setShowAddSlot(false); setAddError(''); }} disabled={addLoading} className="px-4 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium text-sm">
                                                Cancel
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        {/* Delete slot modal */}
                        {showDeleteModal && deleteMarket && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                                <div className="bg-gray-800 rounded-2xl border border-red-500/40 shadow-xl max-w-md w-full p-6">
                                    <h3 className="text-base font-bold text-white mb-1">Delete time slot</h3>
                                    <p className="text-gray-400 text-sm truncate mb-1" title={deleteMarket.marketName}>{deleteMarket.marketName}</p>
                                    <p className="text-gray-500 text-sm mb-4">This slot will be removed. Enter secret declare password to confirm.</p>
                                    <form onSubmit={(e) => { e.preventDefault(); if (hasSecretDeclarePassword && !deletePassword.trim()) { setDeletePasswordError('Enter password'); return; } performDelete(deletePassword.trim()); }} className="space-y-4">
                                        <input type="password" value={deletePassword} onChange={(e) => { setDeletePassword(e.target.value); setDeletePasswordError(''); }} placeholder="Secret password" className="w-full px-4 py-3 rounded-xl bg-gray-700 border border-gray-600 text-white text-sm" />
                                        {deletePasswordError && <p className="text-red-400 text-sm">{deletePasswordError}</p>}
                                        <div className="flex gap-3">
                                            <button type="submit" disabled={deleteLoading} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm disabled:opacity-50">Delete slot</button>
                                            <button type="button" onClick={() => { setShowDeleteModal(false); setDeleteMarket(null); setDeletePassword(''); setDeletePasswordError(''); }} disabled={deleteLoading} className="px-4 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium text-sm">Cancel</button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        {/* Declare password modal */}
                        {showPasswordModal && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                                <div className="bg-gray-800 rounded-2xl border border-amber-500/40 shadow-xl max-w-md w-full p-6">
                                    <h3 className="text-base font-bold text-white mb-1">Declare result</h3>
                                    <p className="text-gray-500 text-sm mb-4">Enter secret declare password to confirm.</p>
                                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                                        <input type="password" value={secretPassword} onChange={(e) => { setSecretPassword(e.target.value); setPasswordError(''); }} placeholder="Secret password" className="w-full px-4 py-3 rounded-xl bg-gray-700 border border-gray-600 text-white text-sm" />
                                        {passwordError && <p className="text-red-400 text-sm">{passwordError}</p>}
                                        <div className="flex gap-3">
                                            <button type="submit" disabled={declareLoading} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm disabled:opacity-50">Declare</button>
                                            <button type="button" onClick={() => { setShowPasswordModal(false); setSecretPassword(''); setPasswordError(''); }} disabled={declareLoading} className="px-4 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium text-sm">Cancel</button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                    </div>
                    )
                )}

                {/* Add Starline market modal (available on list view) */}
                {showAddMarket && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                        <div className="bg-gray-800 rounded-2xl border border-amber-500/40 shadow-xl max-w-md w-full p-6">
                            <h3 className="text-base font-bold text-white mb-1">Add Starline market</h3>
                            <p className="text-gray-500 text-sm mb-4">Add a new market (e.g. Pune Starline). You can then add time slots and declare results for it.</p>
                            <form onSubmit={handleAddMarketSubmit} className="space-y-4">
                                {addMarketError && <div className="p-3 rounded-xl bg-red-900/40 border border-red-700/50 text-red-200 text-sm">{addMarketError}</div>}
                                <div>
                                    <label className="block text-gray-400 text-xs font-medium mb-1">Market name</label>
                                    <input
                                        type="text"
                                        value={newMarketLabel}
                                        onChange={(e) => setNewMarketLabel(e.target.value)}
                                        placeholder="e.g. Pune Starline"
                                        className="w-full px-3 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-white text-sm"
                                    />
                                </div>
                                <div className="flex gap-3 pt-1">
                                    <button type="submit" disabled={addMarketLoading} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm disabled:opacity-50">
                                        {addMarketLoading ? 'Adding...' : 'Add market'}
                                    </button>
                                    <button type="button" onClick={() => { setShowAddMarket(false); setNewMarketLabel(''); setAddMarketError(''); }} disabled={addMarketLoading} className="px-4 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium text-sm">Cancel</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Delete Starline market (group) modal */}
                {showDeleteGroupModal && deleteGroupKey && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                        <div className="bg-gray-800 rounded-2xl border border-red-500/40 shadow-xl max-w-md w-full p-6">
                            <h3 className="text-base font-bold text-white mb-1">Delete Starline market</h3>
                            <p className="text-gray-400 text-sm mb-1">Market: <strong className="text-white">{starlineGroups.find((g) => g.key === deleteGroupKey)?.label || deleteGroupKey}</strong></p>
                            <p className="text-gray-500 text-sm mb-4">This will remove the market and all its time slots. This cannot be undone. {hasSecretDeclarePassword ? 'Enter secret declare password to confirm.' : ''}</p>
                            <form onSubmit={(e) => { e.preventDefault(); handleDeleteGroup(deleteGroupPassword); }} className="space-y-4">
                                {hasSecretDeclarePassword && (
                                    <>
                                        <input type="password" value={deleteGroupPassword} onChange={(e) => { setDeleteGroupPassword(e.target.value); setDeleteGroupPasswordError(''); }} placeholder="Secret declare password" className="w-full px-4 py-3 rounded-xl bg-gray-700 border border-gray-600 text-white text-sm" />
                                        {deleteGroupPasswordError && <p className="text-red-400 text-sm">{deleteGroupPasswordError}</p>}
                                    </>
                                )}
                                <div className="flex gap-3">
                                    <button type="submit" disabled={deleteGroupLoading} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm disabled:opacity-50">Delete market & slots</button>
                                    <button type="button" onClick={() => { setShowDeleteGroupModal(false); setDeleteGroupKey(null); setDeleteGroupPassword(''); setDeleteGroupPasswordError(''); }} disabled={deleteGroupLoading} className="px-4 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium text-sm">Cancel</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
    );

    if (embedded) return content;
    return (
        <AdminLayout onLogout={handleLogout} title="Starline">
            {content}
        </AdminLayout>
    );
};

export default StarlineManagement;
