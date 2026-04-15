import React, { useMemo } from 'react';

const getDisplayNumberByMode = (number, modeRaw) => {
  const mode = String(modeRaw || '').toLowerCase();
  const digits = String(number || '').replace(/\D/g, '').slice(-3).padStart(3, '0');
  if (mode === 'fp') return digits.slice(0, 2);
  if (mode === 'bp') return digits.slice(1);
  if (mode === 'sp') return `${digits[0]}${digits[2]}`;
  if (mode === 'ap') return digits.slice(0, 2);
  return digits;
};

const TicketDetailsModal = ({ open, onClose, ticket }) => {
  const couponTime = useMemo(() => {
    const dateSource = ticket?.createdAt || ticket?.id;
    if (!dateSource) return '-';
    return new Date(dateSource).toLocaleString('en-IN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  }, [ticket]);

  const ticketItems = useMemo(() => {
    const list = Array.isArray(ticket?.bets) ? ticket.bets : [];
    return list.map((bet, idx) => {
      const panel = String(bet?.panels || 'A').toUpperCase();
      const displayNum = getDisplayNumberByMode(bet?.number, bet?.mode);
      const mode = String(bet?.mode || '').toUpperCase();
      const points = Number(bet?.points || 0);
      return {
        id: bet?.id || `${panel}-${displayNum}-${mode}-${idx}`,
        text: `${panel}${displayNum} [${mode}] ${points}`,
      };
    });
  }, [ticket]);

  const midpoint = Math.ceil(ticketItems.length / 2);
  const leftCol = ticketItems.slice(0, midpoint);
  const rightCol = ticketItems.slice(midpoint);

  if (!open || !ticket) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/65 p-2 sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-[#787878] bg-[#c8c8c8] shadow-2xl">
        <div className="flex items-center justify-between bg-[#c71616] px-3 py-2 text-white sm:px-5 sm:py-3">
          <h3 className="text-[22px] font-extrabold tracking-wide sm:text-[28px]">TICKET DATA</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-black/20 px-3 py-1 text-[20px] font-bold leading-none hover:bg-black/35 sm:text-[22px]"
            aria-label="Close ticket details"
          >
            ×
          </button>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden bg-[#b5b5b5] p-3 sm:gap-4 sm:p-4 lg:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-[#6d6d6d] bg-[#4f4f4f] p-4 text-white">
            <div className="mb-3 border-b border-white/20 pb-3">
              <div className="text-[20px] font-bold leading-tight sm:text-[24px]">Diamond Coupon</div>
              <div className="text-[14px] font-semibold text-white/90 sm:text-[16px]">For Amusement Only</div>
            </div>
            <div className="space-y-2 text-[14px] sm:text-[16px]">
              <div>Agent ID : <span className="font-semibold">user</span></div>
              <div>Coupon Dr Time : <span className="font-semibold">{ticket.drawTime || '-'}</span></div>
              <div>Coupon Time : <span className="font-semibold">{couponTime}</span></div>
              <div>Total Point : <span className="font-semibold">{ticket.totalPoints ?? 0}</span></div>
              <div>Win point : <span className="font-semibold">{ticket.totalWin ?? 0}</span></div>
              <div>Game ID : <span className="font-semibold">{ticket.gameId || '-'}</span></div>
            </div>
          </div>
          <div className="min-h-0 overflow-hidden rounded-xl border border-[#6d6d6d] bg-[#4f4f4f] p-4">
            <div className="mb-3 text-[20px] font-bold text-white sm:text-[22px]">Ticket Items</div>
            <div className="grid max-h-[52vh] grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2">
              <div className="space-y-2">
                {leftCol.map((item) => (
                  <div key={item.id} className="rounded-md bg-[#d0d0d0] px-3 py-2 text-[15px] font-bold text-[#c71616] sm:text-[16px]">
                    {item.text}
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {rightCol.map((item) => (
                  <div key={item.id} className="rounded-md bg-[#d0d0d0] px-3 py-2 text-[15px] font-bold text-[#c71616] sm:text-[16px]">
                    {item.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDetailsModal;
