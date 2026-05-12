import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getBalance, updateUserBalance } from '../api/bets';
<<<<<<< Updated upstream
import { API_BASE_URL, ANDROID_APK_URL } from '../config/api';
=======
import { API_BASE_URL } from '../config/api';
>>>>>>> Stashed changes
import { clearCurrentUser, getCurrentUser, subscribeUserSession } from '../session/userSession';

const APK_DOWNLOAD_URL = 'https://shri-balaji-app.s3.ap-south-1.amazonaws.com/app-release.apk';

const AppHeader = () => {
  const navigate = useNavigate();
  const headerRef = useRef(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState(() => getCurrentUser());
  const [balance, setBalance] = useState(null);

  const menuItems = [
    { label: 'My Bets', path: '/bids' },
    { label: 'Funds', path: '/funds' },
    { label: 'Download App', path: null, isDownload: true },
    { label: 'Game Rate', path: '/game-rate' },
    { label: 'Help Desk', path: '/support' },
    { label: 'Logout', path: '/login' }
  ];

  const loadStoredBalance = () => {
    try {
      const sessionUser = getCurrentUser() || {};
      const b = sessionUser?.balance ?? sessionUser?.walletBalance ?? sessionUser?.wallet ?? 0;
      setBalance(Number(b));
    } catch (_) {
      setBalance(0);
    }
  };

  useEffect(() => {
    const checkUser = () => {
      setUser(getCurrentUser());
      loadStoredBalance();
    };

    checkUser();

    // Fetch balance from server
    const fetchAndUpdateBalance = async () => {
      try {
        const sessionUser = getCurrentUser();
        const userId = sessionUser?.id || sessionUser?._id;
        if (!userId) return;
        const res = await getBalance();
        if (res.success && res.data?.balance != null) {
          updateUserBalance(res.data.balance);
          setBalance(res.data.balance);
        }
      } catch (_) {}
    };

    fetchAndUpdateBalance();

    const unsubscribe = subscribeUserSession(checkUser);
    window.addEventListener('userLogin', checkUser);
    window.addEventListener('userLogout', checkUser);
    
    // Listen for balance updates
    const handleBalanceUpdate = (e) => {
      const newBalance = e.detail?.balance;
      if (newBalance != null) {
        setBalance(newBalance);
      } else {
        fetchAndUpdateBalance();
      }
    };
    window.addEventListener('balanceUpdated', handleBalanceUpdate);

    return () => {
      unsubscribe();
      window.removeEventListener('userLogin', checkUser);
      window.removeEventListener('userLogout', checkUser);
      window.removeEventListener('balanceUpdated', handleBalanceUpdate);
    };
  }, []);

  useEffect(() => {
    const updateHeaderHeightVar = () => {
      const h = headerRef.current?.offsetHeight;
      if (!h) return;
      document.documentElement.style.setProperty('--app-header-height', `${h}px`);
    };

    updateHeaderHeightVar();
    window.addEventListener('resize', updateHeaderHeightVar);
    window.addEventListener('orientationchange', updateHeaderHeightVar);

    let ro = null;
    if (typeof ResizeObserver !== 'undefined' && headerRef.current) {
      ro = new ResizeObserver(() => updateHeaderHeightVar());
      ro.observe(headerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateHeaderHeightVar);
      window.removeEventListener('orientationchange', updateHeaderHeightVar);
      ro?.disconnect();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/users/logout`, { method: 'POST', credentials: 'include' });
    } catch (_) {}
    clearCurrentUser();
    setUser(null);
    navigate('/login', { replace: true });
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
        ref={headerRef}
        className="fixed top-0 left-0 right-0 z-50 w-full bg-white border-b-2 border-gray-300 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:pl-[max(1.25rem,env(safe-area-inset-left))] sm:pr-[max(1.25rem,env(safe-area-inset-right))] md:pl-[max(1.5rem,env(safe-area-inset-left))] md:pr-[max(1.5rem,env(safe-area-inset-right))] py-1 sm:py-1 md:py-1.5 pt-[calc(0.375rem+env(safe-area-inset-top,0px))] sm:pt-[calc(0.25rem+env(safe-area-inset-top,0px))] md:pt-[calc(0.375rem+env(safe-area-inset-top,0px))] pb-1 sm:pb-1 md:pb-1.5"
      >
        <div className="flex items-center justify-between gap-2 sm:gap-2 md:gap-3">
          {/* Hamburger Menu and Logo together on the left */}
          <div className="flex items-center gap-2.5 sm:gap-3 md:gap-4">
            <button
              type="button"
              onClick={() => setIsMenuOpen(true)}
              className="w-8 h-8 sm:w-7 sm:h-7 md:w-8 md:h-8 shrink-0 rounded-lg bg-gray-50 border-2 border-gray-300 flex items-center justify-center cursor-pointer active:scale-95 hover:bg-gray-100 transition-all duration-200 shadow-sm"
              aria-label="Open menu"
            >
            <div className="flex flex-col gap-1 sm:gap-1">
              <div className="w-4 sm:w-4 md:w-4 h-[2px] bg-black rounded-full"></div>
              <div className="w-3.5 sm:w-3.5 md:w-3.5 h-[2px] bg-black rounded-full"></div>
              <div className="w-3 sm:w-3 md:w-3 h-[2px] bg-black rounded-full"></div>
            </div>
            </button>

            {/* Home Icon */}
            <Link 
              to="/" 
              className="w-8 h-8 sm:w-7 sm:h-7 md:w-8 md:h-8 shrink-0 rounded-lg bg-gray-50 border-2 border-gray-300 flex items-center justify-center cursor-pointer active:scale-95 hover:bg-gray-100 transition-all duration-200 shadow-sm"
              title="Home"
            >
              <svg 
                className="w-4 h-4 sm:w-4 sm:h-4 md:w-4 md:h-4 text-black" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth="2" 
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" 
                />
              </svg>
            </Link>

            {/* Logo - aligned next to hamburger */}
            
          </div>

        {/* Right side buttons - Download, Wallet, Profile */}
        <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3">
          {/* Download App - direct in navbar */}
          <button
            type="button"
<<<<<<< Updated upstream
            onClick={() => window.open(ANDROID_APK_URL, '_blank', 'noopener,noreferrer')}
=======
            onClick={() => window.open(APK_DOWNLOAD_URL, '_blank', 'noopener,noreferrer')}
>>>>>>> Stashed changes
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-gray-50 border-2 border-gray-300 px-2 md:px-2.5 py-1 md:py-1.5 hover:bg-gray-100 hover:border-gray-400 transition-colors"
            title="Download App"
          >
            <svg className="w-5 h-5 md:w-6 md:h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="text-xs md:text-sm font-bold text-gray-800 hidden sm:inline">Download</span>
          </button>

          {/* Wallet - desktop only, responsive size */}
          <button
            onClick={() => navigate('/funds?tab=add-fund')}
            className="flex shrink-0 items-center gap-1.5 md:gap-2 lg:gap-2.5 rounded-lg bg-gray-50 border-2 border-gray-300 px-2 md:px-2.5 lg:px-3 py-1 md:py-1.5 hover:bg-gray-100 hover:border-gray-400 transition-colors"
          >
            <svg
              className="w-5 h-5 md:w-6 md:h-6 text-[#1B3150]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 7.5h16.5A1.5 1.5 0 0121.75 9v9a1.5 1.5 0 01-1.5 1.5H3.75A1.5 1.5 0 012.25 18V9a1.5 1.5 0 011.5-1.5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 14.25a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM6.75 7.5V6A1.5 1.5 0 018.25 4.5h7.5A1.5 1.5 0 0117.25 6v1.5" />
            </svg>
            <span className="text-xs md:text-sm lg:text-base font-bold text-gray-800">₹{formattedBalance}</span>
          </button>

          {/* Profile Icon - improved mobile touch target */}
          <button
            type="button"
            onClick={handleProfileClick}
            className={`w-8 h-8 sm:w-7 sm:h-7 md:w-8 md:h-8 shrink-0 rounded-lg border-2 flex items-center justify-center cursor-pointer active:scale-95 transition-all duration-200 shadow-sm ${
              user ? 'bg-gray-50 border-gray-500 hover:bg-gray-100 hover:border-[#1B3150]' : 'bg-white border-gray-400 hover:bg-gray-50 hover:border-[#1B3150]'
            }`}
            title={user ? `${user.username} - View Profile` : 'Sign In / Sign Up'}
            aria-label="Profile"
          >
            <svg
              className={`w-4 h-4 sm:w-4 sm:h-4 md:w-4 md:h-4 ${user ? 'text-gray-500' : 'text-[#1B3150]'}`}
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
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsMenuOpen(false)}
            aria-label="Close menu overlay"
          />
          <aside className="relative h-full w-[86%] max-w-[360px] sm:w-[70%] sm:max-w-[380px] md:w-[420px] md:max-w-none bg-white shadow-[6px_0_24px_rgba(0,0,0,0.2)] border-r-2 border-gray-300">
            {/* User Profile Section */}
            <div className="px-5 sm:px-6 pt-6 pb-5 border-b-2 border-gray-300 bg-gradient-to-b from-gray-50 to-white">
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleProfileClick();
                  }}
                  className="flex items-center gap-4 flex-1 min-w-0 text-left group"
                  aria-label="Open profile"
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-gray-500 to-[#1B3150] border-2 border-gray-400 flex items-center justify-center text-white text-xl sm:text-2xl font-bold shadow-lg">
                      {avatarInitial}
                    </div>
                    {user && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                    )}
                  </div>
                  
                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-base sm:text-lg font-bold text-gray-800 truncate">{displayName}</div>
                    <div className="text-xs sm:text-sm text-gray-600 mt-0.5 truncate">{displayPhone}</div>
                    <div className="text-xs sm:text-sm text-gray-500 mt-0.5">{sinceText}</div>
                  </div>
                </button>
                
                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(false)}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gray-50 border-2 border-gray-300 flex items-center justify-center text-gray-500 hover:text-[#1B3150] hover:bg-gray-100 hover:border-gray-400 active:scale-95 transition-all duration-200 shrink-0"
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
                    } else if (item.isDownload) {
<<<<<<< Updated upstream
                      window.open(ANDROID_APK_URL, '_blank', 'noopener,noreferrer');
=======
                      window.open(APK_DOWNLOAD_URL, '_blank', 'noopener,noreferrer');
>>>>>>> Stashed changes
                    } else {
                      navigate(item.path);
                    }
                  }}
                  className="group w-full bg-white rounded-xl sm:rounded-2xl px-4 py-3.5 sm:py-4 flex items-center gap-4 border-2 border-gray-300 hover:border-[#1B3150] hover:bg-gray-50 hover:shadow-lg active:scale-[0.98] transition-all duration-200"
                >
                  {/* Icon Container */}
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gray-50 border-2 border-gray-300 flex items-center justify-center shrink-0 group-hover:border-[#1B3150] group-hover:bg-gray-100 group-hover:shadow-md transition-all duration-200">
                    {item.label === 'Top Winners' ? (
                      <img
                        src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769797561/podium_swqjij.png"
                        alt={item.label}
                        className="w-6 h-6 sm:w-7 sm:h-7 object-contain brightness-0"
                      />
                    ) : item.label === 'Telegram Channel' ? (
                      <img
                        src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769797952/telegram_yw9hf1.png"
                        alt="Telegram"
                        className="w-6 h-6 sm:w-7 sm:h-7 object-contain brightness-0"
                      />
                    ) : item.label === 'My Bets' ? (
                      <svg className="w-6 h-6 sm:w-7 sm:h-7 text-gray-800" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 7.5A1.5 1.5 0 016 6h12a1.5 1.5 0 011.5 1.5V9a1.5 1.5 0 010 3 1.5 1.5 0 010 3v1.5A1.5 1.5 0 0118 18H6a1.5 1.5 0 01-1.5-1.5V15a1.5 1.5 0 010-3 1.5 1.5 0 010-3V7.5z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 9.75h6M9 14.25h3.75" />
                      </svg>
                    ) : item.label === 'Bank' ? (
                      <img
                        src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769777283/bank_il6uwi.png"
                        alt="Bank"
                        className="w-6 h-6 sm:w-7 sm:h-7 object-contain brightness-0"
                      />
                    ) : item.label === 'Funds' ? (
                      <svg className="w-6 h-6 sm:w-7 sm:h-7 text-gray-800" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="9" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.5h6M9 11h5.25M9.75 8.5c2.4 0 3.75 1.2 3.75 3 0 1.9-1.55 3.2-3.9 3.2h-.6L13.5 18" />
                      </svg>
                    ) : item.label === 'Notification' ? (
                      <img
                        src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769798359/notification_1_pflwit.png"
                        alt="Notification"
                        className="w-6 h-6 sm:w-7 sm:h-7 object-contain brightness-0"
                      />
                    ) : item.label === 'Game Chart' ? (
                      <img
                        src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769798462/start_eotpxc.png"
                        alt="Game Chart"
                        className="w-6 h-6 sm:w-7 sm:h-7 object-contain brightness-0"
                      />
                    ) : item.label === 'Game Rate' ? (
                      <img
                        src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769798548/stars_v1jfzk.png"
                        alt="Game Rate"
                        className="w-6 h-6 sm:w-7 sm:h-7 object-contain brightness-0"
                      />
                    ) : item.label === 'Time Table' ? (
                      <img
                        src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769798627/schedule_frf8zc.png"
                        alt="Time Table"
                        className="w-6 h-6 sm:w-7 sm:h-7 object-contain brightness-0"
                      />
                    ) : item.label === 'Help Desk' ? (
                      <svg className="w-6 h-6 sm:w-7 sm:h-7 text-gray-800" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75h6.75M8.625 13.5h4.5" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 4.5h9A3.75 3.75 0 0120.25 8.25v5.25a3.75 3.75 0 01-3.75 3.75h-4.25l-3.75 2.25v-2.25H7.5a3.75 3.75 0 01-3.75-3.75V8.25A3.75 3.75 0 017.5 4.5z" />
                      </svg>
                    ) : item.label === 'Share App' ? (
                      <img
                        src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769798998/share_a6shgt.png"
                        alt="Share App"
                        className="w-6 h-6 sm:w-7 sm:h-7 object-contain brightness-0"
                      />
                    ) : item.label === 'Logout' ? (
                      <img
                        src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769798997/logout_mttqvy.png"
                        alt="Logout"
                        className="w-6 h-6 sm:w-7 sm:h-7 object-contain brightness-0"
                      />
                    ) : item.label === 'Download App' ? (
                      <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    ) : (
                      <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-gray-400"></div>
                    )}
                  </div>
                  
                  {/* Menu Text */}
                  <span className="text-sm sm:text-base font-semibold text-gray-800 group-hover:text-[#1B3150] transition-colors duration-200 flex-1 text-left">
                    {item.label}
                  </span>
                  
                  {/* Arrow Indicator */}
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-500 group-hover:translate-x-1 transition-all duration-200 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
              
              {/* Version Footer */}
              <div className="text-center text-xs text-gray-500 pt-4 pb-2">Version: 1.0.0</div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};

export default AppHeader;
