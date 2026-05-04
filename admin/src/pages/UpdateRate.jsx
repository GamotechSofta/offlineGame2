import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { FaPencilAlt } from 'react-icons/fa';
import useModalBackHandler from '../hooks/useModalBackHandler';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';
import { getAuthHeaders, clearAdminSession, fetchWithAuth } from '../lib/auth';

const SECTION_TITLES = {
    matka: 'Matka / board',
    quiz2d: '2D quiz',
    quiz3d: 'Quiz 3D lottery — rate chart (₹ won per ₹1)',
};

const CATEGORY_ORDER = ['matka', 'quiz2d', 'quiz3d'];

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

    const groupedRates = useMemo(() => {
        const buckets = { matka: [], quiz2d: [], quiz3d: [] };
        (Array.isArray(rates) ? rates : []).forEach((item) => {
            const cat = item.category || 'matka';
            const key = buckets[cat] ? cat : 'matka';
            buckets[key].push(item);
        });
        return buckets;
    }, [rates]);
    const closePasswordModal = useModalBackHandler(showPasswordModal, () => {
        setShowPasswordModal(false);
        setSecretPassword('');
        setPasswordError('');
    });

    useEffect(() => {
        const admin = localStorage.getItem('admin');
        if (!admin) {
            navigate('/');
            return;
        }
        fetchRates();
    }, [navigate]);

    useEffect(() => {
        fetchWithAuth(`${API_BASE_URL}/admin/me/secret-declare-password-status`)
            .then((res) => { if (res.status === 401) return; return res.json(); })
            .then((json) => {
                if (json && json.success) setHasSecretDeclarePassword(json.hasSecretDeclarePassword || false);
            })
            .catch(() => setHasSecretDeclarePassword(false));
    }, []);

    const fetchRates = async () => {
        try {
            setLoading(true);
            setError('');
            const res = await fetchWithAuth(`${API_BASE_URL}/rates`);
            if (res.status === 401) return;
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
        clearAdminSession();
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
            const res = await fetchWithAuth(`${API_BASE_URL}/rates/${editingKey}`, {
                method: 'PATCH',
                body: JSON.stringify(body),
            });
            if (res.status === 401) return;
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
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">{error}</div>
            )}
            <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-center">Update Rate</h1>
            <p className="text-gray-400 mb-6 text-center">
                Payout <span className="text-gray-300 font-semibold">₹ won per ₹1</span> bet — same values used when 3D results are declared.
            </p>

            {loading ? (
                <div className="text-center py-12 text-gray-400">Loading...</div>
            ) : (
                <div className="mx-auto max-w-4xl space-y-8">
                    {CATEGORY_ORDER.map((category) => {
                        const rows = groupedRates[category] || [];
                        if (!rows.length) return null;
                        let rowNum = 0;
                        return (
                            <div key={category} className="overflow-x-auto rounded-lg border-2 border-gray-200 bg-white">
                                <div className="border-b border-gray-200 bg-orange-50 px-4 py-3">
                                    <h2 className="text-lg font-bold text-orange-600">{SECTION_TITLES[category]}</h2>
                                    {category === 'quiz3d' ? (
                                        <p className="mt-1 text-sm text-gray-600">
                                            Edit each <strong>play type</strong> separately (STR, BOX, FP, BP, …). The{' '}
                                            <strong>Fallback</strong> row is only used if a mode does not have its own rate in the database.
                                        </p>
                                    ) : null}
                                </div>
                                <table className="w-full border-collapse text-sm sm:text-base">
                                    <thead>
                                        <tr className="border-b-2 border-black bg-white">
                                            <th className="text-left py-3 px-4 font-bold text-orange-500 border-r border-gray-200">Sr</th>
                                            {category === 'quiz3d' ? (
                                                <th className="text-left py-3 px-4 font-bold text-orange-500 border-r border-gray-200">Play</th>
                                            ) : null}
                                            <th className="text-left py-3 px-4 font-bold text-orange-500 border-r border-gray-200">Admin label</th>
                                            <th className="text-left py-3 px-4 font-bold text-orange-500 border-r border-gray-200">Key</th>
                                            <th className="text-left py-3 px-4 font-bold text-orange-500">₹ per ₹1</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((item) => {
                                            rowNum += 1;
                                            return (
                                                <tr key={item.gameType} className="border-b border-gray-200 hover:bg-orange-50/40">
                                                    <td className="py-2 sm:py-3 px-4 text-gray-600 border-r border-gray-200">{rowNum}</td>
                                                    {category === 'quiz3d' ? (
                                                        <td className="py-2 sm:py-3 px-4 font-bold text-blue-700 border-r border-gray-200 whitespace-nowrap">
                                                            {item.playCode || '—'}
                                                        </td>
                                                    ) : null}
                                                    <td className="py-2 sm:py-3 px-4 font-medium text-gray-800 border-r border-gray-200">
                                                        {item.label || item.gameType}
                                                        {item.note ? (
                                                            <span className="mt-1 block text-xs font-normal text-gray-500">{item.note}</span>
                                                        ) : null}
                                                    </td>
                                                    <td className="py-2 sm:py-3 px-4 border-r border-gray-200 font-mono text-xs text-gray-600">
                                                        {item.gameType}
                                                    </td>
                                                    <td className="py-2 sm:py-3 px-4">
                                                        {editingKey === item.gameType ? (
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <input
                                                                    type="number"
                                                                    min={0}
                                                                    value={editValue}
                                                                    onChange={(e) =>
                                                                        setEditValue(e.target.value.replace(/\D/g, '').slice(0, 9))
                                                                    }
                                                                    className="w-28 px-2 py-1 bg-gray-100 border border-gray-200 rounded text-gray-800 font-mono"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={handleSaveRate}
                                                                    disabled={saveLoading}
                                                                    className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs font-semibold text-white disabled:opacity-50"
                                                                >
                                                                    Save
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={cancelEdit}
                                                                    className="px-2 py-1 bg-gray-200 hover:bg-gray-100 rounded text-xs"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="font-mono text-lg font-bold text-orange-600">×{item.rate}</span>
                                                        )}
                                                        {editingKey !== item.gameType ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => startEdit(item)}
                                                                className="ml-2 p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-800 inline-flex align-middle"
                                                                title="Edit rate"
                                                            >
                                                                <FaPencilAlt className="w-3.5 h-3.5" />
                                                            </button>
                                                        ) : null}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })}
                </div>
            )}

            {showPasswordModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-md">
                        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-orange-500">Confirm Update Rate</h3>
                            <button type="button" onClick={closePasswordModal} className="text-gray-400 hover:text-gray-800 p-1">×</button>
                        </div>
                        <form onSubmit={handlePasswordSubmit} className="p-4 space-y-4">
                            <p className="text-gray-600 text-sm">
                                Enter secret declare password to update this rate.
                            </p>
                            <input
                                type="password"
                                placeholder="Secret declare password"
                                value={secretPassword}
                                onChange={(e) => { setSecretPassword(e.target.value); setPasswordError(''); }}
                                className="w-full px-3 py-2 rounded-lg bg-gray-100 border border-gray-200 text-gray-800 placeholder-gray-400"
                                autoFocus
                            />
                            {passwordError && (
                                <div className="rounded-lg bg-red-900/30 border border-red-600/50 text-red-600 text-sm px-3 py-2">{passwordError}</div>
                            )}
                            <div className="flex gap-2 justify-end">
                                <button type="button" onClick={closePasswordModal} className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-500 text-gray-800 font-semibold">Cancel</button>
                                <button type="submit" disabled={saveLoading} className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-gray-800 font-semibold disabled:opacity-50">
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
