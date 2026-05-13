import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { clearAdminSession, fetchWithAuth } from '../lib/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';
const setLabelByQuizId = { 1: 'Set A', 2: 'Set B', 3: 'Set C' };

const todayDate = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatSlotLabel = (slot) => slot?.drawLabelEnd || slot?.slotStartIso || '-';

const getProfitRangeColorClass = (profitPercentValue) => {
  const signedPct = Number(profitPercentValue);
  if (!Number.isFinite(signedPct)) return 'text-gray-400';
  if (signedPct < 0) return 'text-red-700';
  const pct = Math.abs(signedPct);
  if (pct === 0) return 'text-slate-500';
  if (pct <= 20) return 'text-amber-700';
  if (pct <= 40) return 'text-orange-500';
  if (pct <= 60) return 'text-lime-500';
  if (pct <= 80) return 'text-green-600';
  if (pct <= 100) return 'text-sky-500';
  return 'text-blue-600';
};

const formatHousePl = (value, totalStakeValue = null) => {
  const n = Number(value);
  if (value == null || !Number.isFinite(n)) return { text: 'P/L: --', className: 'text-gray-400' };
  const totalStake = Number(totalStakeValue);
  const profitPct = Number.isFinite(totalStake) && totalStake > 0 ? (n / totalStake) * 100 : null;
  const className = Number.isFinite(profitPct) ? getProfitRangeColorClass(profitPct) : (n >= 0 ? 'text-green-700' : 'text-red-700');
  const rounded = Math.round(n);
  if (n >= 0) return { text: `P/L: +₹${rounded.toLocaleString('en-IN')}`, className };
  return { text: `P/L: -₹${Math.abs(rounded).toLocaleString('en-IN')}`, className };
};

const formatProfitPercent = (houseNetValue, totalStakeValue) => {
  const houseNet = Number(houseNetValue);
  const totalStake = Number(totalStakeValue);
  if (!Number.isFinite(houseNet) || !Number.isFinite(totalStake) || totalStake <= 0) {
    return { text: 'Profit: --', className: 'text-gray-400' };
  }
  const pct = (houseNet / totalStake) * 100;
  const rounded = Math.round(pct * 10) / 10;
  const sign = rounded >= 0 ? '+' : '';
  return { text: `Profit: ${sign}${rounded}%`, className: getProfitRangeColorClass(rounded) };
};

