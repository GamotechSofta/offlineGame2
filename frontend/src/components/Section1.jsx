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
    <section className="w-full bg-gray-100 min-[375px]:pt-4 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] sm:pt-6 sm:pb-10 min-[375px]:px-3 sm:px-4 md:pb-8 max-w-full overflow-x-hidden">
      {/* ═══ Desktop: MARKETS header ── */}
      <div className="hidden md:flex items-center gap-4 mt-4 mb-5 w-full max-w-7xl mx-auto px-4">
        {/* ── Left orange line ── */}
        <div className="flex-1 h-[1px] bg-gradient-to-r from-orange-200 via-orange-400 to-orange-500 min-w-[20px]" />

        {/* ── MARKETS center ── */}
        <div className="flex items-center gap-2 shrink-0">
          <svg className="w-2.5 h-2.5 text-orange-400" viewBox="0 0 12 12" fill="currentColor"><path d="M6 0l1.8 4.2L12 6l-4.2 1.8L6 12l-1.8-4.2L0 6l4.2-1.8z"/></svg>
          <h2 className="text-gray-800 text-lg font-bold tracking-[0.15em] uppercase">Markets</h2>
          <svg className="w-2.5 h-2.5 text-orange-400" viewBox="0 0 12 12" fill="currentColor"><path d="M6 0l1.8 4.2L12 6l-4.2 1.8L6 12l-1.8-4.2L0 6l4.2-1.8z"/></svg>
        </div>

        {/* ── Right orange line ── */}
        <div className="flex-1 h-[1px] bg-gradient-to-l from-orange-200 via-orange-400 to-orange-500 min-w-[20px]" />

      </div>

      {/* ═══ Mobile: MARKETS Header only ═══ */}
      <div className="flex md:hidden items-end justify-center mb-4 min-[375px]:mb-6 sm:mb-8 w-full max-w-7xl mx-auto gap-1 min-[375px]:gap-2 sm:gap-4">
        <div className="flex-1 h-[2px] bg-orange-500 shrink min-w-0" />
        <div className="relative shrink-0 w-[110px] min-[375px]:w-[140px] sm:w-[180px] h-[24px] min-[375px]:h-[28px] sm:h-[34px]">
          <svg className="w-full h-full" viewBox="0 0 240 40" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
            {/* Add small bottom "wings" so lines join like screenshot */}
            <path d="M0 39 H26 L40 2 H200 L214 39 H240" stroke="#f97316" strokeWidth="2" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center pt-2 sm:pt-3">
            <h2 className="text-gray-800 text-sm min-[375px]:text-base sm:text-xl font-bold tracking-wider">MARKETS</h2>
          </div>
        </div>
        <div className="flex-1 h-[2px] bg-orange-500 shrink min-w-0" />
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 min-[375px]:gap-3 sm:gap-4">
          {markets.map((market) => {
            // open + running = clickable; closed = not clickable
            const isClickable = market.status === 'open' || market.status === 'running';
            return (
            <div
              key={market.id}
              onClick={() => isClickable && navigate('/bidoptions', { state: { market } })}
              className={`bg-white border-2 rounded-lg overflow-hidden transform transition-transform duration-200 ${
                isClickable 
                  ? 'cursor-pointer hover:scale-[1.02] border-orange-300 hover:border-orange-500 shadow-sm' 
                  : 'cursor-not-allowed border-gray-300'
              }`}
            >
              {/* Status: ***-**-***=Open(green), 156-2*-***=Running(green), 987-45-456=Closed(red) */}
              <div className={`${
                market.status === 'closed' ? 'bg-orange-500' : 'bg-green-600'
              } py-1.5 min-[375px]:py-2 px-2 min-[375px]:px-3 text-center`}>
                <p className="text-white text-[10px] min-[375px]:text-xs sm:text-sm font-semibold leading-tight">
                  {market.status === 'open' && 'MARKET IS OPEN'}
                  {market.status === 'running' && 'CLOSED IS RUNNING'}
                  {market.status === 'closed' && 'MARKET CLOSED'}
                </p>
              </div>

            {/* Card Content */}
            <div className="p-2 min-[375px]:p-3 sm:p-4 bg-white">
              {/* Time with Clock Icon */}
              <div className="flex items-center gap-1 mb-1.5 min-[375px]:mb-2">
                <svg
                  className="w-3 h-3 sm:w-4 sm:h-4 text-gray-700 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-800 text-[10px] min-[375px]:text-xs sm:text-sm truncate font-medium">{market.timeRange}</p>
              </div>

              {/* Game Name */}
              <h3 className="text-gray-900 text-xs min-[375px]:text-sm sm:text-base md:text-lg font-bold mb-2 min-[375px]:mb-3 truncate">
                {market.gameName}
              </h3>

              {/* Result */}
              <div>
                <p className="text-orange-600 text-lg min-[375px]:text-xl sm:text-2xl md:text-3xl font-bold">
                  {market.result}
                </p>
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
