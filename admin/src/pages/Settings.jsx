import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const getAuthHeaders = () => {
    const admin = JSON.parse(localStorage.getItem('admin') || '{}');
    const password = sessionStorage.getItem('adminPassword') || '';
    return {
        'Content-Type': 'application/json',
        Authorization: `Basic ${btoa(`${admin.username}:${password}`)}`,
    };
};

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

    useEffect(() => {
        fetch(`${API_BASE_URL}/admin/me/secret-declare-password-status`, { headers: getAuthHeaders() })
            .then((res) => res.json())
            .then((json) => {
                if (json.success) setHasSecret(json.hasSecretDeclarePassword || false);
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
            const res = await fetch(`${API_BASE_URL}/admin/me/secret-declare-password`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify(body),
            });
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
        localStorage.removeItem('admin');
        sessionStorage.removeItem('adminPassword');
        navigate('/');
    };

    return (
        <AdminLayout onLogout={handleLogout} title="Settings">
            <div className="w-full min-w-0 px-3 sm:px-4 md:px-6 pb-6 sm:pb-8">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6">Settings</h1>

                <div className="rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden max-w-xl">
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
            </div>
        </AdminLayout>
    );
};

export default Settings;
