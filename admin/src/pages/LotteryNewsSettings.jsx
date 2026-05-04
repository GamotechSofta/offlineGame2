import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { clearAdminSession, fetchWithAuth } from '../lib/auth';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:3010/api/v1' : 'https://api.singlepana.in/api/v1');

const LotteryNewsSettings = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  const handleLogout = useCallback(() => {
    clearAdminSession();
    navigate('/');
  }, [navigate]);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setStatus('');
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/banner-settings/admin/lottery-news`);
      if (res.status === 401) return;
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || `Failed to load (${res.status})`);
      }
      setMessage(String(json?.data?.message || '').trim());
    } catch (err) {
      setStatus(err?.message || 'Failed to load lottery news');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const handleSave = async (e) => {
    e.preventDefault();
    const next = String(message || '').trim();
    if (!next) {
      setStatus('Message is required.');
      return;
    }
    setSaving(true);
    setStatus('');
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/banner-settings/admin/lottery-news`, {
        method: 'PATCH',
        body: JSON.stringify({ message: next }),
      });
      if (res.status === 401) return;
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || `Failed to update (${res.status})`);
      }
      setMessage(String(json?.data?.message || next));
      setStatus('Lottery news updated successfully.');
    } catch (err) {
      setStatus(err?.message || 'Failed to update lottery news');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout onLogout={handleLogout} title="Lottery News">
      <div className="w-full min-w-0 px-3 sm:px-4 md:px-6 pb-6 sm:pb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6">Lottery News</h1>

        <div className="max-w-3xl rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-800">2D Frontend Scrolling Message</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              This message is shown on the green running strip in 2D Lottery.
            </p>
          </div>

          <form onSubmit={handleSave} className="p-4 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Message</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={500}
                placeholder="Enter lottery news message"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
              />
              <span className="mt-1 block text-xs text-gray-500">{String(message || '').length}/500</span>
            </label>

            <div className="rounded-md border border-gray-200 bg-[#2eb34f] px-3 py-2 text-sm font-semibold text-black">
              Preview: {String(message || '').trim() || 'Welcome Diamond'}
            </div>

            {status ? (
              <p className={`text-sm ${status.toLowerCase().includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                {status}
              </p>
            ) : null}

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={saving || loading}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Lottery News'}
              </button>
              <button
                type="button"
                onClick={fetchNews}
                disabled={saving || loading}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                {loading ? 'Loading...' : 'Reload'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AdminLayout>
  );
};

export default LotteryNewsSettings;
