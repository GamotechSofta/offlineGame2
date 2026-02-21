/**
 * Get market time boundaries in ms (IST). Used by isBettingAllowed and isBettingAllowedForSession.
 * @returns {{ openAt: number, lastBetAt: number, closeAt: number, startStr: string, closureSec: number } | null }}
 */
function getMarketTimeBounds(market, now = new Date()) {
    const closeStr = (market?.closingTime || '').toString().trim();
    const betClosureSec = Number(market?.betClosureTime);
    const closureSec = Number.isFinite(betClosureSec) && betClosureSec >= 0 ? betClosureSec : 0;
    if (!closeStr) return null;

    const todayIST = getTodayIST();
    const startStr = (market?.startingTime || '').toString().trim();
    const openAt = startStr
        ? parseISTDateTime(`${todayIST}T${normalizeTimeStr(startStr)}+05:30`)
        : parseISTDateTime(`${todayIST}T00:00:00+05:30`);
    let closeAt = parseISTDateTime(`${todayIST}T${normalizeTimeStr(closeStr)}+05:30`);
    if (!openAt || !closeAt) return null;

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
    return { openAt, lastBetAt, closeAt, startStr, closureSec };
}

/**
 * Check if a specific session (open/close) can accept bets at the given time.
 * - Open bets: allowed only when current time is before opening time.
 * - Close bets: allowed from opening time until closing time (lastBetAt).
 *
 * @param {Object} market - { startingTime, closingTime, betClosureTime }
 * @param {Date} [now]
 * @param {'open'|'close'} betOn
 * @returns {{ allowed: boolean, message?: string }}
 */
export function isBettingAllowedForSession(market, now = new Date(), betOn = 'open') {
    const bounds = getMarketTimeBounds(market, now);
    if (!bounds) {
        return { allowed: false, message: 'Market timing not configured.' };
    }
    const { openAt, lastBetAt, startStr, closureSec } = bounds;
    const nowMs = now.getTime();

    if (betOn === 'close') {
        if (nowMs < openAt) {
            return {
                allowed: false,
                message: 'Close betting opens at opening time. You can place close bets after the opening time.',
            };
        }
        if (nowMs >= lastBetAt) {
            return {
                allowed: false,
                message: `Betting closed. Closing time has passed. You can place bets until ${closureSec > 0 ? 'the set closure time.' : 'closing time.'}`,
            };
        }
        return { allowed: true };
    }

    // open
    if (nowMs >= openAt) {
        const startTimeDisplay = startStr || '12:00 AM (midnight)';
        return {
            allowed: false,
            message: `Betting closed. Opening time (${startTimeDisplay}) has passed. You can place open bets until the opening time. For close bets, select Close session.`,
        };
    }
    if (nowMs >= lastBetAt) {
        return {
            allowed: false,
            message: `Betting closed. Closing time has passed. You can place bets until ${closureSec > 0 ? 'the set closure time.' : 'closing time.'}`,
        };
    }
    return { allowed: true };
}

/**
 * Market betting window: OPEN until opening time, CLOSE from opening time until closing time.
 * This returns allowed: true if ANY betting is currently allowed (open or close window).
 * For per-bet validation use isBettingAllowedForSession(market, now, betOn).
 *
 * @param {Object} market - { startingTime, closingTime, betClosureTime }
 * @param {Date} [now] - current time (default: new Date())
 * @returns {{ allowed: boolean, message?: string }}
 */
export function isBettingAllowed(market, now = new Date()) {
    const bounds = getMarketTimeBounds(market, now);
    if (!bounds) {
        return { allowed: false, message: 'Market timing not configured.' };
    }
    const { openAt, lastBetAt, startStr, closureSec } = bounds;
    const nowMs = now.getTime();

    if (nowMs >= lastBetAt) {
        return {
            allowed: false,
            message: `Betting closed. Closing time has passed. You can place bets until ${closureSec > 0 ? 'the set closure time.' : 'closing time.'}`,
        };
    }
    if (nowMs >= openAt) {
        return { allowed: true };
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

