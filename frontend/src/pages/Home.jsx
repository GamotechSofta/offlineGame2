import React from 'react';
import WalletSection from '../components/WalletSection';
import HeroSection from '../components/HeroSection';
import LatestNews from '../components/LatestNews';
import Section1 from '../components/Section1';

const Home = () => {
  return (
    <div className="min-h-screen bg-black md:bg-gray-50">
      {/* Mobile View - WalletSection */}
      <div className="md:hidden">
        <WalletSection />
      </div>
      
      {/* Desktop View - HeroSection */}
      <div className="hidden md:block">
        <HeroSection />
        <LatestNews />
      </div>
      
      {/* Mobile View - LatestNews after WalletSection */}
      <div className="md:hidden">
        <LatestNews />
      </div>
      
      {/* Section1 - Shows on both mobile and desktop */}
      <Section1 />
    </div>
  );
};

export default Home;
