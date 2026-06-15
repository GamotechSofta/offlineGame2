import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaPlus, FaTimes, FaEye, FaEyeSlash, FaSearch, FaUsersCog, FaFilter } from 'react-icons/fa';
import useModalBackHandler from '../hooks/useModalBackHandler';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';
import { getAuthHeaders, clearAdminSession, fetchWithAuth, getStoredAdmin } from '../lib/auth';
import {
    TOP_LEVEL_LABEL,
    TOP_LEVEL_LABEL_PLURAL,
    SUB_LEVEL_LABEL,
    SUB_LEVEL_LABEL_PLURAL,
} from '../config/roleLabels';

const PAGE_TABS = [
    { id: 'superBookies', label: TOP_LEVEL_LABEL_PLURAL },
    { id: 'allBookies', label: `All ${SUB_LEVEL_LABEL_PLURAL}` },
];

const formatCurrency = (value) => {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

const TableHeader = ({ label, align = 'left' }) => (
    <th className={`px-4 py-3 align-middle text-[11px] font-semibold text-slate-600 uppercase tracking-wide ${align === 'right' ? 'text-right' : 'text-left'}`}>
        {label}
    </th>
);

const StatusBadge = ({ status }) => (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
        status === 'active'
            ? 'bg-green-100 text-green-700'
            : 'bg-red-50 text-red-600'
    }`}>
        {status === 'active' ? 'Active' : 'Suspended'}
    </span>
);

const BookieManagement = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const canManageBookies = getStoredAdmin()?.role === 'super_admin';
    const [bookies, setBookies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    
    // Modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showManageModal, setShowManageModal] = useState(false);
    const [selectedBookie, setSelectedBookie] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    
    // Form data - create: firstName, lastName, email, phone, password, confirmPassword; edit: same + optional password
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
        commissionPercentage: '',
        canManagePayments: false,
    });

    const [formLoading, setFormLoading] = useState(false);
    const [togglingId, setTogglingId] = useState(null);
    const [hasSecretDeclarePassword, setHasSecretDeclarePassword] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [secretPassword, setSecretPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [pendingBookie, setPendingBookie] = useState(null);
    const [pageTab, setPageTab] = useState('superBookies');
    const [allSubBookies, setAllSubBookies] = useState([]);
    const [allSubBookiesLoading, setAllSubBookiesLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [manageData, setManageData] = useState({
        commissionPercentage: '',
    });
    const closeCreateModal = useModalBackHandler(showCreateModal, () => setShowCreateModal(false));
    const closeEditModal = useModalBackHandler(showEditModal, () => setShowEditModal(false));
    const closeDeleteModal = useModalBackHandler(showDeleteModal, () => setShowDeleteModal(false));
    const closeManageModal = useModalBackHandler(showManageModal, () => setShowManageModal(false));
    const closePasswordModal = useModalBackHandler(showPasswordModal, () => {
        setShowPasswordModal(false);
        setPendingBookie(null);
        setSecretPassword('');
        setPasswordError('');
    });

    const PHONE_REGEX = /^[6-9]\d{9}$/;

    const openBookieDetail = (bookieId) => {
        navigate(`/bookie-management/${bookieId}`);
    };

    const parentSuperBookieName = (sb) => {
        const p = sb?.parentBookieId;
        if (!p) return '—';
        if (typeof p === 'object') return p.username || '—';
        const found = bookies.find((b) => String(b._id) === String(p));
        return found?.username || '—';
    };

    const parentSuperBookieId = (sb) => {
        const p = sb?.parentBookieId;
        if (!p) return null;
        return typeof p === 'object' ? p._id : p;
    };

    const matchesSearchAndStatus = (item, extraSearchFields = []) => {
        const q = searchTerm.trim().toLowerCase();
        const matchesSearch =
            !q
            || String(item.username || '').toLowerCase().includes(q)
            || String(item.phone || '').toLowerCase().includes(q)
            || String(item.email || '').toLowerCase().includes(q)
            || extraSearchFields.some((v) => String(v || '').toLowerCase().includes(q));
        const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
        return matchesSearch && matchesStatus;
    };

    const filteredBookies = bookies.filter((b) => matchesSearchAndStatus(b));

    const filteredSubBookies = allSubBookies.filter((sb) =>
        matchesSearchAndStatus(sb, [parentSuperBookieName(sb)]),
    );

    const superBookieStats = {
        total: bookies.length,
        active: bookies.filter((b) => b.status === 'active').length,
        suspended: bookies.filter((b) => b.status !== 'active').length,
    };

    const allBookieStats = {
        total: allSubBookies.length,
        active: allSubBookies.filter((b) => b.status === 'active').length,
        suspended: allSubBookies.filter((b) => b.status !== 'active').length,
    };

    const stats = pageTab === 'allBookies' ? allBookieStats : superBookieStats;

    // Fetch all bookies
    const fetchBookies = async (options = {}) => {
        const isSilent = options.silent === true;
        try {
            if (!isSilent) setLoading(true);
            const response = await fetchWithAuth(`${API_BASE_URL}/admin/bookies`);
            if (response.status === 401) return;
            const data = await response.json();
            if (data.success) {
                setBookies(data.data);
            } else {
                setError(data.message || 'Failed to fetch bookies');
            }
        } catch (err) {
            setError('Network error. Please check if the server is running.');
        } finally {
            if (!isSilent) setLoading(false);
        }
    };

    const fetchAllSubBookies = async (options = {}) => {
        const isSilent = options.silent === true;
        try {
            if (!isSilent) setAllSubBookiesLoading(true);
            const response = await fetchWithAuth(`${API_BASE_URL}/admin/super-bookies`);
            if (response.status === 401) return;
            const data = await response.json();
            if (data.success) {
                setAllSubBookies(data.data || []);
            } else if (!isSilent) {
                setError(data.message || `Failed to fetch ${SUB_LEVEL_LABEL_PLURAL.toLowerCase()}`);
            }
        } catch {
            if (!isSilent) setError('Network error. Please check if the server is running.');
        } finally {
            if (!isSilent) setAllSubBookiesLoading(false);
        }
    };

    useEffect(() => {
        fetchBookies();
        fetchAllSubBookies();
    }, []);

    useEffect(() => {
        if (location.pathname === '/bookie-management/all-bookies') {
            setPageTab('allBookies');
        } else if (location.pathname === '/bookie-management') {
            setPageTab('superBookies');
        }
    }, [location.pathname]);

    const openSubBookieCommission = (sb) => {
        const parentId = parentSuperBookieId(sb);
        if (parentId && sb._id) {
            navigate(`/bookie-management/${parentId}/bookie/${sb._id}/commission`);
        }
    };

    const openParentSuperBookie = (sb) => {
        const parentId = parentSuperBookieId(sb);
        if (parentId) openBookieDetail(parentId);
    };

    useEffect(() => {
        fetchWithAuth(`${API_BASE_URL}/admin/me/secret-declare-password-status`)
            .then((res) => { if (res.status === 401) return; return res.json(); })
            .then((json) => {
                if (json && json.success) setHasSecretDeclarePassword(json.hasSecretDeclarePassword || false);
            })
            .catch(() => setHasSecretDeclarePassword(false));
    }, []);

    // Handle form input change
    const handleChange = (e) => {
        const { name, value } = e.target;
        let processed = value;
        if (name === 'phone') processed = value.replace(/\D/g, '').slice(0, 10);
        if (name === 'commissionPercentage') {
            processed = value.replace(/[^0-9.]/g, '').slice(0, 6);
        }
        setFormData({ ...formData, [name]: processed });
        setError('');
    };

    // Create new bookie
    const handleCreate = async (e) => {
        e.preventDefault();
        setError('');
        const trimmedFirst = (formData.firstName || '').trim();
        const trimmedLast = (formData.lastName || '').trim();
        const username = `${trimmedFirst} ${trimmedLast}`.trim();
        if (!trimmedFirst || !trimmedLast) {
            setError('First name and last name are required');
            return;
        }
        if (!formData.phone || !formData.phone.trim()) {
            setError(`Phone number is required (${TOP_LEVEL_LABEL_PLURAL.toLowerCase()} log in with phone + password)`);
            return;
        }
        if (!PHONE_REGEX.test(formData.phone.replace(/\D/g, ''))) {
            setError('Please enter a valid 10-digit phone number (starting with 6–9)');
            return;
        }
        if (!formData.password || formData.password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        setFormLoading(true);
        try {
            const payload = {
                firstName: trimmedFirst,
                lastName: trimmedLast,
                username,
                email: formData.email.trim(),
                phone: formData.phone.replace(/\D/g, '').slice(0, 10),
                password: formData.password,
                commissionPercentage: formData.commissionPercentage ? Number(formData.commissionPercentage) : 0,
                canManagePayments: formData.canManagePayments || false,
            };
            const response = await fetchWithAuth(`${API_BASE_URL}/admin/bookies`, {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            if (response.status === 401) return;
            const data = await response.json();
            if (data.success) {
                const phoneNumber = formData.phone.replace(/\D/g, '').slice(0, 10);
                setSuccess(`${TOP_LEVEL_LABEL} account created successfully! Login with Phone: ${phoneNumber} and the password you set.`);
                setShowCreateModal(false);
                setFormData({
                    firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '',
                    commissionPercentage: '', canManagePayments: false,
                });
                fetchBookies();
                setTimeout(() => setSuccess(''), 10000); // Show for 10 seconds so user can note the credentials
            } else {
                setError(data.message || 'Failed to create bookie');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setFormLoading(false);
        }
    };

    // Update bookie
    const handleUpdate = async (e) => {
        e.preventDefault();
        setError('');
        const trimmedFirst = (formData.firstName || '').trim();
        const trimmedLast = (formData.lastName || '').trim();
        if (!trimmedFirst || !trimmedLast) {
            setError('First name and last name are required');
            return;
        }
        if (formData.phone && !PHONE_REGEX.test(formData.phone.replace(/\D/g, ''))) {
            setError('Please enter a valid 10-digit phone number (starting with 6–9)');
            return;
        }
        if (formData.password && formData.password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        setFormLoading(true);
        try {
            const updateData = {
                firstName: trimmedFirst,
                lastName: trimmedLast,
                email: formData.email.trim(),
                phone: formData.phone.replace(/\D/g, '').slice(0, 10) || formData.phone,
                commissionPercentage: formData.commissionPercentage !== '' ? Number(formData.commissionPercentage) : undefined,
                canManagePayments: formData.canManagePayments,
            };
            if (formData.password) updateData.password = formData.password;

            const response = await fetchWithAuth(`${API_BASE_URL}/admin/bookies/${selectedBookie._id}`, {
                method: 'PUT',
                body: JSON.stringify(updateData),
            });
            if (response.status === 401) return;
            const data = await response.json();
            if (data.success) {
                setSuccess(`${TOP_LEVEL_LABEL} updated successfully!`);
                setShowEditModal(false);
                setSelectedBookie(null);
                setFormData({
                    firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '',
                    commissionPercentage: '', canManagePayments: false,
                });
                fetchBookies();
                setTimeout(() => setSuccess(''), 3000);
            } else {
                setError(data.message || 'Failed to update bookie');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setFormLoading(false);
        }
    };

    // Delete bookie
    const handleDelete = async () => {
        if (!selectedBookie?._id) return;
        if (hasSecretDeclarePassword && !secretPassword.trim()) {
            setPasswordError('Please enter the secret declare password');
            return;
        }
        setError('');
        setPasswordError('');
        setFormLoading(true);

        try {
            const opts = { method: 'DELETE' };
            if (hasSecretDeclarePassword) opts.body = JSON.stringify({ secretDeclarePassword: secretPassword.trim() });
            const response = await fetchWithAuth(`${API_BASE_URL}/admin/bookies/${selectedBookie._id}`, opts);
            if (response.status === 401) return;
            const data = await response.json();

            if (data.success) {
                setSuccess(data.message || `${TOP_LEVEL_LABEL} deleted successfully!`);
                setShowDeleteModal(false);
                setSelectedBookie(null);
                setSecretPassword('');
                fetchBookies();
                fetchAllSubBookies({ silent: true });
                setTimeout(() => setSuccess(''), 5000);
            } else {
                if (data.code === 'INVALID_SECRET_DECLARE_PASSWORD') {
                    setPasswordError(data.message || 'Invalid secret password');
                } else {
                    setError(data.message || 'Failed to delete bookie');
                }
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setFormLoading(false);
        }
    };

    const performToggleStatus = async (bookie, secretDeclarePasswordValue) => {
        if (!bookie?._id) return;
        setTogglingId(bookie._id);
        setError('');
        setPasswordError('');
        try {
            const opts = { method: 'PATCH' };
            if (secretDeclarePasswordValue) opts.body = JSON.stringify({ secretDeclarePassword: secretDeclarePasswordValue });
            const response = await fetchWithAuth(`${API_BASE_URL}/admin/bookies/${bookie._id}/toggle-status`, opts);
            if (response.status === 401) return;
            const data = await response.json();
            if (data.success) {
                setShowPasswordModal(false);
                setPendingBookie(null);
                setSecretPassword('');
                setSuccess(`${TOP_LEVEL_LABEL} ${data.data.status === 'active' ? 'unsuspended' : 'suspended'} successfully!`);
                fetchBookies();
                setTimeout(() => setSuccess(''), 3000);
            } else {
                if (data.code === 'INVALID_SECRET_DECLARE_PASSWORD') {
                    setPasswordError(data.message || 'Invalid secret password');
                } else {
                    setError(data.message || 'Failed to toggle status');
                }
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setTogglingId(null);
        }
    };

    const handleToggleStatus = (bookie) => {
        if (!bookie?._id) return;
        if (hasSecretDeclarePassword) {
            setPendingBookie(bookie);
            setShowPasswordModal(true);
            setSecretPassword('');
            setPasswordError('');
        } else {
            performToggleStatus(bookie, '');
        }
    };

    const handlePasswordSubmit = (e) => {
        e.preventDefault();
        const val = secretPassword.trim();
        if (hasSecretDeclarePassword && !val) {
            setPasswordError('Please enter the secret declare password');
            return;
        }
        if (pendingBookie) performToggleStatus(pendingBookie, val);
    };

    // Open edit modal - split username "First Last" into firstName, lastName
    const openEditModal = (bookie) => {
        setSelectedBookie(bookie);
        const parts = (bookie.username || '').trim().split(/\s+/);
        const firstName = parts[0] || '';
        const lastName = parts.slice(1).join(' ') || '';
        setFormData({
            firstName,
            lastName,
            email: bookie.email || '',
            phone: bookie.phone || '',
            password: '',
            confirmPassword: '',
            commissionPercentage: bookie.commissionPercentage != null ? String(bookie.commissionPercentage) : '0',
            canManagePayments: bookie.canManagePayments || false,
        });
        setShowEditModal(true);
    };

    // Open delete modal
    const openDeleteModal = (bookie) => {
        setSelectedBookie(bookie);
        setSecretPassword('');
        setPasswordError('');
        setShowDeleteModal(true);
    };

    const openManageModal = (bookie) => {
        setSelectedBookie(bookie);
        setManageData({
            commissionPercentage: String(bookie.commissionPercentage ?? 0),
        });
        setShowManageModal(true);
    };

    const handleManageSave = async (e) => {
        e.preventDefault();
        if (!selectedBookie?._id) return;
        const commission = Number(manageData.commissionPercentage || 0);
        if (!Number.isFinite(commission) || commission < 0 || commission > 100) {
            setError('Total commission must be between 0 and 100');
            return;
        }

        setFormLoading(true);
        setError('');
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/admin/bookies/${selectedBookie._id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    firstName: String(selectedBookie.username || '').trim().split(/\s+/)[0] || selectedBookie.username,
                    lastName: String(selectedBookie.username || '').trim().split(/\s+/).slice(1).join(' '),
                    email: selectedBookie.email || '',
                    phone: selectedBookie.phone || '',
                    commissionPercentage: commission,
                    canManagePayments: Boolean(selectedBookie.canManagePayments),
                }),
            });
            if (response.status === 401) return;
            const data = await response.json();
            if (data.success) {
                setSuccess(`${TOP_LEVEL_LABEL} account updated successfully`);
                setShowManageModal(false);
                setSelectedBookie(null);
                fetchBookies();
                setTimeout(() => setSuccess(''), 3000);
            } else {
                setError(data.message || 'Failed to update bookie');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setFormLoading(false);
        }
    };

    const handleLogout = () => {
        clearAdminSession();
        navigate('/');
    };

    return (
        <AdminLayout onLogout={handleLogout} title={`${TOP_LEVEL_LABEL} Accounts`}>
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
                        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">{TOP_LEVEL_LABEL} Accounts</h1>
                        {canManageBookies && pageTab === 'superBookies' && (
                            <button
                                onClick={() => {
                                    setFormData({
                                        firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '',
                                        commissionPercentage: '', canManagePayments: false,
                                    });
                                    setShowCreateModal(true);
                                }}
                                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm"
                            >
                                <FaPlus /> Add {TOP_LEVEL_LABEL}
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
                            <p className="text-2xl font-bold text-slate-800 mt-1">{stats.total}</p>
                        </div>
                        <div className="bg-green-50 rounded-xl border border-green-100 p-4 shadow-sm">
                            <p className="text-xs uppercase tracking-wide text-green-700/80">Active</p>
                            <p className="text-2xl font-bold text-green-700 mt-1">{stats.active}</p>
                        </div>
                        <div className="bg-red-50 rounded-xl border border-red-100 p-4 shadow-sm">
                            <p className="text-xs uppercase tracking-wide text-red-700/80">Suspended</p>
                            <p className="text-2xl font-bold text-red-600 mt-1">{stats.suspended}</p>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-sm mb-4">
                        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-0.5">
                            {PAGE_TABS.map((tab) => {
                                const isActive = pageTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => {
                                            setPageTab(tab.id);
                                            setSearchTerm('');
                                            setStatusFilter('all');
                                            navigate(
                                                tab.id === 'allBookies'
                                                    ? '/bookie-management/all-bookies'
                                                    : '/bookie-management',
                                            );
                                        }}
                                        className={`px-2.5 py-1.5 rounded-lg text-xs sm:text-sm border whitespace-nowrap shrink-0 transition-colors ${
                                            isActive
                                                ? 'bg-orange-500 text-white border-orange-500'
                                                : 'bg-white text-slate-700 border-slate-200 hover:bg-orange-50'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                );
                            })}
                            <span className="hidden sm:inline w-px h-6 bg-slate-200 shrink-0" aria-hidden />
                            <FaSearch className="text-slate-400 shrink-0" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder={
                                    pageTab === 'allBookies'
                                        ? `Search ${SUB_LEVEL_LABEL.toLowerCase()} or ${TOP_LEVEL_LABEL.toLowerCase()}`
                                        : 'Search name, phone or email'
                                }
                                className="min-w-[10rem] sm:min-w-[14rem] flex-1 max-w-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-sm shrink-0 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                            />
                            <FaFilter className="text-slate-400 shrink-0 hidden sm:block" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs sm:text-sm shrink-0"
                            >
                                <option value="all">All status</option>
                                <option value="active">Active</option>
                                <option value="inactive">Suspended</option>
                            </select>
                        </div>
                    </div>

                    {/* Alerts */}
                    {error && (
                        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
                            {error}
                            <button onClick={() => setError('')} className="float-right">
                                <FaTimes />
                            </button>
                        </div>
                    )}

                    {success && (
                        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
                            {success}
                        </div>
                    )}

                    {/* Accounts list */}
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        {pageTab === 'superBookies' && loading ? (
                            <div className="p-8 text-center text-slate-500">Loading {TOP_LEVEL_LABEL_PLURAL.toLowerCase()}...</div>
                        ) : pageTab === 'allBookies' && allSubBookiesLoading ? (
                            <div className="p-8 text-center text-slate-500">Loading {SUB_LEVEL_LABEL_PLURAL.toLowerCase()}...</div>
                        ) : pageTab === 'allBookies' && filteredSubBookies.length === 0 ? (
                            <div className="p-8 text-center text-slate-500">No matching {SUB_LEVEL_LABEL.toLowerCase()} accounts found.</div>
                        ) : pageTab === 'superBookies' && filteredBookies.length === 0 ? (
                            <div className="p-8 text-center text-slate-500">
                                No matching {TOP_LEVEL_LABEL.toLowerCase()} accounts found.
                                {canManageBookies ? ` Add a new ${TOP_LEVEL_LABEL.toLowerCase()} to get started.` : ''}
                            </div>
                        ) : pageTab === 'superBookies' ? (
                            <>
                                <div className="hidden lg:block overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-200 bg-slate-50">
                                                <TableHeader label="Account" />
                                                <TableHeader label="Rate" align="right" />
                                                <TableHeader label="Commission" align="right" />
                                                <TableHeader label="Player payments" />
                                                <TableHeader label="Status" />
                                                <TableHeader label="Actions" />
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredBookies.map((bookie) => (
                                                <tr key={bookie._id} className="hover:bg-slate-50/80 align-middle">
                                                    <td className="px-4 py-3.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => openBookieDetail(bookie._id)}
                                                            className="font-semibold text-slate-800 hover:text-orange-600 text-left"
                                                        >
                                                            {bookie.username}
                                                        </button>
                                                        <p className="text-xs text-slate-500 mt-0.5">{bookie.phone || '—'}</p>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right font-medium tabular-nums">
                                                        {bookie.commissionPercentage ?? 0}%
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right font-medium tabular-nums text-orange-700">
                                                        {formatCurrency(bookie.totalCommissionAmount)}
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        <span className={bookie.canManagePayments ? 'text-green-700 font-medium' : 'text-slate-500'}>
                                                            {bookie.canManagePayments ? 'On' : 'Off'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        <StatusBadge status={bookie.status} />
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        <div className="flex flex-wrap gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => openBookieDetail(bookie._id)}
                                                                className="px-2 py-1 rounded-lg bg-orange-500 text-white text-xs font-medium hover:bg-orange-600"
                                                            >
                                                                View
                                                            </button>
                                                            {canManageBookies && (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openManageModal(bookie)}
                                                                        className="px-2 py-1 rounded-lg bg-slate-800 text-white text-xs font-medium hover:bg-slate-900"
                                                                    >
                                                                        Rate
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleToggleStatus(bookie)}
                                                                        disabled={togglingId === bookie._id}
                                                                        className={`px-2 py-1 rounded-lg text-xs font-medium disabled:opacity-50 ${
                                                                            bookie.status === 'active'
                                                                                ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                                                                                : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                                                                        }`}
                                                                    >
                                                                        {togglingId === bookie._id ? '…' : (bookie.status === 'active' ? 'Suspend' : 'Unsuspend')}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openEditModal(bookie)}
                                                                        className="px-2 py-1 rounded-lg border border-blue-200 text-blue-700 text-xs font-medium hover:bg-blue-50"
                                                                    >
                                                                        Edit
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openDeleteModal(bookie)}
                                                                        className="px-2 py-1 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50"
                                                                    >
                                                                        Delete
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="lg:hidden divide-y divide-slate-100">
                                    {filteredBookies.map((bookie) => (
                                        <div key={bookie._id} className="p-4">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <button
                                                        type="button"
                                                        onClick={() => openBookieDetail(bookie._id)}
                                                        className="font-semibold text-slate-800 hover:text-orange-600"
                                                    >
                                                        {bookie.username}
                                                    </button>
                                                    <p className="text-xs text-slate-500 mt-0.5">{bookie.phone || '—'}</p>
                                                </div>
                                                <StatusBadge status={bookie.status} />
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 mt-3 text-sm">
                                                <div>
                                                    <p className="text-[10px] uppercase text-slate-500">Rate</p>
                                                    <p className="font-semibold mt-0.5">{bookie.commissionPercentage ?? 0}%</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] uppercase text-slate-500">Commission</p>
                                                    <p className="font-semibold text-orange-700 mt-0.5 tabular-nums">{formatCurrency(bookie.totalCommissionAmount)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] uppercase text-slate-500">Payments</p>
                                                    <p className="font-semibold mt-0.5">{bookie.canManagePayments ? 'On' : 'Off'}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2 mt-3">
                                                <button type="button" onClick={() => openBookieDetail(bookie._id)} className="px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-medium">View</button>
                                                {canManageBookies && (
                                                    <>
                                                        <button type="button" onClick={() => openManageModal(bookie)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-medium">Rate</button>
                                                        <button type="button" onClick={() => openEditModal(bookie)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium">Edit</button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="hidden lg:block overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-200 bg-slate-50">
                                                <TableHeader label="Account" />
                                                <TableHeader label={TOP_LEVEL_LABEL} />
                                                <TableHeader label="Rate" align="right" />
                                                <TableHeader label="Players" align="right" />
                                                <TableHeader label="Status" />
                                                <TableHeader label="Actions" />
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredSubBookies.map((sb) => {
                                                const parentName = parentSuperBookieName(sb);
                                                const parentId = parentSuperBookieId(sb);
                                                return (
                                                    <tr key={sb._id} className="hover:bg-slate-50/80 align-middle">
                                                        <td className="px-4 py-3.5">
                                                            {parentId ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openSubBookieCommission(sb)}
                                                                    className="font-semibold text-slate-800 hover:text-orange-600 text-left"
                                                                >
                                                                    {sb.username}
                                                                </button>
                                                            ) : (
                                                                <p className="font-semibold text-slate-800">{sb.username}</p>
                                                            )}
                                                            <p className="text-xs text-slate-500 mt-0.5">{sb.phone || '—'}</p>
                                                        </td>
                                                        <td className="px-4 py-3.5">
                                                            {parentId ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openParentSuperBookie(sb)}
                                                                    className="text-sm text-orange-600 hover:underline font-medium"
                                                                >
                                                                    {parentName}
                                                                </button>
                                                            ) : (
                                                                <span className="text-slate-400">—</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3.5 text-right font-medium tabular-nums">
                                                            {sb.commissionPercentage ?? 0}%
                                                        </td>
                                                        <td className="px-4 py-3.5 text-right font-medium tabular-nums">
                                                            {sb.playerCount ?? 0}
                                                        </td>
                                                        <td className="px-4 py-3.5">
                                                            <StatusBadge status={sb.status} />
                                                        </td>
                                                        <td className="px-4 py-3.5">
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {parentId && (
                                                                    <>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => openSubBookieCommission(sb)}
                                                                            className="px-2 py-1 rounded-lg bg-orange-500 text-white text-xs font-medium hover:bg-orange-600"
                                                                        >
                                                                            View
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => openParentSuperBookie(sb)}
                                                                            className="px-2 py-1 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                                                        >
                                                                            {TOP_LEVEL_LABEL}
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="lg:hidden divide-y divide-slate-100">
                                    {filteredSubBookies.map((sb) => {
                                        const parentName = parentSuperBookieName(sb);
                                        const parentId = parentSuperBookieId(sb);
                                        return (
                                            <div key={sb._id} className="p-4">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <p className="font-semibold text-slate-800">{sb.username}</p>
                                                        <p className="text-xs text-slate-500 mt-0.5">{sb.phone || '—'}</p>
                                                        {parentId && (
                                                            <p className="text-xs text-orange-600 mt-1">{TOP_LEVEL_LABEL}: {parentName}</p>
                                                        )}
                                                    </div>
                                                    <StatusBadge status={sb.status} />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                                                    <div>
                                                        <p className="text-[10px] uppercase text-slate-500">Rate</p>
                                                        <p className="font-semibold mt-0.5">{sb.commissionPercentage ?? 0}%</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[10px] uppercase text-slate-500">Players</p>
                                                        <p className="font-semibold mt-0.5">{sb.playerCount ?? 0}</p>
                                                    </div>
                                                </div>
                                                {parentId && (
                                                    <div className="flex gap-2 mt-3">
                                                        <button type="button" onClick={() => openSubBookieCommission(sb)} className="px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-medium">View</button>
                                                        <button type="button" onClick={() => openParentSuperBookie(sb)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium">{TOP_LEVEL_LABEL}</button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-lg w-full max-w-md my-auto flex flex-col max-h-[90vh] shadow-xl">
                        <div className="flex justify-between items-center p-4 pb-0 shrink-0">
                            <h2 className="text-xl font-bold">Create New {TOP_LEVEL_LABEL}</h2>
                            <button onClick={closeCreateModal} className="text-gray-400 hover:text-gray-800">
                                <FaTimes size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="flex flex-col min-h-0 flex-1">
                            <div className="overflow-y-auto px-4 py-3 space-y-3 max-h-[calc(90vh-140px)]">
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-gray-600 text-sm font-medium mb-1">First Name *</label>
                                        <input
                                            type="text"
                                            name="firstName"
                                            value={formData.firstName}
                                            onChange={handleChange}
                                            className="w-full px-3 py-1.5 text-sm bg-gray-100 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            required
                                            placeholder="First name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-gray-600 text-sm font-medium mb-1">Last Name *</label>
                                        <input
                                            type="text"
                                            name="lastName"
                                            value={formData.lastName}
                                            onChange={handleChange}
                                            className="w-full px-3 py-1.5 text-sm bg-gray-100 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            required
                                            placeholder="Last name"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-gray-600 text-sm font-medium mb-1">Email</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="w-full px-3 py-1.5 text-sm bg-gray-100 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        placeholder="Optional"
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-600 text-sm font-medium mb-1">Phone Number *</label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        maxLength={10}
                                        className="w-full px-3 py-1.5 text-sm bg-gray-100 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        placeholder="10-digit (6–9 start)"
                                        required
                                    />
                                    <p className="mt-0.5 text-xs text-gray-500">{TOP_LEVEL_LABEL_PLURAL} log in with phone + password.</p>
                                </div>
                                <div>
                                    <label className="block text-gray-600 text-sm font-medium mb-1">Rate %</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            name="commissionPercentage"
                                            value={formData.commissionPercentage}
                                            onChange={handleChange}
                                            className="w-full px-3 py-1.5 text-sm bg-gray-100 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 pr-10"
                                            placeholder="0"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">%</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            name="canManagePayments"
                                            checked={formData.canManagePayments}
                                            onChange={(e) => setFormData({ ...formData, canManagePayments: e.target.checked })}
                                            className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                                        />
                                        <span className="text-gray-600 text-sm font-medium">Allow Payment Management</span>
                                    </label>
                                    <p className="mt-0.5 text-xs text-gray-500">Can approve/reject player payment requests</p>
                                </div>
                                <div>
                                    <label className="block text-gray-600 text-sm font-medium mb-1">Password *</label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            name="password"
                                            value={formData.password}
                                            onChange={handleChange}
                                            className="w-full px-3 py-1.5 text-sm bg-gray-100 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 pr-10"
                                            required
                                            minLength={6}
                                            placeholder="Min 6 characters"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-800"
                                        >
                                            {showPassword ? <FaEyeSlash /> : <FaEye />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-gray-600 text-sm font-medium mb-1">Confirm Password *</label>
                                    <input
                                        type="password"
                                        name="confirmPassword"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        className="w-full px-3 py-1.5 text-sm bg-gray-100 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        required
                                        placeholder="Re-enter password"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 p-4 pt-3 border-t border-gray-200 shrink-0">
                                    <button
                                        type="button"
                                        onClick={closeCreateModal}
                                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={formLoading}
                                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-gray-800 font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {formLoading ? 'Creating...' : `Create ${TOP_LEVEL_LABEL}`}
                                    </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-lg w-full max-w-md my-auto flex flex-col max-h-[90vh] shadow-xl">
                        <div className="flex justify-between items-center p-4 pb-0 shrink-0">
                            <h2 className="text-xl font-bold">Edit {TOP_LEVEL_LABEL}</h2>
                            <button onClick={closeEditModal} className="text-gray-400 hover:text-gray-800">
                                <FaTimes size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleUpdate} className="flex flex-col min-h-0 flex-1">
                            <div className="overflow-y-auto px-4 py-3 space-y-3 max-h-[calc(90vh-140px)]">
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-gray-600 text-sm font-medium mb-1">First Name *</label>
                                        <input
                                            type="text"
                                            name="firstName"
                                            value={formData.firstName}
                                            onChange={handleChange}
                                            className="w-full px-3 py-1.5 text-sm bg-gray-100 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-gray-600 text-sm font-medium mb-1">Last Name *</label>
                                        <input
                                            type="text"
                                            name="lastName"
                                            value={formData.lastName}
                                            onChange={handleChange}
                                            className="w-full px-3 py-1.5 text-sm bg-gray-100 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-gray-600 text-sm font-medium mb-1">Email</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="w-full px-3 py-1.5 text-sm bg-gray-100 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-600 text-sm font-medium mb-1">Phone Number *</label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        maxLength={10}
                                        className="w-full px-3 py-1.5 text-sm bg-gray-100 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        placeholder="10-digit (6–9 start)"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-600 text-sm font-medium mb-1">Rate %</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            name="commissionPercentage"
                                            value={formData.commissionPercentage}
                                            onChange={handleChange}
                                            className="w-full px-3 py-1.5 text-sm bg-gray-100 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 pr-10"
                                            placeholder="0"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">%</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            name="canManagePayments"
                                            checked={formData.canManagePayments}
                                            onChange={(e) => setFormData({ ...formData, canManagePayments: e.target.checked })}
                                            className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                                        />
                                        <span className="text-gray-600 text-sm font-medium">Allow Payment Management</span>
                                    </label>
                                    <p className="mt-0.5 text-xs text-gray-500">Can approve/reject player payment requests</p>
                                </div>
                                <div>
                                    <label className="block text-gray-600 text-sm font-medium mb-1">New Password (leave empty to keep)</label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            name="password"
                                            value={formData.password}
                                            onChange={handleChange}
                                            className="w-full px-3 py-1.5 text-sm bg-gray-100 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 pr-10"
                                            minLength={6}
                                            placeholder="Enter new password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-800"
                                        >
                                            {showPassword ? <FaEyeSlash /> : <FaEye />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3 p-4 pt-3 border-t border-gray-200 shrink-0">
                                    <button
                                        type="button"
                                        onClick={closeEditModal}
                                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={formLoading}
                                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-gray-800 font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {formLoading ? 'Updating...' : `Update ${TOP_LEVEL_LABEL}`}
                                    </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-red-500">Delete {TOP_LEVEL_LABEL}</h2>
                            <button onClick={closeDeleteModal} className="text-gray-400 hover:text-gray-800">
                                <FaTimes size={20} />
                            </button>
                        </div>
                        <p className="text-gray-600 mb-4">
                            Are you sure you want to delete the {TOP_LEVEL_LABEL.toLowerCase()} account <strong className="text-gray-800">"{selectedBookie?.username}"</strong>?
                        </p>
                        <p className="text-red-500 text-sm mb-4">
                            This action cannot be undone. All {SUB_LEVEL_LABEL_PLURAL.toLowerCase()} and players under this{' '}
                            {TOP_LEVEL_LABEL.toLowerCase()} will also be permanently deleted.
                        </p>
                        {hasSecretDeclarePassword && (
                            <div className="mb-4">
                                <label className="block text-gray-400 text-sm mb-2">Secret declare password *</label>
                                <input
                                    type="password"
                                    placeholder="Secret declare password"
                                    value={secretPassword}
                                    onChange={(e) => { setSecretPassword(e.target.value); setPasswordError(''); }}
                                    className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                                {passwordError && (
                                    <p className="text-red-500 text-sm mt-2">{passwordError}</p>
                                )}
                            </div>
                        )}
                        <div className="flex gap-3">
                            <button
                                onClick={closeDeleteModal}
                                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={formLoading || (hasSecretDeclarePassword && !secretPassword.trim())}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-gray-800 font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                            >
                                {formLoading ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Secret password modal for suspend/unsuspend bookie */}
            {showPasswordModal && pendingBookie && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-md">
                        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-orange-500">Confirm Suspend/Unsuspend {TOP_LEVEL_LABEL}</h3>
                            <button type="button" onClick={closePasswordModal} className="text-gray-400 hover:text-gray-800 p-1">×</button>
                        </div>
                        <form onSubmit={handlePasswordSubmit} className="p-4 space-y-4">
                            <p className="text-gray-600 text-sm">
                                Enter secret declare password to suspend/unsuspend this {TOP_LEVEL_LABEL.toLowerCase()}.
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

            {/* Quick Manage Modal */}
            {showManageModal && selectedBookie && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-lg w-full max-w-md my-auto shadow-xl">
                        <div className="flex justify-between items-center p-4 border-b border-gray-200">
                            <h2 className="text-xl font-bold flex items-center gap-2"><FaUsersCog /> Quick Manage {TOP_LEVEL_LABEL}</h2>
                            <button onClick={closeManageModal} className="text-gray-400 hover:text-gray-800"><FaTimes size={20} /></button>
                        </div>
                        <form onSubmit={handleManageSave} className="p-4 space-y-3">
                            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                                <p className="text-sm text-gray-500">{TOP_LEVEL_LABEL}</p>
                                <p className="font-semibold text-gray-800">{selectedBookie.username}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Rate %</label>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={manageData.commissionPercentage}
                                    onChange={(e) => setManageData((p) => ({ ...p, commissionPercentage: e.target.value.replace(/[^0-9.]/g, '').slice(0, 6) }))}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50"
                                />
                            </div>
                            <div className="flex gap-2 pt-1">
                                <button type="button" onClick={closeManageModal} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2 rounded-lg">Cancel</button>
                                <button type="submit" disabled={formLoading} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 rounded-lg disabled:opacity-50">
                                    {formLoading ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default BookieManagement;
