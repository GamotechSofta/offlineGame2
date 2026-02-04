/**
 * Check if betting is allowed for a market at the given time.
 * Uses same rules as backend: between opening and (closing - betClosureTime).
 * Uses client local time (assume market times are in same timezone as user).
 *
 * @param {{ startingTime: string, closingTime: string, betClosureTime?: number }} market
 * @param {Date} [now]
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
    return { allowed: false, message: 'Invalid market time.' };
  }

  if (closeAt.getTime() <= openAt.getTime()) {
    closeAt = new Date(closeAt);
    closeAt.setDate(closeAt.getDate() + 1);
  }

  const lastBetAt = new Date(closeAt.getTime() - closureSec * 1000);

  if (now.getTime() < openAt.getTime()) {
    return {
      allowed: false,
      message: `Betting opens at ${formatTime12(startStr)}. You can place bets after opening time.`,
    };
  }
  if (now.getTime() > lastBetAt.getTime()) {
    return {
      allowed: false,
      message: 'Betting has closed for this market. Bets are not accepted after the set closure time.',
    };
  }
  return { allowed: true };
}

function parseTimeToDate(timeStr, refDate) {
  if (!timeStr) return null;
  const parts = timeStr.split(':').map((p) => parseInt(p, 10));
  const h = parts[0];
  const m = parts[1] ?? 0;
  const s = parts[2] ?? 0;
  if (!Number.isFinite(h) || h < 0 || h > 23 || !Number.isFinite(m) || m < 0 || m > 59) return null;
  return new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), h, m, s, 0);
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
 */
export function isPastClosingTime(market, now = new Date()) {
  const startStr = (market?.startingTime || '').toString().trim();
  const closeStr = (market?.closingTime || '').toString().trim();
  if (!closeStr) return false;
  const openAt = parseTimeToDate(startStr, now);
  let closeAt = parseTimeToDate(closeStr, now);
  if (!closeAt) return false;
  if (openAt && closeAt.getTime() <= openAt.getTime()) {
    closeAt = new Date(closeAt);
    closeAt.setDate(closeAt.getDate() + 1);
  }
  return now.getTime() >= closeAt.getTime();
}
