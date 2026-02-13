import React, { useEffect, useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { useHeartbeat } from '../hooks/useHeartbeat';
import AppHeader from '../components/AppHeader';
import BottomNavbar from '../components/BottomNavbar';
import Home from '../pages/Home';
import BidOptions from '../pages/BidOptions';
import GameBid from '../pages/GameBid/index';
import Bank from '../pages/Bank';
import Funds from '../pages/Funds';
import Download from '../pages/Download';
import Login from '../pages/Login';
import Passbook from '../pages/Passbook';
import SupportLanding from '../pages/Support/SupportLanding';
import SupportNew from '../pages/Support/SupportNew';
import SupportStatus from '../pages/Support/SupportStatus';
import Bids from '../pages/Bids';
import Profile from '../pages/Profile';
import BetHistory from '../pages/BetHistory';
import MarketResultHistory from '../pages/MarketResultHistory';
import TopWinners from '../pages/TopWinners';

// Scroll to top on route change
const ScrollToTop = () => {
  const { pathname } = useLocation();
  const prevPathRef = useRef(null);

  useEffect(() => {
    // Store previous pathname for "Back" buttons that shouldn't step through in-page state.
    try {
      if (prevPathRef.current) {
        sessionStorage.setItem('prevPathname', prevPathRef.current);
      }
    } catch (_) {}
    prevPathRef.current = pathname;

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
const PUBLIC_PATHS = ['/login'];

const Layout = ({ children }) => {
  const location = useLocation();
  const [hasUser, setHasUser] = useState(() => !!localStorage.getItem('user'));
  const isLoginPage = location.pathname === '/login';
  const isHomePage = location.pathname === '/';

  useEffect(() => {
    const check = () => setHasUser(!!localStorage.getItem('user'));
    window.addEventListener('userLogin', check);
    window.addEventListener('userLogout', check);
    return () => {
      window.removeEventListener('userLogin', check);
      window.removeEventListener('userLogout', check);
    };
  }, []);

  const isPublicPath = PUBLIC_PATHS.includes(location.pathname);
  if (!hasUser && !isPublicPath) {
    return <Navigate to="/login" replace />;
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  // Same header (logoipsum, Download App, bell) for all pages - mobile-style
  if (isHomePage) {
    return (
      <div className="min-h-screen min-h-ios-screen pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:pb-0 bg-black w-full">
        <AppHeader />
        <div className="pt-[calc(56px+env(safe-area-inset-top,0px))] sm:pt-[calc(52px+env(safe-area-inset-top,0px))] md:pt-[calc(56px+env(safe-area-inset-top,0px))]">
          {children}
        </div>
        <BottomNavbar />
      </div>
    );
  }

  const isBidPage = location.pathname.includes('game-bid') || location.pathname === '/bidoptions';
  const isSupportPage =
    location.pathname === '/support' ||
    location.pathname === '/support/new' ||
    location.pathname === '/support/status';
  const isDarkPage =
    isBidPage ||
    location.pathname === '/bids' ||
    location.pathname === '/bank' ||
    location.pathname === '/funds' ||
    location.pathname === '/passbook' ||
    location.pathname === '/download' ||
    location.pathname === '/profile' ||
    location.pathname === '/bet-history' ||
    location.pathname === '/market-result-history' ||
    isSupportPage;
  const isBetsPage = location.pathname === '/bids';
  const isHistoryPage =
    location.pathname === '/bet-history' || location.pathname === '/market-result-history';

  return (
    <div className={`min-h-screen min-h-ios-screen pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:pb-0 w-full max-w-full overflow-x-hidden ${isDarkPage ? 'bg-black' : 'bg-gray-50'}`}>
      <AppHeader />
      {/* Reduce mobile top-gap under fixed header */}
      {/* Desktop: ensure no overlap under fixed header */}
      <div
        className={
          isBidPage
            ? 'pt-[calc(52px+env(safe-area-inset-top,0px))] sm:pt-[calc(68px+env(safe-area-inset-top,0px))] md:pt-[calc(70px+env(safe-area-inset-top,0px))]'
            : ((isBetsPage || isHistoryPage) ? 'pt-[calc(72px+env(safe-area-inset-top,0px))] sm:pt-[calc(76px+env(safe-area-inset-top,0px))] md:pt-[calc(88px+env(safe-area-inset-top,0px))]' : 'pt-[calc(56px+env(safe-area-inset-top,0px))] sm:pt-[calc(68px+env(safe-area-inset-top,0px))] md:pt-[calc(72px+env(safe-area-inset-top,0px))]')
        }
      >
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
          <Route path="/support" element={<SupportLanding />} />
          <Route path="/support/new" element={<SupportNew />} />
          <Route path="/support/status" element={<SupportStatus />} />
          <Route path="/login" element={<Login />} />
          <Route path="/bids" element={<Bids />} />
          <Route path="/bet-history" element={<BetHistory />} />
          <Route path="/market-result-history" element={<MarketResultHistory />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/top-winners" element={<TopWinners />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default AppRoutes;

