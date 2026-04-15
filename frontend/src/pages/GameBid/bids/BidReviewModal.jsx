import React, { useEffect, useState } from 'react';
import { useBettingWindow } from '../BettingWindowContext';

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
  // Full Sangam display: OPEN3-JODI-CLOSE3 (e.g. 225-255 => 225-92-255)
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

const readLatestWalletBalance = () => {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const u = JSON.parse(raw);
    const val =
      u?.wallet ??
      u?.balance ??
      u?.points ??
      u?.walletAmount ??
      u?.wallet_amount ??
      u?.amount;
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
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
  totalAmount = 0
}) => {
  const { allowed: bettingAllowed, message: bettingMessage } = useBettingWindow();
  const [stage, setStage] = useState('review'); // 'review' | 'success'
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (open) {
      setStage('review');
      setSubmitError('');
    }
  }, [open]);

  // Keep showing success popup even if parent sets open=false after submit.
  if (!open && stage !== 'success') return null;

  const latestWallet = readLatestWalletBalance();
  const before = latestWallet != null ? latestWallet : (Number(walletBefore) || 0);
  const amount = Number(totalAmount) || 0;
  const after = before - amount;
  const insufficientBalance = after < 0;
  const cannotSubmit = insufficientBalance || !bettingAllowed;
  const handleClose = () => {
    if (onClose) onClose();
  };
  const handleSubmitClick = async () => {
    if (cannotSubmit) return;
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

  return (
    <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-1.5 sm:p-6">
      {/* Overlay */}
      {stage === 'review' ? (
        <button type="button" onClick={handleClose} aria-label="Close" className="absolute inset-0 bg-black/60" />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-black/60" />
      )}

      {/* Modal */}
      <div className="relative w-full max-w-md sm:max-w-lg">
        {stage === 'success' ? (
          <div className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] overflow-hidden border-2 border-gray-300">
            <style>{`
              @keyframes successPop {
                0% { transform: scale(0.6); opacity: 0; }
                60% { transform: scale(1.08); opacity: 1; }
                100% { transform: scale(1); opacity: 1; }
              }
              @keyframes successDraw {
                to { stroke-dashoffset: 0; }
              }
              .success-pop {
                animation: successPop 420ms ease-out both;
              }
              .success-check-path {
                stroke-dasharray: 48;
                stroke-dashoffset: 48;
                animation: successDraw 520ms 140ms ease-out forwards;
              }
            `}</style>
            <div className="p-7 sm:p-8 flex flex-col items-center">
              <div className="success-pop w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-green-500 flex items-center justify-center shadow-[0_10px_25px_rgba(34,197,94,0.35)]">
                <svg className="w-10 h-10 sm:w-12 sm:h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                  <path className="success-check-path" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="mt-6 text-center">
                <div className="text-green-600 font-semibold text-base sm:text-lg">
                  Your bet was placed successfully
                </div>
              </div>
            </div>
            <div className="px-6 pb-6">
              <button
                type="button"
                onClick={() => {
                  setStage('review');
                  handleClose();
                }}
                className="w-full bg-[#1B3150] text-white font-bold py-3.5 rounded-lg shadow-md active:scale-[0.99] transition-transform hover:bg-[#152842]"
              >
                OK
              </button>
            </div>
          </div>
        ) : (
          <div
            className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] overflow-hidden border-2 border-gray-300 max-h-[calc(100dvh-8px)] sm:max-h-[calc(100dvh-32px)] flex flex-col"
          >
            {/* Title bar */}
            <div className="bg-[#1B3150] text-white px-3 sm:px-4 py-2.5 text-center text-[13px] sm:text-base font-semibold shrink-0 border-b-2 border-[#1B3150]">
              {formatDateTitle(marketTitle, dateText)}
            </div>

            {/* Scrollable content */}
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto overscroll-contain ios-scroll-touch">
              <div className="px-2.5 sm:px-4 pt-2.5 sm:pt-4">
                <div className="rounded-xl border-2 border-gray-300 bg-gray-50 px-3 py-1.5 text-[10px] sm:text-sm font-semibold text-[#1B3150]">
                  Bet Entries ({rows.length})
                </div>
                <div className="mt-2 sm:mt-3 space-y-2 sm:space-y-3">
                  {rows.map((r) => (
                    <div key={r.id} className="bg-gray-50 rounded-xl px-2.5 sm:px-4 py-2.5 border-2 border-gray-300">
                      <div className="grid grid-cols-3 gap-2 text-[9px] sm:text-xs font-semibold text-gray-500 mb-1">
                        <div>{labelKey}</div>
                        <div className="text-center">Points</div>
                        <div className="text-right">Type</div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 items-center text-[12px] sm:text-base font-semibold text-gray-800">
                        <div className="truncate">{renderBetNumber(r.displayNumber ?? r.number)}</div>
                        <div className="text-center text-[#1B3150]">{r.points}</div>
                        <div className="text-right font-medium text-gray-600 uppercase truncate">{r.type}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="px-2.5 sm:px-4 pt-2.5 sm:pt-4 shrink-0">
                <div className="rounded-2xl overflow-hidden border-2 border-gray-300 bg-gray-50">
                  <div className="grid grid-cols-2">
                    <div className="p-2.5 sm:p-4 text-left border-r-2 border-b-2 border-gray-300">
                      <div className="text-gray-600 text-[10px] sm:text-sm">Total Bets</div>
                      <div className="text-gray-800 font-bold text-sm sm:text-lg leading-tight mt-0.5">{totalBids}</div>
                    </div>
                    <div className="p-2.5 sm:p-4 text-left border-b-2 border-gray-300">
                      <div className="text-gray-600 text-[10px] sm:text-sm">Total Bet Amount</div>
                      <div className="text-[#1B3150] font-bold text-sm sm:text-lg leading-tight mt-0.5">{amount}</div>
                    </div>
                    <div className="p-2.5 sm:p-4 text-left border-r-2 border-gray-300">
                      <div className="text-gray-600 text-[10px] sm:text-sm">Balance Before</div>
                      <div className="text-gray-800 font-bold text-sm sm:text-lg leading-tight mt-0.5">{formatMoney(before)}</div>
                    </div>
                    <div className="p-2.5 sm:p-4 text-left">
                      <div className="text-gray-600 text-[10px] sm:text-sm">Balance After</div>
                      <div className={`font-bold text-sm sm:text-lg leading-tight mt-0.5 ${after < 0 ? 'text-red-600' : 'text-gray-800'}`}>{formatMoney(after)}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Betting closed / outside window */}
              {!bettingAllowed && bettingMessage && (
                <div className="mx-2.5 sm:mx-4 mt-2 p-2.5 rounded-xl bg-red-50 border-2 border-red-300 text-red-600 text-xs sm:text-sm shrink-0">
                  {bettingMessage}
                </div>
              )}

              {/* Insufficient balance warning */}
              {insufficientBalance && (
                <div className="mx-2.5 sm:mx-4 mt-2 p-2.5 rounded-xl bg-amber-50 border-2 border-amber-300 text-amber-700 text-xs sm:text-sm shrink-0">
                  Insufficient balance. Required: ₹{amount.toLocaleString('en-IN')}, Available: ₹{before.toLocaleString('en-IN')}. Add funds to place this bet.
                </div>
              )}

              {/* Submit error */}
              {submitError && (
                <div className="mx-2.5 sm:mx-4 mt-2 p-2.5 rounded-xl bg-red-50 border-2 border-red-300 text-red-600 text-xs sm:text-sm shrink-0">
                  {submitError}
                </div>
              )}

              {/* Note */}
              <div className="px-2.5 sm:px-4 pt-2.5 sm:pt-3 pb-2.5 sm:pb-3 text-center text-red-600 font-semibold text-[11px] sm:text-sm shrink-0">
                *Note: Bet once placed cannot be cancelled*
              </div>
            </div>

            {/* Actions */}
            <div
              className="px-2.5 sm:px-4 pt-2.5 sm:pt-3 grid grid-cols-2 gap-2.5 sm:gap-3 bg-white shrink-0 border-t-2 border-gray-300 sticky bottom-0"
              style={{ paddingBottom: 'calc(0.6rem + env(safe-area-inset-bottom, 0px))' }}
            >
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="bg-white border-2 border-gray-300 text-gray-700 font-bold text-sm sm:text-base py-2.5 sm:py-3 rounded-xl sm:rounded-2xl shadow-md active:scale-[0.99] transition-transform hover:border-gray-400 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitClick}
                disabled={submitting || cannotSubmit}
                className="bg-[#1B3150] text-white font-bold text-sm sm:text-base py-2.5 sm:py-3 rounded-xl sm:rounded-2xl shadow-md active:scale-[0.99] transition-transform hover:bg-[#152842] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Placing...
                  </>
                ) : (
                  'Submit Bet'
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
