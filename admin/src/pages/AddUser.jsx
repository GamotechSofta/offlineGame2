import React, { useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { useNavigate, Link } from 'react-router-dom';
import { FaArrowLeft, FaUserPlus, FaUser } from 'react-icons/fa';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';
import { getAuthHeaders, clearAdminSession } from '../lib/auth';

const PHONE_REGEX = /^[6-9]\d{9}$/;

const AddUser = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
        role: 'user',
        balance: '', // empty = 0 on submit; user can clear field
        commissionPercentage: '', // For bookie creation
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [createdPlayers, setCreatedPlayers] = useState([]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        let processedValue = value;
        if (name === 'phone') {
            processedValue = value.replace(/\D/g, '').slice(0, 10);
        }
        setFormData({
            ...formData,
            [name]: processedValue,
        });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        const trimmedFirst = (formData.firstName || '').trim();
        const trimmedLast = (formData.lastName || '').trim();
        const username = `${trimmedFirst} ${trimmedLast}`.trim();

        if (!trimmedFirst || !trimmedLast) {
            setError('First name and last name are required');
            return;
        }
        if (!formData.email?.trim()) {
            setError('Email is required');
            return;
        }
        if (!formData.phone?.trim()) {
            setError('Phone number is required (players log in with phone + password)');
            return;
        }
        if (!PHONE_REGEX.test(formData.phone.replace(/\D/g, ''))) {
            setError('Please enter a valid 10-digit phone number (starting with 6–9)');
            return;
        }
        if (!formData.password) {
            setError('Password is required');
            return;
        }
        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);

        try {
            // If role is 'bookie', create bookie account (Admin collection), otherwise create player (User collection)
            if (formData.role === 'bookie') {
                const payload = {
                    firstName: trimmedFirst,
                    lastName: trimmedLast,
                    username,
                    email: formData.email.trim(),
                    phone: formData.phone.replace(/\D/g, '').slice(0, 10),
                    password: formData.password,
                    commissionPercentage: formData.commissionPercentage ? Number(formData.commissionPercentage) : 0,
                };
                const response = await fetch(`${API_BASE_URL}/admin/bookies`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(payload),
                });

                const data = await response.json();
                if (data.success) {
                    const phoneNumber = formData.phone.replace(/\D/g, '').slice(0, 10);
                    setSuccess(`Bookie account created successfully! Login credentials - Phone: ${phoneNumber}, Password: ${formData.password}`);
                    setFormData({
                        firstName: '',
                        lastName: '',
                        email: '',
                        phone: '',
                        password: '',
                        confirmPassword: '',
                        role: 'user',
                        balance: '',
                        commissionPercentage: '',
                    });
                    setCreatedPlayers((prev) => [
                        {
                            id: data.data?.id,
                            username: data.data?.username ?? username,
                            email: data.data?.email ?? formData.email,
                            phone: data.data?.phone ?? phoneNumber,
                            role: 'bookie',
                            createdAt: new Date(),
                        },
                        ...prev,
                    ].slice(0, 20));
                } else {
                    setError(data.message || 'Failed to create bookie');
                }
            } else {
                // Create regular player (User collection)
                const payload = {
                    firstName: trimmedFirst,
                    lastName: trimmedLast,
                    username,
                    email: formData.email.trim(),
                    phone: formData.phone.replace(/\D/g, '').slice(0, 10),
                    password: formData.password,
                    role: formData.role,
                    balance: formData.balance === '' ? 0 : (parseFloat(formData.balance) || 0),
                };
                const response = await fetch(`${API_BASE_URL}/users/create`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(payload),
                });

                const data = await response.json();
                if (data.success) {
                    setSuccess('Player created successfully!');
                    setFormData({
                        firstName: '',
                        lastName: '',
                        email: '',
                        phone: '',
                        password: '',
                        confirmPassword: '',
                        role: 'user',
                        balance: '',
                    });
                    setCreatedPlayers((prev) => [
                        {
                            id: data.data?.id,
                            username: data.data?.username ?? username,
                            email: data.data?.email ?? formData.email,
                            phone: data.data?.phone ?? formData.phone,
                            role: data.data?.role || 'user',
                            createdAt: new Date(),
                        },
                        ...prev,
                    ].slice(0, 20));
                } else {
                    setError(data.message || 'Failed to create player');
                }
            }
        } catch (err) {
            setError('Network error. Please check if the server is running.');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        clearAdminSession();
        navigate('/');
    };

    const inputClass = "w-full px-3 py-1.5 text-sm bg-gray-100/80 border border-gray-200 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all";
    const labelClass = "block text-gray-600 text-sm font-medium mb-1";

    return (
        <AdminLayout onLogout={handleLogout} title="Add Player">
            <div className="flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-6">
                {/* Left: Form */}
            <div className="min-w-0 flex-1 max-w-2xl">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                    <button
                        type="button"
                        onClick={() => navigate('/all-users')}
                        className="p-2 rounded-lg bg-gray-100/80 hover:bg-gray-200 border border-gray-200 text-gray-600 hover:text-gray-800 transition-colors"
                        title="Back to All Players"
                    >
                        <FaArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold">Add New Player</h1>
                        <p className="text-gray-400 text-xs mt-0.5">Create a new player account</p>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-900/30 border border-red-200/60 rounded-lg text-red-600 text-sm">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mb-4 p-3 bg-green-900/30 border border-green-700/60 rounded-lg text-green-200 text-sm flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        {success}
                    </div>
                )}

                {/* Form Card */}
                <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-lg">
                    <div className="p-4 sm:p-5">
                        {/* Basic Info Section - matches frontend signup (firstName, lastName, email, phone) */}
                        <div className="mb-5">
                            <h2 className="text-sm font-semibold text-orange-500 mb-2 flex items-center gap-2">
                                <span className="w-1 h-4 bg-orange-500 rounded-full" />
                                Basic Information
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label htmlFor="firstName" className={labelClass}>First Name *</label>
                                    <input
                                        id="firstName"
                                        type="text"
                                        name="firstName"
                                        value={formData.firstName}
                                        onChange={handleChange}
                                        placeholder="First name"
                                        className={inputClass}
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="lastName" className={labelClass}>Last Name *</label>
                                    <input
                                        id="lastName"
                                        type="text"
                                        name="lastName"
                                        value={formData.lastName}
                                        onChange={handleChange}
                                        placeholder="Last name"
                                        className={inputClass}
                                        required
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label htmlFor="email" className={labelClass}>Email *</label>
                                    <input
                                        id="email"
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        placeholder="player@example.com"
                                        className={inputClass}
                                        required
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label htmlFor="phone" className={labelClass}>Phone Number *</label>
                                    <input
                                        id="phone"
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        placeholder="10-digit number (6–9 start)"
                                        className={inputClass}
                                        maxLength={10}
                                        required
                                    />
                                    <p className="mt-0.5 text-xs text-gray-500">Login: phone + password. 10 digits (6–9 start).</p>
                                </div>
                            </div>
                        </div>

                        {/* Security Section */}
                        <div className="mb-5">
                            <h2 className="text-sm font-semibold text-orange-500 mb-2 flex items-center gap-2">
                                <span className="w-1 h-4 bg-orange-500 rounded-full" />
                                Account Security
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label htmlFor="password" className={labelClass}>Password *</label>
                                    <input
                                        id="password"
                                        type="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        placeholder="Min 6 characters"
                                        className={inputClass}
                                        required
                                        minLength={6}
                                    />
                                    <p className="mt-0.5 text-xs text-gray-500">Min 6 characters</p>
                                </div>
                                <div>
                                    <label htmlFor="confirmPassword" className={labelClass}>Confirm Password *</label>
                                    <input
                                        id="confirmPassword"
                                        type="password"
                                        name="confirmPassword"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        placeholder="Re-enter password"
                                        className={inputClass}
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Account Details Section */}
                        <div className="mb-5">
                            <h2 className="text-sm font-semibold text-orange-500 mb-2 flex items-center gap-2">
                                <span className="w-1 h-4 bg-orange-500 rounded-full" />
                                Account Details
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label htmlFor="role" className={labelClass}>Role *</label>
                                    <select
                                        id="role"
                                        name="role"
                                        value={formData.role}
                                        onChange={handleChange}
                                        className={`${inputClass} cursor-pointer`}
                                        required
                                    >
                                        <option value="user">Player</option>
                                        <option value="bookie">Bookie</option>
                                    </select>
                                    {formData.role === 'bookie' && (
                                        <p className="mt-0.5 text-xs text-orange-600 font-medium">
                                            Bookie Panel: phone + password
                                        </p>
                                    )}
                                </div>
                                {formData.role === 'bookie' && (
                                    <div>
                                        <label htmlFor="commissionPercentage" className={labelClass}>Commission Percentage (%)</label>
                                        <input
                                            id="commissionPercentage"
                                            type="number"
                                            name="commissionPercentage"
                                            value={formData.commissionPercentage}
                                            onChange={handleChange}
                                            placeholder="0"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                            className={inputClass}
                                            autoComplete="off"
                                        />
                                        <p className="mt-0.5 text-xs text-gray-500">0–100% from player bets</p>
                                    </div>
                                )}
                                {formData.role !== 'bookie' && (
                                    <div>
                                        <label htmlFor="balance" className={labelClass}>Initial Balance (₹)</label>
                                        <input
                                            id="balance"
                                            type="number"
                                            name="balance"
                                            value={formData.balance}
                                            onChange={handleChange}
                                            placeholder="0"
                                            min="0"
                                            step="1"
                                            className={inputClass}
                                            autoComplete="off"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Submit */}
                        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-1">
                            <button
                                type="button"
                                onClick={() => navigate('/all-users')}
                                className="px-5 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition-colors font-medium text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2 rounded-lg bg-orange-500 hover:bg-orange-500/90 text-gray-800 font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <FaUserPlus className="w-4 h-4" />
                                        {formData.role === 'bookie' ? 'Create Bookie' : 'Create Player'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>

                {/* Right: Created players list */}
                <div className="lg:w-72 xl:w-80 shrink-0">
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden sticky top-4 shadow-lg">
                        <div className="px-3 py-2 border-b border-gray-200 bg-gray-100/30">
                            <h2 className="text-sm font-semibold text-orange-500 flex items-center gap-2">
                                <FaUser className="w-4 h-4" />
                                Created Players
                            </h2>
                            <p className="text-gray-500 text-xs mt-0.5">Recently added in this session</p>
                        </div>
                        <div className="max-h-[50vh] overflow-y-auto p-2">
                            {createdPlayers.length === 0 ? (
                                <p className="text-gray-500 text-xs py-3 text-center">No players created yet</p>
                            ) : (
                                <ul className="space-y-1.5">
                                    {createdPlayers.map((p) => (
                                        <li key={(p.id || p.createdAt?.getTime?.()) ?? Math.random()}>
                                            <Link
                                                to={p.id ? `/all-users/${p.id}` : '/all-users'}
                                                className="block p-2 rounded-lg bg-gray-50 border border-gray-200 hover:border-orange-300 hover:bg-gray-100 transition-colors"
                                            >
                                                <p className="font-medium text-gray-800 text-sm truncate">{p.username}</p>
                                                <p className="text-gray-400 text-xs truncate mt-0.5">{p.email || '—'}</p>
                                                {p.phone && <p className="text-gray-400 text-xs truncate mt-0.5">{p.phone}</p>}
                                                <p className="text-gray-500 text-xs mt-0.5">
                                                    {p.createdAt ? new Date(p.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
                                                </p>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};

export default AddUser;
