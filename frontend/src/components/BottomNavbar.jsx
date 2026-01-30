import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const BottomNavbar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    {
      id: 'my-bids',
      label: 'My Bids',
      path: '/bidoptions',
      icon: (
        <img
          src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769777192/auction_ofhpps.png"
          alt="My Bids"
          className="w-5 h-5 object-contain"
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
          className="w-5 h-5 object-contain"
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
          className="w-5 h-5 object-contain"
        />
      ),
      isCenter: true
    },
    {
      id: 'funds',
      label: 'Funds',
      path: '/bank',
      icon: (
        <img
          src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769777500/funding_zjmbzp.png"
          alt="Funds"
          className="w-5 h-5 object-contain"
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
          className="w-5 h-5 object-contain"
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden px-3 pb-3 pt-1">
      <div className="bg-black rounded-3xl border border-gray-700 shadow-[0_4px_20px_rgba(0,0,0,0.4)] flex items-end justify-around px-1 py-2 min-h-[64px]">
        {navItems.map((item) => {
          const active = isActive(item.path);
          const isCenter = item.isCenter;

          if (isCenter) {
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center justify-center -mt-6 relative z-10"
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center shadow-[0_4px_12px_rgba(243,182,27,0.35)] ${
                    active ? 'bg-[#f3b61b] text-black' : 'bg-gray-800 border border-gray-700 text-gray-400'
                  }`}
                >
                  {item.icon}
                </div>
                <span className="text-[10px] sm:text-xs font-bold text-white mt-1">{item.label}</span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-xl transition-colors min-w-[56px]"
            >
              <div className={active ? 'text-[#f3b61b]' : 'text-gray-400'}>
                {item.icon}
              </div>
              <span className="text-[10px] sm:text-xs font-bold text-white">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavbar;
