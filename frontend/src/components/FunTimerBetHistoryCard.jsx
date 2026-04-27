import React from 'react';

const NAVY = '#1B3150';
const GOLD = '#f3b61b';

const shortBetId = (id) => {
  const s = (id ?? '').toString().trim();
  if (!s) return '—';
  return s.length <= 8 ? s.toLowerCase() : s.slice(-8).toLowerCase();
};

const formatCurrency = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return '—';
  return `₹${v.toLocaleString('en-IN')}`;
};

const getStatusMeta = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'won' || s === 'win') {
    return {
      label: 'Won',
      tone: 'text-green-700 border-green-500 bg-green-50',
      cardTone: 'bg-green-50 border-green-600/45',
    };
  }
  if (s === 'lost' || s === 'loss' || s === 'lose') {
    return {
      label: 'Lost',
      tone: 'text-red-700 border-red-500 bg-red-50',
      cardTone: 'bg-red-50 border-red-600/45',
    };
  }
  return {
    label: 'Pending',
    tone: 'text-amber-700 border-amber-400 bg-amber-50',
    cardTone: 'bg-white border-gray-200',
  };
};

const FunTimerBetHistoryCard = ({
  index,
  betId,
  userName,
  betNumber,
  betAmount,
  winAmount,
  statusLabel,
  timeFormatted,
}) => {
  const sid = shortBetId(betId);
  const status = getStatusMeta(statusLabel);
  const normalizedWinAmount = Number.isFinite(Number(winAmount)) ? Number(winAmount) : 0;
  const isWon = status.label === 'Won';

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
    <div className={`h-full rounded-xl border-2 p-3 sm:p-3.5 text-gray-800 ${status.cardTone}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-gray-500 sm:text-xs">#{index}</span>
        <span
          className="rounded-md border-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide sm:text-[11px]"
          style={{ color: NAVY, borderColor: GOLD, backgroundColor: `${GOLD}18` }}
        >
          GAME
        </span>
      </div>

      {userName ? (
        <div className="mb-2 flex items-center justify-between gap-2 text-[11px] sm:text-xs">
          <span className="shrink-0 text-gray-500">User</span>
          <span className="min-w-0 truncate text-right font-semibold uppercase text-gray-800" title={userName}>
            {userName}
          </span>
        </div>
      ) : null}

      <div className="mb-2 flex items-center justify-between gap-2 text-[11px] sm:text-xs">
        <span className="shrink-0 text-gray-500">Bet ID</span>
        <div className="flex min-w-0 items-center justify-end gap-1.5">
          <span className="min-w-0 truncate font-mono text-gray-800" title={betId}>
            {sid}
          </span>
          {!!betId && (
            <button
              type="button"
              onClick={handleCopyBetId}
              className="shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-[#1B3150]"
              aria-label="Copy Bet ID"
              title="Copy"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2M10 20h8a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="mb-2 truncate text-sm font-extrabold uppercase tracking-wide sm:text-base" style={{ color: NAVY }}>
        FunTimer
      </div>

      <div className="space-y-1 text-[11px] sm:text-xs">
        <div className="flex justify-between gap-3">
          <span className="shrink-0 text-gray-500">Game</span>
          <span className="text-right font-medium text-gray-800">game - FunTimer</span>
        </div>

        <div className="flex justify-between gap-3">
          <span className="shrink-0 text-gray-500">Total Play</span>
          <span className="text-right font-semibold tabular-nums text-gray-900">{formatCurrency(betAmount)}</span>
        </div>

        <div className="flex justify-between gap-3">
          <span className="shrink-0 text-gray-500">Payout</span>
          <span className={`text-right font-semibold tabular-nums ${isWon ? 'text-green-600' : 'text-gray-500'}`}>
            {formatCurrency(normalizedWinAmount)}
          </span>
        </div>

        <div className="flex justify-between gap-3">
          <span className="shrink-0 text-gray-500">Status</span>
          <span className={`rounded-md border px-2 py-0.5 text-right text-[11px] font-semibold sm:text-xs ${status.tone}`}>
            {status.label}
          </span>
        </div>

        <div className="flex justify-between gap-3">
          <span className="shrink-0 text-gray-500">Time</span>
          <span className="text-right leading-snug text-gray-600">{timeFormatted || ''}</span>
        </div>
      </div>
    </div>
  );
};

export default FunTimerBetHistoryCard;
