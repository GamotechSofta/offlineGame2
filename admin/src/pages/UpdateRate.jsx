import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { FaPencilAlt } from 'react-icons/fa';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const GAME_LABELS = {
    single: 'Single Digit',
    jodi: 'Jodi',
    singlePatti: 'Single Patti',
    doublePatti: 'Double Patti',
    triplePatti: 'Triple Patti',
    halfSangam: 'Half Sangam',
    fullSangam: 'Full Sangam',
};

const UpdateRate = () => {
    const [rates, setRates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editingKey, setEditingKey] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [saveLoading, setSaveLoading] = useState(false);
    const [hasSecretDeclarePassword, setHasSecretDeclarePassword] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [secretPassword, setSecretPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const admin = localStorage.getItem('admin');
        if (!admin) {
            navigate('/');
            return;
        }
        fetchRates();
    }, [navigate]);

    useEffect(() => {
        fetch(`${API_BASE_URL}/admin/me/secret-declare-password-status`, { headers: getAuthHeaders() })
            .then((res) => res.json())
            .then((json) => {
                if (json.success) setHasSecretDeclarePassword(json.hasSecretDeclarePassword || false);
            })
            .catch(() => setHasSecretDeclarePassword(false));
    }, []);

    const getAuthHeaders = () => {
        const admin = JSON.parse(localStorage.getItem('admin') || '{}');
        const password = sessionStorage.getItem('adminPassword') || '';
        return {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${btoa(`${admin.username}:${password}`)}`,
        };
    };

    const fetchRates = async () => {
        try {
            setLoading(true);
            setError('');
            const res = await fetch(`${API_BASE_URL}/rates`, { headers: getAuthHeaders() });
            const data = await res.json();
            if (data.success) setRates(data.data || []);
            else setError(data.message || 'Failed to fetch rates');
        } catch (err) {
            setError('Network error.');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('admin');
        sessionStorage.removeItem('adminPassword');
        navigate('/');
    };

    const startEdit = (item) => {
        setEditingKey(item.gameType);
        setEditValue(String(item.rate ?? ''));
    };

    const cancelEdit = () => {
        setEditingKey(null);
        setEditValue('');
    };

    const performSaveRate = async (secretDeclarePasswordValue) => {
        if (!editingKey) return;
        const num = parseInt(editValue, 10);
        if (!Number.isFinite(num) || num < 0) {
            alert('Enter a valid non-negative number.');
            return;
        }
        setSaveLoading(true);
        setPasswordError('');
        try {
            const body = { rate: num };
            if (secretDeclarePasswordValue) body.secretDeclarePassword = secretDeclarePasswordValue;
            const res = await fetch(`${API_BASE_URL}/rates/${editingKey}`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (data.success) {
                setShowPasswordModal(false);
                setSecretPassword('');
                cancelEdit();
                if (Array.isArray(data.data)) setRates(data.data);
                else fetchRates();
            } else {
                if (data.code === 'INVALID_SECRET_DECLARE_PASSWORD') {
                    setPasswordError(data.message || 'Invalid secret password');
                } else {
                    alert(data.message || 'Failed to update rate');
                }
            }
        } catch (err) {
            alert('Network error');
        } finally {
            setSaveLoading(false);
        }
    };

    const handleSaveRate = () => {
        if (!editingKey) return;
        const num = parseInt(editValue, 10);
        if (!Number.isFinite(num) || num < 0) {
            alert('Enter a valid non-negative number.');
            return;
        }
        if (hasSecretDeclarePassword) {
            setShowPasswordModal(true);
            setSecretPassword('');
            setPasswordError('');
        } else {
            performSaveRate('');
        }
    };

    const handlePasswordSubmit = (e) => {
        e.preventDefault();
        const val = secretPassword.trim();
        if (hasSecretDeclarePassword && !val) {
            setPasswordError('Please enter the secret declare password');
            return;
        }
        performSaveRate(val);
    };

    return (
        <AdminLayout onLogout={handleLogout} title="Update Rate">
            {error && (
                <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">{error}</div>
            )}
            <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-center">Update Rate</h1>
            <p className="text-gray-400 mb-6 text-center">Payout rate per 1 unit bet (1 =)</p>

            {loading ? (
                <div className="text-center py-12 text-gray-400">Loading...</div>
            ) : (
                <div className="overflow-x-auto max-w-2xl mx-auto rounded-lg border-2 border-gray-700 bg-gray-800/50">
                    <table className="w-full border-collapse text-sm sm:text-base">
                        <thead>
                            <tr className="bg-gray-800 border-b-2 border-black">
                                <th className="text-left py-3 px-4 font-bold text-amber-400 border-r border-gray-600">Sr No</th>
                                <th className="text-left py-3 px-4 font-bold text-amber-400 border-r border-gray-600">Game</th>
                                <th className="text-left py-3 px-4 font-bold text-amber-400">Rate (1 =)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rates.map((item, idx) => (
                                <tr key={item.gameType} className="border-b border-gray-700 hover:bg-gray-800/70">
                                    <td className="py-2 sm:py-3 px-4 text-gray-300 border-r border-gray-600">{idx + 1}</td>
                                    <td className="py-2 sm:py-3 px-4 font-medium text-white border-r border-gray-600">
                                        {GAME_LABELS[item.gameType] || item.gameType}
                                    </td>
                                    <td className="py-2 sm:py-3 px-4">
                                        {editingKey === item.gameType ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value.replace(/\D/g, '').slice(0, 8))}
                                                    className="w-24 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white font-mono"
                                                />
                                                <button
                                                    onClick={handleSaveRate}
                                                    disabled={saveLoading}
                                                    className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs font-semibold disabled:opacity-50"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    onClick={cancelEdit}
                                                    className="px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded text-xs"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="font-mono text-yellow-400">{item.rate}</span>
                                        )}
                                        {editingKey !== item.gameType && (
                                            <button
                                                type="button"
                                                onClick={() => startEdit(item)}
                                                className="ml-2 p-1 rounded hover:bg-gray-600 text-gray-400 hover:text-white inline-flex align-middle"
                                                title="Edit rate"
                                            >
                                                <FaPencilAlt className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showPasswordModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60">
                    <div className="bg-gray-800 rounded-xl border border-gray-600 shadow-xl w-full max-w-md">
                        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-yellow-500">Confirm Update Rate</h3>
                            <button type="button" onClick={() => { setShowPasswordModal(false); setSecretPassword(''); setPasswordError(''); }} className="text-gray-400 hover:text-white p-1">×</button>
                        </div>
                        <form onSubmit={handlePasswordSubmit} className="p-4 space-y-4">
                            <p className="text-gray-300 text-sm">
                                Enter secret declare password to update this rate.
                            </p>
                            <input
                                type="password"
                                placeholder="Secret declare password"
                                value={secretPassword}
                                onChange={(e) => { setSecretPassword(e.target.value); setPasswordError(''); }}
                                className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-500"
                                autoFocus
                            />
                            {passwordError && (
                                <div className="rounded-lg bg-red-900/30 border border-red-600/50 text-red-200 text-sm px-3 py-2">{passwordError}</div>
                            )}
                            <div className="flex gap-2 justify-end">
                                <button type="button" onClick={() => { setShowPasswordModal(false); setSecretPassword(''); setPasswordError(''); }} className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 text-white font-semibold">Cancel</button>
                                <button type="submit" disabled={saveLoading} className="px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-black font-semibold disabled:opacity-50">
                                    {saveLoading ? <span className="animate-spin">⏳</span> : 'Confirm'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default UpdateRate;
