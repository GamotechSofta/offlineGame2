import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const AppHeader = () => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState(null);

  const menuItems = [
    { label: 'Home', path: '/' },
    { label: 'Top Winners', path: '/support' },
    { label: 'Starline Winners', path: '/support' },
    { label: 'Telegram Channel', path: '/support' },
    { label: 'My Bids', path: '/bids' },
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

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 w-full bg-black px-3 sm:px-5 md:px-6 lg:px-8 py-2.5 sm:py-3 md:py-4">
        <div className="flex items-center justify-between gap-1.5 sm:gap-2 md:gap-3">
          {/* Hamburger Menu - responsive size */}
          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            className="w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 shrink-0 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-700 transition-colors"
            aria-label="Open menu"
          >
          <div className="flex flex-col gap-1 sm:gap-1.5">
            <div className="w-4 sm:w-5 md:w-5 h-0.5 bg-white"></div>
            <div className="w-3 sm:w-4 md:w-4 h-0.5 bg-white"></div>
            <div className="w-2.5 sm:w-3 md:w-3 h-0.5 bg-white"></div>
          </div>
          </button>

        {/* Logo with Star - responsive text and icon */}
        <Link
          to="/"
          className="flex items-center gap-1 relative min-w-0 flex-1 justify-center cursor-pointer hover:opacity-90 transition-opacity"
        >
          <h1 className="text-yellow-500 text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold lowercase relative">
            logoipsum
            <span className="absolute bottom-0 left-0 w-10 sm:w-12 md:w-14 h-0.5 bg-yellow-500"></span>
            <span className="absolute bottom-0 right-0 w-8 sm:w-10 md:w-12 h-0.5 bg-yellow-500"></span>
            <svg className="absolute -top-0.5 sm:-top-1 right-1.5 sm:right-2 w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </h1>
        </Link>

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

        {/* Profile Icon - Desktop only, shows when logged in */}
        {user ? (
          <div 
            onClick={handleLogout}
            className="hidden md:flex w-9 h-9 md:w-10 md:h-10 lg:w-11 lg:h-11 shrink-0 rounded-full bg-gray-800 border border-yellow-500/50 flex items-center justify-center cursor-pointer hover:bg-yellow-500/10 transition-colors"
            title={`${user.username} - Click to logout`}
          >
            <svg 
              className="w-4 h-4 sm:w-5 sm:h-5 md:w-5 md:h-5 text-yellow-400" 
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path 
                fillRule="evenodd" 
                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" 
                clipRule="evenodd" 
              />
            </svg>
          </div>
        ) : (
          /* Sign In/Sign Up Icon - Desktop only, shows when not logged in */
          <div 
            onClick={() => navigate('/login')}
            className="hidden md:flex w-9 h-9 md:w-10 md:h-10 lg:w-11 lg:h-11 shrink-0 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-700 transition-colors"
            title="Sign In / Sign Up"
          >
            <svg 
              className="w-4 h-4 sm:w-5 sm:h-5 md:w-5 md:h-5 text-white" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth="2" 
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" 
              />
            </svg>
          </div>
        )}

        {/* Notification Bell - responsive size */}
          <div className="w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 shrink-0 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-700 transition-colors relative">
          <svg className="w-4 h-4 sm:w-5 sm:h-5 md:w-5 md:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-500 rounded-full"></div>
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
                    ) : item.label === 'My Bids' ? (
                      <img
                        src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769777192/auction_ofhpps.png"
                        alt="My Bids"
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
