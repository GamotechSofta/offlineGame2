/** Current date in IST as YYYY-MM-DD (matches backend resultReset). */
export function getTodayIST() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
}

/** Alias used by dashboard revenue KPIs. */
export const getIstTodayKey = getTodayIST;
