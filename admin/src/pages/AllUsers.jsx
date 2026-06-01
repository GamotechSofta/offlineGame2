import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import { useNavigate, Link } from 'react-router-dom';
import { FaUserSlash, FaUserCheck, FaUserPlus, FaSearch } from 'react-icons/fa';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import useModalBackHandler from '../hooks/useModalBackHandler';
import { dedupeRequest } from '../lib/requestDedupe';
import { useTraceRender } from '../lib/runtimeTrace';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';
import { getAuthHeaders, clearAdminSession, fetchWithAuth, getStoredAdmin } from '../lib/auth';
import {
    TOP_LEVEL_LABEL,
    TOP_LEVEL_LABEL_PLURAL,
    SUB_LEVEL_LABEL,
    SUB_LEVEL_LABEL_PLURAL,
    ownershipChainLabel,
} from '../config/roleLabels';

const ALL_PLAYER_TABS = [
    { id: 'all', label: 'All Players', value: 'all' },
    { id: 'super_admins', label: 'All Super Admins', value: 'super_admins' },
    { id: 'all_bookies', label: `All ${TOP_LEVEL_LABEL_PLURAL}`, value: 'all_bookies' },
    { id: 'bookie_users', label: `All ${TOP_LEVEL_LABEL_PLURAL} Players`, value: 'bookie_users' },
    { id: 'super_admin_users', label: 'Super Admin Players', value: 'super_admin_users' },
];

function getVisibleTabsForAdmin(admin) {
    if (!admin || admin.role === 'super_admin') return ALL_PLAYER_TABS;
    if (admin.role === 'specific_admin') {
        const allowed = admin.allowedTabs || [];
        return ALL_PLAYER_TABS.filter((tab) => {
            if (tab.id === 'super_admins') return false;
            if (tab.id === 'all_bookies') return allowed.includes('/bookie-management');
            if (['all', 'super_admin_users', 'bookie_users'].includes(tab.id)) {
                return allowed.includes('/all-users');
            }
            return false;
        });
    }
    return ALL_PLAYER_TABS;
}
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

const computeIsOnline = (item, nowMs) => {
    const lastActive = item?.lastActiveAt ? new Date(item.lastActiveAt).getTime() : 0;
    return lastActive > 0 && nowMs - lastActive < ONLINE_THRESHOLD_MS;
};

const USERS_PAGE_LIMIT = 100;

const refId = (v) => (v?._id != null ? String(v._id) : v != null ? String(v) : '');

const getPlayerOwnership = (u) => {
    if (!u) return { pool: 'super_admin', bookie: null, superBookie: null };
    if (u.referrerChain?.superBookie) {
        return {
            pool: 'super_bookie',
            bookie: u.referrerChain.bookie?.username || null,
            superBookie: u.referrerChain.superBookie?.username || null,
        };
    }
    if (u.referrerChain?.bookie || (u.referredBy && u.referredBy.role !== 'super_bookie')) {
        return {
            pool: 'bookie',
            bookie: u.referrerChain?.bookie?.username || u.referredBy?.username || null,
            superBookie: null,
        };
    }
    if (u.referredBy?.role === 'super_bookie') {
        return { pool: 'super_bookie', bookie: null, superBookie: u.referredBy?.username || null };
    }
    if (u.referredBy) {
        return { pool: 'bookie', bookie: u.referredBy?.username || null, superBookie: null };
    }
    if (u.source === 'super_bookie') {
        return { pool: 'super_bookie', bookie: null, superBookie: null };
    }
    if (u.source === 'bookie') {
        return { pool: 'bookie', bookie: null, superBookie: null };
    }
    return { pool: 'super_admin', bookie: null, superBookie: null };
};

/** Single-line: who owns this player (SuperBookie › Bookie, or Super Admin). */
const getBelongsToLabel = (u) => {
    const o = getPlayerOwnership(u);
    if (o.pool === 'super_admin') return 'Super Admin';
    if (o.superBookie) {
        return ownershipChainLabel(o.bookie, o.superBookie);
    }
    return o.bookie || '—';
};

