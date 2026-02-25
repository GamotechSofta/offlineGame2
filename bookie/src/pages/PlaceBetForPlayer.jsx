import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { API_BASE_URL, getBookieAuthHeaders, fetchWithAuth } from '../utils/api';
import { FaArrowLeft, FaDice, FaCheck, FaTimes, FaPlus, FaTrash, FaSearch, FaUser } from 'react-icons/fa';

/* ─── Game type metadata ─── */
const GAME_META = {
    'single-digit': { label: 'Single Digit', betType: 'single', digits: 1, placeholder: 'Enter digit (0-9)', pattern: /^\d$/, help: 'Enter a single digit between 0 and 9' },
    'jodi':         { label: 'Jodi', betType: 'jodi', digits: 2, placeholder: 'Enter 2 digits (00-99)', pattern: /^\d{2}$/, help: 'Enter a two-digit number from 00 to 99' },
    'single-pana':  { label: 'Single Pana', betType: 'panna', digits: 3, placeholder: 'Enter 3 digits (all different)', pattern: /^\d{3}$/, help: 'Enter 3 digits where all are different, e.g. 123' },
    'double-pana':  { label: 'Double Pana', betType: 'panna', digits: 3, placeholder: 'Enter 3 digits (two same)', pattern: /^\d{3}$/, help: 'Enter 3 digits where two are same, e.g. 112' },
    'triple-pana':  { label: 'Triple Pana', betType: 'panna', digits: 3, placeholder: 'Enter 3 digits (all same)', pattern: /^\d{3}$/, help: 'Enter 3 digits where all are same, e.g. 000' },
    'half-sangam':  { label: 'Half Sangam', betType: 'half-sangam', digits: 0, placeholder: 'e.g. 123-4', pattern: /^\d{3}-\d$/, help: 'Enter in format: Pana-Digit (e.g. 123-4)' },
    'full-sangam':  { label: 'Full Sangam', betType: 'full-sangam', digits: 0, placeholder: 'e.g. 123-456', pattern: /^\d{3}-\d{3}$/, help: 'Enter in format: Pana-Pana (e.g. 123-456)' },
};

