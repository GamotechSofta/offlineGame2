import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../config/api';

const AddFundHistory = () => {
    const [deposits, setDeposits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    const user = JSON.parse(localStorage.getItem('user') || '{}');

    useEffect(() => {
        fetchDeposits();
    }, []);

    const fetchDeposits = async () => {
        if (!user.id) return;
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE_URL}/payments/my-deposits?userId=${user.id}`);
            const data = await res.json();
            if (data.success) {
                setDeposits(data.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch deposits:', err);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        const styles = {
            pending: 'bg-gray-100 text-gray-700 border border-gray-300',
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

    const filteredDeposits = filter === 'all' 
        ? deposits 
        : deposits.filter(d => d.status === filter);

    const stats = {
        total: deposits.length,
        pending: deposits.filter(d => d.status === 'pending').length,
        approved: deposits.filter(d => d.status === 'approved').length,
        rejected: deposits.filter(d => d.status === 'rejected').length,
    };

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
                <div 
                    onClick={() => setFilter('all')}
                    className={`p-3 rounded-xl text-center cursor-pointer transition-colors ${
                        filter === 'all' ? 'bg-[#1B3150] text-white border border-[#1B3150]' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                    }`}
                >
                    <p className="text-lg font-bold">{stats.total}</p>
                    <p className="text-xs">Total</p>
                </div>
                <div 
                    onClick={() => setFilter('pending')}
                    className={`p-3 rounded-xl text-center cursor-pointer transition-colors ${
                        filter === 'pending' ? 'bg-gray-100 text-gray-700 border border-gray-300' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                    }`}
                >
                    <p className="text-lg font-bold text-gray-600">{stats.pending}</p>
                    <p className="text-xs text-gray-600">Pending</p>
                </div>
                <div 
                    onClick={() => setFilter('approved')}
                    className={`p-3 rounded-xl text-center cursor-pointer transition-colors ${
                        filter === 'approved' ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                    }`}
                >
                    <p className="text-lg font-bold text-green-600">{stats.approved}</p>
                    <p className="text-xs text-gray-600">Approved</p>
                </div>
                <div 
                    onClick={() => setFilter('rejected')}
                    className={`p-3 rounded-xl text-center cursor-pointer transition-colors ${
                        filter === 'rejected' ? 'bg-red-100 text-red-700 border border-red-300' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                    }`}
                >
                    <p className="text-lg font-bold text-red-600">{stats.rejected}</p>
                    <p className="text-xs text-gray-600">Rejected</p>
                </div>
            </div>

            {/* List */}
            {loading ? (
                <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500 mx-auto"></div>
                    <p className="text-gray-400 mt-3">Loading history...</p>
                </div>
            ) : filteredDeposits.length === 0 ? (
                <div className="text-center py-8 bg-white rounded-xl border border-gray-200">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-gray-600">No deposit history found</p>
                    {filter !== 'all' && (
                        <button
                            onClick={() => setFilter('all')}
                            className="mt-2 text-gray-600 text-sm hover:text-gray-700"
                        >
                            View all deposits
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredDeposits.map((deposit) => (
                        <div
                            key={deposit._id}
                            className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                        deposit.status === 'approved' ? 'bg-green-600/20' : 
                                        deposit.status === 'rejected' ? 'bg-red-600/20' : 'bg-yellow-600/20'
                                    }`}>
                                        {deposit.status === 'approved' ? (
                                            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                            </svg>
                                        ) : deposit.status === 'rejected' ? (
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
                                        <p className="text-gray-800 font-semibold">₹{deposit.amount.toLocaleString()}</p>
                                        <p className="text-gray-500 text-xs">{formatDate(deposit.createdAt)}</p>
                                    </div>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(deposit.status)}`}>
                                    {deposit.status.charAt(0).toUpperCase() + deposit.status.slice(1)}
                                </span>
                            </div>

                            {/* Details */}
                            <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                                {deposit.upiTransactionId && (
                                    <p className="text-gray-600 text-sm">
                                        <span className="text-gray-500">UTR:</span> {deposit.upiTransactionId}
                                    </p>
                                )}
                                {deposit.adminRemarks && (
                                    <p className="text-gray-600 text-sm">
                                        <span className="text-gray-500">Admin:</span> {deposit.adminRemarks}
                                    </p>
                                )}
                                {deposit.processedAt && (
                                    <p className="text-gray-500 text-xs">
                                        Processed: {formatDate(deposit.processedAt)}
                                    </p>
                                )}
                            </div>

                            {/* Screenshot Preview */}
                            {deposit.screenshotUrl && (
                                <div className="mt-3">
                                    <a
                                        href={deposit.screenshotUrl.startsWith('http') 
                                            ? deposit.screenshotUrl 
                                            : `${API_BASE_URL}${deposit.screenshotUrl}?userId=${user?.id || ''}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 text-gray-600 text-sm hover:text-gray-700"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        View Screenshot
                                    </a>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AddFundHistory;
