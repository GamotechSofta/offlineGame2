import React, { useState } from 'react';

const Login = () => {
  const [phoneNumber, setPhoneNumber] = useState('92265 58519');
  const [isAbove18, setIsAbove18] = useState(true);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col px-4 py-6 sm:py-8 relative overflow-hidden">
      <div className="relative z-10 w-full flex flex-col items-center justify-center flex-1">
        {/* Image - Full width */}
        <div className="w-full mb-6 flex justify-center">
          <img 
            src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769708293/Untitled_1080_x_1080_px_1080_x_1080_px_2_zsih9r.svg"
            alt="Login illustration"
            className="w-full max-w-sm h-auto"
          />
        </div>

        {/* LOG IN & SIGN UP Banner with gold outline */}
        <div className="w-full mb-3">
          <div className="bg-gray-800 border-2 border-yellow-500 rounded-full px-6 py-3 text-center">
            <h3 className="text-white text-xl sm:text-2xl font-bold uppercase">
              LOG IN & SIGN UP
            </h3>
          </div>
        </div>
        
        {/* Sub-heading */}
        <p className="text-gray-300 text-sm sm:text-base text-center mb-6 w-full">
          Enter The Realm Of Luck & Life-Changing Wins
        </p>

        {/* Middle Section - Login/Signup */}
        <div className="w-full max-w-md">

          {/* Phone Number Input */}
          <div className="mb-4">
            <div className="bg-gray-800 rounded-lg flex items-center p-3">
              {/* Country Code Selector */}
              <div className="flex items-center gap-2 px-2 border-r border-gray-700 pr-3">
                <span className="text-xl">🇮🇳</span>
                <span className="text-white text-sm font-medium">+91</span>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              
              {/* Phone Number */}
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="flex-1 bg-transparent text-white text-sm sm:text-base ml-3 outline-none"
                placeholder="Enter phone number"
              />
            </div>
          </div>

          {/* Checkbox */}
          <div className="mb-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={isAbove18}
                  onChange={(e) => setIsAbove18(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                  isAbove18 ? 'bg-green-500 border-green-500' : 'border-gray-600'
                }`}>
                  {isAbove18 && (
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-white text-sm">Yes, I Am Above 18 Years</span>
            </label>
          </div>

          {/* SEND OTP Button */}
          <button className="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 text-white font-bold py-3 sm:py-4 rounded-lg mb-4 hover:from-yellow-700 hover:to-yellow-600 transition-colors text-sm sm:text-base uppercase">
            SEND OTP
          </button>

          {/* Separator */}
          <div className="flex items-center justify-center mb-4">
            <span className="text-gray-400 text-sm">Or</span>
          </div>

          {/* Social Login Buttons */}
          <div className="flex gap-3 mb-6">
            {/* Google Button */}
            <button className="flex-1 bg-white text-black font-semibold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors">
              <div className="relative w-6 h-6">
                <svg viewBox="0 0 24 24" className="w-6 h-6">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </div>
              <span className="text-sm font-bold">GOOGLE</span>
            </button>
            
            {/* Telegram Button */}
            <button className="flex-1 bg-blue-500 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.568 8.16l-1.473 6.934c-.11.491-.405.613-.82.38l-2.265-1.67-1.095 1.053c-.125.125-.23.23-.472.23l.168-2.38 4.19-3.785c.183-.162-.04-.252-.283-.09l-5.18 3.265-2.23-.695c-.485-.15-.496-.485.101-.72l8.74-3.37c.404-.15.758.09.627.57z"/>
              </svg>
              <span className="text-sm font-bold">TELEGRAM</span>
            </button>
          </div>
        </div>

        {/* Bottom Legal Text */}
        <div className="mt-auto pb-4 text-center w-full">
          <p className="text-gray-500 text-xs">
            By Continuing, You Agree To Our{' '}
            <span className="underline text-gray-400 cursor-pointer">Terms Of Use</span>
            {' '}&{' '}
            <span className="underline text-gray-400 cursor-pointer">Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
