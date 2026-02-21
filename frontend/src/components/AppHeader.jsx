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
    { label: 'Top Winners', path: '/top-winners' },
    { label: 'Telegram Channel', path: '/support' },
    { label: 'Notification', path: '/support' },
    { label: 'Game Chart', path: '/support' },
    { label: 'Game Rate', path: '/support' },
    { label: 'Time Table', path: '/support' },
    { label: 'Help Desk', path: '/support' },
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
      window.removeEventListener('storage', checkUser);
      window.removeEventListener('userLogin', checkUser);
      window.removeEventListener('userLogout', checkUser);
      window.removeEventListener('balanceUpdated', handleBalanceUpdate);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    window.dispatchEvent(new Event('userLogout'));
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
        className="fixed top-0 left-0 right-0 z-50 w-full bg-white border-b-2 border-orange-200 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:pl-[max(1.25rem,env(safe-area-inset-left))] sm:pr-[max(1.25rem,env(safe-area-inset-right))] md:pl-[max(1.5rem,env(safe-area-inset-left))] md:pr-[max(1.5rem,env(safe-area-inset-right))] py-2.5 sm:py-2 md:py-2.5 pt-[calc(0.625rem+env(safe-area-inset-top,0px))] sm:pt-[calc(0.5rem+env(safe-area-inset-top,0px))] md:pt-[calc(0.625rem+env(safe-area-inset-top,0px))]"
      >
        <div className="flex items-center justify-between gap-2 sm:gap-2 md:gap-3">
          {/* Hamburger Menu and Logo together on the left */}
          <div className="flex items-center gap-2.5 sm:gap-3 md:gap-4">
            <button
              type="button"
              onClick={() => setIsMenuOpen(true)}
              className="w-10 h-10 sm:w-9 sm:h-9 md:w-10 md:h-10 shrink-0 rounded-xl bg-gray-50 border-2 border-gray-300 flex items-center justify-center cursor-pointer active:scale-95 hover:bg-gray-100 transition-all duration-200 shadow-sm"
              aria-label="Open menu"
            >
            <div className="flex flex-col gap-1.5 sm:gap-1.5">
              <div className="w-5 sm:w-5 md:w-5 h-[2.5px] bg-black rounded-full"></div>
              <div className="w-4 sm:w-4 md:w-4 h-[2.5px] bg-black rounded-full"></div>
              <div className="w-3.5 sm:w-3 md:w-3 h-[2.5px] bg-black rounded-full"></div>
            </div>
            </button>

            {/* Home Icon */}
            <Link 
              to="/" 
              className="w-10 h-10 sm:w-9 sm:h-9 md:w-10 md:h-10 shrink-0 rounded-xl bg-gray-50 border-2 border-gray-300 flex items-center justify-center cursor-pointer active:scale-95 hover:bg-gray-100 transition-all duration-200 shadow-sm"
              title="Home"
            >
              <svg 
                className="w-5 h-5 sm:w-5 sm:h-5 md:w-5 md:h-5 text-black" 
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

        {/* Right side buttons - Wallet, Profile */}
        <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3">
          {/* Wallet - desktop only, responsive size */}
          <button
            onClick={() => navigate('/funds?tab=add-fund')}
            className="hidden md:flex shrink-0 items-center gap-1.5 md:gap-2 lg:gap-2.5 rounded-lg bg-orange-50 border-2 border-orange-200 px-2.5 md:px-3 lg:px-4 py-1.5 md:py-2 hover:bg-orange-100 hover:border-orange-300 transition-colors"
          >
            <img
              src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769780438/Untitled_90_x_160_px_1080_x_1080_px_ychsx6.png"
              alt="Wallet"
              className="w-7 h-7 md:w-8 md:h-8 lg:w-9 lg:h-9 object-contain"
            />
            <span className="text-sm md:text-base lg:text-lg font-bold text-gray-800">₹{formattedBalance}</span>
          </button>

          {/* Profile Icon - improved mobile touch target */}
          <button
            type="button"
            onClick={handleProfileClick}
            className={`w-10 h-10 sm:w-9 sm:h-9 md:w-10 md:h-10 shrink-0 rounded-xl border-2 flex items-center justify-center cursor-pointer active:scale-95 transition-all duration-200 shadow-sm ${
              user ? 'bg-orange-50 border-orange-500 hover:bg-orange-100 hover:border-orange-600' : 'bg-white border-orange-300 hover:bg-orange-50 hover:border-orange-400'
            }`}
            title={user ? `${user.username} - View Profile` : 'Sign In / Sign Up'}
            aria-label="Profile"
          >
            <svg
              className={`w-5 h-5 sm:w-5 sm:h-5 md:w-5 md:h-5 ${user ? 'text-orange-500' : 'text-orange-400'}`}
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
          <aside className="relative h-full w-[86%] max-w-[360px] sm:w-[70%] sm:max-w-[380px] md:w-[420px] md:max-w-none bg-white shadow-[6px_0_24px_rgba(0,0,0,0.2)] border-r-2 border-orange-200">
            {/* User Profile Section */}
            <div className="px-5 sm:px-6 pt-6 pb-5 border-b-2 border-orange-200 bg-gradient-to-b from-orange-50 to-white">
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
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 border-2 border-orange-300 flex items-center justify-center text-white text-xl sm:text-2xl font-bold shadow-lg">
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
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-orange-50 border-2 border-orange-200 flex items-center justify-center text-orange-500 hover:text-orange-600 hover:bg-orange-100 hover:border-orange-300 active:scale-95 transition-all duration-200 shrink-0"
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
                  className="group w-full bg-white rounded-xl sm:rounded-2xl px-4 py-3.5 sm:py-4 flex items-center gap-4 border-2 border-orange-200 hover:border-orange-400 hover:bg-orange-50 hover:shadow-lg active:scale-[0.98] transition-all duration-200"
                >
                  {/* Icon Container */}
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-orange-50 border-2 border-orange-200 flex items-center justify-center shrink-0 group-hover:border-orange-400 group-hover:bg-orange-100 group-hover:shadow-md transition-all duration-200">
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
                      <img
                        src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769777192/auction_ofhpps.png"
                        alt="My Bets"
                        className="w-6 h-6 sm:w-7 sm:h-7 object-contain brightness-0"
                      />
                    ) : item.label === 'Bank' ? (
                      <img
                        src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769777283/bank_il6uwi.png"
                        alt="Bank"
                        className="w-6 h-6 sm:w-7 sm:h-7 object-contain brightness-0"
                      />
                    ) : item.label === 'Funds' ? (
                      <img
                        src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769777500/funding_zjmbzp.png"
                        alt="Funds"
                        className="w-6 h-6 sm:w-7 sm:h-7 object-contain brightness-0"
                      />
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
                      <img
                        src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769777618/customer-support_du0zcj.png"
                        alt="Help Desk"
                        className="w-6 h-6 sm:w-7 sm:h-7 object-contain brightness-0"
                      />
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
                    ) : (
                      <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-gray-400"></div>
                    )}
                  </div>
                  
                  {/* Menu Text */}
                  <span className="text-sm sm:text-base font-semibold text-gray-800 group-hover:text-orange-600 transition-colors duration-200 flex-1 text-left">
                    {item.label}
                  </span>
                  
                  {/* Arrow Indicator */}
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-orange-500 group-hover:translate-x-1 transition-all duration-200 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
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
