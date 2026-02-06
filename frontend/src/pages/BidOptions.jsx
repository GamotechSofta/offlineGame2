import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const BidOptions = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const market = location.state?.market;
  const marketType = (location.state?.marketType || '').toString().trim().toLowerCase();
  const isStarline = marketType === 'starline' || marketType === 'startline' || marketType === 'star-line';

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
          className="w-30 h-30 object-contain"
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
          className="w-30 h-30 object-contain"
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
          className="w-30 h-30 object-contain"
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
          className="w-30 h-30 object-contain"
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
          className="w-30 h-30 object-contain"
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
          className="w-30 h-30 object-contain"
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
          className="w-30 h-30 object-contain"
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
          className="w-30 h-30 object-contain"
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
          className="w-30 h-30 object-contain"
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
          className="w-30 h-30 object-contain"
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
          className="w-30 h-30 object-contain"
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
    <div className="min-h-screen bg-black flex flex-col items-center">
      {/* Header */}
      <div className="w-full flex items-center px-4 pt-5 pb-4 bg-black border-b border-gray-800 relative">
        <button
          onClick={() => navigate(isStarline ? '/startline-dashboard' : '/')}
          className="absolute left-4 text-gray-400 hover:text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div className="w-full text-center">
          {/* Dynamic market name from selected market */}
          <h1 className="text-white font-bold text-lg tracking-wider uppercase inline-block border-b-2 border-yellow-500 pb-1 px-2 py-1">
            {market?.gameName || 'SELECT MARKET'}
          </h1>
          {isStarline ? (
            <div className="mt-2 text-xs font-extrabold tracking-[0.22em] text-[#d4af37] uppercase">
              STARLINE MARKET
            </div>
          ) : null}
        </div>
      </div>

      {/* Grid Content */}
      <div className="w-full max-w-md lg:max-w-none px-3 pt-3 pb-20 md:pb-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
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
            className="relative rounded-2xl bg-gradient-to-br from-[#1b1d22] via-[#15171b] to-[#0f1013] border border-white/10 p-3 flex flex-col items-center justify-center gap-2 hover:from-[#23262d] hover:via-[#1a1d22] hover:to-[#121418] active:scale-[0.98] transition-all cursor-pointer shadow-[0_10px_25px_rgba(0,0,0,0.35)] group"
          >
            {/* Icon Container with subtle glow effect */}
            <div className="flex items-center justify-center w-30 h-30 transform scale-90 group-hover:scale-100 transition-transform duration-300">
              {option.icon}
            </div>

            {/* Title */}
            <span className="text-white text-[10px] sm:text-xs font-semibold tracking-[0.18em] uppercase text-center">
              {option.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BidOptions;
