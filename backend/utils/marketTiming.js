/**
 * IST calendar weekday 0=Sunday … 6=Saturday (same numbering as Date.getDay).
 * Uses the date in Asia/Kolkata, not the host's local timezone — required for UTC/Linux servers in production.
 * (Parsing weekday strings can vary by ICU; falling back to getDay() used server local day and broke scheduling.)
 */
export function getISTWeekdayIndex(now = new Date()) {
    const ymd = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(now);
    const ref = new Date(`${ymd}T12:00:00+05:30`);
    if (isNaN(ref.getTime())) return 0;
    return ref.getUTCDay();
}

/**
 * Effective open days: unique sorted 0–6. Null/omit/non-array = all week (legacy markets).
 */
export function normalizeMarketOpenDays(openDays) {
    if (openDays == null || !Array.isArray(openDays)) {
        return [0, 1, 2, 3, 4, 5, 6];
    }
    const set = new Set();
    for (const d of openDays) {
        const n = Number(d);
        if (Number.isInteger(n) && n >= 0 && n <= 6) set.add(n);
    }
    if (set.size === 0) return [0, 1, 2, 3, 4, 5, 6];
    return [...set].sort((a, b) => a - b);
}

/** True if today (IST) is a day when this market runs and accepts bets. */
export function isMarketOpenOnISTDay(market, now = new Date()) {
    const allowed = normalizeMarketOpenDays(market?.openDays);
    return allowed.includes(getISTWeekdayIndex(now));
}

/**
 * Get market time boundaries in ms (IST). Used by isBettingAllowed and isBettingAllowedForSession.
 * betClosureTime (seconds) is subtracted from BOTH opening and closing deadlines.
 * @returns {{ openAt: number, closeAt: number, lastOpenBetAt: number, lastCloseBetAt: number, startStr: string, closureSec: number } | null }}
 */
function getMarketTimeBounds(market, _now = new Date()) {
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
    const closureMs = closureSec * 1000;
    const lastOpenBetAt = openAt - closureMs;
    const lastCloseBetAt = closeAt - closureMs;
    return { openAt, closeAt, lastOpenBetAt, lastCloseBetAt, startStr, closureSec };
}

/**
 * Check if a specific session (open/close) can accept bets at the given time.
 * - Open bets: allowed until (opening time − betClosureTime), inclusive; not after opening time.
 * - Close bets: allowed until (closing time − betClosureTime), inclusive; independent of opening time.
 *
 * @param {Object} market - { startingTime, closingTime, betClosureTime }
 * @param {Date} [now]
 * @param {'open'|'close'} betOn
 * @returns {{ allowed: boolean, message?: string }}
 */
export function isBettingAllowedForSession(market, now = new Date(), betOn = 'open') {
    if (!isMarketOpenOnISTDay(market, now)) {
        return {
            allowed: false,
            message: 'Market is closed today (weekly schedule).',
        };
    }
    const bounds = getMarketTimeBounds(market, now);
    if (!bounds) {
        return { allowed: false, message: 'Market timing not configured.' };
    }
    const { openAt, lastOpenBetAt, lastCloseBetAt, startStr, closureSec } = bounds;
    const nowMs = now.getTime();

    if (betOn === 'close') {
        // Close bets: allowed until closing time only (independent of opening time)
        if (nowMs > lastCloseBetAt) {
            return {
                allowed: false,
                message: `Betting closed. Closing time has passed. You can place close bets until ${closureSec > 0 ? 'the set closure time.' : 'closing time.'}`,
            };
        }
        return { allowed: true };
    }

    // Open bets: until opening time, minus betClosureTime (no open bets in the last N seconds before opening)
    if (nowMs >= openAt) {
        const startTimeDisplay = startStr || '12:00 AM (midnight)';
        return {
            allowed: false,
            message: `Betting closed. Opening time (${startTimeDisplay}) has passed. You can place open bets until the opening time. For close bets, select Close session.`,
        };
    }
    if (nowMs > lastOpenBetAt) {
        const startTimeDisplay = startStr || '12:00 AM (midnight)';
        return {
            allowed: false,
            message:
                closureSec > 0
                    ? `Betting closed for Open session. Open bets stop ${closureSec}s before opening time (${startTimeDisplay}). Select Close session or try earlier.`
                    : `Betting closed for Open session. Select Close session.`,
        };
    }
    if (nowMs > lastCloseBetAt) {
        return {
            allowed: false,
            message: `Betting closed. Closing time has passed. You can place bets until ${closureSec > 0 ? 'the set closure time.' : 'closing time.'}`,
        };
    }
    return { allowed: true };
}

/**
 * Market betting window: OPEN bets until opening time; CLOSE bets until closing time (independent).
 * This returns allowed: true if ANY betting is currently allowed (open or close window).
 * For per-bet validation use isBettingAllowedForSession(market, now, betOn).
 *
 * @param {Object} market - { startingTime, closingTime, betClosureTime }
 * @param {Date} [now] - current time (default: new Date())
 * @returns {{ allowed: boolean, closeOnly?: boolean, message?: string }}
 */
export function isBettingAllowed(market, now = new Date()) {
    if (!isMarketOpenOnISTDay(market, now)) {
        return {
            allowed: false,
            message: 'Market is closed today (weekly schedule).',
        };
    }
    const bounds = getMarketTimeBounds(market, now);
    if (!bounds) {
        return { allowed: false, message: 'Market timing not configured.' };
    }
    const { openAt, lastOpenBetAt, lastCloseBetAt } = bounds;
    const nowMs = now.getTime();

    if (nowMs > lastCloseBetAt) {
        return {
            allowed: false,
            message: `Betting closed. Closing time has passed. You can place bets until ${bounds.closureSec > 0 ? 'the set closure time.' : 'closing time.'}`,
        };
    }
    const canPlaceOpen = nowMs < openAt && nowMs <= lastOpenBetAt;
    if (!canPlaceOpen) {
        return { allowed: true, closeOnly: true };
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

