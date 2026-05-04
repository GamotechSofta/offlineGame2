import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaCalendarDay } from 'react-icons/fa';
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

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const parseYmd = (s) => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map((x) => Number(x));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return { y, m, d };
};

const toYmd = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;

const daysInMonth = (year, month1to12) => new Date(year, month1to12, 0).getDate();

const istWeekdaySun0 = (year, month1to12, day) => {
  const anchor = new Date(`${year}-${pad2(month1to12)}-${pad2(day)}T12:00:00+05:30`);
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(anchor);
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd] ?? 0;
};

const buildCalendarCells = (viewYear, viewMonth1to12) => {
  const dim = daysInMonth(viewYear, viewMonth1to12);
  const firstWd = istWeekdaySun0(viewYear, viewMonth1to12, 1);
  const prevMonth = viewMonth1to12 === 1 ? 12 : viewMonth1to12 - 1;
  const prevYear = viewMonth1to12 === 1 ? viewYear - 1 : viewYear;
  const dimPrev = daysInMonth(prevYear, prevMonth);
  const cells = [];
  for (let i = 0; i < firstWd; i += 1) {
    const d = dimPrev - firstWd + i + 1;
    cells.push({ y: prevYear, m: prevMonth, d, out: true });
  }
  for (let d = 1; d <= dim; d += 1) {
    cells.push({ y: viewYear, m: viewMonth1to12, d, out: false });
  }
  let nextY = viewYear;
  let nextM = viewMonth1to12 + 1;
  if (nextM > 12) {
    nextM = 1;
    nextY += 1;
  }
  let nd = 1;
  while (cells.length % 7 !== 0 || cells.length < 42) {
    cells.push({ y: nextY, m: nextM, d: nd, out: true });
    nd += 1;
    if (nd > daysInMonth(nextY, nextM)) {
      nd = 1;
      nextM += 1;
      if (nextM > 12) {
        nextM = 1;
        nextY += 1;
      }
    }
    if (cells.length >= 42) break;
  }
  return cells;
};

