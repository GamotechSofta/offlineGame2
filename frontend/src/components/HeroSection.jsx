import React from 'react';
import { useNavigate } from 'react-router-dom';

const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="w-full bg-gradient-to-br from-orange-50 via-white to-orange-50 py-8 sm:py-12 md:py-16 px-4 sm:px-6 md:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Desktop Hero Section */}
        <div className="hidden md:flex items-center justify-between gap-8">
          {/* Left Content */}
          <div className="flex-1 space-y-6">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-gray-800 leading-tight">
                Welcome to{' '}
                <span className="text-orange-500 underline decoration-orange-500 decoration-4 underline-offset-4">
                  RATAN 365
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-gray-600 font-semibold">
                Your Trusted Matka Gaming Platform
              </p>
              <p className="text-base md:text-lg text-gray-600 leading-relaxed max-w-2xl">
                Experience the thrill of online matka gaming with secure betting, instant results, and exciting rewards. 
                Play with confidence on India's most trusted gaming platform.
              </p>
            </div>
            
            {/* Features */}
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-800">Secure & Safe</p>
                  <p className="text-sm text-gray-600">100% Secure Transactions</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-800">Instant Results</p>
                  <p className="text-sm text-gray-600">Quick Payouts & Results</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-800">Best Rates</p>
                  <p className="text-sm text-gray-600">Competitive Payout Rates</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-800">24/7 Support</p>
                  <p className="text-sm text-gray-600">Round the Clock Assistance</p>
                </div>
              </div>
            </div>
            
            {/* CTA Buttons */}
            <div className="flex items-center gap-4 pt-4">
              <button
                onClick={() => navigate('/bidoptions')}
                className="px-6 py-3 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 transition-colors shadow-lg hover:shadow-xl"
              >
                Start Playing
              </button>
              <button
                onClick={() => navigate('/funds?tab=add-fund')}
                className="px-6 py-3 bg-white border-2 border-orange-500 text-orange-500 font-bold rounded-lg hover:bg-orange-50 transition-colors"
              >
                Add Funds
              </button>
            </div>
          </div>
          
          {/* Right Image/Illustration */}
          <div className="flex-1 flex items-center justify-center">
            <div className="relative w-full max-w-md">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-200 to-orange-100 rounded-3xl transform rotate-6 opacity-20"></div>
              <div className="relative bg-white border-4 border-orange-200 rounded-3xl p-8 shadow-2xl">
                <div className="text-center space-y-4">
                  <div className="w-24 h-24 mx-auto bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-4xl font-black text-white">365</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800">RATAN 365</h3>
                  <p className="text-gray-600">Play. Win. Enjoy.</p>
                  <div className="flex items-center justify-center gap-2 pt-4">
                    <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
                    <span className="text-sm text-gray-600">Live Markets</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Mobile Hero Section */}
        <div className="md:hidden space-y-6">
          <div className="text-center space-y-4">
            <h1 className="text-3xl sm:text-4xl font-black text-gray-800 leading-tight">
              Welcome to{' '}
              <span className="text-orange-500 underline decoration-orange-500 decoration-4 underline-offset-4">
                RATAN 365
              </span>
            </h1>
            <p className="text-lg text-gray-600 font-semibold">
              Your Trusted Matka Gaming Platform
            </p>
            <p className="text-sm text-gray-600 leading-relaxed px-4">
              Experience the thrill of online matka gaming with secure betting, instant results, and exciting rewards.
            </p>
          </div>
          
          {/* Features Grid */}
          <div className="grid grid-cols-2 gap-3 pt-4">
            <div className="bg-white border-2 border-orange-200 rounded-lg p-3 text-center">
              <div className="w-12 h-12 mx-auto mb-2 rounded-lg bg-orange-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <p className="font-semibold text-gray-800 text-xs">Secure</p>
            </div>
            
            <div className="bg-white border-2 border-orange-200 rounded-lg p-3 text-center">
              <div className="w-12 h-12 mx-auto mb-2 rounded-lg bg-orange-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <p className="font-semibold text-gray-800 text-xs">Instant</p>
            </div>
            
            <div className="bg-white border-2 border-orange-200 rounded-lg p-3 text-center">
              <div className="w-12 h-12 mx-auto mb-2 rounded-lg bg-orange-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="font-semibold text-gray-800 text-xs">Best Rates</p>
            </div>
            
            <div className="bg-white border-2 border-orange-200 rounded-lg p-3 text-center">
              <div className="w-12 h-12 mx-auto mb-2 rounded-lg bg-orange-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <p className="font-semibold text-gray-800 text-xs">24/7 Support</p>
            </div>
          </div>
          
          {/* CTA Buttons */}
          <div className="flex flex-col gap-3 pt-4">
            <button
              onClick={() => navigate('/bidoptions')}
              className="w-full px-6 py-3 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 transition-colors shadow-lg"
            >
              Start Playing
            </button>
            <button
              onClick={() => navigate('/funds?tab=add-fund')}
              className="w-full px-6 py-3 bg-white border-2 border-orange-500 text-orange-500 font-bold rounded-lg hover:bg-orange-50 transition-colors"
            >
              Add Funds
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
