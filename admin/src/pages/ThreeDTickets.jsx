import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import DateRangePresetFilter from '../components/DateRangePresetFilter';
import { clearAdminSession, fetchWithAuth } from '../lib/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';
const todayDate = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** Gross win payout vs net stake lost on ticket (after settle). */
const ticketWinLossRs = (row) => {
  const pending = Number(row?.pendingBets || 0);
  if (pending > 0) {
    return { pending: true, pendingN: pending, winRs: 0, lossRs: 0 };
  }
  const stake = Number(row?.totalStake || 0);
  const payout = Number(row?.totalWinPayout || 0);
  return {
    pending: false,
    winRs: payout,
    lossRs: Math.max(0, stake - payout),
  };
};

const ThreeDTickets = () => {
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

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const q = new URLSearchParams({ limit: '1200', dateFrom, dateTo });
      const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/tickets?${q.toString()}`);
      if (res.status === 401) return;
      const json = await res.json();
      if (!json?.success) throw new Error(json?.message || 'Failed to load tickets');
      setSlotMeta(json?.data?.slot || null);
      setSummary(json?.data?.summary || null);
      setRows(Array.isArray(json?.data?.tickets) ? json.data.tickets : []);
    } catch (err) {
      setSlotMeta(null);
      setSummary(null);
      setRows([]);
      setError(err?.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchTickets();
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
        `${API_BASE_URL}/admin/lottery3d/tickets/${encodeURIComponent(String(row.ticketId || ''))}/bets?${q.toString()}`,
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
    <AdminLayout onLogout={handleLogout} title="3D Tickets">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">3D All User Tickets</h1>
            <p className="text-sm text-gray-500">Ticket-wise list for selected IST date range (all users, 3D quiz).</p>
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
              onClick={fetchTickets}
              disabled={loading}
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
              Totals cover the whole selected IST range. The ticket list below may be truncated. Payout sums winning-line
              payouts; admin net is total stake minus payout.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 border-b border-gray-200 bg-white">
                  <th className="py-2.5 px-4 font-semibold whitespace-nowrap">Total tickets</th>
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
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-lg font-semibold text-gray-800">All User Tickets</h3>
            {loading ? <span className="text-xs text-gray-500">Loading...</span> : null}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
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
                    <td colSpan={9} className="py-4 text-center text-gray-500">
                      No tickets found for this date range.
                    </td>
                  </tr>
                ) : null}
                {rows.map((row) => {
                  const key = rowKey(row);
                  const isOpen = Boolean(expandedKeys[key]);
                  const betRows = ticketBetsByKey[key] || [];
                  const wl = ticketWinLossRs(row);
                  return (
                    <React.Fragment key={key}>
                      <tr
                        className="border-b border-gray-100 cursor-pointer hover:bg-orange-50/40"
                        onClick={() => { void toggleTicket(row); }}
                      >
                        <td className="py-2 pr-3 font-mono">
                          <span className="mr-1.5 text-xs text-gray-500">{isOpen ? '▼' : '▶'}</span>
                          {String(row.ticketId || '-').slice(-8).toUpperCase()}
                        </td>
                        <td className="py-2 pr-3 font-semibold text-gray-800">{row.username || 'unknown'}</td>
                        <td className="py-2 pr-3 text-gray-600">{row.phone || '-'}</td>
                        <td className="py-2 pr-3 text-gray-700">{row.drawLabelEnd || '-'}</td>
                        <td className="py-2 pr-3 text-right font-mono">{Number(row.totalBets || 0).toLocaleString('en-IN')}</td>
                        <td className="py-2 pr-3 text-right font-mono">Rs {Number(row.totalStake || 0).toLocaleString('en-IN')}</td>
                        <td
                          className={`py-2 pr-3 text-right font-mono ${wl.pending ? 'text-amber-700 text-xs' : 'text-emerald-700'}`}
                          title={wl.pending ? `${wl.pendingN} line(s) still pending` : 'Total win payout on this ticket'}
                        >
                          {wl.pending ? `Open (${wl.pendingN})` : `Rs ${wl.winRs.toLocaleString('en-IN')}`}
                        </td>
                        <td
                          className={`py-2 pr-3 text-right font-mono ${wl.pending ? 'text-amber-700 text-xs' : 'text-red-700'}`}
                          title={wl.pending ? 'Settles after draw' : 'Stake − win payout (net kept from player)'}
                        >
                          {wl.pending ? '—' : `Rs ${wl.lossRs.toLocaleString('en-IN')}`}
                        </td>
                        <td className="py-2 pr-3 text-xs text-gray-600">{row.placedAt ? new Date(row.placedAt).toLocaleString() : '-'}</td>
                      </tr>
                      {isOpen ? (
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <td colSpan={9} className="p-3">
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
                                      <th className="py-1.5 pr-3">Play</th>
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
                                        <td className="py-1.5 pr-3 font-mono uppercase">{bet.betMode || '-'}</td>
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
        </div>
      </div>
    </AdminLayout>
  );
};

export default ThreeDTickets;
