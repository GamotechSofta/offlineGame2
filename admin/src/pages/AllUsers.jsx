import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import { useNavigate } from 'react-router-dom';
import { FaUserSlash, FaUserCheck, FaUserPlus } from 'react-icons/fa';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

const computeIsOnline = (item) => {
    const lastActive = item?.lastActiveAt ? new Date(item.lastActiveAt).getTime() : 0;
    return lastActive > 0 && Date.now() - lastActive < ONLINE_THRESHOLD_MS;
};

const TABS = [
    { id: 'all', label: 'All Players', value: 'all' },
    { id: 'super_admins', label: 'All Super Admins', value: 'super_admins' },
    { id: 'all_bookies', label: 'All Bookies', value: 'all_bookies' },
    { id: 'bookie_users', label: 'All Bookies Players', value: 'bookie_users' },
    { id: 'super_admin_users', label: 'Super Admin Players', value: 'super_admin_users' },
];

const AllUsers = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('all');
    const [expandedBookieId, setExpandedBookieId] = useState(null);
    const [allUsers, setAllUsers] = useState([]);
    const [superAdminUsersList, setSuperAdminUsersList] = useState([]);
    const [bookieUsersList, setBookieUsersList] = useState([]);
    const [allBookies, setAllBookies] = useState([]);
    const [superAdminsList, setSuperAdminsList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [togglingId, setTogglingId] = useState(null);
    const [, setTick] = useState(0);

    const getAuthHeaders = () => {
        const admin = JSON.parse(localStorage.getItem('admin'));
        const password = sessionStorage.getItem('adminPassword') || '';
        return {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${btoa(`${admin.username}:${password}`)}`,
        };
    };

    const fetchData = async (showLoader = true) => {
        if (showLoader) setLoading(true);
        if (showLoader) setError('');
        try {
            const [allRes, superAdminRes, bookieRes, bookiesRes, adminsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/users`, { headers: getAuthHeaders() }),
                fetch(`${API_BASE_URL}/users?filter=super_admin`, { headers: getAuthHeaders() }),
                fetch(`${API_BASE_URL}/users?filter=bookie`, { headers: getAuthHeaders() }),
                fetch(`${API_BASE_URL}/admin/bookies`, { headers: getAuthHeaders() }),
                fetch(`${API_BASE_URL}/admin/super-admins`, { headers: getAuthHeaders() }),
            ]);
            const allData = await allRes.json();
            const superAdminData = await superAdminRes.json();
            const bookieData = await bookieRes.json();
            const bookiesData = await bookiesRes.json();
            const adminsData = await adminsRes.json();
            if (allData.success) setAllUsers(allData.data || []);
            if (superAdminData.success) setSuperAdminUsersList(superAdminData.data || []);
            if (bookieData.success) setBookieUsersList(bookieData.data || []);
            if (bookiesData.success) setAllBookies(bookiesData.data || []);
            if (adminsData.success) setSuperAdminsList(adminsData.data || []);
        } catch (err) {
            if (showLoader) setError('Failed to fetch data');
        } finally {
            if (showLoader) setLoading(false);
        }
    };

    useEffect(() => {
        const admin = localStorage.getItem('admin');
        if (!admin) {
            navigate('/');
            return;
        }
        fetchData(true);

        const refreshInterval = setInterval(() => fetchData(false), 15000);
        const tickInterval = setInterval(() => setTick((t) => t + 1), 5000);
        return () => {
            clearInterval(refreshInterval);
            clearInterval(tickInterval);
        };
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('admin');
        sessionStorage.removeItem('adminPassword');
        navigate('/');
    };

    const handleTogglePlayerStatus = async (userId) => {
        setTogglingId(userId);
        setError('');
        setSuccess('');
        try {
            const res = await fetch(`${API_BASE_URL}/users/${userId}/toggle-status`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
            });
            const data = await res.json();
            if (data.success) {
                setSuccess(`Player ${data.data.isActive ? 'unsuspended' : 'suspended'} successfully`);
                fetchData(false);
                setTimeout(() => setSuccess(''), 3000);
            } else {
                setError(data.message || 'Failed to update status');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setTogglingId(null);
        }
    };

    const handleToggleBookieStatus = async (bookieId) => {
        setTogglingId(bookieId);
        setError('');
        setSuccess('');
        try {
            const res = await fetch(`${API_BASE_URL}/admin/bookies/${bookieId}/toggle-status`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
            });
            const data = await res.json();
            if (data.success) {
                setSuccess(`Bookie ${data.data.status === 'active' ? 'unsuspended' : 'suspended'} successfully`);
                fetchData(false);
                setTimeout(() => setSuccess(''), 3000);
            } else {
                setError(data.message || 'Failed to update status');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setTogglingId(null);
        }
    };

    const getCurrentList = () => {
        if (activeTab === 'all') return allUsers;
        if (activeTab === 'super_admin_users') return superAdminUsersList;
        if (activeTab === 'bookie_users') return bookieUsersList;
        if (activeTab === 'all_bookies') return allBookies;
        if (activeTab === 'super_admins') return superAdminsList;
        return [];
    };

    const list = getCurrentList();
    const isUserList = ['all', 'super_admin_users', 'bookie_users'].includes(activeTab);

    const getUsersForBookie = (bookieId) => {
        return bookieUsersList.filter(
            (u) => u.referredBy && (u.referredBy._id === bookieId || u.referredBy === bookieId)
        );
    };

    return (
        <AdminLayout onLogout={handleLogout} title="All Players">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold">All Players</h1>
                <button
                    type="button"
                    onClick={() => navigate('/add-user')}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-yellow-500 hover:bg-yellow-500/90 text-black font-semibold transition-colors text-sm sm:text-base shrink-0"
                >
                    <FaUserPlus className="w-5 h-5" />
                    Add Player
                </button>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 rounded-lg font-semibold transition-colors text-sm sm:text-base ${
                            activeTab === tab.id
                                ? 'bg-yellow-500 text-black'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
                    {error}
                </div>
            )}
            {success && (
                <div className="mb-4 p-4 bg-green-900/50 border border-green-700 rounded-lg text-green-200">
                    {success}
                </div>
            )}

            {/* Table */}
            <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 min-w-0 max-w-full">
                {loading ? (
                    <div className="p-8 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto" />
                        <p className="mt-4 text-gray-400">Loading...</p>
                    </div>
                ) : list.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        No {TABS.find(t => t.id === activeTab)?.label?.toLowerCase()} found.
                    </div>
                ) : activeTab === 'all_bookies' ? (
                    <div>
                        {/* Header */}
                        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-700/40 border-b border-gray-600/80">
                            <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
                                <span className="font-semibold text-yellow-500">All Bookies</span>
                                <span className="hidden sm:inline"> — Bookie accounts who can add players via their link.</span>
                                <span className="block sm:inline mt-1 sm:mt-0 sm:ml-1">Click <span className="font-medium text-white">View Players</span> to see players under each bookie.</span>
                            </p>
                        </div>

                        {/* Desktop table */}
                        <div className="hidden md:block">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-700/80">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-10">#</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Username</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Email</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden lg:table-cell">Phone</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden lg:table-cell">Created</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700/60">
                                    {allBookies.map((bookie, index) => {
                                        const bookieUsers = getUsersForBookie(bookie._id);
                                        const isExpanded = expandedBookieId === bookie._id;
                                        return (
                                            <React.Fragment key={bookie._id}>
                                                <tr className="hover:bg-gray-700/30 transition-colors">
                                                    <td className="px-4 py-3 text-gray-400">{index + 1}</td>
                                                    <td className="px-4 py-3 font-medium text-white">{bookie.username}</td>
                                                    <td className="px-4 py-3 text-gray-300 truncate max-w-[140px] lg:max-w-[180px]">{bookie.email || '—'}</td>
                                                    <td className="px-4 py-3 text-gray-300 hidden lg:table-cell">{bookie.phone || '—'}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${
                                                            bookie.status === 'active'
                                                                ? 'bg-green-900/40 text-green-400 border border-green-700/50'
                                                                : 'bg-red-900/40 text-red-400 border border-red-700/50'
                                                        }`}>
                                                            {bookie.status === 'active' ? 'Active' : 'Suspended'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">
                                                        {bookie.createdAt ? new Date(bookie.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleToggleBookieStatus(bookie._id)}
                                                                disabled={togglingId === bookie._id}
                                                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${
                                                                    bookie.status === 'active'
                                                                        ? 'bg-red-600/80 hover:bg-red-600 text-white'
                                                                        : 'bg-green-600/80 hover:bg-green-600 text-white'
                                                                }`}
                                                            >
                                                                {togglingId === bookie._id ? '⏳' : bookie.status === 'active' ? <><FaUserSlash className="w-3.5 h-3.5" /> Suspend</> : <><FaUserCheck className="w-3.5 h-3.5" /> Unsuspend</>}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setExpandedBookieId(isExpanded ? null : bookie._id)}
                                                                className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-yellow-500/90 hover:bg-yellow-500 text-black transition-colors"
                                                            >
                                                                {isExpanded ? 'Hide Players' : 'View Players'}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr>
                                                        <td colSpan="7" className="px-0 py-0 bg-gray-900/30">
                                                            <div className="px-6 py-4 sm:py-5 border-l-4 border-yellow-500 ml-4 sm:ml-6">
                                                                <p className="text-yellow-500 font-semibold mb-3 text-sm">
                                                                    Players under <span className="text-white">{bookie.username}</span>
                                                                </p>
                                                                {bookieUsers.length === 0 ? (
                                                                    <p className="text-gray-500 text-sm py-2">No players yet.</p>
                                                                ) : (
                                                                    <div className="rounded-lg border border-gray-600/80 overflow-hidden bg-gray-800/50">
                                                                        <table className="w-full text-sm">
                                                                            <thead className="bg-gray-700/80">
                                                                                <tr>
                                                                                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase w-10">#</th>
                                                                                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase">Username</th>
                                                                                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase">Email</th>
                                                                                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase hidden lg:table-cell">Phone</th>
                                                                                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                                                                                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase">Wallet</th>
                                                                                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase hidden sm:table-cell">Account</th>
                                                                                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase hidden lg:table-cell">Created</th>
                                                                                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase">Action</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-gray-700/60">
                                                                                {bookieUsers.map((u, i) => (
                                                                                    <tr key={u._id} className="hover:bg-gray-700/20 transition-colors">
                                                                                        <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                                                                                        <td className="px-4 py-2.5 font-medium text-white">{u.username}</td>
                                                                                        <td className="px-4 py-2.5 text-gray-300 truncate max-w-[120px] lg:max-w-[160px]">{u.email || '—'}</td>
                                                                                        <td className="px-4 py-2.5 text-gray-300 hidden lg:table-cell">{u.phone || '—'}</td>
                                                                                        <td className="px-4 py-2.5">
                                                                                            {(() => {
                                                                                                const isOnline = computeIsOnline(u);
                                                                                                return (
                                                                                                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs ${isOnline ? 'text-green-400' : 'text-gray-500'}`}>
                                                                                                        <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-500'}`} />
                                                                                                        {isOnline ? 'Online' : 'Offline'}
                                                                                                    </span>
                                                                                                );
                                                                                            })()}
                                                                                        </td>
                                                                                        <td className="px-4 py-2.5 text-green-400 font-mono text-xs">₹{Number(u.walletBalance ?? 0).toLocaleString('en-IN')}</td>
                                                                                        <td className="px-4 py-2.5 hidden sm:table-cell">
                                                                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.isActive !== false ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
                                                                                                {u.isActive !== false ? 'Active' : 'Suspended'}
                                                                                            </span>
                                                                                        </td>
                                                                                        <td className="px-4 py-2.5 text-gray-400 text-xs hidden lg:table-cell">
                                                                                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                                                                        </td>
                                                                                        <td className="px-4 py-2.5">
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => handleTogglePlayerStatus(u._id)}
                                                                                                disabled={togglingId === u._id}
                                                                                                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                                                                                                    u.isActive !== false ? 'bg-red-600/80 hover:bg-red-600 text-white' : 'bg-green-600/80 hover:bg-green-600 text-white'
                                                                                                }`}
                                                                                            >
                                                                                                {togglingId === u._id ? '⏳' : u.isActive !== false ? <><FaUserSlash className="w-3 h-3" /> Suspend</> : <><FaUserCheck className="w-3 h-3" /> Unsuspend</>}
                                                                                            </button>
                                                                                        </td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile cards */}
                        <div className="md:hidden divide-y divide-gray-700/60">
                            {allBookies.map((bookie, index) => {
                                const bookieUsers = getUsersForBookie(bookie._id);
                                const isExpanded = expandedBookieId === bookie._id;
                                return (
                                    <div key={bookie._id} className="p-4 hover:bg-gray-700/20 transition-colors">
                                        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="text-gray-400 text-sm shrink-0">{index + 1}.</span>
                                                <span className="font-semibold text-white truncate">{bookie.username}</span>
                                                <span className={`shrink-0 px-2 py-0.5 rounded-md text-xs font-medium ${
                                                    bookie.status === 'active'
                                                        ? 'bg-green-900/40 text-green-400 border border-green-700/50'
                                                        : 'bg-red-900/40 text-red-400 border border-red-700/50'
                                                }`}>
                                                    {bookie.status === 'active' ? 'Active' : 'Suspended'}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-2 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleBookieStatus(bookie._id)}
                                                    disabled={togglingId === bookie._id}
                                                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 ${
                                                        bookie.status === 'active'
                                                            ? 'bg-red-600 hover:bg-red-500 text-white'
                                                            : 'bg-green-600 hover:bg-green-500 text-white'
                                                    }`}
                                                >
                                                    {togglingId === bookie._id ? '⏳' : bookie.status === 'active' ? <><FaUserSlash className="w-3.5 h-3.5" /> Suspend</> : <><FaUserCheck className="w-3.5 h-3.5" /> Unsuspend</>}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedBookieId(isExpanded ? null : bookie._id)}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-yellow-500/90 hover:bg-yellow-500 text-black"
                                                >
                                                    {isExpanded ? 'Hide' : 'View'} Players
                                                </button>
                                            </div>
                                        </div>
                                        <div className="text-xs text-gray-400 space-y-0.5">
                                            {bookie.email && <p className="truncate">📧 {bookie.email}</p>}
                                            {bookie.phone && <p>📱 {bookie.phone}</p>}
                                            <p>{bookie.createdAt ? new Date(bookie.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</p>
                                        </div>
                                        {isExpanded && (
                                            <div className="mt-4 pl-3 border-l-2 border-yellow-500/70 space-y-3">
                                                <p className="text-yellow-500/90 font-medium text-sm">Players ({bookieUsers.length})</p>
                                                {bookieUsers.length === 0 ? (
                                                    <p className="text-gray-500 text-xs">No players yet.</p>
                                                ) : (
                                                    bookieUsers.map((u, i) => (
                                                        <div key={u._id} className="p-3 rounded-lg bg-gray-800/80 border border-gray-600/50">
                                                            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                                                                <span className="font-medium text-white text-sm">{u.username}</span>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${computeIsOnline(u) ? 'text-green-400' : 'text-gray-500'}`}>
                                                                        <span className={`w-1.5 h-1.5 rounded-full ${computeIsOnline(u) ? 'bg-green-500' : 'bg-gray-500'}`} />
                                                                        {computeIsOnline(u) ? 'Online' : 'Offline'}
                                                                    </span>
                                                                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${u.isActive !== false ? 'text-green-400 bg-green-900/30' : 'text-red-400 bg-red-900/30'}`}>
                                                                        {u.isActive !== false ? 'Active' : 'Suspended'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <p className="text-gray-400 text-xs truncate mb-2">{u.email || '—'}</p>
                                                            <div className="flex items-center justify-between text-xs">
                                                                <span className="text-green-400 font-mono">₹{Number(u.walletBalance ?? 0).toLocaleString('en-IN')}</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleTogglePlayerStatus(u._id)}
                                                                    disabled={togglingId === u._id}
                                                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold disabled:opacity-50 ${
                                                                        u.isActive !== false ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
                                                                    }`}
                                                                >
                                                                    {togglingId === u._id ? '⏳' : u.isActive !== false ? <><FaUserSlash className="w-3 h-3" /> Suspend</> : <><FaUserCheck className="w-3 h-3" /> Unsuspend</>}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div>
                        {(activeTab === 'bookie_users' || activeTab === 'super_admin_users') && (
                            <div className="px-4 py-3 bg-gray-700/50 border-b border-gray-600 text-sm text-gray-300">
                                {activeTab === 'bookie_users' ? (
                                    <><strong className="text-yellow-500">All Bookies Players</strong> – Players who signed up via a bookie&apos;s link.</>
                                ) : (
                                    <><strong className="text-yellow-500">Super Admin Players</strong> – Players who signed up directly or were created by super admin.</>
                                )}
                            </div>
                        )}
                        <div>
                        <table className="w-full text-sm sm:text-base table-fixed md:table-auto">
                            <thead className="bg-gray-700">
                                <tr>
                                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-300 uppercase w-8">#</th>
                                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-300 uppercase min-w-0 truncate">Username</th>
                                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-300 uppercase hidden sm:table-cell">Email</th>
                                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-300 uppercase hidden lg:table-cell">Phone</th>
                                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-300 uppercase hidden md:table-cell">Role</th>
                                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-300 uppercase hidden md:table-cell">Wallet</th>
                                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-300 uppercase">Status</th>
                                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-300 uppercase hidden sm:table-cell">Account</th>
                                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-300 uppercase hidden lg:table-cell">Created</th>
                                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-300 uppercase w-20 sm:w-24">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {list.map((item, index) => (
                                    <tr key={item._id} className="hover:bg-gray-700/50">
                                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-gray-300">{index + 1}</td>
                                        <td className="px-2 sm:px-4 py-2 sm:py-3 font-medium text-white truncate max-w-[70px] sm:max-w-none">{item.username}</td>
                                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-gray-300 hidden sm:table-cell truncate max-w-[90px] lg:max-w-none">{item.email || '—'}</td>
                                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-gray-300 hidden lg:table-cell">{item.phone || '—'}</td>
                                        <td className="px-4 sm:px-6 py-3">
                                            {(activeTab === 'super_admins') ? (
                                                <span className="px-2 py-1 rounded text-xs font-medium bg-gray-600 text-gray-200">Super Admin</span>
                                            ) : (
                                                <span className="px-2 py-1 rounded text-xs font-medium bg-gray-600 text-gray-200 capitalize">
                                                    {item.role === 'user' ? 'Player' : (item.role || 'Player')}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-2 sm:px-4 py-2 sm:py-3 hidden md:table-cell">
                                            {(activeTab === 'super_admins') ? (
                                                <span className="text-gray-400">—</span>
                                            ) : (
                                                <span className="font-mono font-medium text-green-400 text-xs sm:text-sm">
                                                    ₹{Number(item.walletBalance ?? 0).toLocaleString('en-IN')}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 sm:px-6 py-3">
                                            {(activeTab === 'super_admins') ? (
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                    item.status === 'active' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                                                }`}>
                                                    {item.status || '—'}
                                                </span>
                                            ) : (
                                                (() => {
                                                    const isOnline = computeIsOnline(item);
                                                    return (
                                                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                                                            isOnline
                                                                ? 'bg-green-900/50 text-green-400 border border-green-700'
                                                                : 'bg-gray-700 text-gray-400 border border-gray-600'
                                                        }`}>
                                                            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-500'}`} />
                                                            {isOnline ? 'Online' : 'Offline'}
                                                        </span>
                                                    );
                                                })()
                                            )}
                                        </td>
                                        <td className="px-2 sm:px-4 py-2 sm:py-3 hidden sm:table-cell">
                                            {(activeTab === 'super_admins') ? (
                                                <span className="text-gray-400">—</span>
                                            ) : (
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                    item.isActive !== false
                                                        ? 'bg-green-900/50 text-green-400 border border-green-700'
                                                        : 'bg-red-900/50 text-red-400 border border-red-700'
                                                }`}>
                                                    {item.isActive !== false ? 'Active' : 'Suspended'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-gray-300 hidden lg:table-cell text-xs">
                                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN', {
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric',
                                            }) : '—'}
                                        </td>
                                        <td className="px-2 sm:px-4 py-2 sm:py-3">
                                            {(activeTab === 'super_admins') ? (
                                                <span className="text-gray-400">—</span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => handleTogglePlayerStatus(item._id)}
                                                    disabled={togglingId === item._id}
                                                    className={`inline-flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-1 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${
                                                        item.isActive !== false
                                                            ? 'bg-red-600 hover:bg-red-500 text-white'
                                                            : 'bg-green-600 hover:bg-green-500 text-white'
                                                    }`}
                                                    title={item.isActive !== false ? 'Suspend' : 'Unsuspend'}
                                                >
                                                    {togglingId === item._id ? (
                                                        <span className="animate-spin">⏳</span>
                                                    ) : item.isActive !== false ? (
                                                        <>
                                                            <FaUserSlash className="w-3 h-3 shrink-0" />
                                                            Suspend
                                                        </>
                                                    ) : (
                                                        <>
                                                            <FaUserCheck className="w-3 h-3 shrink-0" />
                                                            Unsuspend
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>
                    </div>
                )}
            </div>

            {!loading && list.length > 0 && (
                <p className="mt-4 text-gray-400 text-sm">
                    Showing {list.length} {TABS.find(t => t.id === activeTab)?.label?.toLowerCase()}
                </p>
            )}
        </AdminLayout>
    );
};

export default AllUsers;
