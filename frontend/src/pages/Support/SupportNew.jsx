import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config/api';

const SupportNew = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [subject, setSubject] = useState('Support Request');
  const [description, setDescription] = useState('');
  const [screenshots, setScreenshots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const userId = user?._id || user?.id;

  // Mobile only: prevent page scrolling (as requested)
  useEffect(() => {
    let cleanup = () => {};
    try {
      const mql = window.matchMedia('(max-width: 767px)');
      const apply = () => {
        cleanup();
        if (!mql.matches) return;
        const prevBody = document.body.style.overflow;
        const prevHtml = document.documentElement.style.overflow;
        const prevOverscrollBody = document.body.style.overscrollBehavior;
        const prevOverscrollHtml = document.documentElement.style.overscrollBehavior;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overscrollBehavior = 'none';
        document.documentElement.style.overscrollBehavior = 'none';
        cleanup = () => {
          document.body.style.overflow = prevBody;
          document.documentElement.style.overflow = prevHtml;
          document.body.style.overscrollBehavior = prevOverscrollBody;
          document.documentElement.style.overscrollBehavior = prevOverscrollHtml;
        };
      };
      apply();
      mql.addEventListener?.('change', apply);
      return () => {
        mql.removeEventListener?.('change', apply);
        cleanup();
      };
    } catch (_) {
      return () => cleanup();
    }
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (raw) {
      try {
        setUser(JSON.parse(raw));
      } catch (_) {
        setUser(null);
      }
    } else {
      setUser(null);
    }
    const onUserChange = () => {
      const r = localStorage.getItem('user');
      setUser(r ? JSON.parse(r) : null);
    };
    window.addEventListener('userLogin', onUserChange);
    window.addEventListener('userLogout', onUserChange);
    return () => {
      window.removeEventListener('userLogin', onUserChange);
      window.removeEventListener('userLogout', onUserChange);
    };
  }, []);

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (list.length !== files.length) {
      setMessage({ type: 'error', text: 'Only image files (e.g. PNG, JPG) are allowed.' });
    }
    setScreenshots(list.length ? list : []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId) {
      setMessage({ type: 'error', text: 'Please login to submit a support request.' });
      return;
    }
    if (!description.trim()) {
      setMessage({ type: 'error', text: 'Please describe your problem.' });
      return;
    }
    setMessage({ type: '', text: '' });
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('userId', userId);
      formData.append('subject', subject.trim() || 'Support Request');
      formData.append('description', description.trim());
      screenshots.forEach((file) => formData.append('screenshots', file));

      const response = await fetch(`${API_BASE_URL}/help-desk/tickets`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Your request has been submitted. We will get back to you soon.' });
        setDescription('');
        setScreenshots([]);
        const input = document.getElementById('support-screenshots');
        if (input) input.value = '';
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to submit. Please try again.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-800 px-3 sm:px-6 md:px-8 pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
      <div className="w-full max-w-xl mx-auto">
        <div className="flex items-center gap-3 pt-4 pb-3">
          <button
            type="button"
            onClick={() => navigate('/support')}
            className="w-10 h-10 rounded-full bg-gray-50 border border-gray-300 flex items-center justify-center hover:bg-gray-100 transition-colors shrink-0 text-gray-800"
            aria-label="Back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Raise help ticket</h1>
        </div>
        <p className="text-gray-600 text-sm sm:text-base mb-6">Describe your problem and attach screenshots if needed.</p>

        {!userId && (
          <div className="mb-6 p-4 bg-gray-50 border border-gray-300 rounded-2xl text-[#1B3150] shadow-md text-center">
            Please login to submit a support request.
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-300 p-4 sm:p-6 shadow-md w-full">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="support-subject" className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input
                id="support-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Payment issue, Game error"
                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-gray-800 placeholder-gray-500 focus:ring-2 focus:ring-[#1B3150] focus:border-[#1B3150] transition"
                disabled={!userId}
              />
            </div>
            <div>
              <label htmlFor="support-description" className="block text-sm font-medium text-gray-700 mb-1">
                Describe your problem <span className="text-red-500">*</span>
              </label>
              <textarea
                id="support-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain your issue in detail..."
                rows={5}
                className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-gray-800 placeholder-gray-500 focus:ring-2 focus:ring-[#1B3150] focus:border-[#1B3150] resize-y transition"
                disabled={!userId}
              />
            </div>
            <div>
              <label htmlFor="support-screenshots" className="block text-sm font-medium text-gray-700 mb-1">
                Screenshots (optional, max 5 images)
              </label>
              <input
                id="support-screenshots"
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif"
                multiple
                onChange={handleFileChange}
                className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#1B3150] file:text-white file:font-semibold file:cursor-pointer hover:file:bg-[#1B3150]"
                disabled={!userId}
              />
              {screenshots.length > 0 && (
                <p className="mt-1 text-sm text-gray-600">{screenshots.length} file(s) selected</p>
              )}
            </div>
            {message.text && (
              <div
                className={`p-3 rounded-xl text-sm ${
                  message.type === 'success'
                    ? 'bg-green-50 border border-green-300 text-green-700'
                    : 'bg-red-50 border border-red-300 text-red-700'
                }`}
              >
                {message.text}
              </div>
            )}
            <button
              type="submit"
              disabled={!userId || loading}
              className="w-full px-6 py-2.5 bg-[#1B3150] hover:bg-[#1B3150] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition shadow-md hover:shadow-lg"
            >
              {loading ? 'Submitting...' : 'Submit'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SupportNew;
