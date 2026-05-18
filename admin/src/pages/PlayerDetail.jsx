import React, { useState, useEffect, useRef, useMemo } from 'react';
import AdminLayout from '../components/AdminLayout';
import AdminTableFrame from '../components/AdminTableFrame';
import BetHistoryCard from '../components/BetHistoryCard';
import RouletteBetHistoryCard from '../components/RouletteBetHistoryCard';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { FaArrowLeft, FaCalendarAlt, FaUserSlash, FaUserCheck, FaTrash, FaWallet, FaPrint, FaFilter, FaChevronRight, FaChevronDown } from 'react-icons/fa';
import useModalBackHandler from '../hooks/useModalBackHandler';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';
import { getAuthHeaders, clearAdminSession, fetchWithAuth } from '../lib/auth';
import { formatPlayerIp } from '../utils/ipDisplay';

const TABS = [
    { id: 'wallet', label: 'Wallet Statement' },
    { id: 'bets', label: 'Bet History' },
    { id: 'game-history', label: 'Game History' },
    { id: 'lottery', label: 'Lottery History' },
    { id: 'profile', label: 'Profile' },
];

const formatTxnTime = (iso) => {
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '-';
        const date = d.toLocaleDateString('en-GB').replace(/\//g, '-');
        const time = d
            .toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
            .replace(/\s/g, ' ')
            .toLowerCase();
        return `${date} ${time}`;
    } catch {
        return '-';
    }
};

const normalizeMarketName = (s) => (s || '').toString().trim().toLowerCase();
const detectGameName = (text) => {
    const s = normalizeMarketName(text);
    if (s.includes('aviator')) return 'Aviator';
    if (s.includes('funtimer') || s.includes('fun timer')) return 'FunTimer';
    if (s.includes('roulette')) return 'Roulette';
    return '';
};
const detectTransactionGameName = (txn) =>
    detectGameName(txn?.description || '') ||
    detectGameName(txn?.bet?.marketName || '') ||
    detectGameName(txn?.marketName || '') ||
    detectGameName(txn?.gameName || '');
const parseRoundId = (text) => {
    const s = String(text || '');
    const m = s.match(/roundId=([^|]+)/i);
    return m && m[1] ? String(m[1]).trim() : '';
};
const parseGameBetNumber = (txn) => {
    const directCandidates = [
        txn?.betNumber,
        txn?.selectedNumber,
        txn?.betNo,
        txn?.bet_no,
        txn?.number,
        txn?.selection,
        txn?.selectedNo,
        txn?.bet?.betNumber,
        txn?.bet?.selectedNumber,
        txn?.bet?.betNo,
        txn?.bet?.bet_no,
        txn?.bet?.number,
        txn?.bet?.selection,
        txn?.bet?.selectedNo,
    ];

    for (const candidate of directCandidates) {
        const value = String(candidate ?? '').trim();
        if (value) return value;
    }

    const source = [txn?.description, txn?.bet?.description, txn?.bet?.marketName].filter(Boolean).join(' | ');
    const patterns = [
        /(?:bet(?:\s*no|\s*number)?|number|selectedNumber|selection|selected\s*no|bet_on|bet no)\s*[:=-]\s*([a-z0-9_-]+)/i,
        /\b(?:on|num(?:ber)?|bet)\s+([a-z0-9_-]+)/i,
        /([a-z0-9_-]+)\s*(?:number|no)\b/i,
    ];

    for (const pattern of patterns) {
        const match = source.match(pattern);
        if (match?.[1]) return String(match[1]).trim();
    }

    return '';
};

const buildGameRoundRows = (transactions, gameName) => {
    const debitRows = [];
    const knownRoundIds = new Set();
    const byRef = new Map();
    const byRound = new Map();

    for (const t of transactions || []) {
        const desc = String(t?.description || '');
        const g = detectGameName(desc) || detectGameName(t?.bet?.marketName || '');
        const type = String(t?.type || '').toLowerCase();
        if (type !== 'debit' || g !== gameName) continue;

        const roundId = parseRoundId(desc);
        const refId = String(t?.referenceId || '').trim();
        const key = refId || String(t?._id || '').trim();
        if (!key) continue;
        if (roundId) knownRoundIds.add(roundId);

        const row = {
            key,
            betId: key,
            roundId: roundId || '',
            refId: refId || '',
            betAmount: Number(t?.amount || 0) || 0,
            cashOutAmount: null,
            createdAt: t?.createdAt || null,
            gameName,
            betNumber: parseGameBetNumber(t),
        };
        const idx = debitRows.push(row) - 1;
        if (refId) byRef.set(refId, idx);
        if (roundId) {
            const arr = byRound.get(roundId) || [];
            arr.push(idx);
            byRound.set(roundId, arr);
        }
    }

    for (const t of transactions || []) {
        const type = String(t?.type || '').toLowerCase();
        if (type !== 'credit') continue;
        const desc = String(t?.description || '');
        const creditRoundId = parseRoundId(desc);
        const creditRef = String(t?.referenceId || '').trim();
        const directGame = detectTransactionGameName(t);
        if (directGame && directGame !== gameName) continue;
        if (!directGame && !creditRef && !(creditRoundId && knownRoundIds.has(creditRoundId))) continue;

        let matchIndex = -1;
        if (creditRef && byRef.has(creditRef)) {
            matchIndex = byRef.get(creditRef);
        } else if (creditRoundId && knownRoundIds.has(creditRoundId) && byRound.has(creditRoundId)) {
            const candidates = byRound.get(creditRoundId) || [];
            matchIndex = candidates.find((i) => debitRows[i] && debitRows[i].cashOutAmount == null) ?? candidates[0] ?? -1;
        }
        if (matchIndex < 0 || !debitRows[matchIndex]) continue;

        const amount = Number(t?.amount || 0) || 0;
        if (amount > 0) debitRows[matchIndex].cashOutAmount = amount;
        if (!debitRows[matchIndex].createdAt || new Date(t?.createdAt || 0).getTime() > new Date(debitRows[matchIndex].createdAt || 0).getTime()) {
            debitRows[matchIndex].createdAt = t?.createdAt || debitRows[matchIndex].createdAt;
        }
    }

    return debitRows
        .filter((x) => Number.isFinite(Number(x.betAmount)))
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .map((x, i) => ({
            ...x,
            index: i + 1,
            timeFormatted: formatTxnTime(x.createdAt),
        }));
};

const buildAggregatedGameRoundRows = (transactions, gameName) => {
    const grouped = new Map();
    const knownRoundIds = new Set();
    const allTransactions = Array.isArray(transactions) ? transactions : [];

    const ensureRow = (groupKey, txn) => {
        if (!grouped.has(groupKey)) {
            grouped.set(groupKey, {
                key: groupKey,
                betId: groupKey,
                roundId: groupKey,
                betAmount: 0,
                cashOutAmount: 0,
                createdAt: txn?.createdAt || null,
                gameName,
            });
        }
        return grouped.get(groupKey);
    };

    for (const txn of allTransactions) {
        const type = String(txn?.type || '').toLowerCase();
        if (type !== 'debit') continue;
        const desc = String(txn?.description || '');
        if (detectTransactionGameName(txn) !== gameName) continue;
        const groupKey = String(parseRoundId(desc) || txn?.referenceId || txn?._id || '').trim();
        if (!groupKey) continue;

        knownRoundIds.add(groupKey);
        const row = ensureRow(groupKey, txn);
        row.betAmount += Number(txn?.amount || 0) || 0;
        if (!row.createdAt || new Date(txn?.createdAt || 0).getTime() > new Date(row.createdAt || 0).getTime()) {
            row.createdAt = txn?.createdAt || row.createdAt;
        }
    }

    for (const txn of allTransactions) {
        const type = String(txn?.type || '').toLowerCase();
        if (type !== 'credit') continue;
        const desc = String(txn?.description || '');
        const groupKey = String(parseRoundId(desc) || txn?.referenceId || txn?._id || '').trim();
        if (!groupKey) continue;
        const detectedGame = detectTransactionGameName(txn);
        const belongsToGame = detectedGame === gameName || (!detectedGame && knownRoundIds.has(groupKey));
        if (!belongsToGame || !knownRoundIds.has(groupKey)) continue;

        const row = ensureRow(groupKey, txn);
        row.cashOutAmount += Number(txn?.amount || 0) || 0;
        if (!row.createdAt || new Date(txn?.createdAt || 0).getTime() > new Date(row.createdAt || 0).getTime()) {
            row.createdAt = txn?.createdAt || row.createdAt;
        }
    }

    return Array.from(grouped.values())
        .filter((row) => Number(row.betAmount || 0) > 0)
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .map((row, index) => ({
            ...row,
            index: index + 1,
            timeFormatted: formatTxnTime(row.createdAt),
        }));
};

