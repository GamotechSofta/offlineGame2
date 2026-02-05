import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import { FaPercent, FaClock, FaCheck, FaTimes, FaHandshake, FaUser } from 'react-icons/fa';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const getAdminAuthHeaders = () => {
    const admin = JSON.parse(localStorage.getItem('admin') || '{}');
    const password = sessionStorage.getItem('adminPassword') || '';
    return {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`${admin.username}:${password}`)}`,
    };
};

const CommissionManagement = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [filter, setFilter] = useState('all');
    
    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState(''); // 'approve', 'reject', 'negotiate'
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [adminMessage, setAdminMessage] = useState('');
    const [counterOffer, setCounterOffer] = useState('');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        fetchRequests();
    }, [filter]);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const url = filter === 'all' 
                ? `${API_BASE_URL}/commission/all`
                : `${API_BASE_URL}/commission/all?status=${filter}`;
            const response = await fetch(url, {
                headers: getAdminAuthHeaders(),
            });
            const data = await response.json();
            if (data.success) {
                setRequests(data.data || []);
            } else {
                setError(data.message || 'Failed to fetch requests');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const openModal = (mode, request) => {
        setModalMode(mode);
        setSelectedRequest(request);
        setAdminMessage('');
        setCounterOffer(mode === 'negotiate' ? '' : '');
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setSelectedRequest(null);
        setModalMode('');
        setAdminMessage('');
        setCounterOffer('');
    };

    const handleAction = async () => {
        if (!selectedRequest) return;
        
        setProcessing(true);
        setError('');
        
        try {
            let url = '';
            let body = { message: adminMessage };

            switch (modalMode) {
                case 'approve':
                    url = `${API_BASE_URL}/commission/approve/${selectedRequest._id}`;
                    break;
                case 'reject':
                    url = `${API_BASE_URL}/commission/reject/${selectedRequest._id}`;
                    break;
                case 'negotiate':
                    url = `${API_BASE_URL}/commission/negotiate/${selectedRequest._id}`;
                    const offer = parseFloat(counterOffer);
                    if (isNaN(offer) || offer < 0 || offer > 100) {
                        setError('Please enter a valid counter offer between 0 and 100');
                        setProcessing(false);
                        return;
                    }
                    body.counterOffer = offer;
                    break;
                default:
                    return;
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: getAdminAuthHeaders(),
                body: JSON.stringify(body),
            });

            const data = await response.json();
            if (data.success) {
                setSuccess(`Request ${modalMode}${modalMode === 'negotiate' ? 'd' : 'ed'} successfully!`);
                closeModal();
                fetchRequests();
                setTimeout(() => setSuccess(''), 3000);
            } else {
                setError(data.message || `Failed to ${modalMode} request`);
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setProcessing(false);
        }
    };

    const getStatusBadge = (status) => {
        const styles = {
            pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
            approved: 'bg-green-500/20 text-green-400 border-green-500/50',
            rejected: 'bg-red-500/20 text-red-400 border-red-500/50',
            negotiation: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
        };
        const icons = {
            pending: <FaClock className="w-3 h-3" />,
            approved: <FaCheck className="w-3 h-3" />,
            rejected: <FaTimes className="w-3 h-3" />,
            negotiation: <FaHandshake className="w-3 h-3" />,
        };
        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status]}`}>
                {icons[status]}
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
        );
    };

    const pendingCount = requests.filter(r => r.status === 'pending').length;

    return (
        <AdminLayout title="Commission Management">
            <div className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold mb-1">Commission Management</h1>
                <p className="text-gray-400 text-sm">Review and manage bookie commission requests</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700/50">
                    <p className="text-gray-400 text-sm">Total Requests</p>
                    <p className="text-2xl font-bold text-white">{requests.length}</p>
                </div>
                <div className="bg-yellow-900/30 rounded-xl p-4 border border-yellow-600/50">
                    <p className="text-yellow-400 text-sm">Pending</p>
                    <p className="text-2xl font-bold text-yellow-400">{pendingCount}</p>
                </div>
                <div className="bg-green-900/30 rounded-xl p-4 border border-green-600/50">
                    <p className="text-green-400 text-sm">Approved</p>
                    <p className="text-2xl font-bold text-green-400">
                        {requests.filter(r => r.status === 'approved').length}
                    </p>
                </div>
                <div className="bg-blue-900/30 rounded-xl p-4 border border-blue-600/50">
                    <p className="text-blue-400 text-sm">In Negotiation</p>
                    <p className="text-2xl font-bold text-blue-400">
                        {requests.filter(r => r.status === 'negotiation').length}
                    </p>
                </div>
            </div>

            {/* Messages */}
            {error && (
                <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
                    {error}
                </div>
            )}
            {success && (
                <div className="mb-4 p-4 bg-green-900/50 border border-green-700 rounded-lg text-green-200">
                    {success}
                </div>
            )}

            {/* Filter */}
            <div className="mb-4 flex flex-wrap gap-2">
                {['all', 'pending', 'approved', 'rejected', 'negotiation'].map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            filter === f
                                ? 'bg-yellow-500 text-black'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                    >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                        {f === 'pending' && pendingCount > 0 && (
                            <span className="ml-2 bg-red-500 text-white px-1.5 py-0.5 rounded-full text-xs">
                                {pendingCount}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Requests Table */}
            <div className="bg-gray-800 rounded-xl border border-gray-700/50 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto"></div>
                        <p className="mt-4 text-gray-400">Loading requests...</p>
                    </div>
                ) : requests.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        <FaPercent className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No commission requests found.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-700">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Bookie</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Current %</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Requested %</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Message</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Date</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {requests.map((request) => (
                                    <tr key={request._id} className="hover:bg-gray-700/30">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="bg-gray-600 p-2 rounded-full">
                                                    <FaUser className="w-3 h-3 text-gray-300" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-white">
                                                        {request.bookieId?.username || 'Unknown'}
                                                    </p>
                                                    <p className="text-xs text-gray-400">
                                                        {request.bookieId?.phone || '-'}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-300">
                                            {request.currentPercentage || 0}%
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-xl font-bold text-yellow-400">
                                                {request.requestedPercentage}%
                                            </span>
                                            {request.counterOffer !== undefined && request.status === 'negotiation' && (
                                                <p className="text-xs text-blue-400 mt-1">
                                                    Counter: {request.counterOffer}%
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {getStatusBadge(request.status)}
                                        </td>
                                        <td className="px-4 py-3 max-w-xs">
                                            <p className="text-gray-300 text-sm truncate">
                                                {request.bookieMessage || '-'}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 text-gray-400 text-sm">
                                            {new Date(request.createdAt).toLocaleDateString('en-IN', {
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric',
                                            })}
                                        </td>
                                        <td className="px-4 py-3">
                                            {request.status === 'pending' && (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => openModal('approve', request)}
                                                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium"
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() => openModal('negotiate', request)}
                                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium"
                                                    >
                                                        Negotiate
                                                    </button>
                                                    <button
                                                        onClick={() => openModal('reject', request)}
                                                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium"
                                                    >
                                                        Reject
                                                    </button>
                                                </div>
                                            )}
                                            {request.status !== 'pending' && (
                                                <span className="text-gray-500 text-sm">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Action Modal */}
            {showModal && selectedRequest && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
                        <h3 className="text-xl font-bold text-white mb-4">
                            {modalMode === 'approve' && 'Approve Request'}
                            {modalMode === 'reject' && 'Reject Request'}
                            {modalMode === 'negotiate' && 'Send Counter Offer'}
                        </h3>

                        <div className="mb-4 p-4 bg-gray-700/50 rounded-lg">
                            <p className="text-gray-400 text-sm">Bookie: <span className="text-white">{selectedRequest.bookieId?.username}</span></p>
                            <p className="text-gray-400 text-sm">Requested: <span className="text-yellow-400 font-bold">{selectedRequest.requestedPercentage}%</span></p>
                        </div>

                        {modalMode === 'negotiate' && (
                            <div className="mb-4">
                                <label className="block text-gray-300 text-sm font-medium mb-2">
                                    Counter Offer (%)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.5"
                                    value={counterOffer}
                                    onChange={(e) => setCounterOffer(e.target.value)}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                    placeholder="Enter your counter offer"
                                    required
                                />
                            </div>
                        )}

                        <div className="mb-4">
                            <label className="block text-gray-300 text-sm font-medium mb-2">
                                Message to Bookie (Optional)
                            </label>
                            <textarea
                                value={adminMessage}
                                onChange={(e) => setAdminMessage(e.target.value)}
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                                placeholder="Add a message..."
                                rows={3}
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={closeModal}
                                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAction}
                                disabled={processing || (modalMode === 'negotiate' && !counterOffer)}
                                className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                                    modalMode === 'approve' ? 'bg-green-600 hover:bg-green-700 text-white' :
                                    modalMode === 'reject' ? 'bg-red-600 hover:bg-red-700 text-white' :
                                    'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                            >
                                {processing ? 'Processing...' : (
                                    modalMode === 'approve' ? 'Approve' :
                                    modalMode === 'reject' ? 'Reject' : 'Send Counter'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default CommissionManagement;
