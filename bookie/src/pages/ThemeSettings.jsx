import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { API_BASE_URL, getBookieAuthHeaders } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const THEMES = [
    { id: 'default', label: 'Default (Gold)', primary: '#f3b61b', accent: '#e5a914' },
    { id: 'gold', label: 'Gold', primary: '#d4af37', accent: '#b8960c' },
    { id: 'blue', label: 'Blue', primary: '#3b82f6', accent: '#2563eb' },
    { id: 'green', label: 'Green', primary: '#22c55e', accent: '#16a34a' },
    { id: 'red', label: 'Red', primary: '#ef4444', accent: '#dc2626' },
    { id: 'purple', label: 'Purple', primary: '#a855f7', accent: '#9333ea' },
];

const ThemeSettings = () => {
    const { bookie } = useAuth();
    const [uiTheme, setUiTheme] = useState(bookie?.uiTheme || { themeId: 'default' });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/bookie/profile`, { headers: getBookieAuthHeaders() });
            const data = await res.json();
            if (data.success && data.data?.uiTheme) {
                setUiTheme(data.data.uiTheme);
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to load theme' });
        } finally {
            setLoading(false);
        }
    };

    const handleThemeSelect = (themeId) => {
        setUiTheme((prev) => ({ ...prev, themeId, primaryColor: undefined, accentColor: undefined }));
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage({ type: '', text: '' });
        try {
            const res = await fetch(`${API_BASE_URL}/bookie/theme`, {
                method: 'PATCH',
                headers: getBookieAuthHeaders(),
                body: JSON.stringify({
                    themeId: uiTheme.themeId,
                    primaryColor: uiTheme.primaryColor || undefined,
                    accentColor: uiTheme.accentColor || undefined,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setMessage({ type: 'success', text: 'Theme saved. Your players will see this theme when they use the app.' });
                if (bookie) {
                    const updated = { ...bookie, uiTheme: data.data?.uiTheme || uiTheme };
                    localStorage.setItem('bookie', JSON.stringify(updated));
                }
            } else {
                setMessage({ type: 'error', text: data.message || 'Failed to save theme' });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Network error' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Layout title="User Panel Theme">
                <p className="text-gray-400">Loading...</p>
            </Layout>
        );
    }

    return (
        <Layout title="User Panel Theme">
            <div className="space-y-6">
                <p className="text-gray-400">
                    Choose the color theme for <strong className="text-white">your players</strong> when they use the user app. Only players linked to you will see this theme; other bookies' players see their own bookie's theme.
                </p>

                <div>
                    <h3 className="text-lg font-semibold text-white mb-3">Preset themes</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {THEMES.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => handleThemeSelect(t.id)}
                                className={`p-4 rounded-xl border-2 text-left transition-colors ${
                                    uiTheme.themeId === t.id
                                        ? 'border-emerald-500 bg-emerald-500/10'
                                        : 'border-gray-600 bg-gray-800 hover:border-gray-500'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-10 h-10 rounded-lg shrink-0"
                                        style={{ backgroundColor: t.primary }}
                                    />
                                    <span className="text-white font-medium">{t.label}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {message.text && (
                    <div
                        className={`p-4 rounded-lg ${
                            message.type === 'success' ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'
                        }`}
                    >
                        {message.text}
                    </div>
                )}

                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
                >
                    {saving ? 'Saving...' : 'Save theme for my players'}
                </button>
            </div>
        </Layout>
    );
};

export default ThemeSettings;
