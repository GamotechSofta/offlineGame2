import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../config/api';

const BankDetail = () => {
    const [bankAccounts, setBankAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    
    // Form state
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        accountHolderName: '',
        accountNumber: '',
        ifscCode: '',
        bankName: '',
        upiId: '',
        accountType: 'savings',
    });
    const [submitting, setSubmitting] = useState(false);

    const user = JSON.parse(localStorage.getItem('user') || '{}');

    useEffect(() => {
        fetchBankAccounts();
    }, []);

    const fetchBankAccounts = async () => {
        if (!user.id) return;
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE_URL}/bank-details?userId=${user.id}`);
            const data = await res.json();
            if (data.success) {
                setBankAccounts(data.data || []);
            }
        } catch (err) {
            setError('Failed to fetch bank accounts');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            accountHolderName: '',
            accountNumber: '',
            ifscCode: '',
            bankName: '',
            upiId: '',
            accountType: 'savings',
        });
        setEditingId(null);
        setShowForm(false);
    };

    const handleEdit = (acc) => {
        setFormData({
            accountHolderName: acc.accountHolderName || '',
            accountNumber: acc.accountNumber || '',
            ifscCode: acc.ifscCode || '',
            bankName: acc.bankName || '',
            upiId: acc.upiId || '',
            accountType: acc.accountType || 'savings',
        });
        setEditingId(acc._id);
        setShowForm(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!formData.accountHolderName) {
            setError('Account holder name is required');
            return;
        }

        if (!formData.upiId && (!formData.accountNumber || !formData.ifscCode)) {
            setError('Please provide either UPI ID or bank account details');
            return;
        }

        setSubmitting(true);

        try {
            const url = editingId 
                ? `${API_BASE_URL}/bank-details/${editingId}`
                : `${API_BASE_URL}/bank-details`;
            
            const method = editingId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    ...formData,
                }),
            });

            const data = await res.json();
            if (data.success) {
                setSuccess(editingId ? 'Bank detail updated!' : 'Bank detail added!');
                resetForm();
                fetchBankAccounts();
            } else {
                setError(data.message || 'Failed to save');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this bank account?')) return;

        try {
            const res = await fetch(`${API_BASE_URL}/bank-details/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id }),
            });

            const data = await res.json();
            if (data.success) {
                setSuccess('Bank account deleted');
                fetchBankAccounts();
            } else {
                setError(data.message || 'Failed to delete');
            }
        } catch (err) {
            setError('Network error');
        }
    };

    const handleSetDefault = async (id) => {
        try {
            const res = await fetch(`${API_BASE_URL}/bank-details/${id}/set-default`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id }),
            });

            const data = await res.json();
            if (data.success) {
                setSuccess('Default account updated');
                fetchBankAccounts();
            }
        } catch (err) {
            setError('Failed to set default');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-white">Bank Accounts</h3>
                    <p className="text-gray-400 text-sm">{bankAccounts.length}/5 accounts added</p>
                </div>
                {bankAccounts.length < 5 && !showForm && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                    >
                        + Add Account
                    </button>
                )}
            </div>

            {/* Messages */}
            {error && (
                <div className="p-4 bg-red-900/50 border border-red-600 rounded-xl text-red-300 text-sm">
                    {error}
                </div>
            )}
            {success && (
                <div className="p-4 bg-green-900/50 border border-green-600 rounded-xl text-green-300 text-sm">
                    {success}
                </div>
            )}

            {/* Add/Edit Form */}
            {showForm && (
                <div className="bg-[#1a1a1a] rounded-xl p-5 border border-blue-500/30">
                    <h4 className="text-white font-semibold mb-4">
                        {editingId ? 'Edit Bank Account' : 'Add New Bank Account'}
                    </h4>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-gray-300 text-sm mb-1">
                                Account Holder Name <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.accountHolderName}
                                onChange={(e) => setFormData({ ...formData, accountHolderName: e.target.value })}
                                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Name as per bank"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-gray-300 text-sm mb-1">Bank Name</label>
                                <input
                                    type="text"
                                    value={formData.bankName}
                                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="e.g., HDFC Bank"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-300 text-sm mb-1">Account Type</label>
                                <select
                                    value={formData.accountType}
                                    onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
                                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="savings">Savings</option>
                                    <option value="current">Current</option>
                                    <option value="upi_only">UPI Only</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-gray-300 text-sm mb-1">Account Number</label>
                                <input
                                    type="text"
                                    value={formData.accountNumber}
                                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter account number"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-300 text-sm mb-1">IFSC Code</label>
                                <input
                                    type="text"
                                    value={formData.ifscCode}
                                    onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })}
                                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="e.g., HDFC0001234"
                                />
                            </div>
                        </div>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-white/10"></div>
                            </div>
                            <div className="relative flex justify-center">
                                <span className="px-3 bg-[#1a1a1a] text-gray-500 text-sm">OR</span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-gray-300 text-sm mb-1">UPI ID</label>
                            <input
                                type="text"
                                value={formData.upiId}
                                onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
                                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g., yourname@paytm"
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={resetForm}
                                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
                            >
                                {submitting ? 'Saving...' : (editingId ? 'Update' : 'Add Account')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Bank Accounts List */}
            {loading ? (
                <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="text-gray-400 mt-3">Loading...</p>
                </div>
            ) : bankAccounts.length === 0 ? (
                <div className="text-center py-8 bg-[#1a1a1a] rounded-xl border border-white/10">
                    <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 10h18M5 10v8m4-8v8m6-8v8m4-8v8M3 18h18M4 10l8-4 8 4" />
                    </svg>
                    <p className="text-gray-400">No bank accounts added yet</p>
                    <p className="text-gray-500 text-sm mt-1">Add a bank account to withdraw funds</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {bankAccounts.map((acc) => (
                        <div
                            key={acc._id}
                            className={`bg-[#1a1a1a] rounded-xl p-4 border ${
                                acc.isDefault ? 'border-yellow-500/50' : 'border-white/10'
                            }`}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-blue-600/20 rounded-full flex items-center justify-center">
                                        <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M5 10v8m4-8v8m6-8v8m4-8v8M3 18h18M4 10l8-4 8 4" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-white font-semibold">{acc.accountHolderName}</p>
                                            {acc.isDefault && (
                                                <span className="px-2 py-0.5 bg-yellow-600/30 text-yellow-400 text-xs rounded-full">
                                                    Default
                                                </span>
                                            )}
                                        </div>
                                        {acc.bankName && (
                                            <p className="text-gray-400 text-sm">{acc.bankName}</p>
                                        )}
                                        {acc.accountNumber && (
                                            <p className="text-gray-500 text-sm">
                                                A/C: ****{acc.accountNumber.slice(-4)} | IFSC: {acc.ifscCode}
                                            </p>
                                        )}
                                        {acc.upiId && (
                                            <p className="text-gray-500 text-sm">UPI: {acc.upiId}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex gap-2 mt-4 pt-3 border-t border-white/5">
                                {!acc.isDefault && (
                                    <button
                                        onClick={() => handleSetDefault(acc._id)}
                                        className="px-3 py-1.5 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 rounded-lg text-xs"
                                    >
                                        Set Default
                                    </button>
                                )}
                                <button
                                    onClick={() => handleEdit(acc)}
                                    className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg text-xs"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => handleDelete(acc._id)}
                                    className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-xs"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default BankDetail;