const PlaceBetForPlayer = () => {
    const navigate = useNavigate();
    const { marketId, gameType } = useParams();
    const [searchParams] = useSearchParams();
    const preSelectedPlayerId = searchParams.get('playerId') || '';

    const gameMeta = GAME_META[gameType] || GAME_META['single-digit'];

    const [market, setMarket] = useState(null);
    const [players, setPlayers] = useState([]);
    const [loadingMarket, setLoadingMarket] = useState(true);
    const [loadingPlayers, setLoadingPlayers] = useState(true);

    const [selectedPlayerId, setSelectedPlayerId] = useState(preSelectedPlayerId);
    const [session, setSession] = useState('open');
    const [playerSearch, setPlayerSearch] = useState('');
    const [showPlayerList, setShowPlayerList] = useState(!preSelectedPlayerId);

    const [bets, setBets] = useState([{ betNumber: '', amount: '' }]);
    const [placing, setPlacing] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Fetch market
    useEffect(() => {
        const fetchMarket = async () => {
            try {
                const res = await fetchWithAuth(`${API_BASE_URL}/markets/get-markets`);
                if (res.status === 401) return;
                const data = await res.json();
                if (data.success && Array.isArray(data.data)) {
                    const found = data.data.find((m) => m._id === marketId);
                    setMarket(found || null);
                    // Auto-detect session
                    if (found) {
                        const hasOpening = found.openingNumber && /^\d{3}$/.test(String(found.openingNumber));
                        if (hasOpening) setSession('close');
                        else setSession('open');
                    }
                }
            } catch (err) {
                // silent
            } finally {
                setLoadingMarket(false);
            }
        };
        fetchMarket();
    }, [marketId]);

    // Fetch players
    useEffect(() => {
        const fetchPlayers = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/users`, { headers: getBookieAuthHeaders() });
                const data = await res.json();
                if (data.success) setPlayers(data.data || []);
            } catch (err) {
                // silent
            } finally {
                setLoadingPlayers(false);
            }
        };
        fetchPlayers();
    }, []);

    const selectedPlayer = players.find((p) => p._id === selectedPlayerId);

    const filteredPlayers = useMemo(() => {
        if (!playerSearch.trim()) return players;
        const q = playerSearch.trim().toLowerCase();
        return players.filter((p) =>
            (p.username || '').toLowerCase().includes(q) ||
            (p.email || '').toLowerCase().includes(q) ||
            (p.phone || '').includes(q)
        );
    }, [players, playerSearch]);

    const addBetRow = () => {
        setBets([...bets, { betNumber: '', amount: '' }]);
    };

    const removeBetRow = (idx) => {
        if (bets.length <= 1) return;
        setBets(bets.filter((_, i) => i !== idx));
    };

    const updateBet = (idx, field, value) => {
        const updated = [...bets];
        updated[idx] = { ...updated[idx], [field]: value };
        setBets(updated);
    };

    const totalAmount = bets.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
    const validBets = bets.filter((b) => b.betNumber.trim() && Number(b.amount) > 0);

    const validateBetNumber = (num) => {
        if (!gameMeta.pattern) return true;
        return gameMeta.pattern.test(num.trim());
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!selectedPlayerId) {
            setError('Please select a player');
            return;
        }
        if (!marketId) {
            setError('Market not found');
            return;
        }
        if (validBets.length === 0) {
            setError('Please add at least one valid bet with number and amount');
            return;
        }

        // Validate all bet numbers match pattern
        for (const b of validBets) {
            if (!validateBetNumber(b.betNumber)) {
                setError(`Invalid number "${b.betNumber}" for ${gameMeta.label}. ${gameMeta.help}`);
                return;
            }
        }

        setPlacing(true);
        try {
            const payload = {
                userId: selectedPlayerId,
                marketId,
                bets: validBets.map((b) => ({
                    betType: gameMeta.betType,
                    betNumber: b.betNumber.trim(),
                    amount: Number(b.amount),
                    betOn: session,
                })),
            };

            const res = await fetch(`${API_BASE_URL}/bets/place-for-player`, {
                method: 'POST',
                headers: getBookieAuthHeaders(),
                body: JSON.stringify(payload),
            });
            const data = await res.json();

            if (data.success) {
                setSuccess(`Bet placed successfully! Your new balance: ₹${Number(data.data?.newBookieBalance ?? 0).toLocaleString('en-IN')}`);
                setBets([{ betNumber: '', amount: '' }]);
                // Refresh bookie profile to update sidebar balance
                try {
                    const profileRes = await fetch(`${API_BASE_URL}/bookie/profile`, { headers: getBookieAuthHeaders() });
                    const profileData = await profileRes.json();
                    if (profileData.success && profileData.data) {
                        // Update AuthContext with new balance
                        const stored = localStorage.getItem('bookie');
                        if (stored) {
                            const bookie = JSON.parse(stored);
                            bookie.balance = profileData.data.balance;
                            localStorage.setItem('bookie', JSON.stringify(bookie));
                        }
                    }
                } catch (e) { /* ignore */ }
            } else {
                setError(data.message || 'Failed to place bet');
            }
        } catch (err) {
            setError('Network error. Please check connection.');
        } finally {
            setPlacing(false);
        }
    };

    const backUrl = (() => {
        const query = preSelectedPlayerId ? `?playerId=${preSelectedPlayerId}` : '';
        return `/games/${marketId}${query}`;
    })();

    return (
        <Layout title={gameMeta.label}>
            <div className="min-w-0 max-w-full">
                {/* Back Button */}
                <button
                    type="button"
                    onClick={() => navigate(backUrl)}
                    className="text-gray-400 hover:text-orange-500 text-sm inline-flex items-center gap-1 mb-4"
                >
                    <FaArrowLeft className="w-3 h-3" /> Back to Game Types
                </button>

                {loadingMarket ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                    </div>
                ) : !market ? (
                    <div className="text-center py-12">
                        <p className="text-gray-400 text-lg">Market not found</p>
                    </div>
                ) : (
                    <>
                        {/* Header with Market + Game Type */}
                        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 mb-5">
                            <div className="flex items-center gap-3 flex-wrap">
                                <FaDice className="text-orange-500 w-6 h-6" />
                                <div>
                                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">{gameMeta.label}</h1>
                                    <p className="text-gray-400 text-sm">{market.marketName} • {market.displayResult || '***-**-***'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Success */}
                        {success && (
                            <div className="mb-4 p-4 bg-green-900/50 border border-green-700 rounded-xl text-green-200 flex items-center justify-between">
                                <span>{success}</span>
                                <button type="button" onClick={() => setSuccess('')} className="text-green-600 hover:text-gray-800 ml-2">
                                    <FaTimes className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {/* Error */}
                        {error && (
                            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 flex items-center justify-between">
                                <span>{error}</span>
                                <button type="button" onClick={() => setError('')} className="text-red-500 hover:text-gray-800 ml-2">
                                    <FaTimes className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Player Selection */}
                            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className="text-base font-semibold text-orange-500 flex items-center gap-2">
                                        <FaUser className="w-4 h-4" /> Select Player
                                    </h2>
                                    {selectedPlayer && !showPlayerList && (
                                        <button
                                            type="button"
                                            onClick={() => setShowPlayerList(true)}
                                            className="text-xs text-orange-500 hover:underline"
                                        >
                                            Change
                                        </button>
                                    )}
                                </div>

                                {/* Selected Player Badge */}
                                {selectedPlayer && !showPlayerList && (
                                    <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                        <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                                            <FaUser className="w-4 h-4 text-orange-500" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-gray-800 font-semibold truncate">{selectedPlayer.username}</p>
                                            <p className="text-xs text-gray-400">{selectedPlayer.phone || selectedPlayer.email || ''}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-green-600 font-mono font-bold text-sm">₹{Number(selectedPlayer.walletBalance ?? 0).toLocaleString('en-IN')}</p>
                                            <p className="text-xs text-gray-500">Balance</p>
                                        </div>
                                    </div>
                                )}

                                {/* Player Search & List */}
                                {(showPlayerList || !selectedPlayer) && (
                                    <>
                                        {loadingPlayers ? (
                                            <p className="text-gray-400 text-sm">Loading players...</p>
                                        ) : players.length === 0 ? (
                                            <p className="text-gray-400 text-sm">
                                                No players found.{' '}
                                                <button type="button" onClick={() => navigate('/add-user')} className="text-orange-500 hover:underline">
                                                    Add a player first
                                                </button>
                                            </p>
                                        ) : (
                                            <>
                                                <div className="relative mb-3">
                                                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-3.5 h-3.5" />
                                                    <input
                                                        type="text"
                                                        placeholder="Search by name, email or phone..."
                                                        value={playerSearch}
                                                        onChange={(e) => setPlayerSearch(e.target.value)}
                                                        className="w-full pl-9 pr-4 py-2.5 bg-gray-100/80 border border-gray-200 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 text-sm"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                                                    {filteredPlayers.map((p) => (
                                                        <button
                                                            key={p._id}
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedPlayerId(p._id);
                                                                setShowPlayerList(false);
                                                                setPlayerSearch('');
                                                            }}
                                                            className={`text-left px-3 py-2.5 rounded-lg border transition-all text-sm ${
                                                                selectedPlayerId === p._id
                                                                    ? 'bg-orange-500/20 border-orange-500 text-orange-600'
                                                                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-100'
                                                            }`}
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <span className="font-medium truncate">{p.username}</span>
                                                                {selectedPlayerId === p._id && <FaCheck className="w-3 h-3 text-orange-500 shrink-0 ml-1" />}
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className="text-xs text-gray-500">{p.phone || p.email || ''}</span>
                                                                <span className="text-xs font-mono text-green-600 ml-auto">₹{Number(p.walletBalance ?? 0).toLocaleString('en-IN')}</span>
                                                            </div>
                                                        </button>
                                                    ))}
                                                    {filteredPlayers.length === 0 && (
                                                        <p className="text-gray-500 text-sm col-span-2 text-center py-3">No players match your search</p>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Session */}
                            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
                                <label className="block text-sm font-semibold text-orange-500 mb-3">Session</label>
                                <div className="flex gap-2">
                                    {['open', 'close'].map((s) => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => setSession(s)}
                                            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                                                session === s
                                                    ? 'bg-orange-500 text-gray-800 shadow-lg shadow-orange-500/20'
                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                        >
                                            {s.charAt(0).toUpperCase() + s.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Bet Entries */}
                            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className="text-base font-semibold text-orange-500">
                                        Enter {gameMeta.label} Bets
                                    </h2>
                                    <span className="text-xs text-gray-500">{gameMeta.help}</span>
                                </div>

                                <div className="space-y-2">
                                    {bets.map((bet, idx) => (
                                        <div key={idx} className="flex gap-2 items-center">
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    value={bet.betNumber}
                                                    onChange={(e) => updateBet(idx, 'betNumber', e.target.value.replace(/[^0-9\-]/g, ''))}
                                                    placeholder={gameMeta.placeholder}
                                                    className={`w-full px-3 py-2.5 bg-gray-100 border rounded-lg text-gray-800 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 font-mono ${
                                                        bet.betNumber && !validateBetNumber(bet.betNumber)
                                                            ? 'border-red-500'
                                                            : 'border-gray-200'
                                                    }`}
                                                />
                                            </div>
                                            <div className="w-28">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={bet.amount}
                                                    onChange={(e) => updateBet(idx, 'amount', e.target.value)}
                                                    placeholder="Amount ₹"
                                                    className="w-full px-3 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-gray-800 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                                                />
                                            </div>
                                            {bets.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeBetRow(idx)}
                                                    className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-800/50 transition-colors shrink-0"
                                                    title="Remove"
                                                >
                                                    <FaTrash className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <button
                                    type="button"
                                    onClick={addBetRow}
                                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors text-sm font-medium"
                                >
                                    <FaPlus className="w-3 h-3" /> Add More
                                </button>
                            </div>

                            {/* Summary & Submit */}
                            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
                                <div className="grid grid-cols-3 gap-3 text-sm mb-4">
                                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                                        <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Bets</p>
                                        <p className="text-gray-800 font-mono font-bold text-lg">{validBets.length}</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                                        <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Total</p>
                                        <p className="text-orange-500 font-mono font-bold text-lg">₹{totalAmount.toLocaleString('en-IN')}</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                                        <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Balance</p>
                                        <p className="text-green-600 font-mono font-bold text-lg">₹{Number(selectedPlayer?.walletBalance ?? 0).toLocaleString('en-IN')}</p>
                                    </div>
                                </div>

                                {selectedPlayer && totalAmount > (selectedPlayer.walletBalance ?? 0) && (
                                    <div className="mb-4 px-3 py-2 rounded-lg bg-red-900/30 border border-red-600/50 text-red-300 text-sm">
                                        Insufficient balance! Player has ₹{Number(selectedPlayer.walletBalance ?? 0).toLocaleString('en-IN')} but bet requires ₹{totalAmount.toLocaleString('en-IN')}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={placing || !selectedPlayerId || validBets.length === 0}
                                    className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-gray-800 font-bold py-3.5 px-4 rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-orange-500/20 text-base"
                                >
                                    {placing ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-black" />
                                            Placing Bet...
                                        </span>
                                    ) : (
                                        <span className="flex items-center justify-center gap-2">
                                            <FaDice className="w-5 h-5" />
                                            Place {gameMeta.label} Bet
                                        </span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </Layout>
    );
};

export default PlaceBetForPlayer;
