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

/* ───────── tiny icon components ───────── */
const IconUser = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
);
const IconMail = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
  </svg>
);
const IconPhone = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
  </svg>
);
const IconShield = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);
const IconWallet = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 110 6h3.75A2.25 2.25 0 0021 13.5V12zm0 0V9.75a2.25 2.25 0 00-2.25-2.25h-13.5A2.25 2.25 0 003 9.75v7.5A2.25 2.25 0 005.25 19.5h13.5A2.25 2.25 0 0021 17.25V12z" />
  </svg>
);
const IconCalendar = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
  </svg>
);
const IconBank = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
  </svg>
);
const IconId = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
  </svg>
);
const IconSupport = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
  </svg>
);
const IconLogout = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
  </svg>
);
const IconAddFund = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);
const IconWithdraw = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
);
const IconHistory = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const IconPassbook = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
  </svg>
);
const IconChevron = () => (
  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);
const IconBack = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);
const IconCopy = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
  </svg>
);

const Profile = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => readUserFromStorage());
  const [toast, setToast] = useState('');
  const [copiedField, setCopiedField] = useState('');

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

  const handleCopy = (text, label) => {
    if (!text || text === 'Not set' || text === 'N/A') return;
    navigator.clipboard?.writeText(String(text)).then(() => {
      setCopiedField(label);
      setTimeout(() => setCopiedField(''), 1500);
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('userLogout'));
    navigate('/login');
  };

  if (!user) return null;

  const userId = user?.id || user?._id || 'N/A';
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  /* ───────── Quick action buttons ───────── */
  const quickActions = [
    { icon: <IconAddFund />, label: 'Add Fund', path: '/funds?tab=add-fund', color: 'from-emerald-500 to-emerald-600' },
    { icon: <IconWithdraw />, label: 'Withdraw', path: '/funds?tab=withdraw-fund', color: 'from-blue-500 to-blue-600' },
    { icon: <IconPassbook />, label: 'Passbook', path: '/passbook', color: 'from-purple-500 to-purple-600' },
    { icon: <IconHistory />, label: 'History', path: '/bet-history', color: 'from-orange-500 to-orange-600' },
  ];

  /* ───────── Menu items ───────── */
  const menuItems = [
    { icon: <IconBank />, label: 'Bank Details', desc: 'Manage payment methods', path: '/bank', color: 'text-blue-400' },
    { icon: <IconId />, label: 'KYC Verification', desc: 'Verify your identity', action: () => showToast('KYC coming soon'), color: 'text-emerald-400' },
    { icon: <IconShield />, label: 'Security', desc: 'Password & security settings', action: () => showToast('Security settings coming soon'), color: 'text-purple-400' },
    { icon: <IconSupport />, label: 'Help & Support', desc: 'Get help with your account', path: '/support', color: 'text-amber-400' },
  ];

  /* ───────── Info field data ───────── */
  const infoFields = [
    { icon: <IconUser />, label: 'Username', value: form.username || 'Not set', color: 'text-blue-400', copyable: true },
    { icon: <IconMail />, label: 'Email', value: form.email || 'Not set', color: 'text-purple-400', copyable: true },
    { icon: <IconPhone />, label: 'Phone', value: form.phone || 'Not set', color: 'text-emerald-400', copyable: true },
    { icon: <IconShield />, label: 'Role', value: form.role || 'User', color: 'text-amber-400', capitalize: true },
  ];

  /* ── Reusable blocks (rendered in both mobile & desktop layouts) ── */

  const heroCard = (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] border border-white/10 shadow-2xl">
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-yellow-500/5 blur-2xl" />
      <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-blue-500/5 blur-2xl" />
      <div className="relative p-5 md:p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="relative">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-[#f2c14e] to-[#f5a623] flex items-center justify-center text-black text-2xl md:text-3xl font-bold shadow-lg shadow-yellow-500/20">
              {avatarInitial}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 md:w-5 md:h-5 rounded-full bg-emerald-500 border-2 border-[#16213e]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-lg md:text-xl truncate leading-tight">
              {form.username || 'User'}
            </h3>
            <p className="text-gray-400 text-sm truncate mt-0.5">
              {form.email || form.phone || 'No contact info'}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <div className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                <span className="text-emerald-400 text-[10px] font-semibold uppercase tracking-wider">Active</span>
              </div>
              {form.role && (
                <div className="px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30">
                  <span className="text-blue-400 text-[10px] font-semibold uppercase tracking-wider capitalize">{form.role}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-black/30 backdrop-blur border border-white/10 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Wallet Balance</p>
              <p className="text-[#f2c14e] text-2xl md:text-3xl font-extrabold tracking-tight">
                ₹{walletValue !== null ? walletValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#f2c14e]/10 border border-[#f2c14e]/20 flex items-center justify-center text-[#f2c14e]">
              <IconWallet />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const quickActionsBlock = (cols = 'grid-cols-4') => (
    <div className={`grid ${cols} gap-2.5`}>
      {quickActions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={() => navigate(action.path)}
          className="flex flex-col items-center gap-2 py-3 px-1 rounded-2xl bg-[#141416] border border-white/5 hover:border-white/15 active:scale-95 transition-all md:py-4 md:hover:bg-white/[0.03]"
        >
          <div className={`w-10 h-10 md:w-11 md:h-11 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center text-white shadow-lg`}>
            {action.icon}
          </div>
          <span className="text-gray-300 text-[11px] md:text-xs font-medium leading-tight text-center">{action.label}</span>
        </button>
      ))}
    </div>
  );

  const renderCopyBtn = (label) => (
    <button
      type="button"
      onClick={() => handleCopy(
        label === 'User ID' ? userId : infoFields.find(f => f.label === label)?.value,
        label
      )}
      className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-gray-300 transition-colors"
      title={`Copy ${label}`}
    >
      {copiedField === label ? (
        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : (
        <IconCopy />
      )}
    </button>
  );

  const accountInfoBlock = (
    <div className="rounded-3xl bg-[#141416] border border-white/5 overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Account Information</h3>
      </div>
      <div className="px-4 pb-2">
        {/* User ID */}
        <div className="group flex items-center gap-3.5 px-3 py-3.5 rounded-2xl hover:bg-white/[0.03] transition-colors">
          <div className="w-10 h-10 rounded-xl bg-gray-500/10 flex items-center justify-center text-gray-400 shrink-0">
            <IconId />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-gray-500 text-[10px] font-medium uppercase tracking-wider">User ID</p>
            <p className="text-gray-300 text-sm font-mono truncate mt-0.5">{userId}</p>
          </div>
          {renderCopyBtn('User ID')}
        </div>

        {/* Info fields */}
        {infoFields.map((field) => (
          <div key={field.label} className="group flex items-center gap-3.5 px-3 py-3.5 rounded-2xl hover:bg-white/[0.03] transition-colors">
            <div className={`w-10 h-10 rounded-xl bg-current/10 flex items-center justify-center shrink-0 ${field.color}`} style={{ backgroundColor: 'color-mix(in srgb, currentColor 10%, transparent)' }}>
              {field.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-500 text-[10px] font-medium uppercase tracking-wider">{field.label}</p>
              <p className={`text-white text-sm font-medium truncate mt-0.5 ${field.capitalize ? 'capitalize' : ''}`}>
                {field.value}
              </p>
            </div>
            {field.copyable && field.value !== 'Not set' && renderCopyBtn(field.label)}
          </div>
        ))}

        {/* Member Since */}
        {memberSince && (
          <div className="flex items-center gap-3.5 px-3 py-3.5 rounded-2xl">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-400 shrink-0">
              <IconCalendar />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-500 text-[10px] font-medium uppercase tracking-wider">Member Since</p>
              <p className="text-white text-sm font-medium mt-0.5">{memberSince}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const settingsBlock = (
    <div className="rounded-3xl bg-[#141416] border border-white/5 overflow-hidden">
      <div className="px-5 pt-5 pb-2">
        <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Settings</h3>
      </div>
      <div className="px-3 pb-3">
        {menuItems.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => item.path ? navigate(item.path) : item.action?.()}
            className="w-full flex items-center gap-3.5 px-3 py-3.5 rounded-2xl hover:bg-white/[0.03] active:bg-white/[0.06] active:scale-[0.98] transition-all"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.color}`} style={{ backgroundColor: 'color-mix(in srgb, currentColor 10%, transparent)' }}>
              {item.icon}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-white text-sm font-semibold">{item.label}</p>
              <p className="text-gray-500 text-xs mt-0.5">{item.desc}</p>
            </div>
            <IconChevron />
          </button>
        ))}
      </div>
    </div>
  );

  const logoutBtn = (
    <button
      type="button"
      onClick={handleLogout}
      className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-red-500/8 border border-red-500/15 text-red-400 font-semibold hover:bg-red-500/12 active:scale-[0.98] transition-all"
    >
      <IconLogout />
      <span>Sign Out</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white pb-[calc(6rem+env(safe-area-inset-bottom,0px))] md:pb-8">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-[fadeSlideDown_0.3s_ease] px-4 w-full max-w-sm">
          <div className="rounded-2xl border border-yellow-500/30 bg-black/90 backdrop-blur-xl px-4 py-3 text-sm text-yellow-200 text-center shadow-2xl">
            {toast}
          </div>
        </div>
      )}

      {/* ── Header Bar ── */}
      <div className="sticky top-0 z-40 bg-[#0a0a0b]/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3 px-4 py-3 max-w-lg md:max-w-6xl mx-auto">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all"
            aria-label="Back"
          >
            <IconBack />
          </button>
          <h2 className="text-base md:text-lg font-semibold tracking-wide flex-1">My Profile</h2>
        </div>
      </div>

      {/* ═══════════ MOBILE LAYOUT (unchanged) ═══════════ */}
      <div className="md:hidden max-w-lg mx-auto px-4 pt-4 space-y-4">
        {heroCard}
        {quickActionsBlock('grid-cols-4')}
        {accountInfoBlock}
        {settingsBlock}
        {logoutBtn}
        <div className="h-2" />
      </div>

      {/* ═══════════ DESKTOP LAYOUT ═══════════ */}
      <div className="hidden md:block max-w-6xl mx-auto px-6 lg:px-8 pt-6">
        <div className="grid grid-cols-[340px_1fr] lg:grid-cols-[380px_1fr] gap-6 items-start">

          {/* ── Left Sidebar ── */}
          <div className="sticky top-[72px] space-y-4">
            {heroCard}
            {quickActionsBlock('grid-cols-4')}
            {settingsBlock}
            {logoutBtn}
          </div>

          {/* ── Right Content ── */}
          <div className="space-y-5">
            {/* Account Info — expanded for desktop */}
            <div className="rounded-3xl bg-[#141416] border border-white/5 overflow-hidden">
              <div className="px-6 pt-6 pb-4 border-b border-white/5">
                <h3 className="text-white font-semibold text-base uppercase tracking-wider">Account Information</h3>
                <p className="text-gray-500 text-sm mt-1">Your personal details and account data</p>
              </div>

              {/* 2-col grid for info fields on desktop */}
              <div className="p-5 grid grid-cols-2 gap-4">
                {/* User ID - full width */}
                <div className="col-span-2 group flex items-center gap-4 px-4 py-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                  <div className="w-11 h-11 rounded-xl bg-gray-500/10 flex items-center justify-center text-gray-400 shrink-0">
                    <IconId />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-500 text-[10px] font-medium uppercase tracking-wider">User ID</p>
                    <p className="text-gray-300 text-sm font-mono truncate mt-0.5">{userId}</p>
                  </div>
                  {renderCopyBtn('User ID')}
                </div>

                {/* Info fields as cards */}
                {infoFields.map((field) => (
                  <div key={field.label} className="group flex items-center gap-4 px-4 py-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${field.color}`} style={{ backgroundColor: 'color-mix(in srgb, currentColor 10%, transparent)' }}>
                      {field.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-500 text-[10px] font-medium uppercase tracking-wider">{field.label}</p>
                      <p className={`text-white text-sm font-medium truncate mt-0.5 ${field.capitalize ? 'capitalize' : ''}`}>
                        {field.value}
                      </p>
                    </div>
                    {field.copyable && field.value !== 'Not set' && renderCopyBtn(field.label)}
                  </div>
                ))}

                {/* Wallet balance card */}
                <div className="group flex items-center gap-4 px-4 py-4 rounded-2xl bg-gradient-to-r from-yellow-500/5 to-yellow-600/5 border border-yellow-500/15 hover:border-yellow-500/25 transition-colors">
                  <div className="w-11 h-11 rounded-xl bg-[#f2c14e]/10 flex items-center justify-center text-[#f2c14e] shrink-0">
                    <IconWallet />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-500 text-[10px] font-medium uppercase tracking-wider">Account Balance</p>
                    <p className="text-[#f2c14e] text-base font-bold mt-0.5">
                      ₹{walletValue !== null ? walletValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                    </p>
                  </div>
                </div>

                {/* Member Since card */}
                {memberSince && (
                  <div className="group flex items-center gap-4 px-4 py-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                    <div className="w-11 h-11 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-400 shrink-0">
                      <IconCalendar />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-500 text-[10px] font-medium uppercase tracking-wider">Member Since</p>
                      <p className="text-white text-sm font-medium mt-0.5">{memberSince}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Stats Bar */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-2xl bg-[#141416] border border-white/5 p-5 text-center hover:border-white/10 transition-colors">
                <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-2">Account Status</p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-emerald-400 text-xs font-bold">Active</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/passbook')}
                className="rounded-2xl bg-[#141416] border border-white/5 p-5 text-center hover:border-white/10 transition-colors active:scale-[0.98]"
              >
                <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-2">Passbook</p>
                <p className="text-white text-sm font-bold">View Transactions</p>
              </button>
              <button
                type="button"
                onClick={() => navigate('/bet-history')}
                className="rounded-2xl bg-[#141416] border border-white/5 p-5 text-center hover:border-white/10 transition-colors active:scale-[0.98]"
              >
                <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-2">Bet History</p>
                <p className="text-white text-sm font-bold">View All Bets</p>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Animations CSS ── */}
      <style>{`
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translate(-50%, -12px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
};

export default Profile;
