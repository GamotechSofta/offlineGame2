/** IST weekday 0–6 from Asia/Kolkata calendar date (avoids server/device local getDay()). */
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

export function isMarketOpenOnISTDay(market, now = new Date()) {
  const allowed = normalizeMarketOpenDays(market?.openDays);
  return allowed.includes(getISTWeekdayIndex(now));
}

/**
 * Check if betting is allowed for a market at the given time.
 * betClosureTime (seconds) is subtracted from opening and closing deadlines (matches backend).
 * - While before opening and outside the pre-open closure window: OPEN and CLOSE allowed (closeOnly: false).
 * - From opening time until close deadline, or inside the pre-open closure window: only CLOSE (closeOnly: true).
 * - After close deadline: no betting.
 * Uses IST (Asia/Kolkata) to match market reset and backend.
 *
 * @param {{ startingTime?: string, closingTime: string, betClosureTime?: number, openDays?: number[] }} market
 * @param {Date} [now]
 * @returns {{ allowed: boolean, closeOnly?: boolean, message?: string }}
 */
export function isBettingAllowed(market, now = new Date()) {
  if (!isMarketOpenOnISTDay(market, now)) {
    return {
      allowed: false,
      message: 'Market is closed today (weekly schedule).',
    };
  }
  const closeStr = (market?.closingTime || '').toString().trim();
  const betClosureSec = Number(market?.betClosureTime);
  const closureSec = Number.isFinite(betClosureSec) && betClosureSec >= 0 ? betClosureSec : 0;

  if (!closeStr) {
    return { allowed: false, message: 'Market timing not configured.' };
  }

  const todayIST = getTodayIST();
  const startStr = (market?.startingTime || '').toString().trim();

  const openAt = startStr
    ? parseISTDateTime(`${todayIST}T${normalizeTimeStr(startStr)}+05:30`)
    : parseISTDateTime(`${todayIST}T00:00:00+05:30`);

  let closeAt = parseISTDateTime(`${todayIST}T${normalizeTimeStr(closeStr)}+05:30`);

  if (!openAt || !closeAt) {
    return { allowed: false, message: 'Invalid market time.' };
  }

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

/**
 * True if current time has reached or passed the market's closing time.
 */
export function isPastClosingTime(market, now = new Date()) {
  const closeStr = (market?.closingTime || '').toString().trim();
  if (!closeStr) return false;

  const todayIST = getTodayIST();
  const startStr = (market?.startingTime || '').toString().trim();

  const openAt = startStr
    ? parseISTDateTime(`${todayIST}T${normalizeTimeStr(startStr)}+05:30`)
    : parseISTDateTime(`${todayIST}T00:00:00+05:30`);

  let closeAt = parseISTDateTime(`${todayIST}T${normalizeTimeStr(closeStr)}+05:30`);

  if (!openAt || !closeAt) return false;

  const nowMs = now.getTime();

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
    if (!closeAt) return false;
    return nowMs > closeAt;
  }

  return nowMs > closeAt;
}
