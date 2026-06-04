import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { FaPlus, FaEdit, FaToggleOn, FaToggleOff, FaTimes, FaEye, FaEyeSlash, FaUsersCog, FaWallet, FaCog, FaTrash } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL, fetchWithAuth } from '../utils/api';
import { PANEL_LABEL, PANEL_LABEL_PLURAL } from '../config/panelLabels';

const PHONE_REGEX = /^[6-9]\d{9}$/;

const Modal = ({ open, onClose, title, children }) => {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h3 className="text-lg font-bold text-[#1B3150]">{title}</h3>
                    <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
                        <FaTimes />
                    </button>
                </div>
                <div className="p-4">{children}</div>
            </div>
        </div>
    );
};

const SuperBookieManagement = () => {
    const navigate = useNavigate();
    const { bookie, updateBookie } = useAuth();
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showBalanceModal, setShowBalanceModal] = useState(false);
    const [showManageModal, setShowManageModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selected, setSelected] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [formLoading, setFormLoading] = useState(false);
    const [togglingId, setTogglingId] = useState(null);
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
        balance: '',
        commissionPercentage: '0',
        canManagePayments: false,
        initialBalancePaymentMode: 'advance_paid',
    });
    const [balanceForm, setBalanceForm] = useState({ operation: 'add', amount: '' });
    const [manageData, setManageData] = useState({ commissionPercentage: '0', operation: 'add', amount: '' });

    const fetchList = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            const res = await fetchWithAuth(`${API_BASE_URL}/bookie/super-bookies`);
            const data = await res.json();
            if (data.success) setList(data.data || []);
            else setError(data.message || `Failed to load ${PANEL_LABEL_PLURAL.toLowerCase()}`);
        } catch {
            setError('Network error');
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchList();
    }, []);

    const filtered = list.filter((sb) => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return true;
        return (
            String(sb.username || '').toLowerCase().includes(q) ||
            String(sb.phone || '').toLowerCase().includes(q)
        );
    });

    const stats = {
        total: list.length,
        active: list.filter((b) => b.status === 'active').length,
        players: list.reduce((s, b) => s + (b.playerCount || 0), 0),
    };

    const resetForm = () => {
        setFormData({
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            password: '',
            confirmPassword: '',
            balance: '',
            commissionPercentage: '0',
            canManagePayments: false,
            initialBalancePaymentMode: 'advance_paid',
        });
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        let v = value;
        if (name === 'phone') v = value.replace(/\D/g, '').slice(0, 10);
        if (name === 'balance') v = value.replace(/[^0-9.]/g, '');
        if (name === 'commissionPercentage') v = value.replace(/[^0-9.]/g, '').slice(0, 6);
        setFormData((prev) => ({ ...prev, [name]: v }));
        setError('');
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setError('');
        const first = formData.firstName.trim();
        const last = formData.lastName.trim();
        const phone = formData.phone.replace(/\D/g, '').slice(0, 10);
        if (!first || !last) return setError('First and last name required');
        if (!PHONE_REGEX.test(phone)) return setError('Valid 10-digit phone required');
        if (formData.password.length < 6) return setError('Password min 6 characters');
        if (formData.password !== formData.confirmPassword) return setError('Passwords do not match');
        const commissionPct =
            formData.commissionPercentage !== '' ? Number(formData.commissionPercentage) : 0;
        if (!Number.isFinite(commissionPct) || commissionPct < 0 || commissionPct > 100) {
            return setError('Commission must be between 0 and 100');
        }

        setFormLoading(true);
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/bookie/super-bookies`, {
                method: 'POST',
                body: JSON.stringify({
                    firstName: first,
                    lastName: last,
                    email: formData.email.trim(),
                    phone,
                    password: formData.password,
                    balance: formData.balance !== '' ? Math.max(0, Number(formData.balance)) : 0,
                    commissionPercentage:
                        formData.commissionPercentage !== ''
                            ? Number(formData.commissionPercentage)
                            : 0,
                    canManagePayments: Boolean(formData.canManagePayments),
                    initialBalancePaymentMode: formData.initialBalancePaymentMode,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setSuccess(data.message || `${PANEL_LABEL} created`);
                setShowCreateModal(false);
                resetForm();
                fetchList(true);
            } else setError(data.message || 'Create failed');
        } catch {
            setError('Network error');
        } finally {
            setFormLoading(false);
        }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        if (!selected) return;
        setFormLoading(true);
        try {
            const payload = {
                firstName: formData.firstName.trim(),
                lastName: formData.lastName.trim(),
                email: formData.email.trim(),
                phone: formData.phone.replace(/\D/g, '').slice(0, 10),
            };
            if (formData.password) payload.password = formData.password;
            if (formData.commissionPercentage !== '') {
                const commissionPct = Number(formData.commissionPercentage);
                if (!Number.isFinite(commissionPct) || commissionPct < 0 || commissionPct > 100) {
                    setError('Commission must be between 0 and 100');
                    setFormLoading(false);
                    return;
                }
                payload.commissionPercentage = commissionPct;
            }
            payload.canManagePayments = Boolean(formData.canManagePayments);
            const res = await fetchWithAuth(
                `${API_BASE_URL}/bookie/super-bookies/${selected._id}`,
                { method: 'PUT', body: JSON.stringify(payload) }
            );
            const data = await res.json();
            if (data.success) {
                setSuccess('Updated');
                setShowEditModal(false);
                fetchList(true);
            } else setError(data.message || 'Update failed');
        } catch {
            setError('Network error');
        } finally {
            setFormLoading(false);
        }
    };

    const handleToggle = async (sb) => {
        setTogglingId(sb._id);
        try {
            const res = await fetchWithAuth(
                `${API_BASE_URL}/bookie/super-bookies/${sb._id}/toggle-status`,
                { method: 'PATCH' }
            );
            const data = await res.json();
            if (data.success) fetchList(true);
            else setError(data.message || 'Failed');
        } finally {
            setTogglingId(null);
        }
    };

    const handleBalanceAdjust = async (e) => {
        e.preventDefault();
        const amount = Number(balanceForm.amount);
        if (!selected || !Number.isFinite(amount) || amount <= 0) {
            setError('Valid amount required');
            return;
        }
        setFormLoading(true);
        try {
            const res = await fetchWithAuth(
                `${API_BASE_URL}/bookie/super-bookies/${selected._id}/balance`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({ operation: balanceForm.operation, amount }),
                }
            );
            const data = await res.json();
            if (data.success) {
                setShowBalanceModal(false);
                setBalanceForm({ operation: 'add', amount: '' });
                fetchList(true);
            } else setError(data.message || 'Failed');
        } finally {
            setFormLoading(false);
        }
    };

    const openManageModal = (sb) => {
        setSelected(sb);
        setManageData({
            commissionPercentage: String(sb.commissionPercentage ?? 0),
            operation: 'add',
            amount: '',
        });
        setError('');
        setShowManageModal(true);
    };

    const handleManageSave = async (e) => {
        e.preventDefault();
        if (!selected) return;
        const commission = Number(manageData.commissionPercentage || 0);
        if (!Number.isFinite(commission) || commission < 0 || commission > 100) {
            setError('Commission must be between 0 and 100');
            return;
        }
        const amount = Number(manageData.amount || 0);
        setFormLoading(true);
        setError('');
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/bookie/super-bookies/${selected._id}`, {
                method: 'PUT',
                body: JSON.stringify({ commissionPercentage: commission }),
            });
            const data = await res.json();
            if (!data.success) {
                setError(data.message || 'Failed to update commission');
                return;
            }
            if (Number.isFinite(amount) && amount > 0) {
                const balRes = await fetchWithAuth(
                    `${API_BASE_URL}/bookie/super-bookies/${selected._id}/balance`,
                    {
                        method: 'PATCH',
                        body: JSON.stringify({ operation: manageData.operation, amount }),
                    }
                );
                const balData = await balRes.json();
                if (!balData.success) {
                    setError(balData.message || 'Commission saved but balance update failed');
                    return;
                }
            }
            setSuccess(`${PANEL_LABEL} updated`);
            setShowManageModal(false);
            fetchList(true);
        } catch {
            setError('Network error');
        } finally {
            setFormLoading(false);
        }
    };

    const openDelete = (sb) => {
        setSelected(sb);
        setError('');
        setShowDeleteModal(true);
    };

    const handleDelete = async () => {
        if (!selected) return;
        setDeletingId(selected._id);
        setError('');
        try {
            const res = await fetchWithAuth(
                `${API_BASE_URL}/bookie/super-bookies/${selected._id}`,
                { method: 'DELETE' }
            );
            const data = await res.json();
            if (data.success) {
                setSuccess(data.message || `${PANEL_LABEL} deleted`);
                setShowDeleteModal(false);
                setSelected(null);
                const returned = Number(data.data?.returnedBalance) || 0;
                if (returned > 0) {
                    updateBookie({ balance: Number(bookie?.balance || 0) + returned });
                }
                fetchList(true);
            } else {
                setError(data.message || 'Delete failed');
            }
        } catch {
            setError('Network error');
        } finally {
            setDeletingId(null);
        }
    };

    const openEdit = (sb) => {
        const parts = (sb.username || '').split(' ');
        setSelected(sb);
        setFormData({
            firstName: parts[0] || '',
            lastName: parts.slice(1).join(' ') || '',
            email: sb.email || '',
            phone: sb.phone || '',
            password: '',
            confirmPassword: '',
            balance: '',
            commissionPercentage: String(sb.commissionPercentage ?? 0),
            canManagePayments: Boolean(sb.canManagePayments),
        });
        setShowEditModal(true);
    };

    const formFields = (isEdit) => (
        <form onSubmit={isEdit ? handleUpdate : handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
                <input
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="First name"
                    className="border rounded-lg px-3 py-2 w-full"
                    required
                />
                <input
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Last name"
                    className="border rounded-lg px-3 py-2 w-full"
                    required
                />
            </div>
            <input
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Phone (login)"
                className="border rounded-lg px-3 py-2 w-full"
                required
            />
            <input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Email (optional)"
                className="border rounded-lg px-3 py-2 w-full"
            />
            <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-3 space-y-2">
                <p className="text-sm font-semibold text-[#1B3150]">Commission</p>
                <p className="text-xs text-gray-500">
                    {isEdit
                        ? `${PANEL_LABEL} earns this % on their players’ bets.`
                        : `Set commission % now — same as when you create a ${PANEL_LABEL.toLowerCase()} in admin.`}
                </p>
                <div>
                    <label htmlFor={isEdit ? 'sb-commission-edit' : 'sb-commission-create'} className="block text-sm font-medium text-gray-600 mb-1">
                        Commission %
                    </label>
                    <div className="relative">
                        <input
                            id={isEdit ? 'sb-commission-edit' : 'sb-commission-create'}
                            type="text"
                            inputMode="decimal"
                            name="commissionPercentage"
                            value={formData.commissionPercentage}
                            onChange={handleChange}
                            placeholder="0"
                            className="w-full border rounded-lg px-3 py-2 pr-10 bg-white"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-sm">%</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">0–100%. Default: 0%</p>
                </div>
            </div>
            <div className="rounded-xl border border-green-100 bg-green-50/50 p-3 space-y-2">
                <p className="text-sm font-semibold text-[#1B3150]">Payment Management</p>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                        type="checkbox"
                        name="canManagePayments"
                        checked={Boolean(formData.canManagePayments)}
                        onChange={(e) =>
                            setFormData((prev) => ({ ...prev, canManagePayments: e.target.checked }))
                        }
                        className="w-4 h-4"
                    />
                    Allow Payment Management
                </label>
                <p className="text-xs text-gray-500">Can approve/reject player payment requests</p>
            </div>
            {!isEdit && (
                <>
                    <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 space-y-2">
                        <p className="text-sm font-semibold text-[#1B3150]">
                            Initial balance payment type
                        </p>
                        <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                            <input
                                type="radio"
                                name="initialBalancePaymentMode"
                                value="advance_paid"
                                checked={formData.initialBalancePaymentMode === 'advance_paid'}
                                onChange={handleChange}
                                className="mt-0.5"
                            />
                            <span>
                                <span className="font-medium">Advance paid</span>
                                <span className="block text-xs text-gray-500">
                                    Adds to bookie balance — no advance recovery deduction
                                </span>
                            </span>
                        </label>
                        <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                            <input
                                type="radio"
                                name="initialBalancePaymentMode"
                                value="after_paid"
                                checked={formData.initialBalancePaymentMode === 'after_paid'}
                                onChange={handleChange}
                                className="mt-0.5"
                            />
                            <span>
                                <span className="font-medium">After paid</span>
                                <span className="block text-xs text-gray-500">
                                    Deducts from balance — advance recovered from bets before commission payout
                                </span>
                            </span>
                        </label>
                    </div>
                    <input
                        name="balance"
                        value={formData.balance}
                        onChange={handleChange}
                        placeholder="Initial balance (from your wallet)"
                        className="border rounded-lg px-3 py-2 w-full"
                    />
                </>
            )}
            <div className="relative">
                <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleChange}
                    placeholder={isEdit ? 'New password (optional)' : 'Password'}
                    className="border rounded-lg px-3 py-2 w-full pr-10"
                    {...(isEdit ? {} : { required: true })}
                />
                <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    onClick={() => setShowPassword(!showPassword)}
                >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
            </div>
            {!isEdit && (
                <input
                    name="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm password"
                    className="border rounded-lg px-3 py-2 w-full"
                    required
                />
            )}
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
                type="submit"
                disabled={formLoading}
                className="w-full py-2.5 rounded-xl bg-[#1B3150] text-white font-semibold disabled:opacity-50"
            >
                {formLoading ? 'Saving...' : isEdit ? 'Update' : `Create ${PANEL_LABEL}`}
            </button>
        </form>
    );

    return (
        <Layout title={PANEL_LABEL_PLURAL}>
            <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-[#1B3150] flex items-center gap-2">
                            <FaUsersCog /> {PANEL_LABEL_PLURAL}
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">
                            Create {PANEL_LABEL.toLowerCase()} accounts — they use the {PANEL_LABEL} Panel for players & stats.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link
                            to="/commission"
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#1B3150] text-[#1B3150] font-semibold text-sm"
                        >
                            Commission
                        </Link>
                        <button
                            type="button"
                            onClick={() => {
                                resetForm();
                                setError('');
                                setShowCreateModal(true);
                            }}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1B3150] text-white font-semibold"
                        >
                            <FaPlus /> Create {PANEL_LABEL}
                        </button>
                    </div>
                </div>

                {success && (
                    <div className="p-3 rounded-lg bg-green-50 text-green-800 text-sm">{success}</div>
                )}
                {error && !showCreateModal && !showEditModal && (
                    <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
                )}

                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white rounded-xl border p-4">
                        <p className="text-gray-500 text-xs">Total</p>
                        <p className="text-2xl font-bold text-[#1B3150]">{stats.total}</p>
                    </div>
                    <div className="bg-white rounded-xl border p-4">
                        <p className="text-gray-500 text-xs">Active</p>
                        <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                    </div>
                    <div className="bg-white rounded-xl border p-4">
                        <p className="text-gray-500 text-xs">Their players</p>
                        <p className="text-2xl font-bold text-blue-600">{stats.players}</p>
                    </div>
                </div>

                <input
                    type="search"
                    placeholder="Search name or phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full border rounded-xl px-4 py-2.5"
                />

                {loading ? (
                    <p className="text-center text-gray-500 py-8">Loading...</p>
                ) : (
                    <div className="bg-white rounded-xl border overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-left">
                                <tr>
                                    <th className="p-3">Name</th>
                                    <th className="p-3">Phone</th>
                                    <th className="p-3">Balance</th>
                                    <th className="p-3">Commission</th>
                                    <th className="p-3">Payment Mgmt</th>
                                    <th className="p-3">Players</th>
                                    <th className="p-3">Status</th>
                                    <th className="p-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-6 text-center text-gray-400">
                                            No {PANEL_LABEL_PLURAL.toLowerCase()} yet
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((sb) => (
                                        <tr
                                            key={sb._id}
                                            className="border-t cursor-pointer hover:bg-emerald-50/40"
                                            onClick={() => navigate(`/super-bookies/${sb._id}`)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    navigate(`/super-bookies/${sb._id}`);
                                                }
                                            }}
                                            role="button"
                                            tabIndex={0}
                                            title={`View all players for ${sb.username}`}
                                        >
                                            <td className="p-3 font-medium text-emerald-700 hover:underline">
                                                {sb.username}
                                            </td>
                                            <td className="p-3">{sb.phone}</td>
                                            <td className="p-3">₹{Number(sb.balance || 0).toLocaleString('en-IN')}</td>
                                            <td className="p-3 text-orange-600 font-medium">{sb.commissionPercentage ?? 0}%</td>
                                            <td className="p-3">
                                                <span className={`px-2 py-0.5 rounded-full text-xs ${
                                                    sb.canManagePayments
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                    {sb.canManagePayments ? 'Enabled' : 'Disabled'}
                                                </span>
                                            </td>
                                            <td className="p-3 text-emerald-700 font-medium">
                                                {sb.playerCount ?? 0}
                                                <span className="text-[10px] text-gray-400 block">View players →</span>
                                            </td>
                                            <td className="p-3">
                                                <span
                                                    className={`px-2 py-0.5 rounded-full text-xs ${
                                                        sb.status === 'active'
                                                            ? 'bg-green-100 text-green-700'
                                                            : 'bg-red-100 text-red-700'
                                                    }`}
                                                >
                                                    {sb.status}
                                                </span>
                                            </td>
                                            <td className="p-3" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex gap-2 flex-wrap">
                                                    <button
                                                        type="button"
                                                        onClick={() => navigate(`/super-bookies/${sb._id}`)}
                                                        className="px-2 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold"
                                                        title="View players & dashboard"
                                                    >
                                                        <FaEye className="inline mr-1" /> View
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => openManageModal(sb)}
                                                        className="px-2 py-1.5 rounded-lg bg-[#1B3150] text-white text-xs font-semibold"
                                                        title="Quick Manage Commission & Balance"
                                                    >
                                                        <FaCog className="inline mr-1" /> Manage
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => openEdit(sb)}
                                                        className="p-2 rounded-lg bg-blue-50 text-blue-600"
                                                        title="Edit"
                                                    >
                                                        <FaEdit />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelected(sb);
                                                            setShowBalanceModal(true);
                                                        }}
                                                        className="p-2 rounded-lg bg-amber-50 text-amber-700"
                                                        title="Balance"
                                                    >
                                                        <FaWallet />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={togglingId === sb._id}
                                                        onClick={() => handleToggle(sb)}
                                                        className="p-2 rounded-lg bg-gray-100"
                                                        title="Toggle status"
                                                    >
                                                        {sb.status === 'active' ? (
                                                            <FaToggleOn className="text-green-600" />
                                                        ) : (
                                                            <FaToggleOff className="text-gray-400" />
                                                        )}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => openDelete(sb)}
                                                        className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                                                        title={`Delete ${PANEL_LABEL.toLowerCase()}`}
                                                    >
                                                        <FaTrash />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title={`Create ${PANEL_LABEL}`}>
                {formFields(false)}
            </Modal>
            <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title={`Edit ${PANEL_LABEL}`}>
                {formFields(true)}
            </Modal>
            <Modal open={showManageModal} onClose={() => setShowManageModal(false)} title={`Quick Manage ${PANEL_LABEL}`}>
                <form onSubmit={handleManageSave} className="space-y-3">
                    {selected && (
                        <div className="rounded-lg bg-gray-50 border p-3 text-sm">
                            <p className="font-semibold text-[#1B3150]">{selected.username}</p>
                            <p className="text-gray-500 mt-1">
                                Balance: ₹{Number(selected.balance || 0).toLocaleString('en-IN')}
                            </p>
                            <p className="text-gray-500">
                                Total commission earned: ₹{Number(selected.totalCommissionAmount || 0).toLocaleString('en-IN')}
                            </p>
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Commission %</label>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={manageData.commissionPercentage}
                            onChange={(e) =>
                                setManageData((p) => ({
                                    ...p,
                                    commissionPercentage: e.target.value.replace(/[^0-9.]/g, '').slice(0, 6),
                                }))
                            }
                            className="w-full border rounded-lg px-3 py-2"
                        />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <select
                            value={manageData.operation}
                            onChange={(e) => setManageData((p) => ({ ...p, operation: e.target.value }))}
                            className="border rounded-lg px-2 py-2 text-sm"
                        >
                            <option value="add">Add balance</option>
                            <option value="deduct">Deduct balance</option>
                        </select>
                        <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Amount (optional)"
                            value={manageData.amount}
                            onChange={(e) =>
                                setManageData((p) => ({
                                    ...p,
                                    amount: e.target.value.replace(/[^0-9.]/g, '').slice(0, 16),
                                }))
                            }
                            className="col-span-2 border rounded-lg px-3 py-2"
                        />
                    </div>
                    {error && <p className="text-red-600 text-sm">{error}</p>}
                    <button
                        type="submit"
                        disabled={formLoading}
                        className="w-full py-2.5 rounded-xl bg-[#1B3150] text-white font-semibold disabled:opacity-50"
                    >
                        {formLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                </form>
            </Modal>
            <Modal open={showBalanceModal} onClose={() => setShowBalanceModal(false)} title="Adjust balance">
                <form onSubmit={handleBalanceAdjust} className="space-y-3">
                    <select
                        value={balanceForm.operation}
                        onChange={(e) => setBalanceForm({ ...balanceForm, operation: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2"
                    >
                        <option value="add">Add (from your balance)</option>
                        <option value="deduct">Deduct (return to your balance)</option>
                    </select>
                    <input
                        type="number"
                        min="0"
                        value={balanceForm.amount}
                        onChange={(e) => setBalanceForm({ ...balanceForm, amount: e.target.value })}
                        placeholder="Amount"
                        className="w-full border rounded-lg px-3 py-2"
                        required
                    />
                    {error && <p className="text-red-600 text-sm">{error}</p>}
                    <button
                        type="submit"
                        disabled={formLoading}
                        className="w-full py-2.5 rounded-xl bg-[#1B3150] text-white font-semibold"
                    >
                        Apply
                    </button>
                </form>
            </Modal>
            <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title={`Delete ${PANEL_LABEL}`}>
                {selected && (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-700">
                            Delete {PANEL_LABEL.toLowerCase()} <strong className="text-[#1B3150]">{selected.username}</strong>?
                        </p>
                        {Number(selected.playerCount || 0) > 0 ? (
                            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
                                This account has {selected.playerCount} linked player(s). Remove or reassign
                                players before deleting.
                            </p>
                        ) : (
                            <ul className="text-sm text-gray-500 list-disc pl-5 space-y-1">
                                <li>Login for this {PANEL_LABEL.toLowerCase()} will stop working.</li>
                                {Number(selected.balance || 0) > 0 && (
                                    <li>
                                        Remaining balance ₹{Number(selected.balance).toLocaleString('en-IN')} will
                                        return to your wallet.
                                    </li>
                                )}
                            </ul>
                        )}
                        {error && <p className="text-red-600 text-sm">{error}</p>}
                        <div className="flex gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowDeleteModal(false)}
                                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={deletingId === selected._id || Number(selected.playerCount || 0) > 0}
                                onClick={handleDelete}
                                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-semibold disabled:opacity-50"
                            >
                                {deletingId === selected._id ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </Layout>
    );
};

export default SuperBookieManagement;
