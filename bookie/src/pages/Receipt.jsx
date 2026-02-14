import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { useNavigate, useParams } from 'react-router-dom';
import { API_BASE_URL, getBookieAuthHeaders } from '../utils/api';
import {
    FaArrowLeft,
    FaSearch,
    FaCalendarAlt,
    FaPrint,
    FaFileInvoiceDollar,
    FaUser,
    FaStore,
} from 'react-icons/fa';

const formatCurrency = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-IN', { 
        weekday: 'long', 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
    });
};

const formatDateTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleString('en-IN', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const DATE_PRESETS = [
    { id: 'today', label: 'Today', getRange: () => { const d = new Date(); const f = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; return { from: f, to: f }; } },
    { id: 'yesterday', label: 'Yesterday', getRange: () => { const d = new Date(); d.setDate(d.getDate() - 1); const f = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; return { from: f, to: f }; } },
    { id: 'last_7_days', label: 'Last 7 Days', getRange: () => { const d = new Date(); const to = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; const fromDate = new Date(d); fromDate.setDate(d.getDate() - 6); const from = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}-${String(fromDate.getDate()).padStart(2, '0')}`; return { from, to }; } },
    { id: 'this_week', label: 'This Week', getRange: () => { const d = new Date(); const day = d.getDay(); const sun = new Date(d); sun.setDate(d.getDate() - day); const sat = new Date(sun); sat.setDate(sun.getDate() + 6); const fmt = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; return { from: fmt(sun), to: fmt(sat) }; } },
    { id: 'last_week', label: 'Last Week', getRange: () => { const d = new Date(); const day = d.getDay(); const sun = new Date(d); sun.setDate(d.getDate() - day - 7); const sat = new Date(sun); sat.setDate(sun.getDate() + 6); const fmt = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; return { from: fmt(sun), to: fmt(sat) }; } },
    { id: 'this_month', label: 'This Month', getRange: () => { const d = new Date(); const y = d.getFullYear(), m = d.getMonth(); const last = new Date(y, m + 1, 0); return { from: `${y}-${String(m + 1).padStart(2, '0')}-01`, to: `${y}-${String(m + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}` }; } },
    { id: 'last_month', label: 'Last Month', getRange: () => { const d = new Date(); const y = d.getFullYear(), m = d.getMonth() - 1; const last = new Date(y, m + 1, 0); return { from: `${y}-${String(m + 1).padStart(2, '0')}-01`, to: `${y}-${String(m + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}` }; } },
];

const getBetTypeLabel = (type, betNumber = '') => {
    const labels = {
        'single': 'Single',
        'jodi': 'Jodi',
        'panna': 'Panna',
        'half-sangam': 'Half Sangam',
        'full-sangam': 'Full Sangam',
    };
    
    // For panna, determine if it's Single, Double, or Triple Pana based on betNumber
    if (type === 'panna' && betNumber) {
        const numStr = String(betNumber).trim();
        if (/^\d{3}$/.test(numStr)) {
            const a = numStr[0], b = numStr[1], c = numStr[2];
            if (a === b && b === c) {
                return 'Triple Pana';
            } else if (a === b || b === c || a === c) {
                return 'Double Pana';
            } else {
                return 'Single Pana';
            }
        }
    }
    
    return labels[type] || type;
};

const Receipt = () => {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const [sessions, setSessions] = useState([]);
    const [players, setPlayers] = useState([]);
    const [selectedPlayerId, setSelectedPlayerId] = useState(null);
    const [selectedPlayerName, setSelectedPlayerName] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSession, setSelectedSession] = useState(null);
    const [marketDetails, setMarketDetails] = useState(null);
    const [playerData, setPlayerData] = useState(null);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [datePreset, setDatePreset] = useState('today');
    const [calendarOpen, setCalendarOpen] = useState(false);
    const dropdownRef = useRef(null);
    
    // Editable receipt fields
    const [commissionPercent, setCommissionPercent] = useState('');
    const [paid, setPaid] = useState('');
    const [cutting, setCutting] = useState('');
    const [toGive, setToGive] = useState('');
    const [toTake, setToTake] = useState('');
    const [toGiveTakeLoading, setToGiveTakeLoading] = useState(false);
    const [toGiveTakeError, setToGiveTakeError] = useState('');
    const [toGiveTakeSuccess, setToGiveTakeSuccess] = useState('');

    // Init date to last 7 days (to show past data)
    useEffect(() => {
        const preset = DATE_PRESETS.find((p) => p.id === 'last_7_days');
        if (preset) {
            const { from, to } = preset.getRange();
            setDateFrom(from);
            setDateTo(to);
            setDatePreset('last_7_days');
        }
    }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setCalendarOpen(false);
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    // Fetch players on mount
    useEffect(() => {
        fetchPlayers();
    }, []);

    // Fetch sessions when date range changes or player is selected
    useEffect(() => {
        if (dateFrom && dateTo && selectedPlayerId) {
            fetchSessions();
        } else if (selectedPlayerId) {
            // If player is selected but no date range, clear sessions
            setSessions([]);
        }
    }, [dateFrom, dateTo, selectedPlayerId]);

    // Fetch selected session when sessionId changes
    useEffect(() => {
        if (sessionId) {
            fetchSessionDetail(sessionId);
        } else {
            setSelectedSession(null);
            setMarketDetails(null);
        }
    }, [sessionId]);

    // Fetch market details and player data when session is loaded
    useEffect(() => {
        if (selectedSession) {
            if (selectedSession.marketId) {
                fetchMarketDetails(selectedSession.marketId);
            }
            if (selectedSession.userId) {
                fetchPlayerData(selectedSession.userId);
            }
        }
    }, [selectedSession]);

    // Initialize commission percentage from session data when session loads
    useEffect(() => {
        if (selectedSession && selectedSession.bets && selectedSession.bets.length > 0) {
            const totalAmount = selectedSession.bets.reduce((sum, b) => sum + (b.amount || 0), 0);
            const totalCommission = selectedSession.bets.reduce((sum, b) => sum + (b.commissionAmount || 0), 0);
            if (totalAmount > 0 && totalCommission > 0) {
                const percent = (totalCommission / totalAmount) * 100;
                setCommissionPercent(percent.toString());
            } else if (selectedSession.bets[0]?.commissionPercentage) {
                setCommissionPercent(selectedSession.bets[0].commissionPercentage.toString());
            }
        }
    }, [selectedSession]);

    const fetchPlayers = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await fetch(`${API_BASE_URL}/users`, {
                headers: getBookieAuthHeaders(),
            });
            const data = await response.json();
            if (data.success) {
                setPlayers(data.data || []);
            } else {
                setError(data.message || 'Failed to fetch players');
            }
        } catch (err) {
            setError('Network error. Please check if the server is running.');
        } finally {
            setLoading(false);
        }
    };

    const fetchSessions = async () => {
        try {
            setLoading(true);
            setError('');
            const params = new URLSearchParams();
            if (selectedPlayerId) params.append('userId', selectedPlayerId);
            if (dateFrom) params.append('startDate', dateFrom);
            if (dateTo) params.append('endDate', dateTo);
            
            const response = await fetch(`${API_BASE_URL}/bets/sessions?${params}`, {
                headers: getBookieAuthHeaders(),
            });
            const data = await response.json();
            if (data.success) {
                setSessions(data.data || []);
            } else {
                setError(data.message || 'Failed to fetch bet sessions');
            }
        } catch (err) {
            setError('Network error. Please check if the server is running.');
        } finally {
            setLoading(false);
        }
    };

    const fetchSessionDetail = async (sessionIdParam) => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (dateFrom) params.append('startDate', dateFrom);
            if (dateTo) params.append('endDate', dateTo);
            
            const response = await fetch(`${API_BASE_URL}/bets/sessions?${params}`, {
                headers: getBookieAuthHeaders(),
            });
            const data = await response.json();
            if (data.success) {
                const session = (data.data || []).find(s => s.sessionId === sessionIdParam);
                if (session) {
                    setSelectedSession(session);
                } else {
                    setError('Session not found');
                }
            } else {
                setError(data.message || 'Failed to fetch session');
            }
        } catch (err) {
            setError('Failed to load session');
        } finally {
            setLoading(false);
        }
    };

    const fetchMarketDetails = async (marketId) => {
        try {
            const response = await fetch(`${API_BASE_URL}/markets/${marketId}`, {
                headers: getBookieAuthHeaders(),
            });
            const data = await response.json();
            if (data.success) {
                setMarketDetails(data.data);
            }
        } catch (err) {
            // Silently fail - results might not be available
            setMarketDetails(null);
        }
    };

    const fetchPlayerData = async (userId) => {
        try {
            const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
                headers: getBookieAuthHeaders(),
            });
            const data = await response.json();
            if (data.success) {
                setPlayerData(data.data);
                setToGive((data.data.toGive ?? 0).toString());
                setToTake((data.data.toTake ?? 0).toString());
            }
        } catch (err) {
            setPlayerData(null);
        }
    };

    const handleToGiveTakeUpdate = async () => {
        if (!selectedSession || !selectedSession.userId) return;
        
        const numToGive = Number(toGive);
        const numToTake = Number(toTake);
        
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
            const res = await fetch(`${API_BASE_URL}/users/${selectedSession.userId}/to-give-take`, {
                method: 'PATCH',
                headers: getBookieAuthHeaders(),
                body: JSON.stringify({ toGive: numToGive, toTake: numToTake }),
            });
            const data = await res.json();
            if (data.success) {
                setToGiveTakeSuccess('Updated successfully');
                fetchPlayerData(selectedSession.userId);
            } else {
                setToGiveTakeError(data.message || 'Failed to update');
            }
        } catch (err) {
            setToGiveTakeError('Network error. Please try again.');
        } finally {
            setToGiveTakeLoading(false);
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

    const handlePlayerClick = (player) => {
        setSelectedPlayerId(player._id);
        setSelectedPlayerName(player.username);
        setSessions([]);
        setSelectedSession(null);
        setSearchQuery('');
    };

    const handleBackToPlayers = () => {
        setSelectedPlayerId(null);
        setSelectedPlayerName(null);
        setSessions([]);
        setSelectedSession(null);
        setSearchQuery('');
        navigate('/receipt');
    };

    const handleSessionClick = (session) => {
        navigate(`/receipt/${session.sessionId}`);
    };

    const handleBackToList = () => {
        if (selectedPlayerId) {
            navigate('/receipt');
            setSelectedSession(null);
        } else {
            navigate('/receipt');
        }
    };

    const handlePrintReceipt = async () => {
        if (!selectedSession) return;
        
        // Ensure market details and player data are loaded
        let marketData = marketDetails;
        let currentPlayerData = playerData;
        
        if (!marketData && selectedSession.marketId) {
            try {
                const response = await fetch(`${API_BASE_URL}/markets/${selectedSession.marketId}`, {
                    headers: getBookieAuthHeaders(),
                });
                const data = await response.json();
                if (data.success) {
                    marketData = data.data;
                }
            } catch (err) {
                // Continue without market data
            }
        }
        
        if (!currentPlayerData && selectedSession.userId) {
            try {
                const response = await fetch(`${API_BASE_URL}/users/${selectedSession.userId}`, {
                    headers: getBookieAuthHeaders(),
                });
                const data = await response.json();
                if (data.success) {
                    currentPlayerData = data.data;
                }
            } catch (err) {
                // Continue without player data
            }
        }
        
        const totalAmount = selectedSession.bets.reduce((sum, b) => sum + (b.amount || 0), 0);
        const commissionPercentValue = Number(commissionPercent) || 0;
        const commissionAmount = (totalAmount * commissionPercentValue) / 100;
        const paidAmount = Number(paid) || 0;
        const cuttingAmount = Number(cutting) || 0;
        const remainingToPay = totalAmount - commissionAmount;
        const finalTotal = remainingToPay - paidAmount - cuttingAmount;

        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) return;

        const receiptContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Bet Receipt</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        padding: 0.5cm; 
                        color: #222; 
                        font-size: 10px; 
                        line-height: 1.2;
                    }
                    .receipt-wrapper {
                        border: 2px solid #1f2937;
                        padding: 0.5cm;
                        max-width: 100%;
                    }
                    .receipt-title {
                        text-align: center;
                        margin-bottom: 0.3cm;
                        padding-bottom: 0.2cm;
                        border-bottom: 2px solid #1f2937;
                    }
                    .receipt-title h2 {
                        font-size: 16px;
                        font-weight: bold;
                        color: #1f2937;
                    }
                    .receipt-header {
                        margin-bottom: 0.2cm;
                        padding-bottom: 0.15cm;
                        border-bottom: 1px solid #e5e7eb;
                        font-size: 9px;
                    }
                    .receipt-header-row {
                        display: flex;
                        flex-wrap: wrap;
                        justify-content: space-between;
                        gap: 0.3cm;
                    }
                    .receipt-header-row span {
                        white-space: nowrap;
                    }
                    .receipt-header-row .label {
                        color: #6b7280;
                    }
                    .receipt-header-row .value {
                        font-weight: 600;
                        color: #1f2937;
                    }
                    .receipt-table-wrapper {
                        margin-bottom: 0.2cm;
                    }
                    .receipt-table-wrapper h3 {
                        font-size: 11px;
                        font-weight: bold;
                        margin-bottom: 0.1cm;
                        color: #1f2937;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 9px;
                    }
                    thead {
                        background: #f3f4f6;
                    }
                    th {
                        padding: 2px 3px;
                        text-align: left;
                        font-weight: 600;
                        font-size: 8px;
                        color: #374151;
                        border-bottom: 1px solid #d1d5db;
                    }
                    th:last-child {
                        text-align: right;
                    }
                    td {
                        padding: 2px 3px;
                        border-bottom: 1px solid #f3f4f6;
                        font-size: 9px;
                    }
                    td:last-child {
                        text-align: right;
                    }
                    tfoot td {
                        background: #f9fafb;
                        border-top: 1px solid #d1d5db;
                        font-weight: bold;
                    }
                    .calculations {
                        margin-top: 0.2cm;
                        padding-top: 0.15cm;
                        border-top: 1px solid #d1d5db;
                    }
                    .calculations h3 {
                        font-size: 11px;
                        font-weight: bold;
                        margin-bottom: 0.1cm;
                        color: #1f2937;
                    }
                    .calc-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 2px 0;
                        font-size: 9px;
                    }
                    .calc-row .label {
                        color: #4b5563;
                    }
                    .calc-row .value {
                        font-weight: 600;
                        font-family: monospace;
                    }
                    .calc-row.remaining {
                        background: #dbeafe;
                        padding: 3px 5px;
                        margin: 2px 0;
                    }
                    .calc-row.final {
                        border-top: 2px solid #fb923c;
                        padding-top: 5px;
                        margin-top: 5px;
                        background: #fff7ed;
                        padding: 5px;
                        font-weight: bold;
                    }
                    .calc-row.final .value {
                        font-size: 12px;
                        color: #ea580c;
                    }
                    .receipt-footer {
                        margin-top: 0.2cm;
                        padding-top: 0.15cm;
                        border-top: 1px solid #e5e7eb;
                        text-align: center;
                        font-size: 7px;
                        color: #6b7280;
                    }
                    @media print {
                        body { padding: 0.5cm; }
                        @page { margin: 0.5cm; size: A4; }
                    }
                </style>
            </head>
            <body>
                <div class="receipt-wrapper">
                    <div class="receipt-title">
                        <h2>BET RECEIPT</h2>
                    </div>

                    <div class="receipt-header">
                        <div class="receipt-header-row">
                            <span><span class="label">Date:</span> <span class="value">${formatDate(selectedSession.createdAt)}</span></span>
                            <span><span class="label">Market:</span> <span class="value">${selectedSession.marketName}</span></span>
                            <span><span class="label">Time:</span> <span class="value">${formatDateTime(selectedSession.createdAt)}</span></span>
                        </div>
                    </div>

                    <div class="receipt-header">
                        <div class="receipt-header-row">
                            <span><span class="label">Player:</span> <span class="value">${selectedSession.playerName}</span></span>
                            <span><span class="label">Phone:</span> <span class="value">${selectedSession.playerPhone || '—'}</span></span>
                        </div>
                    </div>
                    ${marketData?.openingNumber || marketData?.closingNumber ? `
                    <div class="receipt-header">
                        <div class="receipt-header-row">
                            ${marketData.openingNumber ? `<span><span class="label">Open:</span> <span class="value" style="font-family: monospace; font-weight: bold;">${marketData.openingNumber}</span></span>` : ''}
                            ${marketData.closingNumber ? `<span><span class="label">Close:</span> <span class="value" style="font-family: monospace; font-weight: bold;">${marketData.closingNumber}</span></span>` : ''}
                            ${marketData.openingNumber && marketData.closingNumber ? `<span><span class="label">Jodi:</span> <span class="value" style="font-family: monospace; font-weight: bold; color: #ea580c;">${marketData.openingNumber.slice(-1) + marketData.closingNumber.slice(-1)}</span></span>` : ''}
                        </div>
                    </div>
                    ` : ''}

                    <div class="receipt-table-wrapper">
                        <h3>BET DETAILS</h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.2cm;">
                            <!-- Left Column -->
                            <table style="width: 100%;">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Type</th>
                                        <th>Number</th>
                                        <th>Sess</th>
                                        <th>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${selectedSession.bets.filter((_, index) => index % 2 === 0).map((bet, idx) => {
                                        const actualIndex = idx * 2;
                                        return `
                                            <tr>
                                                <td>${actualIndex + 1}</td>
                                                <td>${getBetTypeLabel(bet.betType, bet.betNumber)}</td>
                                                <td style="font-family: monospace; font-weight: 600;">${bet.betNumber || '—'}</td>
                                                <td style="text-transform: uppercase;">${bet.betOn || 'open'}</td>
                                                <td style="font-family: monospace; font-weight: 600; text-align: right;">${formatCurrency(bet.amount)}</td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                            <!-- Right Column -->
                            <table style="width: 100%;">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Type</th>
                                        <th>Number</th>
                                        <th>Sess</th>
                                        <th>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${selectedSession.bets.filter((_, index) => index % 2 === 1).map((bet, idx) => {
                                        const actualIndex = idx * 2 + 1;
                                        return `
                                            <tr>
                                                <td>${actualIndex + 1}</td>
                                                <td>${getBetTypeLabel(bet.betType, bet.betNumber)}</td>
                                                <td style="font-family: monospace; font-weight: 600;">${bet.betNumber || '—'}</td>
                                                <td style="text-transform: uppercase;">${bet.betOn || 'open'}</td>
                                                <td style="font-family: monospace; font-weight: 600; text-align: right;">${formatCurrency(bet.amount)}</td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                        <div style="margin-top: 0.1cm; padding-top: 0.1cm; border-top: 1px solid #d1d5db; text-align: right; background: #f9fafb;">
                            <span style="font-weight: bold; font-size: 9px;">Total: </span>
                            <span style="font-family: monospace; font-weight: bold; font-size: 9px;">${formatCurrency(totalAmount)}</span>
                        </div>
                    </div>

                    <div class="calculations">
                        <h3>CALCULATIONS</h3>
                        <div class="calc-row">
                            <span class="label">Total Bet Amount:</span>
                            <span class="value">${formatCurrency(totalAmount)}</span>
                        </div>
                        <div class="calc-row">
                            <span class="label">Commission (${commissionPercentValue}%):</span>
                            <span class="value" style="color: #dc2626;">${formatCurrency(commissionAmount)}</span>
                        </div>
                        <div class="calc-row remaining">
                            <span class="label" style="font-weight: 600;">Remaining to Pay:</span>
                            <span class="value" style="color: #2563eb; font-weight: 600;">${formatCurrency(remainingToPay)}</span>
                        </div>
                        <div class="calc-row">
                            <span class="label">Paid:</span>
                            <span class="value" style="color: #16a34a;">${formatCurrency(paidAmount)}</span>
                        </div>
                        <div class="calc-row">
                            <span class="label">Cutting:</span>
                            <span class="value" style="color: #9333ea;">${formatCurrency(cuttingAmount)}</span>
                        </div>
                        ${currentPlayerData ? `
                        <div class="calc-row">
                            <span class="label">To Give:</span>
                            <span class="value" style="color: #2563eb;">${formatCurrency(currentPlayerData.toGive || 0)}</span>
                        </div>
                        <div class="calc-row">
                            <span class="label">To Take:</span>
                            <span class="value" style="color: #dc2626;">${formatCurrency(currentPlayerData.toTake || 0)}</span>
                        </div>
                        ` : ''}
                        <div class="calc-row final">
                            <span class="label">FINAL TOTAL:</span>
                            <span class="value">${formatCurrency(finalTotal)}</span>
                        </div>
                    </div>


                    <div class="receipt-footer">
                        <p>Generated: ${new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })} | Computer Generated Receipt</p>
                    </div>
                </div>
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(function() {
                            window.close();
                        }, 100);
                    };
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(receiptContent);
        printWindow.document.close();
    };

    const q = searchQuery.trim().toLowerCase();
    const filteredPlayers = q
        ? players.filter((player) => {
            const playerName = (player.username || '').toLowerCase();
            const playerEmail = (player.email || '').toLowerCase();
            const playerPhone = (player.phone || '').toString();
            return playerName.includes(q) || playerEmail.includes(q) || playerPhone.includes(q);
        })
        : players;

    const filteredSessions = q
        ? sessions.filter((session) => {
            const playerName = (session.playerName || '').toLowerCase();
            const marketName = (session.marketName || '').toLowerCase();
            const playerPhone = (session.playerPhone || '').toString();
            return playerName.includes(q) || marketName.includes(q) || playerPhone.includes(q);
        })
        : sessions;

    // If sessionId is present, show receipt view
    if (sessionId && selectedSession) {
        const totalAmount = selectedSession.bets.reduce((sum, b) => sum + (b.amount || 0), 0);
        const commissionPercentValue = Number(commissionPercent) || 0;
        const commissionAmount = (totalAmount * commissionPercentValue) / 100;
        const paidAmount = Number(paid) || 0;
        const cuttingAmount = Number(cutting) || 0;
        
        // Calculate remaining to pay after commission
        const remainingToPay = totalAmount - commissionAmount;
        
        // Calculate final total after paid and cutting
        const finalTotal = remainingToPay - paidAmount - cuttingAmount;

        return (
            <Layout title="Bet Receipt">
                <style>{`
                    @media print {
                        @page {
                            size: A4;
                            margin: 0.5cm;
                        }
                        html, body {
                            margin: 0 !important;
                            padding: 0 !important;
                            width: 100%;
                            height: auto;
                        }
                        body > div,
                        body > div > div {
                            margin: 0 !important;
                            padding: 0 !important;
                        }
                        header,
                        aside,
                        main > div:not(#bet-receipt),
                        .print\\:hidden {
                            display: none !important;
                            visibility: hidden !important;
                        }
                        main {
                            margin: 0 !important;
                            padding: 0 !important;
                            margin-left: 0 !important;
                            padding-top: 0 !important;
                        }
                        body * {
                            visibility: hidden;
                        }
                        #bet-receipt,
                        #bet-receipt * {
                            visibility: visible;
                        }
                        #bet-receipt {
                            position: fixed;
                            left: 0;
                            top: 0;
                            width: 100%;
                            height: auto;
                            margin: 0 !important;
                            padding: 0 !important;
                            page-break-inside: avoid;
                            page-break-after: avoid;
                        }
                        #bet-receipt > div {
                            margin: 0 !important;
                            padding: 0.5cm !important;
                            max-width: 100% !important;
                        }
                        .print\\:hidden {
                            display: none !important;
                        }
                        .receipt-container {
                            font-size: 10px !important;
                            line-height: 1.2 !important;
                            margin: 0 !important;
                            padding: 0.5cm !important;
                        }
                        .receipt-header-row {
                            padding: 2px 0 !important;
                            font-size: 9px !important;
                        }
                        .receipt-table {
                            font-size: 9px !important;
                        }
                        .receipt-table th,
                        .receipt-table td {
                            padding: 2px 3px !important;
                        }
                        .receipt-table thead {
                            page-break-inside: avoid;
                        }
                        .receipt-table tbody {
                            page-break-inside: avoid;
                        }
                        .receipt-table tfoot {
                            page-break-inside: avoid;
                        }
                        input[type="number"] {
                            -webkit-appearance: none;
                            -moz-appearance: textfield;
                            appearance: textfield;
                        }
                        input[type="number"]::-webkit-inner-spin-button,
                        input[type="number"]::-webkit-outer-spin-button {
                            -webkit-appearance: none;
                            margin: 0;
                        }
                        .print\\:border-0 {
                            border: none !important;
                        }
                        .print\\:bg-transparent {
                            background: transparent !important;
                        }
                    }
                `}</style>
                <div className="min-w-0 max-w-full space-y-5 print:space-y-0">
                    {/* Breadcrumb */}
                    <div className="print:hidden">
                        <button
                            onClick={handleBackToList}
                            className="text-gray-400 hover:text-orange-500 text-sm inline-flex items-center gap-1 mb-1"
                        >
                            <FaArrowLeft className="w-3 h-3" /> All Receipts
                        </button>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
                            Bet Receipt
                        </h1>
                    </div>

                    {/* Receipt Content */}
                    <div id="bet-receipt" className="bg-white rounded-xl border border-gray-200 overflow-hidden print:border-2 print:border-gray-800 print:rounded-none print:m-0 print:p-0">
                        <div className="p-6 max-w-3xl mx-auto print:p-0 print:max-w-none receipt-container print:m-0">
                            {/* Print button */}
                            <div className="mb-4 print:hidden flex justify-end">
                                <button
                                    onClick={handlePrintReceipt}
                                    className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
                                >
                                    <FaPrint className="w-4 h-4" />
                                    Print Receipt
                                </button>
                            </div>

                            {/* Receipt Header */}
                            <div className="border-2 border-gray-300 rounded-lg p-3 print:border-gray-800 print:rounded-none print:p-2">
                                {/* Title */}
                                <div className="text-center mb-2 pb-1.5 border-b-2 border-gray-300 print:border-gray-800">
                                    <h2 className="text-lg font-bold text-gray-800 print:text-base">BET RECEIPT</h2>
                                </div>

                                {/* Header Info - Single Row Compact */}
                                <div className="mb-1.5 pb-1.5 border-b border-gray-200 text-[10px] print:text-[8px]">
                                    <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5">
                                        <span><span className="text-gray-500">Date:</span> <span className="font-semibold text-gray-800">{formatDate(selectedSession.createdAt)}</span></span>
                                        <span><span className="text-gray-500">Market:</span> <span className="font-semibold text-gray-800">{selectedSession.marketName}</span></span>
                                        <span><span className="text-gray-500">Time:</span> <span className="font-semibold text-gray-800">{formatDateTime(selectedSession.createdAt)}</span></span>
                                    </div>
                                </div>

                                {/* Player Info - Single Row Compact */}
                                <div className="mb-1.5 pb-1.5 border-b border-gray-200 text-[10px] print:text-[8px]">
                                    <div className="flex flex-wrap justify-between gap-x-3">
                                        <span><span className="text-gray-500">Player:</span> <span className="font-semibold text-gray-800">{selectedSession.playerName}</span></span>
                                        <span><span className="text-gray-500">Phone:</span> <span className="font-semibold text-gray-800">{selectedSession.playerPhone || '—'}</span></span>
                                    </div>
                                </div>

                                {/* Market Results - Compact */}
                                {(marketDetails?.openingNumber || marketDetails?.closingNumber) && (
                                    <div className="mb-1.5 pb-1.5 border-b border-gray-200 text-[10px] print:text-[8px]">
                                        <div className="flex flex-wrap justify-between gap-x-3">
                                            <span>
                                                <span className="text-gray-500">Open:</span> 
                                                <span className="font-mono font-bold text-gray-800 ml-1">
                                                    {marketDetails.openingNumber || '—'}
                                                </span>
                                            </span>
                                            <span>
                                                <span className="text-gray-500">Close:</span> 
                                                <span className="font-mono font-bold text-gray-800 ml-1">
                                                    {marketDetails.closingNumber || '—'}
                                                </span>
                                            </span>
                                            {marketDetails.openingNumber && marketDetails.closingNumber && (
                                                <span>
                                                    <span className="text-gray-500">Jodi:</span> 
                                                    <span className="font-mono font-bold text-orange-600 ml-1">
                                                        {marketDetails.openingNumber.slice(-1) + marketDetails.closingNumber.slice(-1)}
                                                    </span>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Bets Table - Two Column Layout */}
                                <div className="mb-1.5">
                                    <h3 className="text-xs font-bold text-gray-800 mb-0.5 print:text-[9px]">BET DETAILS</h3>
                                    <div className="grid grid-cols-2 gap-2 print:gap-1.5">
                                        {/* Left Column */}
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-[10px] border-collapse receipt-table print:text-[8px]">
                                                <thead>
                                                    <tr className="bg-gray-100 border-b border-gray-300">
                                                        <th className="px-1 py-0.5 text-left font-semibold text-gray-700">#</th>
                                                        <th className="px-1 py-0.5 text-left font-semibold text-gray-700">Type</th>
                                                        <th className="px-1 py-0.5 text-left font-semibold text-gray-700">Number</th>
                                                        <th className="px-1 py-0.5 text-left font-semibold text-gray-700">Sess</th>
                                                        <th className="px-1 py-0.5 text-right font-semibold text-gray-700">Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedSession.bets.filter((_, index) => index % 2 === 0).map((bet, idx) => {
                                                        const actualIndex = idx * 2;
                                                        return (
                                                            <tr key={bet._id} className="border-b border-gray-100">
                                                                <td className="px-1 py-0.5 text-gray-600">{actualIndex + 1}</td>
                                                                <td className="px-1 py-0.5 text-gray-800 capitalize">{getBetTypeLabel(bet.betType, bet.betNumber)}</td>
                                                                <td className="px-1 py-0.5 text-gray-800 font-mono font-semibold">{bet.betNumber || '—'}</td>
                                                                <td className="px-1 py-0.5 text-gray-600 uppercase text-[9px]">{bet.betOn || 'open'}</td>
                                                                <td className="px-1 py-0.5 text-right font-mono font-semibold text-gray-800">{formatCurrency(bet.amount)}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                        {/* Right Column */}
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-[10px] border-collapse receipt-table print:text-[8px]">
                                                <thead>
                                                    <tr className="bg-gray-100 border-b border-gray-300">
                                                        <th className="px-1 py-0.5 text-left font-semibold text-gray-700">#</th>
                                                        <th className="px-1 py-0.5 text-left font-semibold text-gray-700">Type</th>
                                                        <th className="px-1 py-0.5 text-left font-semibold text-gray-700">Number</th>
                                                        <th className="px-1 py-0.5 text-left font-semibold text-gray-700">Sess</th>
                                                        <th className="px-1 py-0.5 text-right font-semibold text-gray-700">Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedSession.bets.filter((_, index) => index % 2 === 1).map((bet, idx) => {
                                                        const actualIndex = idx * 2 + 1;
                                                        return (
                                                            <tr key={bet._id} className="border-b border-gray-100">
                                                                <td className="px-1 py-0.5 text-gray-600">{actualIndex + 1}</td>
                                                                <td className="px-1 py-0.5 text-gray-800 capitalize">{getBetTypeLabel(bet.betType, bet.betNumber)}</td>
                                                                <td className="px-1 py-0.5 text-gray-800 font-mono font-semibold">{bet.betNumber || '—'}</td>
                                                                <td className="px-1 py-0.5 text-gray-600 uppercase text-[9px]">{bet.betOn || 'open'}</td>
                                                                <td className="px-1 py-0.5 text-right font-mono font-semibold text-gray-800">{formatCurrency(bet.amount)}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    {/* Total Row - Full Width */}
                                    <div className="mt-1 pt-0.5 border-t border-gray-300 bg-gray-50">
                                        <div className="flex justify-end text-[10px] print:text-[9px]">
                                            <span className="font-bold text-gray-700 mr-2">Total:</span>
                                            <span className="font-mono font-bold text-gray-800">{formatCurrency(totalAmount)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Calculations Section - Compact Grid */}
                                <div className="mb-1.5 pt-1.5 border-t border-gray-300">
                                    <h3 className="text-xs font-bold text-gray-800 mb-1 print:text-[9px]">CALCULATIONS</h3>
                                    
                                    {/* Total Bet Amount */}
                                    <div className="flex justify-between items-center py-0.5 text-[10px] print:text-[9px]">
                                        <span className="text-gray-600">Total Bet Amount:</span>
                                        <span className="font-mono font-semibold text-gray-800">{formatCurrency(totalAmount)}</span>
                                    </div>

                                    {/* Commission Row - Inline */}
                                    <div className="flex justify-between items-center py-0.5 text-[10px] print:text-[9px]">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-gray-600">Commission:</span>
                                            <input
                                                type="number"
                                                value={commissionPercent}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === '') {
                                                        setCommissionPercent('');
                                                    } else {
                                                        const num = Number(val);
                                                        if (!isNaN(num) && num >= 0 && num <= 100) {
                                                            setCommissionPercent(val);
                                                        }
                                                    }
                                                }}
                                                placeholder="0"
                                                className="w-16 px-1.5 py-0.5 border border-gray-300 rounded text-gray-800 font-semibold text-[10px] print:border-0 print:bg-transparent print:w-auto print:px-0"
                                                min="0"
                                                max="100"
                                                step="0.01"
                                            />
                                            <span className="text-gray-500 text-[9px]">%</span>
                                        </div>
                                        <span className="font-mono font-semibold text-red-600">{formatCurrency(commissionAmount)}</span>
                                    </div>

                                    {/* Remaining to Pay */}
                                    <div className="flex justify-between items-center py-0.5 text-[10px] print:text-[9px] bg-blue-50 print:bg-transparent">
                                        <span className="text-gray-700 font-medium">Remaining to Pay:</span>
                                        <span className="font-mono font-semibold text-blue-600">{formatCurrency(remainingToPay)}</span>
                                    </div>

                                    {/* Paid Row - Inline */}
                                    <div className="flex justify-between items-center py-0.5 text-[10px] print:text-[9px]">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-gray-600">Paid:</span>
                                            <input
                                                type="number"
                                                value={paid}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === '') {
                                                        setPaid('');
                                                    } else {
                                                        const num = Number(val);
                                                        if (!isNaN(num) && num >= 0) {
                                                            setPaid(val);
                                                        }
                                                    }
                                                }}
                                                placeholder="0"
                                                className="w-20 px-1.5 py-0.5 border border-gray-300 rounded text-gray-800 font-semibold text-[10px] print:border-0 print:bg-transparent print:w-auto print:px-0"
                                                min="0"
                                                step="0.01"
                                            />
                                        </div>
                                        <span className="font-mono font-semibold text-green-600">{formatCurrency(paidAmount)}</span>
                                    </div>

                                    {/* Cutting Row - Inline */}
                                    <div className="flex justify-between items-center py-0.5 text-[10px] print:text-[9px]">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-gray-600">Cutting:</span>
                                            <input
                                                type="number"
                                                value={cutting}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === '') {
                                                        setCutting('');
                                                    } else {
                                                        const num = Number(val);
                                                        if (!isNaN(num) && num >= 0) {
                                                            setCutting(val);
                                                        }
                                                    }
                                                }}
                                                placeholder="0"
                                                className="w-20 px-1.5 py-0.5 border border-gray-300 rounded text-gray-800 font-semibold text-[10px] print:border-0 print:bg-transparent print:w-auto print:px-0"
                                                min="0"
                                                step="0.01"
                                            />
                                        </div>
                                        <span className="font-mono font-semibold text-purple-600">{formatCurrency(cuttingAmount)}</span>
                                    </div>

                                    {/* To Give Row - Inline */}
                                    <div className="flex justify-between items-center py-0.5 text-[10px] print:text-[9px]">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-gray-600">To Give:</span>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={toGive}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/[^0-9.]/g, '').slice(0, 12);
                                                    setToGive(val);
                                                    setToGiveTakeError('');
                                                    setToGiveTakeSuccess('');
                                                }}
                                                className="w-20 px-1.5 py-0.5 border border-blue-300 rounded text-gray-800 font-semibold text-[10px] print:border-0 print:bg-transparent print:w-auto print:px-0 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                placeholder="0"
                                            />
                                            <button
                                                onClick={handleToGiveTakeUpdate}
                                                disabled={toGiveTakeLoading}
                                                className="text-orange-600 hover:text-orange-700 text-[9px] font-medium underline print:hidden disabled:opacity-50"
                                            >
                                                {toGiveTakeLoading ? 'Updating...' : 'Update'}
                                            </button>
                                        </div>
                                        <span className="font-mono font-semibold text-blue-600">{formatCurrency(Number(toGive) || 0)}</span>
                                    </div>
                                    {toGiveTakeError && <p className="text-red-500 text-[8px] mb-1 print:hidden">{toGiveTakeError}</p>}
                                    {toGiveTakeSuccess && <p className="text-green-600 text-[8px] mb-1 print:hidden">{toGiveTakeSuccess}</p>}

                                    {/* To Take Row - Inline */}
                                    <div className="flex justify-between items-center py-0.5 text-[10px] print:text-[9px]">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-gray-600">To Take:</span>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={toTake}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/[^0-9.]/g, '').slice(0, 12);
                                                    setToTake(val);
                                                    setToGiveTakeError('');
                                                    setToGiveTakeSuccess('');
                                                }}
                                                className="w-20 px-1.5 py-0.5 border border-red-300 rounded text-gray-800 font-semibold text-[10px] print:border-0 print:bg-transparent print:w-auto print:px-0 focus:outline-none focus:ring-1 focus:ring-red-500"
                                                placeholder="0"
                                            />
                                        </div>
                                        <span className="font-mono font-semibold text-red-600">{formatCurrency(Number(toTake) || 0)}</span>
                                    </div>

                                    {/* Final Total - Highlighted */}
                                    <div className="mt-1 pt-1 border-t-2 border-orange-400 flex justify-between items-center py-1 bg-orange-50 print:bg-transparent">
                                        <span className="text-gray-800 font-bold text-xs print:text-[10px]">FINAL TOTAL:</span>
                                        <span className="font-mono font-bold text-base text-orange-600 print:text-sm">{formatCurrency(finalTotal)}</span>
                                    </div>
                                </div>

                                {/* Footer - Ultra Compact */}
                                <div className="mt-1 pt-1 border-t border-gray-200 text-center text-[8px] text-gray-500 print:text-[7px]">
                                    <p>Generated: {new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })} | Computer Generated Receipt</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Layout>
        );
    }

    // Show players list if no player is selected
    if (!selectedPlayerId) {
        return (
            <Layout title="Receipt">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                        <FaFileInvoiceDollar className="text-orange-500" />
                        Receipts
                    </h1>
                </div>

                {/* Search */}
                <div className="mb-4 sm:mb-6">
                    <div className="relative max-w-md">
                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search by player name, phone or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={`w-full pl-10 py-2.5 bg-gray-100/80 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all text-sm sm:text-base ${searchQuery ? 'pr-10' : 'pr-4'}`}
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-800 text-sm"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
                        {error}
                    </div>
                )}

                {/* Players Table */}
                <div className="bg-white rounded-lg overflow-x-auto overflow-y-hidden border border-gray-200 min-w-0 max-w-full">
                    {loading ? (
                        <div className="p-8 text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto" />
                            <p className="mt-4 text-gray-400">Loading players...</p>
                        </div>
                    ) : players.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">
                            <p>No players found.</p>
                        </div>
                    ) : filteredPlayers.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">
                            No results match your search. Try a different term.
                        </div>
                    ) : (
                        <div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm min-w-[600px]">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase w-8">#</th>
                                            <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase">Player</th>
                                            <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase">Phone</th>
                                            <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase">Email</th>
                                            <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredPlayers.map((player, index) => (
                                            <tr key={player._id} className="hover:bg-gray-50">
                                                <td className="px-2 sm:px-3 py-2 sm:py-3 text-gray-600">{index + 1}</td>
                                                <td className="px-2 sm:px-3 py-2 sm:py-3 font-medium">
                                                    <span className="text-orange-500 truncate block max-w-[200px]">{player.username}</span>
                                                </td>
                                                <td className="px-2 sm:px-3 py-2 sm:py-3 text-gray-600">{player.phone || '—'}</td>
                                                <td className="px-2 sm:px-3 py-2 sm:py-3 text-gray-600 truncate max-w-[200px]">{player.email || '—'}</td>
                                                <td className="px-2 sm:px-3 py-2 sm:py-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => handlePlayerClick(player)}
                                                        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-colors"
                                                        title="View receipts"
                                                    >
                                                        <FaFileInvoiceDollar className="w-3 h-3" />
                                                        View Receipts
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Results Count */}
                {!loading && players.length > 0 && (
                    <p className="mt-4 text-gray-400 text-sm">
                        Showing {filteredPlayers.length} player{filteredPlayers.length !== 1 ? 's' : ''}
                        {searchQuery && filteredPlayers.length !== players.length && (
                            <span> (filtered from {players.length})</span>
                        )}
                    </p>
                )}
            </Layout>
        );
    }

    // Show sessions list for selected player
    return (
        <Layout title="Receipt">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
                <div>
                    <button
                        type="button"
                        onClick={handleBackToPlayers}
                        className="text-gray-400 hover:text-orange-500 text-sm inline-flex items-center gap-1 mb-2"
                    >
                        <FaArrowLeft className="w-3 h-3" /> Back to Players
                    </button>
                    <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                        <FaFileInvoiceDollar className="text-orange-500" />
                        Receipts - {selectedPlayerName}
                    </h1>
                </div>
            </div>

            {/* Date Range Selector */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-gray-500 text-sm">Date:</span>
                <div className="relative" ref={dropdownRef}>
                    <button
                        type="button"
                        onClick={() => setCalendarOpen((o) => !o)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 hover:border-orange-300 transition-colors"
                    >
                        <FaCalendarAlt className="w-3.5 h-3.5 text-orange-500" />
                        {dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : 'Select Date'}
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

            {/* Search */}
            <div className="mb-4 sm:mb-6">
                <div className="relative max-w-md">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search by market name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={`w-full pl-10 py-2.5 bg-gray-100/80 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all text-sm sm:text-base ${searchQuery ? 'pr-10' : 'pr-4'}`}
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-800 text-sm"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
                    {error}
                </div>
            )}

            {/* Sessions Table */}
            <div className="bg-white rounded-lg overflow-x-auto overflow-y-hidden border border-gray-200 min-w-0 max-w-full">
                {loading ? (
                    <div className="p-8 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto" />
                        <p className="mt-4 text-gray-400">Loading receipts...</p>
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        <p>No bet receipts found for the selected date range.</p>
                    </div>
                ) : filteredSessions.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        No results match your search. Try a different term.
                    </div>
                ) : (
                    <div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm min-w-[600px]">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase w-8">#</th>
                                        <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase">Market</th>
                                        <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase">Bets</th>
                                        <th className="px-2 sm:px-3 py-2 sm:py-3 text-right text-xs font-medium text-gray-600 uppercase">Amount</th>
                                        <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase">Date & Time</th>
                                        <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredSessions.map((session, index) => (
                                        <tr key={session.sessionId} className="hover:bg-gray-50">
                                            <td className="px-2 sm:px-3 py-2 sm:py-3 text-gray-600">{index + 1}</td>
                                            <td className="px-2 sm:px-3 py-2 sm:py-3 text-gray-600 truncate max-w-[200px]">{session.marketName}</td>
                                            <td className="px-2 sm:px-3 py-2 sm:py-3 text-gray-600">{session.totalBets}</td>
                                            <td className="px-2 sm:px-3 py-2 sm:py-3 text-right font-mono font-medium text-green-600 text-xs sm:text-sm">
                                                {formatCurrency(session.totalAmount)}
                                            </td>
                                            <td className="px-2 sm:px-3 py-2 sm:py-3 text-gray-600 text-xs whitespace-nowrap">
                                                {formatDateTime(session.createdAt)}
                                            </td>
                                            <td className="px-2 sm:px-3 py-2 sm:py-3">
                                                <button
                                                    type="button"
                                                    onClick={() => handleSessionClick(session)}
                                                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-colors"
                                                    title="View receipt"
                                                >
                                                    <FaFileInvoiceDollar className="w-3 h-3" />
                                                    View
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Results Count */}
            {!loading && sessions.length > 0 && (
                <p className="mt-4 text-gray-400 text-sm">
                    Showing {filteredSessions.length} receipt{filteredSessions.length !== 1 ? 's' : ''}
                    {searchQuery && filteredSessions.length !== sessions.length && (
                        <span> (filtered from {sessions.length})</span>
                    )}
                </p>
            )}
        </Layout>
    );
};

export default Receipt;