const ThreeDSlotHistory = () => {
  const navigate = useNavigate();
  const [date, setDate] = useState(todayDate());
  const [slots, setSlots] = useState([]);
  const [currentSlotStartIso, setCurrentSlotStartIso] = useState('');
  const [showAllHistorySlots, setShowAllHistorySlots] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const handleLogout = useCallback(() => {
    clearAdminSession();
    navigate('/');
  }, [navigate]);

  const fetchSlots = useCallback(async (targetDate = date, options = {}) => {
    const silent = Boolean(options?.silent);
    const limit = Math.min(96, Math.max(1, Number(options?.limit || 24)));
    if (!silent) setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ date: targetDate, limit: String(limit) });
      const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/slots?${params.toString()}`);
      if (res.status === 401) return;
      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || 'Failed to load slot history');
      setSlots(Array.isArray(data?.data?.slots) ? data.data.slots : []);
    } catch (err) {
      setError(err?.message || 'Failed to load slot history');
      setSlots([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [date]);

  const fetchCurrentSlot = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/current-slot`);
      if (res.status === 401) return;
      const json = await res.json();
      if (json?.success) setCurrentSlotStartIso(json?.data?.slot?.slotStartIso || '');
    } catch {
      setCurrentSlotStartIso('');
    }
  }, []);

  useEffect(() => {
    fetchSlots(date, { limit: showAllHistorySlots ? 96 : 24 });
    fetchCurrentSlot();
  }, [date, showAllHistorySlots, fetchSlots, fetchCurrentSlot]);

  const sortedSlots = useMemo(
    () => [...slots].sort((a, b) => String(b.slotStartIso || '').localeCompare(String(a.slotStartIso || ''))),
    [slots],
  );

  const visibleHistorySlots = useMemo(() => {
    if (showAllHistorySlots) return sortedSlots;
    if (!sortedSlots.length) return [];
    const declaredSlots = sortedSlots.filter((slot) => Boolean(slot?.declaration?.declared));
    const runningSlot = sortedSlots.find((slot) => Boolean(currentSlotStartIso) && slot.slotStartIso === currentSlotStartIso && !slot?.isCompleted);
    const chronologicalSlots = [...sortedSlots].sort((a, b) => String(a.slotStartIso || '').localeCompare(String(b.slotStartIso || '')));
    const runningIndex = chronologicalSlots.findIndex((slot) => Boolean(currentSlotStartIso) && slot.slotStartIso === currentSlotStartIso && !slot?.isCompleted);
    const limitedPending = [];
    if (runningIndex >= 0) {
      for (let i = runningIndex + 1; i < chronologicalSlots.length && limitedPending.length < 2; i += 1) {
        const slot = chronologicalSlots[i];
        if (slot && !slot?.declaration?.declared) limitedPending.push(slot);
      }
    }
    const combined = [...[...limitedPending].reverse(), ...(runningSlot ? [runningSlot] : []), ...declaredSlots];
    const seen = new Set();
    return combined.filter((slot) => {
      const key = String(slot?.slotStartIso || '');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [sortedSlots, showAllHistorySlots, currentSlotStartIso]);

  return (
    <AdminLayout onLogout={handleLogout} title="3D Slot History">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">3D Slot history (latest first)</h1>
            <p className="text-sm text-gray-500">Default: pending next 2 slots, then running, then declared. Use Show All for full day list.</p>
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm" />
            <button type="button" onClick={() => fetchSlots(date, { limit: showAllHistorySlots ? 96 : 24 })} className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold" disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div> : null}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">Slot history view moved from Result Control.</p>
            <button type="button" onClick={() => setShowAllHistorySlots((prev) => !prev)} className="shrink-0 px-3 py-1.5 rounded-lg border border-purple-300 text-xs font-semibold text-purple-700 hover:bg-purple-50">
              {showAllHistorySlots ? 'Show Limited' : 'Show All'}
            </button>
          </div>
          {!sortedSlots.length && !loading ? (
            <p className="mt-3 text-sm text-gray-500">No slots found for selected date.</p>
          ) : !visibleHistorySlots.length ? (
            <p className="mt-3 text-sm text-gray-500">No running slot or pending slots found.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {visibleHistorySlots.map((slot) => {
                const declared = Boolean(slot?.declaration?.declared);
                const declaredCount = (slot?.perQuiz || []).filter((q) => q?.declared).length;
                const isRunning = Boolean(currentSlotStartIso) && slot.slotStartIso === currentSlotStartIso && !slot?.isCompleted;
                return (
                  <div key={slot.slotStartIso} className="rounded-lg border border-gray-200">
                    <div className="px-3 py-2.5 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold text-gray-800">{formatSlotLabel(slot)}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">{slot.slotStartIso}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`text-[10px] px-2 py-1 rounded-full font-semibold ${declared ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{declared ? 'Declared' : 'Pending'}</span>
                        <span className="text-[10px] px-2 py-1 rounded-full bg-gray-100 text-gray-700 font-semibold">{`${declaredCount}/3 declared`}</span>
                        {isRunning ? <span className="text-[10px] px-2 py-1 rounded-full bg-orange-100 text-orange-700 font-semibold">Running Slot</span> : null}
                      </div>
                    </div>
                    <div className="p-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {[1, 2, 3].map((quizId) => {
                          const q = (slot?.perQuiz || []).find((row) => Number(row.quizId) === quizId);
                          const visibleResultLabel = (slot?.isCompleted || isRunning) ? (q?.resultLabel || '--') : '--';
                          const pl = formatHousePl(q?.houseNetIfHintWins, q?.totalBetAmount);
                          const profitPct = formatProfitPercent(q?.houseNetIfHintWins, q?.totalBetAmount);
                          const setLabel = setLabelByQuizId[quizId] || `Set ${quizId}`;
                          return (
                            <div key={`${slot.slotStartIso}-${quizId}`} className="rounded-md border border-gray-200 bg-white px-2 py-2 text-xs text-left">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-gray-500 shrink-0">{setLabel}</span>
                                <span className="font-mono font-semibold text-gray-800">{visibleResultLabel}</span>
                              </div>
                              <div className={`mt-0.5 text-[10px] font-semibold ${pl.className}`}>{pl.text}</div>
                              <div className={`mt-0.5 text-[10px] font-semibold ${profitPct.className}`}>{profitPct.text}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default ThreeDSlotHistory;
