import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AddFund, WithdrawFund, BankDetail, AddFundHistory, WithdrawFundHistory } from './funds/index';

const Funds = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Mobile only: prevent page scrolling (as requested)
  useEffect(() => {
    let cleanup = () => {};
    try {
      const mql = window.matchMedia('(max-width: 767px)');
      const apply = () => {
        cleanup();
        if (!mql.matches) return;
        const prevBody = document.body.style.overflow;
        const prevHtml = document.documentElement.style.overflow;
        const prevOverscrollBody = document.body.style.overscrollBehavior;
        const prevOverscrollHtml = document.documentElement.style.overscrollBehavior;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overscrollBehavior = 'none';
        document.documentElement.style.overscrollBehavior = 'none';
        cleanup = () => {
          document.body.style.overflow = prevBody;
          document.documentElement.style.overflow = prevHtml;
          document.body.style.overscrollBehavior = prevOverscrollBody;
          document.documentElement.style.overscrollBehavior = prevOverscrollHtml;
        };
      };
      apply();
      mql.addEventListener?.('change', apply);
      return () => {
        mql.removeEventListener?.('change', apply);
        cleanup();
      };
    } catch (_) {
      return () => cleanup();
    }
  }, []);

  const items = useMemo(() => ([
    {
      key: 'add-fund',
      title: 'Add Fund',
      subtitle: 'You can add fund to your wallet',
      color: '#34a853',
      icon: <span className="text-3xl font-extrabold text-black leading-none">₹</span>,
      component: AddFund,
    },
    {
      key: 'withdraw-fund',
      title: 'Withdraw Fund',
      subtitle: 'You can withdraw winnings',
      color: '#ef4444',
      icon: (
        <svg className="w-7 h-7 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m-4-4l4 4 4-4M16 6a6 6 0 00-8 0" />
        </svg>
      ),
      component: WithdrawFund,
    },
    {
      key: 'bank-detail',
      title: 'Bank Detail',
      subtitle: 'Add your bank detail for withdrawals',
      color: '#3b82f6',
      icon: (
        <svg className="w-7 h-7 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M5 10v8m4-8v8m6-8v8m4-8v8M3 18h18M4 10l8-4 8 4" />
        </svg>
      ),
      component: BankDetail,
    },
    {
      key: 'add-fund-history',
      title: 'Add Fund History',
      subtitle: 'You can check your add point history',
      color: '#1e3a8a',
      icon: (
        <svg className="w-7 h-7 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v5l3 2" />
          <circle cx="12" cy="12" r="8" />
        </svg>
      ),
      component: AddFundHistory,
    },
    {
      key: 'withdraw-fund-history',
      title: 'Withdraw Fund History',
      subtitle: 'You can check your Withdraw point history',
      color: '#f59e0b',
      icon: (
        <svg className="w-7 h-7 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v5l3 2" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 12a8 8 0 11-2.343-5.657" />
        </svg>
      ),
      component: WithdrawFundHistory,
    },
  ]), []);

  // Get active tab from URL or default to first
  const tabParam = searchParams.get('tab');
  const [activeKey, setActiveKey] = useState(tabParam || items[0]?.key || 'add-fund');
  const [mobileView, setMobileView] = useState(null); // null = list, string = key of active item

  useEffect(() => {
    // Sync URL with active key on desktop
    if (tabParam !== activeKey) {
      setSearchParams({ tab: activeKey }, { replace: true });
    }
  }, [activeKey]);

  const activeItem = items.find((i) => i.key === activeKey) || items[0];
  const ActiveComponent = activeItem?.component;

  const handleItemClick = (key) => {
    setActiveKey(key);
    setMobileView(key); // On mobile, show the component
  };

  const handleMobileBack = () => {
    setMobileView(null);
  };

  const isAddFundMobileView = mobileView === 'add-fund';

  return (
    <div className="min-h-screen bg-black text-white pl-3 pr-3 sm:pl-4 sm:pr-4 pt-0 md:pt-4 pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
      <div className="w-full max-w-lg md:max-w-none mx-auto md:mx-0">
        <div className="mb-4 md:grid md:grid-cols-[360px_1fr] md:gap-6 md:items-center">
          <div className="flex items-center gap-3 pt-4 md:pt-0">
            <button
              type="button"
              onClick={() => mobileView ? handleMobileBack() : navigate(-1)}
              className="min-w-[44px] min-h-[44px] rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white hover:bg-white/15 active:scale-95 transition touch-manipulation"
              aria-label="Back"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl sm:text-2xl font-bold">
              {mobileView ? items.find(i => i.key === mobileView)?.title : 'Funds'}
            </h1>
          </div>

          <div className="hidden md:flex items-center justify-between gap-4 px-1">
            <div className="text-2xl font-extrabold text-white">{activeItem?.title}</div>
          </div>
        </div>

        {/* Mobile: List view or Component view */}
        <div className="md:hidden">
          {mobileView === null ? (
            // List view
            <div className="space-y-2.5">
              {items.map((item) => (
                <div
                  key={item.key}
                  onClick={() => handleItemClick(item.key)}
                  className="bg-[#202124] border border-white/10 rounded-2xl p-3 flex items-center justify-between shadow-[0_12px_24px_rgba(0,0,0,0.35)]"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleItemClick(item.key);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-black shadow-[0_10px_20px_rgba(0,0,0,0.35)]"
                      style={{ backgroundColor: item.color }}
                    >
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-sm sm:text-base font-semibold">{item.title}</p>
                      <p className="text-[11px] sm:text-xs text-gray-400 leading-snug">{item.subtitle}</p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-black/30 border border-white/10 flex items-center justify-center text-white/70">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Component view
            <div
              className={`bg-[#202124] border border-white/10 rounded-2xl shadow-[0_12px_24px_rgba(0,0,0,0.35)] ${
                isAddFundMobileView
                  ? 'p-3 max-h-[calc(100vh-220px)] overflow-y-auto scrollbar-hidden'
                  : 'p-4 max-h-[calc(100vh-140px)] overflow-y-auto scrollbar-hidden'
              }`}
            >
              {items.find(i => i.key === mobileView)?.component && (
                React.createElement(items.find(i => i.key === mobileView).component)
              )}
            </div>
          )}
        </div>

        {/* Desktop: sidebar-style list + right panel (My Bets style) */}
        <div className="hidden md:grid md:grid-cols-[360px_1fr] md:gap-6 md:items-start">
          <aside className="md:sticky md:top-[96px] space-y-2">
            {items.map((item) => {
              const active = item.key === activeKey;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveKey(item.key)}
                  className={`w-full text-left bg-[#202124] border rounded-2xl p-3 md:p-5 flex items-center justify-between shadow-[0_12px_24px_rgba(0,0,0,0.35)] transition-colors ${
                    active ? 'border-[#d4af37]/40 bg-[#202124]' : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3 md:gap-4">
                    <div
                      className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-black shadow-[0_10px_20px_rgba(0,0,0,0.35)]"
                      style={{ backgroundColor: item.color }}
                    >
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm md:text-base font-semibold text-white truncate">{item.title}</p>
                      <p className="text-xs text-gray-400 truncate">{item.subtitle}</p>
                    </div>
                  </div>
                  <div
                    className={`w-8 h-8 md:w-9 md:h-9 rounded-full border flex items-center justify-center ${
                      active ? 'bg-[#d4af37]/15 border-[#d4af37]/35 text-[#d4af37]' : 'bg-black/30 border-white/10 text-white/70'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </aside>

          <main className="rounded-2xl bg-[#202124] border border-white/10 shadow-[0_12px_24px_rgba(0,0,0,0.35)] p-6">
            <div className="flex items-center justify-center gap-4 mb-6">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-black shadow-[0_10px_20px_rgba(0,0,0,0.35)]"
                style={{ backgroundColor: activeItem?.color || '#f3b61b' }}
              >
                {activeItem?.icon}
              </div>
              <div className="min-w-0 text-center">
                <div className="text-xl font-bold text-white truncate">{activeItem?.title}</div>
                <div className="text-sm text-gray-400">{activeItem?.subtitle}</div>
              </div>
            </div>

            <div className="max-h-[calc(100vh-280px)] overflow-y-auto scrollbar-hidden">
              {ActiveComponent && <ActiveComponent />}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Funds;
