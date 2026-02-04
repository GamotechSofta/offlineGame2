/**
 * Market betting window: users can bet only between opening time and (closing time - betClosureTime).
 * Times are in "HH:MM" or "HH:MM:SS"; betClosureTime is seconds before closing when betting stops.
 * Uses server local time (assume market times are in same timezone as server).
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

    const openAt = parseTimeToDate(startStr, now);
    let closeAt = parseTimeToDate(closeStr, now);
    if (!openAt || !closeAt) {
        return { allowed: false, message: 'Invalid market time format.' };
    }

    // If closing is before or equal to opening, closing is next day (e.g. 22:00 - 02:00)
    if (closeAt.getTime() <= openAt.getTime()) {
        closeAt = new Date(closeAt);
        closeAt.setDate(closeAt.getDate() + 1);
    }

    const lastBetAt = new Date(closeAt.getTime() - closureSec * 1000);

    if (now.getTime() < openAt.getTime()) {
        return {
            allowed: false,
            message: `Betting opens at ${formatTimeForMessage(startStr)}. Please try after opening time.`,
        };
    }
    if (now.getTime() > lastBetAt.getTime()) {
        return {
            allowed: false,
            message: `Betting has closed for this market. Bets are not accepted after ${closureSec > 0 ? closureSec + ' seconds before closing time.' : 'closing time.'}`,
        };
    }
    return { allowed: true };
}

/**
 * Parse "HH:MM" or "HH:MM:SS" to a Date on the same calendar day as refDate.
 */
function parseTimeToDate(timeStr, refDate) {
    if (!timeStr) return null;
    const parts = timeStr.split(':').map((p) => parseInt(p, 10));
    const h = parts[0];
    const m = parts[1] ?? 0;
    const s = parts[2] ?? 0;
    if (!Number.isFinite(h) || h < 0 || h > 23 || !Number.isFinite(m) || m < 0 || m > 59) return null;
    const d = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), h, m, s, 0);
    return d;
}

function formatTimeForMessage(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    if (!Number.isFinite(h)) return timeStr;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    const min = Number.isFinite(m) ? String(m).padStart(2, '0') : '00';
    return `${h12}:${min} ${ampm}`;
}
