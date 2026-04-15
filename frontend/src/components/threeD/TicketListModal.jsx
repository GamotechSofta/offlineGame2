import React from 'react';

const TicketListModal = ({ open, onClose, tickets = [], onView }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/60 p-2 sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[#7b7b7b] bg-[#c7c7c7] shadow-2xl">
        <div className="flex items-center justify-between bg-[#c71616] px-3 py-2 text-white sm:px-5 sm:py-3">
          <h3 className="text-[22px] font-extrabold tracking-wide sm:text-[28px]">TICKET</h3>
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
          {tickets.length ? (
            tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="flex flex-col items-start justify-between gap-3 rounded-xl border border-[#6f6f6f] bg-[#4f4f4f] px-3 py-3 text-white sm:flex-row sm:items-center sm:gap-4 sm:px-4"
              >
                <div className="grid w-full grid-cols-1 gap-x-8 gap-y-1 text-[14px] sm:grid-cols-2 sm:text-[15px]">
                  <div>User Name : <span className="font-semibold">{ticket.userName || 'user'}</span></div>
                  <div>Dr Time : <span className="font-semibold">{ticket.drawTime || '-'}</span></div>
                  <div>Dr Date : <span className="font-semibold">{ticket.drawDate || '-'}</span></div>
                  <div>Game ID : <span className="font-semibold">{ticket.gameId || '-'}</span></div>
                </div>
                <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
                  <span className="rounded-md bg-[#19a34a] px-4 py-2 text-[15px] font-bold text-white shadow">
                    Win
                  </span>
                  <button
                    type="button"
                    onClick={() => onView?.(ticket)}
                    className="rounded-md bg-[#db2f2f] px-4 py-2 text-[15px] font-bold text-white shadow hover:brightness-110"
                  >
                    View
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg bg-[#4f4f4f] px-4 py-8 text-center text-[16px] font-semibold text-white">
              No tickets available yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketListModal;
