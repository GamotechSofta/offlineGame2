import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, getBookieAuthHeaders } from '../utils/api';
import { useLanguage } from '../context/LanguageContext';
import {
    FaPlus,
    FaTrash,
    FaPrint,
    FaSave,
    FaUser,
    FaCalendarAlt,
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

const getBetTypeLabel = (type, betNumber = '') => {
    const labels = {
        'single': 'Single',
        'jodi': 'Jodi',
        'panna': 'Panna',
        'half-sangam': 'Half Sangam',
        'full-sangam': 'Full Sangam',
    };
    
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

const CreateReceipt = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    
    // Form state
    const [playerName, setPlayerName] = useState('');
    const [playerPhone, setPlayerPhone] = useState('');
    const [marketName, setMarketName] = useState('');
    const [receiptDate, setReceiptDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [receiptTime, setReceiptTime] = useState(() => {
        const d = new Date();
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    });
    const [openingNumber, setOpeningNumber] = useState('');
    const [closingNumber, setClosingNumber] = useState('');
    
    // Bets array
    const [bets, setBets] = useState([
        { id: 1, betType: 'single', betNumber: '', betOn: 'open', amount: '' }
    ]);
    
    // Calculations
    const [commissionPercent, setCommissionPercent] = useState('');
    const [paid, setPaid] = useState('');
    const [cutting, setCutting] = useState('');
    const [toGive, setToGive] = useState('');
    const [toTake, setToTake] = useState('');
    
    // Players list for autocomplete
    const [players, setPlayers] = useState([]);
    const [showPlayerSuggestions, setShowPlayerSuggestions] = useState(false);
    const [filteredPlayers, setFilteredPlayers] = useState([]);
    
    // Markets list for dropdown
    const [markets, setMarkets] = useState([]);
    const [loadingMarkets, setLoadingMarkets] = useState(false);
    
    // Loading and errors
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        fetchPlayers();
        fetchMarkets();
    }, []);

    useEffect(() => {
        if (playerName.trim()) {
            const filtered = players.filter(p => 
                p.username.toLowerCase().includes(playerName.toLowerCase()) ||
                (p.phone && p.phone.includes(playerName))
            );
            setFilteredPlayers(filtered);
            setShowPlayerSuggestions(filtered.length > 0);
        } else {
            setShowPlayerSuggestions(false);
        }
    }, [playerName, players]);

    const fetchPlayers = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/users`, {
                headers: getBookieAuthHeaders(),
            });
            const data = await response.json();
            if (data.success) {
                setPlayers(data.data || []);
            }
        } catch (err) {
            // Silently fail
        }
    };

    const fetchMarkets = async () => {
        try {
            setLoadingMarkets(true);
            const response = await fetch(`${API_BASE_URL}/markets/get-markets`, {
                headers: getBookieAuthHeaders(),
            });
            const data = await response.json();
            if (data.success) {
                setMarkets(data.data || []);
            }
        } catch (err) {
            // Silently fail
        } finally {
            setLoadingMarkets(false);
        }
    };

    const handlePlayerSelect = (player) => {
        setPlayerName(player.username);
        setPlayerPhone(player.phone || '');
        setToGive((player.toGive || 0).toString());
        setToTake((player.toTake || 0).toString());
        setShowPlayerSuggestions(false);
    };

    const addBet = () => {
        const newId = Math.max(...bets.map(b => b.id), 0) + 1;
        setBets([...bets, { id: newId, betType: 'single', betNumber: '', betOn: 'open', amount: '' }]);
    };

    const removeBet = (id) => {
        if (bets.length > 1) {
            setBets(bets.filter(b => b.id !== id));
        }
    };

    const updateBet = (id, field, value) => {
        setBets(bets.map(b => 
            b.id === id ? { ...b, [field]: value } : b
        ));
    };

    const calculateTotals = () => {
        const totalAmount = bets.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
        const commissionPercentValue = Number(commissionPercent) || 0;
        const commissionAmount = (totalAmount * commissionPercentValue) / 100;
        const paidAmount = Number(paid) || 0;
        const cuttingAmount = Number(cutting) || 0;
        const remainingToPay = totalAmount - commissionAmount;
        const finalTotal = remainingToPay - paidAmount - cuttingAmount;
        
        return {
            totalAmount,
            commissionAmount,
            paidAmount,
            cuttingAmount,
            remainingToPay,
            finalTotal
        };
    };

    const validateForm = () => {
        if (!playerName.trim()) {
            setError('Player name is required');
            return false;
        }
        if (!marketName.trim()) {
            setError('Market name is required');
            return false;
        }
        if (bets.some(b => !b.betNumber.trim() || !b.amount || Number(b.amount) <= 0)) {
            setError('All bets must have a number and amount');
            return false;
        }
        return true;
    };

    const handlePrintReceipt = () => {
        if (!validateForm()) return;
        
        const { totalAmount, commissionAmount, paidAmount, cuttingAmount, remainingToPay, finalTotal } = calculateTotals();
        const receiptDateTime = new Date(`${receiptDate}T${receiptTime}`);
        
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
                            <span><span class="label">Date:</span> <span class="value">${formatDate(receiptDateTime)}</span></span>
                            <span><span class="label">Market:</span> <span class="value">${marketName}</span></span>
                            <span><span class="label">Time:</span> <span class="value">${formatDateTime(receiptDateTime)}</span></span>
                        </div>
                    </div>

                    <div class="receipt-header">
                        <div class="receipt-header-row">
                            <span><span class="label">Player:</span> <span class="value">${playerName}</span></span>
                            <span><span class="label">Phone:</span> <span class="value">${playerPhone || '—'}</span></span>
                        </div>
                    </div>
                    ${openingNumber || closingNumber ? `
                    <div class="receipt-header">
                        <div class="receipt-header-row">
                            ${openingNumber ? `<span><span class="label">Open:</span> <span class="value" style="font-family: monospace; font-weight: bold;">${openingNumber}</span></span>` : ''}
                            ${closingNumber ? `<span><span class="label">Close:</span> <span class="value" style="font-family: monospace; font-weight: bold;">${closingNumber}</span></span>` : ''}
                            ${openingNumber && closingNumber ? `<span><span class="label">Jodi:</span> <span class="value" style="font-family: monospace; font-weight: bold; color: #ea580c;">${openingNumber.slice(-1) + closingNumber.slice(-1)}</span></span>` : ''}
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
                                    ${bets.filter((_, index) => index % 2 === 0).map((bet, idx) => {
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
                                    ${bets.filter((_, index) => index % 2 === 1).map((bet, idx) => {
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
                            <span class="label">Commission (${Number(commissionPercent) || 0}%):</span>
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
                        <div class="calc-row">
                            <span class="label">To Give:</span>
                            <span class="value" style="color: #2563eb;">${formatCurrency(Number(toGive) || 0)}</span>
                        </div>
                        <div class="calc-row">
                            <span class="label">To Take:</span>
                            <span class="value" style="color: #dc2626;">${formatCurrency(Number(toTake) || 0)}</span>
                        </div>
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

    const { totalAmount, commissionAmount, paidAmount, cuttingAmount, remainingToPay, finalTotal } = calculateTotals();

    return (
        <Layout title={t('createReceipt')}>
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <FaSave className="w-8 h-8 text-orange-500" />
                        {t('createReceipt')}
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">{t('createReceiptDescription')}</p>
                </div>

                {/* Error/Success Messages */}
                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 text-red-600">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="bg-green-50 border-l-4 border-green-500 rounded-lg p-4 text-green-600">
                        {success}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Form */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Player & Market Info */}
                        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <FaUser className="w-5 h-5 text-orange-500" />
                                {t('playerAndMarketInfo')}
                            </h2>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Player Name with Autocomplete */}
                                <div className="sm:col-span-2 relative">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {t('playerName')} <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={playerName}
                                        onChange={(e) => {
                                            setPlayerName(e.target.value);
                                            setError('');
                                        }}
                                        onFocus={() => setShowPlayerSuggestions(filteredPlayers.length > 0)}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                        placeholder={t('enterPlayerName')}
                                    />
                                    {showPlayerSuggestions && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                            {filteredPlayers.map((player) => (
                                                <button
                                                    key={player._id}
                                                    type="button"
                                                    onClick={() => handlePlayerSelect(player)}
                                                    className="w-full text-left px-4 py-2 hover:bg-orange-50 border-b border-gray-100 last:border-b-0"
                                                >
                                                    <div className="font-medium">{player.username}</div>
                                                    {player.phone && (
                                                        <div className="text-xs text-gray-500">{player.phone}</div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Player Phone */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {t('phone')}
                                    </label>
                                    <input
                                        type="text"
                                        value={playerPhone}
                                        onChange={(e) => setPlayerPhone(e.target.value)}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                        placeholder={t('enterPhone')}
                                    />
                                </div>

                                {/* Market Name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {t('marketName')} <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={marketName}
                                            onChange={(e) => {
                                                setMarketName(e.target.value);
                                                setError('');
                                            }}
                                            disabled={loadingMarkets}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white appearance-none pr-10"
                                        >
                                            <option value="">{loadingMarkets ? t('loading') : t('selectMarket')}</option>
                                            {markets.map((market) => (
                                                <option key={market._id} value={market.name || market.marketName}>
                                                    {market.name || market.marketName}
                                                </option>
                                            ))}
                                        </select>
                                        {loadingMarkets && (
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
                                            </div>
                                        )}
                                        {!loadingMarkets && (
                                            <FaStore className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                        )}
                                    </div>
                                    {/* Allow manual entry if market not in list */}
                                    <input
                                        type="text"
                                        value={marketName && !markets.find(m => (m.name || m.marketName) === marketName) ? marketName : ''}
                                        onChange={(e) => {
                                            setMarketName(e.target.value);
                                            setError('');
                                        }}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 mt-2"
                                        placeholder={t('orEnterMarketNameManually')}
                                    />
                                </div>

                                {/* Date */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {t('date')} <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={receiptDate}
                                        onChange={(e) => setReceiptDate(e.target.value)}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                    />
                                </div>

                                {/* Time */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {t('time')}
                                    </label>
                                    <input
                                        type="time"
                                        value={receiptTime}
                                        onChange={(e) => setReceiptTime(e.target.value)}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                    />
                                </div>

                                {/* Opening Number */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {t('openingNumber')}
                                    </label>
                                    <input
                                        type="text"
                                        value={openingNumber}
                                        onChange={(e) => setOpeningNumber(e.target.value)}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono"
                                        placeholder="000"
                                    />
                                </div>

                                {/* Closing Number */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {t('closingNumber')}
                                    </label>
                                    <input
                                        type="text"
                                        value={closingNumber}
                                        onChange={(e) => setClosingNumber(e.target.value)}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono"
                                        placeholder="000"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Bets Section */}
                        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-bold text-gray-800">
                                    {t('betDetails')}
                                </h2>
                                <button
                                    type="button"
                                    onClick={addBet}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
                                >
                                    <FaPlus className="w-4 h-4" />
                                    {t('addBet')}
                                </button>
                            </div>

                            <div className="space-y-3">
                                {bets.map((bet, index) => (
                                    <div key={bet.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-sm font-medium text-gray-700">
                                                {t('bet')} #{index + 1}
                                            </span>
                                            {bets.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeBet(bet.id)}
                                                    className="text-red-500 hover:text-red-700"
                                                >
                                                    <FaTrash className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                                    {t('betType')}
                                                </label>
                                                <select
                                                    value={bet.betType}
                                                    onChange={(e) => updateBet(bet.id, 'betType', e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                >
                                                    <option value="single">Single</option>
                                                    <option value="jodi">Jodi</option>
                                                    <option value="panna">Panna</option>
                                                    <option value="half-sangam">Half Sangam</option>
                                                    <option value="full-sangam">Full Sangam</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                                    {t('betNumber')} <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={bet.betNumber}
                                                    onChange={(e) => updateBet(bet.id, 'betNumber', e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                    placeholder="000"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                                    {t('session')}
                                                </label>
                                                <select
                                                    value={bet.betOn}
                                                    onChange={(e) => updateBet(bet.id, 'betOn', e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                >
                                                    <option value="open">Open</option>
                                                    <option value="close">Close</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                                    {t('amount')} <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={bet.amount}
                                                    onChange={(e) => updateBet(bet.id, 'amount', e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Calculations & Actions */}
                    <div className="space-y-6">
                        {/* Calculations */}
                        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                            <h2 className="text-lg font-bold text-gray-800">
                                {t('calculations')}
                            </h2>

                            <div className="space-y-3">
                                <div className="flex justify-between items-center py-2 border-b border-gray-200">
                                    <span className="text-sm text-gray-600">{t('totalBetAmount')}:</span>
                                    <span className="font-mono font-bold text-gray-800">{formatCurrency(totalAmount)}</span>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        {t('commission')} (%)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        value={commissionPercent}
                                        onChange={(e) => setCommissionPercent(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        placeholder="0"
                                    />
                                    <div className="text-right mt-1">
                                        <span className="text-xs font-mono text-red-600">{formatCurrency(commissionAmount)}</span>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center py-2 bg-blue-50 rounded-lg px-3">
                                    <span className="text-sm font-medium text-gray-700">{t('remainingToPay')}:</span>
                                    <span className="font-mono font-bold text-blue-600">{formatCurrency(remainingToPay)}</span>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        {t('paid')}
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={paid}
                                        onChange={(e) => setPaid(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        placeholder="0"
                                    />
                                    <div className="text-right mt-1">
                                        <span className="text-xs font-mono text-green-600">{formatCurrency(paidAmount)}</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        {t('cutting')}
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={cutting}
                                        onChange={(e) => setCutting(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        placeholder="0"
                                    />
                                    <div className="text-right mt-1">
                                        <span className="text-xs font-mono text-purple-600">{formatCurrency(cuttingAmount)}</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        {t('toGive')}
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={toGive}
                                        onChange={(e) => setToGive(e.target.value)}
                                        className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="0"
                                    />
                                    <div className="text-right mt-1">
                                        <span className="text-xs font-mono text-blue-600">{formatCurrency(Number(toGive) || 0)}</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                        {t('toTake')}
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={toTake}
                                        onChange={(e) => setToTake(e.target.value)}
                                        className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                        placeholder="0"
                                    />
                                    <div className="text-right mt-1">
                                        <span className="text-xs font-mono text-red-600">{formatCurrency(Number(toTake) || 0)}</span>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center py-3 bg-orange-50 rounded-lg px-3 border-t-2 border-orange-400 mt-4">
                                    <span className="text-sm font-bold text-gray-800">{t('finalTotal')}:</span>
                                    <span className="font-mono font-bold text-lg text-orange-600">{formatCurrency(finalTotal)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
                            <button
                                type="button"
                                onClick={handlePrintReceipt}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
                            >
                                <FaPrint className="w-5 h-5" />
                                {t('printReceipt')}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setPlayerName('');
                                    setPlayerPhone('');
                                    setMarketName('');
                                    setBets([{ id: 1, betType: 'single', betNumber: '', betOn: 'open', amount: '' }]);
                                    setCommissionPercent('');
                                    setPaid('');
                                    setCutting('');
                                    setToGive('');
                                    setToTake('');
                                    setOpeningNumber('');
                                    setClosingNumber('');
                                    setError('');
                                    setSuccess('');
                                }}
                                className="w-full px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
                            >
                                {t('clearForm')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default CreateReceipt;
