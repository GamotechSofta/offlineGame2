import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { cancelMyQuizBet, cancelMyQuizTicket, getMyQuizBets, getMyQuizTicketLines } from '../api/quizApi';
import { updateUserBalance } from '../api/bets';

const TICKET_PAGE_SIZE = 5;
/** Max bet lines per request when using ticket pagination (server caps too). */
const QUIZ_LINES_LIMIT_PAGED = Math.min(15000, TICKET_PAGE_SIZE * 3000);
const BET_FILTERS = {
  TODAY: 'today',
  ALL: 'all',
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
  const dbStatus = String(row?.status || '').toLowerCase();
  if (dbStatus === 'win' || dbStatus === 'lose') return dbStatus;
  const rowWin = row?.winningNumber;
  const winning =
    rowWin != null && rowWin !== ''
      ? String(rowWin).trim()
      : group?.winningNumber != null
        ? String(group.winningNumber).trim()
        : null;
  if (group?.slotEnded && winning != null && winning !== '') {
    const pad = winning.length >= 3 ? 3 : 2;
    const betNo = String(row?.number ?? '').padStart(pad, '0');
    const winPadded = winning.padStart(pad, '0');
    return betNo === winPadded ? 'win' : 'lose';
  }
  return row?.status || 'pending';
};

/** Full draw results for a slot (all quizzes with picks), from API. */
const perQuizWinningFromSlotMap = (slotIso, slotWinnersBySlot, slotEnded) => {
  if (!slotEnded || !slotIso || !slotWinnersBySlot || typeof slotWinnersBySlot !== 'object') return [];
  const inner = slotWinnersBySlot[slotIso];
  if (!inner || typeof inner !== 'object') return [];
  return Object.keys(inner)
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b)
    .map((q) => `Q${String(q).padStart(2, '0')}:${inner[String(q)]}`);
};

/** Fallback: winning numbers only for quizzes present in loaded rows. */
const perQuizWinningLabels = (lines, slotEnded) => {
  if (!slotEnded || !Array.isArray(lines)) return [];
  const m = new Map();
  for (const line of lines) {
    const q = line?.quizId;
    const w = line?.winningNumber;
    if (q == null || w == null || w === '') continue;
    m.set(Number(q), String(w));
  }
  return [...m.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([q, w]) => `Q${String(q).padStart(2, '0')}:${w}`);
};

/** Per-ticket totals for summary row (collapsed view). */
const summarizeTicketLines = (groupWithLines) => {
  const lines = groupWithLines.lines || [];
  let winningLineCount = 0;
  let totalWinPayoutSum = 0;
  for (const line of lines) {
    const st = computeDisplayStatus(line, groupWithLines);
    if (st === 'win') {
      winningLineCount += 1;
      totalWinPayoutSum += Number(line.winPayout || 0);
    }
  }
  return {
    betLineCount: lines.length,
    winningLineCount,
    totalWinPayoutSum,
  };
};

const SLOT_MS = 15 * 60 * 1000;
const getTicketDisplayPriority = (group) => {
  const slotStartMs = new Date(group?.slotStartIso || 0).getTime();
  if (!Number.isFinite(slotStartMs)) return 3;
  const now = Date.now();
  const slotEndMs = slotStartMs + SLOT_MS;
  // 1) Running slot first
  if (now >= slotStartMs && now < slotEndMs) return 0;
  // 2) Future slots next
  if (now < slotStartMs) return 1;
  // 3) Declared / completed slots last
  return 2;
};

