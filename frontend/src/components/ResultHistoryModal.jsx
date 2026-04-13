import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getQuizSlotResultsForDate } from '../api/quizApi';
import { QUIZ_GROUPS } from '../data/mockData';
import { pad2 } from '../utils/boardHelpers';

const istTodayKey = () => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return '';
  }
};

const setCellClass = (setName) => {
  if (setName === 'Set A') return 'bg-[#f4a7c8] border-[#bf6f95]';
  if (setName === 'Set B') return 'bg-[#a9c9ff] border-[#6e94d1]';
  return 'bg-[#b8e6b8] border-[#77b077]';
};

const cellLabel = (quizId, result) => {
  const q = pad2(quizId);
  if (result == null || !Number.isInteger(result)) return `Q${q}--`;
  return `Q${q}-${pad2(result)}`;
};

/**
 * Past slot results from persisted QuizSlotPick (hintPosition only).
 * @param {{ open: boolean, onClose: () => void, defaultIstDay?: string }} props
 */
const ResultHistoryModal = ({ open, onClose, defaultIstDay }) => {
  const maxDay = useMemo(() => istTodayKey(), [open]);
  const [y, setY] = useState('');
  const [m, setM] = useState('');
  const [d, setD] = useState('');
  const [slots, setSlots] = useState([]);
  const [fetchedDate, setFetchedDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const base = defaultIstDay && /^\d{4}-\d{2}-\d{2}$/.test(defaultIstDay) ? defaultIstDay : maxDay;
    if (base) {
      const [yy, mm, dd] = base.split('-');
      setY(yy || '');
      setM(mm || '');
      setD(dd || '');
    }
    setSlots([]);
    setFetchedDate('');
    setError('');
  }, [open, defaultIstDay, maxDay]);

  const dateKey = useMemo(() => {
    const yy = String(y || '').replace(/\D/g, '').slice(0, 4);
    const mm = String(m || '').replace(/\D/g, '').slice(0, 2);
    const dd = String(d || '').replace(/\D/g, '').slice(0, 2);
    if (yy.length !== 4 || mm.length !== 2 || dd.length !== 2) return '';
    return `${yy}-${mm}-${dd}`;
  }, [y, m, d]);

  const displayDateLabel = useMemo(() => {
    if (!fetchedDate) return '';
    const [yy, mm, dd] = fetchedDate.split('-');
    return `${dd}-${mm}-${yy}`;
  }, [fetchedDate]);

  const showResult = useCallback(async () => {
    if (!dateKey) {
      setError('Enter complete date (DD MM YYYY).');
      return;
    }
    if (maxDay && dateKey > maxDay) {
      setError('Future date is not allowed.');
      return;
    }
    setLoading(true);
    setError('');
    setSlots([]);
    try {
      const j = await getQuizSlotResultsForDate(dateKey);
      if (!j.success || !j.data) {
        setError(j.message || 'Invalid response');
        return;
      }
      setFetchedDate(j.data.date || dateKey);
      setSlots(Array.isArray(j.data.slots) ? j.data.slots : []);
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [dateKey, maxDay]);

  useEffect(() => {
    if (!open || !dateKey) return;
    showResult();
  }, [open, dateKey, showResult]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-2 sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-[1100px] flex-col overflow-hidden border-2 border-[#333] bg-[#e8e8e8] text-black shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b-2 border-[#c5362d] bg-[#e95757] px-3 py-2 text-white">
          <div>
            <h2 className="text-lg font-bold">Result</h2>
            {displayDateLabel ? <p className="text-xs font-semibold opacity-95">{displayDateLabel}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border-2 border-[#c5362d] bg-[#ef3f34] px-3 py-1 text-sm font-bold text-white"
          >
            Close
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="min-h-0 flex-1 overflow-y-auto border-b border-[#666] md:border-b-0 md:border-r">
            {loading && <p className="p-4 text-center text-sm">Loading...</p>}
            {error && <p className="p-4 text-center text-sm text-red-700">{error}</p>}
            {!loading && !error && !slots.length && (
              <p className="p-4 text-center text-sm text-[#555]">Select a date to view result.</p>
            )}
            {!loading && slots.length > 0 && (
              <div className="flex flex-col gap-3 p-2">
                {slots.map((slot) => (
                  <div key={slot.slotStartIso} className="flex gap-0 border border-black bg-[#f5f5f5]">
                    <div className="flex w-[72px] shrink-0 flex-col items-center justify-center border-r border-black bg-black px-1 py-3 text-center text-sm font-bold leading-tight text-white sm:w-[88px] sm:text-base">
                      {slot.timeLabel}
                    </div>
                    <div className="min-w-0 flex-1">
                      {QUIZ_GROUPS.map((group) => (
                        <div key={group.setName} className="grid grid-cols-[52px_1fr] border-b border-[#888] last:border-b-0">
                          <div className="flex items-center justify-center border-r border-[#888] bg-[#e95757] text-center text-[11px] font-bold text-white sm:text-xs">
                            {group.setName}
                          </div>
                          <div className="grid grid-cols-5 gap-0.5 p-0.5 sm:grid-cols-10 sm:gap-1 sm:p-1">
                            {Array.from({ length: group.end - group.start + 1 }, (_, i) => group.start + i).map((quizId) => {
                              const row = slot.results?.find((r) => r.quizId === quizId);
                              return (
                                <div
                                  key={quizId}
                                  className={`flex min-h-[36px] items-center justify-center border px-0.5 text-[10px] font-bold leading-tight sm:min-h-[40px] sm:text-[11px] ${setCellClass(group.setName)}`}
                                >
                                  {cellLabel(quizId, row?.result)}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex w-full shrink-0 flex-col gap-3 border-t border-[#666] bg-[#dcdcdc] p-4 md:w-[200px] md:border-l md:border-t-0">
            <p className="text-sm font-bold">Date :</p>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold">
                Day
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  value={d}
                  onChange={(e) => setD(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  className="mt-0.5 w-full border-2 border-black bg-white px-2 py-1.5 text-center font-mono text-sm"
                />
              </label>
              <label className="text-xs font-semibold">
                Month
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  value={m}
                  onChange={(e) => setM(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  className="mt-0.5 w-full border-2 border-black bg-white px-2 py-1.5 text-center font-mono text-sm"
                />
              </label>
              <label className="text-xs font-semibold">
                Year
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={y}
                  onChange={(e) => setY(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="mt-0.5 w-full border-2 border-black bg-white px-2 py-1.5 text-center font-mono text-sm"
                />
              </label>
            </div>
            <p className="mt-auto border border-[#8a8a8a] bg-[#f1f1f1] px-2 py-3 text-center text-[11px] font-semibold text-[#444]">
              Result auto-loads when date changes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultHistoryModal;
