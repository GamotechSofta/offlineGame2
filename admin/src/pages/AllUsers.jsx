import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import { useNavigate, Link } from 'react-router-dom';
import { FaUserSlash, FaUserCheck, FaUserPlus, FaSearch } from 'react-icons/fa';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import useModalBackHandler from '../hooks/useModalBackHandler';
import { dedupeRequest } from '../lib/requestDedupe';
import { useTraceRender } from '../lib/runtimeTrace';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';
import { getAuthHeaders, clearAdminSession, fetchWithAuth } from '../lib/auth';
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

const computeIsOnline = (item, nowMs) => {
    const lastActive = item?.lastActiveAt ? new Date(item.lastActiveAt).getTime() : 0;
    return lastActive > 0 && nowMs - lastActive < ONLINE_THRESHOLD_MS;
};

const TABS = [
    { id: 'all', label: 'All Players', value: 'all' },
    { id: 'super_admins', label: 'All Super Admins', value: 'super_admins' },
    { id: 'all_bookies', label: 'All Bookies', value: 'all_bookies' },
    { id: 'bookie_users', label: 'All Bookies Players', value: 'bookie_users' },
    { id: 'super_admin_users', label: 'Super Admin Players', value: 'super_admin_users' },
];
const USERS_PAGE_LIMIT = 100;

const toggleUserInCache = (previous, userId) => {
    if (!previous) return previous;
    const flipUser = (user) => {
        if (!user || user._id !== userId) return user;
        const nextIsActive = !Boolean(user.isActive);
        return {
            ...user,
            isActive: nextIsActive,
            status: nextIsActive ? 'active' : 'inactive',
        };
    };
    return {
        ...previous,
        allUsers: (previous.allUsers || []).map(flipUser),
        superAdminUsersList: (previous.superAdminUsersList || []).map(flipUser),
        bookieUsersList: (previous.bookieUsersList || []).map(flipUser),
    };
};

const toggleBookieInCache = (previous, bookieId) => {
    if (!previous) return previous;
    const flipBookie = (bookie) => {
        if (!bookie || bookie._id !== bookieId) return bookie;
        const nextStatus = bookie.status === 'active' ? 'suspended' : 'active';
        return {
            ...bookie,
            status: nextStatus,
            isActive: nextStatus === 'active',
        };
    };
    return {
        ...previous,
        allBookies: (previous.allBookies || []).map(flipBookie),
    };
};

