import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const BottomNavbar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    {
      id: 'my-bids',
      label: 'My Bets',
      path: '/bids',
      icon: (
        <img
          src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769777192/auction_ofhpps.png"
          alt="My Bets"
          className="w-6 h-6 object-contain [image-rendering:-webkit-optimize-contrast]"
        />
      )
    },
    {
      id: 'bank',
      label: 'Bank',
      path: '/bank',
      icon: (
        <img
          src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769777283/bank_il6uwi.png"
          alt="Bank"
          className="w-6 h-6 object-contain [image-rendering:-webkit-optimize-contrast]"
        />
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
      id: 'funds',
      label: 'Funds',
      path: '/funds',
      icon: (
        <img
          src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769777500/funding_zjmbzp.png"
          alt="Funds"
          className="w-6 h-6 object-contain [image-rendering:-webkit-optimize-contrast]"
        />
      )
    },
    {
      id: 'support',
      label: 'Support',
      path: '/support',
      icon: (
        <img
          src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769777618/customer-support_du0zcj.png"
          alt="Support"
          className="w-6 h-6 object-contain [image-rendering:-webkit-optimize-contrast]"
        />
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
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden px-3 pt-1"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0px)' }}
    >
      <div className="bg-black rounded-3xl border border-gray-700 shadow-[0_4px_20px_rgba(0,0,0,0.4)] flex items-end justify-around px-1 py-2 min-h-[64px]">
        {navItems.map((item) => {
          const active = isActive(item.path);
          const isCenter = item.isCenter;

          if (isCenter) {
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center justify-center -mt-6 relative z-10 active:scale-90 transition-transform duration-150 touch-manipulation"
              >
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.35)] transition-all duration-200 ${
                    active
                      ? 'bg-[#f3b61b] ring-2 ring-[#f3b61b]/60 ring-offset-2 ring-offset-black scale-105'
                      : 'bg-gray-800 border border-gray-700'
                  }`}
                >
                  {/* Icon: white when inactive, dark when active (on yellow bg) */}
                  <div
                    className={`transition-[filter] duration-200 ${
                      active ? '[filter:brightness(0)]' : '[filter:brightness(0)_invert(1)]'
                    }`}
                  >
                    {item.icon}
                  </div>
                </div>
                <span
                  className={`text-[10px] sm:text-xs font-bold mt-1 transition-colors duration-200 ${
                    active ? 'text-[#f3b61b]' : 'text-white'
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
              onClick={() => navigate(item.path)}
              className="relative flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-xl min-w-[56px] active:scale-95 transition-all duration-150 touch-manipulation"
            >
              {/* Icon: white when inactive, golden when active - same as text */}
              <div
                className={`transition-all duration-200 ${
                  active ? 'scale-110 [filter:brightness(0)_invert(0.88)_sepia(0.25)_saturate(8)_hue-rotate(5deg)]' : 'scale-100 [filter:brightness(0)_invert(1)]'
                }`}
              >
                {item.icon}
              </div>
              {/* Active indicator dot below icon */}
              <div className="h-1.5 w-full flex items-center justify-center">
                {active && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[#f3b61b] shadow-[0_0_8px_rgba(0,0,0,0.4)] mx-auto" />
                )}
              </div>
              <span
                className={`text-[10px] sm:text-xs font-bold transition-colors duration-200 ${
                  active ? 'text-[#f3b61b]' : 'text-white'
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
