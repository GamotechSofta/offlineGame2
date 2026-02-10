import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import { isPastClosingTime } from '../utils/marketTiming';

const STARLINE_MARKET_IMAGE_URL =
  'https://res.cloudinary.com/dzd47mpdo/image/upload/v1770641576/Untitled_1080_x_1080_px_1_gyjbpl.svg';

const STARLINE_MARKET_FIRST_IMAGE_URL =
  'https://res.cloudinary.com/dzd47mpdo/image/upload/v1770708947/Untitled_design_11_1_1_fqrqpr.png';

const STARLINE_MARKET_SECOND_IMAGE_URL =
  'https://res.cloudinary.com/dzd47mpdo/image/upload/v1770708832/Untitled_design_10_2_1_x8ji72.png';

const STARLINE_MARKET_THIRD_IMAGE_URL =
  'https://res.cloudinary.com/dzd47mpdo/image/upload/v1770707277/Untitled_design_3_1_qqgezq.png';

const STARLINE_MARKET_FOURTH_IMAGE_URL =
  'https://res.cloudinary.com/dzd47mpdo/image/upload/v1770707757/Untitled_design_4_1_wm47pu.png';

const STARLINE_MARKET_FIFTH_IMAGE_URL =
  'https://res.cloudinary.com/dzd47mpdo/image/upload/v1770708463/Untitled_design_7_1_b7mxik.png';

const STARLINE_MARKET_SIXTH_IMAGE_URL =
  'https://res.cloudinary.com/dzd47mpdo/image/upload/v1770708044/Untitled_design_5_2_op4u73.png';

const STARLINE_MARKET_SEVENTH_IMAGE_URL =
  'https://res.cloudinary.com/dzd47mpdo/image/upload/v1770708574/Untitled_design_8_1_zdpype.png';

// Reuse existing (already hosted) assets so every slot can have a unique image.
const STARLINE_MARKET_EIGHTH_IMAGE_URL =
  'https://res.cloudinary.com/dzd47mpdo/image/upload/v1770708678/Untitled_design_9_1_oc8usl.png';
const STARLINE_MARKET_NINTH_IMAGE_URL =
  'https://res.cloudinary.com/dzd47mpdo/image/upload/v1770714783/Untitled_design_14_1_hmsbwv.png';
const STARLINE_MARKET_TENTH_IMAGE_URL =
  'https://res.cloudinary.com/dzd47mpdo/image/upload/v1770708947/Untitled_design_11_1_1_fqrqpr.png';
const STARLINE_MARKET_ELEVENTH_IMAGE_URL =
  'https://res.cloudinary.com/dzd47mpdo/image/upload/v1770708463/Untitled_design_7_1_b7mxik.png';
const STARLINE_MARKET_TWELFTH_IMAGE_URL =
  'https://res.cloudinary.com/dzd47mpdo/image/upload/v1770708678/Untitled_design_9_1_oc8usl.png';
const STARLINE_MARKET_THIRTEENTH_IMAGE_URL =
  'https://res.cloudinary.com/dzd47mpdo/image/upload/v1770708832/Untitled_design_10_2_1_x8ji72.png';
const STARLINE_MARKET_FOURTEENTH_IMAGE_URL =
  'https://res.cloudinary.com/dzd47mpdo/image/upload/v1770714882/Untitled_design_15_1_wdsvi9.png';

// Order matches `scheduleTimes`: 11:00, 12:00, ..., 23:00, 00:00
const STARLINE_MARKET_IMAGE_OVERRIDES = [
  STARLINE_MARKET_FIRST_IMAGE_URL,
  STARLINE_MARKET_SECOND_IMAGE_URL,
  STARLINE_MARKET_THIRD_IMAGE_URL,
  STARLINE_MARKET_FOURTH_IMAGE_URL,
  STARLINE_MARKET_FIFTH_IMAGE_URL,
  STARLINE_MARKET_SIXTH_IMAGE_URL,
  STARLINE_MARKET_SEVENTH_IMAGE_URL,
  STARLINE_MARKET_EIGHTH_IMAGE_URL,
  STARLINE_MARKET_NINTH_IMAGE_URL,
  STARLINE_MARKET_TENTH_IMAGE_URL,
  STARLINE_MARKET_ELEVENTH_IMAGE_URL,
  STARLINE_MARKET_TWELFTH_IMAGE_URL,
  STARLINE_MARKET_THIRTEENTH_IMAGE_URL,
  STARLINE_MARKET_FOURTEENTH_IMAGE_URL,
];

/** Ensure market _id from API is a string (handles { $oid: "..." } or string). */
const toMarketIdString = (v) => {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'object' && v?.$oid) return String(v.$oid).trim();
  return String(v).trim();
};

