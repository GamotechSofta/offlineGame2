import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { cancelMyQuizBet, getMyQuizBets } from '../api/quizApi';
import { updateUserBalance } from '../api/bets';

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
    const k = `${row.slotStartIso}|${row.quizId}`;
    if (!map.has(k)) {
      map.set(k, {
        slotStartIso: row.slotStartIso,
        quizId: row.quizId,
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
  return [...map.values()].map((g) => ({
    ...g,
    lines: [...g.lines].sort((a, b) => Number(a.number) - Number(b.number)),
  }));
};

const MyBetsModal = ({ open, onClose }) => {
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [errQuiz, setErrQuiz] = useState('');
  const [quizItems, setQuizItems] = useState([]);
  const [cancellingId, setCancellingId] = useState('');
  const [cancelErr, setCancelErr] = useState('');

  const loadQuiz = useCallback(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user?.token) {
      setQuizItems([]);
      setErrQuiz('');
      setLoadingQuiz(false);
      return Promise.resolve();
    }
    setLoadingQuiz(true);
    setErrQuiz('');
    return getMyQuizBets(120)
      .then((j) => {
        const rows = Array.isArray(j?.data) ? j.data : [];
        setQuizItems(rows);
      })
      .catch((e) => {
        if (e.status === 401) setErrQuiz('Login required.');
        else setErrQuiz(e.message || 'Failed to load');
      })
      .finally(() => {
        setLoadingQuiz(false);
      });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    setCancelErr('');
    loadQuiz();
  }, [open, loadQuiz]);

  const quizGroups = useMemo(() => groupQuizRows(quizItems), [quizItems]);

  const refreshQuiz = useCallback(() => {
    loadQuiz();
  }, [loadQuiz]);

  const handleCancelBet = useCallback(
    async (betId) => {
      if (!betId) return;
      setCancelErr('');
      setCancellingId(String(betId));
      try {
        const j = await cancelMyQuizBet(betId, '2d');
        const bal = j?.data?.balance;
        if (bal != null) updateUserBalance(bal);
        await loadQuiz();
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
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-[#c0c0c0] bg-[#dadada] px-3 py-2">
          <span className="rounded px-2.5 py-1 text-[11px] font-semibold bg-[#2d9de8] text-white">
            Quiz Tickets (Account)
          </span>
          <button
            type="button"
            onClick={() => refreshQuiz()}
            className="ml-auto rounded border border-[#666] bg-white px-2 py-1 text-[10px] font-semibold"
          >
            Refresh
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 text-[11px]">
          <p className="mb-2 text-[10px] text-gray-700">
            Wallet-based bets; each number is shown in a separate row. Win/loss updates after slot close. Cancel is only
            allowed before that draw closes (pending tickets). Canceled tickets stay listed in Action; you can place the same
            bet again on the board.
          </p>
          {cancelErr ? <p className="mb-2 text-center text-[11px] text-red-700">{cancelErr}</p> : null}
          {loadingQuiz && <p className="text-center">Loading...</p>}
          {errQuiz && <p className="text-center text-red-700">{errQuiz}</p>}
          {!loadingQuiz && !errQuiz && quizItems.length === 0 && (
            <p className="text-center text-gray-600">No quiz tickets yet or not logged in.</p>
          )}
          {!loadingQuiz &&
            !errQuiz &&
            quizGroups.map((g) => (
              <div key={`${g.slotStartIso}-${g.quizId}`} className="mb-3 rounded border border-[#bbb] bg-white p-2.5 shadow-sm">
                <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-bold text-[#1a4d6e]">
                  QUIZ{String(g.quizId).padStart(2, '0')} · Draw: {g.drawLabelEnd ?? '—'}
                  {g.isAdvanceDraw ? (
                    <span className="rounded bg-[#1d4ed8] px-2 py-0.5 text-white">Advance Draw</span>
                  ) : null}
                  {g.slotEnded && g.winningNumber != null && (
                    <span className="rounded bg-[#f2f6ff] px-2 py-0.5 font-mono text-[#333]">Winning No.: {g.winningNumber}</span>
                  )}
                </div>
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-[#d9e4f5]">
                      <th className="border border-[#a0a0a0] p-1">Number</th>
                      <th className="border border-[#a0a0a0] p-1">Amount</th>
                      <th className="border border-[#a0a0a0] p-1">Status</th>
                      <th className="border border-[#a0a0a0] p-1">Win Amount</th>
                      <th className="border border-[#a0a0a0] p-1">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.lines.map((row) => {
                      const displayStatus = computeDisplayStatus(row, g);
                      const canCancel =
                        row.status === 'pending' &&
                        !g.slotEnded &&
                        displayStatus === 'pending' &&
                        String(row.id || '').length > 0;
                      return (
                        <tr key={row.id} className="bg-[#f8f8f8]">
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
                            {canCancel ? (
                              <button
                                type="button"
                                disabled={cancellingId === row.id}
                                onClick={() => handleCancelBet(row.id)}
                                className="rounded border border-[#c5362d] bg-[#ffe5e5] px-2 py-0.5 text-[10px] font-semibold text-[#a31] hover:bg-[#ffd5d5] disabled:opacity-60"
                              >
                                {cancellingId === row.id ? '…' : 'Cancel'}
                              </button>
                            ) : displayStatus === 'cancelled' ? (
                              <div className="flex flex-col items-center gap-0.5 px-1">
                                <span className="font-semibold text-gray-700">Canceled</span>
                                <span className="text-[9px] leading-tight text-gray-600">
                                  Refunded. You can place this bet again on the board.
                                </span>
                              </div>
                            ) : (
                              <span className="text-[#999]">—</span>
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
    </div>
  );
};

export default MyBetsModal;
