import React, { useMemo } from 'react';

const drawTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

const TicketListModal = ({
  open,
  onClose,
  tickets = [],
  onView,
  title = 'TICKET',
  emptyMessage = 'No tickets available yet.',
}) => {
  const normalizedTickets = useMemo(() => {
    const safeTickets = Array.isArray(tickets) ? tickets : [];
    return [...safeTickets]
      .map((ticket) => {
        const createdAt = ticket?.createdAt ? new Date(ticket.createdAt) : new Date(Number(ticket?.id) || Date.now());
        const drawDateFallback = Number.isNaN(createdAt.getTime())
          ? '-'
          : `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}-${String(createdAt.getDate()).padStart(2, '0')}`;
        const drawTimeFallback = Number.isNaN(createdAt.getTime())
          ? '-'
          : drawTimeFormatter
            .format(createdAt)
            .replace(/\s?(am|pm)$/i, (m) => ` ${m.trim().toUpperCase()}`);
        return {
          ...ticket,
          createdAtMs: Number.isNaN(createdAt.getTime()) ? 0 : createdAt.getTime(),
          userName: ticket?.userName || 'user',
          drawDate: ticket?.drawDate || drawDateFallback,
          drawTime: ticket?.drawTime || drawTimeFallback,
          gameId: ticket?.gameId || '-',
          outcome:
            String(ticket?.outcome || '').toLowerCase() === 'win'
              ? 'win'
              : String(ticket?.outcome || '').toLowerCase() === 'pending'
                ? 'pending'
                : String(ticket?.outcome || '').toLowerCase() === 'cancelled'
                  ? 'cancelled'
                  : 'loss',
          totalPoints: Number(ticket?.totalPoints || 0),
          totalWin: Number(ticket?.totalWin || 0),
        };
      })
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  }, [tickets]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/60 p-2 sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[#7b7b7b] bg-[#c7c7c7] shadow-2xl">
        <div className="flex items-center justify-between bg-[#c71616] px-3 py-2 text-white sm:px-5 sm:py-3">
          <h3 className="text-[22px] font-extrabold tracking-wide sm:text-[28px]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-black/20 px-3 py-1 text-[20px] font-bold leading-none hover:bg-black/35 sm:text-[22px]"
            aria-label="Close ticket list"
          >
            ×
          </button>
        </div>
        <div className="space-y-3 overflow-y-auto bg-[#b5b5b5] p-3 sm:p-4">
          {normalizedTickets.length ? (
            normalizedTickets.map((ticket) => (
              <div
                key={ticket.id}
                className="flex flex-col items-start justify-between gap-3 rounded-xl border border-[#6f6f6f] bg-[#4f4f4f] px-3 py-3 text-white sm:flex-row sm:items-center sm:gap-4 sm:px-4"
              >
                <div className="grid w-full grid-cols-1 gap-x-8 gap-y-1.5 text-[16px] sm:grid-cols-2 sm:text-[17px]">
                  <div>User Name : <span className="font-semibold">{ticket.userName}</span></div>
                  <div>Dr Time : <span className="font-semibold">{ticket.drawTime}</span></div>
                  <div>Dr Date : <span className="font-semibold">{ticket.drawDate}</span></div>
                  <div>Game ID : <span className="font-semibold">{ticket.gameId}</span></div>
                  <div>Total Point : <span className="font-semibold">{ticket.totalPoints}</span></div>
                  <div>Total Win : <span className="font-semibold">{ticket.totalWin}</span></div>
                </div>
                <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
                  <span
                    className={`rounded-md px-4 py-2.5 text-[16px] font-bold text-white shadow sm:text-[17px] ${
                      ticket.outcome === 'win'
                        ? 'bg-[#19a34a]'
                        : ticket.outcome === 'pending'
                          ? 'bg-[#d97706]'
                          : ticket.outcome === 'cancelled'
                            ? 'bg-[#475569]'
                            : 'bg-[#dc2626]'
                    }`}
                  >
                    {ticket.outcome === 'win' ? 'Win' : ticket.outcome === 'pending' ? 'Pending' : ticket.outcome === 'cancelled' ? 'Cancelled' : 'Loss'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onView?.(ticket)}
                    className="rounded-md bg-[#db2f2f] px-4 py-2.5 text-[16px] font-bold text-white shadow hover:brightness-110 sm:text-[17px]"
                  >
                    View
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg bg-[#4f4f4f] px-4 py-8 text-center text-[18px] font-semibold text-white">
              {emptyMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketListModal;
