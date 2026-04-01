import React, { useEffect, useRef, useState } from 'react';

/** Project palette: navy #1B3150, gold #f3b61b (see Bids.jsx / Profile) */
const NAVY = '#1B3150';
const GOLD = '#f3b61b';

const shortBetId = (id) => {
  const s = (id ?? '').toString();
  if (!s) return '—';
  return s.length <= 8 ? s.toLowerCase() : s.slice(-8).toLowerCase();
};

const statusTone = (label) => {
  const u = String(label || '').toLowerCase();
  if (u === 'pending') return 'text-[#f3b61b] font-semibold';
  if (u === 'win') return 'text-green-600 font-semibold';
  if (u === 'loose' || u === 'lose' || u === 'lost') return 'text-red-600 font-semibold';
  return 'text-gray-800';
};

const fmtRupee = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 0) return '—';
  return `₹${x.toLocaleString('en-IN')}`;
};

/**
 * Bet card aligned with app theme (navy + gold accents, white surface).
 */
const BetHistoryCard = ({
  index,
  betId,
  session,
  marketTitle,
  gameLabel,
  betValue,
  betAmount,
  winPayout,
  points,
  statusLabel,
  timeFormatted,
}) => {
  const stake = betAmount ?? points ?? 0;
  const sid = shortBetId(betId);
  const sess = (session || '').toString().trim().toUpperCase() || '—';
  const isWin = String(statusLabel || '').toLowerCase() === 'win';
  const [showCopiedPopup, setShowCopiedPopup] = useState(false);
  const copyPopupTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (copyPopupTimerRef.current) window.clearTimeout(copyPopupTimerRef.current);
    };
  }, []);

  const copyId = async () => {
    const full = (betId ?? '').toString();
    if (!full) return;
    try {
      await navigator.clipboard.writeText(full);
      if (copyPopupTimerRef.current) window.clearTimeout(copyPopupTimerRef.current);
      setShowCopiedPopup(true);
      copyPopupTimerRef.current = window.setTimeout(() => {
        setShowCopiedPopup(false);
        copyPopupTimerRef.current = null;
      }, 2200);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className={`rounded-xl border-2 p-3 sm:p-3.5 text-gray-800 transition-[box-shadow,border-color,background-color] duration-200 relative ${
        isWin
          ? 'bg-green-50 border-green-600/45 shadow-[0_1px_6px_rgba(22,163,74,0.07)] hover:bg-green-100/80 hover:border-green-600/55 hover:shadow-[0_1px_8px_rgba(22,163,74,0.1)]'
          : 'bg-white border-gray-200 shadow-sm hover:border-[#1B3150]/25'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] sm:text-xs text-gray-500 font-medium">#{index}</span>
        <span
          className="text-[10px] sm:text-[11px] font-bold rounded-md px-2 py-0.5 uppercase tracking-wide border-2"
          style={{ color: NAVY, borderColor: GOLD, backgroundColor: `${GOLD}18` }}
        >
          {sess}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] sm:text-xs mb-2">
        <span className="text-gray-500 shrink-0">Bet ID</span>
        <div className="flex items-center gap-1.5 min-w-0 justify-end">
          <span className="font-mono text-gray-800 truncate" title={betId}>
            {sid}
          </span>
          <button
            type="button"
            onClick={copyId}
            className="shrink-0 p-1 rounded text-gray-400 hover:text-[#1B3150] hover:bg-gray-100 transition-colors"
            aria-label="Copy bet ID"
            title="Copy"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      </div>

      <div
        className="font-extrabold text-sm sm:text-base tracking-wide mb-2.5 truncate uppercase"
        style={{ color: NAVY }}
        title={marketTitle}
      >
        {marketTitle}
      </div>

      <div className="space-y-1 text-[11px] sm:text-xs">
        <div className="flex justify-between gap-3">
          <span className="text-gray-500 shrink-0">Game</span>
          <span className="text-gray-800 text-right min-w-0 font-medium">{gameLabel}</span>
        </div>
        <div className="flex justify-between gap-3 items-center">
          <span className="text-gray-500 shrink-0">Bet</span>
          <div className="text-gray-900 text-right min-w-0 font-semibold tabular-nums">
            {betValue}
          </div>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-gray-500 shrink-0">Bet amount</span>
          <span className="text-gray-900 text-right font-semibold tabular-nums">{fmtRupee(stake)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-gray-500 shrink-0">Win amount</span>
          <span
            className={`text-right font-semibold tabular-nums ${
              String(statusLabel || '').toLowerCase() === 'win' ? 'text-green-600' : 'text-gray-400'
            }`}
          >
            {String(statusLabel || '').toLowerCase() === 'win' ? fmtRupee(winPayout ?? 0) : '—'}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-gray-500 shrink-0">Status</span>
          <span className={`text-right font-semibold ${statusTone(statusLabel)}`}>{statusLabel}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-gray-500 shrink-0">Time</span>
          <span className="text-gray-600 text-right leading-snug">{timeFormatted}</span>
        </div>
      </div>

      {showCopiedPopup ? (
        <div
          className="fixed left-1/2 -translate-x-1/2 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-[1000] px-4 py-2.5 rounded-xl border-2 shadow-lg text-sm font-semibold"
          style={{
            color: NAVY,
            borderColor: GOLD,
            backgroundColor: '#fff',
            boxShadow: '0 10px 40px rgba(27,49,80,0.2)',
          }}
          role="status"
        >
          Bet ID copied
        </div>
      ) : null}
    </div>
  );
};

export default BetHistoryCard;
