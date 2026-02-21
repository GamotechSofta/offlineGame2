import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { API_BASE_URL, getBookieAuthHeaders } from '../utils/api';
import { useLanguage } from '../context/LanguageContext';
import { FaArrowLeft, FaSearch, FaUser } from 'react-icons/fa';

const BetsByUser = () => {
    const { t } = useLanguage();
    const [players, setPlayers] = useState([]);
    const [selectedPlayerId, setSelectedPlayerId] = useState(null);
    const [selectedPlayerName, setSelectedPlayerName] = useState(null);
    const [bets, setBets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [betsLoading, setBetsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState({ 
        marketId: '', 
        status: '', 
        startDate: '', 
        endDate: '' 
    });

    // Fetch players on mount
    useEffect(() => {
        fetchPlayers();
    }, []);

    // Fetch bets when player is selected or filters change
    useEffect(() => {
        if (selectedPlayerId) {
            fetchBets();
        } else {
            setBets([]);
        }
    }, [selectedPlayerId, filters]);

    const fetchPlayers = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/users`, {
                headers: getBookieAuthHeaders()
            });
            const data = await response.json();
            if (data.success) {
                setPlayers(data.data || []);
            } else {
                console.error('Failed to fetch players:', data.message);
            }
        } catch (err) {
            console.error('Error fetching players:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchBets = async () => {
        if (!selectedPlayerId) return;
        
        try {
            setBetsLoading(true);
            const q = new URLSearchParams();
            q.append('userId', selectedPlayerId);
            if (filters.marketId) q.append('marketId', filters.marketId);
            if (filters.status) q.append('status', filters.status);
            if (filters.startDate) q.append('startDate', filters.startDate);
            if (filters.endDate) q.append('endDate', filters.endDate);
            
            const response = await fetch(`${API_BASE_URL}/bets/by-user?${q}`, { 
                headers: getBookieAuthHeaders() 
            });
            const data = await response.json();
            if (data.success) {
                setBets(data.data);
            } else {
                console.error('Failed to fetch bets:', data.message);
                setBets([]);
            }
        } catch (err) {
            console.error('Error fetching bets:', err);
            setBets([]);
        } finally {
            setBetsLoading(false);
        }
    };

    const handlePlayerSelect = (player) => {
        setSelectedPlayerId(player._id);
        setSelectedPlayerName(player.username);
        setBets([]);
    };

    const handleBackToPlayers = () => {
        setSelectedPlayerId(null);
        setSelectedPlayerName(null);
        setBets([]);
        setFilters({ marketId: '', status: '', startDate: '', endDate: '' });
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(amount || 0);
    };

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'won':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'lost':
                return 'bg-red-100 text-red-800 border-red-200';
            case 'pending':
                return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'cancelled':
                return 'bg-gray-100 text-gray-800 border-gray-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getPannaSubLabel = (betNumber) => {
        const s = String(betNumber || '').trim();
        if (s.length !== 3 || !/^\d{3}$/.test(s)) return t('pana');
        const a = s[0], b = s[1], c = s[2];
        if (a === b && b === c) return t('triplePana');
        if (a === b || b === c || a === c) return t('doublePanaBulk');
        return t('singlePanaBulk');
    };
    const getBetTypeLabel = (betType, betNumber) => {
        const key = String(betType || '').trim().toLowerCase();
        if (key === 'panna') return getPannaSubLabel(betNumber);
        const labels = {
            'single': t('singleDigit'),
            'jodi': t('jodiBulk'),
            'half-sangam': t('halfSangamO'),
            'full-sangam': t('fullSangam'),
        };
        return labels[key] || betType;
    };

    // Filter players by search query
    const filteredPlayers = players.filter((player) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            player.username?.toLowerCase().includes(query) ||
            player.phone?.toLowerCase().includes(query) ||
            player.email?.toLowerCase().includes(query)
        );
    });

    // Show player list if no player is selected
    if (!selectedPlayerId) {
        return (
            <Layout title={t('betsByUser')}>
                <div className="space-y-6">
                    {/* Header */}
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
                            {t('betsByUser')}
                        </h1>
                        <p className="text-gray-600 text-sm">
                            {t('betsByUserDescription')}
                        </p>
                    </div>

                    {/* Search */}
                    <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                        <div className="relative">
                            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder={t('searchPlayers')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Players List */}
                    {loading ? (
                        <div className="bg-white rounded-lg p-12 border border-gray-200 shadow-sm">
                            <p className="text-gray-400 text-center">{t('loading')}</p>
                        </div>
                    ) : filteredPlayers.length === 0 ? (
                        <div className="bg-white rounded-lg p-12 border border-gray-200 shadow-sm">
                            <p className="text-gray-400 text-center">
                                {searchQuery ? t('noPlayersFound') : t('noPlayers')}
                            </p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                                {t('srNo')}
                                            </th>
                                            <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                                {t('player')}
                                            </th>
                                            <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                                {t('phone')}
                                            </th>
                                            <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                                {t('email')}
                                            </th>
                                            <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                                {t('actions')}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {filteredPlayers.map((player, index) => (
                                            <tr key={player._id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                    {index + 1}
                                                </td>
                                                <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <FaUser className="text-gray-400 w-4 h-4" />
                                                        <span className="text-sm font-medium text-gray-900">
                                                            {player.username || t('unknown')}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                    {player.phone || '—'}
                                                </td>
                                                <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                    {player.email || '—'}
                                                </td>
                                                <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                                                    <button
                                                        onClick={() => handlePlayerSelect(player)}
                                                        className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors text-sm font-medium"
                                                    >
                                                        {t('viewBets')}
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
            </Layout>
        );
    }

    // Show bets for selected player
    return (
        <Layout title={t('betsByUser')}>
            <div className="space-y-6">
                {/* Header with Back Button */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleBackToPlayers}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title={t('back')}
                    >
                        <FaArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
                            {t('betsByUser')} - {selectedPlayerName}
                        </h1>
                        <p className="text-gray-600 text-sm">
                            {t('betsByUserDescription')}
                        </p>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-lg p-4 sm:p-6 border border-gray-200 shadow-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                {t('marketId')}
                            </label>
                            <input
                                type="text"
                                placeholder={t('enterMarketId')}
                                value={filters.marketId}
                                onChange={(e) => setFilters({ ...filters, marketId: e.target.value })}
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                {t('status')}
                            </label>
                            <select
                                value={filters.status}
                                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                            >
                                <option value="">{t('allStatus')}</option>
                                <option value="pending">{t('pending')}</option>
                                <option value="won">{t('won')}</option>
                                <option value="lost">{t('lost')}</option>
                                <option value="cancelled">{t('cancelled')}</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                {t('startDate')}
                            </label>
                            <input
                                type="date"
                                value={filters.startDate}
                                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                {t('endDate')}
                            </label>
                            <input
                                type="date"
                                value={filters.endDate}
                                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                            />
                        </div>
                    </div>
                    <div className="mt-4">
                        <button
                            onClick={() => setFilters({ marketId: '', status: '', startDate: '', endDate: '' })}
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium"
                        >
                            {t('clearFilters')}
                        </button>
                    </div>
                </div>

                {/* Stats Summary */}
                {!betsLoading && bets.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                                {t('totalBets')}
                            </p>
                            <p className="text-2xl font-bold text-gray-800">
                                {bets.length}
                            </p>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                                {t('totalAmount')}
                            </p>
                            <p className="text-2xl font-bold text-orange-600">
                                {formatCurrency(bets.reduce((sum, bet) => sum + (bet.amount || 0), 0))}
                            </p>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                                {t('pendingBets')}
                            </p>
                            <p className="text-2xl font-bold text-orange-500">
                                {bets.filter(b => b.status === 'pending').length}
                            </p>
                        </div>
                    </div>
                )}

                {/* Bets Table */}
                {betsLoading ? (
                    <div className="bg-white rounded-lg p-12 border border-gray-200 shadow-sm">
                        <p className="text-gray-400 text-center">{t('loading')}</p>
                    </div>
                ) : bets.length === 0 ? (
                    <div className="bg-white rounded-lg p-12 border border-gray-200 shadow-sm">
                        <p className="text-gray-400 text-center">{t('noBetsFound')}</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                            {t('dateTime')}
                                        </th>
                                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                            {t('market')}
                                        </th>
                                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                            {t('betType')}
                                        </th>
                                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                            {t('betNumber')}
                                        </th>
                                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                            {t('amount')}
                                        </th>
                                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                            {t('status')}
                                        </th>
                                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                            {t('payout')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {bets.map((bet) => (
                                        <tr key={bet._id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {new Date(bet.createdAt).toLocaleString('en-IN', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </td>
                                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {bet.marketId?.marketName || bet.marketId?.gameName || '—'}
                                            </td>
                                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {getBetTypeLabel(bet.betType, bet.betNumber)}
                                            </td>
                                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                                                {bet.betNumber}
                                            </td>
                                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                                {formatCurrency(bet.amount)}
                                            </td>
                                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadgeClass(bet.status)}`}>
                                                    {t(bet.status)}
                                                </span>
                                            </td>
                                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                                                {bet.payout > 0 ? formatCurrency(bet.payout) : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default BetsByUser;
