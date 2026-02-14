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

    // Market filter for fund history
    const [marketFilter, setMarketFilter] = useState('all'); // all or marketId
    const [markets, setMarkets] = useState([]);

    // Fund modal
    const [fundModalOpen, setFundModalOpen] = useState(false);
    const [fundModalType, setFundModalType] = useState('add'); // add, withdraw, set
    const [fundAmount, setFundAmount] = useState('');
    const [fundLoading, setFundLoading] = useState(false);
    const [fundError, setFundError] = useState('');
    const [fundSuccess, setFundSuccess] = useState('');

    // To Give / To Take modal
    const [toGiveTakeModalOpen, setToGiveTakeModalOpen] = useState(false);
    const [toGiveValue, setToGiveValue] = useState('');
    const [toTakeValue, setToTakeValue] = useState('');
    const [toGiveTakeLoading, setToGiveTakeLoading] = useState(false);
    const [toGiveTakeError, setToGiveTakeError] = useState('');
    const [toGiveTakeSuccess, setToGiveTakeSuccess] = useState('');


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

    // Initialize toGive and toTake when player loads
    useEffect(() => {
        if (player) {
            setToGiveValue((player.toGive ?? 0).toString());
            setToTakeValue((player.toTake ?? 0).toString());
        }
    }, [player]);

    // Fetch markets when component mounts
    useEffect(() => {
        fetchMarkets();
    }, []);

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

    const fetchMarkets = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/markets/get-markets?marketType=main`, { headers: getBookieAuthHeaders() });
            const data = await res.json();
            if (data.success) {
                setMarkets(data.data || []);
            }
        } catch (err) {
            setMarkets([]);
        }
    };

    const fetchWalletTx = async () => {
        setLoadingTab(true);
        try {
            const res = await fetch(`${API_BASE_URL}/wallet/transactions?userId=${userId}&includeBet=1`, { headers: getBookieAuthHeaders() });
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

            // Aggregate bet amounts (don't show individual bets)
            const filteredBets = betList.filter((b) => {
                const d = new Date(b.createdAt);
                return d >= start && d <= end;
            });
            
            const totalBetAmount = filteredBets.reduce((sum, b) => sum + (b.amount || 0), 0);
            const totalWinAmount = filteredBets.filter(b => b.status === 'won').reduce((sum, b) => sum + (b.payout || 0), 0);
            const totalLossAmount = filteredBets.filter(b => b.status === 'lost').reduce((sum, b) => sum + (b.amount || 0), 0);
            const totalPendingBets = filteredBets.filter(b => b.status === 'pending').reduce((sum, b) => sum + (b.amount || 0), 0);

            // Aggregate wallet transactions
            const filteredTx = txList.filter((t) => {
                const d = new Date(t.createdAt);
                return d >= start && d <= end;
            });

            const totalDeposits = filteredTx.filter(t => t.type === 'credit' && (t.description?.toLowerCase().includes('deposit') || t.description?.toLowerCase().includes('add fund'))).reduce((sum, t) => sum + (t.amount || 0), 0);
            const totalWithdrawals = filteredTx.filter(t => t.type === 'debit' && (t.description?.toLowerCase().includes('withdraw') || t.description?.toLowerCase().includes('withdrawal'))).reduce((sum, t) => sum + (t.amount || 0), 0);
            const totalOtherCredits = filteredTx.filter(t => t.type === 'credit' && !t.description?.toLowerCase().includes('deposit') && !t.description?.toLowerCase().includes('add fund')).reduce((sum, t) => sum + (t.amount || 0), 0);
            const totalOtherDebits = filteredTx.filter(t => t.type === 'debit' && !t.description?.toLowerCase().includes('withdraw') && !t.description?.toLowerCase().includes('withdrawal')).reduce((sum, t) => sum + (t.amount || 0), 0);

            // Calculate net amounts
            const totalCredits = totalWinAmount + totalDeposits + totalOtherCredits;
            const totalDebits = totalBetAmount + totalWithdrawals + totalOtherDebits;
            const netAmount = totalCredits - totalDebits;

            // Create summary statement
            const summary = {
                period: { from: dateFrom, to: dateTo },
                player: player ? { name: player.username, phone: player.phone, id: player._id } : null,
                bets: {
                    totalAmount: totalBetAmount,
                    totalWin: totalWinAmount,
                    totalLoss: totalLossAmount,
                    totalPending: totalPendingBets,
                    count: filteredBets.length,
                },
                wallet: {
                    deposits: totalDeposits,
                    withdrawals: totalWithdrawals,
                    otherCredits: totalOtherCredits,
                    otherDebits: totalOtherDebits,
                },
                totals: {
                    totalCredits,
                    totalDebits,
                    netAmount,
                },
                currentBalance: player?.walletBalance || 0,
            };

            setStatementData([summary]);
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

    const openToGiveTakeModal = () => {
        setToGiveValue((player?.toGive ?? 0).toString());
        setToTakeValue((player?.toTake ?? 0).toString());
        setToGiveTakeError('');
        setToGiveTakeSuccess('');
        setToGiveTakeModalOpen(true);
    };

    const handleToGiveTakeSubmit = async () => {
        const numToGive = Number(toGiveValue);
        const numToTake = Number(toTakeValue);
        
        if (!Number.isFinite(numToGive) || numToGive < 0) {
            setToGiveTakeError('To Give must be a non-negative number');
            return;
        }
        if (!Number.isFinite(numToTake) || numToTake < 0) {
            setToGiveTakeError('To Take must be a non-negative number');
            return;
        }

        setToGiveTakeError('');
        setToGiveTakeSuccess('');
        setToGiveTakeLoading(true);

        try {
            const res = await fetch(`${API_BASE_URL}/users/${userId}/to-give-take`, {
                method: 'PATCH',
                headers: getBookieAuthHeaders(),
                body: JSON.stringify({ toGive: numToGive, toTake: numToTake }),
            });
            const data = await res.json();
            if (data.success) {
                setToGiveTakeSuccess('Updated successfully');
                fetchPlayer();
            } else {
                setToGiveTakeError(data.message || 'Failed to update');
            }
        } catch (err) {
            setToGiveTakeError('Network error. Please try again.');
        } finally {
            setToGiveTakeLoading(false);
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

                            {/* Wallet balance and To Give/Take cards */}
                            <div className="flex flex-col gap-3 min-w-[180px]">
                                <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl p-4 text-center shadow-lg">
                                    <p className="text-white/80 text-xs uppercase tracking-wider mb-1">Wallet Balance</p>
                                    <p className="text-2xl sm:text-3xl font-bold font-mono">{formatCurrency(player.walletBalance ?? 0)}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg p-3 text-center">
                                        <p className="text-white/80 text-[10px] uppercase tracking-wider mb-0.5">To Give</p>
                                        <p className="text-lg font-bold font-mono">{formatCurrency(player.toGive ?? 0)}</p>
                                    </div>
                                    <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg p-3 text-center">
                                        <p className="text-white/80 text-[10px] uppercase tracking-wider mb-0.5">To Take</p>
                                        <p className="text-lg font-bold font-mono">{formatCurrency(player.toTake ?? 0)}</p>
                                    </div>
                                </div>
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
                        <button onClick={openToGiveTakeModal} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs sm:text-sm font-semibold transition-colors">
                            <FaExchangeAlt className="w-3.5 h-3.5" /> To Give/Take
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
                                    <div><p className="text-gray-400 text-xs uppercase">To Give</p><p className="text-blue-600 font-mono font-bold">{formatCurrency(player.toGive ?? 0)}</p></div>
                                    <div><p className="text-gray-400 text-xs uppercase">To Take</p><p className="text-red-600 font-mono font-bold">{formatCurrency(player.toTake ?? 0)}</p></div>
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
                            {/* Market Filter */}
                            <div className="mb-4 flex items-center gap-3">
                                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                    <FaFilter className="w-4 h-4" />
                                    Filter by Market:
                                </label>
                                <select
                                    value={marketFilter}
                                    onChange={(e) => setMarketFilter(e.target.value)}
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                >
                                    <option value="all">All Markets</option>
                                    {markets.map((m) => (
                                        <option key={m._id || m.id} value={m._id || m.id}>
                                            {m.marketName}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {loadingTab ? (
                                <div className="p-8 text-center text-gray-400">Loading...</div>
                            ) : (() => {
                                // Filter transactions by market
                                const filteredTx = marketFilter === 'all' 
                                    ? walletTx 
                                    : walletTx.filter((t) => {
                                        // Only filter bet-related transactions
                                        if (t.bet && t.bet.marketId) {
                                            const txMarketId = String(t.bet.marketId);
                                            const filterMarketId = String(marketFilter);
                                            return txMarketId === filterMarketId;
                                        }
                                        // Non-bet transactions are shown when "All Markets" is selected
                                        return false;
                                    });

                                return filteredTx.length === 0 ? (
                                    <div className="p-8 text-center text-gray-400">No fund transactions{marketFilter !== 'all' ? ' for selected market' : ''}.</div>
                                ) : (
                                    <div className="divide-y divide-gray-100">
                                        {filteredTx.map((t) => (
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
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <p className="text-gray-400 text-xs">{new Date(t.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</p>
                                                            {t.bet && t.bet.marketName && (
                                                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700">
                                                                    {t.bet.marketName}
                                                                </span>
                                                            )}
                                                        </div>
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
                                );
                            })()}
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
                                <div id="statement-slip" className="bg-white p-6 max-w-2xl mx-auto print:p-8 print:max-w-none">
                                    {/* Print button */}
                                    <div className="mb-4 print:hidden flex justify-end">
                                        <button
                                            onClick={() => window.print()}
                                            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
                                        >
                                            <FaPrint className="w-4 h-4" />
                                            Print Statement
                                        </button>
                                    </div>

                                    {/* Statement Slip */}
                                    {statementData.map((summary, i) => (
                                        <div key={i} className="border-2 border-gray-300 rounded-lg p-6 print:border-gray-800 print:rounded-none">
                                            {/* Header */}
                                            <div className="text-center mb-6 pb-4 border-b-2 border-gray-300 print:border-gray-800">
                                                <h2 className="text-2xl font-bold text-gray-800 mb-2">ACCOUNT STATEMENT</h2>
                                                <p className="text-sm text-gray-600">
                                                    {summary.period.from && summary.period.to && formatDateRange(summary.period.from, summary.period.to)}
                                                </p>
                                            </div>

                                            {/* Player Info */}
                                            {summary.player && (
                                                <div className="mb-6 pb-4 border-b border-gray-200">
                                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                                        <div>
                                                            <p className="text-gray-500 mb-1">Player Name</p>
                                                            <p className="font-semibold text-gray-800">{summary.player.name}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-gray-500 mb-1">Phone</p>
                                                            <p className="font-semibold text-gray-800">{summary.player.phone || '—'}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Bet Summary */}
                                            <div className="mb-6 pb-4 border-b border-gray-200">
                                                <h3 className="text-lg font-bold text-gray-800 mb-3">BET SUMMARY</h3>
                                                <div className="space-y-2 text-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Total Bets Placed</span>
                                                        <span className="font-mono font-semibold text-gray-800">{summary.bets.count} bets</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Total Bet Amount</span>
                                                        <span className="font-mono font-semibold text-red-600">{formatCurrency(summary.bets.totalAmount)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Total Win Amount</span>
                                                        <span className="font-mono font-semibold text-green-600">{formatCurrency(summary.bets.totalWin)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Total Loss Amount</span>
                                                        <span className="font-mono font-semibold text-red-600">{formatCurrency(summary.bets.totalLoss)}</span>
                                                    </div>
                                                    {summary.bets.totalPending > 0 && (
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-600">Pending Bets</span>
                                                            <span className="font-mono font-semibold text-orange-600">{formatCurrency(summary.bets.totalPending)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Wallet Summary */}
                                            <div className="mb-6 pb-4 border-b border-gray-200">
                                                <h3 className="text-lg font-bold text-gray-800 mb-3">WALLET TRANSACTIONS</h3>
                                                <div className="space-y-2 text-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Total Deposits</span>
                                                        <span className="font-mono font-semibold text-green-600">{formatCurrency(summary.wallet.deposits)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Total Withdrawals</span>
                                                        <span className="font-mono font-semibold text-red-600">{formatCurrency(summary.wallet.withdrawals)}</span>
                                                    </div>
                                                    {summary.wallet.otherCredits > 0 && (
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-600">Other Credits</span>
                                                            <span className="font-mono font-semibold text-green-600">{formatCurrency(summary.wallet.otherCredits)}</span>
                                                        </div>
                                                    )}
                                                    {summary.wallet.otherDebits > 0 && (
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-600">Other Debits</span>
                                                            <span className="font-mono font-semibold text-red-600">{formatCurrency(summary.wallet.otherDebits)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Totals */}
                                            <div className="mb-6 pb-4 border-b-2 border-gray-300 print:border-gray-800">
                                                <h3 className="text-lg font-bold text-gray-800 mb-3">TOTALS</h3>
                                                <div className="space-y-2 text-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Total Credits</span>
                                                        <span className="font-mono font-semibold text-green-600">{formatCurrency(summary.totals.totalCredits)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Total Debits</span>
                                                        <span className="font-mono font-semibold text-red-600">{formatCurrency(summary.totals.totalDebits)}</span>
                                                    </div>
                                                    <div className="flex justify-between pt-2 border-t border-gray-200">
                                                        <span className="text-gray-800 font-bold">Net Amount</span>
                                                        <span className={`font-mono font-bold text-lg ${summary.totals.netAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {formatCurrency(summary.totals.netAmount)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Current Status */}
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                                    <span className="text-gray-700 font-semibold">Current Wallet Balance</span>
                                                    <span className="font-mono font-bold text-xl text-gray-800">{formatCurrency(summary.currentBalance)}</span>
                                                </div>
                                                
                                                {/* To Give & To Take Section - Editable */}
                                                <div className="border-t-2 border-gray-300 pt-4 mt-4 print:border-gray-800">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <h3 className="text-lg font-bold text-gray-800 print:text-base">TO GIVE / TO TAKE</h3>
                                                        <button
                                                            onClick={() => {
                                                                setToGiveValue((player?.toGive ?? 0).toString());
                                                                setToTakeValue((player?.toTake ?? 0).toString());
                                                                setToGiveTakeModalOpen(true);
                                                            }}
                                                            className="print:hidden text-orange-600 hover:text-orange-700 text-sm font-medium underline flex items-center gap-1"
                                                        >
                                                            <FaExchangeAlt className="w-3 h-3" /> Edit
                                                        </button>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 print:bg-transparent print:border print:border-blue-300">
                                                            <p className="text-gray-600 text-sm mb-1">To Give</p>
                                                            <p className="font-mono font-bold text-2xl text-blue-600 print:text-lg">{formatCurrency(player?.toGive ?? 0)}</p>
                                                            <p className="text-xs text-gray-500 mt-1 print:hidden">Money to give to player</p>
                                                        </div>
                                                        <div className="bg-red-50 rounded-lg p-4 border border-red-200 print:bg-transparent print:border print:border-red-300">
                                                            <p className="text-gray-600 text-sm mb-1">To Take</p>
                                                            <p className="font-mono font-bold text-2xl text-red-600 print:text-lg">{formatCurrency(player?.toTake ?? 0)}</p>
                                                            <p className="text-xs text-gray-500 mt-1 print:hidden">Money to take from player</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Footer */}
                                            <div className="mt-6 pt-4 border-t border-gray-200 text-center text-xs text-gray-500">
                                                <p>Generated on {new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })}</p>
                                                <p className="mt-1">This is a computer-generated statement</p>
                                            </div>
                                        </div>
                                    ))}
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

                {/* ========== TO GIVE / TO TAKE MODAL ========== */}
                {toGiveTakeModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30">
                        <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-sm">
                            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                                <h3 className="text-base font-bold text-gray-800">💰 To Give / To Take</h3>
                                <button type="button" onClick={() => setToGiveTakeModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg font-bold">×</button>
                            </div>
                            <div className="p-4 space-y-4">
                                {toGiveTakeError && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-3 py-2">{toGiveTakeError}</div>}
                                {toGiveTakeSuccess && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2">{toGiveTakeSuccess}</div>}

                                {!toGiveTakeSuccess && (
                                    <>
                                        <div>
                                            <label className="block text-gray-600 text-sm font-medium mb-1.5">To Give (Money to give to player)</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    placeholder="0"
                                                    value={toGiveValue}
                                                    onChange={(e) => setToGiveValue(e.target.value.replace(/[^0-9.]/g, '').slice(0, 12))}
                                                    className="w-full pl-8 pr-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-800 font-mono text-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                    autoFocus
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-gray-600 text-sm font-medium mb-1.5">To Take (Money to take from player)</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    placeholder="0"
                                                    value={toTakeValue}
                                                    onChange={(e) => setToTakeValue(e.target.value.replace(/[^0-9.]/g, '').slice(0, 12))}
                                                    className="w-full pl-8 pr-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-800 font-mono text-lg text-center focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                                />
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleToGiveTakeSubmit}
                                            disabled={toGiveTakeLoading}
                                            className="w-full font-bold py-3 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {toGiveTakeLoading ? (
                                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <>💾 Update</>
                                            )}
                                        </button>
                                    </>
                                )}

                                {toGiveTakeSuccess && (
                                    <button type="button" onClick={() => setToGiveTakeModalOpen(false)} className="w-full py-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold transition-colors">
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
