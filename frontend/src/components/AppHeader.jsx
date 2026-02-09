import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getBalance, updateUserBalance } from '../api/bets';

const AppHeader = () => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(null);

  const menuItems = [
    { label: 'My Bets', path: '/bids' },
    { label: 'Bank', path: '/funds?tab=bank-detail' },
    { label: 'Funds', path: '/funds' },
    { label: 'Home', path: '/' },
    { label: 'Profile', path: '/profile' },
    { label: 'Top Winners', path: '/top-winners' },
    { label: 'Starline Winners', path: '/support' },
    { label: 'Telegram Channel', path: '/support' },
    { label: 'Notification', path: '/support' },
    { label: 'Game Chart', path: '/support' },
    { label: 'Game Rate', path: '/support' },
    { label: 'Time Table', path: '/support' },
    { label: 'Notice board / Rules', path: '/support' },
    { label: 'Help Desk', path: '/support' },
    { label: 'Settings', path: '/profile' },
    { label: 'How to play', path: '/support' },
    { label: 'Share App', path: '/support' },
    { label: 'Logout', path: '/login' }
  ];

  const loadStoredBalance = () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const b = user?.balance ?? user?.walletBalance ?? user?.wallet ?? 0;
      setBalance(Number(b));
    } catch (_) {
      setBalance(0);
    }
  };

  useEffect(() => {
    // Check if user is logged in
    const checkUser = () => {
      const userData = localStorage.getItem('user');
      if (userData) {
        try {
          setUser(JSON.parse(userData));
        } catch (e) {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      loadStoredBalance();
    };

    checkUser();

    // Fetch balance from server
    const fetchAndUpdateBalance = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        const userId = user?.id || user?._id;
        if (!userId) return;
        const res = await getBalance();
        if (res.success && res.data?.balance != null) {
          updateUserBalance(res.data.balance);
          setBalance(res.data.balance);
        }
      } catch (_) {}
    };

    fetchAndUpdateBalance();

    // Listen for storage changes (when user logs in/out in another tab)
    window.addEventListener('storage', checkUser);
    
    // Listen for custom login event
    window.addEventListener('userLogin', checkUser);
    window.addEventListener('userLogout', checkUser);

    return () => {
      window.removeEventListener('storage', checkUser);
      window.removeEventListener('userLogin', checkUser);
      window.removeEventListener('userLogout', checkUser);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    window.dispatchEvent(new Event('userLogout'));
    navigate('/login');
  };

  const displayName = user?.username || 'Sign In';
  const displayPhone =
    user?.phone ||
    user?.mobile ||
    user?.mobileNumber ||
    user?.phoneNumber ||
    user?.phone_number ||
    user?.mobilenumber ||
    user?.email ||
    '-';
  const sinceDateRaw = user?.createdAt || user?.created_at || user?.createdOn;
  const sinceDate = sinceDateRaw ? new Date(sinceDateRaw) : null;
  const sinceText = sinceDate && !Number.isNaN(sinceDate.getTime())
    ? `Since ${sinceDate.toLocaleDateString('en-GB')}`
    : 'Since -';
  const avatarInitial = displayName ? displayName.charAt(0).toUpperCase() : 'U';

  const handleProfileClick = () => {
    navigate(user ? '/profile' : '/login');
  };

  const displayBalance = balance != null ? Number(balance) : 0;
  const formattedBalance = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(displayBalance);

  return (
    <>
      <div
        className="fixed top-0 left-0 right-0 z-50 w-full bg-gradient-to-b from-black to-[#0a0a0a] border-b border-white/5 shadow-lg pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:pl-[max(1.25rem,env(safe-area-inset-left))] sm:pr-[max(1.25rem,env(safe-area-inset-right))] md:pl-[max(1.5rem,env(safe-area-inset-left))] md:pr-[max(1.5rem,env(safe-area-inset-right))] py-2.5 sm:py-2 md:py-2.5 pt-[calc(0.625rem+env(safe-area-inset-top,0px))] sm:pt-[calc(0.5rem+env(safe-area-inset-top,0px))] md:pt-[calc(0.625rem+env(safe-area-inset-top,0px))]"
      >
        <div className="flex items-center justify-between gap-2 sm:gap-2 md:gap-3">
          {/* Hamburger Menu and Logo together on the left */}
          <div className="flex items-center gap-2.5 sm:gap-3 md:gap-4">
            <button
              type="button"
              onClick={() => setIsMenuOpen(true)}
              className="w-10 h-10 sm:w-9 sm:h-9 md:w-10 md:h-10 shrink-0 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700/50 flex items-center justify-center cursor-pointer active:scale-95 hover:bg-gray-700/50 transition-all duration-200 shadow-md"
              aria-label="Open menu"
            >
            <div className="flex flex-col gap-1.5 sm:gap-1.5">
              <div className="w-5 sm:w-5 md:w-5 h-[2.5px] bg-white rounded-full"></div>
              <div className="w-4 sm:w-4 md:w-4 h-[2.5px] bg-white rounded-full"></div>
              <div className="w-3.5 sm:w-3 md:w-3 h-[2.5px] bg-white rounded-full"></div>
            </div>
            </button>

            {/* Logo - aligned next to hamburger */}
            <Link
              to="/"
              className="flex items-center cursor-pointer active:scale-95 transition-transform duration-200"
            >
              <img
                src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1770208855/copy_of_7db585f9-9318-4d5b-af85-3239bd0ae2be_1b90b5.png"
                alt="Logo"
                className="h-9 sm:h-9 md:h-10 lg:h-11 w-auto object-contain drop-shadow-md"
              />
            </Link>
          </div>

        {/* Right side buttons - Download App, Wallet, Profile */}
        <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3">
          {/* Download App - icon only on mobile, text on larger screens */}
          <button
            onClick={() => navigate('/download')}
            className="shrink-0 rounded-xl md:rounded-xl bg-gradient-to-r from-[#f3b61b] to-[#e5a914] px-3 sm:px-3 md:px-4 lg:px-5 py-2 sm:py-2 md:py-2.5 text-xs sm:text-sm md:text-base font-bold text-black shadow-[0_4px_12px_rgba(243,182,27,0.4)] active:scale-95 hover:from-[#e5a914] hover:to-[#d49a13] transition-all duration-200 flex items-center gap-1.5 sm:gap-1.5 md:gap-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 justify-center"
          >
            <svg className="w-5 h-5 sm:w-4 sm:h-4 md:w-5 md:h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="hidden sm:inline">Download</span>
            <span className="hidden md:inline"> App</span>
          </button>

          {/* Wallet - desktop only, responsive size */}
          <button
            onClick={() => navigate('/funds?tab=add-fund')}
            className="hidden md:flex shrink-0 items-center gap-1.5 md:gap-2 lg:gap-2.5 rounded-lg bg-[#202124] border border-white/5 px-2.5 md:px-3 lg:px-4 py-1.5 md:py-2 hover:bg-[#2a2b2e] transition-colors"
          >
            <img
              src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769780438/Untitled_90_x_160_px_1080_x_1080_px_ychsx6.png"
              alt="Wallet"
              className="w-7 h-7 md:w-8 md:h-8 lg:w-9 lg:h-9 object-contain"
            />
            <span className="text-sm md:text-base lg:text-lg font-bold text-white">{formattedBalance}</span>
          </button>

          {/* Profile Icon - improved mobile touch target */}
          <button
            type="button"
            onClick={handleProfileClick}
            className={`w-10 h-10 sm:w-9 sm:h-9 md:w-10 md:h-10 shrink-0 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border flex items-center justify-center cursor-pointer active:scale-95 transition-all duration-200 shadow-md ${
              user ? 'border-yellow-500/60 hover:bg-yellow-500/20 hover:border-yellow-500/80' : 'border-gray-700/50 hover:bg-gray-700/50'
            }`}
            title={user ? `${user.username} - View Profile` : 'Sign In / Sign Up'}
            aria-label="Profile"
          >
            <svg
              className={`w-5 h-5 sm:w-5 sm:h-5 md:w-5 md:h-5 ${user ? 'text-yellow-400' : 'text-white'}`}
              fill={user ? 'currentColor' : 'none'}
              stroke={user ? 'none' : 'currentColor'}
              strokeWidth={user ? 0 : 1.5}
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
        </div>
      </div>
      {isMenuOpen && (
        <div className="fixed inset-0 z-[60]">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMenuOpen(false)}
            aria-label="Close menu overlay"
          />
          <aside className="relative h-full w-[86%] max-w-[360px] sm:w-[70%] sm:max-w-[380px] md:w-[420px] md:max-w-none bg-gradient-to-b from-[#0a0a0a] via-black to-[#0a0a0a] shadow-[6px_0_24px_rgba(0,0,0,0.8)] border-r border-white/5">
            {/* User Profile Section */}
            <div className="px-5 sm:px-6 pt-6 pb-5 border-b border-white/10 bg-gradient-to-b from-[#1a1a1a]/50 to-transparent">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-[#1e1e1e] to-[#2a2a2a] border-2 border-yellow-500/30 flex items-center justify-center text-white text-xl sm:text-2xl font-bold shadow-[0_4px_12px_rgba(212,175,55,0.3)]">
                      {avatarInitial}
                    </div>
                    {user && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-black"></div>
                    )}
                  </div>
                  
                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-base sm:text-lg font-bold text-white truncate">{displayName}</div>
                    <div className="text-xs sm:text-sm text-gray-400 mt-0.5 truncate">{displayPhone}</div>
                    <div className="text-xs sm:text-sm text-gray-500 mt-0.5">{sinceText}</div>
                  </div>
                </div>
                
                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(false)}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#1a1a1a] border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#222] hover:border-white/20 active:scale-95 transition-all duration-200 shrink-0"
                  aria-label="Close menu"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Menu Items */}
            <div className="px-4 sm:px-5 py-4 space-y-2.5 overflow-y-auto h-[calc(100%-140px)] scrollbar-hidden">
              {menuItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    if (item.label === 'Logout') {
                      handleLogout();
                    } else {
                      navigate(item.path);
                    }
                  }}
                  className="group w-full bg-gradient-to-r from-[#1a1a1a] to-[#1e1e1e] rounded-xl sm:rounded-2xl px-4 py-3.5 sm:py-4 flex items-center gap-4 border border-white/5 hover:border-yellow-500/30 hover:from-[#222] hover:to-[#252525] hover:shadow-[0_4px_16px_rgba(212,175,55,0.15)] active:scale-[0.98] transition-all duration-200"
                >
                  {/* Icon Container */}
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-[#2a2a2a] to-[#1e1e1e] border border-white/10 flex items-center justify-center shrink-0 group-hover:border-yellow-500/30 group-hover:shadow-[0_4px_12px_rgba(212,175,55,0.2)] transition-all duration-200">
                    {item.label === 'Home' ? (
                      <img
                        src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769797366/home_m76m2c.png"
                        alt="Home"
                        className="w-6 h-6 sm:w-7 sm:h-7 object-contain"
                      />
                    ) : item.label === 'Top Winners' || item.label === 'Starline Winners' ? (
                      <img
                        src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769797561/podium_swqjij.png"
                        alt={item.label}
                        className="w-6 h-6 sm:w-7 sm:h-7 object-contain"
                      />
                    ) : item.label === 'Telegram Channel' ? (
                      <img
                        src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769797952/telegram_yw9hf1.png"
                        alt="Telegram"
                        className="w-6 h-6 sm:w-7 sm:h-7 object-contain"
                      />
                    ) : item.label === 'My Bets' ? (
                      <img
                        src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769777192/auction_ofhpps.png"
                        alt="My Bets"
                        className="w-6 h-6 sm:w-7 sm:h-7 object-contain"
                      />
                    ) : item.label === 'Bank' ? (
                      <img
                        src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769777283/bank_il6uwi.png"
                        alt="Bank"
                        className="w-6 h-6 sm:w-7 sm:h-7 object-contain"
                      />
                    ) : item.label === 'Funds' ? (
                      <img
                        src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769777500/funding_zjmbzp.png"
                        alt="Funds"
                        className="w-6 h-6 sm:w-7 sm:h-7 object-contain"
                      />
                    ) : item.label === 'Notification' ? (
                      <img
                        src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769798359/notification_1_pflwit.png"
                        alt="Notification"
                        className="w-6 h-6 sm:w-7 sm:h-7 object-contain"
                      />
                    ) : item.label === 'Game Chart' ? (
                      <img
                        src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769798462/start_eotpxc.png"
                        alt="Game Chart"
                        className="w-6 h-6 sm:w-7 sm:h-7 object-contain"
                      />
                    ) : item.label === 'Game Rate' ? (
                      <img
                        src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769798548/stars_v1jfzk.png"
                        alt="Game Rate"
                        className="w-6 h-6 sm:w-7 sm:h-7 object-contain"
                      />
                    ) : item.label === 'Time Table' ? (
                      <img
                        src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769798627/schedule_frf8zc.png"
                        alt="Time Table"
                        className="w-6 h-6 sm:w-7 sm:h-7 object-contain"
                      />
                    ) : item.label === 'Notice board / Rules' ? (
                      <img
                        src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769798736/checklist_xnr6yh.png"
                        alt="Notice board / Rules"
                        className="w-6 h-6 sm:w-7 sm:h-7 object-contain"
                      />
                    ) : item.label === 'Help Desk' ? (
                      <img
                        src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769777618/customer-support_du0zcj.png"
                        alt="Help Desk"
                        className="w-6 h-6 sm:w-7 sm:h-7 object-contain"
                      />
                    ) : item.label === 'Settings' ? (
                      <img
                        src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769799001/settings_kszedz.png"
                        alt="Settings"
                        className="w-6 h-6 sm:w-7 sm:h-7 object-contain"
                      />
                    ) : item.label === 'Share App' ? (
                      <img
                        src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769798998/share_a6shgt.png"
                        alt="Share App"
                        className="w-6 h-6 sm:w-7 sm:h-7 object-contain"
                      />
                    ) : item.label === 'How to play' ? (
                      <img
                        src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769798998/play-button-arrowhead_uxpf7o.png"
                        alt="How to play"
                        className="w-6 h-6 sm:w-7 sm:h-7 object-contain"
                      />
                    ) : item.label === 'Logout' ? (
                      <img
                        src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769798997/logout_mttqvy.png"
                        alt="Logout"
                        className="w-6 h-6 sm:w-7 sm:h-7 object-contain"
                      />
                    ) : (
                      <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-white/40"></div>
                    )}
                  </div>
                  
                  {/* Menu Text */}
                  <span className="text-sm sm:text-base font-semibold text-white group-hover:text-yellow-400 transition-colors duration-200 flex-1 text-left">
                    {item.label}
                  </span>
                  
                  {/* Arrow Indicator */}
                  <svg className="w-5 h-5 text-white/20 group-hover:text-yellow-500/60 group-hover:translate-x-1 transition-all duration-200 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
              
              {/* Version Footer */}
              <div className="text-center text-xs text-gray-600 pt-4 pb-2">Version: 1.0.0</div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};

export default AppHeader;