const formatDateRange = (from, to) => {
    if (!from || !to) return '';
    const a = new Date(from);
    const b = new Date(to);
    return `${a.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' })} ~ ${b.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' })}`;
};

const STATEMENT_PRESETS = [
    { id: 'today', label: '1 Day (Today)', getRange: () => {
        const d = new Date();
        const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return { from, to: from };
    }},
    { id: 'tomorrow', label: 'Tomorrow', getRange: () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return { from, to: from };
    }},
    { id: 'this_week', label: 'This Week', getRange: () => {
        const d = new Date();
        const day = d.getDay();
        const sun = new Date(d);
        sun.setDate(d.getDate() - day);
        const sat = new Date(sun);
        sat.setDate(sun.getDate() + 6);
        const fmt = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
        return { from: fmt(sun), to: fmt(sat) };
    }},
    { id: 'last_week', label: 'Last Week', getRange: () => {
        const d = new Date();
        const day = d.getDay();
        const sun = new Date(d);
        sun.setDate(d.getDate() - day - 7);
        const sat = new Date(sun);
        sat.setDate(sun.getDate() + 6);
        const fmt = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
        return { from: fmt(sun), to: fmt(sat) };
    }},
    { id: 'this_month', label: 'This Month', getRange: () => {
        const d = new Date();
        const y = d.getFullYear(), m = d.getMonth();
        const last = new Date(y, m + 1, 0);
        const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
        const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
        return { from, to };
    }},
    { id: 'last_month', label: 'Last Month', getRange: () => {
        const d = new Date();
        const y = d.getFullYear(), m = d.getMonth() - 1;
        const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
        const last = new Date(y, m + 1, 0);
        const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
        return { from, to };
    }},
];

const LOTTERY_PAGE_SIZE = 25;
const formatTicketTail = (ticketId) => {
    const raw = String(ticketId || '').trim();
    if (!raw) return '—';
    return raw.slice(-8).toUpperCase();
};

