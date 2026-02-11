import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useNavigate, Link } from 'react-router-dom';
import { API_BASE_URL, getBookieAuthHeaders } from '../utils/api';
import { FaUserPlus, FaSearch, FaGamepad } from 'react-icons/fa';

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

const computeIsOnline = (item) => {
    const lastActive = item?.lastActiveAt ? new Date(item.lastActiveAt).getTime() : 0;
    return lastActive > 0 && Date.now() - lastActive < ONLINE_THRESHOLD_MS;
};

const MyUsers = () => {
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
        <Layout title="My Players">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold">My Players</h1>
                <button
                    type="button"
                    onClick={() => navigate('/add-user')}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-yellow-500 hover:bg-yellow-500/90 text-black font-semibold transition-colors text-sm sm:text-base shrink-0"
                >
                    <FaUserPlus className="w-5 h-5" />
                    Add Player
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="bg-gray-800/80 rounded-xl p-4 border border-gray-700/50">
                    <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Total Players</p>
                    <p className="text-2xl font-bold text-white font-mono">{users.length}</p>
                </div>
                <div className="bg-gray-800/80 rounded-xl p-4 border border-gray-700/50">
                    <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Active</p>
                    <p className="text-2xl font-bold text-green-400 font-mono">{activeCount}</p>
                </div>
                <div className="bg-gray-800/80 rounded-xl p-4 border border-gray-700/50">
                    <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Suspended</p>
                    <p className="text-2xl font-bold text-red-400 font-mono">{suspendedCount}</p>
                </div>
                <div className="bg-gray-800/80 rounded-xl p-4 border border-gray-700/50">
                    <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Online Now</p>
                    <p className="text-2xl font-bold text-amber-400 font-mono">{onlineCount}</p>
                </div>
            </div>

            {/* Search */}
            <div className="mb-4 sm:mb-6">
                <div className="relative max-w-md">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search by name, email or phone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={`w-full pl-10 py-2.5 bg-gray-700/80 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all text-sm sm:text-base ${searchQuery ? 'pr-10' : 'pr-4'}`}
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-sm"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
                    {error}
                </div>
            )}

            {/* Table */}
            <div className="bg-gray-800 rounded-lg overflow-x-auto overflow-y-hidden border border-gray-700 min-w-0 max-w-full">
                {loading ? (
                    <div className="p-8 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto" />
                        <p className="mt-4 text-gray-400">Loading players...</p>
                    </div>
                ) : users.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        <p>No players found.</p>
                        <p className="mt-2 text-sm">Players who register through your referral link or are created by you will appear here.</p>
                        <button
                            type="button"
                            onClick={() => navigate('/add-user')}
                            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-500/90 text-black font-semibold text-sm"
                        >
                            <FaUserPlus className="w-4 h-4" /> Add Player
                        </button>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        No results match your search. Try a different term.
                    </div>
                ) : (
                    <div>
                        {/* Desktop Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm min-w-[800px]">
                                <thead className="bg-gray-700">
                                    <tr>
                                        <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-300 uppercase w-8">#</th>
                                        <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-300 uppercase">Name</th>
                                        <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-300 uppercase">Email</th>
                                        <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-300 uppercase">Phone</th>
                                        <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-300 uppercase">Wallet</th>
                                        <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-300 uppercase">Status</th>
                                        <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-300 uppercase">Account</th>
                                        <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-300 uppercase">Created</th>
                                        <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-300 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {filteredUsers.map((item, index) => {
                                        const isOnline = computeIsOnline(item);
                                        return (
                                            <tr key={item._id} className="hover:bg-gray-700/50">
                                                <td className="px-2 sm:px-3 py-2 sm:py-3 text-gray-300">{index + 1}</td>
                                                <td className="px-2 sm:px-3 py-2 sm:py-3 font-medium">
                                                    <Link to={`/my-users/${item._id}`} className="text-yellow-400 hover:text-yellow-300 hover:underline truncate block max-w-[140px]">{item.username}</Link>
                                                </td>
                                                <td className="px-2 sm:px-3 py-2 sm:py-3 text-gray-300 truncate max-w-[160px]">{item.email || '—'}</td>
                                                <td className="px-2 sm:px-3 py-2 sm:py-3 text-gray-300">{item.phone || '—'}</td>
                                                <td className="px-2 sm:px-3 py-2 sm:py-3">
                                                    <span className="font-mono font-medium text-green-400 text-xs sm:text-sm">
                                                        ₹{Number(item.walletBalance ?? 0).toLocaleString('en-IN')}
                                                    </span>
                                                </td>
                                                <td className="px-2 sm:px-3 py-2 sm:py-3">
                                                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                                                        isOnline
                                                            ? 'bg-green-900/50 text-green-400 border border-green-700'
                                                            : 'bg-gray-700 text-gray-400 border border-gray-600'
                                                    }`}>
                                                        <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-500'}`} />
                                                        {isOnline ? 'Online' : 'Offline'}
                                                    </span>
                                                </td>
                                                <td className="px-2 sm:px-3 py-2 sm:py-3">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                        item.isActive !== false
                                                            ? 'bg-green-900/50 text-green-400 border border-green-700'
                                                            : 'bg-red-900/50 text-red-400 border border-red-700'
                                                    }`}>
                                                        {item.isActive !== false ? 'Active' : 'Suspended'}
                                                    </span>
                                                </td>
                                                <td className="px-2 sm:px-3 py-2 sm:py-3 text-gray-300 text-xs">
                                                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN', {
                                                        day: '2-digit',
                                                        month: 'short',
                                                        year: 'numeric',
                                                    }) : '—'}
                                                </td>
                                                <td className="px-2 sm:px-3 py-2 sm:py-3">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); navigate(`/games?playerId=${item._id}`); }}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-yellow-600/80 hover:bg-yellow-500 text-black text-xs font-semibold transition-colors"
                                                        title="Place bet for this player"
                                                    >
                                                        <FaGamepad className="w-3 h-3" /> Bet
                                                    </button>
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