const PlayersMiniTable = ({ players, now, canManagePlayers, togglingId, onToggle, startIndex = 0, extraCol }) => {
    if (!players?.length) {
        return <p className="text-gray-500 text-sm py-2">No players yet.</p>;
    }
    return (
        <div className="rounded-lg border border-gray-200/80 overflow-hidden bg-white">
            <table className="w-full text-sm">
                <thead className="bg-gray-100/80">
                    <tr>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase w-10">#</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase">Name</th>
                        {extraCol}
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase hidden lg:table-cell">Phone</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase">Wallet</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase hidden sm:table-cell">Account</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase hidden lg:table-cell">Created</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/60">
                    {players.map((u, i) => {
                        const isOnline = computeIsOnline(u, now);
                        return (
                            <tr key={u._id} className="hover:bg-gray-100/20 transition-colors">
                                <td className="px-4 py-2.5 text-gray-400">{startIndex + i + 1}</td>
                                <td className="px-4 py-2.5 font-medium">
                                    <Link to={`/all-users/${u._id}`} className="text-orange-500 hover:text-orange-600 hover:underline">{u.username}</Link>
                                </td>
                                {extraCol ? extraCol(u) : null}
                                <td className="px-4 py-2.5 text-gray-600 hidden lg:table-cell">{u.phone || '—'}</td>
                                <td className="px-4 py-2.5">
                                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border ${isOnline ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-slate-100 text-slate-600 border-slate-300'}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                                        {isOnline ? 'Online' : 'Offline'}
                                    </span>
                                </td>
                                <td className="px-4 py-2.5 text-green-600 font-mono text-xs">₹{Math.floor(Number(u.walletBalance ?? 0)).toLocaleString('en-IN')}</td>
                                <td className="px-4 py-2.5 hidden sm:table-cell">
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${u.isActive !== false ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-rose-100 text-rose-700 border-rose-300'}`}>
                                        {u.isActive !== false ? 'Active' : 'Suspended'}
                                    </span>
                                </td>
                                <td className="px-4 py-2.5 text-gray-400 text-xs hidden lg:table-cell">
                                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                </td>
                                <td className="px-4 py-2.5">
                                    {canManagePlayers ? (
                                        <button
                                            type="button"
                                            onClick={() => onToggle(u._id)}
                                            disabled={togglingId === u._id}
                                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                                                u.isActive !== false ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                            }`}
                                        >
                                            {togglingId === u._id ? '⏳' : u.isActive !== false ? <><FaUserSlash className="w-3 h-3" /> Suspend</> : <><FaUserCheck className="w-3 h-3" /> Unsuspend</>}
                                        </button>
                                    ) : (
                                        <span className="text-gray-400">—</span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

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
    const storedAdmin = getStoredAdmin();
    const canManagePlayers = storedAdmin?.role === 'super_admin';
    const visibleTabs = getVisibleTabsForAdmin(storedAdmin);
    const [activeTab, setActiveTab] = useState(() => visibleTabs[0]?.id || 'all');
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
    const [expandedSuperBookieId, setExpandedSuperBookieId] = useState(null);
    const [allSuperBookies, setAllSuperBookies] = useState([]);
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
        const admin = getStoredAdmin();
        const isSuperAdmin = admin?.role === 'super_admin';
        const allowed = admin?.allowedTabs || [];
        const hasAllUsers = isSuperAdmin || allowed.includes('/all-users');
        const hasBookieMgmt = isSuperAdmin || allowed.includes('/bookie-management');

        const searchParam =
            searchStr && String(searchStr).trim()
                ? `&search=${encodeURIComponent(String(searchStr).trim())}`
                : '';
        const dedupeKey = `all-users:data:${pAll}:${pSuper}:${pBookie}:${searchStr || ''}:${isSuperAdmin}`;
        return dedupeRequest(dedupeKey, async () => {
            const empty = {
                allUsers: [],
                superAdminUsersList: [],
                bookieUsersList: [],
                allBookies: [],
                allSuperBookies: [],
                superAdminsList: [],
                paginationAll: null,
                paginationSuperAdmin: null,
                paginationBookie: null,
            };

            const tasks = [];
            if (hasAllUsers) {
                tasks.push(
                    fetchWithAuth(`${API_BASE_URL}/users?page=${pAll}&limit=${USERS_PAGE_LIMIT}${searchParam}`),
                    fetchWithAuth(`${API_BASE_URL}/users?filter=super_admin&page=${pSuper}&limit=${USERS_PAGE_LIMIT}${searchParam}`),
                    fetchWithAuth(`${API_BASE_URL}/users?filter=bookie&page=${pBookie}&limit=${USERS_PAGE_LIMIT}${searchParam}`),
                );
            }
            if (hasBookieMgmt) {
                tasks.push(
                    fetchWithAuth(`${API_BASE_URL}/admin/bookies`),
                    fetchWithAuth(`${API_BASE_URL}/admin/super-bookies`),
                );
            }
            if (isSuperAdmin) {
                tasks.push(fetchWithAuth(`${API_BASE_URL}/admin/super-admins`));
            }

            if (tasks.length === 0) return empty;

            const results = await Promise.all(tasks);
            if (results.some((r) => r.status === 401)) return empty;

            let idx = 0;
            let allData = { success: false };
            let superAdminData = { success: false };
            let bookieData = { success: false };
            if (hasAllUsers) {
                allData = await results[idx++].json();
                superAdminData = await results[idx++].json();
                bookieData = await results[idx++].json();
            }
            let bookiesData = { success: false };
            let superBookiesData = { success: false };
            if (hasBookieMgmt) {
                bookiesData = await results[idx++].json();
                superBookiesData = await results[idx++].json();
            }
            let adminsData = { success: false };
            if (isSuperAdmin) {
                adminsData = await results[idx++].json();
            }

            return {
                allUsers: allData.success ? (allData.data || []) : [],
                superAdminUsersList: superAdminData.success ? (superAdminData.data || []) : [],
                bookieUsersList: bookieData.success ? (bookieData.data || []) : [],
                allBookies: bookiesData.success ? (bookiesData.data || []) : [],
                allSuperBookies: superBookiesData.success ? (superBookiesData.data || []) : [],
                superAdminsList: adminsData.success ? (adminsData.data || []) : [],
                paginationAll: allData.success ? allData.pagination : null,
                paginationSuperAdmin: superAdminData.success ? superAdminData.pagination : null,
                paginationBookie: bookieData.success ? bookieData.pagination : null,
            };
        });
    };

    useEffect(() => {
        if (!visibleTabs.some((t) => t.id === activeTab)) {
            setActiveTab(visibleTabs[0]?.id || 'all');
        }
    }, [activeTab, visibleTabs]);

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
        setAllSuperBookies(usersQuery.data.allSuperBookies || []);
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
            setSuccess(`${TOP_LEVEL_LABEL} ${data.data.status === 'active' ? 'unsuspended' : 'suspended'} successfully`);
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

    const getSuperBookiesForBookie = (bookieId) =>
        allSuperBookies.filter((sb) => refId(sb.parentBookieId) === refId(bookieId));

    const getUsersForSuperBookie = (superBookieId) =>
        bookieUsersList.filter((u) => refId(u.referredBy) === refId(superBookieId) || refId(u.referrerChain?.superBookie) === refId(superBookieId));

    const getDirectPlayersForBookie = (bookieId) =>
        bookieUsersList.filter((u) => {
            if (u.referrerChain?.superBookie) return false;
            return refId(u.referrerChain?.bookie) === refId(bookieId) || refId(u.referredBy) === refId(bookieId);
        });

    const showReferrerColumns = activeTab === 'all' || activeTab === 'bookie_users';

    const renderBookieHierarchyPanel = (bookie) => {
        const superBookies = getSuperBookiesForBookie(bookie._id);
        const directPlayers = getDirectPlayersForBookie(bookie._id);
        const totalPlayers =
            directPlayers.length +
            superBookies.reduce((sum, sb) => sum + (sb.playerCount ?? getUsersForSuperBookie(sb._id).length), 0);

        if (superBookies.length === 0 && directPlayers.length === 0) {
            return <p className="text-gray-500 text-sm py-2">No {SUB_LEVEL_LABEL_PLURAL.toLowerCase()} or players yet.</p>;
        }

        return (
            <div className="space-y-5">
                {superBookies.length > 0 && (
                    <div>
                        <p className="text-sm font-semibold text-indigo-600 mb-2">
                            {SUB_LEVEL_LABEL_PLURAL} under {bookie.username}
                        </p>
                        <div className="space-y-3">
                            {superBookies.map((sb) => {
                                const sbPlayers = getUsersForSuperBookie(sb._id);
                                const sbExpanded = expandedSuperBookieId === sb._id;
                                return (
                                    <div key={sb._id} className="rounded-lg border border-indigo-200/80 bg-indigo-50/30 overflow-hidden">
                                        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                                            <div>
                                                <p className="font-medium text-gray-800">{sb.username}</p>
                                                <p className="text-xs text-gray-500">
                                                    {sb.phone || '—'} · {sbPlayers.length} player{sbPlayers.length !== 1 ? 's' : ''}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setExpandedSuperBookieId(sbExpanded ? null : sb._id)}
                                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white"
                                            >
                                                {sbExpanded ? 'Hide players' : 'View players'}
                                            </button>
                                        </div>
                                        {sbExpanded && (
                                            <div className="px-4 pb-4 border-t border-indigo-100">
                                                <PlayersMiniTable
                                                    players={sbPlayers}
                                                    now={now}
                                                    canManagePlayers={canManagePlayers}
                                                    togglingId={togglingId}
                                                    onToggle={handleTogglePlayerStatus}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                {directPlayers.length > 0 && (
                    <div>
                        <p className="text-sm font-semibold text-orange-500 mb-2">
                            Direct players under {bookie.username}
                        </p>
                        <PlayersMiniTable
                            players={directPlayers}
                            now={now}
                            canManagePlayers={canManagePlayers}
                            togglingId={togglingId}
                            onToggle={handleTogglePlayerStatus}
                        />
                    </div>
                )}
                <p className="text-xs text-gray-500">
                    Total: {superBookies.length} {SUB_LEVEL_LABEL.toLowerCase()}{superBookies.length !== 1 ? 's' : ''}, {totalPlayers} player{totalPlayers !== 1 ? 's' : ''}
                </p>
            </div>
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
                {canManagePlayers && (
                    <button
                        type="button"
                        onClick={() => navigate('/add-user')}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-500/90 text-gray-800 font-semibold transition-colors text-sm sm:text-base shrink-0"
                    >
                        <FaUserPlus className="w-5 h-5" />
                        Add Player
                    </button>
                )}
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
                {visibleTabs.map((tab) => (
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
                        No {visibleTabs.find(t => t.id === activeTab)?.label?.toLowerCase()} found.
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
                                <span className="font-semibold text-orange-500">All {TOP_LEVEL_LABEL_PLURAL}</span>
                                <span className="hidden sm:inline"> — {TOP_LEVEL_LABEL} accounts who can add players via their link.</span>
                                <span className="block sm:inline mt-1 sm:mt-0 sm:ml-1">Click <span className="font-medium text-gray-800">View tree</span> to see {SUB_LEVEL_LABEL_PLURAL.toLowerCase()} and players under each {TOP_LEVEL_LABEL.toLowerCase()}.</span>
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
                                        const superBookies = getSuperBookiesForBookie(bookie._id);
                                        const directPlayers = getDirectPlayersForBookie(bookie._id);
                                        const totalPlayers =
                                            directPlayers.length +
                                            superBookies.reduce((s, sb) => s + (sb.playerCount ?? getUsersForSuperBookie(sb._id).length), 0);
                                        const isExpanded = expandedBookieId === bookie._id;
                                        return (
                                            <React.Fragment key={bookie._id}>
                                                <tr className="hover:bg-gray-100/30 transition-colors">
                                                    <td className="px-4 py-3 text-gray-400">{index + 1}</td>
                                                    <td className="px-4 py-3 font-medium text-gray-800">
                                                        <div>{bookie.username}</div>
                                                        <p className="text-xs font-normal text-gray-500 mt-0.5">
                                                            {superBookies.length} {SUB_LEVEL_LABEL.toLowerCase()}{superBookies.length !== 1 ? 's' : ''} · {totalPlayers} player{totalPlayers !== 1 ? 's' : ''}
                                                        </p>
                                                    </td>
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
                                                            {canManagePlayers && (
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
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setExpandedBookieId(isExpanded ? null : bookie._id);
                                                                    setExpandedSuperBookieId(null);
                                                                }}
                                                                className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-500/90 hover:bg-orange-500 text-gray-800 transition-colors"
                                                            >
                                                                {isExpanded ? 'Hide tree' : 'View tree'}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr>
                                                        <td colSpan="6" className="px-0 py-0 bg-gray-50/30">
                                                            <div className="px-6 py-4 sm:py-5 border-l-4 border-orange-500 ml-4 sm:ml-6">
                                                                <p className="text-orange-500 font-semibold mb-3 text-sm">
                                                                    Hierarchy: <span className="text-gray-800">{bookie.username}</span>
                                                                </p>
                                                                {renderBookieHierarchyPanel(bookie)}
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
                                const superBookies = getSuperBookiesForBookie(bookie._id);
                                const directPlayers = getDirectPlayersForBookie(bookie._id);
                                const totalPlayers =
                                    directPlayers.length +
                                    superBookies.reduce((s, sb) => s + (sb.playerCount ?? getUsersForSuperBookie(sb._id).length), 0);
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
                                                    onClick={() => {
                                                        setExpandedBookieId(isExpanded ? null : bookie._id);
                                                        setExpandedSuperBookieId(null);
                                                    }}
                                                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-orange-500/90 hover:bg-orange-500 text-gray-800"
                                                >
                                                    {isExpanded ? 'Hide' : 'View'} tree
                                                </button>
                                            </div>
                                        </div>
                                        <div className="text-xs text-gray-400 space-y-0.5">
                                            {bookie.phone && <p>📱 {bookie.phone}</p>}
                                            <p>{bookie.createdAt ? new Date(bookie.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</p>
                                        </div>
                                        {isExpanded && (
                                            <div className="mt-4 pl-3 border-l-2 border-orange-500/70 space-y-3">
                                                <p className="text-orange-500/90 font-medium text-sm">
                                                    {superBookies.length} {SUB_LEVEL_LABEL.toLowerCase()}{superBookies.length !== 1 ? 's' : ''} · {totalPlayers} player{totalPlayers !== 1 ? 's' : ''}
                                                </p>
                                                {renderBookieHierarchyPanel(bookie)}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div>
                        {(activeTab === 'all' || activeTab === 'bookie_users' || activeTab === 'super_admin_users') && (
                            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 text-sm text-gray-600">
                                {activeTab === 'all' && (
                                    <>
                                        <strong className="text-orange-500">All Players</strong>
                                        {' '}– <strong>Belongs to</strong> shows who owns each player (Super Admin, {TOP_LEVEL_LABEL}, or {TOP_LEVEL_LABEL} › {SUB_LEVEL_LABEL}).
                                    </>
                                )}
                                {activeTab === 'bookie_users' && (
                                    <><strong className="text-orange-500">All {TOP_LEVEL_LABEL_PLURAL} Players</strong> – Players under a {TOP_LEVEL_LABEL.toLowerCase()} or {SUB_LEVEL_LABEL.toLowerCase()}.</>
                                )}
                                {activeTab === 'super_admin_users' && (
                                    <><strong className="text-orange-500">Super Admin Players</strong> – Players who signed up directly or were created by super admin.</>
                                )}
                            </div>
                        )}
                        <div className="admin-table-frame">
                        <table className={`w-full text-sm ${showReferrerColumns ? 'min-w-[920px]' : 'min-w-[800px]'}`}>
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase w-8">#</th>
                                    <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase">Name</th>
                                    {showReferrerColumns && (
                                        <th className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium text-gray-600 uppercase min-w-[160px]">Belongs to</th>
                                    )}
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
                                        {showReferrerColumns && (
                                            <td className="px-2 sm:px-3 py-2 sm:py-3 text-xs font-medium">
                                                {(() => {
                                                    const label = getBelongsToLabel(item);
                                                    const o = getPlayerOwnership(item);
                                                    if (o.pool === 'super_admin') {
                                                        return <span className="text-gray-600">{label}</span>;
                                                    }
                                                    if (o.superBookie) {
                                                        return (
                                                            <span className="text-gray-800">
                                                                {o.bookie || TOP_LEVEL_LABEL}
                                                                <span className="text-gray-400 mx-1">›</span>
                                                                <span className="text-indigo-700">{o.superBookie}</span>
                                                            </span>
                                                        );
                                                    }
                                                    return <span className="text-gray-800">{label}</span>;
                                                })()}
                                            </td>
                                        )}
                                        <td className="px-2 sm:px-3 py-2 sm:py-3 text-gray-600">{item.phone || '—'}</td>
                                        <td className="px-2 sm:px-3 py-2 sm:py-3">
                                            {(activeTab === 'super_admins') ? (
                                                <span className="text-gray-400">—</span>
                                            ) : (
                                                <span className="font-mono font-medium text-green-600 text-xs sm:text-sm">
                                                    ₹{Math.floor(Number(item.walletBalance ?? 0)).toLocaleString('en-IN')}
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
                                            {(activeTab === 'super_admins') || !canManagePlayers ? (
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
                            {visibleTabs.find((t) => t.id === activeTab)?.label?.toLowerCase()}
                        </>
                    ) : (
                        <>
                            Showing {filteredList.length} {visibleTabs.find((t) => t.id === activeTab)?.label?.toLowerCase()}
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
                                Confirm {pendingAction.type === 'player' ? 'Suspend/Unsuspend Player' : `Suspend/Unsuspend ${TOP_LEVEL_LABEL}`}
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
