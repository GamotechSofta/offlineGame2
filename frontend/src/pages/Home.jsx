import React from 'react';
import WalletSection from '../components/WalletSection';
import HeroSection from '../components/HeroSection';
import Section1 from '../components/Section1';

const Home = () => {
  return (
    <div className="min-h-screen min-h-ios-screen bg-white w-full max-w-full overflow-x-hidden">
      {/* Mobile View - WalletSection */}
      <div className="md:hidden">
        <WalletSection />
      </div>
      
      {/* Hero Section - Site Information */}
      <HeroSection />
      
      {/* Section1 - Shows on both mobile and desktop */}
      <Section1 />
    </div>
  );
};

export default Home;
