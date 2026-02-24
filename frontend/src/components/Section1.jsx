import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import { isPastClosingTime } from '../utils/marketTiming';
import { useRefreshOnMarketReset } from '../hooks/useRefreshOnMarketReset';

const Section1 = () => {
  const navigate = useNavigate();
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  // Convert 24-hour time to 12-hour format
  const formatTime = (time24) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Status: result format OR automatic close when closing time is reached
  // ***-**-*** → Open (green) | 156-2*-*** → Running (green) | 987-45-456 or past closing time → Closed (red)
  const getMarketStatus = (market) => {
    if (isPastClosingTime(market)) {
      return { status: 'closed', timer: null };
    }
    const hasOpening = market.openingNumber && /^\d{3}$/.test(String(market.openingNumber));
    const hasClosing = market.closingNumber && /^\d{3}$/.test(String(market.closingNumber));

    if (hasOpening && hasClosing) {
      return { status: 'closed', timer: null };
    }
    if (hasOpening && !hasClosing) {
      return { status: 'running', timer: null };
    }
    return { status: 'open', timer: null };
  };

  // Fetch markets from API
  const fetchMarkets = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/markets/get-markets`);
      const data = await response.json();

      if (data.success) {
        const mainOnly = (data.data || []).filter((m) => m.marketType !== 'startline');
        const transformedMarkets = mainOnly.map((market) => {
          const st = getMarketStatus(market);
          return {
            id: market._id,
            gameName: market.marketName,
            timeRange: `${formatTime(market.startingTime)} - ${formatTime(market.closingTime)}`,
            result: market.displayResult || '***-**-***',
            status: st.status,
            timer: st.timer,
            winNumber: market.winNumber,
            startingTime: market.startingTime,
            closingTime: market.closingTime,
            betClosureTime: market.betClosureTime ?? 0,
            openingNumber: market.openingNumber,
            closingNumber: market.closingNumber
          };
        });
        setMarkets(transformedMarkets);
      }
    } catch (error) {
      console.error('Error fetching markets:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarkets();
    const dataInterval = setInterval(fetchMarkets, 30000);
    return () => clearInterval(dataInterval);
  }, []);

  useRefreshOnMarketReset(fetchMarkets);


  return (
    <section className="w-full bg-gray-200 min-[375px]:pt-4 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] sm:pt-6 sm:pb-10 min-[375px]:px-3 sm:px-4 md:pb-8 max-w-full overflow-x-hidden">
      {/* ═══ Desktop: MARKETS header ── */}
      <div className="hidden md:flex items-center gap-4 mt-4 mb-5 w-full max-w-7xl mx-auto px-4">
        {/* ── Left navy line ── */}
        <div className="flex-1 h-[1px] bg-gradient-to-r from-gray-300 via-[#1B3150] to-[#1B3150] min-w-[20px]" />

        {/* ── MARKETS center ── */}
        <div className="flex items-center gap-2 shrink-0">
          <svg className="w-2.5 h-2.5 text-[#1B3150]" viewBox="0 0 12 12" fill="currentColor"><path d="M6 0l1.8 4.2L12 6l-4.2 1.8L6 12l-1.8-4.2L0 6l4.2-1.8z"/></svg>
          <h2 className="text-gray-800 text-lg font-bold tracking-[0.15em] uppercase">Markets</h2>
          <svg className="w-2.5 h-2.5 text-[#1B3150]" viewBox="0 0 12 12" fill="currentColor"><path d="M6 0l1.8 4.2L12 6l-4.2 1.8L6 12l-1.8-4.2L0 6l4.2-1.8z"/></svg>
        </div>

        {/* ── Right navy line ── */}
        <div className="flex-1 h-[1px] bg-gradient-to-l from-gray-300 via-[#1B3150] to-[#1B3150] min-w-[20px]" />

      </div>

      {/* ═══ Mobile: MARKETS Header - + MARKETS + with lines ═══ */}
      <div className="flex md:hidden items-center justify-center gap-2 min-[375px]:gap-3 mb-4 min-[375px]:mb-6 sm:mb-8 w-full max-w-7xl mx-auto px-2">
        <div className="flex-1 h-[1px] bg-gray-400 min-w-[20px] shrink-0 shadow-sm" />
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[#1B3150] font-bold text-sm min-[375px]:text-base sm:text-lg">+</span>
          <h2 className="text-[#1B3150] font-bold text-sm min-[375px]:text-base sm:text-lg tracking-wider uppercase">MARKETS</h2>
          <span className="text-[#1B3150] font-bold text-sm min-[375px]:text-base sm:text-lg">+</span>
        </div>
        <div className="flex-1 h-[1px] bg-gray-400 min-w-[20px] shrink-0 shadow-sm" />
      </div>
      {/* Market Cards Grid */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-600">Loading markets...</p>
        </div>
      ) : markets.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600">No markets available</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 min-[375px]:gap-3 sm:gap-4">
          {markets.map((market) => {
            const isClickable = market.status === 'open' || market.status === 'running';
            const statusText = market.status === 'closed' ? 'Closed for today' : market.status === 'running' ? 'Close is Running' : 'Market is Open';
            return (
            <div
              key={market.id}
              onClick={() => isClickable && navigate('/bidoptions', { state: { market } })}
              className={`bg-white rounded-lg overflow-hidden transform transition-transform duration-200 shadow hover:shadow-lg ${
                isClickable 
                  ? 'cursor-pointer hover:scale-[1.01] border border-gray-200 hover:border-[#1B3150]/50' 
                  : 'cursor-not-allowed border border-gray-200'
              }`}
            >
              <div className="p-1.5 sm:p-2 flex flex-col">
                {/* Top: Market name (left) + Status (right) */}
                <div className="flex items-start justify-between gap-2 mb-0.5">
                  <h3 className="text-gray-900 text-sm sm:text-base font-bold truncate flex-1 min-w-0 leading-tight">
                    {market.gameName}
                  </h3>
                  <span className={`text-[10px] sm:text-xs font-medium shrink-0 leading-tight px-1.5 py-0.5 ${market.status === 'closed' ? 'text-red-500' : 'text-green-600'}`}>
                    {statusText}
                  </span>
                </div>

                {/* Middle: Result numbers (green) + Icons (right) */}
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-green-600 text-base sm:text-lg md:text-xl font-bold leading-tight flex-1 min-w-0">
                    {market.result}
                  </p>
                  <div className="flex items-center justify-center shrink-0 ml-auto self-center pt-2">
                    {market.status === 'closed' ? (
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-red-500 flex items-center justify-center text-white p-2">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); navigate('/bidoptions', { state: { market } }); }}
                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-green-500 flex items-center justify-center text-white hover:bg-green-600 active:scale-95 p-2"
                        aria-label="Play"
                      >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Bottom: Open Bids / Close Bids times */}
                <div className="flex gap-2 text-gray-600">
                  <div className="space-y-0.5">
                    <p className="text-[10px] sm:text-xs font-medium text-gray-500 leading-tight">Open Bids</p>
                    <p className="text-xs sm:text-sm font-semibold leading-tight">{formatTime(market.startingTime) || '-'}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] sm:text-xs font-medium text-gray-500 leading-tight">Close Bids</p>
                    <p className="text-xs sm:text-sm font-semibold leading-tight">{formatTime(market.closingTime) || '-'}</p>
                  </div>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default Section1;
