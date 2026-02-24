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
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [submittedAmount, setSubmittedAmount] = useState(0);

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
                setSubmittedAmount(numAmount);
                setShowSuccessModal(true);
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
            <div className="rounded-2xl bg-white p-0">
                <div className="bg-white rounded-2xl shadow-md border border-gray-300 overflow-hidden">
                    <div className="px-4 pt-3 pb-2 flex items-center justify-center gap-2 text-sm text-gray-600">
                        <svg className="w-4 h-4 text-[#1B3150]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a10 10 0 100 20 10 10 0 000-20z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2 12h20" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2c3.5 3.5 3.5 16.5 0 20" />
                        </svg>
                        <span className="font-semibold tracking-wide">RATAN 365</span>
                    </div>

                    <div className="bg-gradient-to-r bg-[#1B3150] px-4 py-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/20 border border-white/30 flex items-center justify-center shrink-0">
                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-sm font-extrabold text-[#1B3150]">
                                ₹
                            </div>
                        </div>
                        <div className="min-w-0">
                            <div className="text-[11px] font-semibold text-white/90 leading-none">Available Balance</div>
                            <div className="text-white font-extrabold text-lg sm:text-xl leading-tight truncate">
                                ₹ {Number(walletBalance || 0).toLocaleString('en-IN')}
                            </div>
                        </div>
                    </div>

                    <div className="px-4 py-3 flex items-center justify-between bg-gray-50">
                        <div className="text-sm text-gray-700 truncate">
                            {user?.username || user?.name || 'User'}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full bg-[#1B3150] inline-block" />
                            <span className="w-3 h-3 rounded-full bg-[#1B3150] inline-block" />
                        </div>
                    </div>
                </div>

                <div className="mt-3 text-gray-600 text-sm">
                    Min: ₹{config?.minWithdrawal || 500} | Max: ₹{config?.maxWithdrawal || 25000}
                </div>
            </div>

            {/* Messages */}
            {error && (
                <div className="p-4 bg-red-50 border border-red-300 rounded-xl text-red-600 text-sm">
                    {error}
                </div>
            )}
            {success && (
                <div className="p-4 bg-green-50 border border-green-300 rounded-xl text-green-600 text-sm">
                    {success}
                </div>
            )}

            {/* No Bank Account Warning */}
            {bankAccounts.length === 0 && (
                <div className="p-3 bg-gray-50 border border-gray-400 rounded-xl text-[#1B3150] text-xs sm:text-sm">
                    <p className="font-medium">No bank account added!</p>
                    <p className="text-[#1B3150] mt-1 leading-snug">Please add a bank account first from the "Bank Detail" section to withdraw funds.</p>
                </div>
            )}

            {/* Withdraw Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Amount Input */}
                <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2">Amount (₹)</label>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Enter amount"
                        className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1B3150] focus:border-[#1B3150]"
                        min={config?.minWithdrawal || 500}
                        max={Math.min(config?.maxWithdrawal || 25000, walletBalance)}
                    />
                    <button
                        type="button"
                        onClick={() => setAmount(Math.min(walletBalance, config?.maxWithdrawal || 25000).toString())}
                        className="mt-2 text-[#1B3150] text-sm hover:text-[#1B3150]"
                    >
                        Withdraw Max (₹{Math.min(walletBalance, config?.maxWithdrawal || 25000).toLocaleString()})
                    </button>
                </div>

                {/* Bank Account Selection */}
                <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2">Select Bank Account</label>
                    <div className="space-y-2">
                        {bankAccounts.map((acc) => (
                            <label
                                key={acc._id}
                                className={`flex items-center p-4 bg-white border rounded-xl cursor-pointer transition-colors ${
                                    selectedBankId === acc._id
                                        ? 'border-[#1B3150] bg-gray-50'
                                        : 'border-gray-300 hover:border-gray-400'
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
                                    <p className="text-gray-800 font-medium">{acc.accountHolderName}</p>
                                    {acc.accountNumber && (
                                        <p className="text-gray-600 text-sm">
                                            {acc.bankName} - ****{acc.accountNumber.slice(-4)}
                                        </p>
                                    )}
                                    {acc.upiId && (
                                        <p className="text-gray-600 text-sm">UPI: {acc.upiId}</p>
                                    )}
                                </div>
                                {acc.isDefault && (
                                    <span className="px-2 py-1 bg-gray-100 text-[#1B3150] text-xs rounded-full border border-gray-400">
                                        Default
                                    </span>
                                )}
                                <div className={`w-5 h-5 rounded-full border-2 ml-3 flex items-center justify-center ${
                                    selectedBankId === acc._id ? 'border-[#1B3150]' : 'border-gray-300'
                                }`}>
                                    {selectedBankId === acc._id && (
                                        <div className="w-3 h-3 bg-[#1B3150] rounded-full"></div>
                                    )}
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Note */}
                <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2">
                        Note <span className="text-gray-500">(Optional)</span>
                    </label>
                    <textarea
                        value={userNote}
                        onChange={(e) => setUserNote(e.target.value)}
                        placeholder="Any special instructions..."
                        className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1B3150] focus:border-[#1B3150] resize-none"
                        rows={2}
                    />
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={loading || bankAccounts.length === 0}
                    className="w-full py-4 bg-gradient-to-r from-[#1B3150] to-[#1B3150] hover:from-[#1B3150] hover:bg-[#152842] text-white font-bold rounded-xl transition-all disabled:opacity-50 shadow-md hover:shadow-lg"
                >
                    {loading ? 'Submitting...' : 'Submit Withdrawal Request'}
                </button>
            </form>

            {/* Info */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-300">
                <h4 className="text-[#1B3150] font-semibold mb-2">Withdrawal Info:</h4>
                <ul className="text-gray-700 text-sm space-y-1">
                    <li>• Withdrawals are processed within 24 hours</li>
                    <li>• Ensure your bank details are correct</li>
                    <li>• Minimum withdrawal: ₹{config?.minWithdrawal || 500}</li>
                    <li>• Maximum withdrawal: ₹{config?.maxWithdrawal || 25000}</li>
                </ul>
            </div>

            {/* Success Modal */}
            {showSuccessModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-gray-300 shadow-xl text-center">
                        {/* Success Icon */}
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>

                        <h3 className="text-xl font-bold text-gray-800 mb-2">Withdrawal Request Submitted!</h3>
                        
                        <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-300">
                            <p className="text-gray-600 text-sm">Amount</p>
                            <p className="text-2xl font-bold text-[#1B3150]">₹{submittedAmount.toLocaleString()}</p>
                        </div>

                        <p className="text-gray-600 text-sm mb-6">
                            Your withdrawal request has been submitted successfully. 
                            Amount will be transferred to your bank account after admin approval within 24 hours.
                        </p>

                        <div className="space-y-3">
                            <button
                                onClick={() => setShowSuccessModal(false)}
                                className="w-full py-3 bg-[#1B3150] hover:bg-[#1B3150] text-white font-semibold rounded-xl transition-colors shadow-md"
                            >
                                Done
                            </button>
                            <button
                                onClick={() => {
                                    setShowSuccessModal(false);
                                    window.location.href = '/funds?tab=withdraw-fund-history';
                                }}
                                className="w-full py-3 bg-white border border-gray-400 hover:bg-gray-50 text-[#1B3150] font-medium rounded-xl transition-colors"
                            >
                                View History
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WithdrawFund;
