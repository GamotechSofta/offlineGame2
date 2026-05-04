import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchWithAuth } from '../lib/auth';
import DateRangePresetFilter from './DateRangePresetFilter';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';
const ALL_DAY_VALUE = '__all_day__';
const ALL_ADVANCE_VALUE = '__all_advance__';
const ALL_PAST_VALUE = '__all_past__';
const ALL_FILTER_SLOTS_VALUE = '__all_filter_slots__';

const todayDate = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const listDateKeysBetween = (from, to) => {
  if (!from || !to || from > to) return [];
  const out = [];
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return out;
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

const isSlotMatchingSelection = (slot, selection) => {
  if (selection === ALL_DAY_VALUE) return true;
  if (selection === ALL_ADVANCE_VALUE) return slot?.status === 'upcoming';
  if (selection === ALL_PAST_VALUE) return slot?.status === 'past';
  return slot?.slotStartIso === selection;
};

const selectionTitle = (selection, count) => {
  if (selection === ALL_DAY_VALUE) return `All slots (${count})`;
  if (selection === ALL_ADVANCE_VALUE) return `All advance slots (${count})`;
  if (selection === ALL_PAST_VALUE) return `All past slots (${count})`;
  return '';
};

const filterTitle = (filterMode) => {
  if (filterMode === ALL_ADVANCE_VALUE) return 'advance';
  if (filterMode === ALL_PAST_VALUE) return 'past';
  return 'all day';
};

const outcomeClass = (outcome) => {
  if (outcome === 'win') return 'text-green-700';
  if (outcome === 'lose') return 'text-red-700';
  if (outcome === 'pending') return 'text-amber-700';
  return 'text-gray-600';
};

const SlotWiseBetsSection = ({ mode = '2d' }) => {
  const modeLabel = mode === '3d' ? '3D' : '2D';
  const [dateFrom, setDateFrom] = useState(todayDate);
  const [dateTo, setDateTo] = useState(todayDate);
  const [historySlots, setHistorySlots] = useState([]);
  const [filterMode, setFilterMode] = useState(ALL_DAY_VALUE);
  const [selectedSlotIso, setSelectedSlotIso] = useState(ALL_FILTER_SLOTS_VALUE);
  const [slotMeta, setSlotMeta] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingBets, setLoadingBets] = useState(false);
  const [error, setError] = useState('');

  const fetchRangeSlotSchedule = useCallback(async (fromDate, toDate) => {
    setLoadingSlots(true);
    setError('');
    try {
      const days = listDateKeysBetween(fromDate, toDate);
      const settled = await Promise.allSettled(days.map(async (dayKey) => {
        const params = new URLSearchParams({ date: dayKey });
        const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery${mode}/day-slot-schedule?${params.toString()}`);
        if (res.status === 401) return [];
        const json = await res.json();
        if (!json?.success) return [];
        return Array.isArray(json?.data?.slots) ? json.data.slots : [];
      }));
      const merged = settled.flatMap((entry) => (entry.status === 'fulfilled' ? entry.value : []));
      const unique = new Map();
      merged.forEach((slot) => {
        const key = String(slot?.slotStartIso || '');
        if (key) unique.set(key, slot);
      });
      const slots = Array.from(unique.values()).sort(
        (a, b) => new Date(b.slotStartIso || 0).getTime() - new Date(a.slotStartIso || 0).getTime(),
      );
      setHistorySlots(slots);
      setSelectedSlotIso((prev) => (slots.some((s) => s.slotStartIso === prev) ? prev : ALL_FILTER_SLOTS_VALUE));
      return slots;
    } catch (err) {
      setHistorySlots([]);
      setSelectedSlotIso(ALL_FILTER_SLOTS_VALUE);
      setError(err?.message || 'Failed to load slots');
      return [];
    } finally {
      setLoadingSlots(false);
    }
  }, [mode]);

  const fetchBetsForSelection = useCallback(async (selection, slotsForDate = historySlots) => {
    const isSpecialSelection = selection === ALL_DAY_VALUE || selection === ALL_ADVANCE_VALUE || selection === ALL_PAST_VALUE;
    if (!isSpecialSelection && !selection) {
      setSlotMeta(null);
      setPlayers([]);
      return;
    }
    setLoadingBets(true);
    setError('');
    try {
      if (mode === '3d') {
        const params = new URLSearchParams({
          dateFrom,
          dateTo,
          filterMode:
            selection === ALL_ADVANCE_VALUE
              ? 'advance'
              : selection === ALL_PAST_VALUE
                ? 'past'
                : 'all_day',
        });
        if (![ALL_DAY_VALUE, ALL_ADVANCE_VALUE, ALL_PAST_VALUE].includes(selection)) {
          params.set('slotStartIso', selection);
        }
        const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/slot-wise-bets?${params.toString()}`);
        if (res.status === 401) return;
        const json = await res.json();
        if (!json?.success) throw new Error(json?.message || 'Failed to load slot wise bets');
        setSlotMeta(json?.data?.slot || null);
        setPlayers(Array.isArray(json?.data?.players) ? json.data.players : []);
        return;
      }

      if (isSpecialSelection) {
        const targetSlots = slotsForDate.filter((slot) => isSlotMatchingSelection(slot, selection));
        if (!targetSlots.length) {
          setSlotMeta(null);
          setPlayers([]);
          return;
        }
        const responses = await Promise.all(
          targetSlots.map((slot) =>
            fetchWithAuth(`${API_BASE_URL}/admin/lottery${mode}/slots/${encodeURIComponent(slot.slotStartIso)}/players?includeBets=1`),
          ),
        );
        if (responses.some((res) => res.status === 401)) return;
        const payloads = await Promise.all(responses.map((res) => res.json()));
        const firstError = payloads.find((payload) => !payload?.success);
        if (firstError) throw new Error(firstError?.message || 'Failed to load filtered bets');
        const mergedPlayers = payloads.flatMap((payload) =>
          Array.isArray(payload?.data?.players) ? payload.data.players : [],
        );
        setSlotMeta({
          drawLabelEnd: selectionTitle(selection, targetSlots.length),
          slotStartIso: dateFrom === dateTo ? dateFrom : `${dateFrom} to ${dateTo}`,
        });
        setPlayers(mergedPlayers);
        return;
      }

      const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery${mode}/slots/${encodeURIComponent(selection)}/players?includeBets=1`);
      if (res.status === 401) return;
      const json = await res.json();
      if (!json?.success) throw new Error(json?.message || 'Failed to load bets for selected slot');
      setSlotMeta(json?.data?.slot || null);
      setPlayers(Array.isArray(json?.data?.players) ? json.data.players : []);
    } catch (err) {
      setSlotMeta(null);
      setPlayers([]);
      setError(err?.message || 'Failed to load bets for selected filter');
    } finally {
      setLoadingBets(false);
    }
  }, [mode, dateFrom, dateTo, historySlots]);

  useEffect(() => {
    fetchRangeSlotSchedule(dateFrom, dateTo);
  }, [dateFrom, dateTo, fetchRangeSlotSchedule]);

  const filteredSlots = useMemo(
    () => historySlots.filter((slot) => isSlotMatchingSelection(slot, filterMode)),
    [historySlots, filterMode],
  );

  const effectiveSelection = selectedSlotIso && selectedSlotIso !== ALL_FILTER_SLOTS_VALUE ? selectedSlotIso : filterMode;

  useEffect(() => {
    fetchBetsForSelection(effectiveSelection, historySlots);
  }, [effectiveSelection, historySlots, fetchBetsForSelection]);

  const flattenedBets = useMemo(() => flattenBets(players), [players]);
  const stats = useMemo(() => {
    return flattenedBets.reduce((acc, bet) => {
      const amount = Number(bet.amount || 0);
      const payout = Number(bet.payout || 0);
      const outcome = String(bet.outcome || '').toLowerCase();
      const isCancelled = outcome === 'cancelled';
      if (!isCancelled) {
        acc.totalBets += 1;
        acc.totalStake += amount;
      }
      acc.totalPayout += payout;
      return acc;
    }, { totalBets: 0, totalStake: 0, totalPayout: 0 });
  }, [flattenedBets]);

  const refresh = useCallback(async () => {
    const latestSlots = await fetchRangeSlotSchedule(dateFrom, dateTo);
    await fetchBetsForSelection(effectiveSelection, Array.isArray(latestSlots) ? latestSlots : historySlots);
  }, [fetchRangeSlotSchedule, dateFrom, dateTo, effectiveSelection, fetchBetsForSelection, historySlots]);

  const clearFilters = useCallback(() => {
    setFilterMode(ALL_DAY_VALUE);
    setSelectedSlotIso(ALL_FILTER_SLOTS_VALUE);
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{modeLabel} Slot Wise Bets</h2>
          <p className="text-sm text-gray-500">View all bets placed for selected draw slots.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={clearFilters}
            className="px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold disabled:opacity-70"
            disabled={loadingSlots || loadingBets}
          >
            Clear Filter
          </button>
          <button
            type="button"
            onClick={refresh}
            className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold disabled:opacity-70"
            disabled={loadingSlots || loadingBets}
          >
            {loadingSlots || loadingBets ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <DateRangePresetFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          setDateFrom={setDateFrom}
          setDateTo={setDateTo}
        />
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm min-w-[220px]">
            <span className="text-gray-600 font-medium">Filter</span>
            <select
              value={filterMode}
              onChange={(e) => {
                setFilterMode(e.target.value);
                setSelectedSlotIso(ALL_FILTER_SLOTS_VALUE);
              }}
              disabled={loadingSlots}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
            >
              <option value={ALL_DAY_VALUE}>All day bets</option>
              <option value={ALL_ADVANCE_VALUE}>All advance bets</option>
              <option value={ALL_PAST_VALUE}>All past bets</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm min-w-[240px] flex-1">
            <span className="text-gray-600 font-medium">Draw (slot end time)</span>
            <select
              value={selectedSlotIso}
              onChange={(e) => setSelectedSlotIso(e.target.value)}
              disabled={loadingSlots}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-full max-w-md"
            >
              <option value={ALL_FILTER_SLOTS_VALUE}>
                {`All ${filterTitle(filterMode)} slots`}
              </option>
              {!filteredSlots.length ? <option value="">No slots found</option> : null}
              {filteredSlots.map((slot) => (
                <option key={slot.slotStartIso} value={slot.slotStartIso}>
                  {slotScheduleLabel(slot)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {slotMeta ? (
          <p className="text-xs text-gray-600 break-all">
            {effectiveSelection === ALL_DAY_VALUE || effectiveSelection === ALL_ADVANCE_VALUE || effectiveSelection === ALL_PAST_VALUE
              ? 'Selected Date'
              : 'Slot Start'}:{' '}
            <span className="font-semibold">{slotMeta.slotStartIso}</span> | Draw Time:{' '}
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
          <h3 className="text-lg font-semibold text-gray-800">All Bets In Selected Filter</h3>
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
                    No bets found for this filter.
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
  );
};

export default SlotWiseBetsSection;
