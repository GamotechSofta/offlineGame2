import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { FaEdit, FaTrash, FaPlus, FaTimes, FaEye, FaEyeSlash, FaUserShield } from 'react-icons/fa';
import useModalBackHandler from '../hooks/useModalBackHandler';
import { fetchWithAuth, clearAdminSession, getStoredAdmin } from '../lib/auth';
import { TAB_OPTIONS, getTabLabel, getDefaultRouteForAdmin } from '../config/adminMenu';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

function TabCheckboxes({ tabs, onToggle }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
            {TAB_OPTIONS.map((opt) => (
                <label key={opt.path} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={tabs.includes(opt.path)}
                        onChange={() => onToggle(opt.path)}
                        className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                    />
                    <span>{opt.label}</span>
                </label>
            ))}
        </div>
    );
}

const SpecificAdminManagementPage = () => {
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selected, setSelected] = useState(null);
    const [revealedSecrets, setRevealedSecrets] = useState({});

    const [formData, setFormData] = useState({
        username: '',
        password: '',
        secretDeclarePassword: '',
        allowedTabs: [],
    });
    const [editData, setEditData] = useState({
        password: '',
        secretDeclarePassword: '',
        clearSecret: false,
        allowedTabs: [],
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showSecret, setShowSecret] = useState(false);
    const [formLoading, setFormLoading] = useState(false);

    const closeCreateModal = useModalBackHandler(showCreateModal, () => setShowCreateModal(false));
    const closeEditModal = useModalBackHandler(showEditModal, () => setShowEditModal(false));
    const closeDeleteModal = useModalBackHandler(showDeleteModal, () => setShowDeleteModal(false));

    const handleLogout = () => {
        clearAdminSession();
        window.location.href = '/';
    };

    const fetchAdmins = async () => {
        try {
            setLoading(true);
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/specific-admins`);
            if (res.status === 401) return;
            const json = await res.json();
            if (json.success) {
                setAdmins(json.data || []);
            } else {
                setError(json.message || 'Failed to load Super Bookie accounts');
            }
        } catch {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAdmins();
    }, []);

    const toggleFormTab = (path) => {
        setFormData((prev) => ({
            ...prev,
            allowedTabs: prev.allowedTabs.includes(path)
                ? prev.allowedTabs.filter((p) => p !== path)
                : [...prev.allowedTabs, path],
        }));
    };

    const toggleEditTab = (path) => {
        setEditData((prev) => ({
            ...prev,
            allowedTabs: prev.allowedTabs.includes(path)
                ? prev.allowedTabs.filter((p) => p !== path)
                : [...prev.allowedTabs, path],
        }));
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        if (formData.secretDeclarePassword.length < 4) {
            setError('Secret declare password must be at least 4 characters');
            return;
        }
        if (formData.allowedTabs.length === 0) {
            setError('Select at least one tab');
            return;
        }
        setFormLoading(true);
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/specific-admins`, {
                method: 'POST',
                body: JSON.stringify({
                    username: formData.username.trim(),
                    password: formData.password,
                    secretDeclarePassword: formData.secretDeclarePassword,
                    allowedTabs: formData.allowedTabs,
                }),
            });
            const json = await res.json();
            if (json.success) {
                setSuccess('Super Bookie created');
                setShowCreateModal(false);
                setFormData({ username: '', password: '', secretDeclarePassword: '', allowedTabs: [] });
                if (json.data?.id && json.data?.secretDeclarePasswordPlain) {
                    setRevealedSecrets((prev) => ({
                        ...prev,
                        [json.data.id]: json.data.secretDeclarePasswordPlain,
                    }));
                }
                await fetchAdmins();
            } else {
                setError(json.message || 'Create failed');
            }
        } catch {
            setError('Network error');
        } finally {
            setFormLoading(false);
        }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        if (editData.password && editData.password.length < 6) {
            setError('New password must be at least 6 characters');
            return;
        }
        if (!editData.clearSecret && editData.secretDeclarePassword && editData.secretDeclarePassword.length < 4) {
            setError('Secret declare password must be at least 4 characters');
            return;
        }
        if (editData.allowedTabs.length === 0) {
            setError('Select at least one tab');
            return;
        }
        const body = { allowedTabs: editData.allowedTabs };
        if (editData.password) body.password = editData.password;
        if (editData.clearSecret) {
            body.secretDeclarePassword = null;
        } else if (editData.secretDeclarePassword.trim()) {
            body.secretDeclarePassword = editData.secretDeclarePassword.trim();
        }
        setFormLoading(true);
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/specific-admins/${selected.id}`, {
                method: 'PUT',
                body: JSON.stringify(body),
            });
            const json = await res.json();
            if (json.success) {
                setSuccess('Super Bookie updated');
                setShowEditModal(false);
                setSelected(null);
                await fetchAdmins();
            } else {
                setError(json.message || 'Update failed');
            }
        } catch {
            setError('Network error');
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async () => {
        setFormLoading(true);
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/specific-admins/${selected.id}`, {
                method: 'DELETE',
            });
            const json = await res.json();
            if (json.success) {
                setSuccess('Super Bookie deleted');
                setShowDeleteModal(false);
                setSelected(null);
                await fetchAdmins();
            } else {
                setError(json.message || 'Delete failed');
            }
        } catch {
            setError('Network error');
        } finally {
            setFormLoading(false);
        }
    };

    return (
        <AdminLayout onLogout={handleLogout} title="Super Bookie">
            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <FaUserShield className="text-orange-500" />
                            Super Bookie
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Super Bookie accounts with selected tabs and a declare secret.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setFormData({ username: '', password: '', secretDeclarePassword: '', allowedTabs: [] });
                            setShowPassword(false);
                            setShowSecret(false);
                            setShowCreateModal(true);
                        }}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600"
                    >
                        <FaPlus /> Add Super Bookie
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
                )}
                {success && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                        {success}
                    </div>
                )}

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    {loading ? (
                        <p className="p-8 text-center text-gray-500">Loading...</p>
                    ) : admins.length === 0 ? (
                        <p className="p-8 text-center text-gray-500">No Super Bookie accounts yet.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="text-left p-3 font-semibold text-gray-600">Username</th>
                                        <th className="text-left p-3 font-semibold text-gray-600">Declare secret</th>
                                        <th className="text-left p-3 font-semibold text-gray-600">Allowed tabs</th>
                                        <th className="text-right p-3 font-semibold text-gray-600">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {admins.map((row) => (
                                        <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                                            <td className="p-3 font-medium text-gray-800">{row.username}</td>
                                            <td className="p-3 text-gray-600">
                                                {revealedSecrets[row.id] ? (
                                                    <code className="text-xs bg-amber-50 px-2 py-1 rounded border border-amber-200">
                                                        {revealedSecrets[row.id]}
                                                    </code>
                                                ) : row.hasSecretDeclarePassword ? (
                                                    <span className="text-green-600 font-medium">Set</span>
                                                ) : (
                                                    <span className="text-gray-400">Not set</span>
                                                )}
                                            </td>
                                            <td className="p-3 text-gray-600 max-w-md">
                                                <div className="flex flex-wrap gap-1">
                                                    {(row.allowedTabs || []).map((p) => (
                                                        <span
                                                            key={p}
                                                            className="inline-block px-2 py-0.5 bg-orange-50 text-orange-800 rounded text-xs"
                                                        >
                                                            {getTabLabel(p)}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="p-3 text-right whitespace-nowrap">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelected(row);
                                                        setEditData({
                                                            password: '',
                                                            secretDeclarePassword: '',
                                                            clearSecret: false,
                                                            allowedTabs: [...(row.allowedTabs || [])],
                                                        });
                                                        setShowPassword(false);
                                                        setShowSecret(false);
                                                        setShowEditModal(true);
                                                    }}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg mr-1"
                                                    title="Edit"
                                                >
                                                    <FaEdit />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelected(row);
                                                        setShowDeleteModal(true);
                                                    }}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                                    title="Delete"
                                                >
                                                    <FaTrash />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {showCreateModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-lg font-bold">Create Super Bookie</h2>
                            <button type="button" onClick={closeCreateModal} className="p-2 text-gray-400 hover:text-gray-600">
                                <FaTimes />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Username</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Password (min 6)</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        minLength={6}
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10"
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <FaEyeSlash /> : <FaEye />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">
                                    Secret declare password (min 4)
                                </label>
                                <div className="relative">
                                    <input
                                        type={showSecret ? 'text' : 'password'}
                                        required
                                        minLength={4}
                                        value={formData.secretDeclarePassword}
                                        onChange={(e) =>
                                            setFormData({ ...formData, secretDeclarePassword: e.target.value })
                                        }
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10"
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                                        onClick={() => setShowSecret(!showSecret)}
                                    >
                                        {showSecret ? <FaEyeSlash /> : <FaEye />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-2">Allowed tabs</label>
                                <TabCheckboxes tabs={formData.allowedTabs} onToggle={toggleFormTab} />
                            </div>
                            <div className="flex gap-2 justify-end pt-2">
                                <button type="button" onClick={closeCreateModal} className="px-4 py-2 border border-gray-300 rounded-lg">
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={formLoading}
                                    className="px-4 py-2 bg-orange-500 text-white rounded-lg font-semibold disabled:opacity-50"
                                >
                                    {formLoading ? 'Creating...' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showEditModal && selected && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-lg font-bold">Edit — {selected.username}</h2>
                            <button type="button" onClick={closeEditModal} className="p-2 text-gray-400 hover:text-gray-600">
                                <FaTimes />
                            </button>
                        </div>
                        <form onSubmit={handleUpdate} className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">
                                    New login password (optional, min 6)
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={editData.password}
                                        onChange={(e) => setEditData({ ...editData, password: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10"
                                        placeholder="Leave blank to keep current"
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <FaEyeSlash /> : <FaEye />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Secret declare password</label>
                                {selected.hasSecretDeclarePassword && (
                                    <label className="flex items-center gap-2 text-sm text-red-600 mb-2">
                                        <input
                                            type="checkbox"
                                            checked={editData.clearSecret}
                                            onChange={(e) =>
                                                setEditData({
                                                    ...editData,
                                                    clearSecret: e.target.checked,
                                                    secretDeclarePassword: e.target.checked ? '' : editData.secretDeclarePassword,
                                                })
                                            }
                                        />
                                        Clear secret password
                                    </label>
                                )}
                                {!editData.clearSecret && (
                                    <div className="relative">
                                        <input
                                            type={showSecret ? 'text' : 'password'}
                                            value={editData.secretDeclarePassword}
                                            onChange={(e) =>
                                                setEditData({ ...editData, secretDeclarePassword: e.target.value })
                                            }
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10"
                                            placeholder={
                                                selected.hasSecretDeclarePassword
                                                    ? 'Enter new secret to replace'
                                                    : 'Min 4 characters'
                                            }
                                        />
                                        <button
                                            type="button"
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
                                            onClick={() => setShowSecret(!showSecret)}
                                        >
                                            {showSecret ? <FaEyeSlash /> : <FaEye />}
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-2">Allowed tabs</label>
                                <TabCheckboxes tabs={editData.allowedTabs} onToggle={toggleEditTab} />
                            </div>
                            <div className="flex gap-2 justify-end pt-2">
                                <button type="button" onClick={closeEditModal} className="px-4 py-2 border border-gray-300 rounded-lg">
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={formLoading}
                                    className="px-4 py-2 bg-orange-500 text-white rounded-lg font-semibold disabled:opacity-50"
                                >
                                    {formLoading ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showDeleteModal && selected && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                        <h2 className="text-lg font-bold text-gray-800 mb-2">Delete Super Bookie?</h2>
                        <p className="text-sm text-gray-600 mb-6">
                            Remove <strong>{selected.username}</strong>? This cannot be undone.
                        </p>
                        <div className="flex gap-2 justify-end">
                            <button type="button" onClick={closeDeleteModal} className="px-4 py-2 border border-gray-300 rounded-lg">
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={formLoading}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold disabled:opacity-50"
                            >
                                {formLoading ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

const SpecificAdminManagement = () => {
    const stored = getStoredAdmin();
    if (stored?.role !== 'super_admin') {
        return <Navigate to={getDefaultRouteForAdmin(stored)} replace />;
    }
    return <SpecificAdminManagementPage />;
};

export default SpecificAdminManagement;
