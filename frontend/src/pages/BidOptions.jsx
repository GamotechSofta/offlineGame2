import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const BidOptions = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const market = location.state?.market;
  const marketType = (location.state?.marketType || '').toString().trim().toLowerCase();
  const inferredStarline = (() => {
    const t = marketType;
    if (t === 'starline' || t === 'startline' || t === 'star-line') return true;
    const mType = (market?.marketType || '').toString().trim().toLowerCase();
    if (mType === 'startline' || mType === 'starline') return true;
    const name = (market?.marketName || market?.gameName || '').toString().toLowerCase();
    return name.includes('starline') || name.includes('startline') || name.includes('star line') || name.includes('start line');
  })();
  const isStarline = inferredStarline;

  // Redirect to home if no market (direct URL access or refresh)
  useEffect(() => {
    if (!market) {
      navigate('/', { replace: true });
      return;
    }
    if (isStarline && market?.status === 'closed') {
      navigate('/startline-dashboard', { replace: true });
    }
  }, [market, navigate]);

  const options = [
    {
      id: 1,
      title: 'Single Digit',
      icon: (
        <img
          src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769756244/Untitled_90_x_160_px_1080_x_1080_px_1_yinraf.svg"
          alt="Single Digit"
          className="w-full h-full object-contain"
        />
      ),
    },
    {
      id: 2,
      title: 'Single Digit Bulk',
      icon: (
        <img
          src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769756244/Untitled_90_x_160_px_1080_x_1080_px_1_yinraf.svg"
          alt="Single Digit"
          className="w-full h-full object-contain"
        />
      ),
    },
    {
      id: 3,
      title: 'Jodi',
      icon: (
        <img
          src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769714108/Untitled_1080_x_1080_px_1080_x_1080_px_7_rpzykt.svg"
          alt="Jodi"
          className="w-full h-full object-contain"
        />
      ),
    },
    {
      id: 4,
      title: 'Jodi Bulk',
      icon: (
        <img
          src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769714108/Untitled_1080_x_1080_px_1080_x_1080_px_7_rpzykt.svg"
          alt="Jodi Bulk"
          className="w-full h-full object-contain"
        />
      ),
    },
    {
      id: 5,
      title: 'Single Pana',
      icon: (
        <img
          src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769714254/Untitled_1080_x_1080_px_1080_x_1080_px_8_jdbxyd.svg"
          alt="Single Pana"
          className="w-full h-full object-contain"
        />
      ),
    },
    {
      id: 6,
      title: 'Single Pana Bulk',
      icon: (
        <img
          src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769714254/Untitled_1080_x_1080_px_1080_x_1080_px_8_jdbxyd.svg"
          alt="Single Pana Bulk"
          className="w-full h-full object-contain"
        />
      ),
    },
    {
      id: 7,
      title: 'Double Pana',
      icon: (
        <img
          src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769713943/Untitled_1080_x_1080_px_1080_x_1080_px_6_uccv7o.svg"
          alt="Double Pana"
          className="w-full h-full object-contain"
        />
      ),
    },
    {
      id: 8,
      title: 'Double Pana Bulk',
      icon: (
        <img
          src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769713943/Untitled_1080_x_1080_px_1080_x_1080_px_6_uccv7o.svg"
          alt="Double Pana Bulk"
          className="w-full h-full object-contain"
        />
      ),
    },
    {
      id: 9,
      title: 'Triple Pana',
      icon: (
        <img
          src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769714392/Untitled_1080_x_1080_px_1080_x_1080_px_9_ugcdef.svg"
          alt="Triple Pana"
          className="w-full h-full object-contain"
        />
      ),
    },
    {
      id: 10,
      title: 'Full Sangam',
      icon: (
        <img
          src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1770033671/Untitled_design_2_kr1imj.svg"
          alt="Triple Pana"
          className="w-full h-full object-contain"
        />
      ),
    },
    {
      id: 11,
      title: 'Half Sangam (O)',
      icon: (
        <img
          src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1770033165/Untitled_design_c5hag8.svg"
          alt="Half Sangam (O)"
          className="w-full h-full object-contain"
        />
      ),
    },
  ];

  if (!market) {
    return null; // Will redirect via useEffect
  }

  // When market is "CLOSED IS RUNNING", hide options that require OPEN session.
  const isRunning = market.status === 'running';
  const visibleOptionsBase = isStarline
    ? options.filter((opt) => {
        const t = (opt.title || '').toString().trim();
        const allowed = new Set([
          'Single Digit',
          'Single Digit Bulk',
          'Single Pana',
          'Single Pana Bulk',
          'Double Pana',
          'Double Pana Bulk',
          'Triple Pana',
          'Half Sangam (O)',
        ]);
        return allowed.has(t);
      })
    : options;

  const visibleOptions = (!isStarline && isRunning)
    ? visibleOptionsBase.filter((opt) => {
        const t = (opt.title || '').toLowerCase().trim();
        // Support both legacy (A/B) and current (O/C) naming.
        const hideWhenRunning = new Set([
          'jodi',
          'jodi bulk',
          'full sangam',
          'half sangam (o)',
          'half sangam (a)',
        ]);
        return !hideWhenRunning.has(t);
      })
    : visibleOptionsBase;

  return (
    <div className="min-h-screen bg-white flex flex-col items-center">
      {/* Header */}
      <div className="w-full flex items-center px-3 sm:px-4 pt-4 sm:pt-5 pb-3 sm:pb-4 bg-white border-b-2 border-orange-200 relative shadow-sm">
        <button
          onClick={() => navigate(isStarline ? '/startline-dashboard' : '/')}
          className="absolute left-3 sm:left-4 flex items-center justify-center min-w-[44px] min-h-[44px] -ml-1 text-gray-600 hover:text-orange-500 active:scale-95 touch-manipulation"
          aria-label="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div className="w-full text-center pr-12 pl-12 min-w-0">
          {/* Dynamic market name from selected market */}
          <h1 className="text-gray-800 font-bold text-base sm:text-lg tracking-wider uppercase inline-block border-b-2 border-orange-500 pb-1 px-2 py-1 truncate max-w-full">
            {market?.gameName || 'SELECT MARKET'}
          </h1>
          {isStarline ? (
            <div className="mt-2 text-xs font-extrabold tracking-[0.22em] text-orange-500 uppercase">
              STARLINE MARKET
            </div>
          ) : null}
        </div>
      </div>

      {/* Grid Content */}
      <div className="w-full max-w-md lg:max-w-none px-3 sm:px-4 pt-3 sm:pt-4 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
        {visibleOptions.map((option) => (
          <div
            key={option.id}
            onClick={() => navigate('/game-bid', {
              state: {
                market,
                betType: option.title,
                gameMode: option.title.toLowerCase().includes('bulk') ? 'bulk' : 'easy'
              }
            })}
            className="relative rounded-2xl bg-white border-2 border-orange-200 p-3.5 sm:p-4 flex flex-col items-center justify-center gap-2 sm:gap-2.5 hover:border-orange-400 hover:bg-orange-50 active:scale-[0.98] transition-all cursor-pointer shadow-md hover:shadow-lg group touch-manipulation min-h-[104px] sm:min-h-[120px] md:min-h-[132px]"
          >
            {/* Icon Container with subtle glow effect */}
            <div className="flex items-center justify-center w-[72px] h-[72px] sm:w-[84px] sm:h-[84px] md:w-[96px] md:h-[96px] group-hover:scale-[1.03] transition-transform duration-300">
              {option.icon}
            </div>

            {/* Title */}
            <span className="text-gray-800 text-[10px] sm:text-[11px] md:text-sm font-semibold tracking-[0.14em] sm:tracking-[0.18em] uppercase text-center line-clamp-2 leading-tight">
              {option.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BidOptions;