const AllUsers = () => {
    useTraceRender('AllUsers');
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('all');
    /** Server pagination for GET /users (100 per page, separate page per tab). */
    const [playerListPages, setPlayerListPages] = useState({
        all: 1,
        super_admin_users: 1,
        bookie_users: 1,
    });
    const [paginationByTab, setPaginationByTab] = useState({
        all: null,
        super_admin_users: null,
        bookie_users: null,
    });
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
    const [searchQuery, setSearchQuery] = useState('');
    /** Debounced value sent to GET /users as `search` (server searches all players, not only current page). */
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [now, setNow] = useState(Date.now());
    const [hasSecretDeclarePassword, setHasSecretDeclarePassword] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [secretPassword, setSecretPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [pendingAction, setPendingAction] = useState(null);
    const queryClient = useQueryClient();
    const closePasswordModal = useModalBackHandler(showPasswordModal, () => {
        setShowPasswordModal(false);
        setPendingAction(null);
        setSecretPassword('');
        setPasswordError('');
    });

    const fetchData = async ({ queryKey }) => {
        const [, pAll, pSuper, pBookie, searchStr] = queryKey;
        const searchParam =
            searchStr && String(searchStr).trim()
                ? `&search=${encodeURIComponent(String(searchStr).trim())}`
                : '';
        const dedupeKey = `all-users:data:${pAll}:${pSuper}:${pBookie}:${searchStr || ''}`;
        return dedupeRequest(dedupeKey, async () => {
            const [allRes, superAdminRes, bookieRes, bookiesRes, adminsRes] = await Promise.all([
                fetchWithAuth(`${API_BASE_URL}/users?page=${pAll}&limit=${USERS_PAGE_LIMIT}${searchParam}`),
                fetchWithAuth(`${API_BASE_URL}/users?filter=super_admin&page=${pSuper}&limit=${USERS_PAGE_LIMIT}${searchParam}`),
                fetchWithAuth(`${API_BASE_URL}/users?filter=bookie&page=${pBookie}&limit=${USERS_PAGE_LIMIT}${searchParam}`),
                fetchWithAuth(`${API_BASE_URL}/admin/bookies`),
                fetchWithAuth(`${API_BASE_URL}/admin/super-admins`),
            ]);
            if (allRes.status === 401 || superAdminRes.status === 401 || bookieRes.status === 401 || bookiesRes.status === 401 || adminsRes.status === 401) {
                return {
                    allUsers: [],
                    superAdminUsersList: [],
                    bookieUsersList: [],
                    allBookies: [],
                    superAdminsList: [],
                    paginationAll: null,
                    paginationSuperAdmin: null,
                    paginationBookie: null,
                };
            }
            const allData = await allRes.json();
            const superAdminData = await superAdminRes.json();
            const bookieData = await bookieRes.json();
            const bookiesData = await bookiesRes.json();
            const adminsData = await adminsRes.json();
            return {
                allUsers: allData.success ? (allData.data || []) : [],
                superAdminUsersList: superAdminData.success ? (superAdminData.data || []) : [],
                bookieUsersList: bookieData.success ? (bookieData.data || []) : [],
                allBookies: bookiesData.success ? (bookiesData.data || []) : [],
                superAdminsList: adminsData.success ? (adminsData.data || []) : [],
                paginationAll: allData.success ? allData.pagination : null,
                paginationSuperAdmin: superAdminData.success ? superAdminData.pagination : null,
                paginationBookie: bookieData.success ? bookieData.pagination : null,
            };
        });
    };

    useEffect(() => {
        const admin = localStorage.getItem('admin');
        if (!admin) {
            navigate('/');
            return;
        }
        setLoading(true);
        fetchWithAuth(`${API_BASE_URL}/admin/me/secret-declare-password-status`)
            .then((res) => { if (res.status === 401) return; return res.json(); })
            .then((json) => {
                if (json && json.success) setHasSecretDeclarePassword(json.hasSecretDeclarePassword || false);
            })
            .catch(() => setHasSecretDeclarePassword(false));

    }, [navigate]);

    useEffect(() => {
        const id = window.setTimeout(() => {
            const next = searchQuery.trim();
            setDebouncedSearch((prev) => {
                if (prev === next) return prev;
                setPlayerListPages({ all: 1, super_admin_users: 1, bookie_users: 1 });
                return next;
            });
        }, 400);
        return () => window.clearTimeout(id);
    }, [searchQuery]);

    const usersQuery = useQuery({
        queryKey: ['all-users-data', playerListPages.all, playerListPages.super_admin_users, playerListPages.bookie_users, debouncedSearch],
        queryFn: fetchData,
        enabled: !!localStorage.getItem('admin'),
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchInterval: false,
        staleTime: Infinity,
    });

    useEffect(() => {
        if (!usersQuery.data) return;
        setAllUsers(usersQuery.data.allUsers || []);
        setSuperAdminUsersList(usersQuery.data.superAdminUsersList || []);
        setBookieUsersList(usersQuery.data.bookieUsersList || []);
        setAllBookies(usersQuery.data.allBookies || []);
        setSuperAdminsList(usersQuery.data.superAdminsList || []);
        setPaginationByTab({
            all: usersQuery.data.paginationAll ?? null,
            super_admin_users: usersQuery.data.paginationSuperAdmin ?? null,
            bookie_users: usersQuery.data.paginationBookie ?? null,
        });
        setError('');
    }, [usersQuery.data]);

    useEffect(() => {
        setLoading(usersQuery.isLoading || usersQuery.isFetching);
        if (usersQuery.error) {
            setError(usersQuery.error?.message || 'Failed to fetch data');
        }
    }, [usersQuery.isLoading, usersQuery.isFetching, usersQuery.error]);

    const handleLogout = () => {
        clearAdminSession();
        navigate('/');
    };

    const togglePlayerMutation = useMutation({
        mutationFn: async ({ userId, secretDeclarePasswordValue }) => {
            const opts = { method: 'PATCH' };
            if (secretDeclarePasswordValue) opts.body = JSON.stringify({ secretDeclarePassword: secretDeclarePasswordValue });
            const res = await fetchWithAuth(`${API_BASE_URL}/users/${userId}/toggle-status`, opts);
            if (res.status === 401) return { success: false, unauthorized: true };
            return res.json();
        },
        onMutate: async ({ userId }) => {
            setTogglingId(userId);
            setError('');
            setSuccess('');
            setPasswordError('');
            await queryClient.cancelQueries({ queryKey: ['all-users-data'] });
            const previous = queryClient.getQueryData(['all-users-data']);
            queryClient.setQueryData(['all-users-data'], (old) => toggleUserInCache(old, userId));
            return { previous };
        },
        onError: (_err, _vars, context) => {
            if (context?.previous) queryClient.setQueryData(['all-users-data'], context.previous);
            setError('Network error. Please try again.');
        },
        onSuccess: async (data, vars, context) => {
            if (!data?.success) {
                if (context?.previous) queryClient.setQueryData(['all-users-data'], context.previous);
                if (data?.code === 'INVALID_SECRET_DECLARE_PASSWORD') setPasswordError(data.message || 'Invalid secret password');
                else if (!data?.unauthorized) setError(data?.message || 'Failed to update status');
                return;
            }
            setShowPasswordModal(false);
            setPendingAction(null);
            setSecretPassword('');
            setSuccess(`Player ${data.data.isActive ? 'unsuspended' : 'suspended'} successfully`);
            setTimeout(() => setSuccess(''), 3000);
            await queryClient.invalidateQueries({ queryKey: ['all-users-data'] });
        },
        onSettled: () => {
            setTogglingId(null);
        },
    });

    const toggleBookieMutation = useMutation({
        mutationFn: async ({ bookieId, secretDeclarePasswordValue }) => {
            const opts = { method: 'PATCH' };
            if (secretDeclarePasswordValue) opts.body = JSON.stringify({ secretDeclarePassword: secretDeclarePasswordValue });
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/bookies/${bookieId}/toggle-status`, opts);
            if (res.status === 401) return { success: false, unauthorized: true };
            return res.json();
        },
        onMutate: async ({ bookieId }) => {
            setTogglingId(bookieId);
            setError('');
            setSuccess('');
            setPasswordError('');
            await queryClient.cancelQueries({ queryKey: ['all-users-data'] });
            const previous = queryClient.getQueryData(['all-users-data']);
            queryClient.setQueryData(['all-users-data'], (old) => toggleBookieInCache(old, bookieId));
            return { previous };
        },
        onError: (_err, _vars, context) => {
            if (context?.previous) queryClient.setQueryData(['all-users-data'], context.previous);
            setError('Network error. Please try again.');
        },
        onSuccess: async (data, _vars, context) => {
            if (!data?.success) {
                if (context?.previous) queryClient.setQueryData(['all-users-data'], context.previous);
                if (data?.code === 'INVALID_SECRET_DECLARE_PASSWORD') setPasswordError(data.message || 'Invalid secret password');
                else if (!data?.unauthorized) setError(data?.message || 'Failed to update status');
                return;
            }
            setShowPasswordModal(false);
            setPendingAction(null);
            setSecretPassword('');
            setSuccess(`Bookie ${data.data.status === 'active' ? 'unsuspended' : 'suspended'} successfully`);
            setTimeout(() => setSuccess(''), 3000);
            await queryClient.invalidateQueries({ queryKey: ['all-users-data'] });
        },
        onSettled: () => {
            setTogglingId(null);
        },
    });

    const performTogglePlayerStatus = async (userId, secretDeclarePasswordValue) => {
        await togglePlayerMutation.mutateAsync({ userId, secretDeclarePasswordValue });
    };

    const performToggleBookieStatus = async (bookieId, secretDeclarePasswordValue) => {
        await toggleBookieMutation.mutateAsync({ bookieId, secretDeclarePasswordValue });
    };

    const handleTogglePlayerStatus = (userId) => {
        if (hasSecretDeclarePassword) {
            setPendingAction({ type: 'player', id: userId });
            setShowPasswordModal(true);
            setSecretPassword('');
            setPasswordError('');
        } else {
            performTogglePlayerStatus(userId, '');
        }
    };

    const handleToggleBookieStatus = (bookieId) => {
        if (hasSecretDeclarePassword) {
            setPendingAction({ type: 'bookie', id: bookieId });
            setShowPasswordModal(true);
            setSecretPassword('');
            setPasswordError('');
        } else {
            performToggleBookieStatus(bookieId, '');
        }
    };

    const handlePasswordSubmit = (e) => {
        e.preventDefault();
        const val = secretPassword.trim();
        if (hasSecretDeclarePassword && !val) {
            setPasswordError('Please enter the secret declare password');
            return;
        }
        if (pendingAction?.type === 'player') performTogglePlayerStatus(pendingAction.id, val);
        else if (pendingAction?.type === 'bookie') performToggleBookieStatus(pendingAction.id, val);
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

    const paginationForActiveUserTab =
        activeTab === 'all'
            ? paginationByTab.all
            : activeTab === 'super_admin_users'
              ? paginationByTab.super_admin_users
              : activeTab === 'bookie_users'
                ? paginationByTab.bookie_users
                : null;
    const rowOffset =
        isUserList && paginationForActiveUserTab
            ? (paginationForActiveUserTab.page - 1) * (paginationForActiveUserTab.limit || USERS_PAGE_LIMIT)
            : 0;

    const q = searchQuery.trim().toLowerCase();
    const filteredList = isUserList
        ? list
        : q
          ? list.filter((item) => {
                const username = (item.username || '').toLowerCase();
                const phone = (item.phone || '').toString();
                return username.includes(q) || phone.includes(q);
            })
          : list;

    const getUsersForBookie = (bookieId) => {
        return bookieUsersList.filter(
            (u) => u.referredBy && (u.referredBy._id === bookieId || u.referredBy === bookieId)
        );
    };

    useEffect(() => {
        setPlayerListPages((prev) => {
            const next = { ...prev };
            let changed = false;
            const clamp = (tabKey, pag) => {
                if (!pag?.totalPages || pag.totalPages < 1) return;
                if (prev[tabKey] > pag.totalPages) {
                    next[tabKey] = pag.totalPages;
                    changed = true;
                }
            };
            clamp('all', paginationByTab.all);
            clamp('super_admin_users', paginationByTab.super_admin_users);
            clamp('bookie_users', paginationByTab.bookie_users);
            return changed ? next : prev;
        });
    }, [paginationByTab.all, paginationByTab.super_admin_users, paginationByTab.bookie_users]);

    return (
        <AdminLayout onLogout={handleLogout} title="All Players">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold">All Players</h1>
                <button
                    type="button"
                    onClick={() => navigate('/add-user')}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-500/90 text-gray-800 font-semibold transition-colors text-sm sm:text-base shrink-0"
                >
                    <FaUserPlus className="w-5 h-5" />
                    Add Player
                </button>
            </div>

            {/* Fixed top notification - no layout shift */}
            {(success || error) && (
                <div className="fixed top-14 lg:top-4 left-0 right-0 lg:left-72 lg:right-0 flex justify-center px-4 z-50 pointer-events-none">
                    <div className={`px-3 py-2 rounded-lg flex items-center gap-2 shadow-lg backdrop-blur-sm border text-sm max-w-md ${
                        success
                            ? 'bg-green-900/95 border-green-700 text-green-200'
                            : 'bg-red-900/95 border-red-200 text-red-600'
                    }`}>
                        <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                            success ? 'bg-green-600/50 text-green-300' : 'bg-red-600/50 text-red-300'
                        }`}>
                            {success ? '✓' : '✕'}
                        </span>
                        <span className="flex-1">{success || error}</span>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-4">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 rounded-lg font-semibold transition-colors text-sm sm:text-base ${
                            activeTab === tab.id
                                ? 'bg-orange-500 text-gray-800'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="mb-4 sm:mb-6">
                <div className="relative max-w-md">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search by name or phone..."
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

            {/* Table - overflow-x-auto so Action column is visible when table is wide */}
            <div className="bg-white rounded-lg overflow-x-auto overflow-y-hidden border border-gray-200 min-w-0 max-w-full">
                {loading ? (
                    <div className="p-8 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto" />
                        <p className="mt-4 text-gray-400">Loading...</p>
                    </div>
                ) : list.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        No {TABS.find(t => t.id === activeTab)?.label?.toLowerCase()} found.
                    </div>
                ) : filteredList.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        No results match your search. Try a different term.
                    </div>
                ) : activeTab === 'all_bookies' ? (
                    <div>
                        {/* Header */}
                        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-100/40 border-b border-gray-200/80">
                            <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                                <span className="font-semibold text-orange-500">All Bookies</span>
                                <span className="hidden sm:inline"> — Bookie accounts who can add players via their link.</span>
                                <span className="block sm:inline mt-1 sm:mt-0 sm:ml-1">Click <span className="font-medium text-gray-800">View Players</span> to see players under each bookie.</span>
                            </p>
                        </div>

                        {/* Desktop table */}
                        <div className="hidden md:block">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-100/80">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-10">#</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Username</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider hidden lg:table-cell">Phone</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider hidden lg:table-cell">Created</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700/60">
                                    {filteredList.map((bookie, index) => {
                                        const bookieUsers = getUsersForBookie(bookie._id);
                                        const isExpanded = expandedBookieId === bookie._id;
                                        return (
                                            <React.Fragment key={bookie._id}>
                                                <tr className="hover:bg-gray-100/30 transition-colors">
                                                    <td className="px-4 py-3 text-gray-400">{index + 1}</td>
                                                    <td className="px-4 py-3 font-medium text-gray-800">{bookie.username}</td>
                                                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{bookie.phone || '—'}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${
                                                            bookie.status === 'active'
                                                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                                                                : 'bg-rose-100 text-rose-700 border border-rose-300'
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
                                                                        ? 'bg-rose-600 hover:bg-rose-500 text-white'
                                                                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                                                }`}
                                                            >
                                                                {togglingId === bookie._id ? '⏳' : bookie.status === 'active' ? <><FaUserSlash className="w-3.5 h-3.5" /> Suspend</> : <><FaUserCheck className="w-3.5 h-3.5" /> Unsuspend</>}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setExpandedBookieId(isExpanded ? null : bookie._id)}
                                                                className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-500/90 hover:bg-orange-500 text-gray-800 transition-colors"
                                                            >
                                                                {isExpanded ? 'Hide Players' : 'View Players'}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr>
                                                        <td colSpan="6" className="px-0 py-0 bg-gray-50/30">
                                                            <div className="px-6 py-4 sm:py-5 border-l-4 border-orange-500 ml-4 sm:ml-6">
                                                                <p className="text-orange-500 font-semibold mb-3 text-sm">
                                                                    Players under <span className="text-gray-800">{bookie.username}</span>
                                                                </p>
                                                                {bookieUsers.length === 0 ? (
                                                                    <p className="text-gray-500 text-sm py-2">No players yet.</p>
                                                                ) : (
                                                                    <div className="rounded-lg border border-gray-200/80 overflow-hidden bg-white">
                                                                        <table className="w-full text-sm">
                                                                            <thead className="bg-gray-100/80">
                                                                                <tr>
                                                                                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase w-10">#</th>
                                                                                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase">Name</th>
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
                                                                                    <tr key={u._id} className="hover:bg-gray-100/20 transition-colors">
                                                                                        <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                                                                                        <td className="px-4 py-2.5 font-medium">
                                                                                            <Link to={`/all-users/${u._id}`} className="text-orange-500 hover:text-orange-600 hover:underline">{u.username}</Link>
                                                                                        </td>
                                                                                        <td className="px-4 py-2.5 text-gray-600 hidden lg:table-cell">{u.phone || '—'}</td>
                                                                                        <td className="px-4 py-2.5">
                                                                                            {(() => {
                                                                                                const isOnline = computeIsOnline(u, now);
                                                                                                return (
                                                                                                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border ${isOnline ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-slate-100 text-slate-600 border-slate-300'}`}>
                                                                                                        <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                                                                                                        {isOnline ? 'Online' : 'Offline'}
                                                                                                    </span>
                                                                                                );
                                                                                            })()}
                                                                                        </td>
                                                                                        <td className="px-4 py-2.5 text-green-600 font-mono text-xs">₹{Number(u.walletBalance ?? 0).toLocaleString('en-IN')}</td>
                                                                                        <td className="px-4 py-2.5 hidden sm:table-cell">
                                                                                            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${u.isActive !== false ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-rose-100 text-rose-700 border-rose-300'}`}>
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
                                                                                                    u.isActive !== false ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
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
                            {filteredList.map((bookie, index) => {
                                const bookieUsers = getUsersForBookie(bookie._id);
                                const isExpanded = expandedBookieId === bookie._id;
                                return (
                                    <div key={bookie._id} className="p-3 sm:p-4 hover:bg-gray-100/20 transition-colors">
                                        <div className="flex flex-col gap-2 mb-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="text-gray-400 text-sm shrink-0">{index + 1}.</span>
                                                <span className="font-semibold text-gray-800 truncate flex-1 min-w-0">{bookie.username}</span>
                                                <span className={`shrink-0 px-2 py-0.5 rounded-md text-xs font-medium ${
                                                    bookie.status === 'active'
                                                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                                                        : 'bg-rose-100 text-rose-700 border border-rose-300'
                                                }`}>
                                                    {bookie.status === 'active' ? 'Active' : 'Suspended'}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 w-full">
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleBookieStatus(bookie._id)}
                                                    disabled={togglingId === bookie._id}
                                                    className={`inline-flex items-center justify-center gap-1 px-2.5 py-2 rounded-lg text-xs font-semibold disabled:opacity-50 ${
                                                        bookie.status === 'active'
                                                            ? 'bg-rose-600 hover:bg-rose-500 text-white'
                                                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                                    }`}
                                                >
                                                    {togglingId === bookie._id ? '⏳' : bookie.status === 'active' ? <><FaUserSlash className="w-3.5 h-3.5" /> Suspend</> : <><FaUserCheck className="w-3.5 h-3.5" /> Unsuspend</>}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedBookieId(isExpanded ? null : bookie._id)}
                                                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-orange-500/90 hover:bg-orange-500 text-gray-800"
                                                >
                                                    {isExpanded ? 'Hide' : 'View'} Players
                                                </button>
                                            </div>
                                        </div>
                                        <div className="text-xs text-gray-400 space-y-0.5">
                                            {bookie.phone && <p>📱 {bookie.phone}</p>}
                                            <p>{bookie.createdAt ? new Date(bookie.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</p>
                                        </div>
                                        {isExpanded && (
                                            <div className="mt-4 pl-3 border-l-2 border-orange-500/70 space-y-3">
                                                <p className="text-orange-500/90 font-medium text-sm">Players ({bookieUsers.length})</p>
                                                {bookieUsers.length === 0 ? (
                                                    <p className="text-gray-500 text-xs">No players yet.</p>
                                                ) : (
                                                    bookieUsers.map((u, i) => (
                                                        <div key={u._id} className="p-3 rounded-lg bg-white border border-gray-200">
                                                            <div className="flex flex-col gap-2 mb-1.5">
                                                                <Link to={`/all-users/${u._id}`} className="font-medium text-orange-500 hover:text-orange-600 hover:underline text-sm truncate">{u.username}</Link>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border ${computeIsOnline(u, now) ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-slate-100 text-slate-600 border-slate-300'}`}>
                                                                        <span className={`w-1.5 h-1.5 rounded-full ${computeIsOnline(u, now) ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                                                                        {computeIsOnline(u, now) ? 'Online' : 'Offline'}
                                                                    </span>
                                                                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium border ${u.isActive !== false ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-rose-100 text-rose-700 border-rose-300'}`}>
                                                                        {u.isActive !== false ? 'Active' : 'Suspended'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                                                                <span className="text-green-600 font-mono">₹{Number(u.walletBalance ?? 0).toLocaleString('en-IN')}</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleTogglePlayerStatus(u._id)}
                                                                    disabled={togglingId === u._id}
                                                                    className={`inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-semibold disabled:opacity-50 ${
                                                                        u.isActive !== false ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
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
                            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 text-sm text-gray-600">
                                {activeTab === 'bookie_users' ? (
                                    <><strong className="text-orange-500">All Bookies Players</strong> – Players who signed up via a bookie&apos;s link.</>
                                ) : (
                                    <><strong className="text-orange-500">Super Admin Players</strong> – Players who signed up directly or were created by super admin.</>
                                )}
                            </div>
                        )}
                        <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[800px]">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase w-8">#</th>
                                    <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase">Name</th>
                                    <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase">Phone</th>
                                    <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase">Wallet</th>
                                    <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                                    <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase">Account</th>
                                    <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase">Created</th>
                                    <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase w-28 whitespace-nowrap">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {filteredList.map((item, index) => (
                                    <tr key={item._id} className="hover:bg-gray-50">
                                        <td className="px-2 sm:px-3 py-2 sm:py-3 text-gray-600">
                                            {isUserList ? rowOffset + index + 1 : index + 1}
                                        </td>
                                        <td className="px-2 sm:px-3 py-2 sm:py-3 font-medium">
                                            {isUserList ? (
                                                <Link to={`/all-users/${item._id}`} className="text-orange-500 hover:text-orange-600 hover:underline truncate block max-w-[120px]">{item.username}</Link>
                                            ) : (
                                                <span className="text-gray-800 truncate block max-w-[120px]">{item.username}</span>
                                            )}
                                        </td>
                                        <td className="px-2 sm:px-3 py-2 sm:py-3 text-gray-600">{item.phone || '—'}</td>
                                        <td className="px-2 sm:px-3 py-2 sm:py-3">
                                            {(activeTab === 'super_admins') ? (
                                                <span className="text-gray-400">—</span>
                                            ) : (
                                                <span className="font-mono font-medium text-green-600 text-xs sm:text-sm">
                                                    ₹{Number(item.walletBalance ?? 0).toLocaleString('en-IN')}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-2 sm:px-3 py-2 sm:py-3">
                                            {(activeTab === 'super_admins') ? (
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                    item.status === 'active'
                                                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                                                        : 'bg-rose-100 text-rose-700 border border-rose-300'
                                                }`}>
                                                    {item.status || '—'}
                                                </span>
                                            ) : (
                                                (() => {
                                                    const isOnline = computeIsOnline(item, now);
                                                    return (
                                                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${
                                                            isOnline
                                                                ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                                                                : 'bg-slate-100 text-slate-600 border-slate-300'
                                                        }`}>
                                                            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                                                            {isOnline ? 'Online' : 'Offline'}
                                                        </span>
                                                    );
                                                })()
                                            )}
                                        </td>
                                        <td className="px-2 sm:px-3 py-2 sm:py-3">
                                            {(activeTab === 'super_admins') ? (
                                                <span className="text-gray-400">—</span>
                                            ) : (
                                                <span className={`px-2 py-1 rounded text-xs font-medium border ${
                                                    item.isActive !== false
                                                        ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                                                        : 'bg-rose-100 text-rose-700 border-rose-300'
                                                }`}>
                                                    {item.isActive !== false ? 'Active' : 'Suspended'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-2 sm:px-3 py-2 sm:py-3 text-gray-600 text-xs">
                                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN', {
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric',
                                            }) : '—'}
                                        </td>
                                        <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap">
                                            {(activeTab === 'super_admins') ? (
                                                <span className="text-gray-400">—</span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => handleTogglePlayerStatus(item._id)}
                                                    disabled={togglingId === item._id}
                                                    className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                                        item.isActive !== false
                                                            ? 'bg-rose-600 hover:bg-rose-500 text-white'
                                                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                                    }`}
                                                    title={item.isActive !== false ? 'Suspend' : 'Unsuspend'}
                                                >
                                                    {togglingId === item._id ? (
                                                        <span className="animate-spin">⏳</span>
                                                    ) : item.isActive !== false ? (
                                                        <>
                                                            <FaUserSlash className="w-3.5 h-3.5 shrink-0" />
                                                            Suspend
                                                        </>
                                                    ) : (
                                                        <>
                                                            <FaUserCheck className="w-3.5 h-3.5 shrink-0" />
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
                        {isUserList && paginationForActiveUserTab && (
                            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 bg-gray-50">
                                <p className="text-sm text-gray-600">
                                    Page <span className="font-semibold text-gray-800">{paginationForActiveUserTab.page}</span>
                                    {' '}of{' '}
                                    <span className="font-semibold text-gray-800">{paginationForActiveUserTab.totalPages}</span>
                                    <span className="text-gray-500">
                                        {' '}({paginationForActiveUserTab.total.toLocaleString('en-IN')} total)
                                    </span>
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        disabled={loading || !paginationForActiveUserTab.hasPrevPage}
                                        onClick={() =>
                                            setPlayerListPages((p) => ({
                                                ...p,
                                                [activeTab]: Math.max(1, (p[activeTab] || 1) - 1),
                                            }))
                                        }
                                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Previous
                                    </button>
                                    <button
                                        type="button"
                                        disabled={loading || !paginationForActiveUserTab.hasNextPage}
                                        onClick={() =>
                                            setPlayerListPages((p) => ({
                                                ...p,
                                                [activeTab]: (p[activeTab] || 1) + 1,
                                            }))
                                        }
                                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-orange-500 text-gray-900 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {!loading && list.length > 0 && (
                <p className="mt-4 text-gray-400 text-sm">
                    {isUserList && paginationForActiveUserTab ? (
                        <>
                            Showing{' '}
                            {filteredList.length > 0 ? `${(rowOffset + 1).toLocaleString('en-IN')}–${(rowOffset + filteredList.length).toLocaleString('en-IN')}` : '0'}
                            {' '}of {paginationForActiveUserTab.total.toLocaleString('en-IN')}{' '}
                            {TABS.find((t) => t.id === activeTab)?.label?.toLowerCase()}
                        </>
                    ) : (
                        <>
                            Showing {filteredList.length} {TABS.find((t) => t.id === activeTab)?.label?.toLowerCase()}
                            {!isUserList && searchQuery && filteredList.length !== list.length && (
                                <span> (filtered from {list.length})</span>
                            )}
                        </>
                    )}
                </p>
            )}

            {showPasswordModal && pendingAction && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-md">
                        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-orange-500">
                                Confirm {pendingAction.type === 'player' ? 'Suspend/Unsuspend Player' : 'Suspend/Unsuspend Bookie'}
                            </h3>
                            <button type="button" onClick={closePasswordModal} className="text-gray-400 hover:text-gray-800 p-1">×</button>
                        </div>
                        <form onSubmit={handlePasswordSubmit} className="p-4 space-y-4">
                            <p className="text-gray-600 text-sm">
                                Enter secret declare password to proceed.
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
                                <button type="button" onClick={closePasswordModal} className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-500 text-gray-800 font-semibold">Cancel</button>
                                <button type="submit" disabled={togglingId !== null} className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-gray-800 font-semibold disabled:opacity-50">
                                    {togglingId ? <span className="animate-spin">⏳</span> : 'Confirm'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default AllUsers;
