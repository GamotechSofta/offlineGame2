import React, { useEffect, useMemo, useState } from 'react';

const toDateKeyIST = (d) => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d); // YYYY-MM-DD
  } catch {
    return '';
  }
};

const isSameDay = (a, b) =>
  a &&
  b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const clampToMax = (d, maxDate) => {
  if (!d) return d;
  if (!maxDate) return d;
  const dk = toDateKeyIST(d);
  const mk = toDateKeyIST(maxDate);
  if (dk && mk && dk > mk) return maxDate;
  return d;
};

const monthLabel = (year, monthIdx) => {
  try {
    return new Date(year, monthIdx, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
};

export default function ResultDatePicker({
  value,
  onChange,
  maxDate,
  label = 'Select Date',
  buttonClassName = '',
}) {
  const max = useMemo(() => maxDate || new Date(), [maxDate]);
  const safeValue = useMemo(() => clampToMax(value || new Date(), max), [value, max]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(safeValue);
  const [viewYear, setViewYear] = useState(safeValue.getFullYear());
  const [viewMonth, setViewMonth] = useState(safeValue.getMonth());

  useEffect(() => {
    if (!open) return;
    const v = clampToMax(value || new Date(), max);
    setDraft(v);
    setViewYear(v.getFullYear());
    setViewMonth(v.getMonth());
  }, [open, value, max]);

  const maxYear = max.getFullYear();
  const maxMonth = max.getMonth();
  const atMaxMonth = viewYear === maxYear && viewMonth === maxMonth;

  const canGoNext = !atMaxMonth;
  const canGoPrev = true;

  const daysGrid = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const startWeekday = first.getDay(); // 0=Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const cells = [];
    // Leading blanks
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    // Month days
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d));
    // Trailing blanks to fill 6 weeks
    while (cells.length < 42) cells.push(null);
    return cells;
  }, [viewYear, viewMonth]);

  const maxKey = toDateKeyIST(max);

  const isDisabledDay = (d) => {
    if (!d) return true;
    const dk = toDateKeyIST(d);
    return !!(dk && maxKey && dk > maxKey);
  };

  const handlePrev = () => {
    if (!canGoPrev) return;
    const m = viewMonth - 1;
    if (m < 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth(m);
    }
  };

  const handleNext = () => {
    if (!canGoNext) return;
    const m = viewMonth + 1;
    if (m > 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth(m);
    }
  };

  const displayLabel = useMemo(() => {
    try {
      return safeValue.toLocaleDateString('en-GB');
    } catch {
      return '';
    }
  }, [safeValue]);

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="text-white/80 text-base sm:text-lg">{label}</div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={
            buttonClassName ||
            'px-5 py-2.5 rounded-full bg-black/40 border border-white/10 text-white font-bold shadow-sm hover:border-[#d4af37]/40 transition-colors'
          }
          aria-label="Open calendar"
        >
          {displayLabel}
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[999] flex items-center justify-center px-3 sm:px-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close calendar overlay"
            onClick={() => setOpen(false)}
          />

          <div className="relative w-full max-w-md rounded-3xl overflow-hidden border border-white/10 shadow-[0_25px_80px_rgba(0,0,0,0.65)] bg-[#202124]">
            {/* Header */}
            <div className="bg-[#0b2b55] px-6 py-5 border-b border-white/10">
              <div className="text-white/80 text-sm tracking-widest font-semibold">SELECT DATE</div>
              <div className="mt-2 flex items-center justify-between gap-4">
                <div className="text-white text-3xl sm:text-4xl font-light">
                  {draft.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
                <div className="w-10 h-10 rounded-full bg-black/25 border border-white/10 flex items-center justify-center text-white/80">
                  {/* pencil icon */}
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4h2m-1 0v0m8.485 2.515a2.121 2.121 0 010 3L9 21H4v-5L16.485 6.515a2.121 2.121 0 013 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Calendar */}
            <div className="bg-white text-black px-5 py-4">
              <div className="flex items-center justify-between mb-4">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="w-10 h-10 rounded-full hover:bg-black/5 flex items-center justify-center"
                  aria-label="Previous month"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="text-lg font-semibold text-gray-700">{monthLabel(viewYear, viewMonth)}</div>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!canGoNext}
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    canGoNext ? 'hover:bg-black/5' : 'opacity-30 cursor-not-allowed'
                  }`}
                  aria-label="Next month"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-7 text-center text-xs text-gray-500 font-semibold mb-2">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => (
                  <div key={d} className="py-1">
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-y-2">
                {daysGrid.map((d, idx) => {
                  if (!d) return <div key={idx} className="h-10" />;
                  const disabled = isDisabledDay(d);
                  const selected = isSameDay(d, draft);
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={disabled}
                      onClick={() => setDraft(d)}
                      className={`h-10 w-10 mx-auto rounded-full flex items-center justify-center text-sm transition-colors ${
                        selected
                          ? 'bg-[#0b2b55] text-white'
                          : disabled
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-700 hover:bg-black/5'
                      }`}
                      aria-label={`Day ${d.getDate()}`}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white px-5 py-4 flex items-center justify-end gap-6">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[#0b2b55] font-semibold tracking-wide"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = clampToMax(draft, max);
                  onChange?.(next);
                  setOpen(false);
                }}
                className="text-[#0b2b55] font-semibold tracking-wide"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

