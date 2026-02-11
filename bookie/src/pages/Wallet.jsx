import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { API_BASE_URL, getBookieAuthHeaders } from '../utils/api';

const Wallet = () => {
    const [wallets, setWallets] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('wallets');

    useEffect(() => {
        if (activeTab === 'wallets') fetchWallets();
        else fetchTransactions();
    }, [activeTab]);

    const fetchWallets = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/wallet/all`, { headers: getBookieAuthHeaders() });
            const data = await response.json();
            if (data.success) setWallets(data.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchTransactions = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/wallet/transactions`, { headers: getBookieAuthHeaders() });
            const data = await response.json();
            if (data.success) setTransactions(data.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout title="Wallet">
            <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Wallet (View Only)</h1>
            <div className="flex gap-4 mb-4 sm:mb-6 border-b border-gray-200">
                <button onClick={() => setActiveTab('wallets')} className={`pb-4 px-4 font-semibold transition-colors ${activeTab === 'wallets' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-400 hover:text-gray-600'}`}>Player Wallets</button>
                <button onClick={() => setActiveTab('transactions')} className={`pb-4 px-4 font-semibold transition-colors ${activeTab === 'transactions' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-400 hover:text-gray-600'}`}>Transactions</button>
            </div>
            {loading ? (
                <p className="text-gray-400 py-12 text-center">Loading...</p>
            ) : activeTab === 'wallets' ? (
                <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
                    <table className="w-full">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Player</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Balance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {wallets.length === 0 ? <tr><td colSpan="2" className="px-6 py-4 text-center text-gray-400">No wallets found</td></tr> : wallets.map((w) => (
                                <tr key={w._id} className="hover:bg-gray-100">
                                    <td className="px-6 py-4 text-sm">{w.userId?.username || w.userId}</td>
                                    <td className="px-6 py-4 text-sm font-semibold text-orange-500">₹{w.balance}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
                    <table className="w-full">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Player</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Amount</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {transactions.length === 0 ? <tr><td colSpan="4" className="px-6 py-4 text-center text-gray-400">No transactions found</td></tr> : transactions.map((t) => (
                                <tr key={t._id} className="hover:bg-gray-100">
                                    <td className="px-6 py-4 text-sm">{t.userId?.username || t.userId}</td>
                                    <td className="px-6 py-4 text-sm"><span className={`px-2 py-1 rounded text-xs ${t.type === 'credit' ? 'bg-green-600' : 'bg-red-600'}`}>{t.type}</span></td>
                                    <td className="px-6 py-4 text-sm">₹{t.amount}</td>
                                    <td className="px-6 py-4 text-sm">{new Date(t.createdAt).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </Layout>
    );
};

export default Wallet;
