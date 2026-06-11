/** Shared date-range presets for admin reports (dashboard, bookie detail, etc.). */

function getIstTodayKey() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
}

export const DATE_RANGE_PRESETS = [
    { id: 'all', label: 'All', getRange: () => ({ from: '', to: '' }) },
    {
        id: 'today',
        label: 'Today',
        getRange: () => {
            const from = getIstTodayKey();
            return { from, to: from };
        },
    },
    {
        id: 'yesterday',
        label: 'Yesterday',
        getRange: () => {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            return { from, to: from };
        },
    },
    {
        id: 'this_week',
        label: 'This Week',
        getRange: () => {
            const d = new Date();
            const day = d.getDay();
            const sun = new Date(d);
            sun.setDate(d.getDate() - day);
            const fmt = (x) =>
                `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
            return { from: fmt(sun), to: fmt(d) };
        },
    },
    {
        id: 'last_week',
        label: 'Last Week',
        getRange: () => {
            const d = new Date();
            const day = d.getDay();
            const sun = new Date(d);
            sun.setDate(d.getDate() - day - 7);
            const sat = new Date(sun);
            sat.setDate(sun.getDate() + 6);
            const fmt = (x) =>
                `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
            return { from: fmt(sun), to: fmt(sat) };
        },
    },
    {
        id: 'this_month',
        label: 'This Month',
        getRange: () => {
            const d = new Date();
            const y = d.getFullYear();
            const m = d.getMonth();
            const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
            const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            return { from, to };
        },
    },
    {
        id: 'last_month',
        label: 'Last Month',
        getRange: () => {
            const d = new Date();
            const y = d.getFullYear();
            const m = d.getMonth() - 1;
            const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
            const last = new Date(y, m + 1, 0);
            const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
            return { from, to };
        },
    },
];

export function presetToDateRange(presetId) {
    const preset = DATE_RANGE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return { startDate: '', endDate: '' };
    const { from, to } = preset.getRange();
    return { startDate: from, endDate: to };
}

export function formatDateRangeLabel(startDate, endDate) {
    if (!startDate && !endDate) return 'All time';
    if (startDate && endDate && startDate === endDate) {
        return new Date(startDate + 'T12:00:00').toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    }
    if (startDate && endDate) {
        const a = new Date(startDate + 'T12:00:00');
        const b = new Date(endDate + 'T12:00:00');
        return `${a.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${b.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return startDate || endDate || '—';
}
