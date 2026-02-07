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
            const res = await fetch(`${API_BASE_URL}/admin/me/secret-declare-password`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({ secretDeclarePassword }),
            });
            const json = await res.json();
            if (json.success) {
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
                <h1 className="text-xl sm:text-2xl font-bold text-white mb-6">Settings</h1>

                <div className="rounded-xl border border-gray-700 bg-gray-800/80 shadow-lg overflow-hidden max-w-xl">
                    <h2 className="text-lg font-bold text-yellow-500 bg-gray-800 px-4 py-3 border-b border-gray-700">
                        Secret Declare Password
                    </h2>
                    <div className="p-4 space-y-3">
                        <p className="text-gray-400 text-sm">
                            This password is required when declaring results (Confirm &amp; Declare) for extra security.
                            {hasSecret && <span className="block mt-1 text-green-400">Password is currently set.</span>}
                        </p>
                        <form onSubmit={handleSetSecret} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    {hasSecret ? 'New secret password' : 'Secret password'}
                                </label>
                                <input
                                    type="password"
                                    value={secretDeclarePassword}
                                    onChange={(e) => setSecretDeclarePassword(e.target.value)}
                                    placeholder="Min 4 characters"
                                    className="w-full px-4 py-2.5 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-500 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Confirm password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Re-enter password"
                                    className="w-full px-4 py-2.5 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-500 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                                />
                            </div>
                            {statusMsg && (
                                <p className={`text-sm ${statusMsg.includes('success') ? 'text-green-400' : 'text-red-400'}`}>
                                    {statusMsg}
                                </p>
                            )}
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-lg disabled:opacity-50 transition-colors"
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
