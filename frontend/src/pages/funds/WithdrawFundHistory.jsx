import React, { useState, useEffect } from 'react';
import { API_BASE_URL, getAuthHeaders } from '../../config/api';

const WithdrawFundHistory = () => {
    const [withdrawals, setWithdrawals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    const user = JSON.parse(localStorage.getItem('user') || '{}');

    useEffect(() => {
        fetchWithdrawals();
    }, []);

    const fetchWithdrawals = async () => {
        if (!user.id) return;
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE_URL}/payments/my-withdrawals`, { headers: getAuthHeaders() });
            const data = await res.json();
            if (data.success) {
                setWithdrawals(data.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch withdrawals:', err);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        const styles = {
            pending: 'bg-gray-100 text-[#1B3150] border border-gray-400',
            approved: 'bg-green-100 text-green-700 border border-green-300',
            rejected: 'bg-red-100 text-red-700 border border-red-300',
            completed: 'bg-blue-100 text-blue-700 border border-blue-300',
        };
        return styles[status] || 'bg-gray-100 text-gray-600 border border-gray-300';
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const filteredWithdrawals = filter === 'all' 
        ? withdrawals 
        : withdrawals.filter(w => w.status === filter);

    const stats = {
        total: withdrawals.length,
        pending: withdrawals.filter(w => w.status === 'pending').length,
        approved: withdrawals.filter(w => w.status === 'approved').length,
        rejected: withdrawals.filter(w => w.status === 'rejected').length,
    };

    const totalWithdrawn = withdrawals
        .filter(w => w.status === 'approved')
        .reduce((sum, w) => sum + w.amount, 0);

    return (
        <div className="space-y-6">
            {/* Total Withdrawn */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-5 border border-gray-300">
                <p className="text-gray-600 text-sm">Total Withdrawn</p>
                <p className="text-3xl font-bold text-[#1B3150]">₹{totalWithdrawn.toLocaleString()}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
                <div 
                    onClick={() => setFilter('all')}
                    className={`p-3 rounded-xl text-center cursor-pointer transition-colors ${
                        filter === 'all' ? 'bg-[#1B3150] text-white border border-[#1B3150]' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                >
                    <p className="text-lg font-bold">{stats.total}</p>
                    <p className="text-xs">Total</p>
                </div>
                <div 
                    onClick={() => setFilter('pending')}
                    className={`p-3 rounded-xl text-center cursor-pointer transition-colors ${
                        filter === 'pending' ? 'bg-gray-100 text-[#1B3150] border border-gray-400' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                >
                    <p className="text-lg font-bold text-[#1B3150]">{stats.pending}</p>
                    <p className="text-xs text-gray-600">Pending</p>
                </div>
                <div 
                    onClick={() => setFilter('approved')}
                    className={`p-3 rounded-xl text-center cursor-pointer transition-colors ${
                        filter === 'approved' ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                >
                    <p className="text-lg font-bold text-green-600">{stats.approved}</p>
                    <p className="text-xs text-gray-600">Approved</p>
                </div>
                <div 
                    onClick={() => setFilter('rejected')}
                    className={`p-3 rounded-xl text-center cursor-pointer transition-colors ${
                        filter === 'rejected' ? 'bg-red-100 text-red-700 border border-red-300' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                >
                    <p className="text-lg font-bold text-red-600">{stats.rejected}</p>
                    <p className="text-xs text-gray-600">Rejected</p>
                </div>
            </div>

            {/* List */}
            {loading ? (
                <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500 mx-auto"></div>
                    <p className="text-gray-400 mt-3">Loading history...</p>
                </div>
            ) : filteredWithdrawals.length === 0 ? (
                <div className="text-center py-8 bg-white rounded-xl border border-gray-300">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-gray-600">No withdrawal history found</p>
                    {filter !== 'all' && (
                        <button
                            onClick={() => setFilter('all')}
                            className="mt-2 text-[#1B3150] text-sm hover:text-[#1B3150]"
                        >
                            View all withdrawals
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredWithdrawals.map((withdrawal) => (
                        <div
                            key={withdrawal._id}
                            className="bg-white rounded-xl p-4 border border-gray-300 shadow-sm hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                        withdrawal.status === 'approved' ? 'bg-green-600/20' : 
                                        withdrawal.status === 'rejected' ? 'bg-red-600/20' : 'bg-yellow-600/20'
                                    }`}>
                                        {withdrawal.status === 'approved' ? (
                                            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                            </svg>
                                        ) : withdrawal.status === 'rejected' ? (
                                            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        ) : (
                                            <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-gray-800 font-semibold">₹{withdrawal.amount.toLocaleString()}</p>
                                        <p className="text-gray-500 text-xs">{formatDate(withdrawal.createdAt)}</p>
                                    </div>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(withdrawal.status)}`}>
                                    {withdrawal.status.charAt(0).toUpperCase() + withdrawal.status.slice(1)}
                                </span>
                            </div>

                            {/* Bank Details */}
                            {withdrawal.bankDetailId && (
                                <div className="mt-3 pt-3 border-t border-gray-100">
                                    <p className="text-gray-600 text-sm">
                                        <span className="text-gray-500">To:</span> {withdrawal.bankDetailId.accountHolderName}
                                    </p>
                                    {withdrawal.bankDetailId.bankName && (
                                        <p className="text-gray-500 text-xs">
                                            {withdrawal.bankDetailId.bankName} - ****{withdrawal.bankDetailId.accountNumber?.slice(-4)}
                                        </p>
                                    )}
                                    {withdrawal.bankDetailId.upiId && (
                                        <p className="text-gray-500 text-xs">
                                            UPI: {withdrawal.bankDetailId.upiId}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Admin Remarks */}
                            {(withdrawal.adminRemarks || withdrawal.processedAt) && (
                                <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                                    {withdrawal.adminRemarks && (
                                        <p className="text-gray-600 text-sm">
                                            <span className="text-gray-500">Admin:</span> {withdrawal.adminRemarks}
                                        </p>
                                    )}
                                    {withdrawal.processedAt && (
                                        <p className="text-gray-500 text-xs">
                                            Processed: {formatDate(withdrawal.processedAt)}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default WithdrawFundHistory;
