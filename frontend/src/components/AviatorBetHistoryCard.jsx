import React from 'react';

const NAVY = '#1B3150';
const GOLD = '#f3b61b';

const shortBetId = (id) => {
  const s = (id ?? '').toString();
  if (!s) return '—';
  return s.length <= 8 ? s.toLowerCase() : s.slice(-8).toLowerCase();
};

const formatCurrency = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return '—';
  return `₹${v.toLocaleString('en-IN')}`;
};

const AviatorBetHistoryCard = ({ index, betId, betAmount, cashOutAmount, timeFormatted }) => {
  const bet = Number(betAmount) || 0;
  const cash = Number(cashOutAmount) || 0;
  const hasCash = Number.isFinite(Number(cashOutAmount));
  const sid = shortBetId(betId);

  let statusLabel = 'Pending';
  let statusClass = 'text-amber-700 border-amber-400 bg-amber-50';
  if (hasCash) {
    if (bet > cash) {
      statusLabel = 'Loss';
      statusClass = 'text-red-700 border-red-500 bg-red-50';
    } else if (bet < cash) {
      statusLabel = 'Won';
      statusClass = 'text-green-700 border-green-500 bg-green-50';
    } else {
      statusLabel = 'Pending';
      statusClass = 'text-amber-700 border-amber-400 bg-amber-50';
    }
  }

  const cardToneClass =
    statusLabel === 'Won'
      ? 'bg-green-50 border-green-600/45 shadow-[0_1px_6px_rgba(22,163,74,0.07)] hover:bg-green-100/80 hover:border-green-600/55 hover:shadow-[0_1px_8px_rgba(22,163,74,0.1)]'
      : statusLabel === 'Loss'
        ? 'bg-red-50 border-red-600/45 shadow-[0_1px_6px_rgba(220,38,38,0.07)] hover:bg-red-100/80 hover:border-red-600/55 hover:shadow-[0_1px_8px_rgba(220,38,38,0.1)]'
        : 'bg-white border-gray-200 shadow-sm hover:border-[#1B3150]/25';

  const handleCopyBetId = async () => {
    const value = String(betId || '').trim();
    if (!value) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return;
      }
    } catch {
      // Fallback below
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.setAttribute('readonly', 'true');
      ta.style.position = 'absolute';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch {
      // No-op if copy is blocked.
    }
  };

  return (
    <div className={`h-full rounded-xl border-2 p-3 sm:p-3.5 text-gray-800 transition-[box-shadow,border-color,background-color] duration-200 ${cardToneClass}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] sm:text-xs text-gray-500 font-medium">#{index}</span>
        <span
          className="text-[10px] sm:text-[11px] font-bold rounded-md px-2 py-0.5 uppercase tracking-wide border-2"
          style={{ color: NAVY, borderColor: GOLD, backgroundColor: `${GOLD}18` }}
        >
          GAME
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] sm:text-xs mb-2">
        <span className="text-gray-500 shrink-0">Bet ID</span>
        <div className="flex items-center gap-1.5 min-w-0 justify-end">
          <span className="font-mono text-gray-800 truncate" title={betId}>
            {sid}
          </span>
          {!!betId && (
            <button
              type="button"
              onClick={handleCopyBetId}
              className="shrink-0 p-1 rounded text-gray-400 hover:text-[#1B3150] hover:bg-gray-100 transition-colors"
              aria-label="Copy Bet ID"
              title="Copy"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2M10 20h8a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div
        className="font-extrabold text-sm sm:text-base tracking-wide mb-2.5 truncate uppercase"
        style={{ color: NAVY }}
        title="AVIATOR"
      >
        AVIATOR
      </div>

      <div className="space-y-1 text-[11px] sm:text-xs">
        <div className="flex justify-between gap-3">
          <span className="text-gray-500 shrink-0">Game</span>
          <span className="text-gray-800 text-right min-w-0 font-medium">Aviator</span>
        </div>

        <div className="flex justify-between gap-3">
          <span className="text-gray-500 shrink-0">Bet</span>
          <span className="text-gray-900 text-right min-w-0 font-semibold tabular-nums">{sid}</span>
        </div>

        <div className="flex justify-between gap-3">
          <span className="text-gray-500 shrink-0">Bet amount</span>
          <span className="text-gray-900 text-right font-semibold tabular-nums">{formatCurrency(bet)}</span>
        </div>

        <div className="flex justify-between gap-3">
          <span className="text-gray-500 shrink-0">Cash out amount</span>
          <span className={`text-right font-semibold tabular-nums ${hasCash ? 'text-green-600' : 'text-gray-400'}`}>
            {hasCash ? formatCurrency(cash) : '—'}
          </span>
        </div>

        <div className="flex justify-between gap-3">
          <span className="text-gray-500 shrink-0">Status</span>
          <span className={`text-right font-semibold text-[11px] sm:text-xs px-2 py-0.5 rounded-md border ${statusClass}`}>
            {statusLabel}
          </span>
        </div>

        <div className="flex justify-between gap-3">
          <span className="text-gray-500 shrink-0">Time</span>
          <span className="text-gray-600 text-right leading-snug break-words">{timeFormatted || '—'}</span>
        </div>
      </div>
    </div>
  );
};

export default AviatorBetHistoryCard;
