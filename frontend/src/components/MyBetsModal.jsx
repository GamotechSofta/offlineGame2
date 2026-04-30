import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cancelMyQuizBet, cancelMyQuizTicket, getMyQuizBets } from '../api/quizApi';
import { updateUserBalance } from '../api/bets';
import { useSectionAutoRefresh } from '../hooks/useSectionAutoRefresh';

const QUIZ_HISTORY_LIMIT = 10000;
const BET_FILTERS = {
  TODAY: 'today',
  ALL: 'all',
};
const DRAW_FILTERS = {
  ALL: 'all',
  ADVANCE: 'advance',
  NORMAL: 'normal',
};
const IST_DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const IST_DATE_LABEL_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const statusLabel = (status) => {
  if (status === 'win') return 'Won';
  if (status === 'lose') return 'Lost';
  if (status === 'pending') return 'Pending';
  if (status === 'cancelled') return 'Canceled';
  return status || '—';
};

const computeDisplayStatus = (row, group) => {
  if (String(row?.status || '').toLowerCase() === 'cancelled') return 'cancelled';
  const winning = group?.winningNumber;
  if (group?.slotEnded && winning != null) {
    const betNo = String(row?.number ?? '').padStart(2, '0');
    return betNo === String(winning) ? 'win' : 'lose';
  }
  return row?.status || 'pending';
};

const groupQuizRows = (items) => {
  const map = new Map();
  for (const row of items) {
    const k = String(row.ticketId || `${row.slotStartIso}|${row.quizId}`);
    if (!map.has(k)) {
      map.set(k, {
        ticketId: row.ticketId || null,
        slotStartIso: row.slotStartIso,
        drawLabelEnd: row.drawLabelEnd,
        slotEnded: row.slotEnded,
        winningNumber: row.winningNumber,
        isAdvanceDraw: false,
        lines: [],
      });
    }
    const group = map.get(k);
    const createdAtMs = new Date(row?.createdAt || 0).getTime();
    const slotStartMs = new Date(row?.slotStartIso || 0).getTime();
    if (Number.isFinite(createdAtMs) && Number.isFinite(slotStartMs) && slotStartMs - createdAtMs > 60 * 1000) {
      group.isAdvanceDraw = true;
    }
    group.lines.push(row);
  }
  return [...map.values()].map((g) => {
    const totalAmount = g.lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
    const pendingLines = g.lines.filter((line) => String(line.status || '').toLowerCase() === 'pending');
    return {
      ...g,
      totalAmount,
      pendingCount: pendingLines.length,
      lines: [...g.lines].sort((a, b) => (Number(a.quizId) - Number(b.quizId)) || (Number(a.number) - Number(b.number))),
    };
  });
};

const getIstDayKey = (dateInput) => {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return '';
  return IST_DAY_FORMATTER.format(date);
};

const formatIstDateLabel = (dateInput) => {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return '—';
  return IST_DATE_LABEL_FORMATTER.format(date);
};

const isAdvanceDrawRow = (row) => {
  const createdAtMs = new Date(row?.createdAt || 0).getTime();
  const slotStartMs = new Date(row?.slotStartIso || 0).getTime();
  if (!Number.isFinite(createdAtMs) || !Number.isFinite(slotStartMs)) return false;
  return slotStartMs - createdAtMs > 60 * 1000;
};

