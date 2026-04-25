import React, { useEffect, useMemo, useState } from 'react';

const getDisplayNumberByMode = (number, modeRaw) => {
  const mode = String(modeRaw || '').toLowerCase();
  const digits = String(number || '').replace(/\D/g, '').slice(-3).padStart(3, '0');
  if (mode === 'fp') return digits.slice(0, 2);
  if (mode === 'bp') return digits.slice(1);
  if (mode === 'sp') return `${digits[0]}${digits[2]}`;
  if (mode === 'ap') return digits.slice(0, 2);
  return digits;
};

const formatQuizLabel = (ticket) => {
  const bets = Array.isArray(ticket?.bets) ? ticket.bets : [];
  const panels = Array.from(new Set(
    bets
      .map((bet) => String(bet?.panels || '').trim().toUpperCase())
      .filter((p) => ['A', 'B', 'C'].includes(p)),
  ));
  if (panels.length > 1) return `SET ${panels.join('/')}`;
  if (panels.length === 1) return `SET ${panels[0]}`;
  const rawCandidates = [ticket?.quizId, ticket?.selectedQuizId, ticket?.quizNo, ticket?.quiz];
  const raw = rawCandidates.find((value) => value != null && String(value).trim() !== '');
  if (raw == null) return '-';
  const parsed = Number(String(raw).replace(/\D/g, ''));
  if (!Number.isInteger(parsed) || parsed <= 0) return '-';
  return `Q-${String(parsed).padStart(2, '0')}`;
};

const MODAL_BASE_WIDTH = 980;
const MODAL_BASE_HEIGHT = 620;