/** Normalize "10:0" / "9:00" to "10:00" / "09:00" so backend slots match scheduleTimes. */
const normalizeTimeKey = (t) => {
  const s = String(t ?? '').trim().slice(0, 5);
  const [hh, mm] = s.split(':');
  if (hh === undefined || hh === '') return '';
  const h = String(Number(hh) || 0).padStart(2, '0');
  const m = (mm !== undefined && mm !== '') ? String(Number(mm) || 0).padStart(2, '0') : '00';
  return `${h}:${m}`;
};

const formatTime12 = (time24) => {
  if (!time24) return '';
  const [hhRaw, mmRaw] = String(time24).split(':');
  const hh = Number(hhRaw);
  const mm = Number(mmRaw);
  if (!Number.isFinite(hh)) return String(time24);
  const ampm = hh >= 12 ? 'pm' : 'am';
  const h12 = hh % 12 || 12;
  const min = Number.isFinite(mm) ? String(mm).padStart(2, '0') : '00';
  return `${h12}:${min} ${ampm}`;
};

const sumDigits = (s) => [...String(s)].reduce((acc, c) => acc + (Number(c) || 0), 0);
const openDigit = (open3) => (open3 && /^\d{3}$/.test(String(open3)) ? String(sumDigits(open3) % 10) : '*');

const getTodayIST = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

const addDaysIST = (yyyyMmDd, days) => {
  const base = new Date(`${yyyyMmDd}T12:00:00+05:30`);
  base.setDate(base.getDate() + days);
  return getTodayIST(base);
};

const getTodayTargetMsIST = (timeHHMM, nowMs) => {
  const todayIST = getTodayIST(new Date(nowMs));
  const t = (timeHHMM || '').toString().slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(t)) return null;
  // Special-case 00:00: treat as end-of-day midnight (next day) for this schedule.
  const dateStr = t === '00:00' ? addDaysIST(todayIST, 1) : todayIST;
  const targetToday = new Date(`${dateStr}T${t}:00+05:30`).getTime();
  if (Number.isNaN(targetToday)) return null;
  return targetToday;
};

const msUntilNextIST = (timeHHMM, nowMs) => {
  const targetToday = getTodayTargetMsIST(timeHHMM, nowMs);
  if (targetToday == null) return null;
  const todayIST = getTodayIST(new Date(nowMs));
  const t = (timeHHMM || '').toString().slice(0, 5);
  const target = targetToday > nowMs ? targetToday : new Date(`${addDaysIST(todayIST, 1)}T${t}:00+05:30`).getTime();
  if (Number.isNaN(target)) return null;
  return Math.max(0, target - nowMs);
};

const isSlotClosedTodayIST = (timeHHMM, nowMs) => {
  const targetToday = getTodayTargetMsIST(timeHHMM, nowMs);
  if (targetToday == null) return true;
  return nowMs >= targetToday;
};

const formatCountdown = (ms) => {
  if (ms == null) return '';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
};

