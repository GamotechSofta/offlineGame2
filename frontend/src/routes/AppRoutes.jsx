import React, { useEffect, useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { useHeartbeat } from '../hooks/useHeartbeat';
import { usePlayerWalletSocketSync } from '../hooks/usePlayerWalletSocketSync';
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
import GameLaunchEmbed from '../pages/GameLaunchEmbed';
import ZoomTestPage from '../pages/ZoomTestPage';
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
  const isGamePlayPage = location.pathname.startsWith('/games/play/');
  const isLotteryFullScreenPage = isTwoDGamePage || isThreeDGamePage || isLotteryQuizPage || isThreeDQuizPage;
  const isZoomTestPage = location.pathname === '/zoom-test';
  const isIOSDevice = /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  const [hasUser, setHasUser] = useState(null);
  const isLoginPage = location.pathname === '/login' || location.pathname === '/signup';
  const isHomePage = location.pathname === '/';
  const [showPortraitPrompt, setShowPortraitPrompt] = useState(false);

  usePlayerWalletSocketSync(
    Boolean(hasUser && !isLotteryFullScreenPage && !isLoginPage && !isZoomTestPage),
  );

  useEffect(() => {
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!viewportMeta) return undefined;

    const zoomEnabledContent =
      'width=device-width, initial-scale=1.0, maximum-scale=10.0, user-scalable=yes';
    const zoomDisabledContent =
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';

    const applyViewport = () => {
      const isLottery2d3d = isTwoDGamePage || isThreeDGamePage || isLotteryQuizPage || isThreeDQuizPage;
      const bodyEl = document.body;
      if (bodyEl) bodyEl.classList.remove('lottery-mobile-zoom-enabled');
      if (isLottery2d3d) {
        viewportMeta.setAttribute('content', zoomDisabledContent);
        return;
      }
      viewportMeta.setAttribute('content', zoomEnabledContent);
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
      document.body?.classList.remove('lottery-mobile-zoom-enabled');
      viewportMeta.setAttribute('content', zoomEnabledContent);
    };
  }, [isTwoDGamePage, isThreeDGamePage, isLotteryQuizPage, isThreeDQuizPage]);

  useEffect(() => {
    const isDebugRoute = isLotteryFullScreenPage || isZoomTestPage;
    if (!isDebugRoute) return undefined;
    const logState = () => {
      const viewport = document.querySelector('meta[name="viewport"]')?.getAttribute('content');
      const htmlTouch = getComputedStyle(document.documentElement).touchAction;
      const bodyTouch = getComputedStyle(document.body).touchAction;
      const rootOverflow = getComputedStyle(document.getElementById('root')).overflow;
      const visualViewportScale = window.visualViewport?.scale;
      console.log({
        viewport,
        htmlTouch,
        bodyTouch,
        rootOverflow,
        visualViewportScale,
      });
    };
    const onPinchTouchMove = (e) => {
      if (e.touches?.length >= 2) {
        console.log('PINCH DETECTED');
      }
    };
    logState();
    window.visualViewport?.addEventListener('resize', logState);
    window.addEventListener('touchmove', onPinchTouchMove, { passive: true });
    return () => {
      window.visualViewport?.removeEventListener('resize', logState);
      window.removeEventListener('touchmove', onPinchTouchMove);
    };
  }, [isLotteryFullScreenPage, isZoomTestPage]);

  useEffect(() => {
    if (!isLotteryFullScreenPage || !isIOSDevice) return undefined;
    const exitAnyFullscreen = async () => {
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        }
      } catch (_) {
        // Ignore browser policy failures.
      }
    };
    exitAnyFullscreen();
    document.addEventListener('fullscreenchange', exitAnyFullscreen);
    document.addEventListener('webkitfullscreenchange', exitAnyFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', exitAnyFullscreen);
      document.removeEventListener('webkitfullscreenchange', exitAnyFullscreen);
    };
  }, [isIOSDevice, isLotteryFullScreenPage]);

  useEffect(() => {
    const check = async () => {
      const isPublicNow = PUBLIC_PATHS.includes(location.pathname);
      if (isPublicNow) {
        const user = getCurrentUser();
        setHasUser(!!(user && (user.id || user._id)));
        return;
      }

      // Partner embedded games should still be playable even if /users/me is temporarily unreachable.
      // We already authenticated the launch request earlier (via /games/launch/:gameCode).
      if (isGamePlayPage) {
        const user = getCurrentUser();
        setHasUser(!!(user && (user.id || user._id)));
        return;
      }

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
  }, [location.pathname]);

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

  if (isZoomTestPage) {
    return <>{children}</>;
  }

  // Lottery / embedded partner game: full-screen, no header or navbar
  if (isLotteryFullScreenPage) {
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
          <Route path="/games/play/:gameCode" element={<GameLaunchEmbed />} />
          <Route path="/lottery" element={<LotteryDashboard />} />
          <Route path="/lottery/quiz" element={<LotteryQuizPage />} />
          <Route path="/lottery/3d/quiz" element={<ThreeDQuizPage />} />
          <Route path="/lottery/3d" element={<ThreeDGame />} />
          <Route path="/zoom-test" element={<ZoomTestPage />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default AppRoutes;

