import React, { useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import { useNavigate, Link } from 'react-router-dom';
import { FaArrowLeft, FaUserPlus, FaUser } from 'react-icons/fa';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const AddUser = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        phone: '',
        role: 'user',
        balance: '', // empty = 0 on submit; user can clear field
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [createdPlayers, setCreatedPlayers] = useState([]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: name === 'balance' ? value : value,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            const admin = JSON.parse(localStorage.getItem('admin'));
            const password = sessionStorage.getItem('adminPassword') || '';
            const payload = {
                ...formData,
                balance: formData.balance === '' ? 0 : (parseFloat(formData.balance) || 0),
            };
            const response = await fetch(`${API_BASE_URL}/users/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${btoa(`${admin.username}:${password}`)}`,
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();
            if (data.success) {
                setSuccess('Player created successfully!');
                setFormData({
                    username: '',
                    email: '',
                    password: '',
                    phone: '',
                    role: 'user',
                    balance: '',
                });
                setCreatedPlayers((prev) => [
                    {
                        id: data.data?.id,
                        username: data.data?.username ?? formData.username,
                        email: data.data?.email ?? formData.email,
                        createdAt: new Date(),
                    },
                    ...prev,
                ].slice(0, 20));
            } else {
                setError(data.message || 'Failed to create player');
            }
        } catch (err) {
            setError('Network error. Please check if the server is running.');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('admin');
        sessionStorage.removeItem('adminPassword');
        navigate('/');
    };

    const inputClass = "w-full px-4 py-2.5 bg-gray-700/80 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all";
    const labelClass = "block text-gray-300 text-sm font-medium mb-1.5";

    return (
        <AdminLayout onLogout={handleLogout} title="Add Player">
            <div className="flex flex-col lg:flex-row lg:items-start gap-6 lg:gap-8">
                {/* Left: Form */}
            <div className="min-w-0 flex-1 max-w-2xl">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <button
                        type="button"
                        onClick={() => navigate('/all-users')}
                        className="p-2 rounded-lg bg-gray-700/80 hover:bg-gray-600 border border-gray-600 text-gray-300 hover:text-white transition-colors"
                        title="Back to All Players"
                    >
                        <FaArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold">Add New Player</h1>
                        <p className="text-gray-400 text-sm mt-0.5">Create a new player account</p>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-900/30 border border-red-700/60 rounded-xl text-red-200 text-sm">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mb-6 p-4 bg-green-900/30 border border-green-700/60 rounded-xl text-green-200 text-sm flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        {success}
                    </div>
                )}

                {/* Form Card */}
                <form onSubmit={handleSubmit} className="bg-gray-800/60 rounded-2xl border border-gray-700/80 overflow-hidden shadow-xl">
                    <div className="p-5 sm:p-8">
                        {/* Basic Info Section */}
                        <div className="mb-8">
                            <h2 className="text-base font-semibold text-yellow-500 mb-4 flex items-center gap-2">
                                <span className="w-1 h-5 bg-yellow-500 rounded-full" />
                                Basic Information
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label htmlFor="username" className={labelClass}>Username *</label>
                                    <input
                                        id="username"
                                        type="text"
                                        name="username"
                                        value={formData.username}
                                        onChange={handleChange}
                                        placeholder="Enter username"
                                        className={inputClass}
                                        required
                                    />
                                </div>
                                <div>
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
                            </div>
                        </div>

                        {/* Security Section */}
                        <div className="mb-8">
                            <h2 className="text-base font-semibold text-yellow-500 mb-4 flex items-center gap-2">
                                <span className="w-1 h-5 bg-yellow-500 rounded-full" />
                                Account Security
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
                                    <p className="mt-1 text-xs text-gray-500">Minimum 6 characters required</p>
                                </div>
                                <div>
                                    <label htmlFor="phone" className={labelClass}>Phone</label>
                                    <input
                                        id="phone"
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        placeholder="Optional"
                                        className={inputClass}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Account Details Section */}
                        <div className="mb-8">
                            <h2 className="text-base font-semibold text-yellow-500 mb-4 flex items-center gap-2">
                                <span className="w-1 h-5 bg-yellow-500 rounded-full" />
                                Account Details
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
                                </div>
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
                            </div>
                        </div>

                        {/* Submit */}
                        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 pt-2">
                            <button
                                type="button"
                                onClick={() => navigate('/all-users')}
                                className="px-6 py-3 rounded-xl border border-gray-600 text-gray-300 hover:bg-gray-700/50 hover:text-white transition-colors font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-yellow-500 hover:bg-yellow-500/90 text-black font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <FaUserPlus className="w-5 h-5" />
                                        Create Player
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>

                {/* Right: Created players list */}
                <div className="lg:w-80 xl:w-96 shrink-0">
                    <div className="bg-gray-800/60 rounded-2xl border border-gray-700/80 overflow-hidden sticky top-4">
                        <div className="px-4 py-3 border-b border-gray-700 bg-gray-700/30">
                            <h2 className="text-sm font-semibold text-yellow-500 flex items-center gap-2">
                                <FaUser className="w-4 h-4" />
                                Created Players
                            </h2>
                            <p className="text-gray-500 text-xs mt-0.5">Recently added in this session</p>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto p-3">
                            {createdPlayers.length === 0 ? (
                                <p className="text-gray-500 text-sm py-4 text-center">No players created yet</p>
                            ) : (
                                <ul className="space-y-2">
                                    {createdPlayers.map((p) => (
                                        <li key={(p.id || p.createdAt?.getTime?.()) ?? Math.random()}>
                                            <Link
                                                to={p.id ? `/all-users/${p.id}` : '/all-users'}
                                                className="block p-3 rounded-xl bg-gray-700/50 border border-gray-600/50 hover:border-yellow-500/50 hover:bg-gray-700 transition-colors"
                                            >
                                                <p className="font-medium text-white truncate">{p.username}</p>
                                                <p className="text-gray-400 text-xs truncate mt-0.5">{p.email || '—'}</p>
                                                <p className="text-gray-500 text-xs mt-1">
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
