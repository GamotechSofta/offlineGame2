import { getTodayIST } from './istDate.js';

const IST_MS = 330 * 60 * 1000;

function istYmdStartUtc(y, m, d) {
    return Date.UTC(y, m - 1, d, 0, 0, 0, 0) - IST_MS;
}

function fmtIstDayFromMs(ms) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date(ms));
}

export function addDaysIst(ymd, delta) {
    const [y, m, d] = ymd.split('-').map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return ymd;
    return fmtIstDayFromMs(istYmdStartUtc(y, m, d) + delta * 86400000);
}

function istWeekdaySun0(ymd) {
    const [y, m, d] = ymd.split('-').map(Number);
    const ms = istYmdStartUtc(y, m, d) + 12 * 60 * 60 * 1000;
    const short = new Date(ms).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' });
    const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return map[short] ?? 0;
}

function istWeekdayMon0(ymd) {
    const sun0 = istWeekdaySun0(ymd);
    return sun0 === 0 ? 6 : sun0 - 1;
}

export const DATE_PRESETS = [
    { id: 'all', label: 'All', getRange: () => ({ from: '', to: '' }) },
    {
        id: 'today',
        label: 'Today',
        getRange: () => {
            const t = getTodayIST();
            return { from: t, to: t };
        },
    },
    {
        id: 'yesterday',
        label: 'Yesterday',
        getRange: () => {
            const t = getTodayIST();
            const y = addDaysIst(t, -1);
            return { from: y, to: y };
        },
    },
    {
        id: 'this_week',
        label: 'This Week',
        getRange: () => {
            const today = getTodayIST();
            const idx = istWeekdayMon0(today);
            const from = addDaysIst(today, -idx);
            return { from, to: today };
        },
    },
    {
        id: 'last_week',
        label: 'Last Week',
        getRange: () => {
            const today = getTodayIST();
            const idx = istWeekdayMon0(today);
            const thisMon = addDaysIst(today, -idx);
            const from = addDaysIst(thisMon, -7);
            const to = addDaysIst(thisMon, -1);
            return { from, to };
        },
    },
    {
        id: 'this_month',
        label: 'This Month',
        getRange: () => {
            const today = getTodayIST();
            const [y, m] = today.split('-').map(Number);
            const from = `${y}-${String(m).padStart(2, '0')}-01`;
            return { from, to: today };
        },
    },
    {
        id: 'last_month',
        label: 'Last Month',
        getRange: () => {
            const today = getTodayIST();
            const [ty, tm] = today.split('-').map(Number);
            const firstThis = `${ty}-${String(tm).padStart(2, '0')}-01`;
            const lastPrev = addDaysIst(firstThis, -1);
            const [ly, lm] = lastPrev.split('-').map(Number);
            const from = `${ly}-${String(lm).padStart(2, '0')}-01`;
            return { from, to: lastPrev };
        },
    },
];

function formatIstYmdLabel(ymd) {
    if (typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ymd.trim())) return String(ymd || '');
    const [y, m, d] = ymd.trim().split('-').map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return ymd;
    const utcMs = Date.UTC(y, m - 1, d, 6, 30, 0, 0);
    return new Date(utcMs).toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

export const formatRangeLabel = (from, to) => {
    if (!from || !to) return 'All time';
    if (from === to) return formatIstYmdLabel(from);
    return `${formatIstYmdLabel(from)} – ${formatIstYmdLabel(to)}`;
};
