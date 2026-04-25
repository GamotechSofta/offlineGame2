import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { clearAdminSession, fetchWithAuth } from '../lib/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const todayDate = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const slotScheduleLabel = (slot) => {
  const tag = slot.status === 'live' ? 'Live' : slot.status === 'upcoming' ? 'Advance' : 'Past';
  return `${slot.drawLabelEnd || slot.slotStartIso} (${tag})`;
};

const flattenBets = (players = []) => {
  const rows = [];
  players.forEach((player) => {
    const bets = Array.isArray(player?.bets) ? player.bets : [];
    bets.forEach((bet) => {
      rows.push({
        ...bet,
        userId: player.userId,
        username: player.username || 'unknown',
        phone: player.phone || '',
      });
    });
  });
  return rows.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
};

const outcomeClass = (outcome) => {
  if (outcome === 'win') return 'text-green-700';
  if (outcome === 'lose') return 'text-red-700';
  if (outcome === 'pending') return 'text-amber-700';
  return 'text-gray-600';
};

const SlotWiseBetsPage = ({ mode = '2d' }) => {
  const navigate = useNavigate();
  const modeLabel = mode === '3d' ? '3D' : '2D';
  const [historyDate, setHistoryDate] = useState(todayDate);
  const [historySlots, setHistorySlots] = useState([]);
  const [selectedSlotIso, setSelectedSlotIso] = useState('');
  const [slotMeta, setSlotMeta] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingBets, setLoadingBets] = useState(false);
  const [error, setError] = useState('');

  const handleLogout = useCallback(() => {
    clearAdminSession();
    navigate('/');
  }, [navigate]);

  const fetchDaySlotSchedule = useCallback(async (targetDate) => {
    setLoadingSlots(true);
    setError('');
    try {
      const params = new URLSearchParams({ date: targetDate });
      const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery${mode}/day-slot-schedule?${params.toString()}`);
      if (res.status === 401) return '';
      const json = await res.json();
      if (!json?.success) throw new Error(json?.message || 'Failed to load slot schedule');
      const slots = Array.isArray(json?.data?.slots) ? json.data.slots : [];
      setHistorySlots(slots);
      if (!slots.length) {
        setSelectedSlotIso('');
        return '';
      }
      const live = slots.find((s) => s.status === 'live');
      const chosen = live?.slotStartIso || slots[0]?.slotStartIso || '';
      setSelectedSlotIso((prev) => (prev && slots.some((s) => s.slotStartIso === prev) ? prev : chosen));
      return chosen;
    } catch (err) {
      setHistorySlots([]);
      setSelectedSlotIso('');
      setError(err?.message || 'Failed to load slots');
      return '';
    } finally {
      setLoadingSlots(false);
    }
  }, [mode]);

  const fetchBetsForSlot = useCallback(async (slotStartIso) => {
    if (!slotStartIso) {
      setSlotMeta(null);
      setPlayers([]);
      return;
    }
    setLoadingBets(true);
    setError('');
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery${mode}/slots/${encodeURIComponent(slotStartIso)}/players`);
      if (res.status === 401) return;
      const json = await res.json();
      if (!json?.success) throw new Error(json?.message || 'Failed to load bets for selected slot');
      setSlotMeta(json?.data?.slot || null);
      setPlayers(Array.isArray(json?.data?.players) ? json.data.players : []);
    } catch (err) {
      setSlotMeta(null);
      setPlayers([]);
      setError(err?.message || 'Failed to load bets for selected slot');
    } finally {
      setLoadingBets(false);
    }
  }, [mode]);

  useEffect(() => {
    fetchDaySlotSchedule(historyDate);
  }, [historyDate, fetchDaySlotSchedule]);

  useEffect(() => {
    fetchBetsForSlot(selectedSlotIso);
  }, [selectedSlotIso, fetchBetsForSlot]);

  const flattenedBets = useMemo(() => flattenBets(players), [players]);
  const stats = useMemo(() => {
    return flattenedBets.reduce((acc, bet) => {
      const amount = Number(bet.amount || 0);
      const payout = Number(bet.payout || 0);
      acc.totalBets += 1;
      acc.totalStake += amount;
      acc.totalPayout += payout;
      return acc;
    }, { totalBets: 0, totalStake: 0, totalPayout: 0 });
  }, [flattenedBets]);

  const refresh = useCallback(async () => {
    await fetchDaySlotSchedule(historyDate);
    if (selectedSlotIso) await fetchBetsForSlot(selectedSlotIso);
  }, [fetchDaySlotSchedule, historyDate, selectedSlotIso, fetchBetsForSlot]);

  return (
    <AdminLayout onLogout={handleLogout} title={`${modeLabel} Slot Wise Bets`}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{modeLabel} Slot Wise Bets</h1>
            <p className="text-sm text-gray-500">
              View all bets placed for a selected draw time slot.
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold disabled:opacity-70"
            disabled={loadingSlots || loadingBets}
          >
            {loadingSlots || loadingBets ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 font-medium">Date (IST day)</span>
              <input
                type="date"
                value={historyDate}
                max={todayDate()}
                onChange={(e) => setHistoryDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm min-w-[240px] flex-1">
              <span className="text-gray-600 font-medium">Draw (slot end time)</span>
              <select
                value={selectedSlotIso}
                onChange={(e) => setSelectedSlotIso(e.target.value)}
                disabled={loadingSlots || !historySlots.length}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-full max-w-md"
              >
                {!historySlots.length && !loadingSlots ? (
                  <option value="">No slots found for this date</option>
                ) : null}
                {historySlots.map((slot) => (
                  <option key={slot.slotStartIso} value={slot.slotStartIso}>
                    {slotScheduleLabel(slot)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {slotMeta ? (
            <p className="text-xs text-gray-600 break-all">
              Slot Start: <span className="font-semibold">{slotMeta.slotStartIso}</span> | Draw Time:{' '}
              <span className="font-semibold">{slotMeta.drawLabelEnd || '-'}</span>
            </p>
          ) : null}
        </div>

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div> : null}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500">Total Bets</p>
            <p className="text-lg font-bold text-gray-800">{stats.totalBets}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500">Total Stake</p>
            <p className="text-lg font-bold text-gray-800">Rs {stats.totalStake.toLocaleString('en-IN')}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500">Total Payout</p>
            <p className="text-lg font-bold text-gray-800">Rs {stats.totalPayout.toLocaleString('en-IN')}</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-lg font-semibold text-gray-800">All Bets In Selected Slot</h3>
            {loadingBets ? <span className="text-xs text-gray-500">Loading...</span> : null}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-3">Player</th>
                  <th className="py-2 pr-3">Set</th>
                  <th className="py-2 pr-3">Number</th>
                  <th className="py-2 pr-3 text-right">Stake</th>
                  <th className="py-2 pr-3">Result</th>
                  <th className="py-2 pr-3 text-right">Payout</th>
                  <th className="py-2 pr-3 text-right">Net</th>
                  <th className="py-2 pr-3">Placed At</th>
                </tr>
              </thead>
              <tbody>
                {!flattenedBets.length && !loadingBets ? (
                  <tr>
                    <td colSpan={8} className="py-4 text-center text-gray-500">
                      No bets found for this slot.
                    </td>
                  </tr>
                ) : null}
                {flattenedBets.map((bet) => (
                  <tr key={bet.betId} className="border-b border-gray-100">
                    <td className="py-2 pr-3">
                      <div className="font-semibold text-gray-800">{bet.username}</div>
                      {bet.phone ? <div className="text-xs text-gray-500">{bet.phone}</div> : null}
                    </td>
                    <td className="py-2 pr-3">{bet.setLabel || '-'}</td>
                    <td className="py-2 pr-3 font-mono">{bet.number}</td>
                    <td className="py-2 pr-3 text-right font-mono">Rs {Number(bet.amount || 0).toLocaleString('en-IN')}</td>
                    <td className={`py-2 pr-3 font-semibold ${outcomeClass(bet.outcome)}`}>
                      {String(bet.outcome || '').toUpperCase()}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono">Rs {Number(bet.payout || 0).toLocaleString('en-IN')}</td>
                    <td className={`py-2 pr-3 text-right font-mono ${Number(bet.netProfitLoss || 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      Rs {Number(bet.netProfitLoss || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2 pr-3 text-xs text-gray-600">
                      {bet.createdAt ? new Date(bet.createdAt).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default SlotWiseBetsPage;
