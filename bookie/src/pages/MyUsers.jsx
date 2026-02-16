import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useNavigate, Link } from 'react-router-dom';
import { API_BASE_URL, getBookieAuthHeaders } from '../utils/api';
import { FaUserPlus, FaSearch, FaGamepad, FaWallet, FaEye } from 'react-icons/fa';
import { useLanguage } from '../context/LanguageContext';

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

const computeIsOnline = (item) => {
    const lastActive = item?.lastActiveAt ? new Date(item.lastActiveAt).getTime() : 0;
    return lastActive > 0 && Date.now() - lastActive < ONLINE_THRESHOLD_MS;
};

const MyUsers = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [, setTick] = useState(0);

    const fetchData = async (showLoader = true) => {
        if (showLoader) setLoading(true);
        if (showLoader) setError('');
        try {
            const response = await fetch(`${API_BASE_URL}/users`, {
                headers: getBookieAuthHeaders(),
            });
            const data = await response.json();
            if (data.success) {
                setUsers(data.data || []);
            } else {
                if (showLoader) setError(data.message || 'Failed to fetch users');
            }
        } catch (err) {
            if (showLoader) setError('Network error. Please check if the server is running.');
        } finally {
            if (showLoader) setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(true);
        // Auto-refresh every 15 seconds
        const refreshInterval = setInterval(() => fetchData(false), 15000);
        // Tick to re-evaluate online status
        const tickInterval = setInterval(() => setTick((t) => t + 1), 5000);
        return () => {
            clearInterval(refreshInterval);
            clearInterval(tickInterval);
        };
    }, []);

    const q = searchQuery.trim().toLowerCase();
    const filteredUsers = q
        ? users.filter((item) => {
            const username = (item.username || '').toLowerCase();
            const email = (item.email || '').toLowerCase();
            const phone = (item.phone || '').toString();
            return username.includes(q) || email.includes(q) || phone.includes(q);
        })
        : users;

    const activeCount = users.filter((u) => u.isActive !== false).length;
    const suspendedCount = users.filter((u) => u.isActive === false).length;
    const onlineCount = users.filter((u) => computeIsOnline(u)).length;

    return (
        <Layout title={t('myPlayers')}>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold">{t('myPlayersTitle')}</h1>
                <button
                    type="button"
                    onClick={() => navigate('/add-user')}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-500/90 text-gray-800 font-semibold transition-colors text-sm sm:text-base shrink-0"
                >
                    <FaUserPlus className="w-5 h-5" />
                    {t('addPlayer')}
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">{t('totalPlayersLabel')}</p>
                    <p className="text-2xl font-bold text-gray-800 font-mono">{users.length}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">{t('activeLabel')}</p>
                    <p className="text-2xl font-bold text-green-600 font-mono">{activeCount}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">{t('suspended')}</p>
                    <p className="text-2xl font-bold text-red-500 font-mono">{suspendedCount}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">{t('onlineNow')}</p>
                    <p className="text-2xl font-bold text-orange-500 font-mono">{onlineCount}</p>
                </div>
            </div>

            {/* Search */}
            <div className="mb-4 sm:mb-6">
                <div className="relative max-w-md">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder={t('searchPlayers')}
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

            {/* Table */}
            <div className="bg-white rounded-lg overflow-x-auto overflow-y-hidden border border-gray-200 min-w-0 max-w-full">
                {loading ? (
                    <div className="p-8 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto" />
                        <p className="mt-4 text-gray-400">{t('loading')}</p>
                    </div>
                ) : users.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        <p>{t('noData')}</p>
                        <p className="mt-2 text-sm">Players who register through your referral link or are created by you will appear here.</p>
                        <button
                            type="button"
                            onClick={() => navigate('/add-user')}
                            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-500/90 text-gray-800 font-semibold text-sm"
                        >
                            <FaUserPlus className="w-4 h-4" /> {t('addPlayer')}
                        </button>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        {t('noData')}
                    </div>
                ) : (
                    <div>
                        {/* Desktop Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm min-w-[1000px]">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase w-8">#</th>
                                        <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase">{t('username')}</th>
                                        <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase">{t('email')}</th>
                                        <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase">{t('phone')}</th>
                                        <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase">{t('balance')}</th>
                                        <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase">{t('toGive')}</th>
                                        <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase">{t('toTake')}</th>
                                        <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase">{t('status')}</th>
                                        <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase">Account</th>
                                        <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase">Created</th>
                                        <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase">{t('actions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredUsers.map((item, index) => {
                                        const isOnline = computeIsOnline(item);
                                        return (
                                            <tr key={item._id} className="hover:bg-gray-50">
                                                <td className="px-2 sm:px-3 py-2 sm:py-3 text-gray-600">{index + 1}</td>
                                                <td className="px-2 sm:px-3 py-2 sm:py-3 font-medium">
                                                    <Link to={`/my-users/${item._id}`} className="text-orange-500 hover:text-orange-600 hover:underline truncate block max-w-[140px]">{item.username}</Link>
                                                </td>
                                                <td className="px-2 sm:px-3 py-2 sm:py-3 text-gray-600 truncate max-w-[160px]">{item.email || '—'}</td>
                                                <td className="px-2 sm:px-3 py-2 sm:py-3 text-gray-600">{item.phone || '—'}</td>
                                                <td className="px-2 sm:px-3 py-2 sm:py-3">
                                                    <span className="font-mono font-medium text-green-600 text-xs sm:text-sm">
                                                        ₹{Number(item.walletBalance ?? 0).toLocaleString('en-IN')}
                                                    </span>
                                                </td>
                                                <td className="px-2 sm:px-3 py-2 sm:py-3">
                                                    <span className="font-mono font-medium text-blue-600 text-xs sm:text-sm">
                                                        ₹{Number(item.toGive ?? 0).toLocaleString('en-IN')}
                                                    </span>
                                                </td>
                                                <td className="px-2 sm:px-3 py-2 sm:py-3">
                                                    <span className="font-mono font-medium text-red-600 text-xs sm:text-sm">
                                                        ₹{Number(item.toTake ?? 0).toLocaleString('en-IN')}
                                                    </span>
                                                </td>
                                                <td className="px-2 sm:px-3 py-2 sm:py-3">
                                                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                                                        isOnline
                                                            ? 'bg-green-900/50 text-green-600 border border-green-700'
                                                            : 'bg-gray-100 text-gray-400 border border-gray-200'
                                                    }`}>
                                                        <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-500'}`} />
                                                        {isOnline ? t('online') : t('offline')}
                                                    </span>
                                                </td>
                                                <td className="px-2 sm:px-3 py-2 sm:py-3">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                        item.isActive !== false
                                                            ? 'bg-green-900/50 text-green-600 border border-green-700'
                                                            : 'bg-red-50 text-red-500 border border-red-200'
                                                    }`}>
                                                        {item.isActive !== false ? t('active') : t('suspended')}
                                                    </span>
                                                </td>
                                                <td className="px-2 sm:px-3 py-2 sm:py-3 text-gray-600 text-xs">
                                                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN', {
                                                        day: '2-digit',
                                                        month: 'short',
                                                        year: 'numeric',
                                                    }) : '—'}
                                                </td>
                                                <td className="px-2 sm:px-3 py-2 sm:py-3">
                                                    <div className="flex items-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); navigate(`/my-users/${item._id}`); }}
                                                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition-colors"
                                                            title={t('viewDetails')}
                                                        >
                                                            <FaEye className="w-3 h-3" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); navigate(`/games?playerId=${item._id}`); }}
                                                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-colors"
                                                            title="Place bet for this player"
                                                        >
                                                            <FaGamepad className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Results Count */}
            {!loading && users.length > 0 && (
                <p className="mt-4 text-gray-400 text-sm">
                    Showing {filteredUsers.length} player{filteredUsers.length !== 1 ? 's' : ''}
                    {searchQuery && filteredUsers.length !== users.length && (
                        <span> (filtered from {users.length})</span>
                    )}
                </p>
            )}
        </Layout>
    );
};

export default MyUsers;
