import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import { useNavigate } from 'react-router-dom';
import { FaEdit, FaTrash, FaToggleOn, FaToggleOff, FaPlus, FaTimes, FaEye, FaEyeSlash, FaCopy, FaPercent } from 'react-icons/fa';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';
import { getAuthHeaders, clearAdminSession } from '../lib/auth';

const BookieManagement = () => {
    const navigate = useNavigate();
    const [bookies, setBookies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    
    // Modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
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

    const PHONE_REGEX = /^[6-9]\d{9}$/;

    // Fetch all bookies
    const fetchBookies = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/admin/bookies`, {
                headers: getAuthHeaders(),
            });
            const data = await response.json();
            if (data.success) {
                setBookies(data.data);
            } else {
                setError(data.message || 'Failed to fetch bookies');
            }
        } catch (err) {
            setError('Network error. Please check if the server is running.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBookies();
    }, []);

    useEffect(() => {
        fetch(`${API_BASE_URL}/admin/me/secret-declare-password-status`, { headers: getAuthHeaders() })
            .then((res) => res.json())
            .then((json) => {
                if (json.success) setHasSecretDeclarePassword(json.hasSecretDeclarePassword || false);
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
            console.log('[BookieManagement] Creating bookie with payload:', JSON.stringify(payload, null, 2));
            const response = await fetch(`${API_BASE_URL}/admin/bookies`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (data.success) {
                const phoneNumber = formData.phone.replace(/\D/g, '').slice(0, 10);
                setSuccess(`Bookie account created successfully! Login credentials - Phone: ${phoneNumber}, Password: ${formData.password}`);
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
            console.log('[BookieManagement] Updating bookie with data:', JSON.stringify(updateData, null, 2));

            const response = await fetch(`${API_BASE_URL}/admin/bookies/${selectedBookie._id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(updateData),
            });
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
            const opts = { method: 'DELETE', headers: getAuthHeaders() };
            if (hasSecretDeclarePassword) opts.body = JSON.stringify({ secretDeclarePassword: secretPassword.trim() });
            const response = await fetch(`${API_BASE_URL}/admin/bookies/${selectedBookie._id}`, opts);
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
            const opts = { method: 'PATCH', headers: getAuthHeaders() };
            if (secretDeclarePasswordValue) opts.body = JSON.stringify({ secretDeclarePassword: secretDeclarePasswordValue });
            const response = await fetch(`${API_BASE_URL}/admin/bookies/${bookie._id}/toggle-status`, opts);
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
                        <button
                            onClick={() => {
                                setFormData({ firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '', commissionPercentage: '', canManagePayments: false, balance: '' });
                                setShowCreateModal(true);
                            }}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-gray-800 font-bold py-2.5 px-4 rounded-lg transition-colors text-sm sm:text-base"
                        >
                            <FaPlus /> Add New Bookie
                        </button>
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

                    {/* Bookies Table */}
                    <div className="bg-white rounded-lg overflow-hidden">
                        {loading ? (
                            <div className="p-8 text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
                                <p className="mt-4 text-gray-400">Loading bookies...</p>
                            </div>
                        ) : bookies.length === 0 ? (
                            <div className="p-8 text-center text-gray-400">
                                <p>No bookie accounts found.</p>
                                <p className="mt-2">Click "Add New Bookie" to create one.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                            <table className="w-full min-w-[640px] text-sm sm:text-base">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                            #
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                            Name
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                            Email
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                            Phone
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                            Commission
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                            Balance
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                            Payment Management
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                            Status
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                            Created At
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {bookies.map((bookie, index) => (
                                        <tr key={bookie._id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                                                {index + 1}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-gray-800">{bookie.username}</span>
                                                    <button
                                                        onClick={() => copyToClipboard(bookie.username)}
                                                        className="text-gray-400 hover:text-orange-500"
                                                        title="Copy name"
                                                    >
                                                        <FaCopy size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                                                {bookie.email || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                                                {bookie.phone || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-600 border border-orange-200">
                                                    <FaPercent className="w-2.5 h-2.5" />
                                                    {bookie.commissionPercentage ?? 0}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="font-semibold text-green-600">
                                                    ₹{(bookie.balance ?? 0).toLocaleString('en-IN')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                                    bookie.canManagePayments 
                                                        ? 'bg-green-100 text-green-700 border border-green-200' 
                                                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                                                }`}>
                                                    {bookie.canManagePayments ? 'Enabled' : 'Disabled'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                                    bookie.status === 'active' 
                                                        ? 'bg-green-100 text-green-700 border border-green-200' 
                                                        : 'bg-red-50 text-red-500 border border-red-200'
                                                }`}>
                                                    {bookie.status === 'active' ? 'Active' : 'Suspended'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                                                {new Date(bookie.createdAt).toLocaleDateString('en-IN', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    year: 'numeric',
                                                })}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleToggleStatus(bookie)}
                                                        disabled={togglingId === bookie._id}
                                                        className={`p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                                            bookie.status === 'active'
                                                                ? 'bg-green-900/30 text-green-600 hover:bg-green-900/50'
                                                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                                        }`}
                                                        title={bookie.status === 'active' ? 'Suspend' : 'Unsuspend'}
                                                    >
                                                        {togglingId === bookie._id ? (
                                                            <span className="animate-spin inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full" />
                                                        ) : bookie.status === 'active' ? (
                                                            <FaToggleOn size={18} />
                                                        ) : (
                                                            <FaToggleOff size={18} />
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => openEditModal(bookie)}
                                                        className="p-2 rounded-lg bg-blue-900/30 text-blue-600 hover:bg-blue-900/50 transition-colors"
                                                        title="Edit"
                                                    >
                                                        <FaEdit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => openDeleteModal(bookie)}
                                                        className="p-2 rounded-lg bg-red-900/30 text-red-500 hover:bg-red-50 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <FaTrash size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
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
                            <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-800">
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
                                        onClick={() => setShowCreateModal(false)}
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
                            <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-800">
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
                                        onClick={() => setShowEditModal(false)}
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
                            <button onClick={() => setShowDeleteModal(false)} className="text-gray-400 hover:text-gray-800">
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
                                onClick={() => setShowDeleteModal(false)}
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
                            <button type="button" onClick={() => { setShowPasswordModal(false); setPendingBookie(null); setSecretPassword(''); setPasswordError(''); }} className="text-gray-400 hover:text-gray-800 p-1">×</button>
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
                                <button type="button" onClick={() => { setShowPasswordModal(false); setPendingBookie(null); setSecretPassword(''); setPasswordError(''); }} className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-500 text-gray-800 font-semibold">Cancel</button>
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

export default BookieManagement;