const groupQuizRows = (items, ticketSummaryByKey = {}) => {
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
    const linesSorted = [...g.lines].sort(
      (a, b) => (Number(a.quizId) - Number(b.quizId)) || (Number(a.number) - Number(b.number)),
    );
    const totalAmount = linesSorted.reduce((sum, line) => sum + Number(line.amount || 0), 0);
    const pendingLines = linesSorted.filter((line) => String(line.status || '').toLowerCase() === 'pending');
    const groupForStats = { ...g, lines: linesSorted };
    const { betLineCount, winningLineCount, totalWinPayoutSum } = summarizeTicketLines(groupForStats);
    const summaryKey =
      g.ticketId && g.slotStartIso ? `${String(g.ticketId).trim()}|${g.slotStartIso}` : '';
    const srv = summaryKey && ticketSummaryByKey[summaryKey] ? ticketSummaryByKey[summaryKey] : null;
    const cancelledLines = srv ? Math.max(0, (srv.lineCountAll || 0) - (srv.lineCountActive || 0)) : 0;
    return {
      ...g,
      totalAmount: srv ? srv.stakeActive : totalAmount,
      pendingCount: pendingLines.length,
      betLineCount: srv ? srv.lineCountActive : betLineCount,
      winningLineCount: srv ? srv.winLineCount : winningLineCount,
      totalWinPayoutSum: srv ? srv.totalWinPayout : totalWinPayoutSum,
      ticketStatsFromServer: Boolean(srv),
      cancelledLines,
      linesLoaded: linesSorted.length,
      lines: linesSorted,
    };
  });
};

const pairKeyTicketSlot = (ticketId, slotStartIso) => {
  if (!ticketId || !slotStartIso) return '';
  return `${String(ticketId).trim()}|${slotStartIso}`;
};

