import React from 'react';

const WalletSection = () => {
  return (
    <section className="w-full bg-black py-4 sm:py-6 px-3 sm:px-4">
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
      <div className="bg-gray-800 rounded-lg p-4 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Wallet Icon with Green Bills */}
          <div className="relative w-12 h-12 sm:w-14 sm:h-14">
            <div className="w-full h-full bg-purple-600 rounded-lg flex items-center justify-center">
              <svg className="w-7 h-7 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            {/* Green Bills Sticking Out */}
            <div className="absolute -top-1 -right-1 w-3 h-4 bg-green-500 rounded-sm transform rotate-12"></div>
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-3.5 bg-green-400 rounded-sm transform rotate-6"></div>
          </div>
          
          {/* Balance Info */}
          <div>
            <p className="text-white text-2xl sm:text-3xl font-bold">2,853</p>
            <p className="text-gray-400 text-xs sm:text-sm">Available Points Balance</p>
          </div>
        </div>
        
        {/* Add Button */}
        <button className="w-10 h-10 sm:w-12 sm:h-12 bg-green-500 rounded-full flex items-center justify-center hover:bg-green-600 transition-colors">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Withdraw Button with Gold Border */}
      <button className="w-full bg-gray-800 border-2 border-yellow-500 rounded-lg p-4 mb-6 flex items-center justify-center gap-3 hover:bg-gray-700 transition-colors">
        <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center">
          <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <span className="text-yellow-500 font-semibold text-sm sm:text-base uppercase">WITHDRAW</span>
      </button>

      {/* Game Categories */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* STARTLINE Card */}
        <div className="bg-gray-800 rounded-lg p-4 flex flex-col items-center cursor-pointer hover:bg-gray-700 transition-colors relative">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-yellow-500 rounded-lg flex items-center justify-center mb-3">
            <svg className="w-7 h-7 sm:w-8 sm:h-8 text-black" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </div>
          <span className="text-white font-semibold text-sm sm:text-base uppercase text-center mb-2">STARTLINE</span>
          <svg className="w-5 h-5 text-gray-400 absolute top-4 right-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </div>

        {/* GALI-DISAWAR Card */}
        <div className="bg-gray-800 rounded-lg p-4 flex flex-col items-center cursor-pointer hover:bg-gray-700 transition-colors relative">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-lg flex items-center justify-center mb-3 p-2">
            {/* Single Dice Icon */}
            <svg className="w-full h-full" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="2" fill="white" stroke="#e5e7eb" strokeWidth="1"/>
              <circle cx="7" cy="7" r="1.5" fill="#dc2626"/>
              <circle cx="12" cy="7" r="1.5" fill="#dc2626"/>
              <circle cx="17" cy="7" r="1.5" fill="#dc2626"/>
              <circle cx="7" cy="12" r="1.5" fill="#dc2626"/>
              <circle cx="12" cy="12" r="1.5" fill="#dc2626"/>
              <circle cx="17" cy="12" r="1.5" fill="#dc2626"/>
              <circle cx="7" cy="17" r="1.5" fill="#dc2626"/>
              <circle cx="12" cy="17" r="1.5" fill="#dc2626"/>
              <circle cx="17" cy="17" r="1.5" fill="#dc2626"/>
            </svg>
          </div>
          <span className="text-white font-semibold text-sm sm:text-base uppercase text-center mb-2">GALI-DISAWAR</span>
          <svg className="w-5 h-5 text-gray-400 absolute top-4 right-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </section>
  );
};

export default WalletSection;
