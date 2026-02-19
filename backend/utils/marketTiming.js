/**
 * Market betting window: Users can bet until opening time and until closing time.
 * Betting closes at opening time and at closing time.
 * Times are in "HH:MM" or "HH:MM:SS"; betClosureTime is seconds before closing when betting stops.
 * Uses IST (Asia/Kolkata) to match market reset and user expectations.
 *
 * @param {Object} market - { startingTime, closingTime, betClosureTime }
 * @param {Date} [now] - current time (default: new Date())
 * @returns {{ allowed: boolean, message?: string }}
 */
export function isBettingAllowed(market, now = new Date()) {
    const closeStr = (market?.closingTime || '').toString().trim();
    const betClosureSec = Number(market?.betClosureTime);
    const closureSec = Number.isFinite(betClosureSec) && betClosureSec >= 0 ? betClosureSec : 0;

    if (!closeStr) {
        return { allowed: false, message: 'Market timing not configured.' };
    }

    const todayIST = getTodayIST();
    const startStr = (market?.startingTime || '').toString().trim();
    
    // Use startingTime if provided, otherwise default to midnight
    const openAt = startStr 
        ? parseISTDateTime(`${todayIST}T${normalizeTimeStr(startStr)}+05:30`)
        : parseISTDateTime(`${todayIST}T00:00:00+05:30`);
    
    let closeAt = parseISTDateTime(`${todayIST}T${normalizeTimeStr(closeStr)}+05:30`);
    
    if (!openAt || !closeAt) {
        return { allowed: false, message: 'Invalid market time format.' };
    }

    // If closing time is before or equal to opening time, market spans midnight
    // Example: 11 PM (23:00) to 1 AM (01:00) - closing is next day
    if (closeAt <= openAt) {
        const baseDate = new Date(`${todayIST}T12:00:00+05:30`);
        baseDate.setDate(baseDate.getDate() + 1);
        const nextDayStr = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(baseDate);
        closeAt = parseISTDateTime(`${nextDayStr}T${normalizeTimeStr(closeStr)}+05:30`);
    }

    const lastBetAt = closeAt - closureSec * 1000;
    const nowMs = now.getTime();

    // Betting closes at opening time - if current time is at or after opening time, betting is closed
    if (nowMs >= openAt) {
        const startTimeDisplay = startStr || '12:00 AM (midnight)';
        return {
            allowed: false,
            message: `Betting closed. Opening time (${startTimeDisplay}) has passed. You can place bets until the opening time.`,
        };
    }
    // Betting closes at closing time - if current time is at or after closing time, betting is closed
    if (nowMs >= lastBetAt) {
        return {
            allowed: false,
            message: `Betting closed. Closing time has passed. You can place bets until ${closureSec > 0 ? 'the set closure time.' : 'closing time.'}`,
        };
    }
    return { allowed: true };
}

function getTodayIST() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
}

function normalizeTimeStr(timeStr) {
    const parts = timeStr.split(':').map((p) => String(parseInt(p, 10) || 0).padStart(2, '0'));
    return `${parts[0] || '00'}:${parts[1] || '00'}:${parts[2] || '00'}`;
}

function parseISTDateTime(isoStr) {
    const d = new Date(isoStr);
    return isNaN(d.getTime()) ? null : d.getTime();
}

/**
 * Check if market's betting has closed (past closing time for today).
 * Uses IST. Returns true when result declaration is expected.
 * Handles markets that span midnight (e.g., 11 PM - 1 AM) correctly.
 */
export function isBettingClosed(market, now = new Date()) {
    const closeStr = (market?.closingTime || '').toString().trim();
    if (!closeStr) return false;

    const todayIST = getTodayIST();
    const startStr = (market?.startingTime || '').toString().trim();
    
    // Use startingTime if provided, otherwise default to midnight
    const openAt = startStr 
        ? parseISTDateTime(`${todayIST}T${normalizeTimeStr(startStr)}+05:30`)
        : parseISTDateTime(`${todayIST}T00:00:00+05:30`);
    
    let closeAt = parseISTDateTime(`${todayIST}T${normalizeTimeStr(closeStr)}+05:30`);
    if (!closeAt) return false;

    // If closing time is before or equal to opening time, market spans midnight
    // Example: 11 PM (23:00) to 1 AM (01:00) - closing is next day
    if (closeAt <= openAt) {
        const baseDate = new Date(`${todayIST}T12:00:00+05:30`);
        baseDate.setDate(baseDate.getDate() + 1);
        const nextDayStr = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(baseDate);
        closeAt = parseISTDateTime(`${nextDayStr}T${normalizeTimeStr(closeStr)}+05:30`);
    }

    // Use > instead of >= so market is accessible until after closing time
    return now.getTime() > closeAt;
}