const MyBetsModal = ({ open, onClose }) => {
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [errQuiz, setErrQuiz] = useState('');
  const [quizItems, setQuizItems] = useState([]);
  const [cancellingId, setCancellingId] = useState('');
  const [cancelErr, setCancelErr] = useState('');
  const [pendingCancelTarget, setPendingCancelTarget] = useState(null);
  const [betFilter, setBetFilter] = useState(BET_FILTERS.TODAY);
  const [drawFilter, setDrawFilter] = useState(DRAW_FILTERS.ALL);
  const listScrollRef = useRef(null);
  const lastScrollTopRef = useRef(0);

  const loadQuiz = useCallback((options = {}) => {
    const silent = Boolean(options?.silent);
    const preserveScroll = Boolean(options?.preserveScroll);
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user?.token) {
      setQuizItems([]);
      setErrQuiz('');
      setLoadingQuiz(false);
      return Promise.resolve();
    }
    if (preserveScroll && listScrollRef.current) {
      lastScrollTopRef.current = listScrollRef.current.scrollTop;
    }
    if (!silent) {
      setLoadingQuiz(true);
    }
    setErrQuiz('');
    return getMyQuizBets(QUIZ_HISTORY_LIMIT)
      .then((j) => {
        const rows = Array.isArray(j?.data) ? j.data : [];
        setQuizItems(rows);
      })
      .catch((e) => {
        if (e.status === 401) setErrQuiz('Login required.');
        else setErrQuiz(e.message || 'Failed to load');
      })
      .finally(() => {
        if (!silent) {
          setLoadingQuiz(false);
        }
        if (preserveScroll) {
          requestAnimationFrame(() => {
            if (listScrollRef.current) {
              listScrollRef.current.scrollTop = lastScrollTopRef.current;
            }
          });
        }
      });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    setCancelErr('');
    setPendingCancelTarget(null);
    setBetFilter(BET_FILTERS.TODAY);
    setDrawFilter(DRAW_FILTERS.ALL);
    loadQuiz();
  }, [open, loadQuiz]);

  useSectionAutoRefresh({
    enabled: open,
    intervalMs: 10000,
    immediate: false,
    onRefresh: () => {
      void loadQuiz({ silent: true, preserveScroll: true });
    },
  });

  const filteredQuizItems = useMemo(() => {
    const todayIstKey = getIstDayKey(new Date());
    return quizItems.filter((row) => {
      if (betFilter === BET_FILTERS.TODAY) {
        const primaryDate = row?.createdAt || row?.placedAt || row?.updatedAt || row?.slotStartIso;
        if (getIstDayKey(primaryDate) !== todayIstKey) return false;
      }
      if (drawFilter === DRAW_FILTERS.ADVANCE) return isAdvanceDrawRow(row);
      if (drawFilter === DRAW_FILTERS.NORMAL) return !isAdvanceDrawRow(row);
      return true;
    });
  }, [betFilter, drawFilter, quizItems]);

  const quizGroups = useMemo(() => groupQuizRows(filteredQuizItems), [filteredQuizItems]);

  const refreshQuiz = useCallback(() => {
    loadQuiz();
  }, [loadQuiz]);

  const handleCancelTicket = useCallback(
    async (ticketId) => {
      if (!ticketId) return;
      setCancelErr('');
      setCancellingId(`ticket:${ticketId}`);
      try {
        const j = await cancelMyQuizTicket(ticketId, '2d');
        const bal = j?.data?.balance;
        if (bal != null) updateUserBalance(bal);
        // Update all rows under the cancelled ticket immediately.
        setQuizItems((prev) => prev.map((row) => (
          String(row?.ticketId || '') === String(ticketId)
            ? { ...row, status: 'cancelled' }
            : row
        )));
        // Keep server data in sync without triggering blocking loading state.
        void loadQuiz({ silent: true, preserveScroll: true });
      } catch (e) {
        setCancelErr(e.message || 'Cancel failed');
      } finally {
        setCancellingId('');
      }
    },
    [loadQuiz],
  );

  const handleCancelSingleBet = useCallback(
    async (betId) => {
      if (!betId) return;
      setCancelErr('');
      setCancellingId(`bet:${betId}`);
      try {
        const j = await cancelMyQuizBet(betId, '2d');
        const bal = j?.data?.balance;
        if (bal != null) updateUserBalance(bal);
        setQuizItems((prev) => prev.map((row) => (
          String(row?.id) === String(betId)
            ? { ...row, status: 'cancelled' }
            : row
        )));
        void loadQuiz({ silent: true, preserveScroll: true });
      } catch (e) {
        setCancelErr(e.message || 'Cancel failed');
      } finally {
        setCancellingId('');
      }
    },
    [loadQuiz],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2">
      <div className="flex max-h-[90vh] w-full max-w-[960px] flex-col overflow-hidden rounded-md border border-[#6c6c6c] bg-[#f1f1f1] text-black shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-[#a1a1a1] bg-[#e3e3e3] px-3 py-2">
          <h3 className="text-[13px] font-bold">My Bets / Results</h3>
          <button
            type="button"
            onClick={onClose}
            className="h-7 rounded border border-[#c5362d] bg-[#ef3f34] px-2.5 text-[11px] font-semibold text-white"
          >
            Close
          </button>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#c0c0c0] bg-gradient-to-r from-[#e9edf3] to-[#dce4ef] px-3 py-2.5">
          <span className="rounded px-2.5 py-1 text-[11px] font-semibold bg-[#2d9de8] text-white">
            Quiz Tickets (Account)
          </span>
          <div className="flex items-center gap-1.5 rounded-lg border border-[#bfd1ea] bg-white/85 px-2 py-1.5 shadow-sm">
            <span className="px-1 text-[9px] font-bold uppercase tracking-wide text-[#385d8a]">Bet Type</span>
            <button
              type="button"
              onClick={() => setBetFilter(BET_FILTERS.TODAY)}
              className={`rounded-md border px-2.5 py-1 text-[10px] font-semibold transition ${
                betFilter === BET_FILTERS.TODAY
                  ? 'border-[#0f4aa2] bg-gradient-to-b from-[#2e7be6] to-[#1f63cd] text-white shadow-[0_2px_8px_rgba(37,99,235,0.28)]'
                  : 'border-[#b5bfd1] bg-[#f8fafc] text-[#334155] hover:bg-[#eef2f7]'
              }`}
            >
              Today's Bets
            </button>
            <button
              type="button"
              onClick={() => setBetFilter(BET_FILTERS.ALL)}
              className={`rounded-md border px-2.5 py-1 text-[10px] font-semibold transition ${
                betFilter === BET_FILTERS.ALL
                  ? 'border-[#0f4aa2] bg-gradient-to-b from-[#2e7be6] to-[#1f63cd] text-white shadow-[0_2px_8px_rgba(37,99,235,0.28)]'
                  : 'border-[#b5bfd1] bg-[#f8fafc] text-[#334155] hover:bg-[#eef2f7]'
              }`}
            >
              All Bets
            </button>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-[#c9dec1] bg-white/85 px-2 py-1.5 shadow-sm">
            <span className="px-1 text-[9px] font-bold uppercase tracking-wide text-[#3d7040]">Draw Type</span>
            <button
              type="button"
              onClick={() => setDrawFilter(DRAW_FILTERS.ADVANCE)}
              className={`rounded-md border px-2.5 py-1 text-[10px] font-semibold transition ${
                drawFilter === DRAW_FILTERS.ADVANCE
                  ? 'border-[#2c7a3f] bg-gradient-to-b from-[#33b05a] to-[#249748] text-white shadow-[0_2px_8px_rgba(34,197,94,0.28)]'
                  : 'border-[#b5bfd1] bg-[#f8fafc] text-[#334155] hover:bg-[#eef2f7]'
              }`}
            >
              Advance Draw
            </button>
            <button
              type="button"
              onClick={() => setDrawFilter(DRAW_FILTERS.NORMAL)}
              className={`rounded-md border px-2.5 py-1 text-[10px] font-semibold transition ${
                drawFilter === DRAW_FILTERS.NORMAL
                  ? 'border-[#2c7a3f] bg-gradient-to-b from-[#33b05a] to-[#249748] text-white shadow-[0_2px_8px_rgba(34,197,94,0.28)]'
                  : 'border-[#b5bfd1] bg-[#f8fafc] text-[#334155] hover:bg-[#eef2f7]'
              }`}
            >
              Normal Draw
            </button>
            <button
              type="button"
              onClick={() => setDrawFilter(DRAW_FILTERS.ALL)}
              className={`rounded-md border px-2.5 py-1 text-[10px] font-semibold transition ${
                drawFilter === DRAW_FILTERS.ALL
                  ? 'border-[#2c7a3f] bg-gradient-to-b from-[#33b05a] to-[#249748] text-white shadow-[0_2px_8px_rgba(34,197,94,0.28)]'
                  : 'border-[#b5bfd1] bg-[#f8fafc] text-[#334155] hover:bg-[#eef2f7]'
              }`}
            >
              All Draws
            </button>
          </div>
          <button
            type="button"
            onClick={() => refreshQuiz()}
            className="ml-auto rounded border border-[#666] bg-white px-2 py-1 text-[10px] font-semibold"
          >
            Refresh
          </button>
        </div>
        <div ref={listScrollRef} className="min-h-0 flex-1 overflow-y-auto p-3 text-[11px]">
          <p className="mb-2 text-[10px] text-gray-700">
            Wallet-based bets; each number is shown in a separate row. Win/loss updates after slot close. Cancel is only
            allowed before that draw closes (pending tickets). Canceled tickets stay listed in Action; you can place the same
            bet again on the board.
          </p>
          {cancelErr ? <p className="mb-2 text-center text-[11px] text-red-700">{cancelErr}</p> : null}
          {loadingQuiz && <p className="text-center">Loading...</p>}
          {errQuiz && <p className="text-center text-red-700">{errQuiz}</p>}
          {!loadingQuiz && !errQuiz && filteredQuizItems.length === 0 && (
            <p className="text-center text-gray-600">No quiz tickets yet or not logged in.</p>
          )}
          {!loadingQuiz &&
            !errQuiz &&
            quizGroups.map((g) => (
              <div key={`${g.ticketId || 'legacy'}-${g.slotStartIso}`} className="mb-3 rounded border border-[#bbb] bg-white p-2.5 shadow-sm">
                <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-bold text-[#1a4d6e]">
                  Ticket: {g.ticketId ? String(g.ticketId).slice(-8).toUpperCase() : 'Legacy'}
                  <span className="rounded bg-[#f2f6ff] px-2 py-0.5 text-[#374151]">
                    Draw: {g.drawLabelEnd ?? '—'}
                  </span>
                  <span className="rounded bg-[#f2f6ff] px-2 py-0.5 text-[#374151]">
                    Total: ₹{g.totalAmount}
                  </span>
                  <span className="rounded bg-[#f2f6ff] px-2 py-0.5 text-[#374151]">
                    Bets: {g.lines.length}
                  </span>
                  <span className="rounded bg-[#eef2ff] px-2 py-0.5 text-[#374151]">
                    Date: {formatIstDateLabel(g.lines?.[0]?.createdAt || g.lines?.[0]?.slotStartIso || g.slotStartIso)}
                  </span>
                  {g.isAdvanceDraw ? (
                    <span className="rounded bg-[#1d4ed8] px-2 py-0.5 text-white">Advance Draw</span>
                  ) : null}
                  {g.slotEnded && g.winningNumber != null && (
                    <span className="rounded bg-[#f2f6ff] px-2 py-0.5 font-mono text-[#333]">Winning No.: {g.winningNumber}</span>
                  )}
                  {g.pendingCount > 0 && !g.slotEnded && String(g.ticketId || '').length > 0 ? (
                    <button
                      type="button"
                      disabled={cancellingId === `ticket:${g.ticketId}`}
                      onClick={() => setPendingCancelTarget({ type: 'ticket', id: String(g.ticketId) })}
                      className="ml-auto rounded border border-[#c5362d] bg-[#ffe5e5] px-2 py-0.5 text-[10px] font-semibold text-[#a31] hover:bg-[#ffd5d5] disabled:opacity-60"
                    >
                      {cancellingId === `ticket:${g.ticketId}` ? '…' : 'Cancel Full Ticket'}
                    </button>
                  ) : null}
                </div>
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-[#d9e4f5]">
                      <th className="border border-[#a0a0a0] p-1">Quiz</th>
                      <th className="border border-[#a0a0a0] p-1">Number</th>
                      <th className="border border-[#a0a0a0] p-1">Amount</th>
                      <th className="border border-[#a0a0a0] p-1">Status</th>
                      <th className="border border-[#a0a0a0] p-1">Win Amount</th>
                      <th className="border border-[#a0a0a0] p-1">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.lines.map((row, rowIndex) => {
                      const displayStatus = computeDisplayStatus(row, g);
                      return (
                        <tr key={row.id} className="bg-[#f8f8f8]">
                          <td className="border border-[#a0a0a0] p-1 font-mono font-semibold">
                            Q{String(row.quizId).padStart(2, '0')}
                          </td>
                          <td className="border border-[#a0a0a0] p-1 font-mono font-semibold">
                            {String(row.number).padStart(2, '0')}
                          </td>
                          <td className="border border-[#a0a0a0] p-1">₹{row.amount}</td>
                          <td
                            className={`border border-[#a0a0a0] p-1 font-semibold ${
                              displayStatus === 'win'
                                ? 'text-green-700'
                                : displayStatus === 'lose'
                                  ? 'text-red-700'
                                  : displayStatus === 'cancelled'
                                    ? 'text-gray-600'
                                    : 'text-amber-800'
                            }`}
                          >
                            {statusLabel(displayStatus)}
                          </td>
                          <td className="border border-[#a0a0a0] p-1">
                            {displayStatus === 'win'
                              ? row.winPayout > 0
                                ? `₹${row.winPayout}`
                                : 'Processing...'
                              : '—'}
                          </td>
                          <td className="border border-[#a0a0a0] p-1 text-center align-top">
                            {displayStatus === 'pending' && !g.slotEnded && String(row?.id || '').length > 0 ? (
                              <button
                                type="button"
                                disabled={cancellingId === `bet:${row.id}`}
                                onClick={() => setPendingCancelTarget({ type: 'bet', id: String(row.id) })}
                                className="rounded border border-[#c5362d] bg-[#ffe5e5] px-2 py-0.5 text-[10px] font-semibold text-[#a31] hover:bg-[#ffd5d5] disabled:opacity-60"
                              >
                                {cancellingId === `bet:${row.id}` ? '…' : 'Cancel Bet'}
                              </button>
                            ) : displayStatus === 'cancelled' ? (
                              'Canceled'
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
        </div>
      </div>
      {pendingCancelTarget?.id ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-3">
          <div className="w-full max-w-sm rounded-lg border border-[#6c6c6c] bg-white p-4 text-center shadow-xl">
            <h4 className="text-[16px] font-bold text-[#1f2937]">Are you sure?</h4>
            <p className="mt-2 text-[12px] text-gray-700">
              {pendingCancelTarget?.type === 'ticket'
                ? 'Do you want to cancel this full ticket?'
                : 'Do you want to cancel this bet?'}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setPendingCancelTarget(null)}
                className="h-9 min-w-[90px] rounded border border-[#9ca3af] bg-[#f3f4f6] px-3 text-[12px] font-semibold text-[#111827]"
              >
                No
              </button>
              <button
                type="button"
                disabled={cancellingId === `${pendingCancelTarget?.type}:${pendingCancelTarget?.id}`}
                onClick={async () => {
                  const target = pendingCancelTarget;
                  setPendingCancelTarget(null);
                  if (!target?.id) return;
                  if (target.type === 'ticket') {
                    await handleCancelTicket(target.id);
                  } else {
                    await handleCancelSingleBet(target.id);
                  }
                }}
                className="h-9 min-w-[110px] rounded border border-[#c5362d] bg-[#ef3f34] px-3 text-[12px] font-semibold text-white disabled:opacity-60"
              >
                {cancellingId === `${pendingCancelTarget?.type}:${pendingCancelTarget?.id}` ? 'Cancelling…' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default MyBetsModal;
