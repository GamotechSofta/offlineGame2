import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { API_BASE_URL, getBookieAuthHeaders } from '../utils/api';
import {
    FaArrowLeft,
    FaCalendarAlt,
    FaWallet,
    FaGamepad,
    FaPlusCircle,
    FaMinusCircle,
    FaHistory,
    FaUser,
    FaFileInvoiceDollar,
    FaExchangeAlt,
    FaSyncAlt,
    FaPrint,
    FaFilter,
} from 'react-icons/fa';

const TABS = [
    { id: 'overview', label: 'Overview', icon: FaUser },
    { id: 'bets', label: 'Bet History', icon: FaHistory },
    { id: 'wallet', label: 'Fund History', icon: FaExchangeAlt },
    { id: 'statement', label: 'Statement', icon: FaFileInvoiceDollar },
];

const formatDateRange = (from, to) => {
    if (!from || !to) return '';
    const a = new Date(from);
    const b = new Date(to);
    return `${a.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' })} ~ ${b.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' })}`;
};

const DATE_PRESETS = [
    { id: 'today', label: 'Today', getRange: () => { const d = new Date(); const f = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; return { from: f, to: f }; } },
    { id: 'yesterday', label: 'Yesterday', getRange: () => { const d = new Date(); d.setDate(d.getDate() - 1); const f = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; return { from: f, to: f }; } },
    { id: 'this_week', label: 'This Week', getRange: () => { const d = new Date(); const day = d.getDay(); const sun = new Date(d); sun.setDate(d.getDate() - day); const sat = new Date(sun); sat.setDate(sun.getDate() + 6); const fmt = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; return { from: fmt(sun), to: fmt(sat) }; } },
    { id: 'last_week', label: 'Last Week', getRange: () => { const d = new Date(); const day = d.getDay(); const sun = new Date(d); sun.setDate(d.getDate() - day - 7); const sat = new Date(sun); sat.setDate(sun.getDate() + 6); const fmt = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; return { from: fmt(sun), to: fmt(sat) }; } },
    { id: 'this_month', label: 'This Month', getRange: () => { const d = new Date(); const y = d.getFullYear(), m = d.getMonth(); const last = new Date(y, m + 1, 0); return { from: `${y}-${String(m + 1).padStart(2, '0')}-01`, to: `${y}-${String(m + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}` }; } },
    { id: 'last_month', label: 'Last Month', getRange: () => { const d = new Date(); const y = d.getFullYear(), m = d.getMonth() - 1; const last = new Date(y, m + 1, 0); return { from: `${y}-${String(m + 1).padStart(2, '0')}-01`, to: `${y}-${String(m + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}` }; } },
];

