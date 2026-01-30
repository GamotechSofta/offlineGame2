import React from 'react';
import { useNavigate } from 'react-router-dom';

const WalletSection = () => {
  const navigate = useNavigate();

  return (
    <section className="w-full bg-black py-6 sm:py-10 px-4 sm:px-6">
      {/* Top Navigation Bar - Download App in header for all views */}
      <div className="flex items-center justify-between gap-2 mb-6">
        {/* Hamburger Menu */}
        <div className="w-10 h-10 shrink-0 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-700 transition-colors">
          <div className="flex flex-col gap-1.5">
            <div className="w-5 h-0.5 bg-white"></div>
            <div className="w-4 h-0.5 bg-white"></div>
            <div className="w-3 h-0.5 bg-white"></div>
          </div>
        </div>

        {/* Logo with Star */}
        <div className="flex items-center gap-1 relative min-w-0 flex-1 justify-center">
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

        {/* Download App - in header */}
        <button
          onClick={() => navigate('/download')}
          className="shrink-0 rounded-lg sm:rounded-xl bg-[#f3b61b] px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-black shadow-[0_4px_12px_rgba(243,182,27,0.35)] hover:bg-[#e5a914] transition-colors flex items-center gap-1.5"
        >
          <svg className="w-4 h-4 sm:w-4.5 sm:h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>Download App</span>
        </button>

        {/* Notification Bell with Red Dot */}
        <div className="w-10 h-10 shrink-0 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-700 transition-colors relative">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {/* Red Notification Dot */}
          <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></div>
        </div>
      </div>

      {/* Available Points Balance Card */}
      {/* Available Points Balance Card */}
      {/* Available Points Balance Card */}
      <div className="relative w-full max-w-lg mx-auto mb-8">
        {/* Main Card */}
        <div className="relative bg-[#202124] rounded-3xl px-5 pt-3 pb-6 sm:px-6 sm:pt-4 sm:pb-8 shadow-2xl border border-white/5 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Wallet Icon - Cleaner CSS Illustration */}
              <img
                src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769766330/Untitled_90_x_160_px_1080_x_1080_px_1_1_vrybhs.png"
                alt="Wallet Icon"
                className="w-16 h-16 object-contain shrink-0"
              />

              <div className="flex flex-col gap-0.5">
                <h2 className="text-2xl sm:text-3xl leading-none font-bold text-white tracking-tight font-sans">2,853</h2>
                <p className="text-gray-400 text-sm font-light tracking-wide">Available Points Balance</p>
              </div>
            </div>

            {/* Add Money Button */}
            <button
              type="button"
              className="group relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-white overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#202124]"
              aria-label="Add Money"
            >
              {/* Background gradient */}
              <span className="absolute inset-0 bg-gradient-to-br from-[#25d366] via-[#20bd5a] to-[#1a9e47] rounded-full" />
              {/* Shine overlay */}
              <span className="absolute inset-0 rounded-full bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-80" />
              {/* Shadow / depth */}
              <span className="absolute inset-0 rounded-full shadow-[0_4px_20px_rgba(37,211,102,0.45),inset_0_1px_0_rgba(255,255,255,0.2)] group-hover:shadow-[0_6px_28px_rgba(37,211,102,0.55),inset_0_1px_0_rgba(255,255,255,0.25)] transition-shadow duration-300" />
              {/* Icon: Rupee + Plus */}
              <span className="relative flex items-center justify-center gap-0.5">
                <span className="text-xl sm:text-2xl font-bold drop-shadow-sm">₹</span>
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M19 12H5" />
                </svg>
              </span>
            </button>
          </div>
        </div>

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
          src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769709356/Black_and_White_Minimalist_Casino_Night_Facebook_Cover_1920_x_600_mm_iocl92.png"
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

