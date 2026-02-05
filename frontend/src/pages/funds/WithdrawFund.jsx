import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../config/api';

const WithdrawFund = () => {
    const [config, setConfig] = useState(null);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [walletBalance, setWalletBalance] = useState(0);
    const [amount, setAmount] = useState('');
    const [selectedBankId, setSelectedBankId] = useState('');
    const [userNote, setUserNote] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const user = JSON.parse(localStorage.getItem('user') || '{}');

    useEffect(() => {
        fetchConfig();
        fetchBankAccounts();
        fetchWalletBalance();
    }, []);

    const fetchConfig = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/payments/config`);
            const data = await res.json();
            if (data.success) {
                setConfig(data.data);
            }
        } catch (err) {
            console.error('Failed to fetch config:', err);
        }
    };

    const fetchBankAccounts = async () => {
        if (!user.id) return;
        try {
            const res = await fetch(`${API_BASE_URL}/bank-details?userId=${user.id}`);
            const data = await res.json();
            if (data.success) {
                setBankAccounts(data.data || []);
                // Auto-select default account
                const defaultAcc = data.data?.find(acc => acc.isDefault);
                if (defaultAcc) {
                    setSelectedBankId(defaultAcc._id);
                }
            }
        } catch (err) {
            console.error('Failed to fetch bank accounts:', err);
        }
    };

    const fetchWalletBalance = async () => {
        if (!user.id) return;
        try {
            const res = await fetch(`${API_BASE_URL}/wallet/balance?userId=${user.id}`);
            const data = await res.json();
            if (data.success) {
                setWalletBalance(data.data?.balance || 0);
            }
        } catch (err) {
            console.error('Failed to fetch balance:', err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!user.id) {
            setError('Please login to withdraw funds');
            return;
        }

        const numAmount = parseFloat(amount);
        const minWithdraw = config?.minWithdrawal || 500;
        const maxWithdraw = config?.maxWithdrawal || 25000;

        if (!numAmount || numAmount < minWithdraw || numAmount > maxWithdraw) {
            setError(`Amount must be between ₹${minWithdraw} and ₹${maxWithdraw}`);
            return;
        }

        if (numAmount > walletBalance) {
            setError('Insufficient wallet balance');
            return;
        }

        if (!selectedBankId) {
            setError('Please select a bank account');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch(`${API_BASE_URL}/payments/withdraw`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    amount: numAmount,
                    bankDetailId: selectedBankId,
                    userNote,
                }),
            });

            const data = await res.json();
            if (data.success) {
                setSuccess('Withdrawal request submitted successfully! Please wait for admin approval.');
                setAmount('');
                setUserNote('');
                fetchWalletBalance();
            } else {
                setError(data.message || 'Failed to submit request');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Wallet Balance Card */}
            <div className="bg-gradient-to-r from-red-900/40 to-red-800/30 rounded-2xl p-5 border border-red-500/30">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-gray-400 text-sm">Available Balance</p>
                        <p className="text-3xl font-bold text-white">₹{walletBalance.toLocaleString()}</p>
                    </div>
                    <div className="bg-red-500/20 p-4 rounded-full">
                        <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                </div>
                <div className="mt-3 text-gray-400 text-sm">
                    Min: ₹{config?.minWithdrawal || 500} | Max: ₹{config?.maxWithdrawal || 25000}
                </div>
            </div>

            {/* Messages */}
            {error && (
                <div className="p-4 bg-red-900/50 border border-red-600 rounded-xl text-red-300 text-sm">
                    {error}
                </div>
            )}
            {success && (
                <div className="p-4 bg-green-900/50 border border-green-600 rounded-xl text-green-300 text-sm">
                    {success}
                </div>
            )}

            {/* No Bank Account Warning */}
            {bankAccounts.length === 0 && (
                <div className="p-4 bg-yellow-900/30 border border-yellow-600/50 rounded-xl text-yellow-300 text-sm">
                    <p className="font-medium">No bank account added!</p>
                    <p className="text-yellow-400/80 mt-1">Please add a bank account first from the "Bank Detail" section to withdraw funds.</p>
                </div>
            )}

            {/* Withdraw Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Amount Input */}
                <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">Amount (₹)</label>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Enter amount"
                        className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                        min={config?.minWithdrawal || 500}
                        max={Math.min(config?.maxWithdrawal || 25000, walletBalance)}
                    />
                    <button
                        type="button"
                        onClick={() => setAmount(Math.min(walletBalance, config?.maxWithdrawal || 25000).toString())}
                        className="mt-2 text-red-400 text-sm hover:text-red-300"
                    >
                        Withdraw Max (₹{Math.min(walletBalance, config?.maxWithdrawal || 25000).toLocaleString()})
                    </button>
                </div>

                {/* Bank Account Selection */}
                <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">Select Bank Account</label>
                    <div className="space-y-2">
                        {bankAccounts.map((acc) => (
                            <label
                                key={acc._id}
                                className={`flex items-center p-4 bg-[#1a1a1a] border rounded-xl cursor-pointer transition-colors ${
                                    selectedBankId === acc._id
                                        ? 'border-red-500 bg-red-900/20'
                                        : 'border-white/10 hover:border-white/30'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="bankAccount"
                                    value={acc._id}
                                    checked={selectedBankId === acc._id}
                                    onChange={(e) => setSelectedBankId(e.target.value)}
                                    className="sr-only"
                                />
                                <div className="flex-1">
                                    <p className="text-white font-medium">{acc.accountHolderName}</p>
                                    {acc.accountNumber && (
                                        <p className="text-gray-400 text-sm">
                                            {acc.bankName} - ****{acc.accountNumber.slice(-4)}
                                        </p>
                                    )}
                                    {acc.upiId && (
                                        <p className="text-gray-400 text-sm">UPI: {acc.upiId}</p>
                                    )}
                                </div>
                                {acc.isDefault && (
                                    <span className="px-2 py-1 bg-yellow-600/30 text-yellow-400 text-xs rounded-full">
                                        Default
                                    </span>
                                )}
                                <div className={`w-5 h-5 rounded-full border-2 ml-3 flex items-center justify-center ${
                                    selectedBankId === acc._id ? 'border-red-500' : 'border-gray-600'
                                }`}>
                                    {selectedBankId === acc._id && (
                                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                    )}
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Note */}
                <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">
                        Note <span className="text-gray-500">(Optional)</span>
                    </label>
                    <textarea
                        value={userNote}
                        onChange={(e) => setUserNote(e.target.value)}
                        placeholder="Any special instructions..."
                        className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                        rows={2}
                    />
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={loading || bankAccounts.length === 0}
                    className="w-full py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold rounded-xl transition-all disabled:opacity-50"
                >
                    {loading ? 'Submitting...' : 'Submit Withdrawal Request'}
                </button>
            </form>

            {/* Info */}
            <div className="bg-[#1a1a1a] rounded-xl p-4 border border-white/10">
                <h4 className="text-yellow-400 font-semibold mb-2">Withdrawal Info:</h4>
                <ul className="text-gray-400 text-sm space-y-1">
                    <li>• Withdrawals are processed within 24 hours</li>
                    <li>• Ensure your bank details are correct</li>
                    <li>• Minimum withdrawal: ₹{config?.minWithdrawal || 500}</li>
                    <li>• Maximum withdrawal: ₹{config?.maxWithdrawal || 25000}</li>
                </ul>
            </div>
        </div>
    );
};

export default WithdrawFund;
