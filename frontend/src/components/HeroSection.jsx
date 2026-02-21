import React from 'react';
import { useNavigate } from 'react-router-dom';

const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="w-full bg-white py-10 sm:py-14 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto text-center">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 tracking-tight">
          RATAN 365
        </h1>
        <p className="mt-3 text-gray-600 text-base sm:text-lg">
          Your trusted matka gaming platform.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => navigate('/bidoptions')}
            className="w-full sm:w-auto px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
          >
            Start Playing
          </button>
          <button
            onClick={() => navigate('/funds?tab=add-fund')}
            className="w-full sm:w-auto px-6 py-3 bg-gray-100 text-gray-800 font-semibold rounded-lg hover:bg-gray-200 transition-colors border border-gray-200"
          >
            Add Funds
          </button>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
