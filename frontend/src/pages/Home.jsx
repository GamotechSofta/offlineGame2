import React from 'react';
import { useNavigate } from 'react-router-dom';
import HeroSection from '../components/HeroSection';
import Section1 from '../components/Section1';

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen min-h-ios-screen bg-gray-200 w-full max-w-full overflow-x-hidden">
      <HeroSection />
      <section className="w-full max-w-full px-3 sm:px-4 mb-4">
        <button
          type="button"
          onClick={() => navigate('/lottery')}
          className="w-full flex items-center justify-between gap-3 py-3 px-4 rounded-xl bg-gradient-to-r from-[#6b1f1f] to-[#7f1d1d] border border-rose-300/60 text-white shadow-lg hover:from-[#7f1d1d] hover:to-[#991b1b] active:scale-[0.99] transition-all"
        >
          <span className="flex items-center gap-2">
            <span className="w-10 h-10 rounded-full bg-rose-400/30 flex items-center justify-center text-xl" aria-hidden>🎟️</span>
            <span className="text-left">
              <span className="block font-bold text-sm sm:text-base">Lottery</span>
              <span className="block text-xs text-rose-100/90">Open lottery dashboard</span>
            </span>
          </span>
          <span className="text-rose-200 shrink-0">→</span>
        </button>
      </section>
      <Section1 />
    </div>
  );
};

export default Home;
