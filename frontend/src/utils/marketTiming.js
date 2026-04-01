/**
 * Check if betting is allowed for a market at the given time.
 * betClosureTime (seconds) is subtracted from opening and closing deadlines (matches backend).
 * - While before opening and outside the pre-open closure window: OPEN and CLOSE allowed (closeOnly: false).
 * - From opening time until close deadline, or inside the pre-open closure window: only CLOSE (closeOnly: true).
 * - After close deadline: no betting.
 * Uses IST (Asia/Kolkata) to match market reset and backend.
 *
 * @param {{ startingTime?: string, closingTime: string, betClosureTime?: number }} market
 * @param {Date} [now]
 * @returns {{ allowed: boolean, closeOnly?: boolean, message?: string }}
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
    return { allowed: false, message: 'Invalid market time.' };
  }

  // If closing time is before or equal to opening time, market spans midnight
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
  const nowMs = now.getTime();

  if (nowMs > lastCloseBetAt) {
    return {
      allowed: false,
      message: `Betting closed. Closing time has passed. You can place bets until ${closureSec > 0 ? 'the set closure time.' : 'closing time.'}`,
    };
  }

  const canPlaceOpen = nowMs < openAt && nowMs <= lastOpenBetAt;
  if (!canPlaceOpen) {
    return { allowed: true, closeOnly: true };
  }
  return { allowed: true };
}

export function getTodayIST() {
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

function formatTime12(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  if (!Number.isFinite(h)) return timeStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  const min = Number.isFinite(m) ? String(m).padStart(2, '0') : '00';
  return `${h12}:${min} ${ampm}`;
}

/**
 * True if current time has reached or passed the market's closing time (market is automatically closed).
 * Uses IST (Asia/Kolkata) to match backend.
 * Handles markets that span midnight (e.g., 11 PM - 1 AM) correctly by considering startingTime.
 */
export function isPastClosingTime(market, now = new Date()) {
  const closeStr = (market?.closingTime || '').toString().trim();
  if (!closeStr) return false;
  
  const todayIST = getTodayIST();
  const startStr = (market?.startingTime || '').toString().trim();
  
  // Use startingTime if provided, otherwise default to midnight
  const openAt = startStr 
    ? parseISTDateTime(`${todayIST}T${normalizeTimeStr(startStr)}+05:30`)
    : parseISTDateTime(`${todayIST}T00:00:00+05:30`);
  
  let closeAt = parseISTDateTime(`${todayIST}T${normalizeTimeStr(closeStr)}+05:30`);
  
  if (!openAt || !closeAt) return false;
  
  const nowMs = now.getTime();
  
  // If closing time is before or equal to opening time, market spans midnight
  // Example: 11 PM (23:00) to 1 AM (01:00) - closing is next day
  if (closeAt <= openAt) {
    // Market closes on the next day
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
    
    // Check if we're past the closing time on the next day
    // Use > instead of >= so market is accessible until after closing time
    return nowMs > closeAt;
  }
  
  // Market closes on the same day (e.g., 9 AM - 5 PM)
  // Use > instead of >= so market is accessible until after closing time
  return nowMs > closeAt;
}
