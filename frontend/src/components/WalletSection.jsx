import React, { useState, useEffect } from 'react';
import { getBalance, updateUserBalance } from '../api/bets';

const WalletSection = () => {
  const [balance, setBalance] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [addMoneyOpen, setAddMoneyOpen] = useState(false);

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
    <section className="w-full bg-black py-4 sm:py-6 px-4 sm:px-6">
      {/* Available Points Balance Card */}
      <div className="relative w-full max-w-lg mx-auto mb-8">
        <div className="relative bg-[#202124] rounded-3xl px-5 pt-3 pb-6 sm:px-6 sm:pt-4 sm:pb-8 shadow-2xl border border-white/5 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img
                src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769780438/Untitled_90_x_160_px_1080_x_1080_px_ychsx6.png"
                alt="Wallet Icon"
                className="w-16 h-16 object-contain shrink-0"
              />
              <div className="flex flex-col gap-0.5">
                <h2 className="text-2xl sm:text-3xl leading-none font-bold text-white tracking-tight font-sans">₹ {formattedBalance}</h2>
                <p className="text-gray-400 text-sm font-light tracking-wide">Available Points Balance</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRefreshBalance}
                disabled={refreshing}
                className="w-10 h-10 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center text-white hover:bg-gray-600 disabled:opacity-50"
                aria-label="Refresh balance"
                title="Refresh balance"
              >
                {refreshing ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                )}
              </button>
              <button
                type="button"
                onClick={() => setAddMoneyOpen(true)}
                className="group relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-white overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#202124]"
                aria-label="Add Money"
              >
                <span className="absolute inset-0 bg-gradient-to-br from-[#25d366] via-[#20bd5a] to-[#1a9e47] rounded-full" />
                <span className="absolute inset-0 rounded-full bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-80" />
                <span className="absolute inset-0 rounded-full shadow-[0_4px_20px_rgba(37,211,102,0.45),inset_0_1px_0_rgba(255,255,255,0.2)] group-hover:shadow-[0_6px_28px_rgba(37,211,102,0.55),inset_0_1px_0_rgba(255,255,255,0.25)] transition-shadow duration-300" />
                <span className="relative flex items-center justify-center gap-0.5">
                  <span className="text-xl sm:text-2xl font-bold drop-shadow-sm">₹</span>
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M19 12H5" /></svg>
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Add Money modal */}
        {addMoneyOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70" onClick={() => setAddMoneyOpen(false)}>
            <div className="bg-[#202124] rounded-2xl border border-white/10 shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-white mb-2">Add funds</h3>
              <p className="text-gray-400 text-sm mb-4">To add money to your wallet, contact your bookie or admin. They can credit your account directly.</p>
              <button type="button" onClick={() => setAddMoneyOpen(false)} className="w-full py-2.5 rounded-lg bg-[#d4af37] text-[#4b3608] font-semibold">OK</button>
            </div>
          </div>
        )}

        {/* Withdraw Section - Tab Style */}
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 z-20">
          <button className="relative group cursor-pointer active:scale-95 transition-transform duration-200">
            {/* Shape Container with CSS Clip Path */}
            <div
              className="w-[200px] h-[48px] bg-black flex items-center justify-center gap-3 shadow-2xl"
              style={{
                clipPath: 'polygon(10% 0%, 90% 0%, 100% 100%, 0% 100%)',
                paddingBottom: '4px'
              }}
            >
              {/* Inner Content */}
              <div className="flex items-center gap-2">
                {/* Icon Box - Solid Gold */}
                <div className="w-6 h-6 rounded bg-[#cca84d] flex items-center justify-center text-black">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
                {/* Text */}
                <span className="text-[#cca84d] font-bold text-[15px] tracking-[0.08em] uppercase">
                  Withdraw
                </span>
              </div>

              {/* Shine Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-700 pointer-events-none"></div>
            </div>
          </button>
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
      <div className="mt-5 sm:mt-6 grid grid-cols-2 gap-3 sm:gap-4">
        <button className="relative rounded-2xl bg-[#2a2721] p-4 sm:p-5 text-left shadow-[0_8px_20px_rgba(0,0,0,0.35)] ring-1 ring-white/5 hover:bg-[#302c25] transition-colors">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-[#f2c14e] text-[#4b3608] flex items-center justify-center text-2xl font-bold shadow-[0_6px_12px_rgba(242,193,78,0.35)]">
                ★
              </div>
              <p className="text-white text-sm sm:text-base font-semibold tracking-wide">STARTLINE</p>
            </div>
            <span className="text-white/40 text-lg">›</span>
          </div>
        </button>

        <button className="relative rounded-2xl bg-[#2a2721] p-4 sm:p-5 text-left shadow-[0_8px_20px_rgba(0,0,0,0.35)] ring-1 ring-white/5 hover:bg-[#302c25] transition-colors">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-[#e8e1ff] text-[#4a3c9a] flex items-center justify-center text-2xl shadow-[0_6px_12px_rgba(232,225,255,0.35)]">
                🎲
              </div>
              <p className="text-white text-sm sm:text-base font-semibold tracking-wide">KING BAZAAR</p>
            </div>
            <span className="text-white/40 text-lg">›</span>
          </div>
        </button>
      </div>

    </section>
  );
};

export default WalletSection;

