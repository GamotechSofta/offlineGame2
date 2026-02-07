import React from 'react';
import WalletSection from '../components/WalletSection';
import HeroSection from '../components/HeroSection';
import LatestNews from '../components/LatestNews';
import Section1 from '../components/Section1';

const Home = () => {
  return (
    <div className="min-h-screen min-h-ios-screen bg-[#0a0a0a] w-full max-w-full overflow-x-hidden">
      {/* Mobile View - WalletSection */}
      <div className="md:hidden">
        <WalletSection />
      </div>
      
      {/* Hero Section - Shows on both mobile and desktop */}
      <HeroSection />
      
      {/* Latest News */}
      <LatestNews />
      
      {/* Section1 - Shows on both mobile and desktop */}
      <Section1 />
    </div>
  );
};

export default Home;
