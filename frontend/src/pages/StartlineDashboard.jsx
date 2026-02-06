import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import { isPastClosingTime } from '../utils/marketTiming';

const formatTime = (time24) => {
  if (!time24) return '';
  const [hours, minutes] = String(time24).split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

const sumDigits = (s) => [...String(s)].reduce((acc, c) => acc + (Number(c) || 0), 0);
const openDigit = (open3) => (open3 && /^\d{3}$/.test(String(open3)) ? String(sumDigits(open3) % 10) : '*');

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
  const [notifyOn, setNotifyOn] = useState(false);
  const [warning, setWarning] = useState('');
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

  useEffect(() => {
    try {
      const v = localStorage.getItem('startlineNotifyOn');
      setNotifyOn(v === '1');
    } catch (_) {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('startlineNotifyOn', notifyOn ? '1' : '0');
    } catch (_) {}
  }, [notifyOn]);

  useEffect(() => {
    let alive = true;
    const fetchMarkets = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/markets/get-markets`);
        const data = await res.json();
        if (!alive) return;
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
        if (alive) setMarkets([]);
      } finally {
        if (alive) setLoading(false);
      }
    };
    fetchMarkets();
    return () => {
      alive = false;
    };
  }, []);

  const chips = [
    { title: 'Single Digit', range: '1-10' },
    { title: 'Double Pana', range: '1-320' },
    { title: 'Single Pana', range: '1-160' },
    { title: 'Triple Pana', range: '1-900' },
  ];

  // Static fallback cards (when backend has no starline markets yet)
  const fallbackMarkets = useMemo(() => ([
    { id: 'sl-0100', marketName: 'STARLINE 01:00 AM', startingTime: '01:00', closingTime: '01:00', openingNumber: null, closingNumber: null, status: 'open' },
    { id: 'sl-1800', marketName: 'STARLINE 06:00 PM', startingTime: '18:00', closingTime: '18:00', openingNumber: null, closingNumber: null, status: 'closed' },
    { id: 'sl-1900', marketName: 'STARLINE 07:00 PM', startingTime: '19:00', closingTime: '19:00', openingNumber: null, closingNumber: null, status: 'closed' },
    { id: 'sl-2000', marketName: 'STARLINE 08:00 PM', startingTime: '20:00', closingTime: '20:00', openingNumber: null, closingNumber: null, status: 'running' },
    { id: 'sl-2100', marketName: 'STARLINE 09:00 PM', startingTime: '21:00', closingTime: '21:00', openingNumber: null, closingNumber: null, status: 'running' },
    { id: 'sl-2200', marketName: 'STARLINE 10:00 PM', startingTime: '22:00', closingTime: '22:00', openingNumber: null, closingNumber: null, status: 'open' },
    { id: 'sl-2300', marketName: 'STARLINE 11:00 PM', startingTime: '23:00', closingTime: '23:00', openingNumber: null, closingNumber: null, status: 'open' },
  ]), []);

  const showWarning = (msg) => {
    setWarning(msg);
    window.clearTimeout(showWarning._t);
    showWarning._t = window.setTimeout(() => setWarning(''), 2200);
  };

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <div className="w-full max-w-xl mx-auto px-4 sm:px-6 md:px-8 pt-3">
        {/* Header row (as per screenshot, in our theme) */}
        <div className="flex items-center justify-between gap-3">
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
            <div className="text-lg sm:text-xl font-extrabold tracking-wide truncate">
              STARTLINE DASHBOARD
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

        <div className="mt-4 h-px bg-white/10" />

        {/* History + Notification toggle row */}
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/bids?tab=starline-bet-history')}
            className="flex items-center gap-3 text-white/80 hover:text-white transition-colors"
          >
            <div className="w-10 h-10 rounded-2xl bg-[#202124] border border-white/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#d4af37]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-base font-semibold">History</span>
          </button>

          <div className="flex items-center gap-3">
            <span className="text-base text-white/70">Notification</span>
            <button
              type="button"
              onClick={() => setNotifyOn((v) => !v)}
              className={`w-14 h-8 rounded-full border transition-colors ${
                notifyOn ? 'bg-[#25d366]/25 border-[#25d366]/40' : 'bg-[#202124] border-white/10'
              }`}
              aria-label="Toggle notifications"
            >
              <div
                className={`h-7 w-7 rounded-full bg-white transition-transform ${
                  notifyOn ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Chips */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {chips.map((c) => (
            <div
              key={c.title}
              className="rounded-2xl bg-[#202124] border border-white/10 px-4 py-3 flex items-center justify-between shadow-[0_10px_22px_rgba(0,0,0,0.35)]"
            >
              <div className="font-semibold text-white">{c.title}</div>
              <div className="font-extrabold text-[#d4af37]">{c.range}</div>
            </div>
          ))}
        </div>

        {/* List */}
        <div className="mt-4 space-y-3">
          {warning ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center text-red-200 text-sm">
              {warning}
            </div>
          ) : null}
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-[#202124] p-6 text-center text-gray-300">
              Loading...
            </div>
          ) : (
            (markets.length ? markets : fallbackMarkets).map((m) => {
              const timeLabel = formatTime(m.startingTime) || '-';
              const closedText = m.status === 'closed' ? 'Close for today' : m.status === 'running' ? 'Running' : 'Open';
              const pill = (m.displayResult && String(m.displayResult).includes(' - '))
                ? String(m.displayResult)
                : `${m.openingNumber && /^\d{3}$/.test(String(m.openingNumber)) ? String(m.openingNumber) : '***'} - ${openDigit(m.openingNumber)}`;
              const statusColor = m.status === 'closed' ? 'text-red-400' : m.status === 'running' ? 'text-[#43b36a]' : 'text-[#43b36a]';
              const isFallback = String(m.id || '').startsWith('sl-');
              const canPlay = m.status !== 'closed';

              return (
                <div
                  key={m.id}
                  className="rounded-2xl bg-[#202124] border border-white/10 p-3 sm:p-4 shadow-[0_10px_22px_rgba(0,0,0,0.35)] grid grid-cols-[92px_1fr_auto] sm:grid-cols-[120px_1fr_auto] items-center gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-base sm:text-lg font-extrabold text-white leading-tight">{timeLabel}</div>
                    <div className={`text-xs sm:text-sm font-semibold ${statusColor} leading-tight`}>{closedText}</div>
                  </div>

                  <div className="justify-self-center px-5 sm:px-6 py-2 rounded-full bg-black text-white font-extrabold tracking-wide border border-white/10 whitespace-nowrap leading-none text-[15px] sm:text-base">
                    {pill}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!canPlay) return;
                      if (isFallback) {
                        // UI-only mock starline market: still allow BidOptions open.
                        navigate('/bidoptions', {
                          state: {
                            marketType: 'starline',
                            market: {
                              _id: m.id,
                              marketName: m.marketName,
                              gameName: m.marketName,
                              startingTime: m.startingTime,
                              closingTime: m.closingTime,
                              betClosureTime: 0,
                              openingNumber: null,
                              closingNumber: null,
                              status: m.status,
                              isMock: true,
                            },
                          },
                        });
                        return;
                      }
                      navigate('/bidoptions', {
                        state: {
                          marketType: 'starline',
                          market: {
                            _id: m.id,
                            marketName: m.marketName,
                            gameName: m.marketName,
                            startingTime: m.startingTime,
                            closingTime: m.closingTime,
                            openingNumber: m.openingNumber,
                            closingNumber: m.closingNumber,
                            status: m.status,
                          },
                        },
                      });
                    }}
                    disabled={!canPlay}
                    className={`justify-self-end rounded-full border px-3 sm:px-4 py-2 font-bold flex items-center gap-2 whitespace-nowrap min-w-0 transition-colors ${
                      canPlay
                        ? 'bg-black/20 border-white/20 text-white hover:border-[#d4af37]/40'
                        : 'bg-black/15 border-white/10 text-white/40 cursor-not-allowed'
                    }`}
                  >
                    <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/10">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M6 4l10 6-10 6V4z" />
                      </svg>
                    </span>
                    <span className="text-[13px] sm:text-sm">Play Game</span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default StartlineDashboard;

