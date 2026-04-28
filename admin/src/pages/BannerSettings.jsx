import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { clearAdminSession } from '../lib/auth';

const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.DEV ? 'http://localhost:3010/api/v1' : 'https://api.singlepana.in/api/v1');
const normalizeRows = (rows) => rows.map((item) => String(item || '').trim()).filter(Boolean);

const BannerSettings = () => {
    const navigate = useNavigate();
    const [desktopRows, setDesktopRows] = useState(['']);
    const [mobileRows, setMobileRows] = useState(['']);
    const [desktopFiles, setDesktopFiles] = useState([]);
    const [mobileFiles, setMobileFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [statusMsg, setStatusMsg] = useState('');

    const handleUnauthorized = () => {
        clearAdminSession();
        navigate('/');
    };

    const getAuthHeader = () => {
        const token = localStorage.getItem('adminToken');
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    const fetchBannerSettings = async () => {
        setLoading(true);
        setStatusMsg('');
        try {
            const res = await fetch(`${API_BASE_URL}/banner-settings/admin`, {
                headers: {
                    ...getAuthHeader(),
                },
            });
            if (res.status === 401) {
                handleUnauthorized();
                return;
            }
            if (!res.ok) {
                setStatusMsg(`Failed to load banner settings (${res.status})`);
                return;
            }
            const json = await res.json();
            if (json.success) {
                const nextDesktop = normalizeRows(json.data?.desktopBanners || []);
                const nextMobile = normalizeRows(json.data?.mobileBanners || []);
                setDesktopRows(nextDesktop.length ? nextDesktop : ['']);
                setMobileRows(nextMobile.length ? nextMobile : ['']);
            } else {
                setStatusMsg(json.message || 'Failed to load banner settings');
            }
        } catch (error) {
            setStatusMsg(error?.message ? `Network error: ${error.message}` : 'Network error while loading banner settings');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBannerSettings();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setStatusMsg('');

        try {
            const formData = new FormData();
            const desktopBanners = normalizeRows(desktopRows);
            const mobileBanners = normalizeRows(mobileRows);
            formData.append('desktopBanners', JSON.stringify(desktopBanners));
            formData.append('mobileBanners', JSON.stringify(mobileBanners));
            desktopFiles.forEach((file) => formData.append('desktopImages', file));
            mobileFiles.forEach((file) => formData.append('mobileImages', file));

            const res = await fetch(`${API_BASE_URL}/banner-settings/admin`, {
                method: 'PATCH',
                headers: {
                    ...getAuthHeader(),
                },
                body: formData,
            });

            if (res.status === 401) {
                handleUnauthorized();
                return;
            }
            if (!res.ok) {
                setStatusMsg(`Failed to update banner settings (${res.status})`);
                return;
            }

            const json = await res.json();
            if (json.success) {
                const nextDesktop = normalizeRows(json.data?.desktopBanners || []);
                const nextMobile = normalizeRows(json.data?.mobileBanners || []);
                setDesktopRows(nextDesktop.length ? nextDesktop : ['']);
                setMobileRows(nextMobile.length ? nextMobile : ['']);
                setDesktopFiles([]);
                setMobileFiles([]);
                setStatusMsg('Banner updated successfully');
            } else {
                setStatusMsg(json.message || 'Failed to update banner');
            }
        } catch (error) {
            setStatusMsg(error?.message ? `Network error: ${error.message}` : 'Network error while saving banner settings');
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = () => {
        clearAdminSession();
        navigate('/');
    };
    const addRow = (setter) => setter((prev) => [...prev, '']);
    const removeRow = (setter, rows, idx) => {
        const next = rows.filter((_, i) => i !== idx);
        setter(next.length ? next : ['']);
    };

    return (
        <AdminLayout onLogout={handleLogout} title="Banner Settings">
            <div className="w-full min-w-0 px-3 sm:px-4 md:px-6 pb-6 sm:pb-8">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6">Banner</h1>

                <div className="rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden max-w-3xl">
                    <h2 className="text-lg font-bold text-orange-500 bg-white px-4 py-3 border-b border-gray-200">
                        Home Banner Images
                    </h2>

                    <form className="p-4 space-y-5" onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="block text-sm font-medium text-gray-600">Desktop banners</label>
                                    <button type="button" onClick={() => addRow(setDesktopRows)} className="text-xs text-orange-600 font-semibold">+ Add URL</button>
                                </div>
                                {desktopRows.map((row, idx) => (
                                    <div key={`desktop-${idx}`} className="flex items-center gap-2">
                                        <input
                                            type="url"
                                            value={row}
                                            onChange={(e) => setDesktopRows((prev) => prev.map((item, i) => (i === idx ? e.target.value : item)))}
                                            className="w-full px-4 py-2.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-800 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                            placeholder="https://..."
                                        />
                                        <button type="button" onClick={() => removeRow(setDesktopRows, desktopRows, idx)} className="px-2 py-2 rounded-lg bg-red-50 text-red-600 text-xs">Remove</button>
                                    </div>
                                ))}
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    onChange={(e) => setDesktopFiles(Array.from(e.target.files || []))}
                                    className="w-full text-sm text-gray-600"
                                />
                                {!!desktopFiles.length && <p className="text-xs text-gray-500">{desktopFiles.length} desktop images selected</p>}
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="block text-sm font-medium text-gray-600">Mobile banners</label>
                                    <button type="button" onClick={() => addRow(setMobileRows)} className="text-xs text-orange-600 font-semibold">+ Add URL</button>
                                </div>
                                {mobileRows.map((row, idx) => (
                                    <div key={`mobile-${idx}`} className="flex items-center gap-2">
                                        <input
                                            type="url"
                                            value={row}
                                            onChange={(e) => setMobileRows((prev) => prev.map((item, i) => (i === idx ? e.target.value : item)))}
                                            className="w-full px-4 py-2.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-800 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                            placeholder="https://..."
                                        />
                                        <button type="button" onClick={() => removeRow(setMobileRows, mobileRows, idx)} className="px-2 py-2 rounded-lg bg-red-50 text-red-600 text-xs">Remove</button>
                                    </div>
                                ))}
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    onChange={(e) => setMobileFiles(Array.from(e.target.files || []))}
                                    className="w-full text-sm text-gray-600"
                                />
                                {!!mobileFiles.length && <p className="text-xs text-gray-500">{mobileFiles.length} mobile images selected</p>}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <p className="text-sm font-semibold text-gray-600 mb-2">Existing desktop banners</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {normalizeRows(desktopRows).map((url) => (
                                        <img key={`desktop-preview-${url}`} src={url} alt="Desktop banner" className="w-full h-20 object-cover rounded-lg border border-gray-200" />
                                    ))}
                                    {!normalizeRows(desktopRows).length ? (
                                        <div className="col-span-2 h-20 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400">
                                            No desktop banners
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-600 mb-2">Existing mobile banners</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {normalizeRows(mobileRows).map((url) => (
                                        <img key={`mobile-preview-${url}`} src={url} alt="Mobile banner" className="w-full h-20 object-cover rounded-lg border border-gray-200" />
                                    ))}
                                    {!normalizeRows(mobileRows).length ? (
                                        <div className="col-span-2 h-20 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400">
                                            No mobile banners
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        {statusMsg ? (
                            <p className={`text-sm ${statusMsg.includes('success') ? 'text-green-600' : 'text-red-500'}`}>
                                {statusMsg}
                            </p>
                        ) : null}

                        <button
                            type="submit"
                            disabled={saving || loading}
                            className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-gray-800 font-semibold rounded-lg disabled:opacity-50 transition-colors"
                        >
                            {saving ? 'Saving...' : (loading ? 'Loading...' : 'Save Banner')}
                        </button>
                    </form>
                </div>
            </div>
        </AdminLayout>
    );
};

export default BannerSettings;
