import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const PaymentManagement = () => {
    const navigate = useNavigate();
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pendingCounts, setPendingCounts] = useState({ deposits: 0, withdrawals: 0, total: 0 });
    const [filters, setFilters] = useState({
        status: '',
        type: '',
    });

    // Modal state
    const [actionModal, setActionModal] = useState({ show: false, payment: null, action: '' });
    const [adminRemarks, setAdminRemarks] = useState('');
    const [processing, setProcessing] = useState(false);

    // Image preview modal
    const [imageModal, setImageModal] = useState({ show: false, url: '' });

    // Detail modal for viewing full payment details
    const [detailModal, setDetailModal] = useState({ show: false, payment: null });

    useEffect(() => {
        fetchPayments();
        fetchPendingCounts();
    }, [filters]);

    const getAuthHeaders = () => {
        const admin = JSON.parse(localStorage.getItem('admin'));
        const password = sessionStorage.getItem('adminPassword') || '';
        return {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${btoa(`${admin.username}:${password}`)}`,
        };
    };

    const fetchPayments = async () => {
        try {
            setLoading(true);
            const queryParams = new URLSearchParams();
            if (filters.status) queryParams.append('status', filters.status);
            if (filters.type) queryParams.append('type', filters.type);

            const response = await fetch(`${API_BASE_URL}/payments?${queryParams}`, {
                headers: getAuthHeaders(),
            });
            const data = await response.json();
            if (data.success) {
                setPayments(data.data);
            }
        } catch (err) {
            console.error('Error fetching payments:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchPendingCounts = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/payments/pending-count`, {
                headers: getAuthHeaders(),
            });
            const data = await response.json();
            if (data.success) {
                setPendingCounts(data.data);
            }
        } catch (err) {
            console.error('Error fetching pending counts:', err);
        }
    };

    const openActionModal = (payment, action) => {
        setActionModal({ show: true, payment, action });
        setAdminRemarks('');
    };

    const closeActionModal = () => {
        setActionModal({ show: false, payment: null, action: '' });
        setAdminRemarks('');
    };

    const handleAction = async () => {
        if (!actionModal.payment || !actionModal.action) return;

        setProcessing(true);
        try {
            const endpoint = actionModal.action === 'approve' 
                ? `${API_BASE_URL}/payments/${actionModal.payment._id}/approve`
                : `${API_BASE_URL}/payments/${actionModal.payment._id}/reject`;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ adminRemarks }),
            });
            const data = await response.json();
            if (data.success) {
                fetchPayments();
                fetchPendingCounts();
                closeActionModal();
            } else {
                alert(data.message || 'Action failed');
            }
        } catch (err) {
            console.error('Error processing action:', err);
            alert('Error processing action');
        } finally {
            setProcessing(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('admin');
        sessionStorage.removeItem('adminPassword');
        navigate('/');
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

    const getStatusBadge = (status) => {
        const styles = {
            pending: 'bg-yellow-600/30 text-yellow-400 border-yellow-600/50',
            approved: 'bg-green-600/30 text-green-400 border-green-600/50',
            rejected: 'bg-red-600/30 text-red-400 border-red-600/50',
            completed: 'bg-blue-600/30 text-blue-400 border-blue-600/50',
        };
        return styles[status] || 'bg-gray-600/30 text-gray-400 border-gray-600/50';
    };

    const getTypeBadge = (type) => {
        return type === 'deposit' 
            ? 'bg-green-600/20 text-green-400 border-green-600/40'
            : 'bg-purple-600/20 text-purple-400 border-purple-600/40';
    };

    return (
        <AdminLayout onLogout={handleLogout} title="Payments">
            <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Payment Management</h1>

            {/* Pending Counts Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div 
                    className={`bg-gray-800 rounded-lg p-4 border cursor-pointer transition-colors ${
                        filters.status === 'pending' && filters.type === 'deposit' 
                            ? 'border-yellow-500' 
                            : 'border-gray-700 hover:border-gray-600'
                    }`}
                    onClick={() => setFilters({ status: 'pending', type: 'deposit' })}
                >
                    <p className="text-sm text-gray-400">Pending Deposits</p>
                    <p className="text-2xl font-bold text-yellow-400">{pendingCounts.deposits}</p>
                </div>
                <div 
                    className={`bg-gray-800 rounded-lg p-4 border cursor-pointer transition-colors ${
                        filters.status === 'pending' && filters.type === 'withdrawal' 
                            ? 'border-yellow-500' 
                            : 'border-gray-700 hover:border-gray-600'
                    }`}
                    onClick={() => setFilters({ status: 'pending', type: 'withdrawal' })}
                >
                    <p className="text-sm text-gray-400">Pending Withdrawals</p>
                    <p className="text-2xl font-bold text-yellow-400">{pendingCounts.withdrawals}</p>
                </div>
                <div 
                    className={`bg-gray-800 rounded-lg p-4 border cursor-pointer transition-colors ${
                        filters.status === '' && filters.type === '' 
                            ? 'border-blue-500' 
                            : 'border-gray-700 hover:border-gray-600'
                    }`}
                    onClick={() => setFilters({ status: '', type: '' })}
                >
                    <p className="text-sm text-gray-400">Total Pending</p>
                    <p className="text-2xl font-bold text-blue-400">{pendingCounts.total}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-gray-800 rounded-lg p-4 mb-4 sm:mb-6 flex flex-col sm:flex-row gap-4">
                <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                    <option value="">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="completed">Completed</option>
                </select>
                <select
                    value={filters.type}
                    onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                    className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                    <option value="">All Types</option>
                    <option value="deposit">Deposit</option>
                    <option value="withdrawal">Withdrawal</option>
                </select>
                <button
                    onClick={() => setFilters({ status: '', type: '' })}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-white text-sm"
                >
                    Clear Filters
                </button>
            </div>

            {/* Payments Table */}
            {loading ? (
                <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-400">Loading payments...</p>
                </div>
            ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <div className="bg-gray-800 rounded-lg overflow-hidden min-w-[1080px]">
                        <table className="w-full text-sm table-fixed">
                            <thead className="bg-gray-700">
                                <tr>
                                    <th className="w-[80px] px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">ID</th>
                                    <th className="w-[180px] px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Player</th>
                                    <th className="w-[100px] px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Type</th>
                                    <th className="w-[100px] px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Amount</th>
                                    <th className="w-[200px] px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Details</th>
                                    <th className="w-[120px] px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Status</th>
                                    <th className="w-[160px] px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Date</th>
                                    <th className="w-[140px] px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {payments.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="px-6 py-8 text-center text-gray-400">
                                            No payments found
                                        </td>
                                    </tr>
                                ) : (
                                    payments.map((payment) => (
                                        <tr key={payment._id} className="hover:bg-gray-700/50">
                                            <td className="px-4 py-4 text-xs text-gray-400 whitespace-nowrap">
                                                #{payment._id.slice(-6).toUpperCase()}
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="truncate">
                                                    <p className="font-medium text-white truncate">
                                                        {payment.userId?.username || 'Unknown'}
                                                    </p>
                                                    <p className="text-xs text-gray-500 truncate">
                                                        {payment.userId?.email || payment.userId?.phone || ''}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${getTypeBadge(payment.type)}`}>
                                                    {payment.type === 'deposit' ? '↓ Deposit' : '↑ Withdraw'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 font-semibold text-white whitespace-nowrap">
                                                ₹{payment.amount?.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-4">
                                                {payment.type === 'deposit' ? (
                                                    <div className="space-y-1.5">
                                                        {payment.upiTransactionId && (
                                                            <p className="text-xs text-gray-400 truncate">
                                                                UTR: <span className="text-white font-mono">{payment.upiTransactionId}</span>
                                                            </p>
                                                        )}
                                                        {payment.screenshotUrl && (
                                                            <button
                                                                onClick={() => setImageModal({ 
                                                                    show: true, 
                                                                    url: `${API_BASE_URL.replace('/api/v1', '')}${payment.screenshotUrl}` 
                                                                })}
                                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-600/20 border border-blue-500/40 rounded text-xs text-blue-400 hover:bg-blue-600/30 transition-colors"
                                                            >
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                </svg>
                                                                Screenshot
                                                            </button>
                                                        )}
                                                        {payment.userNote && (
                                                            <p className="text-xs text-gray-500 truncate" title={payment.userNote}>Note: {payment.userNote}</p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="space-y-0.5">
                                                        {payment.bankDetailId ? (
                                                            <>
                                                                <p className="text-xs text-white font-medium truncate">
                                                                    {payment.bankDetailId.accountHolderName}
                                                                </p>
                                                                {payment.bankDetailId.bankName && (
                                                                    <p className="text-xs text-gray-500 truncate">
                                                                        {payment.bankDetailId.bankName}
                                                                        {payment.bankDetailId.accountNumber && (
                                                                            <> - ****{payment.bankDetailId.accountNumber.slice(-4)}</>
                                                                        )}
                                                                    </p>
                                                                )}
                                                                {payment.bankDetailId.upiId && (
                                                                    <p className="text-xs text-gray-500 truncate">
                                                                        UPI: {payment.bankDetailId.upiId}
                                                                    </p>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <p className="text-xs text-gray-500">No bank details</p>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${getStatusBadge(payment.status)}`}>
                                                    {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                                                </span>
                                                {payment.adminRemarks && payment.status !== 'pending' && (
                                                    <p className="text-xs text-gray-500 mt-1 truncate" title={payment.adminRemarks}>
                                                        {payment.adminRemarks}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-xs text-gray-400">
                                                <p className="whitespace-nowrap">{formatDate(payment.createdAt)}</p>
                                                {payment.processedAt && payment.status !== 'pending' && (
                                                    <p className="text-gray-500 whitespace-nowrap text-[10px] mt-0.5">
                                                        Done: {formatDate(payment.processedAt)}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {/* View Details Button */}
                                                    <button
                                                        onClick={() => setDetailModal({ show: true, payment })}
                                                        className="px-2.5 py-1.5 bg-blue-600/20 border border-blue-500/40 hover:bg-blue-600/30 rounded text-xs font-medium text-blue-400 transition-colors"
                                                    >
                                                        View
                                                    </button>
                                                    {payment.status === 'pending' && (
                                                        <>
                                                            <button
                                                                onClick={() => openActionModal(payment, 'approve')}
                                                                className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 rounded text-xs font-medium transition-colors"
                                                            >
                                                                Approve
                                                            </button>
                                                            <button
                                                                onClick={() => openActionModal(payment, 'reject')}
                                                                className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 rounded text-xs font-medium transition-colors"
                                                            >
                                                                Reject
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Action Modal */}
            {actionModal.show && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl max-w-md w-full p-6 border border-gray-700">
                        <h3 className="text-xl font-bold mb-4">
                            {actionModal.action === 'approve' ? 'Approve' : 'Reject'} {actionModal.payment?.type === 'deposit' ? 'Deposit' : 'Withdrawal'}
                        </h3>
                        
                        <div className="bg-gray-900 rounded-lg p-4 mb-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-gray-400">Amount</span>
                                <span className="text-xl font-bold text-white">
                                    ₹{actionModal.payment?.amount?.toLocaleString()}
                                </span>
                            </div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-gray-400">Player</span>
                                <span className="text-white">
                                    {actionModal.payment?.userId?.username || 'Unknown'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400">Type</span>
                                <span className={`px-2 py-1 rounded text-xs ${
                                    actionModal.payment?.type === 'deposit' 
                                        ? 'bg-green-600/30 text-green-400' 
                                        : 'bg-purple-600/30 text-purple-400'
                                }`}>
                                    {actionModal.payment?.type}
                                </span>
                            </div>
                        </div>

                        {/* Show screenshot for deposits */}
                        {actionModal.payment?.type === 'deposit' && actionModal.payment?.screenshotUrl && (
                            <div className="mb-4">
                                <p className="text-gray-400 text-sm mb-2">Payment Screenshot:</p>
                                <img
                                    src={`${API_BASE_URL.replace('/api/v1', '')}${actionModal.payment.screenshotUrl}`}
                                    alt="Payment proof"
                                    className="w-full max-h-48 object-contain rounded-lg border border-gray-700 cursor-pointer"
                                    onClick={() => setImageModal({ 
                                        show: true, 
                                        url: `${API_BASE_URL.replace('/api/v1', '')}${actionModal.payment.screenshotUrl}` 
                                    })}
                                />
                            </div>
                        )}

                        {/* Show bank details for withdrawals */}
                        {actionModal.payment?.type === 'withdrawal' && actionModal.payment?.bankDetailId && (
                            <div className="mb-4 bg-gray-900 rounded-lg p-3">
                                <p className="text-gray-400 text-sm mb-2">Withdraw to:</p>
                                <p className="text-white font-medium">{actionModal.payment.bankDetailId.accountHolderName}</p>
                                {actionModal.payment.bankDetailId.bankName && (
                                    <p className="text-gray-400 text-sm">
                                        {actionModal.payment.bankDetailId.bankName} - {actionModal.payment.bankDetailId.accountNumber}
                                    </p>
                                )}
                                {actionModal.payment.bankDetailId.ifscCode && (
                                    <p className="text-gray-400 text-sm">IFSC: {actionModal.payment.bankDetailId.ifscCode}</p>
                                )}
                                {actionModal.payment.bankDetailId.upiId && (
                                    <p className="text-gray-400 text-sm">UPI: {actionModal.payment.bankDetailId.upiId}</p>
                                )}
                            </div>
                        )}

                        <div className="mb-4">
                            <label className="block text-gray-400 text-sm mb-2">
                                Admin Remarks {actionModal.action === 'reject' && <span className="text-red-400">*</span>}
                            </label>
                            <textarea
                                value={adminRemarks}
                                onChange={(e) => setAdminRemarks(e.target.value)}
                                placeholder={actionModal.action === 'approve' ? 'Optional remarks...' : 'Reason for rejection...'}
                                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white resize-none focus:outline-none focus:border-blue-500"
                                rows={3}
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={closeActionModal}
                                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAction}
                                disabled={processing || (actionModal.action === 'reject' && !adminRemarks.trim())}
                                className={`flex-1 px-4 py-2 rounded-lg text-white font-medium transition-colors disabled:opacity-50 ${
                                    actionModal.action === 'approve' 
                                        ? 'bg-green-600 hover:bg-green-700' 
                                        : 'bg-red-600 hover:bg-red-700'
                                }`}
                            >
                                {processing ? 'Processing...' : (actionModal.action === 'approve' ? 'Approve' : 'Reject')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Preview Modal */}
            {imageModal.show && (
                <div 
                    className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
                    onClick={() => setImageModal({ show: false, url: '' })}
                >
                    <div className="relative max-w-4xl max-h-[90vh]">
                        <button
                            onClick={() => setImageModal({ show: false, url: '' })}
                            className="absolute -top-10 right-0 text-white hover:text-gray-300"
                        >
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <img
                            src={imageModal.url}
                            alt="Payment proof"
                            className="max-w-full max-h-[85vh] object-contain rounded-lg"
                        />
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {detailModal.show && detailModal.payment && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl max-w-lg w-full p-6 border border-gray-700 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold">
                                {detailModal.payment.type === 'deposit' ? 'Deposit' : 'Withdrawal'} Details
                            </h3>
                            <button
                                onClick={() => setDetailModal({ show: false, payment: null })}
                                className="text-gray-400 hover:text-white"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Amount & Status */}
                        <div className="bg-gray-900 rounded-lg p-4 mb-4">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-gray-400">Amount</span>
                                <span className="text-2xl font-bold text-white">
                                    ₹{detailModal.payment.amount?.toLocaleString()}
                                </span>
                            </div>
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-gray-400">Status</span>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(detailModal.payment.status)}`}>
                                    {detailModal.payment.status.charAt(0).toUpperCase() + detailModal.payment.status.slice(1)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-gray-400">Type</span>
                                <span className={`px-2 py-1 rounded text-xs ${
                                    detailModal.payment.type === 'deposit' 
                                        ? 'bg-green-600/30 text-green-400' 
                                        : 'bg-purple-600/30 text-purple-400'
                                }`}>
                                    {detailModal.payment.type === 'deposit' ? '↓ Deposit' : '↑ Withdrawal'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400">Request ID</span>
                                <span className="text-white font-mono text-sm">
                                    #{detailModal.payment._id.slice(-8).toUpperCase()}
                                </span>
                            </div>
                        </div>

                        {/* Player Info */}
                        <div className="bg-gray-900 rounded-lg p-4 mb-4">
                            <h4 className="text-sm font-semibold text-gray-300 mb-3">Player Information</h4>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Username</span>
                                    <span className="text-white">{detailModal.payment.userId?.username || 'Unknown'}</span>
                                </div>
                                {detailModal.payment.userId?.email && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Email</span>
                                        <span className="text-white">{detailModal.payment.userId.email}</span>
                                    </div>
                                )}
                                {detailModal.payment.userId?.phone && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Phone</span>
                                        <span className="text-white">{detailModal.payment.userId.phone}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Bank Details for Withdrawals */}
                        {detailModal.payment.type === 'withdrawal' && detailModal.payment.bankDetailId && (
                            <div className="bg-gray-900 rounded-lg p-4 mb-4">
                                <h4 className="text-sm font-semibold text-gray-300 mb-3">Bank Account Details</h4>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Account Holder</span>
                                        <span className="text-white font-medium">{detailModal.payment.bankDetailId.accountHolderName}</span>
                                    </div>
                                    {detailModal.payment.bankDetailId.bankName && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Bank Name</span>
                                            <span className="text-white">{detailModal.payment.bankDetailId.bankName}</span>
                                        </div>
                                    )}
                                    {detailModal.payment.bankDetailId.accountNumber && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Account Number</span>
                                            <span className="text-white font-mono">{detailModal.payment.bankDetailId.accountNumber}</span>
                                        </div>
                                    )}
                                    {detailModal.payment.bankDetailId.ifscCode && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">IFSC Code</span>
                                            <span className="text-white font-mono">{detailModal.payment.bankDetailId.ifscCode}</span>
                                        </div>
                                    )}
                                    {detailModal.payment.bankDetailId.upiId && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">UPI ID</span>
                                            <span className="text-white font-mono">{detailModal.payment.bankDetailId.upiId}</span>
                                        </div>
                                    )}
                                    {detailModal.payment.bankDetailId.accountType && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Account Type</span>
                                            <span className="text-white capitalize">{detailModal.payment.bankDetailId.accountType.replace('_', ' ')}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Deposit Details */}
                        {detailModal.payment.type === 'deposit' && (
                            <div className="bg-gray-900 rounded-lg p-4 mb-4">
                                <h4 className="text-sm font-semibold text-gray-300 mb-3">Payment Details</h4>
                                <div className="space-y-2">
                                    {detailModal.payment.upiTransactionId && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">UTR / Transaction ID</span>
                                            <span className="text-white font-mono">{detailModal.payment.upiTransactionId}</span>
                                        </div>
                                    )}
                                    {detailModal.payment.userNote && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">User Note</span>
                                            <span className="text-white">{detailModal.payment.userNote}</span>
                                        </div>
                                    )}
                                </div>
                                {detailModal.payment.screenshotUrl && (
                                    <div className="mt-4">
                                        <p className="text-gray-500 text-sm mb-2">Payment Screenshot:</p>
                                        <img
                                            src={`${API_BASE_URL.replace('/api/v1', '')}${detailModal.payment.screenshotUrl}`}
                                            alt="Payment proof"
                                            className="w-full max-h-60 object-contain rounded-lg border border-gray-700 cursor-pointer"
                                            onClick={() => setImageModal({ 
                                                show: true, 
                                                url: `${API_BASE_URL.replace('/api/v1', '')}${detailModal.payment.screenshotUrl}` 
                                            })}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Timestamps */}
                        <div className="bg-gray-900 rounded-lg p-4 mb-4">
                            <h4 className="text-sm font-semibold text-gray-300 mb-3">Timeline</h4>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Requested</span>
                                    <span className="text-white">{formatDate(detailModal.payment.createdAt)}</span>
                                </div>
                                {detailModal.payment.processedAt && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Processed</span>
                                        <span className="text-white">{formatDate(detailModal.payment.processedAt)}</span>
                                    </div>
                                )}
                                {detailModal.payment.processedBy?.username && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Processed By</span>
                                        <span className="text-white">{detailModal.payment.processedBy.username}</span>
                                    </div>
                                )}
                                {detailModal.payment.adminRemarks && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Admin Remarks</span>
                                        <span className="text-white">{detailModal.payment.adminRemarks}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDetailModal({ show: false, payment: null })}
                                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
                            >
                                Close
                            </button>
                            {detailModal.payment.status === 'pending' && (
                                <>
                                    <button
                                        onClick={() => {
                                            setDetailModal({ show: false, payment: null });
                                            openActionModal(detailModal.payment, 'approve');
                                        }}
                                        className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white font-medium transition-colors"
                                    >
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => {
                                            setDetailModal({ show: false, payment: null });
                                            openActionModal(detailModal.payment, 'reject');
                                        }}
                                        className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white font-medium transition-colors"
                                    >
                                        Reject
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default PaymentManagement;
