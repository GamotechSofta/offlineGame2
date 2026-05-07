import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import DateRangePresetFilter from '../components/DateRangePresetFilter';
import { clearAdminSession, fetchWithAuth } from '../lib/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';
const PAGE_SIZE = 25;
const todayDate = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** Gross win payout vs net stake lost on ticket (after settle). */
const ticketWinLossRs = (row) => {
  if (row?.fullyCancelled) {
    return { fullyCancelled: true, pending: false, winRs: 0, lossRs: 0 };
  }
  const pending = Number(row?.pendingBets || 0);
  if (pending > 0) {
    return { fullyCancelled: false, pending: true, pendingN: pending, winRs: 0, lossRs: 0 };
  }
  const stake = Number(row?.totalStake || 0);
  const payout = Number(row?.totalWinPayout || 0);
  return {
    fullyCancelled: false,
    pending: false,
    winRs: payout,
    lossRs: Math.max(0, stake - payout),
  };
};

/** Single search box: matches ticket id (full or last chars), username, or phone. */
const rowMatchesTicketSearch = (row, raw) => {
  const q = String(raw || '').trim();
  if (!q) return true;
  const ql = q.toLowerCase();
  const tid = String(row.ticketId || '').toLowerCase();
  const user = String(row.username || '').toLowerCase();
  const phone = String(row.phone || '');
  const phoneDigits = phone.replace(/\D/g, '');
  const qDigits = q.replace(/\D/g, '');
  if (tid.includes(ql)) return true;
  if (user.includes(ql)) return true;
  if (phone.toLowerCase().includes(ql)) return true;
  if (qDigits.length >= 2 && phoneDigits.includes(qDigits)) return true;
  return false;
};

