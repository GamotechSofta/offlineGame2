import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const getAuthHeaders = () => {
    const admin = JSON.parse(localStorage.getItem('admin') || '{}');
    const password = sessionStorage.getItem('adminPassword') || '';
    return {
        'Content-Type': 'application/json',
        Authorization: `Basic ${btoa(`${admin.username}:${password}`)}`,
    };
};

const PlayerDevices = () => {
    const { userId } = useParams();
    const navigate = useNavigate();
    const [player, setPlayer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [clearing, setClearing] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const admin = localStorage.getItem('admin');
        if (!admin) {
            navigate('/');
            return;
        }
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const res = await fetch(`${API_BASE_URL}/users/${userId}`, { headers: getAuthHeaders() });
                const data = await res.json();
                if (data.success) {
                    setPlayer(data.data);
                } else {
                    setError(data.message || 'Player not found');
                }
            } catch (err) {
                setError('Network error. Please try again.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [userId, navigate]);

    const handleLogout = () => {
        localStorage.removeItem('admin');
        sessionStorage.removeItem('adminPassword');
        navigate('/');
    };

    const handleClearDevices = async () => {
        if (!window.confirm('Clear all devices for this player? This will remove the devices list. New logins will add devices again.')) {
            return;
        }
        setClearing(true);
        setMessage('');
        setError('');
        try {
            const res = await fetch(`${API_BASE_URL}/users/${userId}/clear-devices`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
            });
            const data = await res.json();
            if (data.success) {
                setMessage('Devices list cleared successfully');
                setPlayer((prev) => (prev ? { ...prev, loginDevices: [] } : null));
                setTimeout(() => setMessage(''), 3000);
            } else {
                setError(data.message || 'Failed to clear devices');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setClearing(false);
        }
    };

    if (loading) {
        return (
            <AdminLayout onLogout={handleLogout} title="Devices used">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 w-48 bg-gray-700 rounded" />
                    <div className="h-64 bg-gray-700 rounded-xl" />
                </div>
            </AdminLayout>
        );
    }

    if (error || !player) {
        return (
            <AdminLayout onLogout={handleLogout} title="Devices used">
                <div className="flex flex-col items-center justify-center min-h-[40vh]">
                    <p className="text-red-400 mb-4">{error || 'Player not found'}</p>
                    <Link to="/all-users" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500 text-black font-semibold">
                        <FaArrowLeft /> Back to All Players
                    </Link>
                </div>
            </AdminLayout>
        );
    }

    const loginDevices = Array.isArray(player.loginDevices) ? player.loginDevices : [];

    return (
        <AdminLayout onLogout={handleLogout} title="Devices used">
            <div className="min-w-0 max-w-full">
                <div className="mb-4">
                    <Link to="/all-users" className="text-gray-400 hover:text-yellow-500 text-sm inline-flex items-center gap-1 mb-1">
                        <FaArrowLeft className="w-4 h-4" /> All Players
                    </Link>
                    <Link to={`/all-users/${userId}`} className="text-gray-400 hover:text-yellow-500 text-sm inline-flex items-center gap-1 mb-2 block">
                        Players » {player.username}
                    </Link>
                    <h1 className="text-2xl sm:text-3xl font-bold">Devices used <span className="text-gray-400 font-normal">» {player.username}</span></h1>
                </div>

                {loginDevices.length > 1 && (
                    <div className="mb-4 rounded-xl border border-red-500/60 bg-red-500/10 px-4 py-3 text-red-200 text-sm font-medium">
                        ⚠️ User has logged in from multiple devices
                    </div>
                )}

                {(message || error) && (
                    <div className={`mb-4 px-4 py-3 rounded-xl text-sm ${message ? 'bg-green-900/30 border border-green-700/60 text-green-200' : 'bg-red-900/30 border border-red-700/60 text-red-200'}`}>
                        {message || error}
                    </div>
                )}

                <div className="mb-4 flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={handleClearDevices}
                        disabled={clearing || loginDevices.length === 0}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-gray-700 border border-gray-600 text-gray-200 hover:bg-red-600 hover:border-red-500 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Clear devices list"
                    >
                        {clearing ? <span className="animate-spin">⏳</span> : 'Clear'}
                    </button>
                </div>

                <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden min-w-0">
                    <div className="p-4 sm:p-6 min-w-0 overflow-x-auto">
                        {loginDevices.length === 0 ? (
                            <p className="text-gray-500 text-sm">—</p>
                        ) : (
                            <table className="w-full text-sm min-w-[320px]">
                                <thead>
                                    <tr className="border-b border-gray-600">
                                        <th className="text-left py-2.5 pr-4 text-xs font-medium text-gray-400 uppercase">Device ID</th>
                                        <th className="text-left py-2.5 pr-4 text-xs font-medium text-gray-400 uppercase">First Login Date</th>
                                        <th className="text-left py-2.5 pr-4 text-xs font-medium text-gray-400 uppercase">Last Login Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {loginDevices.map((d, i) => (
                                        <tr key={(d.deviceId || i).toString()} className="hover:bg-gray-700/30">
                                            <td className="py-2.5 pr-4 font-mono text-gray-300 truncate max-w-[200px] sm:max-w-none" title={d.deviceId}>{d.deviceId || '—'}</td>
                                            <td className="py-2.5 pr-4 text-gray-400">
                                                {d.firstLoginAt ? new Date(d.firstLoginAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                                            </td>
                                            <td className="py-2.5 pr-4 text-gray-400">
                                                {d.lastLoginAt ? new Date(d.lastLoginAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};

export default PlayerDevices;