const StarlineMarket = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const marketKey = (location.state?.marketKey || location.state?.key || '').toString().trim().toLowerCase();
  const marketLabel = (location.state?.marketLabel || location.state?.label || 'Starline').toString();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState([]);
  const [tick, setTick] = useState(() => Date.now());

  const fetchSlots = React.useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/markets/get-markets`);
      const data = await res.json();
      const list = Array.isArray(data?.data) ? data.data : [];

      const filtered = list.filter((m) => {
        const name = (m?.marketName || m?.gameName || '').toString().toLowerCase();
        const isStar = m?.marketType === 'startline' || name.includes('starline') || name.includes('startline');
        if (!isStar) return false;
        const group = (m?.starlineGroup || '').toString().toLowerCase();
        if (!marketKey) return true;
        if (group) return group === marketKey;
        return name.includes(marketKey);
      });

      const mapped = filtered
        .map((m) => {
          const st = normalizeTimeKey(m.startingTime) || (m.startingTime || '').toString().trim().slice(0, 5);
          const status = isPastClosingTime(m) ? 'closed' : (m.openingNumber && /^\d{3}$/.test(String(m.openingNumber)) ? 'closed' : 'open');
          return {
            id: toMarketIdString(m._id) || m._id,
            marketName: m.marketName || m.gameName || marketLabel,
            startingTime: st || null,
            closingTime: m.closingTime || m.startingTime || null,
            openingNumber: m.openingNumber || null,
            closingNumber: m.closingNumber || null,
            status,
          };
        })
        .sort((a, b) => String(a.startingTime || '').localeCompare(String(b.startingTime || '')));

      setItems(mapped);
    } catch {
      setItems([]);
    }
  }, [marketKey, marketLabel]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      await fetchSlots();
      if (!cancelled) setLoading(false);
    };
    run();
    return () => { cancelled = true; };
  }, [fetchSlots]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSlots();
    setRefreshing(false);
  };

  // Refetch when user returns to tab so new admin-added slots appear
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') fetchSlots(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [fetchSlots]);

  useEffect(() => {
    const t = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const title = marketLabel || 'Starline';

  return (
    <div className="min-h-screen bg-black text-white pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
      <div className="w-full max-w-xl md:max-w-6xl lg:max-w-7xl mx-auto px-4 sm:px-6 md:px-8 pt-3">
        <div className="flex items-center gap-3 md:gap-4 md:rounded-3xl md:border md:border-white/10 md:bg-[#111113] md:px-6 md:py-5 md:shadow-[0_18px_48px_rgba(0,0,0,0.55)]">
          <button
            type="button"
            onClick={() => navigate('/startline-dashboard')}
            className="w-11 h-11 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white active:scale-95 transition shrink-0"
            aria-label="Back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-sm text-white/60 leading-none">Starline Market</div>
            <div className="text-lg sm:text-xl md:text-2xl font-extrabold tracking-wide truncate">{title}</div>
            <div className="hidden sm:block mt-1 text-xs text-white/50">Select a time slot to place bets. Green = open, red = closed for today.</div>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="shrink-0 p-2.5 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15 disabled:opacity-50 transition"
            title="Refresh slots"
            aria-label="Refresh slots"
          >
            <svg className={`w-5 h-5 text-white ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          {/* Desktop legend */}
          <div className="hidden md:flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-2 text-xs text-white/70">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400/90 shadow-[0_0_14px_rgba(52,211,153,0.35)]" />
              Open
            </div>
            <div className="flex items-center gap-2 text-xs text-white/70">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-400/90 shadow-[0_0_14px_rgba(251,113,133,0.28)]" />
              Closed
            </div>
          </div>
        </div>

        {!loading && items.length === 0 && (
          <div className="mt-4 md:mt-6 p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-sm">
            <p className="font-medium">No time slots have been created for {title} yet.</p>
            <p className="mt-1 text-amber-200/90">Time slots need to be added in <strong>Admin → Markets → Starline Market</strong> (select this market and add slots). New slots will appear here when added.</p>
          </div>
        )}

        <div className="mt-4 md:mt-6 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 md:gap-5">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[225px] md:h-[285px] rounded-2xl md:rounded-3xl bg-[#202124] border border-white/10 animate-pulse" />
            ))
          ) : (
            items.map((m, idx) => {
              const timeLabel = formatTime12(m.startingTime) || '-';
              const slotClosed = isSlotClosedTodayIST(m.startingTime, tick);
              const statusText = slotClosed ? 'Close For Today' : 'Open';
              const pill = `${m.openingNumber && /^\d{3}$/.test(String(m.openingNumber)) ? String(m.openingNumber) : '***'} - ${openDigit(m.openingNumber)}`;
              const canOpen = !slotClosed;
              const countdown = formatCountdown(msUntilNextIST(m.startingTime, tick));
              const imageUrl = STARLINE_MARKET_IMAGE_OVERRIDES[idx % STARLINE_MARKET_IMAGE_OVERRIDES.length] || STARLINE_MARKET_IMAGE_URL;
              const isFourteenthImage = imageUrl === STARLINE_MARKET_FOURTEENTH_IMAGE_URL;

              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={!canOpen}
                  onClick={() => {
                    if (!canOpen) return;
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
                          status: m.status === 'running' ? 'running' : 'open',
                        },
                      },
                    });
                  }}
                  className={`relative overflow-hidden rounded-3xl border shadow-[0_16px_34px_rgba(0,0,0,0.55)] transition md:hover:-translate-y-1 md:hover:shadow-[0_22px_60px_rgba(0,0,0,0.65)] ${
                    canOpen
                      ? 'border-white/10 hover:border-[#d4af37]/40 active:scale-[0.99] cursor-pointer'
                      : 'border-white/10 opacity-95 cursor-not-allowed'
                  }`}
                >
                  {/* Top image area (photo-style) */}
                  <div className="relative h-[150px] md:h-[190px] overflow-hidden bg-gradient-to-br from-[#0b0b0b] via-[#15171b] to-[#050505]">
                    <img
                      src={imageUrl}
                      alt="Starline Market"
                      className={`absolute inset-0 w-full h-full object-contain p-0 ${isFourteenthImage ? 'scale-125' : ''} ${
                        canOpen ? '' : 'opacity-70 md:grayscale'
                      }`}
                      loading="lazy"
                      draggable="false"
                    />
                  </div>

                  {/* Bottom info area */}
                  <div className="bg-[#202124] border-t border-white/10 px-3 py-2.5 md:px-4 md:py-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[12px] md:text-sm font-extrabold text-[#d4af37] truncate">
                        {countdown}
                      </div>
                      <div className="text-[13px] md:text-sm font-extrabold text-white/90 whitespace-nowrap">{timeLabel}</div>
                    </div>

                    <div className="mt-1 flex items-center justify-between gap-2">
                      <div className="text-[16px] md:text-[18px] font-extrabold text-[#d4af37] tracking-wide">
                        {pill}
                      </div>
                      <svg className="w-4 h-4 text-white/55 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>

                    <div
                      className={`mt-1 text-center text-[12px] font-semibold ${
                        statusText === 'Close For Today'
                          ? 'text-red-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {statusText}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default StarlineMarket;

