import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { API_BASE_URL, getBookieAuthHeaders } from '../utils/api';
import { FaUser, FaEnvelope, FaPhone, FaCheckCircle, FaTimesCircle, FaSearch } from 'react-icons/fa';

const MyUsers = () => {
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        // Filter users based on search term
        if (searchTerm.trim() === '') {
            setFilteredUsers(users);
        } else {
            const filtered = users.filter(user =>
                user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (user.phone && user.phone.includes(searchTerm))
            );
            setFilteredUsers(filtered);
        }
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

    return (
        <Layout title="My Users">
            <div className="p-8">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold mb-2">My Users</h1>
                    <p className="text-gray-400">Users who registered through your referral link or were created by you</p>
                </div>

                {/* Search Bar */}
                <div className="mb-6">
                    <div className="relative max-w-md">
                        <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by username, email, or phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-400 text-sm">Total Users</p>
                                <p className="text-3xl font-bold text-white mt-1">{users.length}</p>
                            </div>
                            <div className="bg-emerald-500/20 p-3 rounded-lg">
                                <FaUser className="text-emerald-500 text-2xl" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-400 text-sm">Active Users</p>
                                <p className="text-3xl font-bold text-white mt-1">
                                    {users.filter(u => u.isActive).length}
                                </p>
                            </div>
                            <div className="bg-green-500/20 p-3 rounded-lg">
                                <FaCheckCircle className="text-green-500 text-2xl" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-400 text-sm">Inactive Users</p>
                                <p className="text-3xl font-bold text-white mt-1">
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

                {/* Users Table */}
                <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
                    {loading ? (
                        <div className="p-8 text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto"></div>
                            <p className="mt-4 text-gray-400">Loading users...</p>
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">
                            {searchTerm ? (
                                <>
                                    <p>No users found matching "{searchTerm}"</p>
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="mt-4 text-emerald-500 hover:text-emerald-400"
                                    >
                                        Clear search
                                    </button>
                                </>
                            ) : (
                                <>
                                    <p>No users found.</p>
                                    <p className="mt-2">Users who register through your referral link will appear here.</p>
                                </>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-700">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                                #
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                                Username
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                                Email
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                                Phone
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                                Role
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                                Status
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                                Joined Date
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        {filteredUsers.map((user, index) => (
                                            <tr key={user._id} className="hover:bg-gray-750">
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                                                    {index + 1}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <FaUser className="text-gray-500" />
                                                        <span className="font-medium text-white">{user.username}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2 text-gray-300">
                                                        <FaEnvelope className="text-gray-500" size={14} />
                                                        <span>{user.email}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                                                    {user.phone ? (
                                                        <div className="flex items-center gap-2">
                                                            <FaPhone className="text-gray-500" size={14} />
                                                            <span>{user.phone}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-500">-</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-900/50 text-blue-400 border border-blue-700">
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
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
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                                                    {new Date(user.createdAt).toLocaleDateString('en-IN', {
                                                        day: '2-digit',
                                                        month: 'short',
                                                        year: 'numeric',
                                                    })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            
                            {/* Results count */}
                            <div className="px-6 py-4 bg-gray-750 border-t border-gray-700">
                                <p className="text-sm text-gray-400">
                                    Showing {filteredUsers.length} of {users.length} users
                                </p>
                            </div>
                        </>
                    )}
                </div>

                {/* Info Card */}
                <div className="mt-6 bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-emerald-500 mb-3">About My Users</h3>
                    <div className="text-gray-300 space-y-2">
                        <p>• This list shows only the users who are linked to your bookie account.</p>
                        <p>• Users created by you or registered through your referral link will appear here.</p>
                        <p>• You can see their activity in Bet History, Reports, and Wallet sections.</p>
                        <p>• Other bookies cannot see these users in their panel.</p>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default MyUsers;
