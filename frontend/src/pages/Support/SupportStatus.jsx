import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config/api';

const statusLabel = (status) => {
  const map = { open: 'Open', 'in-progress': 'In Progress', resolved: 'Resolved', closed: 'Closed' };
  return map[status] || status;
};

const statusClass = (status) => {
  const map = {
    open: 'bg-[#1B3150]/10 text-[#1B3150] border-2 border-[#1B3150]/30',
    'in-progress': 'bg-amber-50 text-amber-700 border-2 border-amber-200',
    resolved: 'bg-green-100 text-green-700 border-2 border-green-300',
    closed: 'bg-gray-100 text-gray-600 border-2 border-gray-300',
  };
  return map[status] || 'bg-gray-100 text-gray-600 border-2 border-gray-300';
};

const SupportStatus = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [myTickets, setMyTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

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

  const userId = user?._id || user?.id;

  const fetchMyTickets = async () => {
    if (!userId) return;
    setTicketsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/help-desk/my-tickets?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (data.success) setMyTickets(data.data || []);
    } catch (_) {
      setMyTickets([]);
    } finally {
      setTicketsLoading(false);
    }
  };

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

  useEffect(() => {
    if (userId) fetchMyTickets();
    else setMyTickets([]);
  }, [userId]);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 px-3 sm:px-6 md:px-8 pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
      <div className="w-full max-w-xl mx-auto">
        <div className="flex items-center gap-3 pt-4 pb-3">
          <button
            type="button"
            onClick={() => navigate('/support')}
            className="p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center text-gray-800 hover:opacity-80 active:scale-95 transition touch-manipulation"
            aria-label="Back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-xl sm:text-2xl font-semibold text-[#1B3150]">Check problem status</h1>
        </div>
        <p className="text-gray-600 text-sm sm:text-base mb-6">See status and reply for your submitted tickets.</p>

        {!userId ? (
          <div className="p-4 bg-white border-2 border-gray-200 rounded-2xl text-gray-600 text-center shadow-sm">
            Please login to see your ticket status.
          </div>
        ) : ticketsLoading ? (
          <p className="text-gray-600 text-sm">Loading...</p>
        ) : myTickets.length === 0 ? (
          <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 text-center text-gray-600 text-sm shadow-sm">
            No tickets yet. Raise a help ticket from Help Desk.
          </div>
        ) : (
          <div className="space-y-3">
            {myTickets.map((t) => (
              <div
                key={t._id}
                className="bg-white rounded-2xl border-2 border-gray-200 p-4 shadow-sm hover:border-[#1B3150] hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-800 truncate">{t.subject}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {t.createdAt ? new Date(t.createdAt).toLocaleString() : ''}
                    </p>
                  </div>
                  <span className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium ${statusClass(t.status)}`}>
                    {statusLabel(t.status)}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-2 line-clamp-3">{t.description}</p>
                {t.adminResponse && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">Response from support</p>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{t.adminResponse}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportStatus;
