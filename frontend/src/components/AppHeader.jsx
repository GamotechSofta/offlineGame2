import React from 'react';
import { useNavigate, Link } from 'react-router-dom';

const AppHeader = () => {
  const navigate = useNavigate();

  return (
    <div className="w-full bg-black px-4 sm:px-6 py-3 sm:py-4">
      <div className="flex items-center justify-between gap-2">
        {/* Hamburger Menu */}
        <div className="w-10 h-10 shrink-0 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-700 transition-colors">
          <div className="flex flex-col gap-1.5">
            <div className="w-5 h-0.5 bg-white"></div>
            <div className="w-4 h-0.5 bg-white"></div>
            <div className="w-3 h-0.5 bg-white"></div>
          </div>
        </div>

        {/* Logo with Star - click goes to home on all screen sizes */}
        <Link
          to="/"
          className="flex items-center gap-1 relative min-w-0 flex-1 justify-center cursor-pointer hover:opacity-90 transition-opacity"
        >
          <h1 className="text-yellow-500 text-xl sm:text-2xl font-bold lowercase relative">
            logoipsum
            <span className="absolute bottom-0 left-0 w-12 h-0.5 bg-yellow-500"></span>
            <span className="absolute bottom-0 right-0 w-10 h-0.5 bg-yellow-500"></span>
            <svg className="absolute -top-1 right-2 w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </h1>
        </Link>

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

        {/* Wallet - desktop only: same icon as points card, show amount */}
        <button
          onClick={() => navigate('/bank')}
          className="hidden md:flex shrink-0 items-center gap-2 rounded-lg bg-[#202124] border border-white/5 px-3 py-2 hover:bg-[#2a2b2e] transition-colors"
        >
          <img
            src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769780438/Untitled_90_x_160_px_1080_x_1080_px_ychsx6.png"
            alt="Wallet"
            className="w-8 h-8 object-contain"
          />
          <span className="text-base font-bold text-white">2,853</span>
        </button>

        {/* Notification Bell with Red Dot */}
        <div className="w-10 h-10 shrink-0 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-700 transition-colors relative">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></div>
        </div>
      </div>
    </div>
  );
};

export default AppHeader;