/** Simple IST calendar: month + year dropdowns, big day buttons, Clear / Today. */
function IstCalendarPopover({
  open,
  anchorRef,
  maxYmd,
  valueYmd,
  onSelect,
  onClear,
  onToday,
  onRequestClose,
}) {
  const popRef = useRef(null);
  const maxParts = parseYmd(maxYmd);
  const valParts = parseYmd(valueYmd);
  const [viewYear, setViewYear] = useState(maxParts?.y ?? 2026);
  const [viewMonth, setViewMonth] = useState(maxParts?.m ?? 1);

  useEffect(() => {
    if (!open) return;
    const p = valParts || maxParts;
    if (p) {
      setViewYear(p.y);
      setViewMonth(p.m);
    }
  }, [open, valueYmd, maxYmd]);

  useEffect(() => {
    if (!maxParts) return;
    if (viewYear === maxParts.y && viewMonth > maxParts.m) {
      setViewMonth(maxParts.m);
    }
  }, [viewYear, viewMonth, maxParts]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      const t = e.target;
      if (popRef.current?.contains(t)) return;
      if (anchorRef?.current?.contains(t)) return;
      onRequestClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, anchorRef, onRequestClose]);

  const cells = useMemo(
    () => buildCalendarCells(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const yearOptions = useMemo(() => {
    if (!maxParts) return [];
    const end = maxParts.y;
    const start = Math.min(end - 5, end);
    const out = [];
    for (let y = start; y <= end; y += 1) out.push(y);
    if (!out.length) out.push(end);
    return out;
  }, [maxParts]);

  const monthDisabled = (m) => {
    if (!maxParts) return false;
    if (viewYear < maxParts.y) return false;
    if (viewYear > maxParts.y) return true;
    return m > maxParts.m;
  };

  if (!open || !maxParts) return null;

  return (
    <div
      ref={popRef}
      className="absolute right-0 top-full z-[60] mt-2 w-[min(calc(100vw-2rem),18.5rem)] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
      role="dialog"
      aria-label="Select date"
    >
      <div className="border-b border-neutral-100 bg-neutral-50 px-3 py-3">
        <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          India (IST) date
        </p>
        <div className="flex gap-2">
          <label className="flex-1 min-w-0">
            <span className="sr-only">Month</span>
            <select
              value={viewMonth}
              onChange={(e) => setViewMonth(Number(e.target.value))}
              className="w-full cursor-pointer rounded-xl border border-neutral-200 bg-white py-2.5 pl-3 pr-8 text-sm font-semibold text-neutral-900 shadow-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
            >
              {MONTH_NAMES_SHORT.map((name, idx) => {
                const m = idx + 1;
                const dis = monthDisabled(m);
                return (
                  <option key={name} value={m} disabled={dis}>
                    {name}
                  </option>
                );
              })}
            </select>
          </label>
          <label className="w-[5.25rem] shrink-0">
            <span className="sr-only">Year</span>
            <select
              value={viewYear}
              onChange={(e) => {
                const y = Number(e.target.value);
                setViewYear(y);
                if (maxParts && y === maxParts.y && viewMonth > maxParts.m) {
                  setViewMonth(maxParts.m);
                }
              }}
              className="w-full cursor-pointer rounded-xl border border-neutral-200 bg-white py-2.5 pl-3 pr-2 text-sm font-semibold text-neutral-900 shadow-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0 px-2 pt-3 text-center text-[10px] font-bold text-neutral-400 sm:text-[11px]">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1.5">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 px-2 pb-3">
        {cells.map((cell, idx) => {
          const ymdStr = toYmd(cell.y, cell.m, cell.d);
          const isFuture = maxYmd && ymdStr > maxYmd;
          const isSelected = valueYmd && ymdStr === valueYmd;
          const isToday = maxYmd && ymdStr === maxYmd;
          return (
            <button
              key={`${idx}-${ymdStr}`}
              type="button"
              disabled={isFuture}
              onClick={() => {
                if (isFuture) return;
                onSelect(ymdStr);
              }}
              className={[
                'flex aspect-square max-h-11 items-center justify-center rounded-xl text-[15px] font-semibold transition-colors sm:max-h-12 sm:text-base',
                cell.out ? 'text-neutral-300' : 'text-neutral-800',
                isFuture ? 'cursor-not-allowed opacity-25' : 'cursor-pointer active:scale-95',
                !isSelected && !cell.out && !isFuture ? 'hover:bg-orange-50' : '',
                isSelected ? 'bg-orange-500 text-white shadow-md hover:bg-orange-500' : '',
                !isSelected && isToday && !cell.out ? 'ring-2 ring-orange-300 ring-offset-1' : '',
              ].join(' ')}
            >
              {cell.d}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 border-t border-neutral-100 bg-neutral-50 px-3 py-3">
        <button
          type="button"
          onClick={onClear}
          className="flex-1 rounded-xl border border-neutral-200 bg-white py-2.5 text-sm font-semibold text-neutral-600 shadow-sm hover:bg-neutral-100"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={onToday}
          className="flex-1 rounded-xl bg-orange-500 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-orange-600"
        >
          Today
        </button>
      </div>
    </div>
  );
}

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
  const [dateFilter, setDateFilter] = useState('');
  const [slots, setSlots] = useState([]);
  const [fetchedDate, setFetchedDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const dateTriggerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const base = defaultIstDay && /^\d{4}-\d{2}-\d{2}$/.test(defaultIstDay) ? defaultIstDay : maxDay;
    setDateFilter(base || '');
    setSlots([]);
    setFetchedDate('');
    setError('');
    setPickerOpen(false);
  }, [open, defaultIstDay, maxDay]);

  const dateKey = useMemo(() => {
    const s = String(dateFilter || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
  }, [dateFilter]);

  const displayDateLabel = useMemo(() => {
    if (!fetchedDate) return '';
    const [yy, mm, dd] = fetchedDate.split('-');
    return `${dd}-${mm}-${yy}`;
  }, [fetchedDate]);

  const triggerLabel = useMemo(() => {
    if (!dateKey) return 'Tap to choose date';
    const [yy, mm, dd] = dateKey.split('-');
    return `${dd} ${MONTH_NAMES_SHORT[Number(mm) - 1]} ${yy}`;
  }, [dateKey]);

  const showResult = useCallback(async () => {
    if (!dateKey) {
      setError('Select a date.');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-xl border border-neutral-300 bg-neutral-100 text-black shadow-2xl">
        <div className="flex shrink-0 flex-col gap-3 border-b-2 border-[#c5362d] bg-gradient-to-b from-[#f06b6b] to-[#e95757] px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-tight">Results</h2>
            <p className="text-sm text-white/90">
              {displayDateLabel ? (
                <>
                  Showing <span className="font-semibold">{displayDateLabel}</span> (IST)
                </>
              ) : (
                'Choose a date below'
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-stretch gap-2 sm:items-center">
            <div className="relative grow sm:grow-0">
              <button
                ref={dateTriggerRef}
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                className="flex w-full min-w-[12rem] items-center justify-center gap-2 rounded-xl border-2 border-white/40 bg-white px-4 py-3 text-left text-[15px] font-bold text-neutral-900 shadow-md transition hover:bg-orange-50 sm:min-w-[14rem]"
              >
                <FaCalendarDay className="shrink-0 text-orange-500" aria-hidden />
                <span className="truncate">{triggerLabel}</span>
              </button>
              <IstCalendarPopover
                open={pickerOpen}
                anchorRef={dateTriggerRef}
                maxYmd={maxDay}
                valueYmd={dateKey}
                onRequestClose={() => setPickerOpen(false)}
                onSelect={(ymd) => {
                  setDateFilter(ymd);
                  setPickerOpen(false);
                  setError('');
                }}
                onClear={() => {
                  setDateFilter('');
                  setPickerOpen(false);
                  setSlots([]);
                  setFetchedDate('');
                  setError('');
                }}
                onToday={() => {
                  if (maxDay) {
                    setDateFilter(maxDay);
                    setPickerOpen(false);
                    setError('');
                  }
                }}
              />
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border-2 border-white/50 bg-[#ef3f34] px-5 py-3 text-sm font-bold text-white shadow-md hover:bg-[#d9362e]"
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col bg-[#e8e8e8]">
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading && (
              <div className="flex flex-col items-center justify-center gap-2 p-10 text-neutral-600">
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" aria-hidden />
                <p className="text-sm font-medium">Loading results…</p>
              </div>
            )}
            {error && !loading && (
              <p className="p-6 text-center text-sm font-medium text-red-700">{error}</p>
            )}
            {!loading && !error && !slots.length && (
              <div className="flex flex-col items-center justify-center gap-2 p-10 text-center text-neutral-600">
                <FaCalendarDay className="text-3xl text-neutral-400" aria-hidden />
                <p className="max-w-xs text-sm font-medium">
                  Tap the date button above and pick a day on the calendar.
                </p>
              </div>
            )}
            {!loading && slots.length > 0 && (
              <div className="flex flex-col gap-3 p-2 sm:p-3">
                {slots.map((slot) => (
                  <div key={slot.slotStartIso} className="flex gap-0 overflow-hidden rounded-lg border border-black bg-[#f5f5f5] shadow-sm">
                    <div className="flex w-[72px] shrink-0 flex-col items-center justify-center border-r border-black bg-neutral-900 px-1 py-3 text-center text-sm font-bold leading-tight text-white sm:w-[88px] sm:text-base">
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
        </div>
      </div>
    </div>
  );
};

export default ResultHistoryModal;
