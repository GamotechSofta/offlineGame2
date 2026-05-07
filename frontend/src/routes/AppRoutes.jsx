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
import Signup from '../pages/Signup';
import Passbook from '../pages/Passbook';
import SupportLanding from '../pages/Support/SupportLanding';
import SupportNew from '../pages/Support/SupportNew';
import SupportStatus from '../pages/Support/SupportStatus';
import Bids from '../pages/Bids';
import Profile from '../pages/Profile';
import BetHistory from '../pages/BetHistory';
import MarketResultHistory from '../pages/MarketResultHistory';
import TopWinners from '../pages/TopWinners';
import GameRate from '../pages/GameRate';
import LotteryDashboard from '../components/lottery/2d-lottery/LotteryDashboard';
import ThreeDGame from '../components/lottery/3d-lottery/ThreeDGame';
import LotteryQuizPage from '../pages/LotteryQuizPage';
import ThreeDQuizPage from '../pages/ThreeDQuizPage';
import GamesHub from '../pages/GamesHub';
import { API_BASE_URL } from '../config/api';
import { clearCurrentUser, getCurrentUser, setCurrentUser } from '../session/userSession';

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
// Only /login is accessible without being logged in; all other routes redirect to login
const PUBLIC_PATHS = ['/login', '/signup'];

