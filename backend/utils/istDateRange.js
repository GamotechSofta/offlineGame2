const IST_OFFSET_MINUTES = 330;

/** IST calendar day bounds for YYYY-MM-DD keys (matches dashboard/stats). */
export function getIstBusinessDayRange(fromStr, toStr) {
    if (!fromStr || !toStr) {
        return { start: null, end: null };
    }

    const parseDayKey = (value) => {
        if (typeof value !== 'string') return null;
        const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return null;
        const y = Number(m[1]);
        const mo = Number(m[2]);
        const d = Number(m[3]);
        if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(d)) return null;
        const utcMs = Date.UTC(y, mo - 1, d);
        const check = new Date(utcMs);
        if (
            check.getUTCFullYear() !== y
            || (check.getUTCMonth() + 1) !== mo
            || check.getUTCDate() !== d
        ) {
            return null;
        }
        return { y, m: mo, d };
    };

    const from = parseDayKey(fromStr);
    const to = parseDayKey(toStr);
    let start = null;
    let end = null;

    if (from) {
        const startUtcMs = Date.UTC(from.y, from.m - 1, from.d, 0, 0, 0, 0)
            - (IST_OFFSET_MINUTES * 60 * 1000);
        start = new Date(startUtcMs);
    }
    if (to) {
        const nextDayUtcMs = Date.UTC(to.y, to.m - 1, to.d + 1, 0, 0, 0, 0)
            - (IST_OFFSET_MINUTES * 60 * 1000);
        end = new Date(nextDayUtcMs - 1);
    }

    if (!start || !end) {
        return { start: null, end: null };
    }
    return { start, end };
}

/** Mongo createdAt filter for IST business-day range (inclusive). */
export function buildIstDateFilter(startDate, endDate) {
    if (!startDate && !endDate) return {};
    const from = startDate || endDate;
    const to = endDate || startDate;
    const { start, end } = getIstBusinessDayRange(from, to);
    if (!start || !end) return {};
    return { createdAt: { $gte: start, $lte: end } };
}

/** Today's calendar date in IST as YYYY-MM-DD. */
export function getIstTodayDateKey() {
    const ist = new Date(Date.now() + IST_OFFSET_MINUTES * 60 * 1000);
    const y = ist.getUTCFullYear();
    const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
    const d = String(ist.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** Shift an IST YYYY-MM-DD key by deltaDays (negative = past). */
export function shiftIstDateKey(dateKey, deltaDays) {
    const m = String(dateKey || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return dateKey;
    const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + deltaDays);
    const d = new Date(utc);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