/** Ticket shells from fast API path + per-ticket lines loaded on expand. */
const buildGroupsFromShells = (shells, ticketSummaryByKey, linesByKey) => {
  return shells.map((s) => {
    const summaryKey = pairKeyTicketSlot(s.ticketId, s.slotStartIso);
    const srv = summaryKey && ticketSummaryByKey[summaryKey] ? ticketSummaryByKey[summaryKey] : null;
    const linesRaw = summaryKey && linesByKey[summaryKey] ? linesByKey[summaryKey] : [];
    const linesSorted = [...linesRaw].sort(
      (a, b) => (Number(a.quizId) - Number(b.quizId)) || (Number(a.number) - Number(b.number)),
    );
    const pendingFromLines = linesSorted.filter((line) => String(line.status || '').toLowerCase() === 'pending');
    const pendingCount = linesSorted.length ? pendingFromLines.length : Number(s.pendingLineCount || 0);
    const groupForStats = {
      ticketId: s.ticketId,
      slotStartIso: s.slotStartIso,
      drawLabelEnd: s.drawLabelEnd,
      slotEnded: s.slotEnded,
      winningNumber: linesSorted[0]?.winningNumber ?? null,
      isAdvanceDraw: Boolean(s.isAdvanceDraw),
      lines: linesSorted,
    };
    const { betLineCount, winningLineCount, totalWinPayoutSum } = summarizeTicketLines(groupForStats);
    const cancelledLines = srv ? Math.max(0, (srv.lineCountAll || 0) - (srv.lineCountActive || 0)) : 0;
    return {
      ticketId: s.ticketId,
      slotStartIso: s.slotStartIso,
      createdAt: s.createdAt,
      drawLabelEnd: s.drawLabelEnd,
      slotEnded: s.slotEnded,
      winningNumber: groupForStats.winningNumber,
      isAdvanceDraw: Boolean(s.isAdvanceDraw),
      lines: linesSorted,
      totalAmount: srv ? srv.stakeActive : Number(s.stakeActive || 0),
      pendingCount,
      betLineCount: srv ? srv.lineCountActive : betLineCount,
      winningLineCount: srv ? srv.winLineCount : winningLineCount,
      totalWinPayoutSum: srv ? srv.totalWinPayout : totalWinPayoutSum,
      ticketStatsFromServer: Boolean(srv),
      cancelledLines,
      linesLoaded: linesSorted.length,
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

const MyBetsModal = ({ open, onClose }) => {
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [errQuiz, setErrQuiz] = useState('');
  const [quizItems, setQuizItems] = useState([]);
  /** Fast list: ticket rows without bet lines (lines load on "Show line bets"). */
  const [ticketsShells, setTicketsShells] = useState([]);
  const [ticketLinesByKey, setTicketLinesByKey] = useState({});
  const [loadingLinesKey, setLoadingLinesKey] = useState('');
  const ticketLinesRef = useRef({});
  const [ticketSummaryByKey, setTicketSummaryByKey] = useState({});
  const [slotWinnersBySlot, setSlotWinnersBySlot] = useState({});
  const [cancellingId, setCancellingId] = useState('');
  const [cancelErr, setCancelErr] = useState('');
  const [pendingCancelTarget, setPendingCancelTarget] = useState(null);
  const [betFilter, setBetFilter] = useState(BET_FILTERS.TODAY);
  /** ticket group key → line bets table expanded */
  const [expandedBetLines, setExpandedBetLines] = useState({});
  const [ticketPage, setTicketPage] = useState(1);
  const [hasMoreTickets, setHasMoreTickets] = useState(false);
  const [loadingMoreTickets, setLoadingMoreTickets] = useState(false);
  const listScrollRef = useRef(null);
  const lastScrollTopRef = useRef(0);

  const groupKey = (g) => `${g.ticketId || 'legacy'}-${g.slotStartIso}`;

  useEffect(() => {
    ticketLinesRef.current = ticketLinesByKey;
  }, [ticketLinesByKey]);

  const handleToggleLineBets = useCallback((key, g) => {
    let nextOpen = false;
    flushSync(() => {
      setExpandedBetLines((prev) => {
        nextOpen = !prev[key];
        return { ...prev, [key]: nextOpen };
      });
    });
    if (!nextOpen || !g?.ticketId) return;
    const pk = pairKeyTicketSlot(g.ticketId, g.slotStartIso);
    if (!pk || (ticketLinesRef.current[pk] || []).length > 0) return;
    setLoadingLinesKey(pk);
    getMyQuizTicketLines(g.ticketId, g.slotStartIso, '2d')
      .then((j) => {
        const rows = Array.isArray(j?.data) ? j.data : [];
        setTicketLinesByKey((prev) => ({ ...prev, [pk]: rows }));
      })
      .catch(() => {
        setTicketLinesByKey((prev) => ({ ...prev, [pk]: [] }));
      })
      .finally(() => {
        setLoadingLinesKey('');
      });
  }, []);

  const loadQuiz = useCallback((options = {}) => {
    const silent = Boolean(options?.silent);
    const preserveScroll = Boolean(options?.preserveScroll);
    const append = Boolean(options?.append);
    const pageToFetch = Math.max(1, Number(options?.pageToFetch || 1));
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user?.token) {
      setQuizItems([]);
      setTicketsShells([]);
      setTicketLinesByKey({});
      setTicketSummaryByKey({});
      setSlotWinnersBySlot({});
      setErrQuiz('');
      setLoadingQuiz(false);
      setLoadingMoreTickets(false);
      return Promise.resolve();
    }
    if (preserveScroll && listScrollRef.current) {
      lastScrollTopRef.current = listScrollRef.current.scrollTop;
    }
    if (append) {
      setLoadingMoreTickets(true);
    } else if (!silent) {
      setLoadingQuiz(true);
    }
    setErrQuiz('');
    const skipSettleEff = options.skipSettle !== undefined ? Boolean(options.skipSettle) : silent;
    return getMyQuizBets(QUIZ_LINES_LIMIT_PAGED, '2d', {
      ticketLimit: TICKET_PAGE_SIZE,
      page: pageToFetch,
      // Keep server scope broad; client-side IST filter below is the source of truth for "Today".
      // This avoids backend timezone/scope mismatches hiding valid today's bets.
      scope: 'all',
      skipSettle: skipSettleEff,
      ticketsOnly: true,
    })
      .then((j) => {
        const rows = Array.isArray(j?.data) ? j.data : [];
        const hasShellPayload = Array.isArray(j?.ticketsPage);
        const shells = hasShellPayload ? j.ticketsPage : null;
        const nextSummary = j?.ticketSummaryByKey && typeof j.ticketSummaryByKey === 'object' ? j.ticketSummaryByKey : {};
        const nextWinners = j?.slotWinnersBySlot && typeof j.slotWinnersBySlot === 'object' ? j.slotWinnersBySlot : {};
        setHasMoreTickets(Boolean(j?.pagination?.hasMore));
        setTicketPage(pageToFetch);
        if (hasShellPayload) {
          setTicketsShells((prev) => (append ? [...prev, ...shells] : shells));
          setQuizItems([]);
        } else {
          setTicketsShells([]);
          setQuizItems((prev) => (append ? [...prev, ...rows] : rows));
        }
        if (!append) {
          setTicketLinesByKey({});
          setExpandedBetLines({});
        }
        setTicketSummaryByKey((prev) => (append ? { ...prev, ...nextSummary } : nextSummary));
        setSlotWinnersBySlot((prev) => (append ? { ...prev, ...nextWinners } : nextWinners));
        const bal = j?.balance;
        if (bal != null && Number.isFinite(Number(bal))) {
          const n = Number(bal);
          updateUserBalance(n);
          window.dispatchEvent(new CustomEvent('balanceUpdated', { detail: { balance: n } }));
        }
      })
      .catch((e) => {
        if (e.status === 401) setErrQuiz('Login required.');
        else setErrQuiz(e.message || 'Failed to load');
      })
      .finally(() => {
        if (append) {
          setLoadingMoreTickets(false);
        }
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
  }, [betFilter]);

  useEffect(() => {
    if (!open) return undefined;
    setCancelErr('');
    setPendingCancelTarget(null);
    setBetFilter(BET_FILTERS.TODAY);
    setExpandedBetLines({});
    setTicketsShells([]);
    setQuizItems([]);
    setTicketLinesByKey({});
    setTicketSummaryByKey({});
    setSlotWinnersBySlot({});
    setTicketPage(1);
    setHasMoreTickets(false);
    setLoadingMoreTickets(false);
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setExpandedBetLines({});
    setTicketPage(1);
    setHasMoreTickets(false);
    setLoadingMoreTickets(false);
    loadQuiz({ pageToFetch: 1, skipSettle: true });
  }, [betFilter, open, loadQuiz]);

  const filteredQuizItems = useMemo(() => {
    const todayIstKey = getIstDayKey(new Date());
    return quizItems.filter((row) => {
      if (betFilter === BET_FILTERS.TODAY) {
        const dateCandidates = [
          row?.slotStartIso,
          row?.createdAt,
          row?.placedAt,
          row?.updatedAt,
          row?.slotEndIso,
        ].filter(Boolean);
        const isTodayByAnyTimestamp = dateCandidates.some((d) => getIstDayKey(d) === todayIstKey);
        if (!isTodayByAnyTimestamp) return false;
      }
      return true;
    });
  }, [betFilter, quizItems]);

  const filteredTicketShells = useMemo(() => {
    const todayIstKey = getIstDayKey(new Date());
    return ticketsShells.filter((s) => {
      if (betFilter === BET_FILTERS.TODAY) {
        const dateCandidates = [s?.slotStartIso, s?.createdAt].filter(Boolean);
        return dateCandidates.some((d) => getIstDayKey(d) === todayIstKey);
      }
      return true;
    });
  }, [betFilter, ticketsShells]);

  const quizGroups = useMemo(() => {
    const sorter = (a, b) => {
      const pa = getTicketDisplayPriority(a);
      const pb = getTicketDisplayPriority(b);
      if (pa !== pb) return pa - pb;
      const sa = new Date(a?.slotStartIso || 0).getTime();
      const sb = new Date(b?.slotStartIso || 0).getTime();
      if (pa === 1) return sa - sb;
      return sb - sa;
    };
    if (ticketsShells.length) {
      return buildGroupsFromShells(filteredTicketShells, ticketSummaryByKey, ticketLinesByKey).sort(sorter);
    }
    return groupQuizRows(filteredQuizItems, ticketSummaryByKey).sort(sorter);
  }, [ticketsShells, filteredTicketShells, ticketSummaryByKey, ticketLinesByKey, filteredQuizItems]);

  const refreshQuiz = useCallback(() => {
    loadQuiz({ pageToFetch: 1, skipSettle: false });
  }, [loadQuiz]);

  const loadNextTicketPage = useCallback(() => {
    if (loadingMoreTickets || loadingQuiz || !hasMoreTickets) return;
    void loadQuiz({ pageToFetch: ticketPage + 1, append: false, preserveScroll: true, skipSettle: true });
  }, [hasMoreTickets, loadQuiz, loadingMoreTickets, loadingQuiz, ticketPage]);

  const loadPrevTicketPage = useCallback(() => {
    if (loadingMoreTickets || loadingQuiz || ticketPage <= 1) return;
    void loadQuiz({ pageToFetch: ticketPage - 1, append: false, preserveScroll: true, skipSettle: true });
  }, [loadQuiz, loadingMoreTickets, loadingQuiz, ticketPage]);

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
        void loadQuiz({ silent: true, preserveScroll: true, skipSettle: true });
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
        void loadQuiz({ silent: true, preserveScroll: true, skipSettle: true });
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
          {loadingQuiz ? (
            <p className="text-center text-[12px] font-medium text-gray-700">wait your bet is loading</p>
          ) : null}
          {errQuiz && <p className="text-center text-red-700">{errQuiz}</p>}
          {!loadingQuiz && !errQuiz && quizGroups.length === 0 && (
            <p className="text-center text-gray-600">No quiz tickets yet or not logged in.</p>
          )}
          {!loadingQuiz &&
            !errQuiz &&
            quizGroups.map((g) => {
              const gKey = groupKey(g);
              const linePk = pairKeyTicketSlot(g.ticketId, g.slotStartIso);
              const linesOpen = Boolean(expandedBetLines[gKey]);
              const lineCount = g.betLineCount ?? g.lines?.length ?? 0;
              const resultSettled = Boolean(g.slotEnded);
              const fromSlotMap = perQuizWinningFromSlotMap(g.slotStartIso, slotWinnersBySlot, g.slotEnded);
              const quizWinLabels = fromSlotMap.length ? fromSlotMap : perQuizWinningLabels(g.lines, g.slotEnded);
              const winPayoutPending =
                resultSettled &&
                ((g.ticketStatsFromServer &&
                  g.winningLineCount > 0 &&
                  Number(g.totalWinPayoutSum || 0) <= 0) ||
                  (g.lines || []).some(
                    (line) =>
                      computeDisplayStatus(line, g) === 'win' &&
                      String(line.status || '').toLowerCase() === 'pending',
                  ));
              const stakeNum = Number(g.totalAmount || 0);
              const payoutNum = winPayoutPending ? 0 : Number(g.totalWinPayoutSum || 0);
              const netLossRs =
                resultSettled && !winPayoutPending && stakeNum > payoutNum ? stakeNum - payoutNum : 0;
              return (
                <div key={gKey} className="mb-3 rounded border border-[#bbb] bg-white p-2.5 shadow-sm">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <button
                      type="button"
                      aria-expanded={linesOpen}
                      onClick={() => handleToggleLineBets(gKey, g)}
                      className="flex shrink-0 items-center gap-1 rounded border border-[#93b4d4] bg-[#e8f1fb] px-2 py-1 text-[10px] font-bold text-[#1a4d6e] hover:bg-[#dceaf7]"
                    >
                      <span className="font-mono text-[11px]" aria-hidden>
                        {linesOpen ? '▼' : '▶'}
                      </span>
                      {linesOpen ? 'Hide' : 'Show'} line bets
                    </button>
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 font-bold text-[#1a4d6e]">
                      Ticket: {g.ticketId ? String(g.ticketId).slice(-8).toUpperCase() : 'Legacy'}
                      <span
                        className="rounded bg-[#e0f2fe] px-2 py-0.5 text-[#0c4a6e]"
                        title="Active (non-cancelled) lines on this ticket; full ticket count from server."
                      >
                        Total bets: {lineCount}
                      </span>
                      {g.cancelledLines > 0 ? (
                        <span
                          className="rounded bg-[#fef3c7] px-2 py-0.5 text-[#92400e]"
                          title="Cancelled lines are excluded from stake and bet count above."
                        >
                          {g.cancelledLines} cancelled
                        </span>
                      ) : null}
                      <span className="rounded bg-[#f2f6ff] px-2 py-0.5 text-[#374151]">
                        Draw: {g.drawLabelEnd ?? '—'}
                      </span>
                      <span className="rounded bg-[#f2f6ff] px-2 py-0.5 text-[#374151]">
                        Total stake: ₹{g.totalAmount}
                      </span>
                      <span className="rounded bg-[#eef2ff] px-2 py-0.5 text-[#374151]">
                        Date:{' '}
                        {formatIstDateLabel(g.lines?.[0]?.createdAt || g.createdAt || g.lines?.[0]?.slotStartIso || g.slotStartIso)}
                      </span>
                      {resultSettled ? (
                        <span
                          className={`rounded px-2 py-0.5 font-bold ${
                            g.winningLineCount > 0
                              ? 'bg-[#dcfce7] text-[#14532d]'
                              : 'bg-[#f3f4f6] text-[#4b5563]'
                          }`}
                          title="Gross payout from winning lines. Loss = total stake minus payout (net on this ticket)."
                        >
                          Won: {g.winningLineCount}/{lineCount} lines
                          {winPayoutPending ? (
                            <span className="font-semibold text-amber-800"> · Payout: processing…</span>
                          ) : (
                            <span> · ₹{Number(g.totalWinPayoutSum || 0).toLocaleString('en-IN')}</span>
                          )}
                        </span>
                      ) : null}
                      {resultSettled && !winPayoutPending && netLossRs > 0 ? (
                        <span
                          className="rounded bg-[#fee2e2] px-2 py-0.5 font-bold text-[#991b1b]"
                          title="Total active stake on this ticket minus gross win payout."
                        >
                          Loss: ₹{netLossRs.toLocaleString('en-IN')}
                        </span>
                      ) : null}
                      {!resultSettled ? (
                        <span className="rounded bg-[#fffbeb] px-2 py-0.5 font-semibold text-[#92400e]">
                          Result pending — win count and payout after draw
                        </span>
                      ) : null}
                      {g.isAdvanceDraw ? (
                        <span className="rounded bg-[#1d4ed8] px-2 py-0.5 text-white">Advance Draw</span>
                      ) : null}
                    </div>
                    {g.pendingCount > 0 && !g.slotEnded && String(g.ticketId || '').length > 0 ? (
                      <button
                        type="button"
                        disabled={cancellingId === `ticket:${g.ticketId}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingCancelTarget({ type: 'ticket', id: String(g.ticketId) });
                        }}
                        className="ml-auto shrink-0 rounded border border-[#c5362d] bg-[#ffe5e5] px-2 py-0.5 text-[10px] font-semibold text-[#a31] hover:bg-[#ffd5d5] disabled:opacity-60"
                      >
                        {cancellingId === `ticket:${g.ticketId}` ? '…' : 'Cancel Full Ticket'}
                      </button>
                    ) : null}
                  </div>
                  {linesOpen ? (
                    <table className="mt-2 w-full border-collapse text-[11px]">
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
                        {loadingLinesKey === linePk && (g.lines?.length ?? 0) === 0 ? (
                          <tr>
                            <td colSpan={6} className="border border-[#a0a0a0] bg-[#f8fafc] p-3 text-center font-semibold text-[#475569]">
                              Loading line bets…
                            </td>
                          </tr>
                        ) : null}
                        {g.lines.map((row) => {
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
                  ) : null}
                </div>
              );
            })}
          {!loadingQuiz && !errQuiz && quizGroups.length > 0 ? (
            <div className="mt-3 flex items-center justify-between border-t border-[#c9c9c9] pt-2">
              <span className="text-[10px] font-semibold text-gray-600">
                Showing {quizGroups.length} tickets (Page {ticketPage})
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={loadPrevTicketPage}
                  disabled={loadingMoreTickets || ticketPage <= 1}
                  className="rounded border border-[#94a3b8] bg-[#e2e8f0] px-2.5 py-1 text-[10px] font-semibold text-[#0f172a] disabled:opacity-55"
                >
                  Previous Page
                </button>
                <button
                  type="button"
                  onClick={loadNextTicketPage}
                  disabled={loadingMoreTickets || !hasMoreTickets}
                  className="rounded border border-[#2c5ea8] bg-[#2e7be6] px-2.5 py-1 text-[10px] font-semibold text-white disabled:opacity-55"
                >
                  {loadingMoreTickets ? 'Loading...' : 'Next Page'}
                </button>
              </div>
            </div>
          ) : null}
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
