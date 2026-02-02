import React from 'react';

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
  if (!open) return null;

  const before = Number(walletBefore) || 0;
  const amount = Number(totalAmount) || 0;
  const after = before - amount;
  const handleClose = () => {
    if (onClose) onClose();
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-6">
      {/* Overlay */}
      <button type="button" onClick={handleClose} aria-label="Close" className="absolute inset-0 bg-black/60" />

      {/* Modal */}
      <div className="relative w-full max-w-md sm:max-w-lg">
        <div
          className="bg-[#202124] rounded-t-2xl sm:rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.55)] overflow-hidden border border-white/10 max-h-[calc(100svh-12px)] sm:max-h-[calc(100vh-48px)] flex flex-col"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0px)' }}
        >
          {/* Title bar */}
          <div className="bg-black text-white px-3 sm:px-4 py-2.5 text-center text-sm sm:text-lg font-semibold shrink-0 border-b border-white/10">
            {formatDateTitle(marketTitle, dateText)}
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {/* Table */}
            <div className="px-3 sm:px-4 pt-3 sm:pt-4">
              <div className="grid grid-cols-3 text-center font-semibold text-[#d4af37] text-[11px] sm:text-base">
                <div className="truncate">{labelKey}</div>
                <div className="truncate">Points</div>
                <div className="truncate">Type</div>
              </div>
              <div className="mt-2.5 sm:mt-3 space-y-2 sm:space-y-3">
                {rows.map((r) => (
                  <div key={r.id} className="bg-black/40 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 border border-white/10">
                    <div className="grid grid-cols-3 text-center text-white font-semibold text-[12px] sm:text-base">
                      <div className="truncate">{r.number}</div>
                      <div className="truncate text-[#f2c14e]">{r.points}</div>
                      <div className="truncate font-medium text-gray-300 uppercase">{r.type}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary 2x2 */}
            <div className="px-3 sm:px-4 pt-3 sm:pt-4">
              <div className="rounded-2xl overflow-hidden border border-white/10">
                <div className="grid grid-cols-2">
                  <div className="p-3 sm:p-4 text-center border-r border-b border-white/10">
                    <div className="text-gray-400 text-[11px] sm:text-sm">Total Bids</div>
                    <div className="text-white font-bold text-base sm:text-lg leading-tight">{totalBids}</div>
                  </div>
                  <div className="p-3 sm:p-4 text-center border-b border-white/10">
                    <div className="text-gray-400 text-[11px] sm:text-sm">Total Bid Amount</div>
                    <div className="text-white font-bold text-base sm:text-lg text-[#f2c14e] leading-tight">{amount}</div>
                  </div>
                  <div className="p-3 sm:p-4 text-center border-r border-white/10">
                    <div className="text-gray-400 text-[11px] sm:text-sm">Wallet Balance Before Deduction</div>
                    <div className="text-white font-bold text-base sm:text-lg leading-tight">{formatMoney(before)}</div>
                  </div>
                  <div className="p-3 sm:p-4 text-center">
                    <div className="text-gray-400 text-[11px] sm:text-sm">Wallet Balance After Deduction</div>
                    <div className="text-white font-bold text-base sm:text-lg leading-tight">{formatMoney(after)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Note */}
            <div className="px-3 sm:px-4 pt-3 sm:pt-4 pb-3 sm:pb-4 text-center text-red-400 font-semibold text-[12px] sm:text-base">
              *Note: Bid once played cannot be cancelled*
            </div>
          </div>

          {/* Buttons (sticky bottom inside modal) */}
          <div className="px-3 sm:px-4 py-3 sm:py-4 grid grid-cols-2 gap-3 sm:gap-4 bg-[#202124] shrink-0 border-t border-white/10">
            <button
              type="button"
              onClick={handleClose}
              className="bg-black border border-white/10 text-white font-bold py-3 rounded-xl sm:rounded-2xl shadow-md active:scale-[0.99] transition-transform hover:border-[#d4af37]/40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSubmit}
              className="bg-gradient-to-r from-[#d4af37] to-[#cca84d] text-[#4b3608] font-bold py-3 rounded-xl sm:rounded-2xl shadow-md active:scale-[0.99] transition-transform hover:from-[#e5c04a] hover:to-[#d4af37]"
            >
              Submit Bet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BidReviewModal;
