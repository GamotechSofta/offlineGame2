import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import { useNavigate } from 'react-router-dom';
import { FaEdit, FaTrash, FaToggleOn, FaToggleOff, FaPlus, FaTimes, FaEye, FaEyeSlash, FaCopy, FaPercent, FaSearch, FaWallet, FaUsersCog } from 'react-icons/fa';
import useModalBackHandler from '../hooks/useModalBackHandler';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';
import { getAuthHeaders, clearAdminSession, fetchWithAuth, getStoredAdmin } from '../lib/auth';

const BookieManagement = () => {
    const navigate = useNavigate();
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
        balance: '',
    });

    const [formLoading, setFormLoading] = useState(false);
    const [togglingId, setTogglingId] = useState(null);
    const [hasSecretDeclarePassword, setHasSecretDeclarePassword] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [secretPassword, setSecretPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [pendingBookie, setPendingBookie] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [manageData, setManageData] = useState({
        commissionPercentage: '',
        operation: 'add',
        amount: '',
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

    const filteredBookies = bookies.filter((b) => {
        const q = searchTerm.trim().toLowerCase();
        const matchesSearch =
            !q ||
            String(b.username || '').toLowerCase().includes(q) ||
            String(b.phone || '').toLowerCase().includes(q) ||
            String(b.email || '').toLowerCase().includes(q);
        const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const stats = {
        total: bookies.length,
        active: bookies.filter((b) => b.status === 'active').length,
        suspended: bookies.filter((b) => b.status !== 'active').length,
        totalBalance: bookies.reduce((sum, b) => sum + (Number(b.balance) || 0), 0),
        totalCommission: bookies.reduce((sum, b) => sum + (Number(b.totalCommissionAmount) || 0), 0),
    };

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

    useEffect(() => {
        fetchBookies();
    }, []);

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
        if (name === 'commissionPercentage') processed = value.replace(/[^0-9.]/g, '').slice(0, 6);
        if (name === 'balance') processed = value.replace(/[^0-9.]/g, '').slice(0, 16);
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
            setError('Phone number is required (bookies log in with phone + password)');
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
                balance: formData.balance !== '' ? Math.max(0, Number(formData.balance)) : 0,
            };
            const response = await fetchWithAuth(`${API_BASE_URL}/admin/bookies`, {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            if (response.status === 401) return;
            const data = await response.json();
            if (data.success) {
                const phoneNumber = formData.phone.replace(/\D/g, '').slice(0, 10);
                setSuccess(`Bookie account created successfully! Login with Phone: ${phoneNumber} and the password you set.`);
                setShowCreateModal(false);
                setFormData({ firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '', commissionPercentage: '', canManagePayments: false, balance: '' });
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
                balance: formData.balance !== '' ? Math.max(0, Number(formData.balance)) : undefined,
            };
            if (formData.password) updateData.password = formData.password;

            const response = await fetchWithAuth(`${API_BASE_URL}/admin/bookies/${selectedBookie._id}`, {
                method: 'PUT',
                body: JSON.stringify(updateData),
            });
            if (response.status === 401) return;
            const data = await response.json();
            if (data.success) {
                setSuccess('Bookie updated successfully!');
                setShowEditModal(false);
                setSelectedBookie(null);
                setFormData({ firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '', commissionPercentage: '', canManagePayments: false, balance: '' });
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
                setSuccess('Bookie deleted successfully!');
                setShowDeleteModal(false);
                setSelectedBookie(null);
                setSecretPassword('');
                fetchBookies();
                setTimeout(() => setSuccess(''), 3000);
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
                setSuccess(`Bookie ${data.data.status === 'active' ? 'unsuspended' : 'suspended'} successfully!`);
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
            balance: bookie.balance != null ? String(bookie.balance) : '0',
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
            operation: 'add',
            amount: '',
        });
        setShowManageModal(true);
    };

    const handleManageSave = async (e) => {
        e.preventDefault();
        if (!selectedBookie?._id) return;
        const currentBalance = Number(selectedBookie.balance) || 0;
        const amount = Number(manageData.amount || 0);
        const commission = Number(manageData.commissionPercentage || 0);
        if (!Number.isFinite(commission) || commission < 0 || commission > 100) {
            setError('Commission must be between 0 and 100');
            return;
        }
        if (!Number.isFinite(amount) || amount < 0) {
            setError('Amount must be a non-negative number');
            return;
        }

        const newBalance =
            manageData.operation === 'subtract'
                ? Math.max(0, currentBalance - amount)
                : currentBalance + amount;

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
                    balance: newBalance,
                }),
            });
            if (response.status === 401) return;
            const data = await response.json();
            if (data.success) {
                setSuccess('Bookie account updated successfully');
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

    // Copy to clipboard
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setSuccess('Copied to clipboard!');
        setTimeout(() => setSuccess(''), 2000);
    };

    const handleLogout = () => {
        clearAdminSession();
        navigate('/');
    };

    return (
        <AdminLayout onLogout={handleLogout} title="Bookie Accounts">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4 sm:mb-6">
                        <h1 className="text-2xl sm:text-3xl font-bold">Bookie Accounts Management</h1>
                        {canManageBookies && (
                            <button
                                onClick={() => {
                                    setFormData({ firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '', commissionPercentage: '', canManagePayments: false, balance: '' });
                                    setShowCreateModal(true);
                                }}
                                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-gray-800 font-bold py-2.5 px-4 rounded-lg transition-colors text-sm sm:text-base"
                            >
                                <FaPlus /> Add New Bookie
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
                        <div className="bg-white rounded-lg border border-gray-200 p-3">
                            <p className="text-xs text-gray-500">Total Bookies</p>
                            <p className="text-xl font-bold text-gray-800">{stats.total}</p>
                        </div>
                        <div className="bg-white rounded-lg border border-gray-200 p-3">
                            <p className="text-xs text-gray-500">Active</p>
                            <p className="text-xl font-bold text-green-600">{stats.active}</p>
                        </div>
                        <div className="bg-white rounded-lg border border-gray-200 p-3">
                            <p className="text-xs text-gray-500">Suspended</p>
                            <p className="text-xl font-bold text-red-500">{stats.suspended}</p>
                        </div>
                        <div className="bg-white rounded-lg border border-gray-200 p-3">
                            <p className="text-xs text-gray-500">Total Bookie Balance</p>
                            <p className="text-xl font-bold text-[#1B3150]">₹{Math.floor(stats.totalBalance).toLocaleString('en-IN')}</p>
                        </div>
                        <div className="bg-white rounded-lg border border-gray-200 p-3">
                            <p className="text-xs text-gray-500">Total Commission (All Bookies)</p>
                            <p className="text-xl font-bold text-orange-600">₹{stats.totalCommission.toLocaleString('en-IN')}</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4 flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search by name, phone or email"
                                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm"
                            />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm"
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="inactive">Suspended</option>
                        </select>
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

                    {/* Bookies List */}
                    <div className="bg-white rounded-lg overflow-hidden">
                        {loading ? (
                            <div className="p-8 text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
                                <p className="mt-4 text-gray-400">Loading bookies...</p>
                            </div>
                        ) : filteredBookies.length === 0 ? (
                            <div className="p-8 text-center text-gray-400">
                                <p>No matching bookie accounts found.</p>
                                <p className="mt-2">
                                    {canManageBookies
                                        ? 'Try changing search/filter or add a new bookie.'
                                        : 'Try changing search or filter.'}
                                </p>
                            </div>
                        ) : (
                            <div className="p-3 sm:p-4 grid grid-cols-1 xl:grid-cols-2 gap-3">
                                {filteredBookies.map((bookie, index) => (
                                    <div key={bookie._id} className="rounded-xl border border-gray-200 p-4 bg-white shadow-sm">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-gray-500">#{index + 1}</span>
                                                    <h3 className="font-semibold text-gray-800 truncate">{bookie.username}</h3>
                                                    <button
                                                        onClick={() => copyToClipboard(bookie.username)}
                                                        className="text-gray-400 hover:text-orange-500"
                                                        title="Copy name"
                                                    >
                                                        <FaCopy size={13} />
                                                    </button>
                                                </div>
                                                <p className="text-sm text-gray-500 mt-0.5 truncate">{bookie.email || 'No email'}</p>
                                                <p className="text-sm text-gray-600">{bookie.phone || '-'}</p>
                                            </div>
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                                bookie.status === 'active'
                                                    ? 'bg-green-100 text-green-700 border border-green-200'
                                                    : 'bg-red-50 text-red-500 border border-red-200'
                                            }`}>
                                                {bookie.status === 'active' ? 'Active' : 'Suspended'}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 mt-3">
                                            <div className="rounded-lg bg-gray-50 border border-gray-200 p-2.5">
                                                <p className="text-[11px] text-gray-500">Commission</p>
                                                <p className="font-semibold text-orange-600 mt-0.5">{bookie.commissionPercentage ?? 0}%</p>
                                            </div>
                                            <div className="rounded-lg bg-gray-50 border border-gray-200 p-2.5">
                                                <p className="text-[11px] text-gray-500">Balance</p>
                                                <p className="font-semibold text-green-600 mt-0.5">₹{Math.floor(Number(bookie.balance ?? 0)).toLocaleString('en-IN')}</p>
                                            </div>
                                            <div className="rounded-lg bg-gray-50 border border-gray-200 p-2.5">
                                                <p className="text-[11px] text-gray-500">Total Commission Amount</p>
                                                <p className="font-semibold text-[#1B3150] mt-0.5">₹{(bookie.totalCommissionAmount ?? 0).toLocaleString('en-IN')}</p>
                                            </div>
                                            <div className="rounded-lg bg-gray-50 border border-gray-200 p-2.5 col-span-2">
                                                <p className="text-[11px] text-gray-500">Payment Management</p>
                                                <p className={`font-semibold mt-0.5 ${bookie.canManagePayments ? 'text-green-600' : 'text-gray-600'}`}>
                                                    {bookie.canManagePayments ? 'Enabled' : 'Disabled'}
                                                </p>
                                            </div>
                                        </div>

                                        {canManageBookies && (
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            <button
                                                onClick={() => openManageModal(bookie)}
                                                className="px-3 py-2 rounded-lg bg-[#1B3150] text-white text-xs font-semibold hover:bg-[#152842]"
                                                title="Quick Manage Balance & Commission"
                                            >
                                                Quick Manage
                                            </button>
                                            <button
                                                onClick={() => handleToggleStatus(bookie)}
                                                disabled={togglingId === bookie._id}
                                                className={`px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50 ${
                                                    bookie.status === 'active'
                                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                        : 'bg-green-50 text-green-700 border border-green-200'
                                                }`}
                                            >
                                                {togglingId === bookie._id ? 'Please wait...' : (bookie.status === 'active' ? 'Suspend' : 'Unsuspend')}
                                            </button>
                                            <button
                                                onClick={() => openEditModal(bookie)}
                                                className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => openDeleteModal(bookie)}
                                                className="px-3 py-2 rounded-lg bg-red-50 text-red-600 border border-red-200 text-xs font-semibold"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Info Card */}
                    <div className="mt-4 sm:mt-6 bg-white rounded-lg p-4 sm:p-6">
                        <h3 className="text-base sm:text-lg font-semibold text-orange-500 mb-3">Bookie Login Information</h3>
                        <div className="text-gray-600 space-y-2 text-sm sm:text-base">
                            <p><strong>Bookie Panel URL:</strong> <code className="bg-gray-100 px-2 py-1 rounded">/bookie</code></p>
                            <p><strong>Login:</strong> Bookies use their Phone number and the password you set.</p>
                            <p><strong>Status:</strong> Suspended bookies cannot login to the bookie panel.</p>
                        </div>
                    </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-lg w-full max-w-md my-auto flex flex-col max-h-[90vh] shadow-xl">
                        <div className="flex justify-between items-center p-4 pb-0 shrink-0">
                            <h2 className="text-xl font-bold">Create New Bookie</h2>
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
                                    <p className="mt-0.5 text-xs text-gray-500">Bookies log in with phone + password.</p>
                                </div>
                                <div>
                                    <label className="block text-gray-600 text-sm font-medium mb-1">Commission %</label>
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
                                    <p className="mt-0.5 text-xs text-gray-500">0–100%. Default: 0%</p>
                                </div>
                                <div>
                                    <label className="block text-gray-600 text-sm font-medium mb-1">Initial Balance (₹)</label>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        name="balance"
                                        value={formData.balance}
                                        onChange={handleChange}
                                        className="w-full px-3 py-1.5 text-sm bg-gray-100 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        placeholder="0"
                                    />
                                    <p className="mt-0.5 text-xs text-gray-500">Deducted when bookie gives balance to players.</p>
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
                                        {formLoading ? 'Creating...' : 'Create Bookie'}
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
                            <h2 className="text-xl font-bold">Edit Bookie</h2>
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
                                    <label className="block text-gray-600 text-sm font-medium mb-1">Commission %</label>
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
                                    <p className="mt-0.5 text-xs text-gray-500">0–100%</p>
                                </div>
                                <div>
                                    <label className="block text-gray-600 text-sm font-medium mb-1">Balance (₹)</label>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        name="balance"
                                        value={formData.balance}
                                        onChange={handleChange}
                                        className="w-full px-3 py-1.5 text-sm bg-gray-100 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        placeholder="0"
                                    />
                                    <p className="mt-0.5 text-xs text-gray-500">Deducted when bookie gives balance to players.</p>
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
                                        {formLoading ? 'Updating...' : 'Update Bookie'}
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
                            <h2 className="text-xl font-bold text-red-500">Delete Bookie</h2>
                            <button onClick={closeDeleteModal} className="text-gray-400 hover:text-gray-800">
                                <FaTimes size={20} />
                            </button>
                        </div>
                        <p className="text-gray-600 mb-4">
                            Are you sure you want to delete the bookie account <strong className="text-gray-800">"{selectedBookie?.username}"</strong>?
                        </p>
                        <p className="text-red-500 text-sm mb-4">
                            This action cannot be undone. The bookie will lose access to their account permanently.
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
                            <h3 className="text-lg font-semibold text-orange-500">Confirm Suspend/Unsuspend Bookie</h3>
                            <button type="button" onClick={closePasswordModal} className="text-gray-400 hover:text-gray-800 p-1">×</button>
                        </div>
                        <form onSubmit={handlePasswordSubmit} className="p-4 space-y-4">
                            <p className="text-gray-600 text-sm">
                                Enter secret declare password to suspend/unsuspend this bookie.
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
                            <h2 className="text-xl font-bold flex items-center gap-2"><FaUsersCog /> Quick Manage Bookie</h2>
                            <button onClick={closeManageModal} className="text-gray-400 hover:text-gray-800"><FaTimes size={20} /></button>
                        </div>
                        <form onSubmit={handleManageSave} className="p-4 space-y-3">
                            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                                <p className="text-sm text-gray-500">Bookie</p>
                                <p className="font-semibold text-gray-800">{selectedBookie.username}</p>
                                <p className="text-sm text-gray-500 mt-1">Current Balance: <span className="font-semibold text-green-600">₹{Number(selectedBookie.balance || 0).toLocaleString('en-IN')}</span></p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Commission %</label>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={manageData.commissionPercentage}
                                    onChange={(e) => setManageData((p) => ({ ...p, commissionPercentage: e.target.value.replace(/[^0-9.]/g, '').slice(0, 6) }))}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50"
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <select
                                    value={manageData.operation}
                                    onChange={(e) => setManageData((p) => ({ ...p, operation: e.target.value }))}
                                    className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm"
                                >
                                    <option value="add">Add</option>
                                    <option value="subtract">Subtract</option>
                                </select>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="Amount"
                                    value={manageData.amount}
                                    onChange={(e) => setManageData((p) => ({ ...p, amount: e.target.value.replace(/[^0-9.]/g, '').slice(0, 16) }))}
                                    className="col-span-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50"
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