const TicketDetailsModal = ({ open, onClose, ticket }) => {
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!open) return undefined;
    const updateViewport = () => {
      if (typeof window === 'undefined') return;
      setViewport({
        width: window.innerWidth || 0,
        height: window.innerHeight || 0,
      });
    };
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, [open]);

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
      const winAmount = Number(bet?.winAmount || 0);
      const outcome = String(bet?.outcome || '').toLowerCase();
      const matchedPanel = bet?.matchedPanel || '-';
      const matchedResult = bet?.matchedResult || '-';
      const payoutLabel = bet?.payoutLabel || null;
      return {
        id: bet?.id || `${panel}-${displayNum}-${mode}-${idx}`,
        panel,
        displayNum,
        mode,
        points,
        winAmount,
        outcome: outcome === 'win' ? 'win' : outcome === 'loss' ? 'loss' : outcome === 'cancelled' ? 'cancelled' : 'pending',
        matchedPanel,
        matchedResult,
        payoutLabel,
      };
    }).sort((a, b) => {
      const order = { win: 0, loss: 1, cancelled: 2, pending: 3 };
      const byOutcome = (order[a.outcome] ?? 9) - (order[b.outcome] ?? 9);
      if (byOutcome !== 0) return byOutcome;
      return String(a.id).localeCompare(String(b.id));
    });
  }, [ticket]);

  const overview = useMemo(() => {
    const totalBets = ticketItems.length;
    const winBets = ticketItems.filter((item) => item.outcome === 'win').length;
    const lossBets = ticketItems.filter((item) => item.outcome === 'loss').length;
    const totalStake = ticketItems.reduce((sum, item) => sum + Number(item.points || 0), 0);
    const totalWin = ticketItems.reduce((sum, item) => sum + Number(item.winAmount || 0), 0);
    return {
      totalBets,
      winBets,
      lossBets,
      totalStake,
      totalWin,
      net: totalWin - totalStake,
      quizLabel: formatQuizLabel(ticket),
    };
  }, [ticket, ticketItems]);

  const midpoint = Math.ceil(ticketItems.length / 2);
  const leftCol = ticketItems.slice(0, midpoint);
  const rightCol = ticketItems.slice(midpoint);
  const modalScale = useMemo(() => {
    const safeWidth = Math.max(0, viewport.width - 16);
    const safeHeight = Math.max(0, viewport.height - 16);
    if (!safeWidth || !safeHeight) return 1;
    const widthScale = safeWidth / MODAL_BASE_WIDTH;
    const heightScale = safeHeight / MODAL_BASE_HEIGHT;
    return Math.min(1, widthScale, heightScale);
  }, [viewport.height, viewport.width]);

  if (!open || !ticket) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-hidden bg-black/65 p-2">
      <div
        className="relative"
        style={{
          width: MODAL_BASE_WIDTH * modalScale,
          height: MODAL_BASE_HEIGHT * modalScale,
        }}
      >
        <div
          className="absolute left-0 top-0 flex h-[620px] w-[980px] flex-col overflow-hidden rounded-xl border border-[#787878] bg-[#c8c8c8] shadow-2xl"
          style={{
            transform: `scale(${modalScale})`,
            transformOrigin: 'top left',
          }}
        >
          <div className="flex items-center justify-between bg-[#c71616] px-4 py-2.5 text-white">
            <h3 className="text-[26px] font-extrabold tracking-wide">TICKET DATA</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-black/20 px-3 py-1 text-[22px] font-bold leading-none hover:bg-black/35"
            aria-label="Close ticket details"
          >
            ×
          </button>
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-hidden bg-[#b5b5b5] p-3">
            <div className="min-h-0 overflow-y-auto rounded-xl border border-[#6d6d6d] bg-[#4f4f4f] p-4 text-white">
              <div className="mb-3 border-b border-white/20 pb-3">
                <div className="text-[22px] font-bold leading-tight">Diamond Coupon</div>
                <div className="text-[15px] font-semibold text-white/90">For Amusement Only</div>
              </div>
              <div className="space-y-2 text-[16px]">
                <div>Agent ID : <span className="font-semibold">{ticket?.userName || 'user'}</span></div>
                <div>Quiz : <span className="font-semibold">{overview.quizLabel}</span></div>
                <div>Coupon Dr Time : <span className="font-semibold">{ticket.drawTime || '-'}</span></div>
                <div>Coupon Dr Date : <span className="font-semibold">{ticket.drawDate || '-'}</span></div>
                <div>Coupon Time : <span className="font-semibold">{couponTime}</span></div>
                <div>Total Point : <span className="font-semibold">{ticket.totalPoints ?? 0}</span></div>
                <div>Win point : <span className="font-semibold">{ticket.totalWin ?? 0}</span></div>
                <div>Game ID : <span className="font-semibold">{ticket.gameId || '-'}</span></div>
              </div>
              <div className="mt-4 rounded-lg border border-white/20 bg-black/15 p-3">
                <div className="mb-2 text-[16px] font-bold uppercase tracking-wide text-white/90">Overview</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[14px]">
                  <div>Total Bets : <span className="font-semibold">{overview.totalBets}</span></div>
                  <div>Win Bets : <span className="font-semibold text-emerald-300">{overview.winBets}</span></div>
                  <div>Loss Bets : <span className="font-semibold text-rose-300">{overview.lossBets}</span></div>
                  <div>Stake : <span className="font-semibold">{overview.totalStake}</span></div>
                  <div>Total Win : <span className="font-semibold text-emerald-300">{overview.totalWin}</span></div>
                  <div>
                    Net : <span className={`font-semibold ${overview.net >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{overview.net}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="min-h-0 overflow-hidden rounded-xl border border-[#6d6d6d] bg-[#4f4f4f] p-4">
              <div className="mb-3 text-[22px] font-bold text-white">Ticket Items</div>
              <div className="grid max-h-[520px] grid-cols-2 gap-3 overflow-y-auto">
                <div className="space-y-2">
                  {leftCol.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-md px-3 py-2.5 text-[15px] font-bold ${
                        item.outcome === 'win'
                          ? 'border border-emerald-300 bg-emerald-50 text-emerald-700'
                          : item.outcome === 'cancelled'
                            ? 'border border-slate-300 bg-slate-100 text-slate-700'
                          : 'bg-[#d0d0d0] text-[#c71616]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>{`${item.panel}${item.displayNum} [${item.mode}] x ${item.points}`}</span>
                        <span className={`${item.outcome === 'win' ? 'text-emerald-700' : item.outcome === 'loss' ? 'text-rose-700' : item.outcome === 'cancelled' ? 'text-slate-700' : 'text-slate-600'}`}>
                          {item.outcome.toUpperCase()}
                        </span>
                      </div>
                      <div className="mt-1 text-[14px] font-semibold text-slate-700">
                        Result: {item.matchedPanel}{item.matchedResult} | Win: {item.winAmount}
                      </div>
                      {item.payoutLabel ? (
                        <div className="mt-0.5 text-[13px] font-semibold text-emerald-700">Payout: {item.payoutLabel}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {rightCol.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-md px-3 py-2.5 text-[15px] font-bold ${
                        item.outcome === 'win'
                          ? 'border border-emerald-300 bg-emerald-50 text-emerald-700'
                          : item.outcome === 'cancelled'
                            ? 'border border-slate-300 bg-slate-100 text-slate-700'
                          : 'bg-[#d0d0d0] text-[#c71616]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>{`${item.panel}${item.displayNum} [${item.mode}] x ${item.points}`}</span>
                        <span className={`${item.outcome === 'win' ? 'text-emerald-700' : item.outcome === 'loss' ? 'text-rose-700' : item.outcome === 'cancelled' ? 'text-slate-700' : 'text-slate-600'}`}>
                          {item.outcome.toUpperCase()}
                        </span>
                      </div>
                      <div className="mt-1 text-[14px] font-semibold text-slate-700">
                        Result: {item.matchedPanel}{item.matchedResult} | Win: {item.winAmount}
                      </div>
                      {item.payoutLabel ? (
                        <div className="mt-0.5 text-[13px] font-semibold text-emerald-700">Payout: {item.payoutLabel}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDetailsModal;
