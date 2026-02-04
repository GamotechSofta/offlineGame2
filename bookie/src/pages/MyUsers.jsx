import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { API_BASE_URL, getBookieAuthHeaders } from '../utils/api';
import { FaUser, FaEnvelope, FaPhone, FaCheckCircle, FaTimesCircle, FaSearch } from 'react-icons/fa';

const MyUsers = () => {
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [walletByUserId, setWalletByUserId] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        // Filter players by Sr No or player name (username)
        const term = searchTerm.trim();
        if (term === '') {
            setFilteredUsers(users);
            return;
        }

        const lower = term.toLowerCase();
        const numeric = Number(term);
        const isNumeric = Number.isFinite(numeric) && term !== '';

        const idToSrNo = new Map(users.map((u, idx) => [u?._id, idx + 1]));

        const filtered = users.filter((u) => {
            const name = (u?.username || '').toLowerCase();
            const nameMatch = name.includes(lower);
            if (nameMatch) return true;

            if (!isNumeric) return false;
            const srNo = idToSrNo.get(u?._id) || 0;
            return String(srNo) === term;
        });

        setFilteredUsers(filtered);
    }, [searchTerm, users]);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const headers = getBookieAuthHeaders();
            console.log('Fetching users with headers:', headers);
            
            const response = await fetch(`${API_BASE_URL}/users`, {
                headers: headers,
            });
            
            console.log('Response status:', response.status);
            const data = await response.json();
            console.log('Response data:', data);
            
            if (data.success) {
                setUsers(data.data);
                setFilteredUsers(data.data);
                console.log('Users loaded:', data.data.length);
                // Fetch wallet balances (optional enrichment for table)
                fetchWalletBalances();
            } else {
                setError(data.message || 'Failed to fetch users');
                console.error('API Error:', data.message);
            }
        } catch (err) {
            setError('Network error. Please check if the server is running.');
            console.error('Network error:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchWalletBalances = async () => {
        try {
            const headers = getBookieAuthHeaders();
            const res = await fetch(`${API_BASE_URL}/wallet/all`, { headers });
            const data = await res.json();
            if (!data?.success || !Array.isArray(data?.data)) return;

            const map = {};
            for (const w of data.data) {
                const id = w?.userId?._id || w?.userId;
                if (!id) continue;
                map[id] = w?.balance;
            }
            setWalletByUserId(map);
        } catch (e) {
            // Non-blocking; table will show '-' if unavailable
            setWalletByUserId({});
        }
    };

    return (
        <Layout title="My Players">
                <div className="mb-4 sm:mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold mb-1">My Players</h1>
                    <p className="text-gray-400 text-sm">Players who registered through your referral link or were created by you</p>
                </div>

                <div className="mb-4 sm:mb-6">
                    <div className="relative max-w-md">
                        <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by Sr No or player name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-6">
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700/50">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-400 text-sm">Total Players</p>
                                <p className="text-2xl font-bold text-white mt-1">{users.length}</p>
                            </div>
                            <div className="bg-yellow-500/20 p-3 rounded-lg">
                                <FaUser className="text-yellow-500 text-2xl" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700/50">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-400 text-sm">Active Players</p>
                                <p className="text-2xl font-bold text-white mt-1">
                                    {users.filter(u => u.isActive).length}
                                </p>
                            </div>
                            <div className="bg-green-500/20 p-3 rounded-lg">
                                <FaCheckCircle className="text-green-500 text-2xl" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700/50">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-400 text-sm">Inactive Players</p>
                                <p className="text-2xl font-bold text-white mt-1">
                                    {users.filter(u => !u.isActive).length}
                                </p>
                            </div>
                            <div className="bg-red-500/20 p-3 rounded-lg">
                                <FaTimesCircle className="text-red-500 text-2xl" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
                        {error}
                    </div>
                )}

                {/* Players Table */}
                <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700/50">
                    {loading ? (
                        <div className="p-8 text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto"></div>
                            <p className="mt-4 text-gray-400">Loading players...</p>
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">
                            {searchTerm ? (
                                <>
                                    <p>No players found matching "{searchTerm}"</p>
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="mt-4 text-yellow-500 hover:text-yellow-400"
                                    >
                                        Clear search
                                    </button>
                                </>
                            ) : (
                                <>
                                    <p>No players found.</p>
                                    <p className="mt-2">Players who register through your referral link will appear here.</p>
                                </>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full table-fixed">
                                    <thead className="bg-gray-700">
                                        <tr>
                                            <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-300 uppercase tracking-wider w-12">
                                                Sr No
                                            </th>
                                            <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-300 uppercase tracking-wider w-36">
                                                Players
                                            </th>
                                            <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-300 uppercase tracking-wider w-52">
                                                Email
                                            </th>
                                            <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-300 uppercase tracking-wider w-36">
                                                Phone
                                            </th>
                                            <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-300 uppercase tracking-wider w-24">
                                                Role
                                            </th>
                                            <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-300 uppercase tracking-wider w-28">
                                                Status
                                            </th>
                                            <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-300 uppercase tracking-wider w-32">
                                                Joined
                                            </th>
                                            <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-300 uppercase tracking-wider w-28">
                                                Wallet Balance
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        {filteredUsers.map((user) => (
                                            <tr key={user._id} className="hover:bg-gray-700/50">
                                                <td className="px-3 py-2 text-gray-300 text-sm">
                                                    {users.findIndex((u) => u?._id === user?._id) + 1}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="flex items-center gap-2">
                                                        <FaUser className="text-gray-500" />
                                                        <span className="font-medium text-white truncate">{user.username}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="flex items-center gap-2 text-gray-300">
                                                        <FaEnvelope className="text-gray-500" size={14} />
                                                        <span className="truncate">{user.email}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 text-gray-300">
                                                    {user.phone ? (
                                                        <div className="flex items-center gap-2">
                                                            <FaPhone className="text-gray-500" size={14} />
                                                            <span className="truncate">{user.phone}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-500">-</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-900/50 text-blue-400 border border-blue-700">
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2">
                                                    {user.isActive ? (
                                                        <span className="flex items-center gap-2 text-green-400">
                                                            <FaCheckCircle />
                                                            <span className="text-sm font-medium">Active</span>
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-2 text-red-400">
                                                            <FaTimesCircle />
                                                            <span className="text-sm font-medium">Inactive</span>
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-gray-300">
                                                    <div className="text-sm">
                                                        {new Date(user.createdAt).toLocaleDateString('en-IN', {
                                                            day: '2-digit',
                                                            month: 'short',
                                                            year: 'numeric',
                                                        })}
                                                    </div>
                                                    <div className="text-[11px] text-gray-400">
                                                        {new Date(user.createdAt).toLocaleTimeString('en-IN', {
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 text-yellow-400 font-semibold">
                                                    {walletByUserId?.[user._id] !== undefined && walletByUserId?.[user._id] !== null
                                                        ? `₹${walletByUserId[user._id]}`
                                                        : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            
                            {/* Results count */}
                            <div className="px-3 py-2 bg-gray-800/80 border-t border-gray-700/50">
                                <p className="text-xs text-gray-400">
                                    Showing {filteredUsers.length} of {users.length} players
                                </p>
                            </div>
                        </>
                    )}
                </div>

                {/* Info Card */}
                <div className="mt-6 bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700/50">
                    <h3 className="text-lg font-semibold text-yellow-500 mb-3">About My Players</h3>
                    <div className="text-gray-300 space-y-2">
                        <p>• This list shows only the players who are linked to your bookie account.</p>
                        <p>• Players created by you or registered through your referral link will appear here.</p>
                        <p>• You can see their activity in Bet History, Reports, and Wallet sections.</p>
                        <p>• Other bookies cannot see these players in their panel.</p>
                    </div>
                </div>
        </Layout>
    );
};

export default MyUsers;