const Layout = ({ children }) => {
  const location = useLocation();
  const isTwoDGamePage = location.pathname === '/lottery';
  const isThreeDGamePage = location.pathname === '/lottery/3d';
  const isLotteryQuizPage = location.pathname === '/lottery/quiz';
  const isThreeDQuizPage = location.pathname === '/lottery/3d/quiz';
  const isLotteryFullScreenPage = isTwoDGamePage || isThreeDGamePage || isLotteryQuizPage || isThreeDQuizPage;
  const [hasUser, setHasUser] = useState(null);
  const isLoginPage = location.pathname === '/login' || location.pathname === '/signup';
  const isHomePage = location.pathname === '/';
  const [showPortraitPrompt, setShowPortraitPrompt] = useState(false);

  useEffect(() => {
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!viewportMeta) return undefined;

    const zoomEnabledContent =
      'width=device-width, initial-scale=1.0, maximum-scale=10.0, user-scalable=yes, viewport-fit=cover';

    const getFullscreenElement = () =>
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement ||
      null;

    const applyViewport = () => {
      const isLottery2d3d = isTwoDGamePage || isThreeDGamePage || isLotteryQuizPage || isThreeDQuizPage;
      const rootEl = document.documentElement;
      const bodyEl = document.body;
      const setZoomClass = (enabled) => {
        if (!bodyEl) return;
        if (enabled) bodyEl.classList.add('lottery-mobile-zoom-enabled');
        else bodyEl.classList.remove('lottery-mobile-zoom-enabled');
      };

      const enablePinchGesture = () => {
        if (rootEl) {
          rootEl.style.setProperty('touch-action', 'pinch-zoom');
          rootEl.style.setProperty('-ms-touch-action', 'pinch-zoom');
        }
        if (bodyEl) {
          bodyEl.style.setProperty('touch-action', 'pinch-zoom');
          bodyEl.style.setProperty('-ms-touch-action', 'pinch-zoom');
        }
      };

      const resetPinchGesture = () => {
        if (rootEl) {
          rootEl.style.removeProperty('touch-action');
          rootEl.style.removeProperty('-ms-touch-action');
        }
        if (bodyEl) {
          bodyEl.style.removeProperty('touch-action');
          bodyEl.style.removeProperty('-ms-touch-action');
        }
      };

      // Keep pinch zoom always enabled on lottery 2D/3D pages.
      if (isLottery2d3d) {
        viewportMeta.setAttribute('content', zoomEnabledContent);
        enablePinchGesture();
        setZoomClass(true);
        return;
      }
      viewportMeta.setAttribute('content', zoomEnabledContent);
      resetPinchGesture();
      setZoomClass(false);
    };

    applyViewport();

    const onFs = () => applyViewport();
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
    document.addEventListener('mozfullscreenchange', onFs);
    document.addEventListener('MSFullscreenChange', onFs);

    const onViewportHint = () => applyViewport();
    window.addEventListener('orientationchange', onViewportHint);

    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('webkitfullscreenchange', onFs);
      document.removeEventListener('mozfullscreenchange', onFs);
      document.removeEventListener('MSFullscreenChange', onFs);
      window.removeEventListener('orientationchange', onViewportHint);
      document.documentElement?.style.removeProperty('touch-action');
      document.documentElement?.style.removeProperty('-ms-touch-action');
      document.body?.style.removeProperty('touch-action');
      document.body?.style.removeProperty('-ms-touch-action');
      document.body?.classList.remove('lottery-mobile-zoom-enabled');
      viewportMeta.setAttribute('content', zoomEnabledContent);
    };
  }, [isTwoDGamePage, isThreeDGamePage, isLotteryQuizPage, isThreeDQuizPage]);

  useEffect(() => {
    const check = async () => {
      const user = getCurrentUser();
      if (user && (user.id || user._id)) {
        setHasUser(true);
        return;
      }

      try {
        const res = await fetch(`${API_BASE_URL}/users/me`, { credentials: 'include' });
        const data = await res.json();
        if (res.ok && data?.success && data?.data) {
          const existingUser = getCurrentUser() || {};
          setCurrentUser({
            ...existingUser,
            ...data.data,
            token: existingUser?.token || 'cookie-auth',
          }, { emitEvent: false });
          setHasUser(true);
          return;
        }
      } catch (_) {
        // ignore network check error and mark as logged out
      }
      clearCurrentUser({ emitEvent: false });
      setHasUser(false);
    };

    check();
    window.addEventListener('userLogin', check);
    window.addEventListener('userLogout', check);
    return () => {
      window.removeEventListener('userLogin', check);
      window.removeEventListener('userLogout', check);
    };
  }, []);

  useEffect(() => {
    if (isLotteryFullScreenPage) return;
    const releaseFullscreenAndRotatePortrait = async () => {
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        }
      } catch (_) {
        // Ignore if browser blocks fullscreen exit.
      }

      try {
        if (window.screen?.orientation?.unlock) {
          window.screen.orientation.unlock();
        }
        if (window.screen?.orientation?.lock) {
          await window.screen.orientation.lock('portrait');
        }
      } catch (_) {
        // Not supported on all mobile browsers/devices.
      }
    };
    releaseFullscreenAndRotatePortrait();
  }, [isLotteryFullScreenPage, location.pathname]);

  useEffect(() => {
    const checkPortraitNeed = () => {
      const isMobile = window.innerWidth <= 900;
      const isLandscape = window.innerWidth > window.innerHeight;
      setShowPortraitPrompt(!isLotteryFullScreenPage && !isLoginPage && isMobile && isLandscape);
    };
    checkPortraitNeed();
    window.addEventListener('resize', checkPortraitNeed);
    window.addEventListener('orientationchange', checkPortraitNeed);
    return () => {
      window.removeEventListener('resize', checkPortraitNeed);
      window.removeEventListener('orientationchange', checkPortraitNeed);
    };
  }, [isLoginPage, isLotteryFullScreenPage, location.pathname]);

  const handleRotatePortrait = async () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (_) {}

    try {
      if (window.screen?.orientation?.unlock) {
        window.screen.orientation.unlock();
      }
      if (window.screen?.orientation?.lock) {
        await window.screen.orientation.lock('portrait');
      }
    } catch (_) {
      // Some browsers require manual device rotation.
    }
  };

  const portraitPromptOverlay = showPortraitPrompt ? (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-sm rounded border border-[#3b3b3b] bg-[#111] p-4 text-center text-white">
        <h3 className="mb-2 text-lg font-semibold">Rotate Screen</h3>
        <p className="mb-4 text-sm text-gray-300">
          This screen works best in portrait mode.
          Please rotate your phone vertically.
        </p>
        <button
          type="button"
          onClick={handleRotatePortrait}
          className="h-10 w-full rounded border border-[#2563eb] bg-[#3b82f6] font-semibold"
        >
          Switch to Portrait
        </button>
      </div>
    </div>
  ) : null;

  // Unauthenticated: redirect to login (first visit or after logout)
  const isPublicPath = PUBLIC_PATHS.includes(location.pathname);
  if (hasUser === null) {
    return null;
  }
  if (!hasUser && !isPublicPath) {
    return <Navigate to="/login" replace />;
  }

  if (isLoginPage) {
    return (
      <>
        {children}
        {portraitPromptOverlay}
      </>
    );
  }

  // Lottery: full-screen, no header or navbar
  if (
    isLotteryFullScreenPage
  ) {
    return <>{children}</>;
  }

  // Same header (logoipsum, Download App, bell) for all pages - mobile-style
  if (isHomePage) {
    return (
      <div className="min-h-screen min-h-ios-screen pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:pb-0 bg-white w-full">
        <AppHeader />
        <div className="pt-[var(--app-header-height,56px)]">
          {children}
        </div>
        <BottomNavbar />
        {portraitPromptOverlay}
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-ios-screen pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:pb-0 w-full max-w-full overflow-x-hidden bg-white">
      <AppHeader />
      <div className="pt-[var(--app-header-height,56px)]">
        {children}
      </div>
      <BottomNavbar />
      {portraitPromptOverlay}
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
          <Route path="/signup" element={<Signup />} />
          <Route path="/bids" element={<Bids />} />
          <Route path="/bet-history" element={<BetHistory />} />
          <Route path="/market-result-history" element={<MarketResultHistory />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/top-winners" element={<TopWinners />} />
          <Route path="/game-rate" element={<GameRate />} />
          <Route path="/games" element={<GamesHub />} />
          <Route path="/lottery" element={<LotteryDashboard />} />
          <Route path="/lottery/quiz" element={<LotteryQuizPage />} />
          <Route path="/lottery/3d/quiz" element={<ThreeDQuizPage />} />
          <Route path="/lottery/3d" element={<ThreeDGame />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default AppRoutes;

