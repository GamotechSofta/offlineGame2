import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const PaymentManagement = () => {
    const navigate = useNavigate();
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        status: '',
        type: '',
    });

    useEffect(() => {
        fetchPayments();
    }, [filters]);

    const fetchPayments = async () => {
        try {
            setLoading(true);
            const admin = JSON.parse(localStorage.getItem('admin'));
            const password = sessionStorage.getItem('adminPassword') || '';
            const queryParams = new URLSearchParams();
            if (filters.status) queryParams.append('status', filters.status);
            if (filters.type) queryParams.append('type', filters.type);

            const response = await fetch(`${API_BASE_URL}/payments?${queryParams}`, {
                headers: {
                    'Authorization': `Basic ${btoa(`${admin.username}:${password}`)}`,
                },
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

    const handleStatusUpdate = async (paymentId, newStatus) => {
        try {
            const admin = JSON.parse(localStorage.getItem('admin'));
            const password = sessionStorage.getItem('adminPassword') || '';
            const response = await fetch(`${API_BASE_URL}/payments/${paymentId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${btoa(`${admin.username}:${password}`)}`,
                },
                body: JSON.stringify({ status: newStatus }),
            });
            const data = await response.json();
            if (data.success) {
                fetchPayments();
            }
        } catch (err) {
            console.error('Error updating payment:', err);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('admin');
        sessionStorage.removeItem('adminPassword');
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white flex">
            <Sidebar onLogout={handleLogout} />
            <div className="flex-1">
                <div className="p-8">
                    <h1 className="text-3xl font-bold mb-6">Payment Management</h1>

                    {/* Filters */}
                    <div className="bg-gray-800 rounded-lg p-4 mb-6 flex gap-4">
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
                    </div>

                    {/* Payments Table */}
                    {loading ? (
                        <div className="text-center py-12">
                            <p className="text-gray-400">Loading payments...</p>
                        </div>
                    ) : (
                        <div className="bg-gray-800 rounded-lg overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-700">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">ID</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">User</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Type</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Amount</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Method</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Date</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {payments.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" className="px-6 py-4 text-center text-gray-400">
                                                No payments found
                                            </td>
                                        </tr>
                                    ) : (
                                        payments.map((payment) => (
                                            <tr key={payment._id} className="hover:bg-gray-700">
                                                <td className="px-6 py-4 text-sm">{payment._id.slice(-8)}</td>
                                                <td className="px-6 py-4 text-sm">{payment.userId?.username || payment.userId}</td>
                                                <td className="px-6 py-4 text-sm">
                                                    <span className={`px-2 py-1 rounded text-xs ${
                                                        payment.type === 'deposit' ? 'bg-green-600' : 'bg-blue-600'
                                                    }`}>
                                                        {payment.type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm">₹{payment.amount}</td>
                                                <td className="px-6 py-4 text-sm">{payment.method}</td>
                                                <td className="px-6 py-4 text-sm">
                                                    <span className={`px-2 py-1 rounded text-xs ${
                                                        payment.status === 'approved' || payment.status === 'completed' ? 'bg-green-600' :
                                                        payment.status === 'pending' ? 'bg-yellow-600' :
                                                        'bg-red-600'
                                                    }`}>
                                                        {payment.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm">
                                                    {new Date(payment.createdAt).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 text-sm">
                                                    {payment.status === 'pending' && (
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleStatusUpdate(payment._id, 'approved')}
                                                                className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs"
                                                            >
                                                                Approve
                                                            </button>
                                                            <button
                                                                onClick={() => handleStatusUpdate(payment._id, 'rejected')}
                                                                className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                                                            >
                                                                Reject
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PaymentManagement;
