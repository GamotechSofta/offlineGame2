import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const BottomNavbar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const scrollToTop = () => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
      // Also scroll any scrollable containers (match AppRoutes behavior)
      setTimeout(() => {
        const scrollableElements = document.querySelectorAll(
          '[class*="overflow-y-auto"], [class*="overflow-y-scroll"], [class*="overflow-auto"]'
        );
        scrollableElements.forEach((el) => {
          if (el && typeof el.scrollTop === 'number') el.scrollTop = 0;
        });
      }, 10);
    } catch (_) {}
  };

  const navItems = [
    {
      id: 'my-bids',
      label: 'My Bets',
      path: '/bids',
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 7.5A1.5 1.5 0 016 6h12a1.5 1.5 0 011.5 1.5V9a1.5 1.5 0 010 3 1.5 1.5 0 010 3v1.5A1.5 1.5 0 0118 18H6a1.5 1.5 0 01-1.5-1.5V15a1.5 1.5 0 010-3 1.5 1.5 0 010-3V7.5z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 9.75h6M9 14.25h3.75" />
        </svg>
      )
    },
    {
      id: 'funds',
      label: 'Funds',
      path: '/funds',
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.5h6M9 11h5.25M9.75 8.5c2.4 0 3.75 1.2 3.75 3 0 1.9-1.55 3.2-3.9 3.2h-.6L13.5 18" />
        </svg>
      )
    },
    {
      id: 'home',
      label: 'Home',
      path: '/',
      icon: (
        <img
          src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769777716/home_pvawyw.png"
          alt="Home"
          className="w-6 h-6 object-contain [image-rendering:-webkit-optimize-contrast]"
        />
      ),
      isCenter: true
    },
    {
      id: 'support',
      label: 'Support',
      path: '/support',
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75h6.75M8.625 13.5h4.5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 4.5h9A3.75 3.75 0 0120.25 8.25v5.25a3.75 3.75 0 01-3.75 3.75h-4.25l-3.75 2.25v-2.25H7.5a3.75 3.75 0 01-3.75-3.75V8.25A3.75 3.75 0 017.5 4.5z" />
        </svg>
      )
    },
    {
      id: 'profile',
      label: 'Profile',
      path: '/profile',
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 20.118a7.5 7.5 0 0115 0A17.94 17.94 0 0112 21.75c-2.676 0-5.216-.584-7.5-1.632z" />
        </svg>
      )
    }
  ];

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden pt-1"
      style={{
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 6px)',
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
      }}
    >
      {/* Backplate to prevent white background showing behind navbar */}
      <div className="absolute inset-0 bg-white pointer-events-none" />
      <div className="relative bg-white rounded-3xl border-2 border-gray-300 shadow-lg flex items-end justify-around px-1 py-1.5 min-h-[56px]">
        {navItems.map((item) => {
          const active = isActive(item.path);
          const isCenter = item.isCenter;

          if (isCenter) {
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.path === '/' && location.pathname === '/') {
                    scrollToTop();
                    return;
                  }
                  navigate(item.path);
                }}
                className="flex flex-col items-center justify-center -mt-6 relative z-10 active:scale-90 transition-transform duration-150 touch-manipulation"
              >
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${
                    active
                      ? 'bg-[#1B3150] ring-2 ring-[#1B3150]/40 ring-offset-2 ring-offset-white scale-105'
                      : 'bg-gray-50 border-2 border-gray-300'
                  }`}
                >
                  {/* Icon: gray when inactive, white when active (on navy bg) */}
                  <div
                    className={`transition-all duration-200 ${
                      active ? 'brightness-0 invert' : 'brightness-0 opacity-40'
                    }`}
                  >
                    {item.icon}
                  </div>
                </div>
                <span
                  className={`text-[10px] sm:text-xs font-bold mt-1 transition-colors duration-200 ${
                    active ? 'text-[#1B3150]' : 'text-gray-600'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.path === '/' && location.pathname === '/') {
                  scrollToTop();
                  return;
                }
                navigate(item.path);
              }}
              className="relative flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-xl min-w-[56px] active:scale-95 transition-all duration-150 touch-manipulation"
            >
              {/* Icon: gray when inactive, navy when active */}
              <div
                className={`transition-all duration-200 ${
                  active ? 'scale-110 brightness-0 opacity-60' : 'scale-100 brightness-0 opacity-40'
                }`}
              >
                {item.icon}
              </div>
              {/* Active indicator dot below icon */}
              <div className="h-1.5 w-full flex items-center justify-center">
                {active && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[#1B3150] shadow-md mx-auto" />
                )}
              </div>
              <span
                className={`text-[10px] sm:text-xs font-bold transition-colors duration-200 ${
                  active ? 'text-[#1B3150]' : 'text-gray-600'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavbar;
