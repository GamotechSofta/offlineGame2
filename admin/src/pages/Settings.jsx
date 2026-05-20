import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { clearAdminSession, fetchWithAuth, getStoredAdmin } from '../lib/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const Settings = () => {
    const navigate = useNavigate();
    const [currentSecretPassword, setCurrentSecretPassword] = useState('');
    const [forgotSecret, setForgotSecret] = useState(false);
    const [adminLoginPassword, setAdminLoginPassword] = useState('');
    const [secretDeclarePassword, setSecretDeclarePassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [statusMsg, setStatusMsg] = useState('');
    const [hasSecret, setHasSecret] = useState(false);

    const isSuperAdmin = getStoredAdmin()?.role === 'super_admin';

    const [paymentUi, setPaymentUi] = useState({
        upiId: '',
        minDeposit: '',
        maxDeposit: '',
        minWithdrawal: '',
        maxWithdrawal: '',
    });
    const [paymentUiEffective, setPaymentUiEffective] = useState(null);
    const [paymentUiLoading, setPaymentUiLoading] = useState(false);
    const [paymentUiSaving, setPaymentUiSaving] = useState(false);
    const [paymentUiMessage, setPaymentUiMessage] = useState(null);

    useEffect(() => {
        if (!isSuperAdmin) return undefined;
        let cancelled = false;
        (async () => {
            setPaymentUiLoading(true);
            setPaymentUiMessage(null);
            try {
                const res = await fetchWithAuth(`${API_BASE_URL}/admin/payment-ui-config`);
                if (res.status === 401) return;
                const json = await res.json().catch(() => ({}));
                if (!res.ok || !json.success) {
                    throw new Error(json?.message || 'Failed to load payment settings');
                }
                if (cancelled) return;
                const f = json.data?.form || {};
                setPaymentUi({
                    upiId: f.upiId ?? '',
                    minDeposit: f.minDeposit !== '' && f.minDeposit != null ? String(f.minDeposit) : '',
                    maxDeposit: f.maxDeposit !== '' && f.maxDeposit != null ? String(f.maxDeposit) : '',
                    minWithdrawal:
                        f.minWithdrawal !== '' && f.minWithdrawal != null ? String(f.minWithdrawal) : '',
                    maxWithdrawal:
                        f.maxWithdrawal !== '' && f.maxWithdrawal != null ? String(f.maxWithdrawal) : '',
                });
                setPaymentUiEffective(json.data?.effective || null);
            } catch (e) {
                if (!cancelled) {
                    setPaymentUiMessage({ type: 'error', text: e.message || 'Failed to load payment settings' });
                }
            } finally {
                if (!cancelled) setPaymentUiLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [isSuperAdmin]);

    const savePaymentUi = async (e) => {
        e.preventDefault();
        if (!isSuperAdmin) return;
        setPaymentUiSaving(true);
        setPaymentUiMessage(null);
        try {
            const body = {
                upiId: paymentUi.upiId.trim(),
                minDeposit: paymentUi.minDeposit === '' ? null : Number(paymentUi.minDeposit),
                maxDeposit: paymentUi.maxDeposit === '' ? null : Number(paymentUi.maxDeposit),
                minWithdrawal: paymentUi.minWithdrawal === '' ? null : Number(paymentUi.minWithdrawal),
                maxWithdrawal: paymentUi.maxWithdrawal === '' ? null : Number(paymentUi.maxWithdrawal),
            };
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/payment-ui-config`, {
                method: 'PATCH',
                body: JSON.stringify(body),
            });
            if (res.status === 401) return;
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.success) {
                throw new Error(json?.message || 'Failed to save payment settings');
            }
            setPaymentUiEffective(json.data || null);
            setPaymentUiMessage({
                type: 'success',
                text: 'Payment / UPI settings saved. Players will see updates on next page load.',
            });
        } catch (e) {
            setPaymentUiMessage({ type: 'error', text: e.message || 'Failed to save payment settings' });
        } finally {
            setPaymentUiSaving(false);
        }
    };

    useEffect(() => {
        fetchWithAuth(`${API_BASE_URL}/admin/me/secret-declare-password-status`)
            .then((res) => { if (res.status === 401) return; return res.json(); })
            .then((json) => {
                if (json && json.success) setHasSecret(json.hasSecretDeclarePassword || false);
            })
            .catch(() => setHasSecret(false));
    }, []);

    const handleSetSecret = async (e) => {
        e.preventDefault();
        setStatusMsg('');
        if (hasSecret) {
            const useForgot = forgotSecret ? adminLoginPassword.trim() : currentSecretPassword.trim();
            if (!useForgot) {
                setStatusMsg(forgotSecret ? 'Admin login password is required to reset' : 'Current secret password is required to change it');
                return;
            }
        }
        if (secretDeclarePassword.length < 4) {
            setStatusMsg('Secret declare password must be at least 4 characters');
            return;
        }
        if (secretDeclarePassword !== confirmPassword) {
            setStatusMsg('Passwords do not match');
            return;
        }
        setLoading(true);
        try {
            const body = { secretDeclarePassword };
            if (hasSecret) {
                if (forgotSecret) {
                    body.adminLoginPassword = adminLoginPassword;
                } else {
                    body.currentSecretDeclarePassword = currentSecretPassword;
                }
            }
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/me/secret-declare-password`, {
                method: 'PATCH',
                body: JSON.stringify(body),
            });
            if (res.status === 401) return;
            const json = await res.json();
            if (json.success) {
                setCurrentSecretPassword('');
                setAdminLoginPassword('');
                setForgotSecret(false);
                setSecretDeclarePassword('');
                setConfirmPassword('');
                setHasSecret(true);
                setStatusMsg('Secret declare password set successfully');
            } else {
                setStatusMsg(json.message || 'Failed to set password');
            }
        } catch {
            setStatusMsg('Network error');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        clearAdminSession();
        navigate('/');
    };

    return (
        <AdminLayout onLogout={handleLogout} title="Settings">
            <div className="w-full min-w-0 px-3 sm:px-4 md:px-6 pb-6 sm:pb-8">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6">Settings</h1>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start w-full max-w-6xl">
                    <div className="rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden min-w-0 w-full">
                    <h2 className="text-lg font-bold text-orange-500 bg-white px-4 py-3 border-b border-gray-200">
                        Secret Declare Password
                    </h2>
                    <div className="p-4 space-y-3">
                        <p className="text-gray-400 text-sm">
                            This password is required when declaring results (Confirm &amp; Declare) for extra security.
                            {hasSecret && <span className="block mt-1 text-green-600">Password is currently set.</span>}
                        </p>
                        <form onSubmit={handleSetSecret} className="space-y-4">
                            {hasSecret && (
                                <div>
                                    {!forgotSecret ? (
                                        <>
                                            <label className="block text-sm font-medium text-gray-600 mb-1">
                                                Current secret password *
                                            </label>
                                            <input
                                                type="password"
                                                value={currentSecretPassword}
                                                onChange={(e) => { setCurrentSecretPassword(e.target.value); setAdminLoginPassword(''); setStatusMsg(''); }}
                                                placeholder=""
                                                className="w-full px-4 py-2.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                                autoComplete="current-password"
                                            />
                                            <p className="mt-1 text-xs text-gray-500">Enter current secret password to verify it&apos;s you before changing.</p>
                                            <button
                                                type="button"
                                                onClick={() => { setForgotSecret(true); setCurrentSecretPassword(''); setAdminLoginPassword(''); setStatusMsg(''); }}
                                                className="mt-2 text-xs text-orange-500 hover:text-orange-600 underline"
                                            >
                                                Forgot current secret password?
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <label className="block text-sm font-medium text-gray-600 mb-1">
                                                Admin login password * (reset option)
                                            </label>
                                            <input
                                                type="password"
                                                value={adminLoginPassword}
                                                onChange={(e) => { setAdminLoginPassword(e.target.value); setStatusMsg(''); }}
                                                placeholder=""
                                                className="w-full px-4 py-2.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                                autoComplete="current-password"
                                            />
                                            <p className="mt-1 text-xs text-gray-500">Enter the password you use to log into admin panel. This proves you&apos;re the admin and allows you to reset the secret.</p>
                                            <button
                                                type="button"
                                                onClick={() => { setForgotSecret(false); setAdminLoginPassword(''); setCurrentSecretPassword(''); setStatusMsg(''); }}
                                                className="mt-2 text-xs text-orange-500 hover:text-orange-600 underline"
                                            >
                                                I remember my secret password
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">
                                    {hasSecret ? 'New secret password' : 'Secret password'}
                                </label>
                                <input
                                    type="password"
                                    value={secretDeclarePassword}
                                    onChange={(e) => setSecretDeclarePassword(e.target.value)}
                                    placeholder=""
                                    className="w-full px-4 py-2.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Confirm password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder=""
                                    className="w-full px-4 py-2.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                />
                            </div>
                            {statusMsg && (
                                <p className={`text-sm ${statusMsg.includes('success') ? 'text-green-600' : 'text-red-500'}`}>
                                    {statusMsg}
                                </p>
                            )}
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-gray-800 font-semibold rounded-lg disabled:opacity-50 transition-colors"
                            >
                                {loading ? 'Saving...' : 'Set Secret Password'}
                            </button>
                        </form>
                    </div>
                </div>

                {isSuperAdmin && (
                    <div className="rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden min-w-0 w-full">
                        <h2 className="text-lg font-bold text-orange-500 bg-white px-4 py-3 border-b border-gray-200">
                            Payment / UPI (Add Fund &amp; Withdraw)
                        </h2>
                        <div className="p-4 space-y-3">
                            <p className="text-gray-400 text-sm">
                                Set the UPI ID shown to players. Leave UPI empty to use the server default from
                                environment variables. Payee name for UPI apps comes from{' '}
                                <code className="text-gray-600">UPI_NAME</code> in server config, not from this screen.
                                Min/max amounts apply to deposit and withdrawal requests.
                            </p>
                            {paymentUiLoading && <p className="text-sm text-gray-500">Loading…</p>}
                            {paymentUiMessage && (
                                <p
                                    className={`text-sm ${
                                        paymentUiMessage.type === 'success' ? 'text-green-600' : 'text-red-500'
                                    }`}
                                >
                                    {paymentUiMessage.text}
                                </p>
                            )}
                            <form onSubmit={savePaymentUi} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-1">UPI ID</label>
                                    <input
                                        type="text"
                                        value={paymentUi.upiId}
                                        onChange={(e) => setPaymentUi((p) => ({ ...p, upiId: e.target.value }))}
                                        placeholder="e.g. 9876543210@ybl"
                                        className="w-full px-4 py-2.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                        autoComplete="off"
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-600 mb-1">
                                            Min deposit (₹)
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={paymentUi.minDeposit}
                                            onChange={(e) => setPaymentUi((p) => ({ ...p, minDeposit: e.target.value }))}
                                            placeholder="Default from server"
                                            className="w-full px-4 py-2.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-600 mb-1">
                                            Max deposit (₹)
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={paymentUi.maxDeposit}
                                            onChange={(e) => setPaymentUi((p) => ({ ...p, maxDeposit: e.target.value }))}
                                            placeholder="Default from server"
                                            className="w-full px-4 py-2.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-600 mb-1">
                                            Min withdrawal (₹)
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={paymentUi.minWithdrawal}
                                            onChange={(e) =>
                                                setPaymentUi((p) => ({ ...p, minWithdrawal: e.target.value }))
                                            }
                                            placeholder="Default from server"
                                            className="w-full px-4 py-2.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-600 mb-1">
                                            Max withdrawal (₹)
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={paymentUi.maxWithdrawal}
                                            onChange={(e) =>
                                                setPaymentUi((p) => ({ ...p, maxWithdrawal: e.target.value }))
                                            }
                                            placeholder="Default from server"
                                            className="w-full px-4 py-2.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>
                                {paymentUiEffective && (
                                    <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-xs text-gray-600 space-y-1">
                                        <p className="font-semibold text-gray-700">Effective (what players see)</p>
                                        <p>
                                            UPI: <span className="text-gray-800">{paymentUiEffective.upiId}</span>
                                        </p>
                                        <p>
                                            Deposit: ₹{paymentUiEffective.minDeposit} – ₹{paymentUiEffective.maxDeposit}
                                        </p>
                                        <p>
                                            Withdrawal: ₹{paymentUiEffective.minWithdrawal} – ₹
                                            {paymentUiEffective.maxWithdrawal}
                                        </p>
                                    </div>
                                )}
                                <button
                                    type="submit"
                                    disabled={paymentUiSaving || paymentUiLoading}
                                    className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-gray-800 font-semibold rounded-lg disabled:opacity-50 transition-colors"
                                >
                                    {paymentUiSaving ? 'Saving…' : 'Save payment settings'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}
                </div>
            </div>
        </AdminLayout>
    );
};

export default Settings;
