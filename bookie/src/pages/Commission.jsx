import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { API_BASE_URL, getBookieAuthHeaders } from '../utils/api';
import { FaPercent, FaClock, FaCheck, FaTimes, FaHandshake, FaPaperPlane } from 'react-icons/fa';

const Commission = () => {
    const [currentCommission, setCurrentCommission] = useState(0);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    
    // New request form
    const [requestedPercentage, setRequestedPercentage] = useState('');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchCommissionData();
    }, []);

    const fetchCommissionData = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/commission/my-requests`, {
                headers: getBookieAuthHeaders(),
            });
            const data = await response.json();
            if (data.success) {
                setCurrentCommission(data.data.currentCommission || 0);
                setRequests(data.data.requests || []);
            } else {
                setError(data.message || 'Failed to fetch commission data');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitRequest = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        const percentage = parseFloat(requestedPercentage);
        if (isNaN(percentage) || percentage < 0 || percentage > 100) {
            setError('Please enter a valid percentage between 0 and 100');
            return;
        }

        try {
            setSubmitting(true);
            const response = await fetch(`${API_BASE_URL}/commission/request`, {
                method: 'POST',
                headers: getBookieAuthHeaders(),
                body: JSON.stringify({
                    requestedPercentage: percentage,
                    message: message.trim(),
                }),
            });
            const data = await response.json();
            if (data.success) {
                setSuccess('Commission request submitted successfully!');
                setRequestedPercentage('');
                setMessage('');
                fetchCommissionData();
            } else {
                setError(data.message || 'Failed to submit request');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAcceptCounter = async (requestId) => {
        try {
            const response = await fetch(`${API_BASE_URL}/commission/accept-counter/${requestId}`, {
                method: 'POST',
                headers: getBookieAuthHeaders(),
            });
            const data = await response.json();
            if (data.success) {
                setSuccess('Counter offer accepted!');
                fetchCommissionData();
            } else {
                setError(data.message || 'Failed to accept counter offer');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        }
    };

    const handleRejectCounter = async (requestId) => {
        try {
            const response = await fetch(`${API_BASE_URL}/commission/reject-counter/${requestId}`, {
                method: 'POST',
                headers: getBookieAuthHeaders(),
            });
            const data = await response.json();
            if (data.success) {
                setSuccess('Counter offer rejected.');
                fetchCommissionData();
            } else {
                setError(data.message || 'Failed to reject counter offer');
            }
        } catch (err) {
            setError('Network error. Please try again.');
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

    const hasPendingRequest = requests.some(r => r.status === 'pending');

    return (
        <Layout title="Commission">
            <div className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold mb-1">Commission Request</h1>
                <p className="text-gray-400 text-sm">Request your commission percentage from Super Admin</p>
            </div>

            {/* Current Commission Card */}
            <div className="bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 rounded-xl p-6 border border-yellow-500/30 mb-6">
                <div className="flex items-center gap-4">
                    <div className="bg-yellow-500/30 p-4 rounded-xl">
                        <FaPercent className="text-yellow-400 text-2xl" />
                    </div>
                    <div>
                        <p className="text-gray-400 text-sm">Your Current Commission</p>
                        <p className="text-3xl font-bold text-yellow-400">{currentCommission}%</p>
                    </div>
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

            {/* New Request Form */}
            {!hasPendingRequest && (
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700/50 mb-6">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <FaPaperPlane className="text-yellow-500" />
                        Request New Commission
                    </h2>
                    <form onSubmit={handleSubmitRequest} className="space-y-4">
                        <div>
                            <label className="block text-gray-300 text-sm font-medium mb-2">
                                Requested Percentage (%)
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                                value={requestedPercentage}
                                onChange={(e) => setRequestedPercentage(e.target.value)}
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                placeholder="Enter percentage (0-100)"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-gray-300 text-sm font-medium mb-2">
                                Message (Optional)
                            </label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                                placeholder="Add a message for the admin..."
                                rows={3}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-semibold rounded-xl transition-all disabled:opacity-50"
                        >
                            {submitting ? 'Submitting...' : 'Submit Request'}
                        </button>
                    </form>
                </div>
            )}

            {hasPendingRequest && (
                <div className="bg-yellow-900/30 border border-yellow-600/50 rounded-xl p-4 mb-6">
                    <p className="text-yellow-300 flex items-center gap-2">
                        <FaClock />
                        You have a pending request. Please wait for admin response before submitting a new request.
                    </p>
                </div>
            )}

            {/* Request History */}
            <div className="bg-gray-800 rounded-xl border border-gray-700/50 overflow-hidden">
                <div className="p-4 border-b border-gray-700">
                    <h2 className="text-lg font-semibold text-white">Request History</h2>
                </div>

                {loading ? (
                    <div className="p-8 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto"></div>
                        <p className="mt-4 text-gray-400">Loading...</p>
                    </div>
                ) : requests.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        <p>No commission requests yet.</p>
                        <p className="text-sm mt-2">Submit your first request above.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-700">
                        {requests.map((request) => (
                            <div key={request._id} className="p-4 hover:bg-gray-700/30">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-xl font-bold text-white">
                                                {request.requestedPercentage}%
                                            </span>
                                            {getStatusBadge(request.status)}
                                        </div>
                                        
                                        {request.bookieMessage && (
                                            <p className="text-gray-400 text-sm mb-2">
                                                <span className="text-gray-500">Your message:</span> {request.bookieMessage}
                                            </p>
                                        )}
                                        
                                        {request.adminResponse && (
                                            <p className="text-gray-300 text-sm mb-2">
                                                <span className="text-gray-500">Admin response:</span> {request.adminResponse}
                                            </p>
                                        )}

                                        {request.status === 'negotiation' && request.counterOffer !== undefined && (
                                            <div className="bg-blue-900/30 border border-blue-600/50 rounded-lg p-3 mt-3">
                                                <p className="text-blue-300 font-medium mb-2">
                                                    Counter Offer: <span className="text-xl">{request.counterOffer}%</span>
                                                </p>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleAcceptCounter(request._id)}
                                                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                                                    >
                                                        Accept
                                                    </button>
                                                    <button
                                                        onClick={() => handleRejectCounter(request._id)}
                                                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                                                    >
                                                        Reject
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        <p className="text-gray-500 text-xs mt-2">
                                            {new Date(request.createdAt).toLocaleString('en-IN', {
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default Commission;
