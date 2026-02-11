import React, { useEffect, useState } from 'react';

const formatMoney = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '-';
  return n.toFixed(1);
};

const formatDateTitle = (marketTitle, dateText) => {
  const m = (marketTitle || '').toString().trim();
  const d = (dateText || '').toString().trim();
  if (m && d) return `${m} - ${d}`;
  return m || d || 'Review Bet';
};

const renderBetNumber = (val) => {
  const s = (val ?? '').toString().trim();
  if (/^\d{3}-\d{3}$/.test(s)) {
    const [open, close] = s.split('-');
    const sumDigits = (x) => [...String(x)].reduce((acc, c) => acc + (Number(c) || 0), 0);
    const j1 = sumDigits(open) % 10;
    const j2 = sumDigits(close) % 10;
    return `${open}-${j1}${j2}-${close}`;
  }
  if (/^\d{2}$/.test(s)) {
    return (
      <span className="inline-flex items-center justify-center gap-2">
        <span>{s[0]}</span>
        <span>{s[1]}</span>
      </span>
    );
  }
  return s || '-';
};

const BidReviewModal = ({
  open,
  onClose,
  onSubmit,
  marketTitle,
  dateText,
  labelKey = 'Digit',
  rows = [],
  walletBefore = 0,
  totalBids = 0,
  totalAmount = 0,
  playerName = '',
  showGameType = false,
}) => {
  const [stage, setStage] = useState('review');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (open) {
      setStage('review');
      setSubmitError('');
    }
  }, [open]);

  if (!open && stage !== 'success') return null;

  const before = Number(walletBefore) || 0;
  const amount = Number(totalAmount) || 0;
  const after = before - amount;
  const insufficientBalance = after < 0;

  const handleClose = () => {
    if (onClose) onClose();
  };

  const handleSubmitClick = async () => {
    if (insufficientBalance) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      const fn = onSubmit?.();
      if (fn && typeof fn.then === 'function') await fn;
      setStage('success');
    } catch (e) {
      setSubmitError(e?.message || 'Failed to place bet');
    } finally {
      setSubmitting(false);
    }
  };

  // Group rows by game type if showGameType
  const groupedRows = showGameType
    ? rows.reduce((groups, r) => {
        const key = r.gameTypeLabel || 'Other';
        if (!groups[key]) groups[key] = [];
        groups[key].push(r);
        return groups;
      }, {})
    : null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-3 sm:p-6">
      {stage === 'review' ? (
        <button type="button" onClick={handleClose} aria-label="Close" className="absolute inset-0 bg-black/60" />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-black/60" />
      )}

      <div className="relative w-full max-w-md sm:max-w-lg">
        {stage === 'success' ? (
          <div className="bg-[#202124] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.55)] overflow-hidden border border-white/10">
            <style>{`
              @keyframes successPop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
              @keyframes successDraw { to { stroke-dashoffset: 0; } }
              .success-pop { animation: successPop 420ms ease-out both; }
              .success-check-path { stroke-dasharray: 48; stroke-dashoffset: 48; animation: successDraw 520ms 140ms ease-out forwards; }
            `}</style>
            <div className="p-7 sm:p-8 flex flex-col items-center">
              <div className="success-pop w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#43b36a] flex items-center justify-center shadow-[0_10px_25px_rgba(67,179,106,0.35)]">
                <svg className="w-10 h-10 sm:w-12 sm:h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                  <path className="success-check-path" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="mt-6 text-center">
                <div className="text-[#43b36a] font-semibold text-base sm:text-lg">
                  Bet Placed Successfully{playerName ? ` for ${playerName}` : ''}
                </div>
              </div>
            </div>
            <div className="px-6 pb-6">
              <button
                type="button"
                onClick={() => { setStage('review'); handleClose(); }}
                className="w-full bg-gradient-to-r from-[#d4af37] to-[#cca84d] text-[#4b3608] font-bold py-3.5 rounded-lg shadow-md active:scale-[0.99] transition-transform hover:from-[#e5c04a] hover:to-[#d4af37]"
              >
                OK
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-[#202124] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.55)] overflow-hidden border border-white/10 max-h-[min(90svh,720px)] sm:max-h-[calc(100vh-48px)] flex flex-col">
            <div className="bg-black text-white px-3 sm:px-4 py-2.5 text-center text-sm sm:text-lg font-semibold shrink-0 border-b border-white/10">
              {formatDateTitle(marketTitle, dateText)}
            </div>

            {playerName && (
              <div className="px-3 sm:px-4 pt-2 shrink-0">
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 text-sm text-yellow-300 font-medium text-center">
                  Placing bet for: <span className="font-bold text-yellow-400">{playerName}</span>
                </div>
              </div>
            )}

            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto overscroll-contain px-3 sm:px-4 pt-3 sm:pt-4 min-h-0">
                {showGameType && groupedRows ? (
                  /* Grouped by game type */
                  <div className="space-y-4">
                    {Object.entries(groupedRows).map(([gameLabel, gameRows]) => (
                      <div key={gameLabel}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-yellow-500 font-semibold text-xs uppercase tracking-wide">{gameLabel}</span>
                          <span className="text-gray-500 text-xs">({gameRows.length})</span>
                          <span className="text-[#f2c14e] text-xs font-bold ml-auto">
                            ₹{gameRows.reduce((s, r) => s + Number(r.points || 0), 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {gameRows.map((r) => (
                            <div key={r.id} className="bg-black/40 rounded-lg px-3 py-2 border border-white/10">
                              <div className="grid grid-cols-3 text-center text-white text-[12px] sm:text-sm">
                                <div className="font-bold truncate">{renderBetNumber(r.number)}</div>
                                <div className="font-bold text-[#f2c14e] truncate">{r.points}</div>
                                <div className="font-medium text-gray-300 uppercase truncate">{r.type}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Flat list (original) */
                  <>
                    <div className="grid grid-cols-3 text-center font-semibold text-[#d4af37] text-[11px] sm:text-base">
                      <div className="truncate">{labelKey}</div>
                      <div className="truncate">Points</div>
                      <div className="truncate">Type</div>
                    </div>
                    <div className="mt-2.5 sm:mt-3 space-y-2 sm:space-y-3">
                      {rows.map((r) => (
                        <div key={r.id} className="bg-black/40 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 border border-white/10">
                          <div className="grid grid-cols-3 text-center text-white font-semibold text-[12px] sm:text-base">
                            <div className="truncate">{renderBetNumber(r.number)}</div>
                            <div className="truncate text-[#f2c14e]">{r.points}</div>
                            <div className="truncate font-medium text-gray-300 uppercase">{r.type}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="px-3 sm:px-4 pt-3 sm:pt-4 shrink-0">
                <div className="rounded-2xl overflow-hidden border border-white/10">
                  <div className="grid grid-cols-2">
                    <div className="p-3 sm:p-4 text-center border-r border-b border-white/10">
                      <div className="text-gray-400 text-[11px] sm:text-sm">Total Bets</div>
                      <div className="text-white font-bold text-base sm:text-lg leading-tight">{totalBids}</div>
                    </div>
                    <div className="p-3 sm:p-4 text-center border-b border-white/10">
                      <div className="text-gray-400 text-[11px] sm:text-sm">Total Bet Amount</div>
                      <div className="text-white font-bold text-base sm:text-lg text-[#f2c14e] leading-tight">{amount}</div>
                    </div>
                    <div className="p-3 sm:p-4 text-center border-r border-white/10">
                      <div className="text-gray-400 text-[11px] sm:text-sm">Player Balance Before</div>
                      <div className="text-white font-bold text-base sm:text-lg leading-tight">{formatMoney(before)}</div>
                    </div>
                    <div className="p-3 sm:p-4 text-center">
                      <div className="text-gray-400 text-[11px] sm:text-sm">Player Balance After</div>
                      <div className={`font-bold text-base sm:text-lg leading-tight ${after < 0 ? 'text-red-400' : 'text-white'}`}>{formatMoney(after)}</div>
                    </div>
                  </div>
                </div>
              </div>

              {insufficientBalance && (
                <div className="mx-3 sm:mx-4 mt-2 p-3 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-200 text-sm shrink-0">
                  Insufficient player balance. Required: ₹{amount.toLocaleString('en-IN')}, Available: ₹{before.toLocaleString('en-IN')}.
                </div>
              )}

              {submitError && (
                <div className="mx-3 sm:mx-4 mt-2 p-3 rounded-xl bg-red-500/20 border border-red-500/50 text-red-300 text-sm shrink-0">
                  {submitError}
                </div>
              )}

              <div className="px-3 sm:px-4 pt-3 sm:pt-4 pb-3 sm:pb-4 text-center text-red-400 font-semibold text-[12px] sm:text-base shrink-0">
                *Note: Bet once placed cannot be cancelled*
              </div>
            </div>

            <div className="px-3 sm:px-4 py-3 sm:py-4 grid grid-cols-2 gap-3 sm:gap-4 bg-[#202124] shrink-0 border-t border-white/10">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="bg-black border border-white/10 text-white font-bold py-3 rounded-xl sm:rounded-2xl shadow-md active:scale-[0.99] transition-transform hover:border-[#d4af37]/40 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitClick}
                disabled={submitting || insufficientBalance}
                className="bg-gradient-to-r from-[#d4af37] to-[#cca84d] text-[#4b3608] font-bold py-3 rounded-xl sm:rounded-2xl shadow-md active:scale-[0.99] transition-transform hover:from-[#e5c04a] hover:to-[#d4af37] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-[#4b3608]/30 border-t-[#4b3608] rounded-full animate-spin" />
                    Placing...
                  </>
                ) : (
                  'Place Bet'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BidReviewModal;
