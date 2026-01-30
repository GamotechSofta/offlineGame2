import React from 'react';

const WalletSection = () => {
  return (
    <section className="w-full bg-black py-6 sm:py-10 px-4 sm:px-6">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between mb-6">
        {/* Hamburger Menu */}
        <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-700 transition-colors">
          <div className="flex flex-col gap-1.5">
            <div className="w-5 h-0.5 bg-white"></div>
            <div className="w-4 h-0.5 bg-white"></div>
            <div className="w-3 h-0.5 bg-white"></div>
          </div>
        </div>
        
        {/* Logo with Star */}
        <div className="flex items-center gap-1 relative">
          <h1 className="text-yellow-500 text-xl sm:text-2xl font-bold lowercase relative">
            logoipsum
            {/* Underlines */}
            <span className="absolute bottom-0 left-0 w-12 h-0.5 bg-yellow-500"></span>
            <span className="absolute bottom-0 right-0 w-10 h-0.5 bg-yellow-500"></span>
            {/* Star above 'm' */}
            <svg className="absolute -top-1 right-2 w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </h1>
        </div>
        
        {/* Notification Bell with Red Dot */}
        <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-700 transition-colors relative">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {/* Red Notification Dot */}
          <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></div>
        </div>
      </div>

      {/* Available Points Balance Card */}
      <div className="bg-[#1e1f23] rounded-2xl p-4 sm:p-5 mb-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)] border border-white/5">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
          {/* Wallet Icon with Green Bills */}
          <div className="relative w-12 h-12 sm:w-14 sm:h-14">
            {/* Bills */}
            <div className="absolute -top-1 -left-1 w-7 h-5 bg-emerald-400 rounded-sm rotate-[-10deg] shadow-sm"></div>
            <div className="absolute -top-0.5 -left-0.5 w-6 h-4 bg-emerald-500 rounded-sm rotate-[-4deg] shadow-sm"></div>
            {/* Wallet */}
            <div className="relative w-full h-full bg-gradient-to-br from-[#5a4a6a] to-[#3c3246] rounded-xl flex items-center justify-center border border-white/10">
              <div className="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_6px_rgba(255,140,0,0.8)]"></div>
            </div>
          </div>
          
          {/* Balance Info */}
            <div className="text-left">
            <p className="text-white text-3xl sm:text-4xl font-semibold tracking-wide">2,853</p>
            <p className="text-gray-400 text-xs sm:text-sm tracking-wide">Available Points Balance</p>
            </div>
          </div>
        </div>
        
        {/* Add/Withdraw Buttons */}
          <div className="mt-2 flex flex-row items-center justify-between gap-2 sm:gap-3">
          <button className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-[#4caf50] px-3 sm:px-5 py-2 sm:py-2.5 text-[11px] sm:text-sm font-semibold uppercase text-white shadow-[0_6px_16px_rgba(76,175,80,0.35)] hover:bg-[#439a46] transition-colors">
            <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-white text-[#4caf50] text-sm sm:text-base font-bold">₹</span>
            Add Money
          </button>
          <button className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-[#ef4444] px-3 sm:px-5 py-2 sm:py-2.5 text-[11px] sm:text-sm font-semibold uppercase text-white shadow-[0_6px_16px_rgba(239,68,68,0.35)] hover:bg-[#dc3c3c] transition-colors">
            <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-white text-[#ef4444]">
              <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 7v10m0 0l-3-3m3 3l3-3" />
                <rect x="5" y="3" width="14" height="18" rx="2" />
              </svg>
            </span>
            Withdraw
          </button>
        </div>
      </div>

      <div className="flex justify-center">
        <button className="rounded-full bg-[#f3b61b] px-8 sm:px-12 py-3 sm:py-3.5 text-base sm:text-lg font-semibold text-black shadow-[0_6px_18px_rgba(243,182,27,0.35)] hover:bg-[#e5a914] transition-colors">
          Download App
        </button>
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
              <p className="text-white text-sm sm:text-base font-semibold tracking-wide">GALI-DISAWAR</p>
            </div>
            <span className="text-white/40 text-lg">›</span>
          </div>
        </button>
      </div>

    </section>
  );
};

export default WalletSection;

