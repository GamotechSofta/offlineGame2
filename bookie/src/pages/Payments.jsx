import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { API_BASE_URL, getBookieAuthHeaders } from '../utils/api';
import { useLanguage } from '../context/LanguageContext';

const Payments = () => {
    const { t } = useLanguage();
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ status: '', type: '' });

    useEffect(() => {
        fetchPayments();
    }, [filters]);

    const fetchPayments = async () => {
        try {
            setLoading(true);
            const q = new URLSearchParams();
            if (filters.status) q.append('status', filters.status);
            if (filters.type) q.append('type', filters.type);
            const response = await fetch(`${API_BASE_URL}/payments?${q}`, { headers: getBookieAuthHeaders() });
            const data = await response.json();
            if (data.success) setPayments(data.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout title={t('payments')}>
            <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">{t('paymentsViewOnly')}</h1>
            <div className="bg-white rounded-lg p-4 mb-4 sm:mb-6 flex flex-wrap gap-3 items-center border border-gray-200">
                <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-800">
                    <option value="">{t('allStatus')}</option>
                    <option value="pending">{t('pending')}</option>
                    <option value="approved">{t('approved')}</option>
                    <option value="rejected">{t('rejected')}</option>
                    <option value="completed">{t('completed')}</option>
                </select>
                <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} className="px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-800">
                    <option value="">{t('allTypes')}</option>
                    <option value="deposit">{t('deposit')}</option>
                    <option value="withdrawal">{t('withdrawal')}</option>
                </select>
            </div>
            {loading ? (
                <p className="text-gray-400 py-12 text-center">{t('loading')}</p>
            ) : (
                <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
                    <table className="w-full">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">{t('player')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">{t('type')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">{t('amount')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">{t('method')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">{t('status')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">{t('date')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {payments.length === 0 ? (
                                <tr><td colSpan="7" className="px-6 py-4 text-center text-gray-400">{t('noPaymentsFound')}</td></tr>
                            ) : (
                                payments.map((p) => (
                                    <tr key={p._id} className="hover:bg-gray-100">
                                        <td className="px-6 py-4 text-sm">{p._id?.slice(-8)}</td>
                                        <td className="px-6 py-4 text-sm">{p.userId?.username || p.userId}</td>
                                        <td className="px-6 py-4 text-sm"><span className={`px-2 py-1 rounded text-xs ${p.type === 'deposit' ? 'bg-green-600' : 'bg-blue-600'}`}>{p.type}</span></td>
                                        <td className="px-6 py-4 text-sm">₹{p.amount}</td>
                                        <td className="px-6 py-4 text-sm">{p.method}</td>
                                        <td className="px-6 py-4 text-sm"><span className={`px-2 py-1 rounded text-xs ${p.status === 'approved' || p.status === 'completed' ? 'bg-green-600' : p.status === 'pending' ? 'bg-orange-600' : 'bg-red-600'}`}>{p.status}</span></td>
                                        <td className="px-6 py-4 text-sm">{new Date(p.createdAt).toLocaleString()}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </Layout>
    );
};

export default Payments;
