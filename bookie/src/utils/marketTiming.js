/**
 * Market timing utilities for bookie panel
 * Uses IST (Asia/Kolkata) timezone to match backend
 */

/**
 * Get today's date in IST (YYYY-MM-DD format)
 */
export function getTodayIST() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
}

/**
 * Normalize time string to HH:MM:SS format
 */
function normalizeTimeStr(timeStr) {
    const parts = String(timeStr).split(':');
    const h = parts[0] || '00';
    const m = parts[1] || '00';
    const s = parts[2] || '00';
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}`;
}

/**
 * Parse IST datetime string to timestamp
 */
function parseISTDateTime(isoStr) {
    const d = new Date(isoStr);
    return isNaN(d.getTime()) ? null : d.getTime();
}

/**
 * Check if current time is within market's betting window
 * Betting is allowed until opening time and until closing time
 * Betting closes at opening time and at closing time
 */
export function isMarketOpen(market, now = new Date()) {
    const closeStr = (market?.closingTime || '').toString().trim();
    
    if (!closeStr) return false;

    const todayIST = getTodayIST();
    const startStr = (market?.startingTime || '').toString().trim();
    
    // Use startingTime if provided, otherwise default to midnight
    const startAt = startStr 
        ? parseISTDateTime(`${todayIST}T${normalizeTimeStr(startStr)}+05:30`)
        : parseISTDateTime(`${todayIST}T00:00:00+05:30`);
    
    let closeAt = parseISTDateTime(`${todayIST}T${normalizeTimeStr(closeStr)}+05:30`);
    
    if (!startAt || !closeAt) return false;

    // If closing time is before or equal to opening time, market spans midnight
    // Example: 11 PM (23:00) to 1 AM (01:00) - closing is next day
    if (closeAt <= startAt) {
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

    const nowMs = now.getTime();
    // Betting is allowed only if before opening time AND before closing time
    return nowMs < startAt && nowMs < closeAt;
}

/**
 * Check if market's closing time has passed
 * Handles markets that span midnight (e.g., 11 PM - 1 AM) correctly
 */
export function isPastClosingTime(market, now = new Date()) {
    const closeStr = (market?.closingTime || '').toString().trim();
    if (!closeStr) return false;

    const todayIST = getTodayIST();
    const startStr = (market?.startingTime || '').toString().trim();
    const startAt = startStr ? parseISTDateTime(`${todayIST}T${normalizeTimeStr(startStr)}+05:30`) : parseISTDateTime(`${todayIST}T00:00:00+05:30`);
    let closeAt = parseISTDateTime(`${todayIST}T${normalizeTimeStr(closeStr)}+05:30`);
    
    if (!closeAt) return false;

    // If closing time is before or equal to opening time, market spans midnight
    // Example: 11 PM (23:00) to 1 AM (01:00) - closing is next day
    if (startAt && closeAt <= startAt) {
        const baseDate = new Date(`${todayIST}T12:00:00+05:30`);
        baseDate.setDate(baseDate.getDate() + 1);
        const nextDayStr = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(baseDate);
        closeAt = parseISTDateTime(`${nextDayStr}T${normalizeTimeStr(closeStr)}+05:30`);
        if (!closeAt) return false;
    }

    // Use > instead of >= so market is accessible until after closing time
    return now.getTime() > closeAt;
}

/**
 * Check if opening time has passed (so open bets are closed, close bets are allowed until closing time).
 * startingTime = "opening time" (e.g. 5pm) — after this, only close bets are accepted until closingTime.
 */
export function isPastOpeningTime(market, now = new Date()) {
    const startStr = (market?.startingTime || '').toString().trim();
    if (!startStr) return false;
    const todayIST = getTodayIST();
    const openAt = parseISTDateTime(`${todayIST}T${normalizeTimeStr(startStr)}+05:30`);
    if (!openAt) return false;
    return now.getTime() >= openAt;
}

/**
 * Get current betting session for a market (time-based).
 * - Open bets: until opening time (startingTime). After that, open market is closed for bets.
 * - Close bets: from opening time until closing time (closingTime). After closing time, market is fully closed.
 * Returns: 'closed' | 'open' (bets on Open) | 'close' (bets on Close)
 */
export function getMarketSession(market, now = new Date()) {
    const hasOpening = market?.openingNumber && /^\d{3}$/.test(String(market.openingNumber));
    const hasClosing = market?.closingNumber && /^\d{3}$/.test(String(market.closingNumber));
    if (hasOpening && hasClosing) return 'closed';
    if (isPastClosingTime(market, now)) return 'closed';
    // After opening time (e.g. 5pm): open bets closed, close bets open until closing time (e.g. 7pm)
    if (isPastOpeningTime(market, now)) return 'close';
    return 'open';
}

/**
 * Check if market hasn't opened yet (before 12 AM)
 */
export function isBeforeOpeningTime(market, now = new Date()) {
    const todayIST = getTodayIST();
    const startAt = parseISTDateTime(`${todayIST}T00:00:00+05:30`);
    
    if (!startAt) return false;

    return now.getTime() < startAt;
}

/**
 * Get time until market opens (in milliseconds)
 * Returns null if already open or closed
 * Markets open at 12:00 AM (midnight)
 */
export function getTimeUntilOpen(market, now = new Date()) {
    if (isMarketOpen(market, now) || isPastClosingTime(market, now)) return null;

    const todayIST = getTodayIST();
    let startAt = parseISTDateTime(`${todayIST}T00:00:00+05:30`);
    
    if (!startAt) return null;

    // If midnight has passed today, check tomorrow
    if (now.getTime() >= startAt) {
        const baseDate = new Date(`${todayIST}T12:00:00+05:30`);
        baseDate.setDate(baseDate.getDate() + 1);
        const nextDayStr = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(baseDate);
        startAt = parseISTDateTime(`${nextDayStr}T00:00:00+05:30`);
    }

    return startAt - now.getTime();
}

/**
 * Get time until market closes (in milliseconds)
 * Returns null if already closed or not yet open
 */
export function getTimeUntilClose(market, now = new Date()) {
    if (!isMarketOpen(market, now)) return null;
    
    const closeStr = (market?.closingTime || '').toString().trim();
    if (!closeStr) return null;

    const todayIST = getTodayIST();
    const startStr = (market?.startingTime || '').toString().trim();
    const startAt = startStr ? parseISTDateTime(`${todayIST}T${normalizeTimeStr(startStr)}+05:30`) : parseISTDateTime(`${todayIST}T00:00:00+05:30`);
    let closeAt = parseISTDateTime(`${todayIST}T${normalizeTimeStr(closeStr)}+05:30`);
    
    if (!closeAt) return null;

    // Handle markets that span midnight
    if (startAt && closeAt <= startAt) {
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

    return closeAt - now.getTime();
}

/**
 * Format milliseconds to human-readable time string
 */
export function formatTimeRemaining(ms) {
    if (ms <= 0) return '0m';
    
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}
