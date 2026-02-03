import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useHeartbeat } from '../hooks/useHeartbeat';
import AppHeader from '../components/AppHeader';
import Header from '../components/Header';
import BottomNavbar from '../components/BottomNavbar';
import Home from '../pages/Home';
import BidOptions from '../pages/BidOptions';
import GameBid from '../pages/GameBid/index';
import Bank from '../pages/Bank';
import Funds from '../pages/Funds';
import Download from '../pages/Download';
import Login from '../pages/Login';
import Passbook from '../pages/Passbook';
import Support from '../pages/Support';
import Bids from '../pages/Bids';

// Scroll to top on route change
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM has updated, then scroll
    const scrollToTop = () => {
      // Scroll window and document elements
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
      
      // Scroll any scrollable containers (with a small delay to catch dynamically rendered ones)
      setTimeout(() => {
        const scrollableElements = document.querySelectorAll('[class*="overflow-y-auto"], [class*="overflow-y-scroll"], [class*="overflow-auto"]');
        scrollableElements.forEach((el) => {
          if (el.scrollTop > 0) {
            el.scrollTop = 0;
          }
        });
      }, 10);
    };

    // Immediate scroll
    scrollToTop();
    
    // Also scroll after a short delay to catch any late-rendering containers
    const timer = setTimeout(scrollToTop, 50);

    return () => clearTimeout(timer);
  }, [pathname]);

  return null;
};
const Layout = ({ children }) => {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';
  const isHomePage = location.pathname === '/';

  if (isLoginPage) {
    return <>{children}</>;
  }

  // Same header (logoipsum, Download App, bell) for all pages - mobile-style
  if (isHomePage) {
    return (
      <div className="min-h-screen pb-16 md:pb-0 bg-black">
        <AppHeader />
        <Header />
        <div className="pt-[100px] sm:pt-[110px] md:pt-[125px]">
          {children}
        </div>
        <BottomNavbar />
      </div>
    );
  }

  const isBidPage = location.pathname.includes('game-bid') || location.pathname === '/bidoptions';

  return (
    <div className={`min-h-screen pb-16 md:pb-0 w-full max-w-full overflow-x-hidden ${isBidPage ? 'bg-black' : 'bg-gray-50'}`}>
      <AppHeader />
      <div className="pt-[60px] sm:pt-[68px] md:pt-[80px]">
        {children}
      </div>
      <BottomNavbar />
    </div>
  );
};

const AppRoutes = () => {
  useHeartbeat();
  return (
    <Router>
      <ScrollToTop />
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/bidoptions" element={<BidOptions />} />
          <Route path="/game-bid" element={<GameBid />} />
          <Route path="/bank" element={<Bank />} />
          <Route path="/funds" element={<Funds />} />
          <Route path="/download" element={<Download />} />
          <Route path="/passbook" element={<Passbook />} />
          <Route path="/support" element={<Support />} />
          <Route path="/login" element={<Login />} />
          <Route path="/bids" element={<Bids />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default AppRoutes;

