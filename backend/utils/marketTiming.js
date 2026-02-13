/**
 * Market betting window: market opens at startingTime IST and closes at closing time each day.
 * Users can bet only between startingTime IST and (closing time - betClosureTime).
 * Times are in "HH:MM" or "HH:MM:SS"; betClosureTime is seconds before closing when betting stops.
 * Uses IST (Asia/Kolkata) to match market reset and user expectations.
 *
 * @param {Object} market - { startingTime, closingTime, betClosureTime }
 * @param {Date} [now] - current time (default: new Date())
 * @returns {{ allowed: boolean, message?: string }}
 */
export function isBettingAllowed(market, now = new Date()) {
    const startStr = (market?.startingTime || '').toString().trim();
    const closeStr = (market?.closingTime || '').toString().trim();
    const betClosureSec = Number(market?.betClosureTime);
    const closureSec = Number.isFinite(betClosureSec) && betClosureSec >= 0 ? betClosureSec : 0;

    if (!startStr || !closeStr) {
        return { allowed: false, message: 'Market timing not configured.' };
    }

    const todayIST = getTodayIST();
    let openAt = parseISTDateTime(`${todayIST}T${normalizeTimeStr(startStr)}+05:30`);
    let closeAt = parseISTDateTime(`${todayIST}T${normalizeTimeStr(closeStr)}+05:30`);
    
    if (!openAt || !closeAt) {
        return { allowed: false, message: 'Invalid market time format.' };
    }

    // Handle markets that span midnight (e.g., 23:00 - 01:00)
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

    if (nowMs < openAt) {
        const startTimeFormatted = startStr.slice(0, 5); // Format as HH:MM
        return {
            allowed: false,
            message: `Betting opens at ${startTimeFormatted}. You can place bets after the market opening time.`,
        };
    }
    if (nowMs > lastBetAt) {
        return {
            allowed: false,
            message: `Betting has closed for this market. Bets are not accepted after ${closureSec > 0 ? 'the set closure time.' : 'closing time.'}`,
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
 */
export function isBettingClosed(market, now = new Date()) {
    const closeStr = (market?.closingTime || '').toString().trim();
    if (!closeStr) return false;

    const todayIST = getTodayIST();
    let closeAt = parseISTDateTime(`${todayIST}T${normalizeTimeStr(closeStr)}+05:30`);
    if (!closeAt) return false;

    const openAt = parseISTDateTime(`${todayIST}T00:00:00+05:30`);
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

    return now.getTime() > closeAt;
}