const formatCurrency = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const PlayerDetail = () => {
    const { userId } = useParams();
    const navigate = useNavigate();
    const [player, setPlayer] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Date range (shared across tabs)
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [datePreset, setDatePreset] = useState('today');
    const [calendarOpen, setCalendarOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Tab data
    const [bets, setBets] = useState([]);
    const [walletTx, setWalletTx] = useState([]);
    const [statementData, setStatementData] = useState([]);
    const [loadingTab, setLoadingTab] = useState(false);

    // Bet filter
    const [betFilter, setBetFilter] = useState('all'); // all, pending, won, lost

    // Fund modal
    const [fundModalOpen, setFundModalOpen] = useState(false);
    const [fundModalType, setFundModalType] = useState('add'); // add, withdraw, set
    const [fundAmount, setFundAmount] = useState('');
    const [fundLoading, setFundLoading] = useState(false);
    const [fundError, setFundError] = useState('');
    const [fundSuccess, setFundSuccess] = useState('');

    // Init date to today
    useEffect(() => {
        const preset = DATE_PRESETS.find((p) => p.id === 'today');
        if (preset) {
            const { from, to } = preset.getRange();
            setDateFrom(from);
            setDateTo(to);
        }
    }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setCalendarOpen(false);
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    // Fetch player
    useEffect(() => { fetchPlayer(); }, [userId]);

    // Fetch tab data when tab/date changes
    useEffect(() => {
        if (!userId || !player) return;
        if (activeTab === 'bets') fetchBets();
        if (activeTab === 'wallet') fetchWalletTx();
        if (activeTab === 'statement' && dateFrom && dateTo) fetchStatement();
    }, [activeTab, userId, player, dateFrom, dateTo]);

    const fetchPlayer = async () => {
        try {
            setLoading(true);
            setError('');
            const res = await fetch(`${API_BASE_URL}/users/${userId}`, { headers: getBookieAuthHeaders() });
            const data = await res.json();
            if (data.success) setPlayer(data.data);
            else setError(data.message || 'Player not found');
        } catch (err) {
            setError('Failed to load player');
        } finally {
            setLoading(false);
        }
    };

    const fetchBets = async () => {
        setLoadingTab(true);
        try {
            const params = new URLSearchParams({ userId });
            if (dateFrom) params.append('startDate', dateFrom);
            if (dateFrom && dateTo) params.append('endDate', dateTo);
            const res = await fetch(`${API_BASE_URL}/bets/history?${params}`, { headers: getBookieAuthHeaders() });
            const data = await res.json();
            setBets(data.success ? data.data || [] : []);
        } catch (err) {
            setBets([]);
        } finally {
            setLoadingTab(false);
        }
    };

    const fetchWalletTx = async () => {
        setLoadingTab(true);
        try {
            const res = await fetch(`${API_BASE_URL}/wallet/transactions?userId=${userId}`, { headers: getBookieAuthHeaders() });
            const data = await res.json();
            setWalletTx(data.success ? (data.data || []).reverse() : []);
        } catch (err) {
            setWalletTx([]);
        } finally {
            setLoadingTab(false);
        }
    };

    const fetchStatement = async () => {
        setLoadingTab(true);
        try {
            const [betsRes, txRes] = await Promise.all([
                fetch(`${API_BASE_URL}/bets/history?userId=${userId}&startDate=${dateFrom}&endDate=${dateTo}`, { headers: getBookieAuthHeaders() }),
                fetch(`${API_BASE_URL}/wallet/transactions?userId=${userId}`, { headers: getBookieAuthHeaders() }),
            ]);
            const betsData = await betsRes.json();
            const txData = await txRes.json();
            const betList = betsData.success ? betsData.data || [] : [];
            const txList = txData.success ? txData.data || [] : [];
            const start = new Date(dateFrom); start.setHours(0, 0, 0, 0);
            const end = new Date(dateTo); end.setHours(23, 59, 59, 999);

            const betRows = betList.filter((b) => { const d = new Date(b.createdAt); return d >= start && d <= end; }).map((b) => ({
                date: new Date(b.createdAt),
                type: b.marketId?.marketName || 'Bet',
                name: `${b.betType || ''} - ${b.betNumber || b._id?.slice(-6)}`,
                status: b.status === 'won' ? 'WIN' : b.status === 'lost' ? 'LOST' : 'BET',
                credited: b.status === 'won' ? (b.payout || 0) : 0,
                debited: b.status !== 'won' ? (b.amount || 0) : 0,
            }));

            const txRows = txList.filter((t) => { const d = new Date(t.createdAt); return d >= start && d <= end; }).map((t) => ({
                date: new Date(t.createdAt),
                type: 'Wallet',
                name: t.description || t._id?.slice(-6),
                status: t.type === 'credit' ? 'CREDIT' : 'DEBIT',
                credited: t.type === 'credit' ? (t.amount || 0) : 0,
                debited: t.type === 'debit' ? (t.amount || 0) : 0,
            }));

            const merged = [...betRows, ...txRows].sort((a, b) => a.date - b.date);
            let running = 0;
            const withBalance = merged.map((r) => {
                running = running + (r.credited || 0) - (r.debited || 0);
                return { ...r, runningBalance: running };
            });
            setStatementData(withBalance);
        } catch (err) {
            setStatementData([]);
        } finally {
            setLoadingTab(false);
        }
    };

    const handlePresetSelect = (presetId) => {
        const preset = DATE_PRESETS.find((p) => p.id === presetId);
        if (preset) {
            const { from, to } = preset.getRange();
            setDateFrom(from);
            setDateTo(to);
            setDatePreset(presetId);
            setCalendarOpen(false);
        }
    };

    const handleDateApply = () => {
        setDatePreset('custom');
        setCalendarOpen(false);
    };

    // Fund operations
    const openFundModal = (type) => {
        setFundModalType(type);
        setFundAmount('');
        setFundError('');
        setFundSuccess('');
        setFundModalOpen(true);
    };

    const handleFundSubmit = async () => {
        const num = Number(fundAmount);
        if (!Number.isFinite(num) || num <= 0) {
            setFundError('Enter a valid positive amount');
            return;
        }

        setFundError('');
        setFundSuccess('');
        setFundLoading(true);

        try {
            if (fundModalType === 'set') {
                const res = await fetch(`${API_BASE_URL}/wallet/set-balance`, {
                    method: 'PUT',
                    headers: getBookieAuthHeaders(),
                    body: JSON.stringify({ userId, balance: num }),
                });
                const data = await res.json();
                if (data.success) {
                    setFundSuccess(`Balance set to ${formatCurrency(num)}`);
                    fetchPlayer();
                    if (activeTab === 'wallet') fetchWalletTx();
                } else {
                    setFundError(data.message || 'Failed');
                }
            } else {
                const type = fundModalType === 'add' ? 'credit' : 'debit';
                if (type === 'debit' && (player?.walletBalance ?? 0) < num) {
                    setFundError('Insufficient balance to withdraw');
                    setFundLoading(false);
                    return;
                }
                const res = await fetch(`${API_BASE_URL}/wallet/adjust`, {
                    method: 'POST',
                    headers: getBookieAuthHeaders(),
                    body: JSON.stringify({ userId, amount: num, type }),
                });
                const data = await res.json();
                if (data.success) {
                    setFundSuccess(`${type === 'credit' ? 'Added' : 'Withdrawn'} ${formatCurrency(num)} successfully`);
                    fetchPlayer();
                    if (activeTab === 'wallet') fetchWalletTx();
                } else {
                    setFundError(data.message || 'Failed');
                }
            }
        } catch (err) {
            setFundError('Network error. Please try again.');
        } finally {
            setFundLoading(false);
        }
    };

    // Bet stats
    const betStats = {
        total: bets.length,
        won: bets.filter((b) => b.status === 'won').length,
        lost: bets.filter((b) => b.status === 'lost').length,
        pending: bets.filter((b) => b.status === 'pending').length,
        totalAmount: bets.reduce((s, b) => s + (b.amount || 0), 0),
        totalPayout: bets.filter((b) => b.status === 'won').reduce((s, b) => s + (b.payout || 0), 0),
    };

    const filteredBets = betFilter === 'all' ? bets : bets.filter((b) => b.status === betFilter);

    // Print bet history
    const handlePrintBets = () => {
        const printWindow = window.open('', '_blank', 'width=600,height=800');
        if (!printWindow) return;

        const betRows = filteredBets.map((b) => `
            <tr>
                <td>${b.betNumber || '—'}</td>
                <td>${b.betType || '—'}</td>
                <td>${b.marketId?.marketName || '—'}</td>
                <td style="text-align:right">${formatCurrency(b.amount)}</td>
                <td style="text-align:right; color:${b.status === 'won' ? '#16a34a' : '#666'}">${formatCurrency(b.payout || 0)}</td>
                <td><span class="status-${b.status}">${b.status}</span></td>
                <td>${new Date(b.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</td>
            </tr>
        `).join('');

        printWindow.document.write(`<!DOCTYPE html><html><head><title>Bet History - ${player?.username || ''}</title>
        <style>
            * { margin:0; padding:0; box-sizing:border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; font-size: 11px; color: #333; }
            h1 { font-size: 16px; color: #ea580c; margin-bottom: 4px; }
            .meta { color: #666; font-size: 10px; margin-bottom: 12px; }
            .stats { display: flex; gap: 16px; margin-bottom: 12px; padding: 8px; background: #f5f5f5; border-radius: 6px; }
            .stat { text-align: center; }
            .stat .label { font-size: 9px; color: #888; text-transform: uppercase; }
            .stat .value { font-size: 14px; font-weight: 700; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #f5f5f5; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; color: #666; border-bottom: 2px solid #ddd; }
            td { padding: 5px 8px; border-bottom: 1px solid #eee; }
            .status-won { color: #16a34a; font-weight: 600; text-transform: uppercase; }
            .status-lost { color: #dc2626; font-weight: 600; text-transform: uppercase; }
            .status-pending { color: #ea580c; font-weight: 600; text-transform: uppercase; }
            @media print { body { padding: 8px; } }
        </style></head><body>
            <h1>Bet History - ${player?.username || ''}</h1>
            <div class="meta">Phone: ${player?.phone || '—'} &nbsp;|&nbsp; Balance: ${formatCurrency(player?.walletBalance)} &nbsp;|&nbsp; Printed: ${new Date().toLocaleString('en-IN')}</div>
            <div class="stats">
                <div class="stat"><div class="label">Total</div><div class="value">${betStats.total}</div></div>
                <div class="stat"><div class="label">Won</div><div class="value" style="color:#16a34a">${betStats.won}</div></div>
                <div class="stat"><div class="label">Lost</div><div class="value" style="color:#dc2626">${betStats.lost}</div></div>
                <div class="stat"><div class="label">Pending</div><div class="value" style="color:#ea580c">${betStats.pending}</div></div>
                <div class="stat"><div class="label">Bet Amount</div><div class="value">${formatCurrency(betStats.totalAmount)}</div></div>
                <div class="stat"><div class="label">Winnings</div><div class="value" style="color:#16a34a">${formatCurrency(betStats.totalPayout)}</div></div>
            </div>
            <table>
                <thead><tr><th>Number</th><th>Type</th><th>Market</th><th style="text-align:right">Amount</th><th style="text-align:right">Payout</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>${betRows}</tbody>
            </table>
            <script>window.onload = function() { window.print(); window.close(); }<\/script>
        </body></html>`);
        printWindow.document.close();
    };

    if (loading) {
        return (
            <Layout title="Player">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 w-48 bg-gray-200 rounded" />
                    <div className="h-24 bg-gray-200 rounded-xl" />
                    <div className="h-10 w-full bg-gray-200 rounded" />
                </div>
            </Layout>
        );
    }

    if (error || !player) {
        return (
            <Layout title="Player">
                <div className="flex flex-col items-center justify-center min-h-[40vh]">
                    <p className="text-red-500 mb-4">{error || 'Player not found'}</p>
                    <Link to="/my-users" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white font-semibold">
                        <FaArrowLeft /> Back to My Players
                    </Link>
                </div>
            </Layout>
        );
    }

    return (
        <Layout title="Player">
            <div className="min-w-0 max-w-full space-y-5">
                {/* Breadcrumb */}
                <div>
                    <Link to="/my-users" className="text-gray-400 hover:text-orange-500 text-sm inline-flex items-center gap-1 mb-1">
                        <FaArrowLeft className="w-3 h-3" /> My Players
                    </Link>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
                        {player.username} <span className="text-gray-400 font-normal text-base">({player.phone || player.email || '—'})</span>
                    </h1>
                </div>

                {/* ========== PLAYER INFO CARD + QUICK ACTIONS ========== */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="p-4 sm:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            {/* Player details */}
                            <div className="flex-1 min-w-[200px]">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                                    <div>
                                        <p className="text-gray-400 text-xs uppercase tracking-wider">Name</p>
                                        <p className="text-gray-800 font-medium">{player.username}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 text-xs uppercase tracking-wider">Phone</p>
                                        <p className="text-gray-800">{player.phone || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 text-xs uppercase tracking-wider">Email</p>
                                        <p className="text-gray-800 truncate">{player.email || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 text-xs uppercase tracking-wider">Status</p>
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${player.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                            {player.isActive !== false ? 'Active' : 'Suspended'}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 text-xs uppercase tracking-wider">Source</p>
                                        <p className="text-gray-800 capitalize">{player.source === 'bookie' ? 'Bookie' : 'Super Admin'}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400 text-xs uppercase tracking-wider">Joined</p>
                                        <p className="text-gray-600 text-xs">{player.createdAt ? new Date(player.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Wallet balance card */}
                            <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl p-4 min-w-[180px] text-center shadow-lg">
                                <p className="text-white/80 text-xs uppercase tracking-wider mb-1">Wallet Balance</p>
                                <p className="text-2xl sm:text-3xl font-bold font-mono">{formatCurrency(player.walletBalance ?? 0)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Quick action buttons */}
                    <div className="border-t border-gray-100 px-4 sm:px-5 py-3 flex flex-wrap gap-2">
                        <button onClick={() => openFundModal('add')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm font-semibold transition-colors">
                            <FaPlusCircle className="w-3.5 h-3.5" /> Add Funds
                        </button>
                        <button onClick={() => openFundModal('withdraw')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs sm:text-sm font-semibold transition-colors">
                            <FaMinusCircle className="w-3.5 h-3.5" /> Withdraw
                        </button>
                        <button onClick={() => openFundModal('set')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white text-xs sm:text-sm font-semibold transition-colors">
                            <FaWallet className="w-3.5 h-3.5" /> Set Balance
                        </button>
                        <button onClick={() => navigate(`/games?playerId=${userId}`)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs sm:text-sm font-semibold transition-colors">
                            <FaGamepad className="w-3.5 h-3.5" /> Place Bet
                        </button>
                        <button onClick={() => { fetchPlayer(); if (activeTab === 'bets') fetchBets(); if (activeTab === 'wallet') fetchWalletTx(); }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs sm:text-sm font-semibold transition-colors ml-auto">
                            <FaSyncAlt className="w-3 h-3" /> Refresh
                        </button>
                    </div>
                </div>

                {/* ========== DATE RANGE SELECTOR ========== */}
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-gray-500 text-sm">Date:</span>
                    <div className="relative" ref={dropdownRef}>
                        <button
                            type="button"
                            onClick={() => setCalendarOpen((o) => !o)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 hover:border-orange-300 transition-colors"
                        >
                            <FaCalendarAlt className="w-3.5 h-3.5 text-orange-500" />
                            {dateFrom && dateTo ? formatDateRange(dateFrom, dateTo) : 'Select Date'}
                        </button>
                        {calendarOpen && (
                            <div className="absolute left-0 top-full mt-2 py-3 rounded-xl bg-white border border-gray-200 shadow-xl z-50 flex flex-col sm:flex-row gap-4 max-w-[100vw]">
                                <div className="min-w-0 sm:min-w-[200px] py-1">
                                    {DATE_PRESETS.map((p) => (
                                        <button key={p.id} type="button" onClick={() => handlePresetSelect(p.id)}
                                            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 flex items-center gap-2"
                                        >
                                            {datePreset === p.id ? <span className="text-orange-500">●</span> : <span className="w-2" />}
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="border-t sm:border-t-0 sm:border-l border-gray-200 pt-3 sm:pt-0 sm:pl-4 pr-4 min-w-0 sm:min-w-[200px]">
                                    <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Custom Range</div>
                                    <div className="space-y-2">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">From</label>
                                            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-800" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">To</label>
                                            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-800" />
                                        </div>
                                        <button type="button" onClick={handleDateApply} className="w-full py-2 rounded-lg bg-orange-500 text-white font-semibold text-sm">
                                            Apply
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ========== TABS ========== */}
                <div className="flex gap-1 border-b border-gray-200 overflow-x-auto scrollbar-thin">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-1.5 px-4 py-2.5 font-semibold text-sm whitespace-nowrap border-b-2 transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-orange-500 text-orange-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* ========== TAB CONTENT ========== */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden min-h-[200px]">

                    {/* ---- OVERVIEW ---- */}
                    {activeTab === 'overview' && (
                        <div className="p-4 sm:p-6 space-y-6">
                            {/* Profile Info */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <FaUser className="w-3.5 h-3.5 text-orange-500" /> Profile Details
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-sm">
                                    <div><p className="text-gray-400 text-xs uppercase">Username</p><p className="text-gray-800 font-mono">{player.username}</p></div>
                                    <div><p className="text-gray-400 text-xs uppercase">Email</p><p className="text-gray-800 truncate">{player.email || '—'}</p></div>
                                    <div><p className="text-gray-400 text-xs uppercase">Phone</p><p className="text-gray-800">{player.phone || '—'}</p></div>
                                    <div><p className="text-gray-400 text-xs uppercase">Role</p><p className="text-gray-800 capitalize">{player.role || 'Player'}</p></div>
                                    <div><p className="text-gray-400 text-xs uppercase">Balance</p><p className="text-green-600 font-mono font-bold">{formatCurrency(player.walletBalance ?? 0)}</p></div>
                                    <div><p className="text-gray-400 text-xs uppercase">Account</p><p className={player.isActive !== false ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>{player.isActive !== false ? 'Active' : 'Suspended'}</p></div>
                                    <div><p className="text-gray-400 text-xs uppercase">Created</p><p className="text-gray-600 text-xs">{player.createdAt ? new Date(player.createdAt).toLocaleString('en-IN') : '—'}</p></div>
                                    <div><p className="text-gray-400 text-xs uppercase">Player ID</p><p className="text-gray-500 font-mono text-xs truncate" title={player._id}>{player._id}</p></div>
                                    {player.lastLoginIp && <div><p className="text-gray-400 text-xs uppercase">Last IP</p><p className="text-gray-600 font-mono text-xs">{player.lastLoginIp === '::1' ? 'localhost' : player.lastLoginIp}</p></div>}
                                    {player.lastLoginDeviceId && <div className="col-span-2"><p className="text-gray-400 text-xs uppercase">Device ID</p><p className="text-gray-600 font-mono text-xs truncate">{player.lastLoginDeviceId}</p></div>}
                                </div>
                            </div>

                            {/* Quick bet stats overview */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <FaHistory className="w-3.5 h-3.5 text-orange-500" /> Quick Stats
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                                    <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                                        <p className="text-gray-400 text-[10px] uppercase">Total Bets</p>
                                        <p className="text-gray-800 font-bold text-lg">{betStats.total}</p>
                                    </div>
                                    <div className="bg-green-50 rounded-lg p-3 text-center border border-green-100">
                                        <p className="text-green-600 text-[10px] uppercase">Won</p>
                                        <p className="text-green-700 font-bold text-lg">{betStats.won}</p>
                                    </div>
                                    <div className="bg-red-50 rounded-lg p-3 text-center border border-red-100">
                                        <p className="text-red-500 text-[10px] uppercase">Lost</p>
                                        <p className="text-red-600 font-bold text-lg">{betStats.lost}</p>
                                    </div>
                                    <div className="bg-orange-50 rounded-lg p-3 text-center border border-orange-100">
                                        <p className="text-orange-500 text-[10px] uppercase">Pending</p>
                                        <p className="text-orange-600 font-bold text-lg">{betStats.pending}</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
                                        <p className="text-gray-400 text-[10px] uppercase">Bet Amount</p>
                                        <p className="text-gray-800 font-bold text-sm">{formatCurrency(betStats.totalAmount)}</p>
                                    </div>
                                    <div className="bg-green-50 rounded-lg p-3 text-center border border-green-100">
                                        <p className="text-green-600 text-[10px] uppercase">Winnings</p>
                                        <p className="text-green-700 font-bold text-sm">{formatCurrency(betStats.totalPayout)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ---- BET HISTORY ---- */}
                    {activeTab === 'bets' && (
                        <>
                            {/* Bet filter & actions bar */}
                            <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2">
                                <FaFilter className="w-3 h-3 text-gray-400" />
                                {['all', 'pending', 'won', 'lost'].map((f) => (
                                    <button
                                        key={f}
                                        onClick={() => setBetFilter(f)}
                                        className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-colors ${
                                            betFilter === f
                                                ? 'bg-orange-500 text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        {f} {f !== 'all' && `(${bets.filter((b) => b.status === f).length})`}
                                        {f === 'all' && `(${bets.length})`}
                                    </button>
                                ))}
                                <button onClick={handlePrintBets} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition-colors">
                                    <FaPrint className="w-3 h-3" /> Print
                                </button>
                            </div>

                            {/* Bet stats bar */}
                            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex flex-wrap gap-4 text-xs">
                                <span className="text-gray-500">Total: <span className="text-gray-800 font-bold">{betStats.total}</span></span>
                                <span className="text-gray-500">Amount: <span className="text-gray-800 font-bold">{formatCurrency(betStats.totalAmount)}</span></span>
                                <span className="text-gray-500">Winnings: <span className="text-green-600 font-bold">{formatCurrency(betStats.totalPayout)}</span></span>
                                <span className="text-gray-500">P/L: <span className={`font-bold ${betStats.totalPayout - betStats.totalAmount >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCurrency(betStats.totalPayout - betStats.totalAmount)}</span></span>
                            </div>

                            {loadingTab ? (
                                <div className="p-8 text-center text-gray-400">Loading...</div>
                            ) : filteredBets.length === 0 ? (
                                <div className="p-8 text-center text-gray-400">No bets found.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm min-w-[700px]">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Number</th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Market</th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Session</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Payout</th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {filteredBets.map((b) => (
                                                <tr key={b._id} className="hover:bg-gray-50">
                                                    <td className="px-3 py-2 font-mono font-bold text-orange-600">{b.betNumber || '—'}</td>
                                                    <td className="px-3 py-2 text-gray-600 capitalize text-xs">{b.betType || '—'}</td>
                                                    <td className="px-3 py-2 text-gray-600 text-xs truncate max-w-[120px]">{b.marketId?.marketName || '—'}</td>
                                                    <td className="px-3 py-2 text-gray-500 uppercase text-xs">{b.betOn || '—'}</td>
                                                    <td className="px-3 py-2 text-right font-mono text-gray-800">{formatCurrency(b.amount)}</td>
                                                    <td className="px-3 py-2 text-right font-mono text-green-600">{b.status === 'won' ? formatCurrency(b.payout) : '—'}</td>
                                                    <td className="px-3 py-2">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                            b.status === 'won' ? 'bg-green-100 text-green-700'
                                                            : b.status === 'lost' ? 'bg-red-100 text-red-600'
                                                            : 'bg-orange-100 text-orange-600'
                                                        }`}>{b.status}</span>
                                                    </td>
                                                    <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{new Date(b.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}

                    {/* ---- FUND HISTORY ---- */}
                    {activeTab === 'wallet' && (
                        <>
                            {loadingTab ? (
                                <div className="p-8 text-center text-gray-400">Loading...</div>
                            ) : walletTx.length === 0 ? (
                                <div className="p-8 text-center text-gray-400">No fund transactions.</div>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {walletTx.map((t) => (
                                        <div key={t._id} className="px-4 py-3 hover:bg-gray-50 flex flex-wrap items-center justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${t.type === 'credit' ? 'bg-green-100' : 'bg-red-100'}`}>
                                                    {t.type === 'credit'
                                                        ? <FaPlusCircle className="w-4 h-4 text-green-600" />
                                                        : <FaMinusCircle className="w-4 h-4 text-red-500" />
                                                    }
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-gray-800 text-sm font-medium truncate">{t.description || '—'}</p>
                                                    <p className="text-gray-400 text-xs">{new Date(t.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</p>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className={`font-mono font-bold text-sm ${t.type === 'credit' ? 'text-green-600' : 'text-red-500'}`}>
                                                    {t.type === 'credit' ? '+' : '-'}{formatCurrency(t.amount)}
                                                </p>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${t.type === 'credit' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
                                                    {t.type}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* ---- STATEMENT ---- */}
                    {activeTab === 'statement' && (
                        <>
                            {loadingTab ? (
                                <div className="p-8 text-center text-gray-400">Loading...</div>
                            ) : statementData.length === 0 ? (
                                <div className="p-8 text-center text-gray-400">No transactions in this period.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm min-w-[700px]">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Credit</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Debit</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {statementData.map((row, i) => (
                                                <tr key={i} className="hover:bg-gray-50">
                                                    <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{row.date.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</td>
                                                    <td className="px-3 py-2 text-gray-700 text-xs">{row.type}</td>
                                                    <td className="px-3 py-2 text-orange-600 font-mono text-xs truncate max-w-[200px]">{row.name}</td>
                                                    <td className="px-3 py-2">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                            row.status === 'WIN' || row.status === 'CREDIT' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                                                        }`}>{row.status}</span>
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-mono text-green-600 text-xs">{row.credited ? formatCurrency(row.credited) : '—'}</td>
                                                    <td className="px-3 py-2 text-right font-mono text-red-500 text-xs">{row.debited ? formatCurrency(row.debited) : '—'}</td>
                                                    <td className="px-3 py-2 text-right font-mono text-gray-800 font-bold text-xs">{formatCurrency(row.runningBalance)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* ========== FUND MODAL ========== */}
                {fundModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30">
                        <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-sm">
                            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                                <h3 className="text-base font-bold text-gray-800 capitalize">
                                    {fundModalType === 'add' && '💰 Add Funds'}
                                    {fundModalType === 'withdraw' && '💸 Withdraw Funds'}
                                    {fundModalType === 'set' && '⚙️ Set Balance'}
                                </h3>
                                <button type="button" onClick={() => setFundModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg font-bold">×</button>
                            </div>
                            <div className="p-4 space-y-4">
                                {/* Current balance */}
                                <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                                    <p className="text-gray-400 text-xs uppercase">Current Balance</p>
                                    <p className="text-green-600 font-mono font-bold text-xl">{formatCurrency(player.walletBalance ?? 0)}</p>
                                </div>

                                {fundError && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-3 py-2">{fundError}</div>}
                                {fundSuccess && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2">{fundSuccess}</div>}

                                {!fundSuccess && (
                                    <>
                                        <div>
                                            <label className="block text-gray-600 text-sm font-medium mb-1.5">
                                                {fundModalType === 'set' ? 'New Balance Amount' : 'Amount'}
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    placeholder="0"
                                                    value={fundAmount}
                                                    onChange={(e) => setFundAmount(e.target.value.replace(/[^0-9]/g, '').slice(0, 12))}
                                                    className="w-full pl-8 pr-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-800 font-mono text-lg text-center focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                                    autoFocus
                                                />
                                            </div>
                                            {fundModalType === 'withdraw' && (
                                                <p className="text-xs text-gray-400 mt-1">Max: {formatCurrency(player.walletBalance ?? 0)}</p>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleFundSubmit}
                                            disabled={fundLoading || !fundAmount}
                                            className={`w-full font-bold py-3 rounded-lg text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                                                fundModalType === 'add' ? 'bg-green-600 hover:bg-green-700'
                                                : fundModalType === 'withdraw' ? 'bg-red-500 hover:bg-red-600'
                                                : 'bg-orange-500 hover:bg-orange-600'
                                            }`}
                                        >
                                            {fundLoading ? (
                                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <>
                                                    {fundModalType === 'add' && <><FaPlusCircle className="w-4 h-4" /> Add Funds</>}
                                                    {fundModalType === 'withdraw' && <><FaMinusCircle className="w-4 h-4" /> Withdraw</>}
                                                    {fundModalType === 'set' && <><FaWallet className="w-4 h-4" /> Set Balance</>}
                                                </>
                                            )}
                                        </button>
                                    </>
                                )}

                                {fundSuccess && (
                                    <button type="button" onClick={() => setFundModalOpen(false)} className="w-full py-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold transition-colors">
                                        Done
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default PlayerDetail;
