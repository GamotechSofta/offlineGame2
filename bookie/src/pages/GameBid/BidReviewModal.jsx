import React, { useEffect, useState, useRef } from 'react';
import { FaPrint } from 'react-icons/fa';

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

/* Plain text version of renderBetNumber for print */
const renderBetNumberText = (val) => {
  const s = (val ?? '').toString().trim();
  if (/^\d{3}-\d{3}$/.test(s)) {
    const [open, close] = s.split('-');
    const sumDigits = (x) => [...String(x)].reduce((acc, c) => acc + (Number(c) || 0), 0);
    const j1 = sumDigits(open) % 10;
    const j2 = sumDigits(close) % 10;
    return `${open}-${j1}${j2}-${close}`;
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
  // Snapshot of bet data saved when bet is placed (so it persists after cart clear)
  const [receiptData, setReceiptData] = useState(null);
  const receiptRef = useRef(null);

  useEffect(() => {
    if (open) {
      setStage('review');
      setSubmitError('');
      setReceiptData(null);
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

    // Snapshot the data BEFORE submitting (cart will be cleared in onSubmit)
    const snapshot = {
      rows: [...rows],
      totalBids,
      totalAmount: amount,
      walletBefore: before,
      walletAfter: after,
      playerName,
      marketTitle,
      dateText,
      showGameType,
      labelKey,
      timestamp: new Date().toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    };

    // Group for receipt
    if (showGameType) {
      snapshot.grouped = rows.reduce((groups, r) => {
        const key = r.gameTypeLabel || 'Other';
        if (!groups[key]) groups[key] = [];
        groups[key].push(r);
        return groups;
      }, {});
    }

    try {
      const fn = onSubmit?.();
      if (fn && typeof fn.then === 'function') await fn;
      setReceiptData(snapshot);
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

  /* ---- Print handler ---- */
  const handlePrint = () => {
    if (!receiptRef.current) return;
    const printContents = receiptRef.current.innerHTML;
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bet Receipt</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 16px; color: #222; font-size: 12px; }
          .receipt-header { text-align: center; border-bottom: 2px solid #ea580c; padding-bottom: 10px; margin-bottom: 12px; }
          .receipt-header h2 { font-size: 16px; font-weight: 700; color: #ea580c; margin-bottom: 2px; }
          .receipt-header .subtitle { font-size: 11px; color: #666; }
          .receipt-header .player { font-size: 13px; font-weight: 600; margin-top: 4px; }
          .receipt-header .timestamp { font-size: 10px; color: #999; margin-top: 2px; }
          .group-header { display: flex; justify-content: space-between; align-items: center; padding: 6px 0 4px; border-bottom: 1px solid #ddd; margin-top: 8px; }
          .group-header .label { font-weight: 700; text-transform: uppercase; font-size: 11px; color: #ea580c; }
          .group-header .amount { font-weight: 700; font-size: 11px; color: #ea580c; }
          table { width: 100%; border-collapse: collapse; margin-top: 4px; }
          th { text-align: center; font-size: 10px; text-transform: uppercase; color: #888; padding: 4px 6px; border-bottom: 1px solid #eee; }
          td { text-align: center; padding: 4px 6px; font-size: 11px; border-bottom: 1px solid #f5f5f5; }
          td.number { font-weight: 700; }
          td.points { font-weight: 700; color: #ea580c; }
          td.session { text-transform: uppercase; color: #666; font-size: 10px; }
          .summary { margin-top: 14px; border-top: 2px solid #ea580c; padding-top: 10px; }
          .summary-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; }
          .summary-row .label { color: #666; }
          .summary-row .value { font-weight: 700; }
          .summary-row .value.orange { color: #ea580c; }
          .summary-row .value.green { color: #16a34a; }
          .total-row { border-top: 1px solid #ddd; padding-top: 6px; margin-top: 4px; }
          .total-row .label { font-weight: 700; font-size: 13px; }
          .total-row .value { font-size: 13px; }
          .footer { text-align: center; margin-top: 16px; padding-top: 8px; border-top: 1px dashed #ccc; font-size: 10px; color: #999; }
          @media print {
            body { padding: 8px; }
          }
        </style>
      </head>
      <body>
        ${printContents}
        <script>window.onload = function() { window.print(); window.close(); }<\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-3 sm:p-6">
      {stage === 'review' ? (
        <button type="button" onClick={handleClose} aria-label="Close" className="absolute inset-0 bg-black/30" />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-black/30" />
      )}

      <div className="relative w-full max-w-md sm:max-w-lg">
        {stage === 'success' && receiptData ? (
          /* ============ SUCCESS RECEIPT ============ */
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200 max-h-[min(92svh,780px)] sm:max-h-[calc(100vh-48px)] flex flex-col">
            <style>{`
              @keyframes successPop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
              @keyframes successDraw { to { stroke-dashoffset: 0; } }
              .success-pop { animation: successPop 420ms ease-out both; }
              .success-check-path { stroke-dasharray: 48; stroke-dashoffset: 48; animation: successDraw 520ms 140ms ease-out forwards; }
            `}</style>

            {/* Success header */}
            <div className="bg-green-500 text-white px-4 py-3 flex items-center justify-center gap-3 shrink-0">
              <div className="success-pop w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                  <path className="success-check-path" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="font-bold text-sm sm:text-base">
                Bet Placed Successfully{receiptData.playerName ? ` for ${receiptData.playerName}` : ''}
              </span>
            </div>

            {/* Scrollable receipt content */}
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {/* Hidden receipt for printing */}
              <div ref={receiptRef} className="hidden">
                <div className="receipt-header">
                  <h2>Bet Receipt</h2>
                  <div className="subtitle">{formatDateTitle(receiptData.marketTitle, receiptData.dateText)}</div>
                  {receiptData.playerName && <div className="player">Player: {receiptData.playerName}</div>}
                  <div className="timestamp">{receiptData.timestamp}</div>
                </div>

                {receiptData.showGameType && receiptData.grouped ? (
                  Object.entries(receiptData.grouped).map(([label, items]) => (
                    <div key={label}>
                      <div className="group-header">
                        <span className="label">{label} ({items.length})</span>
                        <span className="amount">₹{items.reduce((s, r) => s + Number(r.points || 0), 0).toLocaleString('en-IN')}</span>
                      </div>
                      <table>
                        <thead><tr><th>Number</th><th>Points</th><th>Session</th></tr></thead>
                        <tbody>
                          {items.map((r, i) => (
                            <tr key={i}>
                              <td className="number">{renderBetNumberText(r.number)}</td>
                              <td className="points">₹{r.points}</td>
                              <td className="session">{r.type}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))
                ) : (
                  <table>
                    <thead><tr><th>{receiptData.labelKey}</th><th>Points</th><th>Session</th></tr></thead>
                    <tbody>
                      {receiptData.rows.map((r, i) => (
                        <tr key={i}>
                          <td className="number">{renderBetNumberText(r.number)}</td>
                          <td className="points">₹{r.points}</td>
                          <td className="session">{r.type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div className="summary">
                  <div className="summary-row"><span className="label">Total Bets</span><span className="value">{receiptData.totalBids}</span></div>
                  <div className="summary-row"><span className="label">Total Amount</span><span className="value orange">₹{receiptData.totalAmount.toLocaleString('en-IN')}</span></div>
                  <div className="summary-row"><span className="label">Balance Before</span><span className="value">₹{formatMoney(receiptData.walletBefore)}</span></div>
                  <div className="summary-row total-row"><span className="label">Balance After</span><span className="value green">₹{formatMoney(receiptData.walletAfter)}</span></div>
                </div>
                <div className="footer">Thank you · Bet once placed cannot be cancelled</div>
              </div>

              {/* Visible receipt on screen */}
              <div className="p-4 space-y-4">
                {/* Market & date info */}
                <div className="text-center">
                  <p className="text-gray-800 font-bold text-sm">{formatDateTitle(receiptData.marketTitle, receiptData.dateText)}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{receiptData.timestamp}</p>
                </div>

                {/* Bet summary table - Two column layout */}
                {receiptData.showGameType && receiptData.grouped ? (
                  <div className="space-y-3">
                    {Object.entries(receiptData.grouped).map(([label, items]) => (
                      <div key={label} className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                        <div className="px-3 py-2 bg-gray-100 border-b border-gray-200 flex items-center justify-between">
                          <span className="text-orange-600 font-semibold text-[10px] uppercase tracking-wide">{label} <span className="text-gray-400">({items.length})</span></span>
                          <span className="text-orange-600 text-[11px] font-bold">₹{items.reduce((s, r) => s + Number(r.points || 0), 0).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="grid grid-cols-2 divide-x divide-gray-200">
                          {items.map((r) => (
                            <div key={r.id} className="px-2 py-1.5 border-b border-gray-100 last:border-b-0">
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="text-gray-800 font-bold flex-1 truncate">{renderBetNumber(r.number)}</span>
                                <span className="text-orange-500 font-bold shrink-0">₹{r.points}</span>
                                <span className="text-gray-500 uppercase text-[10px] shrink-0">{r.type}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-3 py-2 bg-gray-100 border-b border-gray-200">
                      <div className="grid grid-cols-2 divide-x divide-gray-300">
                        <div className="text-center text-[10px] font-semibold text-orange-600 uppercase">
                          <div className="grid grid-cols-3 gap-1">
                            <span>{receiptData.labelKey}</span>
                            <span>Points</span>
                            <span>Session</span>
                          </div>
                        </div>
                        <div className="text-center text-[10px] font-semibold text-orange-600 uppercase">
                          <div className="grid grid-cols-3 gap-1">
                            <span>{receiptData.labelKey}</span>
                            <span>Points</span>
                            <span>Session</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-gray-200">
                      {receiptData.rows.map((r) => (
                        <div key={r.id} className="px-2 py-1.5 border-b border-gray-100 last:border-b-0">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-gray-800 font-bold flex-1 truncate">{renderBetNumber(r.number)}</span>
                            <span className="text-orange-500 font-bold shrink-0">₹{r.points}</span>
                            <span className="text-gray-500 uppercase text-[10px] shrink-0">{r.type}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Summary stats */}
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="grid grid-cols-2 divide-x divide-gray-200">
                    <div className="p-3 text-center border-b border-gray-200">
                      <p className="text-gray-400 text-[10px] uppercase">Total Bets</p>
                      <p className="text-gray-800 font-bold text-lg">{receiptData.totalBids}</p>
                    </div>
                    <div className="p-3 text-center border-b border-gray-200">
                      <p className="text-gray-400 text-[10px] uppercase">Total Amount</p>
                      <p className="text-orange-600 font-bold text-lg">₹{receiptData.totalAmount.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="p-3 text-center">
                      <p className="text-gray-400 text-[10px] uppercase">Balance Before</p>
                      <p className="text-gray-800 font-bold">{formatMoney(receiptData.walletBefore)}</p>
                    </div>
                    <div className="p-3 text-center">
                      <p className="text-gray-400 text-[10px] uppercase">Balance After</p>
                      <p className={`font-bold ${receiptData.walletAfter < 0 ? 'text-red-500' : 'text-green-600'}`}>{formatMoney(receiptData.walletAfter)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="px-4 py-3 border-t border-gray-200 bg-white shrink-0 flex gap-3">
              <button
                type="button"
                onClick={handlePrint}
                className="flex-1 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition-colors border border-gray-200"
              >
                <FaPrint className="w-4 h-4" />
                Print Receipt
              </button>
              <button
                type="button"
                onClick={() => { setStage('review'); handleClose(); }}
                className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-3 rounded-xl shadow-md active:scale-[0.99] transition-transform hover:from-orange-600 hover:to-orange-700"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* ============ REVIEW STAGE ============ */
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200 max-h-[min(90svh,720px)] sm:max-h-[calc(100vh-48px)] flex flex-col">
            <div className="bg-orange-500 text-white px-3 sm:px-4 py-2.5 text-center text-sm sm:text-lg font-semibold shrink-0 border-b border-gray-200">
              {formatDateTitle(marketTitle, dateText)}
            </div>

            {playerName && (
              <div className="px-3 sm:px-4 pt-2 shrink-0">
                <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-sm text-orange-600 font-medium text-center">
                  Placing bet for: <span className="font-bold text-orange-700">{playerName}</span>
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
                          <span className="text-orange-500 font-semibold text-xs uppercase tracking-wide">{gameLabel}</span>
                          <span className="text-gray-500 text-xs">({gameRows.length})</span>
                          <span className="text-orange-500 text-xs font-bold ml-auto">
                            ₹{gameRows.reduce((s, r) => s + Number(r.points || 0), 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {gameRows.map((r) => (
                            <div key={r.id} className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                              <div className="grid grid-cols-3 text-center text-gray-800 text-[12px] sm:text-sm">
                                <div className="font-bold truncate">{renderBetNumber(r.number)}</div>
                                <div className="font-bold text-orange-500 truncate">{r.points}</div>
                                <div className="font-medium text-gray-600 uppercase truncate">{r.type}</div>
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
                    <div className="grid grid-cols-3 text-center font-semibold text-orange-500 text-[11px] sm:text-base">
                      <div className="truncate">{labelKey}</div>
                      <div className="truncate">Points</div>
                      <div className="truncate">Type</div>
                    </div>
                    <div className="mt-2.5 sm:mt-3 space-y-2 sm:space-y-3">
                      {rows.map((r) => (
                        <div key={r.id} className="bg-gray-50 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-200">
                          <div className="grid grid-cols-3 text-center text-gray-800 font-semibold text-[12px] sm:text-base">
                            <div className="truncate">{renderBetNumber(r.number)}</div>
                            <div className="truncate text-orange-500">{r.points}</div>
                            <div className="truncate font-medium text-gray-600 uppercase">{r.type}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="px-3 sm:px-4 pt-3 sm:pt-4 shrink-0">
                <div className="rounded-2xl overflow-hidden border border-gray-200">
                  <div className="grid grid-cols-2">
                    <div className="p-3 sm:p-4 text-center border-r border-b border-gray-200">
                      <div className="text-gray-400 text-[11px] sm:text-sm">Total Bets</div>
                      <div className="text-gray-800 font-bold text-base sm:text-lg leading-tight">{totalBids}</div>
                    </div>
                    <div className="p-3 sm:p-4 text-center border-b border-gray-200">
                      <div className="text-gray-400 text-[11px] sm:text-sm">Total Bet Amount</div>
                      <div className="text-gray-800 font-bold text-base sm:text-lg text-orange-500 leading-tight">{amount}</div>
                    </div>
                    <div className="p-3 sm:p-4 text-center border-r border-gray-200">
                      <div className="text-gray-400 text-[11px] sm:text-sm">Player Balance Before</div>
                      <div className="text-gray-800 font-bold text-base sm:text-lg leading-tight">{formatMoney(before)}</div>
                    </div>
                    <div className="p-3 sm:p-4 text-center">
                      <div className="text-gray-400 text-[11px] sm:text-sm">Player Balance After</div>
                      <div className={`font-bold text-base sm:text-lg leading-tight ${after < 0 ? 'text-red-500' : 'text-gray-800'}`}>{formatMoney(after)}</div>
                    </div>
                  </div>
                </div>
              </div>

              {insufficientBalance && (
                <div className="mx-3 sm:mx-4 mt-2 p-3 rounded-xl bg-orange-50 border border-orange-200 text-orange-700 text-sm shrink-0">
                  Insufficient player balance. Required: ₹{amount.toLocaleString('en-IN')}, Available: ₹{before.toLocaleString('en-IN')}.
                </div>
              )}

              {submitError && (
                <div className="mx-3 sm:mx-4 mt-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm shrink-0">
                  {submitError}
                </div>
              )}

              <div className="px-3 sm:px-4 pt-3 sm:pt-4 pb-3 sm:pb-4 text-center text-red-500 font-semibold text-[12px] sm:text-base shrink-0">
                *Note: Bet once placed cannot be cancelled*
              </div>
            </div>

            <div className="px-3 sm:px-4 py-3 sm:py-4 grid grid-cols-2 gap-3 sm:gap-4 bg-white shrink-0 border-t border-gray-200">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="bg-gray-100 border border-gray-200 text-gray-800 font-bold py-3 rounded-xl sm:rounded-2xl shadow-md active:scale-[0.99] transition-transform hover:border-orange-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitClick}
                disabled={submitting || insufficientBalance}
                className="bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-3 rounded-xl sm:rounded-2xl shadow-md active:scale-[0.99] transition-transform hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