const TwoDTickets = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [slotMeta, setSlotMeta] = useState(null);
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const t = todayDate();
  const [dateFrom, setDateFrom] = useState(t);
  const [dateTo, setDateTo] = useState(t);
  const [expandedKeys, setExpandedKeys] = useState({});
  const [ticketBetsByKey, setTicketBetsByKey] = useState({});
  const [loadingTicketKey, setLoadingTicketKey] = useState('');
  const [ticketErrorByKey, setTicketErrorByKey] = useState({});
  const [ticketSearch, setTicketSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const filteredRows = useMemo(() => {
    if (!ticketSearch.trim()) return rows;
    return rows.filter((r) => rowMatchesTicketSearch(r, ticketSearch));
  }, [rows, ticketSearch]);

  const fetchTickets = useCallback(async ({ pageToFetch = 1, append = false } = {}) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError('');
    try {
      const q = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(pageToFetch), dateFrom, dateTo });
      const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery2d/tickets?${q.toString()}`);
      if (res.status === 401) return;
      const json = await res.json();
      if (!json?.success) throw new Error(json?.message || 'Failed to load tickets');
      setSlotMeta(json?.data?.slot || null);
      setSummary(json?.data?.summary || null);
      const nextRows = Array.isArray(json?.data?.tickets) ? json.data.tickets : [];
      const nextHasMore = Boolean(json?.data?.pagination?.hasMore);
      setHasMore(nextHasMore);
      setPage(pageToFetch);
      setRows((prev) => (append ? [...prev, ...nextRows] : nextRows));
      if (!append) {
        setExpandedKeys({});
        setTicketBetsByKey({});
        setTicketErrorByKey({});
      }
    } catch (err) {
      setSlotMeta(null);
      setSummary(null);
      setRows([]);
      setHasMore(false);
      setError(err?.message || 'Failed to load tickets');
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchTickets({ pageToFetch: 1, append: false });
  }, [fetchTickets]);

  const rowKey = (row) => `${row.ticketId}|${row.slotStartIso}|${row.userId}`;

  const toggleTicket = useCallback(async (row) => {
    const key = rowKey(row);
    const alreadyOpen = Boolean(expandedKeys[key]);
    setExpandedKeys((prev) => ({ ...prev, [key]: !alreadyOpen }));
    if (alreadyOpen || ticketBetsByKey[key]) return;
    setLoadingTicketKey(key);
    setTicketErrorByKey((prev) => ({ ...prev, [key]: '' }));
    try {
      const q = new URLSearchParams({
        slotStartIso: String(row.slotStartIso || ''),
        userId: String(row.userId || ''),
      });
      const res = await fetchWithAuth(
        `${API_BASE_URL}/admin/lottery2d/tickets/${encodeURIComponent(String(row.ticketId || ''))}/bets?${q.toString()}`,
      );
      if (res.status === 401) return;
      const json = await res.json();
      if (!json?.success) throw new Error(json?.message || 'Failed to load ticket bets');
      setTicketBetsByKey((prev) => ({ ...prev, [key]: Array.isArray(json?.data) ? json.data : [] }));
    } catch (err) {
      setTicketErrorByKey((prev) => ({ ...prev, [key]: err?.message || 'Failed to load ticket bets' }));
    } finally {
      setLoadingTicketKey('');
    }
  }, [expandedKeys, ticketBetsByKey]);

  const handleLogout = useCallback(() => {
    clearAdminSession();
    navigate('/');
  }, [navigate]);

  return (
    <AdminLayout onLogout={handleLogout} title="2D Tickets">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">2D All User Tickets</h1>
            <p className="text-sm text-gray-500">Ticket-wise list for selected IST date range (all users).</p>
          </div>
          <div className="w-full">
            <DateRangePresetFilter
              dateFrom={dateFrom}
              dateTo={dateTo}
              setDateFrom={setDateFrom}
              setDateTo={setDateTo}
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => fetchTickets({ pageToFetch: 1, append: false })}
              disabled={loading || loadingMore}
              className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold disabled:opacity-70"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {slotMeta ? (
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
            <span className="font-semibold">Filter (IST):</span>{' '}
            {slotMeta.isDateRange ? (
              <>
                {slotMeta.dateFrom} <span className="text-gray-500">to</span> {slotMeta.dateTo}
              </>
            ) : (
              <>{slotMeta.dateFrom}</>
            )}
          </div>
        ) : null}

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div> : null}

        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-800">Summary</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Totals cover the whole selected IST range. The ticket list below may be truncated. Cancelled bet lines are
              excluded from stake, payout, and admin net (stakes were refunded to players). Fully cancelled tickets stay
              in the list and are labeled Cancelled.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 border-b border-gray-200 bg-white">
                  <th className="py-2.5 px-4 font-semibold whitespace-nowrap">Total tickets</th>
                  <th
                    className="py-2.5 px-4 font-semibold whitespace-nowrap"
                    title="Tickets with at least one non-cancelled line (still in play or settled)."
                  >
                    Active tickets
                  </th>
                  <th
                    className="py-2.5 px-4 font-semibold whitespace-nowrap"
                    title="Tickets where every line was cancelled before the draw (refunded)."
                  >
                    Cancelled tickets
                  </th>
                  <th className="py-2.5 px-4 font-semibold whitespace-nowrap">Total bets</th>
                  <th className="py-2.5 px-4 font-semibold whitespace-nowrap text-right">Total stake</th>
                  <th className="py-2.5 px-4 font-semibold whitespace-nowrap text-right">Total payout</th>
                  <th className="py-2.5 px-4 font-semibold whitespace-nowrap text-right">Admin net</th>
                  <th className="py-2.5 px-4 font-semibold whitespace-nowrap text-right">Unique users</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-3 px-4 font-mono font-semibold text-gray-900">
                    {loading ? '—' : Number(summary?.totalTickets ?? 0).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-emerald-900 tabular-nums">
                    {loading
                      ? '—'
                      : Number(
                          summary?.totalActiveTickets ??
                            Math.max(0, Number(summary?.totalTickets ?? 0) - Number(summary?.totalCancelledTickets ?? 0)),
                        ).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-red-800 tabular-nums">
                    {loading ? '—' : Number(summary?.totalCancelledTickets ?? 0).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-gray-900">
                    {loading ? '—' : Number(summary?.totalBets ?? 0).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-gray-900 text-right">
                    {loading ? '—' : `Rs ${Number(summary?.totalStake ?? 0).toLocaleString('en-IN')}`}
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-gray-900 text-right">
                    {loading ? '—' : `Rs ${Number(summary?.totalPayout ?? 0).toLocaleString('en-IN')}`}
                  </td>
                  <td
                    className={`py-3 px-4 font-mono font-semibold text-right ${
                      !loading && Number(summary?.adminProfit ?? 0) < 0 ? 'text-red-700' : 'text-emerald-800'
                    }`}
                  >
                    {loading ? '—' : `Rs ${Number(summary?.adminProfit ?? 0).toLocaleString('en-IN')}`}
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-gray-900 text-right">
                    {loading ? '—' : Number(summary?.uniqueUsers ?? 0).toLocaleString('en-IN')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h3 className="text-lg font-semibold text-gray-800">All User Tickets</h3>
              {loading ? <span className="text-xs text-gray-500">Loading...</span> : null}
              {!loading && rows.length > 0 && ticketSearch.trim() ? (
                <span className="text-xs text-gray-500">
                  Showing {filteredRows.length} of {rows.length}
                </span>
              ) : null}
            </div>
            <label className="flex flex-col gap-1 text-sm w-full sm:w-72 shrink-0">
              <span className="text-gray-600 font-medium">Search</span>
              <input
                type="search"
                value={ticketSearch}
                onChange={(e) => setTicketSearch(e.target.value)}
                placeholder="Ticket ID, user name, phone…"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Ticket ID</th>
                  <th className="py-2 pr-3">User</th>
                  <th className="py-2 pr-3">Phone</th>
                  <th className="py-2 pr-3">Draw</th>
                  <th className="py-2 pr-3 text-right">Total Bets</th>
                  <th className="py-2 pr-3 text-right">Total Stake</th>
                  <th className="py-2 pr-3 text-right" title="Gross payout credited on winning lines">
                    Win (Rs)
                  </th>
                  <th className="py-2 pr-3 text-right" title="Stake not returned (total stake − win payout)">
                    Loss (Rs)
                  </th>
                  <th className="py-2 pr-3">Placed At</th>
                </tr>
              </thead>
              <tbody>
                {!rows.length && !loading ? (
                  <tr>
                    <td colSpan={10} className="py-4 text-center text-gray-500">
                      No tickets found for this date range.
                    </td>
                  </tr>
                ) : null}
                {rows.length > 0 && !loading && !filteredRows.length ? (
                  <tr>
                    <td colSpan={10} className="py-4 text-center text-gray-500">
                      No tickets match your search. Try another Ticket ID, user name, or phone.
                    </td>
                  </tr>
                ) : null}
                {filteredRows.map((row, index) => {
                  const key = rowKey(row);
                  const isOpen = Boolean(expandedKeys[key]);
                  const betRows = ticketBetsByKey[key] || [];
                  const wl = ticketWinLossRs(row);
                  const gross = Number(row.grossStake ?? row.totalStake ?? 0);
                  const serial = (page - 1) * PAGE_SIZE + index + 1;
                  return (
                    <React.Fragment key={key}>
                      <tr
                        className={`border-b border-gray-100 cursor-pointer hover:bg-orange-50/40 ${row.fullyCancelled ? 'bg-slate-50/80' : ''}`}
                        onClick={() => { void toggleTicket(row); }}
                      >
                        <td className="py-2 pr-3 font-mono text-gray-600">{serial}</td>
                        <td className="py-2 pr-3 font-mono">
                          <span className="mr-1.5 text-xs text-gray-500">{isOpen ? '▼' : '▶'}</span>
                          {String(row.ticketId || '-').slice(-8).toUpperCase()}
                          {row.fullyCancelled ? (
                            <span className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-red-100 text-red-800 border border-red-200">
                              Cancelled
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3 font-semibold text-gray-800">{row.username || 'unknown'}</td>
                        <td className="py-2 pr-3 text-gray-600">{row.phone || '-'}</td>
                        <td className="py-2 pr-3 text-gray-700">{row.drawLabelEnd || '-'}</td>
                        <td className="py-2 pr-3 text-right font-mono">{Number(row.totalBets || 0).toLocaleString('en-IN')}</td>
                        <td
                          className={`py-2 pr-3 text-right font-mono ${row.fullyCancelled ? 'text-slate-500' : ''}`}
                          title={row.fullyCancelled ? 'Original stake; refunded to player' : undefined}
                        >
                          {row.fullyCancelled
                            ? `Rs ${gross.toLocaleString('en-IN')} · refunded`
                            : `Rs ${Number(row.totalStake || 0).toLocaleString('en-IN')}`}
                        </td>
                        <td
                          className={`py-2 pr-3 text-right font-mono ${
                            wl.fullyCancelled ? 'text-slate-500 text-xs' : wl.pending ? 'text-amber-700 text-xs' : 'text-emerald-700'
                          }`}
                          title={
                            wl.fullyCancelled
                              ? 'Ticket fully cancelled before draw'
                              : wl.pending
                                ? `${wl.pendingN} line(s) still pending`
                                : 'Total win payout on this ticket'
                          }
                        >
                          {wl.fullyCancelled ? '—' : wl.pending ? `Open (${wl.pendingN})` : `Rs ${wl.winRs.toLocaleString('en-IN')}`}
                        </td>
                        <td
                          className={`py-2 pr-3 text-right font-mono ${
                            wl.fullyCancelled ? 'text-slate-500 text-xs' : wl.pending ? 'text-amber-700 text-xs' : 'text-red-700'
                          }`}
                          title={
                            wl.fullyCancelled
                              ? 'No loss — stake refunded'
                              : wl.pending
                                ? 'Settles after draw'
                                : 'Stake − win payout (net kept from player)'
                          }
                        >
                          {wl.fullyCancelled || wl.pending ? '—' : `Rs ${wl.lossRs.toLocaleString('en-IN')}`}
                        </td>
                        <td className="py-2 pr-3 text-xs text-gray-600">{row.placedAt ? new Date(row.placedAt).toLocaleString() : '-'}</td>
                      </tr>
                      {isOpen ? (
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <td colSpan={10} className="p-3">
                            {loadingTicketKey === key ? (
                              <p className="text-xs text-gray-500">Loading ticket bets...</p>
                            ) : ticketErrorByKey[key] ? (
                              <p className="text-xs text-red-600">{ticketErrorByKey[key]}</p>
                            ) : !betRows.length ? (
                              <p className="text-xs text-gray-500">No bets found for this ticket.</p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="min-w-full text-xs">
                                  <thead>
                                    <tr className="text-left text-gray-500 border-b border-gray-200">
                                      <th className="py-1.5 pr-3">Set</th>
                                      <th className="py-1.5 pr-3">Number</th>
                                      <th className="py-1.5 pr-3 text-right">Amount</th>
                                      <th className="py-1.5 pr-3">Status</th>
                                      <th className="py-1.5 pr-3 text-right">Payout</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {betRows.map((bet) => (
                                      <tr key={bet.betId} className="border-b border-gray-100">
                                        <td className="py-1.5 pr-3">{bet.setLabel || '-'}</td>
                                        <td className="py-1.5 pr-3 font-mono">{bet.number}</td>
                                        <td className="py-1.5 pr-3 text-right font-mono">Rs {Number(bet.amount || 0).toLocaleString('en-IN')}</td>
                                        <td className="py-1.5 pr-3 uppercase">{bet.status || '-'}</td>
                                        <td className="py-1.5 pr-3 text-right font-mono">Rs {Number(bet.winPayout || 0).toLocaleString('en-IN')}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-500">
              Loaded {rows.length} ticket{rows.length === 1 ? '' : 's'} (Page {page})
            </p>
            <button
              type="button"
              onClick={() => fetchTickets({ pageToFetch: page + 1, append: true })}
              disabled={loading || loadingMore || !hasMore}
              className="px-3 py-1.5 rounded-lg bg-[#1B3150] text-white text-xs font-semibold hover:bg-[#152842] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loadingMore ? 'Loading...' : 'Next Page'}
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default TwoDTickets;
