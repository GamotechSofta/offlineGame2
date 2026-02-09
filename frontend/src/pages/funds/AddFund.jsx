import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config/api';

const AddFund = () => {
    const navigate = useNavigate();
    const [config, setConfig] = useState(null);
    const [amount, setAmount] = useState('');
    const [upiTransactionId, setUpiTransactionId] = useState('');
    const [screenshot, setScreenshot] = useState(null);
    const [screenshotPreview, setScreenshotPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [submittedAmount, setSubmittedAmount] = useState(0);
    const [step, setStep] = useState(1); // 1 = Amount, 2 = Payment Details
    const [addCashLoading, setAddCashLoading] = useState(false);

    useEffect(() => {
        fetchConfig();
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

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                setError('File size must be less than 5MB');
                return;
            }
            setScreenshot(file);
            setScreenshotPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (!user.id) {
            setError('Please login to add funds');
            return;
        }

        const numAmount = parseFloat(amount);
        if (!numAmount || numAmount < (config?.minDeposit || 100) || numAmount > (config?.maxDeposit || 50000)) {
            setError(`Amount must be between ₹${config?.minDeposit || 100} and ₹${config?.maxDeposit || 50000}`);
            return;
        }

        const utr = String(upiTransactionId || '').trim();
        if (!utr) {
            setError('Please enter UTR / Transaction ID');
            return;
        }
        if (!/^\d{12}$/.test(utr)) {
            setError('UTR / Transaction ID must be 12 digits');
            return;
        }

        if (!screenshot) {
            setError('Please upload payment screenshot');
            return;
        }

        setLoading(true);

        try {
            const formData = new FormData();
            formData.append('userId', user.id);
            formData.append('amount', numAmount);
            formData.append('upiTransactionId', utr);
            formData.append('screenshot', screenshot);

            const res = await fetch(`${API_BASE_URL}/payments/deposit`, {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();
            if (data.success) {
                setSubmittedAmount(numAmount);
                setShowSuccessModal(true);
                setAmount('');
                setUpiTransactionId('');
                setScreenshot(null);
                setScreenshotPreview(null);
                setStep(1);
            } else {
                setError(data.message || 'Failed to submit request');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const quickAmounts = [100, 500, 1000, 2000, 5000, 10000];
    const quickAmountsStep1 = [200, 500, 1000, 2000];
    const minDeposit = config?.minDeposit || 100;
    const maxDeposit = config?.maxDeposit || 50000;
    const qrAmount = (() => {
        const n = Number(amount);
        return Number.isFinite(n) && n > 0 ? n : null;
    })();

    const validateAmount = () => {
        const numAmount = Number(amount);
        if (!numAmount || numAmount < minDeposit || numAmount > maxDeposit) {
            setError(`Amount must be between ₹${minDeposit} and ₹${maxDeposit}`);
            return false;
        }
        return true;
    };

    const handleAddCash = () => {
        setError('');
        if (!validateAmount()) return;
        setAddCashLoading(true);
        window.setTimeout(() => {
            setAddCashLoading(false);
            setStep(2);
        }, 3000);
    };

    return (
        <div className={`space-y-4 sm:space-y-6 ${step === 2 ? 'pb-28' : ''}`}>
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

            {step === 1 ? (
                <div className="space-y-4 sm:space-y-5">
                    <div className="rounded-2xl bg-black/0 p-0">
                        {/* Top card (as screenshot) */}
                        <div className="bg-[#202124] rounded-2xl shadow-[0_18px_40px_rgba(0,0,0,0.45)] border border-white/10 overflow-hidden">
                            <div className="px-3 sm:px-4 pt-2.5 sm:pt-3 pb-2 flex items-center justify-center gap-2 text-[13px] sm:text-sm text-gray-300">
                                <svg className="w-4 h-4 text-[#d4af37]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a10 10 0 100 20 10 10 0 000-20z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2 12h20" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2c3.5 3.5 3.5 16.5 0 20" />
                                </svg>
                                <span className="font-semibold tracking-wide">GoldenBets.com</span>
                            </div>

                            <div className="bg-gradient-to-r from-[#d4af37] via-[#cca84d] to-[#b8941f] px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-3">
                                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/25 border border-black/20 flex items-center justify-center shrink-0">
                                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/40 flex items-center justify-center text-[13px] sm:text-sm font-extrabold text-black">
                                        ₹
                                    </div>
                                </div>
                                <div className="text-black font-extrabold">
                                    ₹{' '}
                                    {(() => {
                                        try {
                                            const u = JSON.parse(localStorage.getItem('user') || 'null');
                                            const b = Number(u?.balance ?? u?.walletBalance ?? u?.wallet ?? 0) || 0;
                                            return b.toLocaleString('en-IN');
                                        } catch {
                                            return '0';
                                        }
                                    })()}
                                </div>
                            </div>

                            <div className="px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between">
                                <div className="text-[13px] sm:text-sm text-white/90">
                                    {(() => {
                                        try {
                                            const u = JSON.parse(localStorage.getItem('user') || 'null');
                                            return u?.username || u?.name || 'User';
                                        } catch {
                                            return 'User';
                                        }
                                    })()}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
                                    <span className="w-3 h-3 rounded-full bg-[#d4af37] inline-block" />
                                </div>
                            </div>
                        </div>

                        {/* Support button */}
                        <div className="mt-3 sm:mt-4 flex justify-center">
                            <button
                                type="button"
                                onClick={() => navigate('/support')}
                                className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2 sm:py-2.5 rounded-full bg-[#202124] border border-white/10 text-[13px] sm:text-sm font-semibold text-white shadow-sm hover:border-[#d4af37]/35 hover:bg-[#222] transition-colors"
                            >
                                <svg className="w-4 h-4 text-[#d4af37]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 10c0 3.866-3.134 7-7 7a7.003 7.003 0 01-4-1.25L3 17l1.25-4A7.003 7.003 0 017 6c0-1.105.895-2 2-2h2a7 7 0 017 7z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 10h.01M12 10h.01M15 10h.01" />
                                </svg>
                                Support
                            </button>
                        </div>

                        {/* Amount input */}
                        <div className="mt-3 sm:mt-4 flex items-center justify-center gap-2">
                            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#202124] border border-white/10 flex items-center justify-center shadow-sm shrink-0">
                                <svg className="w-5 h-5 text-[#d4af37]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M5 10v8m4-8v8m6-8v8m4-8v8M3 18h18M4 10l8-4 8 4" />
                                </svg>
                            </div>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="Enter Amount"
                                className="flex-1 min-w-0 max-w-[520px] bg-[#202124] border border-white/10 rounded-full px-4 py-2.5 sm:py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/20"
                                min={minDeposit}
                                max={maxDeposit}
                            />
                        </div>

                        {/* Quick buttons */}
                        <div className="mt-2.5 sm:mt-3 grid grid-cols-2 gap-2 max-w-[520px] mx-auto">
                            {quickAmountsStep1.map((amt) => (
                                <button
                                    key={amt}
                                    type="button"
                                    onClick={() => setAmount(String(amt))}
                                    className={`h-8 sm:h-9 rounded-md border text-[13px] sm:text-sm font-semibold shadow-sm transition-colors ${
                                        amount === String(amt)
                                            ? 'bg-[#d4af37] text-black border-[#d4af37]/60'
                                            : 'bg-[#202124] text-white border-white/10 hover:border-[#d4af37]/30'
                                    }`}
                                >
                                    {amt}
                                </button>
                            ))}
                        </div>

                        {/* Add Cash */}
                        <div className="mt-2.5 sm:mt-3 max-w-[520px] mx-auto">
                            <button
                                type="button"
                                onClick={handleAddCash}
                                disabled={addCashLoading}
                                className={`w-full h-9 sm:h-10 rounded-md bg-gradient-to-r from-[#d4af37] via-[#cca84d] to-[#b8941f] text-black font-extrabold shadow-[0_10px_22px_rgba(212,175,55,0.35)] ${
                                    addCashLoading ? 'opacity-70 cursor-not-allowed' : ''
                                }`}
                            >
                                {addCashLoading ? 'Loading...' : 'Add Cash'}
                            </button>
                        </div>

                        {/* Note */}
                        <div className="mt-2.5 sm:mt-3 max-w-[520px] mx-auto bg-[#202124] rounded-md border border-white/10 px-3 py-2 text-[10px] sm:text-[11px] text-gray-300">
                            Deposit time use only phone pay App Always 🙏🙏
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Amount summary + edit */}
                    <div className="flex items-center justify-between gap-3 bg-[#1a1a1a] rounded-2xl p-4 border border-white/10">
                        <div className="min-w-0">
                            <div className="text-gray-400 text-sm">Selected Amount</div>
                            <div className="text-white font-extrabold text-lg truncate">₹{Number(amount || 0).toLocaleString('en-IN')}</div>
                            <div className="text-gray-500 text-xs mt-0.5">
                                Min: ₹{minDeposit.toLocaleString('en-IN')} | Max: ₹{maxDeposit.toLocaleString('en-IN')}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setStep(1)}
                            className="shrink-0 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-semibold border border-white/10"
                        >
                            Back
                        </button>
                    </div>

                    {/* Payment Details */}
                    <div className="bg-[#202124] rounded-2xl p-5 border border-white/10 shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
                        <h3 className="text-lg font-bold text-[#d4af37] mb-4">Payment Details</h3>

                        {/* QR Code Section */}
                        <div className="flex flex-col items-center mb-5">
                            <div className="bg-white p-3 rounded-xl mb-3">
                                {config?.upiId ? (
                                    <img
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                                            `upi://pay?pa=${config.upiId}&pn=${encodeURIComponent(config.upiName || 'Golden Games')}${qrAmount != null ? `&am=${qrAmount}` : ''}&cu=INR`
                                        )}`}
                                        alt="UPI QR Code"
                                        className="w-[180px] h-[180px]"
                                    />
                                ) : (
                                    <div className="w-[180px] h-[180px] flex items-center justify-center bg-gray-200 rounded">
                                        <span className="text-gray-500 text-sm">Loading QR...</span>
                                    </div>
                                )}
                            </div>
                            <p className="text-gray-400 text-sm text-center">
                                Scan QR code with any UPI app to pay
                            </p>
                        </div>

                        {/* OR Divider */}
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex-1 h-px bg-white/10"></div>
                            <span className="text-gray-500 text-sm">OR</span>
                            <div className="flex-1 h-px bg-white/10"></div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between bg-black/30 rounded-xl p-4 border border-white/10">
                                <div>
                                    <p className="text-gray-400 text-sm">UPI ID</p>
                                    <p className="text-white font-mono text-lg">{config?.upiId || 'Loading...'}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        navigator.clipboard.writeText(config?.upiId || '');
                                        setSuccess('UPI ID copied!');
                                        setTimeout(() => setSuccess(''), 2000);
                                    }}
                                    className="px-4 py-2 bg-gradient-to-r from-[#d4af37] via-[#cca84d] to-[#b8941f] hover:brightness-105 text-black rounded-lg text-sm font-extrabold border border-black/20 shadow-[0_10px_18px_rgba(212,175,55,0.25)]"
                                >
                                    Copy
                                </button>
                            </div>
                            <div className="bg-black/30 rounded-xl p-4 border border-white/10">
                                <p className="text-gray-400 text-sm">Pay to</p>
                                <p className="text-white font-semibold">{config?.upiName || 'Golden Games'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Add Fund Form (Step 2) */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* UTR / Transaction ID */}
                        <div>
                            <label className="block text-gray-300 text-sm font-medium mb-2">
                                UTR / Transaction ID <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={upiTransactionId}
                                onChange={(e) => setUpiTransactionId(e.target.value)}
                                placeholder="Enter 12-digit UTR number"
                                inputMode="numeric"
                                className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#d4af37]/20"
                                required
                            />
                        </div>

                        {/* Screenshot Upload */}
                        <div>
                            <label className="block text-gray-300 text-sm font-medium mb-2">
                                Payment Screenshot <span className="text-red-400">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={handleFileChange}
                                    className="hidden"
                                    id="screenshot-upload"
                                />
                                <label
                                    htmlFor="screenshot-upload"
                                    className="flex flex-col items-center justify-center w-full h-40 bg-[#1a1a1a] border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:border-[#d4af37]/40 transition-colors"
                                >
                                    {screenshotPreview ? (
                                        <img
                                            src={screenshotPreview}
                                            alt="Screenshot preview"
                                            className="h-full w-full object-contain rounded-xl"
                                        />
                                    ) : (
                                        <>
                                            <svg className="w-10 h-10 text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <p className="text-gray-400 text-sm">Click to upload screenshot</p>
                                            <p className="text-gray-500 text-xs mt-1">JPEG, PNG, WebP (Max 5MB)</p>
                                        </>
                                    )}
                                </label>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-gradient-to-r from-[#d4af37] via-[#cca84d] to-[#b8941f] hover:brightness-105 text-black font-extrabold rounded-xl transition-all disabled:opacity-50 shadow-[0_14px_26px_rgba(212,175,55,0.22)]"
                        >
                            {loading ? 'Submitting...' : 'Submit Deposit Request'}
                        </button>
                    </form>

                    {/* Instructions */}
                    <div className="bg-[#1a1a1a] rounded-xl p-4 border border-white/10">
                        <h4 className="text-yellow-400 font-semibold mb-2">How to Add Funds:</h4>
                        <ol className="text-gray-400 text-sm space-y-2 list-decimal list-inside">
                            <li>Scan the QR code above OR copy the UPI ID</li>
                            <li>Open any UPI app (GPay, PhonePe, Paytm, etc.)</li>
                            <li>Send the exact amount you want to add</li>
                            <li>Take a screenshot of the successful payment</li>
                            <li>Enter amount and upload the screenshot above</li>
                        </ol>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {showSuccessModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#1a1a1a] rounded-2xl max-w-sm w-full p-6 border border-green-500/30 text-center">
                        {/* Success Icon */}
                        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>

                        <h3 className="text-xl font-bold text-white mb-2">Request Submitted!</h3>
                        
                        <div className="bg-green-900/30 rounded-xl p-4 mb-4">
                            <p className="text-gray-400 text-sm">Amount</p>
                            <p className="text-2xl font-bold text-green-400">₹{submittedAmount.toLocaleString()}</p>
                        </div>

                        <p className="text-gray-400 text-sm mb-6">
                            Your deposit request has been submitted successfully. 
                            Please wait for admin approval. Usually takes 15-30 minutes.
                        </p>

                        <div className="space-y-3">
                            <button
                                onClick={() => setShowSuccessModal(false)}
                                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors"
                            >
                                Done
                            </button>
                            <button
                                onClick={() => {
                                    setShowSuccessModal(false);
                                    // Navigate to history - this will be handled by parent
                                    window.location.href = '/funds?tab=add-fund-history';
                                }}
                                className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-colors"
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

export default AddFund;
