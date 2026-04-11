/**
 * 15-minute quiz slots in Asia/Kolkata (IST, UTC+05:30).
 * Boundaries: :00, :15, :30, :45 — study = first 13 minutes; hint = last 2 minutes.
 * Server clock only; never trust client time for slot boundaries.
 */
export const SLOT_MINUTES = 15;
export const STUDY_MINUTES = 13;
export const SLOT_MS = SLOT_MINUTES * 60 * 1000;
export const STUDY_MS = STUDY_MINUTES * 60 * 1000;
export const STUDY_SECONDS = STUDY_MINUTES * 60;

const TZ = 'Asia/Kolkata';

/** @returns {{ y: string, mo: string, d: string, h: number, mi: number, s: number }} */
export function getISTParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const g = (t) => parts.find((p) => p.type === t).value;
  return {
    y: g('year'),
    mo: g('month'),
    d: g('day'),
    h: parseInt(g('hour'), 10),
    mi: parseInt(g('minute'), 10),
    s: parseInt(g('second'), 10),
  };
}

/** IST calendar day key YYYY-MM-DD */
export function istDayKey(date = new Date()) {
  const p = getISTParts(date);
  return `${p.y}-${p.mo}-${p.d}`;
}

/** Seconds from IST midnight for `date`. */
export function istSecondsSinceMidnight(date = new Date()) {
  const p = getISTParts(date);
  return p.h * 3600 + p.mi * 60 + p.s;
}

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Slot index 0..95 for given IST calendar day (from seconds since midnight).
 * @param {number} secInDay
 * @param {string} istYmd - YYYY-MM-DD in IST
 */
export function slotStartInstantUtc(secInDay, istYmd) {
  const slotIndex = Math.floor(secInDay / (15 * 60));
  const startMinTotal = slotIndex * 15;
  const hh = Math.floor(startMinTotal / 60) % 24;
  const mm = startMinTotal % 60;
  const [Y, M, D] = istYmd.split('-').map((x) => parseInt(x, 10));
  return new Date(`${Y}-${pad2(M)}-${pad2(D)}T${pad2(hh)}:${pad2(mm)}:00+05:30`);
}

/** True if `istYmd` is a real calendar day in IST (YYYY-MM-DD). */
export function isValidISTDayKey(istYmd) {
  if (typeof istYmd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(istYmd)) return false;
  const [Y, M, D] = istYmd.split('-').map((x) => parseInt(x, 10));
  if (!Number.isFinite(Y) || M < 1 || M > 12 || D < 1 || D > 31) return false;
  const anchor = new Date(`${Y}-${pad2(M)}-${pad2(D)}T12:00:00+05:30`);
  if (Number.isNaN(anchor.getTime())) return false;
  return istDayKey(anchor) === istYmd;
}

/** All 96 fifteen-minute slot start ISO strings for IST calendar day `istYmd` (YYYY-MM-DD). */
export function listSlotStartIsoForISTDay(istYmd) {
  const out = [];
  for (let idx = 0; idx < 96; idx += 1) {
    out.push(slotStartInstantUtc(idx * 15 * 60, istYmd).toISOString());
  }
  return out;
}

/** Previous calendar day in IST (noon anchor − 24h). */
export function istPreviousDayKey(istYmd) {
  const [Y, M, D] = istYmd.split('-').map((x) => parseInt(x, 10));
  const anchor = new Date(`${Y}-${pad2(M)}-${pad2(D)}T12:00:00+05:30`);
  anchor.setTime(anchor.getTime() - 86400000);
  return istDayKey(anchor);
}

/**
 * Full slot context for `now`.
 * @returns {{
 *  istDayKey: string,
 *  slotIndex: number,
 *  slotStartMs: number,
 *  slotEndMs: number,
 *  slotStartIso: string,
 *  secIntoSlot: number,
 *  phase: 'study'|'hint',
 *  previousSlotStartIso: string,
 *  previousSlotEndMs: number,
 *  nextSlotEndMs: number,
 * }}
 */
export function getSlotContext(now = new Date()) {
  const day = istDayKey(now);
  const sec = istSecondsSinceMidnight(now);
  const slotIndex = Math.floor(sec / (15 * 60));
  const secIntoSlot = sec % (15 * 60);

  let slotDay = day;
  let idx = slotIndex;
  if (slotIndex < 0) {
    idx = 0;
  }

  const slotStart = slotStartInstantUtc(idx * 15 * 60, slotDay);
  const slotStartMs = slotStart.getTime();
  const slotEndMs = slotStartMs + SLOT_MS;
  const slotStartIso = slotStart.toISOString();

  let prevStartIso;
  let prevEndMs;
  if (idx === 0) {
    const prevDay = istPreviousDayKey(slotDay);
    const prevStart = slotStartInstantUtc(95 * 15 * 60, prevDay);
    prevStartIso = prevStart.toISOString();
    prevEndMs = prevStart.getTime() + SLOT_MS;
  } else {
    const prevStart = slotStartInstantUtc((idx - 1) * 15 * 60, slotDay);
    prevStartIso = prevStart.toISOString();
    prevEndMs = prevStart.getTime() + SLOT_MS;
  }

  const phase = secIntoSlot >= STUDY_SECONDS ? 'hint' : 'study';

  const nextSlotEndMs = slotEndMs + SLOT_MS;

  return {
    istDayKey: slotDay,
    slotIndex: idx,
    slotStartMs,
    slotEndMs,
    slotStartIso,
    secIntoSlot,
    phase,
    previousSlotStartIso: prevStartIso,
    previousSlotEndMs: prevEndMs,
    nextSlotEndMs,
  };
}

/** Draw time label = slot end wall time in IST (12h). */
export function formatDrawLabel(slotEndMs) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(new Date(slotEndMs));
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '';
  const dayPeriod = parts.find((p) => p.type === 'dayPeriod')?.value?.toUpperCase() ?? '';
  return `${hour}:${minute} ${dayPeriod}`.replace(/\s+/g, ' ').trim();
}

/** Strict string shape for slot start (ISO 8601 UTC `Z`, as produced by Date.prototype.toISOString). */
export function isWellFormedSlotStartIsoString(slotStartIso) {
  if (typeof slotStartIso !== 'string') return false;
  if (slotStartIso.length < 20 || slotStartIso.length > 40) return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(slotStartIso)) return false;
  return true;
}

/**
 * True if `slotStartIso` is exactly the IST 15-minute slot start for that instant.
 * Uses same calendar math as getSlotContext (server source of truth).
 */
export function isValidISTSlotStartIso(slotStartIso) {
  if (!isWellFormedSlotStartIsoString(slotStartIso)) return false;
  const ms = new Date(slotStartIso).getTime();
  if (Number.isNaN(ms)) return false;
  const ctx = getSlotContext(new Date(ms + 120_000));
  return ctx.slotStartIso === slotStartIso;
}

/** Slot start is still in the future (replay / forged ISO guard). Small skew allowed. */
export function isSlotStartInFuture(slotStartIso, nowMs = Date.now(), skewMs = 60_000) {
  const ms = new Date(slotStartIso).getTime();
  if (Number.isNaN(ms)) return true;
  return ms > nowMs + skewMs;
}