const PlayerDetail = () => {
    const { userId } = useParams();
    const navigate = useNavigate();
    const [player, setPlayer] = useState(null);
    const [activeTab, setActiveTab] = useState('wallet');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [statementFrom, setStatementFrom] = useState('');
    const [statementTo, setStatementTo] = useState('');
    const [statementPreset, setStatementPreset] = useState('today');
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [statementData, setStatementData] = useState([]);
    const [walletTx, setWalletTx] = useState([]);
    const [bets, setBets] = useState([]);
    const [gameTransactions, setGameTransactions] = useState([]);
    const [gameHistoryFilter, setGameHistoryFilter] = useState('all');
    const [gameHistorySearch, setGameHistorySearch] = useState('');
    const [betHistorySearch, setBetHistorySearch] = useState('');
    const [lottery2dHistory, setLottery2dHistory] = useState(null);
    const [lottery3dHistory, setLottery3dHistory] = useState(null);
    const [lotteryHistory, setLotteryHistory] = useState({ twoD: [], threeD: [] });
    const [lotteryHasMore, setLotteryHasMore] = useState({ twoD: false, threeD: false });
    const [lotteryPage, setLotteryPage] = useState(1);
    const [loadingLotteryPage, setLoadingLotteryPage] = useState(false);
    const [expandedLotteryTickets, setExpandedLotteryTickets] = useState({});
    const [lotterySourceFilter, setLotterySourceFilter] = useState('all_lottery');
    const [lotteryStatusFilter, setLotteryStatusFilter] = useState('all');
    const [lotterySearch, setLotterySearch] = useState('');
    const [loadingTab, setLoadingTab] = useState(false);
    const [togglingStatus, setTogglingStatus] = useState(false);
    const [toggleMessage, setToggleMessage] = useState('');
    const [deletingPlayer, setDeletingPlayer] = useState(false);
    const [walletModalOpen, setWalletModalOpen] = useState(false);
    const [walletAdjustAmount, setWalletAdjustAmount] = useState('');
    const [walletActionLoading, setWalletActionLoading] = useState(false);
    const [walletActionError, setWalletActionError] = useState('');
    const [playerPasswordModalOpen, setPlayerPasswordModalOpen] = useState(false);
    const [newPlayerPassword, setNewPlayerPassword] = useState('');
    const [confirmPlayerPassword, setConfirmPlayerPassword] = useState('');
    const [playerPasswordLoading, setPlayerPasswordLoading] = useState(false);
    const [playerPasswordError, setPlayerPasswordError] = useState('');
    const [playerPasswordSuccess, setPlayerPasswordSuccess] = useState('');
    const dropdownRef = useRef(null);

    useEffect(() => {
        const admin = localStorage.getItem('admin');
        if (!admin) {
            navigate('/');
            return;
        }
        fetchPlayer();
    }, [userId, navigate]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setCalendarOpen(false);
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!statementFrom || !statementTo) {
            const preset = STATEMENT_PRESETS.find((p) => p.id === 'today');
            const { from, to } = preset ? preset.getRange() : { from: '', to: '' };
            if (from) setStatementFrom(from);
            if (to) setStatementTo(to);
        }
    }, []);

    useEffect(() => {
        if (!userId || !player) return;
        if (activeTab === 'statement' && statementFrom && statementTo) fetchStatement();
        if (activeTab === 'wallet') fetchWalletTx();
        if (activeTab === 'bets') fetchBets();
        if (activeTab === 'game-history') fetchGameHistory();
        if (activeTab === 'lottery') fetchLotteryHistory();
    }, [activeTab, userId, player, statementFrom, statementTo]);

    const fetchPlayer = async () => {
        try {
            setLoading(true);
            setError('');
            const res = await fetchWithAuth(`${API_BASE_URL}/users/${userId}`);
            if (res.status === 401) return;
            const data = await res.json();
            if (data.success) {
                setPlayer(data.data);
            } else {
                setError(data.message || 'Player not found');
            }
        } catch (err) {
            setError('Failed to load player');
        } finally {
            setLoading(false);
        }
    };

    const fetchStatement = async () => {
        if (!userId) return;
        setLoadingTab(true);
        try {
            const [betsRes, txRes] = await Promise.all([
                fetchWithAuth(`${API_BASE_URL}/bets/history?userId=${userId}&startDate=${statementFrom}&endDate=${statementTo}`),
                fetchWithAuth(`${API_BASE_URL}/wallet/transactions?userId=${userId}`),
            ]);
            if (betsRes.status === 401 || txRes.status === 401) return;
            const betsData = await betsRes.json();
            const txData = await txRes.json();
            const betList = betsData.success ? betsData.data || [] : [];
            const txList = txData.success ? txData.data || [] : [];

            const start = new Date(statementFrom);
            start.setHours(0, 0, 0, 0);
            const end = new Date(statementTo);
            end.setHours(23, 59, 59, 999);

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
                period: { from: statementFrom, to: statementTo },
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

    const fetchWalletTx = async () => {
        if (!userId) return;
        setLoadingTab(true);
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/wallet/transactions?userId=${userId}`);
            if (res.status === 401) return;
            const data = await res.json();
            setWalletTx(data.success ? (data.data || []).reverse() : []);
        } catch (err) {
            setWalletTx([]);
        } finally {
            setLoadingTab(false);
        }
    };

    const fetchBets = async () => {
        if (!userId) return;
        setLoadingTab(true);
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/bets/history?userId=${userId}`);
            if (res.status === 401) return;
            const data = await res.json();
            setBets(data.success ? data.data || [] : []);
        } catch (err) {
            setBets([]);
        } finally {
            setLoadingTab(false);
        }
    };

    const fetchGameHistory = async () => {
        if (!userId) return;
        setLoadingTab(true);
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/wallet/transactions?userId=${userId}&includeBet=1`);
            if (res.status === 401) return;
            const data = await res.json();
            setGameTransactions(data.success ? data.data || [] : []);
        } catch (err) {
            setGameTransactions([]);
        } finally {
            setLoadingTab(false);
        }
    };

    const fetchLotteryHistory = async ({ lotteryPageToFetch = 1, appendLottery = false, lotteryOnly = false } = {}) => {
        if (!userId) return;
        if (lotteryOnly) setLoadingLotteryPage(true);
        else setLoadingTab(true);
        if (!appendLottery) {
            setExpandedLotteryTickets({});
        }
        try {
            const lotteryParams = `limit=${LOTTERY_PAGE_SIZE}&page=${lotteryPageToFetch}`;
            const [res2d, res3d] = await Promise.all([
                fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/players/${encodeURIComponent(userId)}/history?${lotteryParams}`),
                fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/players/${encodeURIComponent(userId)}/history?${lotteryParams}`),
            ]);
            if (res2d.status === 401 || res3d.status === 401) return;
            const data2d = await res2d.json();
            const data3d = await res3d.json();

            const toTicketStatus = (bets = []) => {
                const outcomes = bets.map((bet) => String(bet?.outcome || 'pending').toLowerCase());
                if (outcomes.some((outcome) => outcome === 'win')) return 'win';
                if (outcomes.some((outcome) => outcome === 'pending')) return 'pending';
                return outcomes.length ? 'lose' : 'pending';
            };

            const flattenLotteryRows = (slots, mode) => {
                if (!Array.isArray(slots)) return [];
                return slots.map((slot, index) => {
                    const bets = Array.isArray(slot?.bets) ? slot.bets : [];
                    const amount = bets.reduce((sum, bet) => sum + Number(bet?.amount || 0), 0);
                    const payout = bets.reduce((sum, bet) => sum + Number(bet?.payout || 0), 0);
                    const createdAt = slot?.slotStartIso || bets[0]?.createdAt || null;
                    const setSummary = Array.from(new Set(
                        bets.map((bet) => String(bet?.setLabel || '').trim()).filter(Boolean),
                    )).join(', ');
                    const ticketIdRaw =
                        slot?.ticketId ||
                        slot?.ticketNo ||
                        slot?.ticketNumber ||
                        bets.find((bet) => bet?.ticketId)?.ticketId ||
                        bets.find((bet) => bet?.ticketNo)?.ticketNo ||
                        bets.find((bet) => bet?.ticketNumber)?.ticketNumber ||
                        '';
                    const ticketId = String(ticketIdRaw || '').trim();
                    const safeTicketId = ticketId || `TICKET-${mode}-${index + 1}`;

                    return {
                        id: `${mode}-${safeTicketId}-${slot?.slotStartIso || index}`,
                        ticketId: safeTicketId,
                        mode,
                        slotLabel: slot?.drawLabelEnd || '—',
                        slotStartIso: slot?.slotStartIso || '',
                        setLabel: setSummary || '—',
                        betCount: bets.length,
                        bets: bets.map((bet, betIndex) => ({
                            id: bet?.betId || bet?._id || `${slot?.slotStartIso || 'slot'}-${betIndex}`,
                            setLabel: bet?.setLabel || '—',
                            number: bet?.number || '—',
                            amount: Number(bet?.amount || 0),
                            payout: Number(bet?.payout || 0),
                            outcome: String(bet?.outcome || 'pending').toLowerCase(),
                            createdAt: bet?.createdAt || slot?.slotStartIso || null,
                        })),
                        amount,
                        payout,
                        outcome: toTicketStatus(bets),
                        createdAt,
                    };
                });
            };

            const nextTwoD = flattenLotteryRows(data2d?.success ? data2d?.data?.slots : [], '2D');
            const nextThreeD = flattenLotteryRows(data3d?.success ? data3d?.data?.slots : [], '3D');
            setLottery2dHistory(data2d?.success ? data2d.data || null : null);
            setLottery3dHistory(data3d?.success ? data3d.data || null : null);
            setLotteryHasMore({
                twoD: Boolean(data2d?.data?.pagination?.hasMore),
                threeD: Boolean(data3d?.data?.pagination?.hasMore),
            });
            setLotteryPage(lotteryPageToFetch);
            setLotteryHistory((prev) => {
                if (!appendLottery) return { twoD: nextTwoD, threeD: nextThreeD };
                const mergeUnique = (existingRows, newRows) => {
                    const map = new Map();
                    [...(existingRows || []), ...(newRows || [])].forEach((row) => {
                        map.set(row.id, row);
                    });
                    return Array.from(map.values()).sort(
                        (a, b) => new Date(b.slotStartIso || b.createdAt || 0).getTime() - new Date(a.slotStartIso || a.createdAt || 0).getTime(),
                    );
                };
                return {
                    twoD: mergeUnique(prev.twoD, nextTwoD),
                    threeD: mergeUnique(prev.threeD, nextThreeD),
                };
            });
        } catch (err) {
            setLottery2dHistory(null);
            setLottery3dHistory(null);
            setLotteryHistory({ twoD: [], threeD: [] });
            setLotteryHasMore({ twoD: false, threeD: false });
        } finally {
            if (lotteryOnly) setLoadingLotteryPage(false);
            else setLoadingTab(false);
        }
    };

    const handleLoadMoreLottery = () => {
        fetchLotteryHistory({ lotteryPageToFetch: lotteryPage + 1, appendLottery: true, lotteryOnly: true });
    };

    const toggleLotteryTicket = (ticketId) => {
        if (!ticketId) return;
        setExpandedLotteryTickets((prev) => ({ ...prev, [ticketId]: !prev[ticketId] }));
    };

    const aviatorGameRows = buildGameRoundRows(gameTransactions, 'Aviator');
    const funTimerGameRows = buildAggregatedGameRoundRows(gameTransactions, 'FunTimer');
    const rouletteGameRows = buildGameRoundRows(gameTransactions, 'Roulette');
    const filteredBets = (bets || []).filter((bet) => {
        const query = betHistorySearch.trim().toLowerCase();
        if (!query) return true;
        const betId = String(bet?._id || '').toLowerCase();
        const betNumber = String(bet?.betNumber || '').toLowerCase();
        return betId.includes(query) || betNumber.includes(query);
    });
    const lotteryRowsByMode = useMemo(() => ({
        twoD: lotteryHistory.twoD || [],
        threeD: lotteryHistory.threeD || [],
    }), [lotteryHistory]);
    const selectedLotteryRows = useMemo(() => {
        if (lotterySourceFilter === 'lottery_2d') return lotteryRowsByMode.twoD;
        if (lotterySourceFilter === 'lottery_3d') return lotteryRowsByMode.threeD;
        return [...lotteryRowsByMode.twoD, ...lotteryRowsByMode.threeD];
    }, [lotterySourceFilter, lotteryRowsByMode]);
    const lotterySearchFilteredRows = useMemo(() => selectedLotteryRows.filter((row) => {
        const q = lotterySearch.trim().toLowerCase();
        if (!q) return true;
        const hay = `${row.ticketId} ${row.betCount} ${row.setLabel} ${row.slotLabel} ${row.mode}`.toLowerCase();
        return hay.includes(q);
    }), [selectedLotteryRows, lotterySearch]);
    const toBetStatus = (outcome) => {
        if (outcome === 'win') return 'won';
        if (outcome === 'lose') return 'lost';
        return 'pending';
    };
    const lotteryFilteredRows = lotteryStatusFilter === 'all'
        ? lotterySearchFilteredRows
        : lotterySearchFilteredRows.filter((row) => toBetStatus(row.outcome) === lotteryStatusFilter);
    const lotteryFilterCounts = useMemo(() => ({
        all: lotterySearchFilteredRows.length,
        pending: lotterySearchFilteredRows.filter((row) => toBetStatus(row.outcome) === 'pending').length,
        won: lotterySearchFilteredRows.filter((row) => toBetStatus(row.outcome) === 'won').length,
        lost: lotterySearchFilteredRows.filter((row) => toBetStatus(row.outcome) === 'lost').length,
    }), [lotterySearchFilteredRows]);
    const displayedLotteryStats = useMemo(() => ({
        total: lotterySearchFilteredRows.length,
        won: lotterySearchFilteredRows.filter((row) => toBetStatus(row.outcome) === 'won').length,
        lost: lotterySearchFilteredRows.filter((row) => toBetStatus(row.outcome) === 'lost').length,
        pending: lotterySearchFilteredRows.filter((row) => toBetStatus(row.outcome) === 'pending').length,
        totalAmount: lotterySearchFilteredRows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
        totalPayout: lotterySearchFilteredRows.filter((row) => toBetStatus(row.outcome) === 'won').reduce((sum, row) => sum + Number(row.payout || 0), 0),
    }), [lotterySearchFilteredRows]);
    const canLoadMoreLottery = useMemo(() => {
        if (lotterySourceFilter === 'lottery_2d') return lotteryHasMore.twoD;
        if (lotterySourceFilter === 'lottery_3d') return lotteryHasMore.threeD;
        return lotteryHasMore.twoD || lotteryHasMore.threeD;
    }, [lotterySourceFilter, lotteryHasMore]);
    const gameHistorySections = [
        { key: 'aviator', title: 'Aviator Game History', rows: aviatorGameRows, game: 'Aviator' },
        { key: 'funtimer', title: 'FunTimer Game History', rows: funTimerGameRows, game: 'FunTimer' },
        { key: 'roulette', title: 'Roulette Game History', rows: rouletteGameRows, game: 'Roulette' },
    ];
    const filteredGameHistorySections = (gameHistoryFilter === 'all'
        ? gameHistorySections
        : gameHistorySections.filter((section) => section.key === gameHistoryFilter)
    ).map((section) => ({
        ...section,
        rows: (section.rows || []).filter((row) => {
            const query = gameHistorySearch.trim().toLowerCase();
            if (!query) return true;
            const betId = String(row?.betId || '').toLowerCase();
            return betId.includes(query);
        }),
    }));

    const handleLogout = () => {
        clearAdminSession();
        navigate('/');
    };

    const handleDateApply = () => {
        setStatementPreset('custom');
        setCalendarOpen(false);
        if (activeTab === 'statement') fetchStatement();
    };

    const [hasSecretDeclarePassword, setHasSecretDeclarePassword] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [secretPassword, setSecretPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [pendingAction, setPendingAction] = useState(null);
    const closeWalletModal = useModalBackHandler(walletModalOpen, () => setWalletModalOpen(false));
    const closePlayerPasswordModal = useModalBackHandler(playerPasswordModalOpen, () => setPlayerPasswordModalOpen(false));
    const closeSecretModal = useModalBackHandler(showPasswordModal, () => {
        setShowPasswordModal(false);
        setPendingAction(null);
        setSecretPassword('');
        setPasswordError('');
    });

    useEffect(() => {
        fetchWithAuth(`${API_BASE_URL}/admin/me/secret-declare-password-status`)
            .then((res) => { if (res.status === 401) return; return res.json(); })
            .then((json) => {
                if (json && json.success) setHasSecretDeclarePassword(json.hasSecretDeclarePassword || false);
            })
            .catch(() => setHasSecretDeclarePassword(false));
    }, []);

    const performTogglePlayerStatus = async (secretDeclarePasswordValue) => {
        if (!userId) return;
        setTogglingStatus(true);
        setToggleMessage('');
        setError('');
        setPasswordError('');
        try {
            const opts = { method: 'PATCH' };
            if (secretDeclarePasswordValue) opts.body = JSON.stringify({ secretDeclarePassword: secretDeclarePasswordValue });
            const res = await fetchWithAuth(`${API_BASE_URL}/users/${userId}/toggle-status`, opts);
            if (res.status === 401) return;
            const data = await res.json();
            if (data.success) {
                setShowPasswordModal(false);
                setPendingAction(null);
                setSecretPassword('');
                setToggleMessage(data.data.isActive ? 'Player unsuspended successfully' : 'Player suspended successfully');
                fetchPlayer();
                setTimeout(() => setToggleMessage(''), 3000);
            } else {
                if (data.code === 'INVALID_SECRET_DECLARE_PASSWORD') {
                    setPasswordError(data.message || 'Invalid secret password');
                } else {
                    setToggleMessage(data.message || 'Failed to update status');
                }
            }
        } catch (err) {
            setToggleMessage('Network error. Please try again.');
        } finally {
            setTogglingStatus(false);
        }
    };

    const handleTogglePlayerStatus = () => {
        if (!userId) return;
        if (hasSecretDeclarePassword) {
            setPendingAction('suspend');
            setShowPasswordModal(true);
            setSecretPassword('');
            setPasswordError('');
        } else {
            performTogglePlayerStatus('');
        }
    };

    const handlePresetSelect = (presetId) => {
        const preset = STATEMENT_PRESETS.find((p) => p.id === presetId);
        if (preset) {
            const { from, to } = preset.getRange();
            setStatementFrom(from);
            setStatementTo(to);
            setStatementPreset(presetId);
            setCalendarOpen(false);
            if (activeTab === 'statement') fetchStatement();
        }
    };

    const handleWalletAdjust = async (type) => {
        const amount = Number(walletAdjustAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            setWalletActionError('Enter a valid positive amount');
            return;
        }
        if (type === 'debit' && (player?.walletBalance ?? 0) < amount) {
            setWalletActionError('Insufficient balance to deduct');
            return;
        }
        setWalletActionError('');
        setWalletActionLoading(true);
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/wallet/adjust`, {
                method: 'POST',
                body: JSON.stringify({ userId, amount, type }),
            });
            if (res.status === 401) return;
            const data = await res.json();
            if (data.success) {
                setWalletAdjustAmount('');
                fetchPlayer();
                if (activeTab === 'wallet') fetchWalletTx();
                setWalletModalOpen(false);
            } else {
                setWalletActionError(data.message || 'Failed to update wallet');
            }
        } catch (err) {
            setWalletActionError('Network error. Please try again.');
        } finally {
            setWalletActionLoading(false);
        }
    };

    const openPlayerPasswordModal = () => {
        setPlayerPasswordModalOpen(true);
        setNewPlayerPassword('');
        setConfirmPlayerPassword('');
        setPlayerPasswordError('');
        setPlayerPasswordSuccess('');
    };

    const handlePlayerPasswordSubmit = async () => {
        const pwd = newPlayerPassword.trim();
        const confirmPwd = confirmPlayerPassword.trim();
        if (!pwd || pwd.length < 6) {
            setPlayerPasswordError('Password must be at least 6 characters');
            return;
        }
        if (pwd !== confirmPwd) {
            setPlayerPasswordError('Passwords do not match');
            return;
        }
        setPlayerPasswordLoading(true);
        setPlayerPasswordError('');
        setPlayerPasswordSuccess('');
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/users/${userId}/password`, {
                method: 'PATCH',
                body: JSON.stringify({ password: pwd }),
            });
            if (res.status === 401) return;
            const data = await res.json();
            if (data.success) {
                setPlayerPasswordSuccess('Password updated successfully');
                setNewPlayerPassword('');
                setTimeout(() => {
                    setPlayerPasswordModalOpen(false);
                    setPlayerPasswordSuccess('');
                }, 1500);
            } else {
                setPlayerPasswordError(data.message || 'Failed to update password');
            }
        } catch (err) {
            setPlayerPasswordError('Network error. Please try again.');
        } finally {
            setPlayerPasswordLoading(false);
        }
    };

    const performDeletePlayer = async (secretDeclarePasswordValue) => {
        if (!userId || !player?.username) return;
        if (!window.confirm(`Delete player "${player.username}"? This will remove their account and wallet. This cannot be undone.`)) return;
        setDeletingPlayer(true);
        setError('');
        setPasswordError('');
        try {
            const opts = { method: 'DELETE' };
            if (secretDeclarePasswordValue) opts.body = JSON.stringify({ secretDeclarePassword: secretDeclarePasswordValue });
            const res = await fetchWithAuth(`${API_BASE_URL}/users/${userId}`, opts);
            if (res.status === 401) return;
            const data = await res.json();
            if (data.success) {
                setShowPasswordModal(false);
                setPendingAction(null);
                setSecretPassword('');
                navigate('/all-users');
            } else {
                if (data.code === 'INVALID_SECRET_DECLARE_PASSWORD') {
                    setPasswordError(data.message || 'Invalid secret password');
                } else {
                    setError(data.message || 'Failed to delete player');
                }
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setDeletingPlayer(false);
        }
    };

    const handleDeletePlayer = () => {
        if (!userId || !player?.username) return;
        if (hasSecretDeclarePassword) {
            setPendingAction('delete');
            setShowPasswordModal(true);
            setSecretPassword('');
            setPasswordError('');
        } else {
            performDeletePlayer('');
        }
    };

    const handlePasswordSubmit = (e) => {
        e.preventDefault();
        const val = secretPassword.trim();
        if (hasSecretDeclarePassword && !val) {
            setPasswordError('Please enter the secret declare password');
            return;
        }
        if (pendingAction === 'suspend') performTogglePlayerStatus(val);
        else if (pendingAction === 'delete') performDeletePlayer(val);
    };

    const formatCurrency = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
    const formatNumber = (n) => Number(n || 0).toLocaleString('en-IN');

    // Device ID: use lastLoginDeviceId, or latest device from loginDevices when available
    const displayDeviceId = (() => {
        if (player?.lastLoginDeviceId) return player.lastLoginDeviceId;
        const devices = Array.isArray(player?.loginDevices) ? player.loginDevices : [];
        if (devices.length === 0) return null;
        const sorted = [...devices].sort((a, b) => new Date(b.lastLoginAt || 0) - new Date(a.lastLoginAt || 0));
        return sorted[0]?.deviceId || null;
    })();

    const bonusBalanceOwner =
        player?.source === 'bookie' || player?.source === 'super_bookie'
            ? {
                type: player.source === 'super_bookie' ? 'super_bookie' : 'bookie',
                name: player?.referrerChain?.superBookie?.username || player?.referrerChain?.bookie?.username || player?.referredBy?.username || 'Unknown',
            }
            : {
                type: 'admin',
                name: 'Admin',
            };

    if (loading) {
        return (
            <AdminLayout onLogout={handleLogout} title="Player">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 w-48 bg-gray-100 rounded" />
                    <div className="h-24 bg-gray-100 rounded-xl" />
                    <div className="h-10 w-full bg-gray-100 rounded" />
                </div>
            </AdminLayout>
        );
    }

    if (error || !player) {
        return (
            <AdminLayout onLogout={handleLogout} title="Player">
                <div className="flex flex-col items-center justify-center min-h-[40vh]">
                    <p className="text-red-500 mb-4">{error || 'Player not found'}</p>
                    <Link to="/all-users" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-gray-800 font-semibold">
                        <FaArrowLeft /> Back to All Players
                    </Link>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout onLogout={handleLogout} title="Player">
            <div className="min-w-0 max-w-full">
            {/* Breadcrumb */}
            <div className="mb-4">
                <Link to="/all-users" className="text-gray-400 hover:text-orange-500 text-sm inline-flex items-center gap-1 mb-2">
                    <FaArrowLeft className="w-4 h-4" /> All Players
                </Link>
                <h1 className="text-2xl sm:text-3xl font-bold">Player <span className="text-gray-400 font-normal">» {player.username}</span></h1>
            </div>

            {/* Player info card - responsive, no overflow */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6 min-w-0">
                <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-orange-500">Player Information</h2>
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={handleTogglePlayerStatus}
                            disabled={togglingStatus || deletingPlayer}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                player.isActive !== false
                                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            }`}
                        >
                            {togglingStatus ? (
                                <span className="animate-spin">⏳</span>
                            ) : player.isActive !== false ? (
                                <><FaUserSlash className="w-4 h-4" /> Suspend</>
                            ) : (
                                <><FaUserCheck className="w-4 h-4" /> Unsuspend</>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setWalletModalOpen(true); setWalletActionError(''); setWalletAdjustAmount(''); setWalletSetBalance(''); }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-700 hover:bg-emerald-600 text-white transition-colors"
                            title="Edit wallet"
                        >
                            <FaWallet className="w-4 h-4" /> Edit Wallet
                        </button>
                        <button
                            type="button"
                            onClick={handleDeletePlayer}
                            disabled={deletingPlayer}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-gray-200 hover:bg-red-600 text-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete player"
                        >
                            {deletingPlayer ? <span className="animate-spin">⏳</span> : <><FaTrash className="w-4 h-4" /> Delete</>}
                        </button>
                        <button
                            type="button"
                            onClick={openPlayerPasswordModal}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                            title="Set player password"
                        >
                            Set Password
                        </button>
                        <Link
                            to={`/all-users/${userId}/devices`}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                Array.isArray(player.loginDevices) && player.loginDevices.length > 1
                                    ? 'bg-red-50 border border-red-600 text-red-600 hover:bg-red-800 hover:border-red-500 hover:text-red-100'
                                    : 'bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200 hover:border-orange-300 hover:text-orange-500'
                            }`}
                            title="Devices used"
                        >
                            Devices used
                            {Array.isArray(player.loginDevices) && player.loginDevices.length > 0 && (
                                <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                                    player.loginDevices.length > 1 ? 'bg-red-800 text-red-600' : 'bg-gray-200 text-gray-600'
                                }`}>
                                    {player.loginDevices.length}
                                </span>
                            )}
                        </Link>
                        {toggleMessage && (
                            <span className={`text-sm ${toggleMessage.includes('success') ? 'text-green-600' : 'text-red-500'}`}>
                                {toggleMessage}
                            </span>
                        )}
                    </div>
                </div>
                <div className="p-4 sm:p-6 min-w-0">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 text-sm">
                        <div className="min-w-0">
                            <p className="text-gray-500 uppercase tracking-wider text-xs">UserID</p>
                            <p className="text-gray-800 font-mono truncate" title={player.username}>{player.username}</p>
                        </div>
                        <div className="min-w-0">
                            <p className="text-gray-500 uppercase tracking-wider text-xs">First Name</p>
                            <p className="text-gray-800 truncate">{player.username || '—'}</p>
                        </div>
                        <div className="min-w-0">
                            <p className="text-gray-500 uppercase tracking-wider text-xs">Last Name</p>
                            <p className="text-gray-800">—</p>
                        </div>
                        <div className="min-w-0">
                            <p className="text-gray-500 uppercase tracking-wider text-xs">Email</p>
                            <p className="text-gray-800 truncate" title={player.email}>{player.email || '—'}</p>
                        </div>
                        <div className="min-w-0">
                            <p className="text-gray-500 uppercase tracking-wider text-xs">Name</p>
                            <p className="text-gray-800 truncate">{player.username}</p>
                        </div>
                        <div className="min-w-0 col-span-2 sm:col-span-1">
                            <p className="text-gray-500 uppercase tracking-wider text-xs">Id</p>
                            <p className="text-gray-600 font-mono text-xs truncate break-all" title={player._id}>{player._id}</p>
                        </div>
                        <div className="min-w-0 col-span-2 sm:col-span-1">
                            <p className="text-gray-500 uppercase tracking-wider text-xs">Device ID</p>
                            <p className="text-gray-600 font-mono text-xs truncate break-all" title={displayDeviceId || ''}>{displayDeviceId || '—'}</p>
                        </div>
                        <div className="min-w-0 col-span-2 sm:col-span-1">
                            <p className="text-gray-500 uppercase tracking-wider text-xs">IP Address</p>
                            <p className="text-gray-600 font-mono text-xs truncate" title={formatPlayerIp(player.lastLoginIp)}>
                                {formatPlayerIp(player.lastLoginIp)}
                            </p>
                        </div>
                        <div className="min-w-0">
                            <p className="text-gray-500 uppercase tracking-wider text-xs">Status</p>
                            <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium border ${player.isActive !== false ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-rose-100 text-rose-700 border-rose-300'}`}>
                                {player.isActive !== false ? 'ALLOW' : 'SUSPENDED'}
                            </span>
                        </div>
                        <div className="min-w-0">
                            <p className="text-gray-500 uppercase tracking-wider text-xs">Balance</p>
                            <p className="text-green-600 font-mono font-semibold">₹{Math.floor(Number(player.walletBalance ?? 0)).toLocaleString('en-IN')}</p>
                        </div>
                        <div className="min-w-0">
                            <p className="text-gray-500 uppercase tracking-wider text-xs">Exchange Balance</p>
                            <p className="text-gray-600">0</p>
                        </div>
                        <div className="min-w-0">
                            <p className="text-gray-500 uppercase tracking-wider text-xs">Bonus Balance</p>
                            <p className="text-gray-600">0</p>
                        </div>
                        <div className="min-w-0">
                            <p className="uppercase tracking-wider text-xs text-blue-600">
                                {bonusBalanceOwner.type === 'bookie' ? 'Bookie' : 'Admin'}
                            </p>
                            <p
                                className="text-sm whitespace-nowrap text-blue-700"
                                title={bonusBalanceOwner.name}
                            >
                                {bonusBalanceOwner.name}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Multiple devices warning (admin-only) – red when multiple devices */}
            {Array.isArray(player.loginDevices) && player.loginDevices.length > 1 && (
                <div className="mb-4 min-w-0">
                    <div className="rounded-xl border border-red-500/60 bg-red-500/10 px-4 py-3 text-red-600 text-sm font-medium">
                        ⚠️ User has logged in from multiple devices
                    </div>
                </div>
            )}
            {/* Date range - visible for all tabs (Statement, Wallet, Bet History, Profile) */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-gray-400 text-sm">Date range:</span>
                    <div className="relative" ref={dropdownRef}>
                        <button
                            type="button"
                            onClick={() => setCalendarOpen((o) => !o)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 border border-gray-200 text-sm text-gray-600"
                        >
                            <FaCalendarAlt className="w-4 h-4 text-orange-500" />
                            {statementFrom && statementTo ? formatDateRange(statementFrom, statementTo) : 'Select Date'}
                        </button>
                        {calendarOpen && (
                            <div className="absolute left-0 top-full mt-2 py-3 rounded-xl bg-white border border-gray-200 shadow-xl z-50 flex flex-col sm:flex-row gap-4 max-w-[100vw]">
                                <div className="min-w-0 sm:min-w-[200px] py-1">
                                    {STATEMENT_PRESETS.map((p) => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => handlePresetSelect(p.id)}
                                            className="w-full text-left px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 flex items-center gap-2"
                                        >
                                            {statementPreset === p.id ? <span className="text-orange-500">●</span> : <span className="w-2" />}
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="border-t sm:border-t-0 sm:border-l border-gray-200 pt-3 sm:pt-0 sm:pl-4 pr-4 min-w-0 sm:min-w-[200px]">
                                    <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Custom Date Range</div>
                                    <div className="space-y-2">
                                        <div>
                                            <label className="block text-xs text-gray-400 mb-1">From</label>
                                            <input type="date" value={statementFrom} onChange={(e) => setStatementFrom(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-gray-100 border border-gray-200 text-sm text-gray-800" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-400 mb-1">To</label>
                                            <input type="date" value={statementTo} onChange={(e) => setStatementTo(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-gray-100 border border-gray-200 text-sm text-gray-800" />
                                        </div>
                                        <button type="button" onClick={handleDateApply} className="w-full py-2 rounded-lg bg-orange-500 text-gray-800 font-semibold text-sm">
                                            Apply
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-4 border-b border-gray-200 pb-2">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${activeTab === tab.id ? 'bg-orange-500 text-gray-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab content - no horizontal scroll, responsive */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden min-h-[200px] min-w-0 max-w-full">
                {activeTab === 'statement' && (
                    <>
                        {loadingTab ? (
                            <div className="p-8 text-center text-gray-400">Loading...</div>
                        ) : statementData.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">No transactions in this period.</div>
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
                                                    <span className="font-mono font-semibold text-red-600">₹{Number(summary.bets.totalAmount || 0).toLocaleString('en-IN')}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Total Win Amount</span>
                                                    <span className="font-mono font-semibold text-green-600">₹{Number(summary.bets.totalWin || 0).toLocaleString('en-IN')}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Total Loss Amount</span>
                                                    <span className="font-mono font-semibold text-red-600">₹{Number(summary.bets.totalLoss || 0).toLocaleString('en-IN')}</span>
                                                </div>
                                                {summary.bets.totalPending > 0 && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Pending Bets</span>
                                                        <span className="font-mono font-semibold text-orange-600">₹{Number(summary.bets.totalPending || 0).toLocaleString('en-IN')}</span>
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
                                                    <span className="font-mono font-semibold text-green-600">₹{Number(summary.wallet.deposits || 0).toLocaleString('en-IN')}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Total Withdrawals</span>
                                                    <span className="font-mono font-semibold text-red-600">₹{Number(summary.wallet.withdrawals || 0).toLocaleString('en-IN')}</span>
                                                </div>
                                                {summary.wallet.otherCredits > 0 && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Other Credits</span>
                                                        <span className="font-mono font-semibold text-green-600">₹{Number(summary.wallet.otherCredits || 0).toLocaleString('en-IN')}</span>
                                                    </div>
                                                )}
                                                {summary.wallet.otherDebits > 0 && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Other Debits</span>
                                                        <span className="font-mono font-semibold text-red-600">₹{Number(summary.wallet.otherDebits || 0).toLocaleString('en-IN')}</span>
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
                                                    <span className="font-mono font-semibold text-green-600">₹{Number(summary.totals.totalCredits || 0).toLocaleString('en-IN')}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Total Debits</span>
                                                    <span className="font-mono font-semibold text-red-600">₹{Number(summary.totals.totalDebits || 0).toLocaleString('en-IN')}</span>
                                                </div>
                                                <div className="flex justify-between pt-2 border-t border-gray-200">
                                                    <span className="text-gray-800 font-bold">Net Amount</span>
                                                    <span className={`font-mono font-bold text-lg ${summary.totals.netAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        ₹{Number(summary.totals.netAmount || 0).toLocaleString('en-IN')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Current Status */}
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                                <span className="text-gray-700 font-semibold">Current Wallet Balance</span>
                                                <span className="font-mono font-bold text-xl text-gray-800">₹{Number(summary.currentBalance || 0).toLocaleString('en-IN')}</span>
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

                {activeTab === 'wallet' && (
                    <>
                        {loadingTab ? (
                            <div className="p-8 text-center text-gray-400">Loading...</div>
                        ) : walletTx.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">No wallet transactions.</div>
                        ) : (
                            <div className="divide-y divide-gray-700 min-w-0">
                                {walletTx.map((t) => (
                                    <div key={t._id} className="p-4 hover:bg-gray-100/20 flex flex-wrap items-center justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mr-2 border ${t.type === 'credit' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-rose-100 text-rose-700 border-rose-300'}`}>{t.type}</span>
                                            <span className="text-gray-600 text-sm break-words">{t.description || '—'}</span>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <span className="font-mono font-medium text-sm">{t.type === 'credit' ? '+' : '-'}{formatCurrency(t.amount)}</span>
                                            <span className="text-gray-400 text-xs">{new Date(t.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'bets' && (
                    <>
                        {loadingTab ? (
                            <div className="p-8 text-center text-gray-400">Loading...</div>
                        ) : bets.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">No bets.</div>
                        ) : (
                            <div className="min-w-0">
                                <div className="border-b border-gray-200 p-4">
                                    <input
                                        type="text"
                                        value={betHistorySearch}
                                        onChange={(e) => setBetHistorySearch(e.target.value)}
                                        placeholder="Search by Bet ID or Bet Number"
                                        className="w-full max-w-md rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:border-orange-400 focus:outline-none"
                                    />
                                </div>

                                {filteredBets.length === 0 ? (
                                    <div className="p-8 text-center text-gray-500">No matching bets found.</div>
                                ) : (
                                    <div className="p-4">
                                        <div className="grid grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                                            {filteredBets.map((b, index) => (
                                                <BetHistoryCard
                                                    key={b._id}
                                                    index={index + 1}
                                                    betId={b._id}
                                                    userName={player?.username || ''}
                                                    session={b.betOn || 'OPEN'}
                                                    marketTitle={(b.marketId?.marketName || 'Market').toUpperCase()}
                                                    gameLabel={b.betType === 'panna' ? 'Pana' : (b.betType || 'Bet')}
                                                    betValue={b.betNumber || '-'}
                                                    betAmount={b.amount}
                                                    winPayout={b.payout}
                                                    statusLabel={
                                                        b.status === 'won'
                                                            ? 'Win'
                                                            : b.status === 'lost'
                                                                ? 'Lost'
                                                                : 'Pending'
                                                    }
                                                    timeFormatted={new Date(b.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'game-history' && (
                    <>
                        {loadingTab ? (
                            <div className="p-8 text-center text-gray-400">Loading...</div>
                        ) : (
                            <div className="p-4 sm:p-6 space-y-6">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            { key: 'all', label: 'All' },
                                            { key: 'aviator', label: 'Aviator' },
                                            { key: 'funtimer', label: 'FunTimer' },
                                            { key: 'roulette', label: 'Roulette' },
                                        ].map((option) => (
                                            <button
                                                key={option.key}
                                                type="button"
                                                onClick={() => setGameHistoryFilter(option.key)}
                                                className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                                                    gameHistoryFilter === option.key
                                                        ? 'bg-orange-500 border-orange-500 text-white'
                                                        : 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200'
                                                }`}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="w-full lg:w-[320px]">
                                        <input
                                            type="text"
                                            value={gameHistorySearch}
                                            onChange={(e) => setGameHistorySearch(e.target.value)}
                                            placeholder="Search by Bet ID"
                                            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:border-orange-400 focus:outline-none"
                                        />
                                    </div>
                                </div>

                                {filteredGameHistorySections.map((section) => (
                                    <section key={section.game} className="space-y-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <h3 className="text-base sm:text-lg font-bold text-orange-500">{section.title}</h3>
                                            <span className="text-xs sm:text-sm text-gray-500">
                                                {section.rows.length} record{section.rows.length === 1 ? '' : 's'}
                                            </span>
                                        </div>

                                        {section.rows.length === 0 ? (
                                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                                                No {section.game} game history found.
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                                                {section.rows.map((row) => {
                                                    const betAmount = Number(row.betAmount || 0) || 0;
                                                    const payout = Number(row.cashOutAmount || 0) || 0;
                                                    const isWon = payout > betAmount;
                                                    const statusLabel = isWon ? 'Won' : 'Lost';
                                                    const statusClass = isWon
                                                        ? 'bg-green-50 text-green-700 border-green-300'
                                                        : 'bg-red-50 text-red-700 border-red-300';

                                                    if (section.game === 'Roulette') {
                                                        return (
                                                            <RouletteBetHistoryCard
                                                                key={`${section.game}-${row.key}`}
                                                                index={row.index}
                                                                betId={row.betId}
                                                                userName={player?.username || ''}
                                                                betNumber={row.betNumber}
                                                                betAmount={row.betAmount}
                                                                winAmount={row.cashOutAmount}
                                                                timeFormatted={row.timeFormatted}
                                                            />
                                                        );
                                                    }

                                                    return (
                                                        <div
                                                            key={`${section.game}-${row.key}`}
                                                            className={`rounded-xl border-2 p-4 ${
                                                                isWon ? 'border-green-200 bg-green-50/60' : 'border-red-200 bg-red-50/60'
                                                            }`}
                                                        >
                                                            <div className="mb-2 flex items-center justify-between gap-2">
                                                                <span className="text-xs font-medium text-gray-500">#{row.index}</span>
                                                                <span className="rounded-md border-2 border-orange-300 bg-orange-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-orange-600">
                                                                    Game
                                                                </span>
                                                            </div>

                                                            <div className="mb-3 flex items-center justify-between gap-2 text-xs">
                                                                <span className="text-gray-500">User</span>
                                                                <span className="font-semibold text-gray-800 uppercase truncate max-w-[170px]" title={player?.username || '-'}>
                                                                    {player?.username || '-'}
                                                                </span>
                                                            </div>

                                                            <div className="mb-3 flex items-center justify-between gap-2 text-xs">
                                                                <span className="text-gray-500">Bet ID</span>
                                                                <span className="font-mono text-gray-800">{String(row.betId || '').slice(-8) || '—'}</span>
                                                            </div>

                                                            <div className="mb-3 text-base font-extrabold uppercase tracking-wide text-[#1B3150]">
                                                                {section.game}
                                                            </div>

                                                            <div className="space-y-2 text-sm">
                                                                <div className="flex justify-between gap-3">
                                                                    <span className="text-gray-500">Game</span>
                                                                    <span className="font-medium text-gray-800">game - {section.game}</span>
                                                                </div>
                                                                <div className="flex justify-between gap-3">
                                                                    <span className="text-gray-500">Total Play</span>
                                                                    <span className="font-semibold tabular-nums text-gray-900">{formatCurrency(betAmount)}</span>
                                                                </div>
                                                                <div className="flex justify-between gap-3">
                                                                    <span className="text-gray-500">Payout</span>
                                                                    <span className={`font-semibold tabular-nums ${isWon ? 'text-green-600' : 'text-gray-600'}`}>
                                                                        {formatCurrency(payout)}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between gap-3">
                                                                    <span className="text-gray-500">Status</span>
                                                                    <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${statusClass}`}>
                                                                        {statusLabel}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between gap-3">
                                                                    <span className="text-gray-500">Time</span>
                                                                    <span className="text-right text-gray-600">{row.timeFormatted || '-'}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </section>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'profile' && (
                    <div className="p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                            <div><p className="text-gray-500 text-sm">Name</p><p className="text-gray-800">{player.username}</p></div>
                            <div><p className="text-gray-500 text-sm">Email</p><p className="text-gray-800">{player.email}</p></div>
                            <div><p className="text-gray-500 text-sm">Phone</p><p className="text-gray-800">{player.phone || '—'}</p></div>
                            <div><p className="text-gray-500 text-sm">Role</p><p className="text-gray-800 capitalize">{player.role || 'Player'}</p></div>
                            <div><p className="text-gray-500 text-sm">Source</p><p className="text-gray-800">{player.source === 'super_bookie' ? 'Super Bookie' : player.source === 'bookie' ? 'Bookie' : 'Super Admin'}</p></div>
                            {player.referrerChain?.bookie && (
                                <div><p className="text-gray-500 text-sm">Bookie</p><p className="text-gray-800">{player.referrerChain.bookie.username}</p></div>
                            )}
                            {player.referrerChain?.superBookie && (
                                <div><p className="text-gray-500 text-sm">Super Bookie</p><p className="text-indigo-700">{player.referrerChain.superBookie.username}</p></div>
                            )}
                            <div><p className="text-gray-500 text-sm">Created</p><p className="text-gray-800">{player.createdAt ? new Date(player.createdAt).toLocaleString('en-IN') : '—'}</p></div>
                        </div>
                    </div>
                )}

                {activeTab === 'lottery' && (
                    <>
                        {loadingTab ? (
                            <div className="p-8 text-center text-gray-400">Loading lottery history...</div>
                        ) : (
                            <div className="p-4 sm:p-6 space-y-4">
                                <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
                                    <h3 className="text-base sm:text-lg font-bold text-gray-800">Lottery Summary (Player-wise)</h3>
                                    <p className="text-xs text-gray-500 mt-1">Bookie player-history style view for 2D and 3D tickets.</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-4">
                                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                                            <p className="text-xs text-gray-500">2D Bets</p>
                                            <p className="text-lg font-bold text-gray-800">{formatNumber(lottery2dHistory?.summary?.totalBets)}</p>
                                        </div>
                                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                                            <p className="text-xs text-gray-500">3D Bets</p>
                                            <p className="text-lg font-bold text-gray-800">{formatNumber(lottery3dHistory?.summary?.totalBets)}</p>
                                        </div>
                                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                                            <p className="text-xs text-gray-500">Tickets</p>
                                            <p className="text-lg font-bold text-gray-800">{formatNumber(displayedLotteryStats.total)}</p>
                                        </div>
                                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                                            <p className="text-xs text-gray-500">Total Stake</p>
                                            <p className="text-lg font-bold text-gray-800">{formatCurrency(displayedLotteryStats.totalAmount)}</p>
                                        </div>
                                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                                            <p className="text-xs text-gray-500">Total Win</p>
                                            <p className="text-lg font-bold text-green-600">{formatCurrency(displayedLotteryStats.totalPayout)}</p>
                                        </div>
                                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                                            <p className="text-xs text-gray-500">P/L</p>
                                            <p className={`text-lg font-bold ${(displayedLotteryStats.totalPayout - displayedLotteryStats.totalAmount) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {formatCurrency(displayedLotteryStats.totalPayout - displayedLotteryStats.totalAmount)}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-gray-200 overflow-hidden">
                                    <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2">
                                        <FaFilter className="w-3 h-3 text-gray-400" />
                                        {[
                                            { id: 'all_lottery', label: 'All Lottery' },
                                            { id: 'lottery_2d', label: '2D Lottery' },
                                            { id: 'lottery_3d', label: '3D Lottery' },
                                        ].map((item) => (
                                            <button
                                                key={item.id}
                                                onClick={() => setLotterySourceFilter(item.id)}
                                                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                                                    lotterySourceFilter === item.id
                                                        ? 'bg-orange-500 text-white'
                                                        : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                                                }`}
                                            >
                                                {item.label}
                                            </button>
                                        ))}
                                        {['all', 'pending', 'won', 'lost'].map((status) => (
                                            <button
                                                key={status}
                                                onClick={() => setLotteryStatusFilter(status)}
                                                className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-colors ${
                                                    lotteryStatusFilter === status
                                                        ? 'bg-[#1B3150] text-white'
                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                            >
                                                {status} ({lotteryFilterCounts[status] || 0})
                                            </button>
                                        ))}
                                        <input
                                            type="text"
                                            value={lotterySearch}
                                            onChange={(e) => setLotterySearch(e.target.value)}
                                            placeholder="Search ticket / slot / set / mode"
                                            className="min-w-0 flex-1 basis-[10rem] max-w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B3150] focus:border-[#1B3150] lg:min-w-[12rem]"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setLotteryStatusFilter('all');
                                                setLotterySourceFilter('all_lottery');
                                                setLotterySearch('');
                                            }}
                                            className="inline-flex items-center px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition-colors"
                                        >
                                            Clear
                                        </button>
                                    </div>

                                    {lotteryFilteredRows.length === 0 ? (
                                        <div className="p-8 text-center text-gray-400">No lottery tickets found.</div>
                                    ) : (
                                        <AdminTableFrame>
                                            <table className="w-full text-sm min-w-[700px]">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="w-10 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase" />
                                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ticket</th>
                                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mode</th>
                                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Slot</th>
                                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bets</th>
                                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Win (Rs)</th>
                                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Loss (Rs)</th>
                                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {lotteryFilteredRows.map((row, index) => {
                                                        const rowStatus = toBetStatus(row.outcome);
                                                        const isExpanded = Boolean(expandedLotteryTickets[row.id]);
                                                        const winDisplay = rowStatus === 'won'
                                                            ? formatCurrency(row.payout)
                                                            : rowStatus === 'pending'
                                                                ? `Open (${row.betCount || 0})`
                                                                : formatCurrency(0);
                                                        const lossDisplay = rowStatus === 'lost'
                                                            ? formatCurrency(row.amount)
                                                            : rowStatus === 'pending'
                                                                ? '—'
                                                                : formatCurrency(0);
                                                        return (
                                                            <React.Fragment key={row.id}>
                                                                <tr className="hover:bg-gray-50">
                                                                    <td className="px-3 py-2">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => toggleLotteryTicket(row.id)}
                                                                            className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                                                                            aria-label={isExpanded ? 'Collapse ticket bets' : 'Expand ticket bets'}
                                                                        >
                                                                            {isExpanded ? <FaChevronDown className="w-3 h-3" /> : <FaChevronRight className="w-3 h-3" />}
                                                                        </button>
                                                                    </td>
                                                                    <td className="px-3 py-2 text-gray-500 text-xs font-semibold">{index + 1}</td>
                                                                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{formatTicketTail(row.ticketId)}</td>
                                                                    <td className="px-3 py-2 font-semibold text-orange-600">{row.mode}</td>
                                                                    <td className="px-3 py-2 text-gray-600 text-xs">{row.slotLabel || '—'}</td>
                                                                    <td className="px-3 py-2 font-semibold text-[#1B3150]">{row.betCount || 0}</td>
                                                                    <td className="px-3 py-2 text-right font-mono text-gray-800">{formatCurrency(row.amount)}</td>
                                                                    <td className={`px-3 py-2 text-xs font-semibold ${
                                                                        rowStatus === 'won'
                                                                            ? 'text-green-700'
                                                                            : rowStatus === 'pending'
                                                                                ? 'text-amber-600'
                                                                                : 'text-gray-500'
                                                                    }`}>{winDisplay}</td>
                                                                    <td className={`px-3 py-2 text-xs font-semibold ${rowStatus === 'lost' ? 'text-red-600' : 'text-gray-500'}`}>{lossDisplay}</td>
                                                                    <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{row.createdAt ? new Date(row.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                                                                </tr>
                                                                {isExpanded && (
                                                                    <tr className="bg-gray-50/70">
                                                                        <td colSpan={10} className="px-4 py-3">
                                                                            <AdminTableFrame className="rounded-lg border border-gray-200 bg-white">
                                                                                <table className="w-full text-xs min-w-[560px]">
                                                                                    <thead className="bg-gray-50">
                                                                                        <tr>
                                                                                            <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase">#</th>
                                                                                            <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase">Set</th>
                                                                                            <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase">Number</th>
                                                                                            <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase">Amount</th>
                                                                                            <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase">Status</th>
                                                                                            <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase">Payout</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-gray-100">
                                                                                        {(row.bets || []).map((bet, betIndex) => {
                                                                                            const betStatus = toBetStatus(bet.outcome);
                                                                                            return (
                                                                                                <tr key={bet.id}>
                                                                                                    <td className="px-3 py-2 text-gray-500 font-semibold">{betIndex + 1}</td>
                                                                                                    <td className="px-3 py-2 text-gray-700">{bet.setLabel || '—'}</td>
                                                                                                    <td className="px-3 py-2 font-mono text-[#1B3150]">{bet.number || '—'}</td>
                                                                                                    <td className="px-3 py-2 text-right font-mono text-gray-800">{formatCurrency(bet.amount)}</td>
                                                                                                    <td className="px-3 py-2">
                                                                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                                                                            betStatus === 'won' ? 'bg-green-100 text-green-700'
                                                                                                                : betStatus === 'lost' ? 'bg-red-100 text-red-600'
                                                                                                                    : 'bg-[#1B3150]/10 text-[#1B3150]'
                                                                                                        }`}>{betStatus}</span>
                                                                                                    </td>
                                                                                                    <td className="px-3 py-2 text-right font-mono text-gray-800">{betStatus === 'won' ? formatCurrency(bet.payout) : formatCurrency(0)}</td>
                                                                                                </tr>
                                                                                            );
                                                                                        })}
                                                                                    </tbody>
                                                                                </table>
                                                                            </AdminTableFrame>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                            {canLoadMoreLottery ? (
                                                <div className="p-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                                                    <p className="text-xs text-gray-500">
                                                        {`Loaded ${lotteryFilteredRows.length} ticket${lotteryFilteredRows.length === 1 ? '' : 's'} (Page ${lotteryPage})`}
                                                    </p>
                                                    <button
                                                        type="button"
                                                        onClick={handleLoadMoreLottery}
                                                        disabled={loadingLotteryPage}
                                                        className="px-3 py-1.5 rounded-lg bg-[#1B3150] hover:bg-[#152842] text-white text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                                                    >
                                                        {loadingLotteryPage ? 'Loading...' : 'Next Page'}
                                                    </button>
                                                </div>
                                            ) : null}
                                        </AdminTableFrame>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}

            </div>

            {/* Edit Wallet Modal */}
            {walletModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="text-base sm:text-lg font-semibold text-orange-500">Edit Wallet</h3>
                            <button type="button" onClick={closeWalletModal} className="text-gray-400 hover:text-gray-800 p-1">×</button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="rounded-lg bg-gray-50 px-3 py-2">
                                <p className="text-gray-400 text-xs uppercase tracking-wider">Current Balance</p>
                                <p className="text-green-600 font-mono font-bold text-lg sm:text-xl break-all">{formatCurrency(player?.walletBalance ?? 0)}</p>
                            </div>
                            {walletActionError && (
                                <div className="rounded-lg bg-red-900/30 border border-red-600/50 text-red-600 text-sm px-3 py-2">{walletActionError}</div>
                            )}
                            <div>
                                <p className="text-gray-400 text-sm mb-2">Add (Credit) or Deduct (Debit)</p>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        placeholder="Amount"
                                        value={walletAdjustAmount}
                                        onChange={(e) => setWalletAdjustAmount(e.target.value.replace(/\D/g, '').slice(0, 12))}
                                        className="w-full sm:flex-1 px-3 py-2.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-800 placeholder-gray-400"
                                    />
                                    <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
                                        <button type="button" onClick={() => handleWalletAdjust('credit')} disabled={walletActionLoading} className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50">Add</button>
                                        <button type="button" onClick={() => handleWalletAdjust('debit')} disabled={walletActionLoading} className="px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold disabled:opacity-50">Deduct</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Set Player Password Modal */}
            {playerPasswordModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-sm">
                        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="text-base font-bold text-gray-800">Set Player Password</h3>
                            <button type="button" onClick={closePlayerPasswordModal} className="text-gray-400 hover:text-gray-600 text-lg font-bold">×</button>
                        </div>
                        <div className="p-4 space-y-4">
                            {playerPasswordError && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-3 py-2">{playerPasswordError}</div>}
                            {playerPasswordSuccess && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2">{playerPasswordSuccess}</div>}

                            {!playerPasswordSuccess && (
                                <>
                                    <div>
                                        <label className="block text-gray-600 text-sm font-medium mb-1.5">New Password</label>
                                        <input
                                            type="password"
                                            value={newPlayerPassword}
                                            onChange={(e) => setNewPlayerPassword(e.target.value)}
                                            className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                            placeholder="Minimum 6 characters"
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-gray-600 text-sm font-medium mb-1.5">Confirm Password</label>
                                        <input
                                            type="password"
                                            value={confirmPlayerPassword}
                                            onChange={(e) => setConfirmPlayerPassword(e.target.value)}
                                            className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                            placeholder="Re-enter password"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handlePlayerPasswordSubmit}
                                        disabled={playerPasswordLoading || !newPlayerPassword || !confirmPlayerPassword}
                                        className="w-full font-bold py-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {playerPasswordLoading ? (
                                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <>Update Password</>
                                        )}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Secret password modal for suspend/delete */}
            {showPasswordModal && (pendingAction === 'suspend' || pendingAction === 'delete') && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-md">
                        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-orange-500">
                                {pendingAction === 'suspend' ? 'Confirm Suspend/Unsuspend' : 'Confirm Delete'}
                            </h3>
                            <button type="button" onClick={closeSecretModal} className="text-gray-400 hover:text-gray-800 p-1">×</button>
                        </div>
                        <form onSubmit={handlePasswordSubmit} className="p-4 space-y-4">
                            <p className="text-gray-600 text-sm">
                                {pendingAction === 'suspend' ? 'Enter secret declare password to suspend/unsuspend this player.' : 'Enter secret declare password to delete this player.'}
                            </p>
                            <input
                                type="password"
                                placeholder="Secret declare password"
                                value={secretPassword}
                                onChange={(e) => { setSecretPassword(e.target.value); setPasswordError(''); }}
                                className="w-full px-3 py-2 rounded-lg bg-gray-100 border border-gray-200 text-gray-800 placeholder-gray-400"
                                autoFocus
                            />
                            {passwordError && (
                                <div className="rounded-lg bg-red-900/30 border border-red-600/50 text-red-600 text-sm px-3 py-2">{passwordError}</div>
                            )}
                            <div className="flex gap-2 justify-end">
                                <button type="button" onClick={closeSecretModal} className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-500 text-gray-800 font-semibold">Cancel</button>
                                <button type="submit" disabled={togglingStatus || deletingPlayer} className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-gray-800 font-semibold disabled:opacity-50">
                                    {togglingStatus || deletingPlayer ? <span className="animate-spin">⏳</span> : 'Confirm'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            </div>
        </AdminLayout>
    );
};

export default PlayerDetail;
