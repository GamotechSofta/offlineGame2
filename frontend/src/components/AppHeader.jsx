import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const AppHeader = () => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState(null);

  const menuItems = [
    { label: 'Home', path: '/' },
    { label: 'Profile', path: '/profile' },
    { label: 'Top Winners', path: '/support' },
    { label: 'Starline Winners', path: '/support' },
    { label: 'Telegram Channel', path: '/support' },
    { label: 'My Bets', path: '/bids' },
    { label: 'Bank', path: '/bank' },
    { label: 'Funds', path: '/funds' },
    { label: 'Notification', path: '/support' },
    { label: 'Game Chart', path: '/support' },
    { label: 'Game Rate', path: '/support' },
    { label: 'Time Table', path: '/support' },
    { label: 'Notice board / Rules', path: '/support' },
    { label: 'Settings', path: '/support' },
    { label: 'How to play', path: '/support' },
    { label: 'Share App', path: '/support' },
    { label: 'Logout', path: '/login' }
  ];

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
    };

    checkUser();

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

  const displayName = user?.username || 'Guest';
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

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 w-full bg-black px-3 sm:px-5 md:px-6 lg:px-8 py-1.5 sm:py-2 md:py-2.5">
        <div className="flex items-center justify-between gap-1.5 sm:gap-2 md:gap-3">
          {/* Hamburger Menu and Logo together on the left */}
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
            <button
              type="button"
              onClick={() => setIsMenuOpen(true)}
              className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 shrink-0 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-700 transition-colors"
              aria-label="Open menu"
            >
            <div className="flex flex-col gap-1 sm:gap-1.5">
              <div className="w-4 sm:w-5 md:w-5 h-0.5 bg-white"></div>
              <div className="w-3 sm:w-4 md:w-4 h-0.5 bg-white"></div>
              <div className="w-2.5 sm:w-3 md:w-3 h-0.5 bg-white"></div>
            </div>
            </button>

            {/* Logo - aligned next to hamburger */}
            <Link
              to="/"
              className="flex items-center cursor-pointer hover:opacity-90 transition-opacity"
            >
              <img
                src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1770203502/332c5616-7c46-4b98-93c8-8f97dd68f692.png"
                alt="Logo"
                className="h-8 sm:h-9 md:h-10 lg:h-11 w-auto object-contain"
              />
            </Link>
          </div>

        {/* Right side buttons - Download App, Wallet, Profile */}
        <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3">
          {/* Download App - responsive padding, text, icon */}
          <button
            onClick={() => navigate('/download')}
            className="shrink-0 rounded-lg sm:rounded-xl md:rounded-xl bg-[#f3b61b] px-2.5 sm:px-3 md:px-4 lg:px-5 py-1.5 sm:py-2 md:py-2.5 text-xs sm:text-sm md:text-base font-semibold text-black shadow-[0_4px_12px_rgba(243,182,27,0.35)] hover:bg-[#e5a914] transition-colors flex items-center gap-1 sm:gap-1.5 md:gap-2"
          >
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Download App</span>
          </button>

          {/* Wallet - desktop only, responsive size */}
          <button
            onClick={() => navigate('/bank')}
            className="hidden md:flex shrink-0 items-center gap-1.5 md:gap-2 lg:gap-2.5 rounded-lg bg-[#202124] border border-white/5 px-2.5 md:px-3 lg:px-4 py-1.5 md:py-2 hover:bg-[#2a2b2e] transition-colors"
          >
            <img
              src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769780438/Untitled_90_x_160_px_1080_x_1080_px_ychsx6.png"
              alt="Wallet"
              className="w-7 h-7 md:w-8 md:h-8 lg:w-9 lg:h-9 object-contain"
            />
            <span className="text-sm md:text-base lg:text-lg font-bold text-white">2,853</span>
          </button>

          {/* Profile Icon (replaces notification icon on mobile) */}
          <button
            type="button"
            onClick={handleProfileClick}
            className={`w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 shrink-0 rounded-full bg-gray-800 border flex items-center justify-center cursor-pointer transition-colors ${
              user ? 'border-yellow-500/50 hover:bg-yellow-500/10' : 'border-gray-700 hover:bg-gray-700'
            }`}
            title={user ? `${user.username} - View Profile` : 'Sign In / Sign Up'}
            aria-label="Profile"
          >
            <svg
              className={`w-4 h-4 sm:w-5 sm:h-5 md:w-5 md:h-5 ${user ? 'text-yellow-400' : 'text-white'}`}
              fill={user ? 'currentColor' : 'none'}
              stroke={user ? 'none' : 'currentColor'}
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
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsMenuOpen(false)}
            aria-label="Close menu overlay"
          />
          <aside className="relative h-full w-[86%] max-w-[360px] sm:w-[70%] sm:max-w-[380px] md:w-[420px] md:max-w-none bg-black shadow-[6px_0_18px_rgba(0,0,0,0.5)]">
            <div className="px-4 sm:px-6 pt-6 pb-4 border-b border-gray-800">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#0f2c5a] flex items-center justify-center text-white text-xl sm:text-2xl font-semibold">
                    {avatarInitial}
                  </div>
                  <div>
                    <div className="text-base sm:text-lg font-semibold text-white">{displayName}</div>
                    <div className="text-xs sm:text-sm text-gray-300">{displayPhone}</div>
                    <div className="text-xs sm:text-sm text-gray-400">{sinceText}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(false)}
                  className="text-red-500 text-2xl sm:text-3xl leading-none"
                  aria-label="Close menu"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="px-4 sm:px-6 py-4 space-y-3 overflow-y-auto h-[calc(100%-128px)] scrollbar-hidden">
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
                  className="w-full bg-gray-900 rounded-2xl px-3 py-3 sm:px-4 sm:py-3.5 flex items-center gap-4 border border-gray-800 shadow-[0_8px_18px_rgba(0,0,0,0.35)]"
                >
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#0f2c5a] text-white flex items-center justify-center">
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
                      <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-white"></div>
                    )}
                  </div>
                  <span className="text-sm sm:text-base font-semibold text-white">{item.label}</span>
                </button>
              ))}
              <div className="text-center text-xs text-gray-500 pt-2">Version: 1.0.0</div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};

export default AppHeader;
