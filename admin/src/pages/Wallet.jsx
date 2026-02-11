import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const Wallet = () => {
    const navigate = useNavigate();
    const [wallets, setWallets] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('wallets');

    useEffect(() => {
        if (activeTab === 'wallets') {
            fetchWallets();
        } else {
            fetchTransactions();
        }
    }, [activeTab]);

    const fetchWallets = async () => {
        try {
            setLoading(true);
            const admin = JSON.parse(localStorage.getItem('admin'));
            const password = sessionStorage.getItem('adminPassword') || '';
            const response = await fetch(`${API_BASE_URL}/wallet/all`, {
                headers: {
                    'Authorization': `Basic ${btoa(`${admin.username}:${password}`)}`,
                },
            });
            const data = await response.json();
            if (data.success) {
                setWallets(data.data);
            }
        } catch (err) {
            console.error('Error fetching wallets:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchTransactions = async () => {
        try {
            setLoading(true);
            const admin = JSON.parse(localStorage.getItem('admin'));
            const password = sessionStorage.getItem('adminPassword') || '';
            const response = await fetch(`${API_BASE_URL}/wallet/transactions`, {
                headers: {
                    'Authorization': `Basic ${btoa(`${admin.username}:${password}`)}`,
                },
            });
            const data = await response.json();
            if (data.success) {
                setTransactions(data.data);
            }
        } catch (err) {
            console.error('Error fetching transactions:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAdjustBalance = async (userId, amount, type) => {
        try {
            const admin = JSON.parse(localStorage.getItem('admin'));
            const password = sessionStorage.getItem('adminPassword') || '';
            const response = await fetch(`${API_BASE_URL}/wallet/adjust`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${btoa(`${admin.username}:${password}`)}`,
                },
                body: JSON.stringify({ userId, amount, type }),
            });
            const data = await response.json();
            if (data.success) {
                fetchWallets();
            }
        } catch (err) {
            console.error('Error adjusting balance:', err);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('admin');
        sessionStorage.removeItem('adminPassword');
        navigate('/');
    };

    return (
        <AdminLayout onLogout={handleLogout} title="Wallet">
                    <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Wallet Management</h1>

                    {/* Tabs */}
                    <div className="flex gap-2 sm:gap-4 mb-4 sm:mb-6 border-b border-gray-200 overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('wallets')}
                            className={`pb-4 px-4 font-semibold ${
                                activeTab === 'wallets' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-400'
                            }`}
                        >
                            Player Wallets
                        </button>
                        <button
                            onClick={() => setActiveTab('transactions')}
                            className={`pb-4 px-4 font-semibold ${
                                activeTab === 'transactions' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-400'
                            }`}
                        >
                            Transactions
                        </button>
                    </div>

                    {loading ? (
                        <div className="text-center py-12">
                            <p className="text-gray-400">Loading...</p>
                        </div>
                    ) : activeTab === 'wallets' ? (
                        <div className="overflow-x-auto -mx-4 sm:mx-0">
                            <div className="bg-white rounded-lg overflow-hidden min-w-[400px]">
                                <table className="w-full text-sm sm:text-base">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Player</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Balance</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {wallets.length === 0 ? (
                                        <tr>
                                            <td colSpan="3" className="px-6 py-4 text-center text-gray-400">
                                                No wallets found
                                            </td>
                                        </tr>
                                    ) : (
                                        wallets.map((wallet) => (
                                            <tr key={wallet._id} className="hover:bg-gray-100">
                                                <td className="px-6 py-4 text-sm">{wallet.userId?.username || wallet.userId}</td>
                                                <td className="px-6 py-4 text-sm font-semibold text-orange-500">₹{wallet.balance}</td>
                                                <td className="px-6 py-4 text-sm">
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => {
                                                                const amount = prompt('Enter amount to add:');
                                                                if (amount) handleAdjustBalance(wallet.userId._id || wallet.userId, parseFloat(amount), 'credit');
                                                            }}
                                                            className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs"
                                                        >
                                                            Add
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                const amount = prompt('Enter amount to deduct:');
                                                                if (amount) handleAdjustBalance(wallet.userId._id || wallet.userId, parseFloat(amount), 'debit');
                                                            }}
                                                            className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                                                        >
                                                            Deduct
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto -mx-4 sm:mx-0">
                            <div className="bg-white rounded-lg overflow-hidden min-w-[400px]">
                                <table className="w-full text-sm sm:text-base">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Player</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Type</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Amount</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {transactions.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="px-6 py-4 text-center text-gray-400">
                                                No transactions found
                                            </td>
                                        </tr>
                                    ) : (
                                        transactions.map((transaction) => (
                                            <tr key={transaction._id} className="hover:bg-gray-100">
                                                <td className="px-6 py-4 text-sm">{transaction.userId?.username || transaction.userId}</td>
                                                <td className="px-6 py-4 text-sm">
                                                    <span className={`px-2 py-1 rounded text-xs ${
                                                        transaction.type === 'credit' ? 'bg-green-600' : 'bg-red-600'
                                                    }`}>
                                                        {transaction.type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm">₹{transaction.amount}</td>
                                                <td className="px-6 py-4 text-sm">
                                                    {new Date(transaction.createdAt).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                            </div>
                        </div>
                    )}
        </AdminLayout>
    );
};

export default Wallet;
