import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBalance, updateUserBalance } from '../api/bets';

const WalletSection = () => {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadStoredBalance = () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const b = user?.balance ?? user?.walletBalance ?? user?.wallet ?? 0;
      setBalance(Number(b));
    } catch (_) {
      setBalance(0);
    }
  };

  // Load from storage and fetch latest from server when user is logged in
  useEffect(() => {
    loadStoredBalance();
    const onLogin = () => loadStoredBalance();

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

    // On mount: fetch latest balance from server so admin updates are reflected
    fetchAndUpdateBalance();

    window.addEventListener('userLogin', onLogin);
    return () => window.removeEventListener('userLogin', onLogin);
  }, []);

  const handleRefreshBalance = async () => {
    setRefreshing(true);
    try {
      const res = await getBalance();
      if (res.success && res.data?.balance != null) {
        updateUserBalance(res.data.balance);
        setBalance(res.data.balance);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const displayBalance = balance != null ? Number(balance) : 0;
  const formattedBalance = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(displayBalance);

  return (
    <section className="w-full bg-black py-2 sm:py-4 px-4 sm:px-6">
      {/* Available Points Balance Card */}
      <div className="relative w-full max-w-lg mx-auto mb-6 sm:mb-12">
        {/* Main Card - Premium Design */}
        <div className="relative bg-[#1e1e1e] rounded-2xl sm:rounded-3xl px-3 pt-2.5 pb-0 sm:px-6 sm:pt-5 sm:pb-0 md:px-7 md:pt-6 md:pb-0 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 z-10 overflow-visible">
          {/* Subtle background glow */}
          <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-yellow-500/8 via-yellow-500/4 to-transparent rounded-t-2xl sm:rounded-t-3xl"></div>
          
          {/* Content */}
          <div className="relative flex flex-col">
            {/* Top Row - Balance and Action Buttons */}
            <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 sm:gap-4 pb-2.5 sm:pb-5">
              {/* Left Side - Wallet Icon and Balance */}
              <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                {/* Wallet Icon - Premium Design */}
                <div className="relative shrink-0">
                  <div className="w-[60px] h-[60px] sm:w-20 sm:h-20 md:w-[88px] md:h-[88px] bg-[#2a2a2a] rounded-2xl sm:rounded-3xl p-3 sm:p-3.5 border border-white/10 shadow-lg flex items-center justify-center">
                    <img
                      src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769780438/Untitled_90_x_160_px_1080_x_1080_px_ychsx6.png"
                      alt="Wallet Icon"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>

                {/* Balance Text */}
                <div className="flex flex-col gap-1.5 sm:gap-2 min-w-0 flex-1">
                  <h2 className="text-[clamp(22px,7vw,44px)] sm:text-4xl md:text-5xl leading-none font-black text-white tracking-tight whitespace-nowrap inline-flex items-baseline gap-2">
                    <span className="pr-0.5">₹</span>
                    <span>{formattedBalance}</span>
                  </h2>
                </div>
              </div>

              {/* Right Side - Action Buttons */}
              <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 ml-auto">
                {/* Refresh Button */}
                <button
                  type="button"
                  onClick={handleRefreshBalance}
                  disabled={refreshing}
                  className="w-9 h-9 sm:w-12 sm:h-12 md:w-[52px] md:h-[52px] rounded-xl bg-[#2a2a2a] border border-white/10 flex items-center justify-center text-white hover:bg-[#333] hover:border-white/20 active:scale-95 disabled:opacity-50 transition-all duration-200 shadow-md"
                  aria-label="Refresh balance"
                  title="Refresh balance"
                >
                  {refreshing ? (
                    <span className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                </button>

                {/* Add Funds Button */}
                <button
                  type="button"
                  onClick={() => navigate('/funds?tab=add-fund')}
                  className="group relative w-10 h-10 sm:w-14 sm:h-14 md:w-[56px] md:h-[56px] rounded-xl bg-gradient-to-br from-[#25d366] to-[#1a9e47] flex items-center justify-center text-white overflow-hidden transition-all duration-200 hover:from-[#2ee576] hover:to-[#20bd5a] active:scale-95 shadow-lg hover:shadow-xl hover:shadow-green-500/40"
                  aria-label="Add Money"
                  title="Add Money"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/25 to-transparent"></div>
                  <span className="relative flex items-center justify-center gap-1">
                    <span className="text-xl sm:text-2xl md:text-3xl font-black">₹</span>
                    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14M19 12H5" />
                    </svg>
                  </span>
                </button>
              </div>
            </div>

            {/* Bottom Row - Withdraw Button */}
            <div className="flex justify-center border-t border-white/10 relative">
              <button 
                onClick={() => navigate('/funds?tab=withdraw-fund')}
                className="relative group cursor-pointer active:scale-95 transition-transform duration-200 -mb-0 sm:-mb-[6px] md:-mb-[8px]"
              >
                {/* Angular Shape Container */}
                <div
                  className="w-[170px] sm:w-[190px] md:w-[210px] h-[34px] sm:h-[42px] md:h-[46px] bg-gradient-to-b from-[#d4af37] via-[#cca84d] to-[#b8941f] flex items-center justify-center gap-2.5 sm:gap-3 shadow-[0_8px_24px_rgba(212,175,55,0.5)]"
                  style={{
                    clipPath: 'polygon(10% 0%, 90% 0%, 100% 100%, 0% 100%)',
                  }}
                >
                  {/* Inner Content */}
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    {/* Icon Box */}
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-black/40 flex items-center justify-center backdrop-blur-sm shadow-inner">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </div>
                    {/* Text */}
                    <span className="text-black font-black text-xs sm:text-sm md:text-base tracking-wider uppercase drop-shadow-sm">
                      Withdraw
                    </span>
                  </div>

                  {/* Shine Effect on Hover */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-700 pointer-events-none"></div>
                </div>
              </button>
            </div>
          </div>
        </div>

      </div>

      <div className="mt-5 sm:hidden">
        <img
          src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769775839/Black_and_White_Minimalist_Casino_Night_Facebook_Cover_olvhqm.png"
          alt="Casino banner"
          className="w-full rounded-2xl shadow-[0_10px_25px_rgba(0,0,0,0.35)]"
        />
      </div>

      {/* Market Category Buttons */}
      <div className="mt-6 sm:mt-8 grid grid-cols-2 gap-3 sm:gap-4 max-w-lg mx-auto">
        <button 
          onClick={() => navigate('/bidoptions', { state: { marketType: 'startline' } })}
          className="group relative rounded-2xl sm:rounded-3xl bg-[#1a1a1a] p-4 sm:p-5 md:p-6 text-left shadow-[0_8px_20px_rgba(0,0,0,0.4)] border border-white/10 hover:border-yellow-500/30 hover:bg-[#222] active:scale-95 transition-all duration-200"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#f2c14e] to-[#d4af37] text-[#4b3608] flex items-center justify-center text-xl sm:text-2xl md:text-3xl font-bold shadow-[0_6px_16px_rgba(242,193,78,0.4)]">
                ★
              </div>
              <p className="text-white text-sm sm:text-base md:text-lg font-bold">STARTLINE</p>
            </div>
            <span className="text-white/30 text-xl sm:text-2xl group-hover:text-yellow-500/60 transition-colors">›</span>
          </div>
        </button>

        <button 
          onClick={() => navigate('/bidoptions', { state: { marketType: 'king' } })}
          className="group relative rounded-2xl sm:rounded-3xl bg-[#1a1a1a] p-4 sm:p-5 md:p-6 text-left shadow-[0_8px_20px_rgba(0,0,0,0.4)] border border-white/10 hover:border-purple-500/30 hover:bg-[#222] active:scale-95 transition-all duration-200"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#e8e1ff] to-[#d4c5ff] text-[#4a3c9a] flex items-center justify-center text-xl sm:text-2xl md:text-3xl shadow-[0_6px_16px_rgba(232,225,255,0.4)]">
                🎲
              </div>
              <p className="text-white text-sm sm:text-base md:text-lg font-bold">KING BAZAAR</p>
            </div>
            <span className="text-white/30 text-xl sm:text-2xl group-hover:text-purple-500/60 transition-colors">›</span>
          </div>
        </button>
      </div>

    </section>
  );
};

export default WalletSection;

