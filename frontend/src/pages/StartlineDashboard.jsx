import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import { isPastClosingTime } from '../utils/marketTiming';
import { useRefreshOnMarketReset } from '../hooks/useRefreshOnMarketReset';

const getMarketStatus = (market) => {
  if (isPastClosingTime(market)) return 'closed';
  const hasOpening = market.openingNumber && /^\d{3}$/.test(String(market.openingNumber));
  const hasClosing = market.closingNumber && /^\d{3}$/.test(String(market.closingNumber));
  const isStartline = market.marketType === 'startline';
  if (isStartline && hasOpening) return 'closed';
  if (hasOpening && hasClosing) return 'closed';
  if (hasOpening && !hasClosing) return 'running';
  return 'open';
};

const StartlineDashboard = () => {
  const navigate = useNavigate();
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);

  const balanceText = useMemo(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || 'null');
      const b = Number(u?.balance ?? u?.walletBalance ?? u?.wallet ?? 0) || 0;
      return `${b}`;
    } catch {
      return '0';
    }
  }, []);

  const fetchMarkets = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/markets/get-markets`);
      const data = await res.json();
      if (data?.success && Array.isArray(data?.data)) {
        const onlyStarline = data.data.filter((m) => {
          if (m.marketType === 'startline') return true;
          const name = (m?.marketName || '').toString().toLowerCase();
          return name.includes('starline') || name.includes('startline') || name.includes('star line') || name.includes('start line');
        });
        const mapped = onlyStarline
          .map((m) => {
            const status = getMarketStatus(m);
            return {
              id: m._id,
              marketName: m.marketName,
              startingTime: m.startingTime,
              closingTime: m.closingTime,
              openingNumber: m.openingNumber || null,
              closingNumber: m.closingNumber || null,
              displayResult: m.displayResult || null,
              status,
            };
          })
          .sort((a, b) => String(a.startingTime || '').localeCompare(String(b.startingTime || '')));
        setMarkets(mapped);
      } else {
        setMarkets([]);
      }
    } catch {
      setMarkets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarkets();
  }, []);

  useRefreshOnMarketReset(fetchMarkets);

  const starlineMenuMarkets = useMemo(() => ([
    { key: 'kalyan', label: 'Kalyan Starline' },
    { key: 'milan', label: 'Milan Starline' },
    { key: 'radha', label: 'Radha Starline' },
  ]), []);

  const openStarlineMarket = (key) => {
    const label = starlineMenuMarkets.find((m) => m.key === key)?.label || 'Starline';
    navigate('/starline-market', {
      state: {
        marketKey: key,
        marketLabel: label,
      },
    });
  };

  return (
    <div className="min-h-screen bg-black text-white pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
      <div className="w-full max-w-xl md:max-w-4xl lg:max-w-5xl mx-auto px-4 sm:px-6 md:px-8 pt-3">
        {/* Header row (as per screenshot, in our theme) */}
        <div className="flex items-center justify-between gap-3 md:rounded-3xl md:border md:border-white/10 md:bg-[#111113] md:px-6 md:py-5 md:shadow-[0_18px_48px_rgba(0,0,0,0.55)]">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-11 h-11 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white active:scale-95 transition shrink-0"
              aria-label="Back"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="text-lg sm:text-xl md:text-2xl font-extrabold tracking-wide truncate">
              STARLINE DASHBOARD
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/bank')}
            className="shrink-0 rounded-full bg-[#202124] border border-white/10 px-4 py-2 flex items-center gap-2 shadow-[0_8px_18px_rgba(0,0,0,0.35)]"
            aria-label="Wallet"
            title="Wallet"
          >
            <svg className="w-5 h-5 text-[#d4af37]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2h9a2 2 0 002-2v-2" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12h6v4h-6z" />
            </svg>
            <span className="font-bold text-white/90">{balanceText}</span>
          </button>
        </div>

        <div className="hidden md:block mt-4 text-sm text-white/60">
          Choose a market to view hourly slots and play.
        </div>

        <div className="mt-4 md:mt-6 h-px bg-white/10 md:bg-white/5" />

        {/* 3 Starline markets (as per screenshot) */}
        <div className="mt-5 grid grid-cols-3 gap-3 md:gap-6">
          {starlineMenuMarkets.map((m) => (
            <div key={m.key} className="text-center">
              <button
                type="button"
                onClick={() => openStarlineMarket(m.key)}
                className="group w-full rounded-2xl md:rounded-3xl border border-white/10 bg-[#202124] px-2.5 py-3 md:px-5 md:py-6 shadow-[0_10px_22px_rgba(0,0,0,0.35)] hover:border-[#d4af37]/40 hover:bg-[#222] active:scale-[0.98] md:hover:-translate-y-1 md:hover:shadow-[0_22px_60px_rgba(0,0,0,0.6)] transition-all"
                aria-label={m.label}
              >
                <div className="mx-auto w-12 h-12 md:w-16 md:h-16 rounded-2xl md:rounded-3xl bg-gradient-to-br from-[#f2c14e] to-[#d4af37] border border-black/20 flex items-center justify-center text-[#4b3608] shadow-[0_8px_18px_rgba(242,193,78,0.22)] group-hover:shadow-[0_10px_28px_rgba(242,193,78,0.28)] transition-shadow">
                  {m.key === 'kalyan' ? (
                    <svg className="w-7 h-7 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : m.key === 'milan' ? (
                    <svg className="w-7 h-7 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 12a8 8 0 1016 0 8 8 0 00-16 0z" />
                    </svg>
                  ) : (
                    <svg className="w-7 h-7 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l2.6 5.27 5.8.84-4.2 4.09 1 5.8L12 16.9 6.8 19l1-5.8-4.2-4.09 5.8-.84L12 3z" />
                    </svg>
                  )}
                </div>
                <div className="mt-2 text-[10px] min-[375px]:text-[11px] md:text-xs font-semibold text-[#d4af37]/90">
                  Click to Play Game
                </div>
              </button>
              <div className="mt-2 text-[11px] min-[375px]:text-xs md:text-sm font-semibold text-white/90 leading-tight">
                {m.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StartlineDashboard;

