import React from 'react';
import { useNavigate } from 'react-router-dom';
import HeroSection from '../components/HeroSection';
import Section1 from '../components/Section1';

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen min-h-ios-screen bg-gray-200 w-full max-w-full overflow-x-hidden">
      <HeroSection />
      {/* Roulette game banner - under hero */}
      <section className="w-full max-w-full px-3 sm:px-4 mb-4">
        <button
          type="button"
          onClick={() => navigate('/roulette')}
          className="w-full flex items-center justify-between gap-3 py-3 px-4 rounded-xl bg-gradient-to-r from-[#166534] to-[#14532d] border border-amber-500/60 text-white shadow-lg hover:from-[#15803d] hover:to-[#166534] active:scale-[0.99] transition-all"
        >
          <span className="flex items-center gap-2">
            <span className="w-10 h-10 rounded-full bg-amber-500/30 flex items-center justify-center text-xl" aria-hidden>🎡</span>
            <span className="text-left">
              <span className="block font-bold text-sm sm:text-base">Play Roulette</span>
              <span className="block text-xs text-emerald-200/90">Spin the wheel & place your bets</span>
            </span>
          </span>
          <span className="text-amber-300 shrink-0">→</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/lottery')}
          className="mt-3 w-full flex items-center justify-between gap-3 py-3 px-4 rounded-xl bg-gradient-to-r from-[#6b1f1f] to-[#7f1d1d] border border-rose-300/60 text-white shadow-lg hover:from-[#7f1d1d] hover:to-[#991b1b] active:scale-[0.99] transition-all"
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
