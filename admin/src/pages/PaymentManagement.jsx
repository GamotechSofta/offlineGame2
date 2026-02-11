import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import { useNavigate } from 'react-router-dom';
import { FaArrowDown, FaArrowUp, FaClock, FaFilter, FaEye, FaCheck, FaTimes, FaImage, FaWallet } from 'react-icons/fa';

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
    const [hasSecretDeclarePassword, setHasSecretDeclarePassword] = useState(false);
    const [secretPassword, setSecretPassword] = useState('');
    const [actionPasswordError, setActionPasswordError] = useState('');

    // Image preview modal
    const [imageModal, setImageModal] = useState({ show: false, url: '' });

    // Detail modal for viewing full payment details
    const [detailModal, setDetailModal] = useState({ show: false, payment: null });

    useEffect(() => {
        fetchPayments();
        fetchPendingCounts();
    }, [filters]);

    useEffect(() => {
        fetch(`${API_BASE_URL}/admin/me/secret-declare-password-status`, { headers: getAuthHeaders() })
            .then((res) => res.json())
            .then((json) => {
                if (json.success) setHasSecretDeclarePassword(json.hasSecretDeclarePassword || false);
            })
            .catch(() => setHasSecretDeclarePassword(false));
    }, []);

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
        setSecretPassword('');
        setActionPasswordError('');
    };

    const closeActionModal = () => {
        setActionModal({ show: false, payment: null, action: '' });
        setAdminRemarks('');
        setSecretPassword('');
        setActionPasswordError('');
    };

    const handleAction = async () => {
        if (!actionModal.payment || !actionModal.action) return;
        if (actionModal.action === 'approve' && hasSecretDeclarePassword && !secretPassword.trim()) {
            setActionPasswordError('Please enter the secret declare password');
            return;
        }

        setProcessing(true);
        setActionPasswordError('');
        try {
            const endpoint = actionModal.action === 'approve'
                ? `${API_BASE_URL}/payments/${actionModal.payment._id}/approve`
                : `${API_BASE_URL}/payments/${actionModal.payment._id}/reject`;

            const body = { adminRemarks };
            if (actionModal.action === 'approve' && hasSecretDeclarePassword) {
                body.secretDeclarePassword = secretPassword.trim();
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(body),
            });
            const data = await response.json();
            if (data.success) {
                fetchPayments();
                fetchPendingCounts();
                closeActionModal();
            } else {
                if (data.code === 'INVALID_SECRET_DECLARE_PASSWORD') {
                    setActionPasswordError(data.message || 'Invalid secret password');
                } else {
                    alert(data.message || 'Action failed');
                }
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
            pending: 'bg-orange-50 text-orange-600 border-orange-200',
            approved: 'bg-green-600/30 text-green-600 border-green-600/50',
            rejected: 'bg-red-600/30 text-red-500 border-red-600/50',
            completed: 'bg-blue-600/30 text-blue-600 border-blue-600/50',
        };
        return styles[status] || 'bg-gray-200/30 text-gray-400 border-gray-200';
    };

    const getTypeBadge = (type) => {
        return type === 'deposit' 
            ? 'bg-green-600/20 text-green-600 border-green-600/40'
            : 'bg-purple-600/20 text-purple-600 border-purple-600/40';
    };

    const hasActiveFilters = filters.status || filters.type;
    const pendingRequireAction = pendingCounts.total > 0;

    return (
        <AdminLayout onLogout={handleLogout} title="Payments">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-3">
                    <FaWallet className="text-orange-500" />
                    Payment Management
                </h1>
                <p className="mt-2 text-gray-400 text-sm sm:text-base max-w-2xl">
                    Review and process player deposit & withdrawal requests. Click on stats below to quickly filter by type.
                </p>
            </div>

            {/* Quick Stats – clickable for quick filter */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div
                    className={`rounded-xl p-5 border-2 transition-all cursor-pointer ${
                        filters.status === 'pending' && filters.type === 'deposit'
                            ? 'border-amber-500 bg-orange-500/10'
                            : 'border-gray-200 bg-white hover:border-gray-200'
                    }`}
                    onClick={() => setFilters({ status: 'pending', type: 'deposit' })}
                    title="Click to view pending deposits"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Pending Deposits</p>
                            <p className="text-2xl sm:text-3xl font-bold text-orange-500 mt-1">{pendingCounts.deposits}</p>
                            <p className="text-xs text-gray-500 mt-1">Click to filter</p>
                        </div>
                        <FaArrowDown className="w-10 h-10 text-orange-500/50" />
                    </div>
                </div>
                <div
                    className={`rounded-xl p-5 border-2 transition-all cursor-pointer ${
                        filters.status === 'pending' && filters.type === 'withdrawal'
                            ? 'border-amber-500 bg-orange-500/10'
                            : 'border-gray-200 bg-white hover:border-gray-200'
                    }`}
                    onClick={() => setFilters({ status: 'pending', type: 'withdrawal' })}
                    title="Click to view pending withdrawals"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Pending Withdrawals</p>
                            <p className="text-2xl sm:text-3xl font-bold text-orange-500 mt-1">{pendingCounts.withdrawals}</p>
                            <p className="text-xs text-gray-500 mt-1">Click to filter</p>
                        </div>
                        <FaArrowUp className="w-10 h-10 text-purple-500/50" />
                    </div>
                </div>
                <div
                    className={`rounded-xl p-5 border-2 transition-all cursor-pointer ${
                        !hasActiveFilters || (filters.status === '' && filters.type === '')
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-gray-200 bg-white hover:border-gray-200'
                    }`}
                    onClick={() => setFilters({ status: '', type: '' })}
                    title="Click to view all payments"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Pending</p>
                            <p className="text-2xl sm:text-3xl font-bold text-blue-600 mt-1">{pendingCounts.total}</p>
                            <p className="text-xs text-gray-500 mt-1">{pendingRequireAction ? 'Requires action' : 'All clear'}</p>
                        </div>
                        <FaClock className="w-10 h-10 text-blue-500/50" />
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl p-4 sm:p-5 mb-6 border border-gray-200">
                <div className="flex items-center gap-2 mb-3">
                    <FaFilter className="text-gray-500 w-4 h-4" />
                    <span className="text-sm font-medium text-gray-400">Filter Payments</span>
                    {hasActiveFilters && (
                        <span className="ml-2 px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-500 text-xs">
                            Filters active
                        </span>
                    )}
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 sm:max-w-[180px]">
                        <label className="block text-xs text-gray-500 mb-1">Status</label>
                        <select
                            value={filters.status}
                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                            className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-gray-800 focus:ring-2 focus:ring-amber-500/50"
                        >
                            <option value="">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>
                    <div className="flex-1 sm:max-w-[180px]">
                        <label className="block text-xs text-gray-500 mb-1">Type</label>
                        <select
                            value={filters.type}
                            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                            className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-gray-800 focus:ring-2 focus:ring-amber-500/50"
                        >
                            <option value="">All Types</option>
                            <option value="deposit">Deposit</option>
                            <option value="withdrawal">Withdrawal</option>
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={() => setFilters({ status: '', type: '' })}
                            className="px-4 py-2.5 bg-gray-200 hover:bg-gray-500 rounded-lg text-gray-800 text-sm font-medium transition-colors"
                        >
                            Clear Filters
                        </button>
                    </div>
                </div>
            </div>

            {/* Summary bar */}
            {!loading && (
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <p className="text-sm text-gray-400">
                        Showing <span className="font-semibold text-gray-800">{payments.length}</span> payment{payments.length !== 1 ? 's' : ''}
                        {hasActiveFilters && (
                            <span className="ml-2 text-orange-500">(filtered)</span>
                        )}
                    </p>
                    {pendingRequireAction && payments.some((p) => p.status === 'pending') && (
                        <p className="text-xs text-orange-500 flex items-center gap-2">
                            <FaClock className="w-3.5 h-3.5" />
                            Some payments need your approval
                        </p>
                    )}
                </div>
            )}

            {/* Payments Table */}
            {loading ? (
                <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                    <div className="animate-spin rounded-full h-12 w-12 border-2 border-amber-500 border-t-transparent mx-auto mb-4"></div>
                    <p className="text-gray-400">Loading payments...</p>
                    <p className="text-gray-500 text-sm mt-1">Please wait</p>
                </div>
            ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0 rounded-xl border border-gray-200 overflow-hidden">
                    <div className="bg-white min-w-[1080px]">
                        <table className="w-full text-sm table-fixed">
                            <thead className="bg-gray-50/80">
                                <tr>
                                    <th className="w-[90px] px-4 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Ref ID</th>
                                    <th className="w-[180px] px-4 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Player</th>
                                    <th className="w-[100px] px-4 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Type</th>
                                    <th className="w-[110px] px-4 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Amount</th>
                                    <th className="w-[200px] px-4 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                        Payment Info
                                    </th>
                                    <th className="w-[120px] px-4 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                                    <th className="w-[170px] px-4 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                                    <th className="w-[180px] px-4 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                        <span className="block">Actions</span>
                                        <span className="block font-normal normal-case text-gray-500 mt-0.5">View / Approve / Reject</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {payments.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="px-6 py-16 text-center">
                                            <div className="max-w-sm mx-auto">
                                                <FaWallet className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                                                <p className="text-gray-400 font-medium mb-1">No payments found</p>
                                                <p className="text-gray-500 text-sm">
                                                    {hasActiveFilters
                                                        ? 'Try clearing filters or change your filter criteria.'
                                                        : 'Payments will appear here when players request deposits or withdrawals.'}
                                                </p>
                                                {hasActiveFilters && (
                                                    <button
                                                        onClick={() => setFilters({ status: '', type: '' })}
                                                        className="mt-4 px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg text-gray-800 text-sm font-medium"
                                                    >
                                                        Clear Filters
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    payments.map((payment) => (
                                        <tr key={payment._id} className="hover:bg-gray-50">
                                            <td className="px-4 py-4 text-xs text-gray-400 whitespace-nowrap">
                                                #{payment._id.slice(-6).toUpperCase()}
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="truncate">
                                                    <p className="font-medium text-gray-800 truncate">
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
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <span className={`font-semibold ${payment.type === 'deposit' ? 'text-green-600' : 'text-purple-600'}`}>
                                                    {payment.type === 'deposit' ? '+' : '-'} ₹{payment.amount?.toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4">
                                                {payment.type === 'deposit' ? (
                                                    <div className="space-y-1.5">
                                                        {payment.upiTransactionId && (
                                                            <p className="text-xs text-gray-400 truncate">
                                                                UTR: <span className="text-gray-800 font-mono">{payment.upiTransactionId}</span>
                                                            </p>
                                                        )}
                                                        {payment.screenshotUrl && (
                                                            <button
                                                                onClick={() => setImageModal({ 
                                                                    show: true, 
                                                                    url: payment.screenshotUrl.startsWith('http') ? payment.screenshotUrl : `${API_BASE_URL.replace('/api/v1', '')}${payment.screenshotUrl}` 
                                                                })}
                                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-600/20 border border-blue-500/40 rounded text-xs text-blue-600 hover:bg-blue-600/30 transition-colors"
                                                                title="View screenshot"
                                                            >
                                                                <FaImage className="w-3.5 h-3.5" /> Screenshot
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
                                                                <p className="text-xs text-gray-800 font-medium truncate">
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
                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        onClick={() => setDetailModal({ show: true, payment })}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600/20 border border-blue-500/40 hover:bg-blue-600/30 rounded-lg text-xs font-medium text-blue-600 transition-colors"
                                                        title="View full payment details"
                                                    >
                                                        <FaEye className="w-3.5 h-3.5 shrink-0" /> View Details
                                                    </button>
                                                    {payment.status === 'pending' ? (
                                                        <>
                                                            <button
                                                                onClick={() => openActionModal(payment, 'approve')}
                                                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-xs font-medium text-gray-800 transition-colors"
                                                                title="Approve – add money to player wallet"
                                                            >
                                                                <FaCheck className="w-3.5 h-3.5 shrink-0" /> Approve
                                                            </button>
                                                            <button
                                                                onClick={() => openActionModal(payment, 'reject')}
                                                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-xs font-medium text-gray-800 transition-colors"
                                                                title="Reject – decline this request"
                                                            >
                                                                <FaTimes className="w-3.5 h-3.5 shrink-0" /> Reject
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <span className="text-xs text-gray-500 italic">Processed</span>
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
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-md w-full p-6 border border-gray-200 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            {actionModal.action === 'approve' ? (
                                <div className="w-10 h-10 rounded-full bg-green-600/20 flex items-center justify-center">
                                    <FaCheck className="w-5 h-5 text-green-600" />
                                </div>
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-red-600/20 flex items-center justify-center">
                                    <FaTimes className="w-5 h-5 text-red-500" />
                                </div>
                            )}
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">
                                    {actionModal.action === 'approve' ? 'Approve' : 'Reject'} {actionModal.payment?.type === 'deposit' ? 'Deposit' : 'Withdrawal'}
                                </h3>
                                <p className="text-sm text-gray-400 mt-0.5">
                                    {actionModal.action === 'approve' ? 'Credit will be added to player wallet' : 'Request will be declined'}
                                </p>
                            </div>
                        </div>
                        
                        <div className="bg-gray-50 rounded-lg p-4 mb-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-gray-400">Amount</span>
                                <span className="text-xl font-bold text-gray-800">
                                    ₹{actionModal.payment?.amount?.toLocaleString()}
                                </span>
                            </div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-gray-400">Player</span>
                                <span className="text-gray-800">
                                    {actionModal.payment?.userId?.username || 'Unknown'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400">Type</span>
                                <span className={`px-2 py-1 rounded text-xs ${
                                    actionModal.payment?.type === 'deposit' 
                                        ? 'bg-green-600/30 text-green-600' 
                                        : 'bg-purple-600/30 text-purple-600'
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
                                    src={actionModal.payment.screenshotUrl.startsWith('http') ? actionModal.payment.screenshotUrl : `${API_BASE_URL.replace('/api/v1', '')}${actionModal.payment.screenshotUrl}`}
                                    alt="Payment proof"
                                    className="w-full max-h-48 object-contain rounded-lg border border-gray-200 cursor-pointer"
                                    onClick={() => setImageModal({ 
                                        show: true, 
                                        url: actionModal.payment.screenshotUrl.startsWith('http') ? actionModal.payment.screenshotUrl : `${API_BASE_URL.replace('/api/v1', '')}${actionModal.payment.screenshotUrl}` 
                                    })}
                                />
                            </div>
                        )}

                        {/* Show bank details for withdrawals */}
                        {actionModal.payment?.type === 'withdrawal' && actionModal.payment?.bankDetailId && (
                            <div className="mb-4 bg-gray-50 rounded-lg p-3">
                                <p className="text-gray-400 text-sm mb-2">Withdraw to:</p>
                                <p className="text-gray-800 font-medium">{actionModal.payment.bankDetailId.accountHolderName}</p>
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
                                Admin Remarks {actionModal.action === 'reject' && <span className="text-red-500">*</span>}
                            </label>
                            <textarea
                                value={adminRemarks}
                                onChange={(e) => setAdminRemarks(e.target.value)}
                                placeholder={actionModal.action === 'approve' ? 'Optional remarks...' : 'Reason for rejection...'}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 resize-none focus:outline-none focus:border-blue-500"
                                rows={3}
                            />
                        </div>

                        {actionModal.action === 'approve' && hasSecretDeclarePassword && (
                            <div className="mb-4">
                                <label className="block text-gray-400 text-sm mb-2">Secret declare password *</label>
                                <input
                                    type="password"
                                    placeholder="Secret declare password"
                                    value={secretPassword}
                                    onChange={(e) => { setSecretPassword(e.target.value); setActionPasswordError(''); }}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:border-blue-500"
                                />
                                {actionPasswordError && (
                                    <p className="text-red-500 text-sm mt-2">{actionPasswordError}</p>
                                )}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={closeActionModal}
                                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAction}
                                disabled={
                                    processing ||
                                    (actionModal.action === 'reject' && !adminRemarks.trim()) ||
                                    (actionModal.action === 'approve' && hasSecretDeclarePassword && !secretPassword.trim())
                                }
                                className={`flex-1 px-4 py-2 rounded-lg text-gray-800 font-medium transition-colors disabled:opacity-50 ${
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
                            className="absolute -top-10 right-0 text-gray-800 hover:text-gray-600"
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
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-lg w-full p-6 border border-gray-200 max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${detailModal.payment.type === 'deposit' ? 'bg-green-600/20' : 'bg-purple-600/20'}`}>
                                    {detailModal.payment.type === 'deposit' ? (
                                        <FaArrowDown className="w-5 h-5 text-green-600" />
                                    ) : (
                                        <FaArrowUp className="w-5 h-5 text-purple-600" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800">
                                        {detailModal.payment.type === 'deposit' ? 'Deposit' : 'Withdrawal'} Details
                                    </h3>
                                    <p className="text-sm text-gray-400">
                                        Full payment information
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setDetailModal({ show: false, payment: null })}
                                className="text-gray-400 hover:text-gray-800"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Amount & Status */}
                        <div className="bg-gray-50 rounded-lg p-4 mb-4">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-gray-400">Amount</span>
                                <span className="text-2xl font-bold text-gray-800">
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
                                        ? 'bg-green-600/30 text-green-600' 
                                        : 'bg-purple-600/30 text-purple-600'
                                }`}>
                                    {detailModal.payment.type === 'deposit' ? '↓ Deposit' : '↑ Withdrawal'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400">Request ID</span>
                                <span className="text-gray-800 font-mono text-sm">
                                    #{detailModal.payment._id.slice(-8).toUpperCase()}
                                </span>
                            </div>
                        </div>

                        {/* Player Info */}
                        <div className="bg-gray-50 rounded-lg p-4 mb-4">
                            <h4 className="text-sm font-semibold text-gray-600 mb-3">Player Information</h4>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Username</span>
                                    <span className="text-gray-800">{detailModal.payment.userId?.username || 'Unknown'}</span>
                                </div>
                                {detailModal.payment.userId?.email && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Email</span>
                                        <span className="text-gray-800">{detailModal.payment.userId.email}</span>
                                    </div>
                                )}
                                {detailModal.payment.userId?.phone && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Phone</span>
                                        <span className="text-gray-800">{detailModal.payment.userId.phone}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Bank Details for Withdrawals */}
                        {detailModal.payment.type === 'withdrawal' && detailModal.payment.bankDetailId && (
                            <div className="bg-gray-50 rounded-lg p-4 mb-4">
                                <h4 className="text-sm font-semibold text-gray-600 mb-3">Bank Account Details</h4>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Account Holder</span>
                                        <span className="text-gray-800 font-medium">{detailModal.payment.bankDetailId.accountHolderName}</span>
                                    </div>
                                    {detailModal.payment.bankDetailId.bankName && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Bank Name</span>
                                            <span className="text-gray-800">{detailModal.payment.bankDetailId.bankName}</span>
                                        </div>
                                    )}
                                    {detailModal.payment.bankDetailId.accountNumber && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Account Number</span>
                                            <span className="text-gray-800 font-mono">{detailModal.payment.bankDetailId.accountNumber}</span>
                                        </div>
                                    )}
                                    {detailModal.payment.bankDetailId.ifscCode && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">IFSC Code</span>
                                            <span className="text-gray-800 font-mono">{detailModal.payment.bankDetailId.ifscCode}</span>
                                        </div>
                                    )}
                                    {detailModal.payment.bankDetailId.upiId && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">UPI ID</span>
                                            <span className="text-gray-800 font-mono">{detailModal.payment.bankDetailId.upiId}</span>
                                        </div>
                                    )}
                                    {detailModal.payment.bankDetailId.accountType && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Account Type</span>
                                            <span className="text-gray-800 capitalize">{detailModal.payment.bankDetailId.accountType.replace('_', ' ')}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Deposit Details */}
                        {detailModal.payment.type === 'deposit' && (
                            <div className="bg-gray-50 rounded-lg p-4 mb-4">
                                <h4 className="text-sm font-semibold text-gray-600 mb-3">Payment Details</h4>
                                <div className="space-y-2">
                                    {detailModal.payment.upiTransactionId && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">UTR / Transaction ID</span>
                                            <span className="text-gray-800 font-mono">{detailModal.payment.upiTransactionId}</span>
                                        </div>
                                    )}
                                    {detailModal.payment.userNote && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">User Note</span>
                                            <span className="text-gray-800">{detailModal.payment.userNote}</span>
                                        </div>
                                    )}
                                </div>
                                {detailModal.payment.screenshotUrl && (
                                    <div className="mt-4">
                                        <p className="text-gray-500 text-sm mb-2">Payment Screenshot:</p>
                                        <img
                                            src={detailModal.payment.screenshotUrl.startsWith('http') ? detailModal.payment.screenshotUrl : `${API_BASE_URL.replace('/api/v1', '')}${detailModal.payment.screenshotUrl}`}
                                            alt="Payment proof"
                                            className="w-full max-h-60 object-contain rounded-lg border border-gray-200 cursor-pointer"
                                            onClick={() => setImageModal({ 
                                                show: true, 
                                                url: detailModal.payment.screenshotUrl.startsWith('http') ? detailModal.payment.screenshotUrl : `${API_BASE_URL.replace('/api/v1', '')}${detailModal.payment.screenshotUrl}` 
                                            })}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Timestamps */}
                        <div className="bg-gray-50 rounded-lg p-4 mb-4">
                            <h4 className="text-sm font-semibold text-gray-600 mb-3">Timeline</h4>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Requested</span>
                                    <span className="text-gray-800">{formatDate(detailModal.payment.createdAt)}</span>
                                </div>
                                {detailModal.payment.processedAt && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Processed</span>
                                        <span className="text-gray-800">{formatDate(detailModal.payment.processedAt)}</span>
                                    </div>
                                )}
                                {detailModal.payment.processedBy?.username && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Processed By</span>
                                        <span className="text-gray-800">{detailModal.payment.processedBy.username}</span>
                                    </div>
                                )}
                                {detailModal.payment.adminRemarks && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Admin Remarks</span>
                                        <span className="text-gray-800">{detailModal.payment.adminRemarks}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDetailModal({ show: false, payment: null })}
                                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-800 transition-colors"
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
                                        className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-gray-800 font-medium transition-colors"
                                    >
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => {
                                            setDetailModal({ show: false, payment: null });
                                            openActionModal(detailModal.payment, 'reject');
                                        }}
                                        className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-gray-800 font-medium transition-colors"
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
