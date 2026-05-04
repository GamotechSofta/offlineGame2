import React from 'react';

const pad = (n) => String(n).padStart(2, '0');
const toDateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const getToday = () => new Date();
const withDeltaDays = (base, delta) => {
  const next = new Date(base);
  next.setDate(next.getDate() + delta);
  return next;
};

const getPresetRange = (presetId) => {
  const now = getToday();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = today.getDay(); // 0 Sun
  const mondayOffset = day === 0 ? -6 : 1 - day;

  switch (presetId) {
    case 'all':
      return { from: '', to: '' };
    case 'today':
      return { from: toDateKey(today), to: toDateKey(today) };
    case 'yesterday': {
      const y = withDeltaDays(today, -1);
      return { from: toDateKey(y), to: toDateKey(y) };
    }
    case 'this_week': {
      const from = withDeltaDays(today, mondayOffset);
      return { from: toDateKey(from), to: toDateKey(today) };
    }
    case 'last_week': {
      const thisWeekStart = withDeltaDays(today, mondayOffset);
      const lastWeekStart = withDeltaDays(thisWeekStart, -7);
      const lastWeekEnd = withDeltaDays(thisWeekStart, -1);
      return { from: toDateKey(lastWeekStart), to: toDateKey(lastWeekEnd) };
    }
    case 'this_month': {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: toDateKey(from), to: toDateKey(today) };
    }
    case 'last_month': {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const to = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: toDateKey(from), to: toDateKey(to) };
    }
    default:
      return { from: toDateKey(today), to: toDateKey(today) };
  }
};

const PRESETS = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_week', label: 'This Week' },
  { id: 'last_week', label: 'Last Week' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'custom', label: 'Custom' },
];

const DateRangePresetFilter = ({
  dateFrom,
  dateTo,
  setDateFrom,
  setDateTo,
  className = '',
}) => {
  const [preset, setPreset] = React.useState('today');

  React.useEffect(() => {
    const { from, to } = getPresetRange('today');
    if (!dateFrom || !dateTo) {
      setDateFrom(from);
      setDateTo(to);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPreset = (presetId) => {
    setPreset(presetId);
    if (presetId === 'custom') return;
    const { from, to } = getPresetRange(presetId);
    const today = toDateKey(getToday());
    setDateFrom(from || '2020-01-01');
    setDateTo(to || today);
  };

  const today = toDateKey(getToday());

  return (
    <div className={className}>
      <p className="text-xs font-semibold tracking-[0.08em] text-gray-500 uppercase mb-2">Date Range</p>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((item) => {
          const active = preset === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => applyPreset(item.id)}
              className={`px-4 py-2 rounded-xl border text-sm font-semibold transition ${
                active
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {preset === 'custom' ? (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600 font-medium">From date</span>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || today}
              onChange={(e) => {
                const v = e.target.value;
                setDateFrom(v);
                if (dateTo && v > dateTo) setDateTo(v);
              }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600 font-medium">To date</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              max={today}
              onChange={(e) => {
                const v = e.target.value;
                setDateTo(v);
                if (dateFrom && v < dateFrom) setDateFrom(v);
              }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
};

export default DateRangePresetFilter;
