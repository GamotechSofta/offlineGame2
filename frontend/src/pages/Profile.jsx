import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const readUserFromStorage = () => {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
};

const pick = (obj, keys) => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return '';
};

const Profile = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => readUserFromStorage());
  const [toast, setToast] = useState('');
  const [activeSection, setActiveSection] = useState('profile');

  const initialForm = useMemo(() => {
    const u = user || {};
    return {
      username: pick(u, ['username', 'name', 'fullName']),
      phone: pick(u, ['phone', 'mobile', 'mobileNumber', 'phoneNumber', 'phone_number', 'mobilenumber']),
      email: pick(u, ['email']),
      role: pick(u, ['role']),
    };
  }, [user]);

  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    setForm(initialForm);
  }, [initialForm]);

  useEffect(() => {
    // If user logs out in another tab, exit this page.
    const onLogout = () => {
      setUser(null);
      navigate('/login');
    };
    const onLogin = () => {
      const u = readUserFromStorage();
      if (u) setUser(u);
    };
    window.addEventListener('userLogout', onLogout);
    window.addEventListener('userLogin', onLogin);
    window.addEventListener('storage', () => {
      const u = readUserFromStorage();
      if (!u) onLogout();
      else setUser(u);
    });
    return () => {
      window.removeEventListener('userLogout', onLogout);
      window.removeEventListener('userLogin', onLogin);
    };
  }, [navigate]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  const avatarInitial = (form.username || 'U').charAt(0).toUpperCase();

  const walletValue = useMemo(() => {
    const v = pick(user, ['wallet', 'balance', 'points', 'walletAmount', 'wallet_amount', 'amount']);
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }, [user]);

  const showToast = (msg) => {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(''), 2000);
  };

  const updateForm = (key) => (e) => {
    setForm((p) => ({ ...p, [key]: e.target.value }));
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('userLogout'));
    navigate('/login');
  };

  if (!user) return null;

  const sidebarItems = [
    { id: 'profile', label: 'Profile' },
    { id: 'bank', label: 'Bank Details' },
    { id: 'kyc', label: 'KYC' },
    { id: 'security', label: 'Security' },
    { id: 'support', label: 'Support' },
  ];

  return (
    <div className="min-h-screen bg-black text-white px-3 sm:px-5 md:px-6 lg:px-8 pt-4 pb-24">
      <div className="w-full max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center hover:bg-gray-700 transition-colors"
            aria-label="Back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h2 className="text-lg sm:text-xl font-bold tracking-wide">PROFILE</h2>
        </div>

        {toast && (
          <div className="mb-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
            {toast}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 md:gap-6">
          {/* Sidebar */}
          <aside className="rounded-2xl bg-[#202124] border border-white/10 shadow-[0_14px_30px_rgba(0,0,0,0.45)] overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#0f2c5a] flex items-center justify-center text-white text-lg font-semibold">
                {avatarInitial}
              </div>
              <div className="min-w-0">
                <div className="text-white font-bold truncate">{form.username || 'User'}</div>
                <div className="text-gray-400 text-xs truncate">{form.email || form.phone || '-'}</div>
              </div>
            </div>

            <div className="p-3">
              <div className="text-[10px] text-gray-400 uppercase tracking-wider px-3 pb-2">Menu</div>
              <div className="space-y-1">
                {sidebarItems.map((item) => {
                  const active = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveSection(item.id)}
                      className={`w-full text-left px-3 py-3 rounded-xl border transition-colors ${
                        active
                          ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-200'
                          : 'bg-black/20 border-white/5 text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold">{item.label}</span>
                        <span className="text-white/40">›</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 px-3 py-3 rounded-xl border border-white/10 bg-black/25">
                <div className="text-[10px] text-gray-400 uppercase tracking-wider">Wallet</div>
                <div className="text-[#f2c14e] font-extrabold text-lg">
                  {walletValue === null ? '-' : walletValue.toFixed(1)}
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="mt-3 w-full rounded-xl font-bold py-3 bg-red-500/10 border border-red-500/30 text-red-200 hover:bg-red-500/15 transition-colors"
              >
                Logout
              </button>
            </div>
          </aside>

          {/* Content */}
          <main className="rounded-2xl bg-[#202124] border border-white/10 shadow-[0_14px_30px_rgba(0,0,0,0.45)] overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between gap-3">
              <div>
                <div className="text-white font-bold text-lg sm:text-xl">
                  {sidebarItems.find((s) => s.id === activeSection)?.label || 'Profile'}
                </div>
                <div className="text-gray-400 text-xs sm:text-sm">
                  {activeSection === 'profile'
                    ? 'Update your basic information.'
                    : 'Coming soon — we will add content here.'}
                </div>
              </div>
            </div>

            {activeSection === 'profile' ? (
              <div className="p-5 sm:p-6 space-y-4">
                {/* User Information Display */}
                <div className="grid gap-3 sm:gap-4">
                  <div className="mb-2">
                    <h3 className="text-yellow-400 font-semibold text-sm mb-4 uppercase tracking-wide">Account Information</h3>
                  </div>
                  
                  <div>
                    <label className="block text-gray-400 text-xs font-medium mb-1.5 uppercase tracking-wide">User ID</label>
                    <div className="w-full bg-[#111214] border border-white/10 rounded-xl px-4 py-3 text-gray-300">
                      {user?.id || user?._id || 'N/A'}
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-400 text-xs font-medium mb-1.5 uppercase tracking-wide">Username</label>
                    <div className="w-full bg-[#111214] border border-white/10 rounded-xl px-4 py-3 text-white">
                      {form.username || 'Not set'}
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-400 text-xs font-medium mb-1.5 uppercase tracking-wide">Email Address</label>
                    <div className="w-full bg-[#111214] border border-white/10 rounded-xl px-4 py-3 text-white">
                      {form.email || 'Not set'}
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-400 text-xs font-medium mb-1.5 uppercase tracking-wide">Phone Number</label>
                    <div className="w-full bg-[#111214] border border-white/10 rounded-xl px-4 py-3 text-white">
                      {form.phone || 'Not set'}
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-400 text-xs font-medium mb-1.5 uppercase tracking-wide">Role</label>
                    <div className="w-full bg-[#111214] border border-white/10 rounded-xl px-4 py-3 text-white capitalize">
                      {form.role || 'User'}
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-400 text-xs font-medium mb-1.5 uppercase tracking-wide">Account Balance</label>
                    <div className="w-full bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30 rounded-xl px-4 py-3 text-yellow-400 font-bold text-lg">
                      ₹{walletValue !== null ? walletValue.toFixed(2) : '0.00'}
                    </div>
                  </div>

                  {user?.createdAt && (
                    <div>
                      <label className="block text-gray-400 text-xs font-medium mb-1.5 uppercase tracking-wide">Member Since</label>
                      <div className="w-full bg-[#111214] border border-white/10 rounded-xl px-4 py-3 text-gray-300">
                        {new Date(user.createdAt).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 text-gray-300">
                Content will be added here for <span className="text-white font-semibold">
                  {sidebarItems.find((s) => s.id === activeSection)?.label}
                </span>.
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Profile;

