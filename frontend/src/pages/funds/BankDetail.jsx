import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../config/api';

const BankDetail = () => {
    const [bankAccounts, setBankAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successMessage, setSuccessMessage] = useState({ title: '', subtitle: '' });
    
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
                setSuccessMessage({
                    title: editingId ? 'Bank Detail Updated!' : 'Bank Detail Added!',
                    subtitle: editingId 
                        ? 'Your bank account details have been updated successfully.'
                        : 'Your bank account has been added successfully. You can now use it for withdrawals.'
                });
                setShowSuccessModal(true);
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
                    <h3 className="text-lg font-bold text-gray-800">Bank Accounts</h3>
                    <p className="text-gray-600 text-sm">{bankAccounts.length}/5 accounts added</p>
                </div>
                {bankAccounts.length < 5 && !showForm && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium shadow-md"
                    >
                        + Add Account
                    </button>
                )}
            </div>

            {/* Messages */}
            {error && (
                <div className="p-4 bg-red-50 border border-red-300 rounded-xl text-red-600 text-sm">
                    {error}
                </div>
            )}
            {success && (
                <div className="p-4 bg-green-50 border border-green-300 rounded-xl text-green-600 text-sm">
                    {success}
                </div>
            )}

            {/* Add/Edit Form */}
            {showForm && (
                <div className="bg-white rounded-xl p-5 border border-orange-200 shadow-md">
                    <h4 className="text-gray-800 font-semibold mb-4">
                        {editingId ? 'Edit Bank Account' : 'Add New Bank Account'}
                    </h4>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-gray-700 text-sm mb-1">
                                Account Holder Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.accountHolderName}
                                onChange={(e) => setFormData({ ...formData, accountHolderName: e.target.value })}
                                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                placeholder="Name as per bank"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-gray-700 text-sm mb-1">Bank Name</label>
                                <input
                                    type="text"
                                    value={formData.bankName}
                                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                    placeholder="e.g., HDFC Bank"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 text-sm mb-1">Account Type</label>
                                <select
                                    value={formData.accountType}
                                    onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
                                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                >
                                    <option value="savings">Savings</option>
                                    <option value="current">Current</option>
                                    <option value="upi_only">UPI Only</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-gray-700 text-sm mb-1">Account Number</label>
                                <input
                                    type="text"
                                    value={formData.accountNumber}
                                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                    placeholder="Enter account number"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 text-sm mb-1">IFSC Code</label>
                                <input
                                    type="text"
                                    value={formData.ifscCode}
                                    onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })}
                                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                    placeholder="e.g., HDFC0001234"
                                />
                            </div>
                        </div>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-orange-200"></div>
                            </div>
                            <div className="relative flex justify-center">
                                <span className="px-3 bg-white text-gray-500 text-sm">OR</span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-gray-700 text-sm mb-1">UPI ID</label>
                            <input
                                type="text"
                                value={formData.upiId}
                                onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
                                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                placeholder="e.g., yourname@paytm"
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={resetForm}
                                className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium disabled:opacity-50 shadow-md"
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
                <div className="text-center py-8 bg-white rounded-xl border border-orange-200">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 10h18M5 10v8m4-8v8m6-8v8m4-8v8M3 18h18M4 10l8-4 8 4" />
                    </svg>
                    <p className="text-gray-600">No bank accounts added yet</p>
                    <p className="text-gray-500 text-sm mt-1">Add a bank account to withdraw funds</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {bankAccounts.map((acc) => (
                        <div
                            key={acc._id}
                            className={`bg-white rounded-xl p-4 border shadow-sm hover:shadow-md transition-shadow ${
                                acc.isDefault ? 'border-orange-300 bg-orange-50' : 'border-orange-200'
                            }`}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                                        <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M5 10v8m4-8v8m6-8v8m4-8v8M3 18h18M4 10l8-4 8 4" />
                                        </svg>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-gray-800 font-semibold">{acc.accountHolderName}</p>
                                            {acc.isDefault && (
                                                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full border border-orange-300">
                                                    Default
                                                </span>
                                            )}
                                        </div>
                                        {acc.bankName && (
                                            <p className="text-gray-600 text-sm">{acc.bankName}</p>
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
                            
                            <div className="flex gap-2 mt-4 pt-3 border-t border-orange-100">
                                {!acc.isDefault && (
                                    <button
                                        onClick={() => handleSetDefault(acc._id)}
                                        className="px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg text-xs border border-orange-300 transition-colors"
                                    >
                                        Set Default
                                    </button>
                                )}
                                <button
                                    onClick={() => handleEdit(acc)}
                                    className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-xs border border-blue-300 transition-colors"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => handleDelete(acc._id)}
                                    className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs border border-red-300 transition-colors"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Success Modal */}
            {showSuccessModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-orange-200 shadow-xl text-center">
                        {/* Success Icon */}
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>

                        <h3 className="text-xl font-bold text-gray-800 mb-2">{successMessage.title}</h3>
                        
                        <div className="bg-orange-50 rounded-xl p-4 mb-4 border border-orange-200">
                            <svg className="w-12 h-12 text-orange-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 10h18M5 10v8m4-8v8m6-8v8m4-8v8M3 18h18M4 10l8-4 8 4" />
                            </svg>
                        </div>

                        <p className="text-gray-600 text-sm mb-6">
                            {successMessage.subtitle}
                        </p>

                        <div className="space-y-3">
                            <button
                                onClick={() => setShowSuccessModal(false)}
                                className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors shadow-md"
                            >
                                Done
                            </button>
                            <button
                                onClick={() => {
                                    setShowSuccessModal(false);
                                    window.location.href = '/funds?tab=withdraw-fund';
                                }}
                                className="w-full py-3 bg-white border border-orange-300 hover:bg-orange-50 text-orange-600 font-medium rounded-xl transition-colors"
                            >
                                Go to Withdraw
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BankDetail;
