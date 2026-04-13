/** 2D Quiz: 15 minutes = one game; first 13 minutes study phase, then hint only (one question, no number). All time in IST. */

export const SLOT_MINUTES = 15;
export const STUDY_MINUTES = 13;
export const SLOT_SECONDS = SLOT_MINUTES * 60;
export const STUDY_SECONDS = STUDY_MINUTES * 60;

const TZ = 'Asia/Kolkata';

/** Seconds since midnight in IST. */
export function getISTSecondsSinceMidnight(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const n = (t) => parseInt(parts.find((p) => p.type === t).value, 10);
  return n('hour') * 3600 + n('minute') * 60 + n('second');
}

/** Seconds since midnight -> 12h label (IST). */
export function formatISTTimeFromDaySeconds(sec) {
  const wrap = ((sec % 86400) + 86400) % 86400;
  let h24 = Math.floor(wrap / 3600);
  const m = Math.floor((wrap % 3600) / 60);
  const am = h24 < 12;
  const h12 = h24 % 12 || 12;
  const suf = am ? 'AM' : 'PM';
  return `${h12}:${String(m).padStart(2, '0')} ${suf}`;
}

const slotsPerDay = Math.ceil(86400 / SLOT_SECONDS);

/**
 * Slot draw-end time (where slot closes) in seconds since midnight, [0, 86400).
 * Slot i range is [i*900, (i+1)*900) - draw time is (i+1)*900 mod 86400.
 */
function drawEndSecondsForSlotIndex(slotIdx) {
  const i = ((slotIdx % slotsPerDay) + slotsPerDay) % slotsPerDay;
  return ((i + 1) * SLOT_SECONDS) % 86400;
}

/**
 * Current 15-minute slot + phase.
 * `currentLabel` / `prevLabel` / `nextLabel` = draw-end labels (not start time).
 */
export function getSlotState(date = new Date()) {
  const s = getISTSecondsSinceMidnight(date);
  const secInSlot = s % SLOT_SECONDS;
  const slotIndexToday = Math.floor(s / SLOT_SECONDS);
  const hintPhase = secInSlot >= STUDY_SECONDS;

  return {
    slotIndexToday,
    secInSlot,
    hintPhase,
    secondsUntilHint: Math.max(0, STUDY_SECONDS - secInSlot),
    secondsUntilSlotEnd: SLOT_SECONDS - secInSlot,
    currentLabel: formatISTTimeFromDaySeconds(drawEndSecondsForSlotIndex(slotIndexToday)),
    prevLabel: formatISTTimeFromDaySeconds(drawEndSecondsForSlotIndex(slotIndexToday - 1)),
    nextLabel: formatISTTimeFromDaySeconds(drawEndSecondsForSlotIndex(slotIndexToday + 1)),
  };
}

/** Deterministic "random" question index 0-99 for same slot + quiz for all users. */
export function pickHintQuestionIndex(slotIndexToday, quizNum, date = new Date()) {
  const y = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric' }).format(date);
  const m = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, month: '2-digit' }).format(date);
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, day: '2-digit' }).format(date);
  const seed = Number(`${y}${m}${d}`.replace(/\D/g, '')) * 1009 + slotIndexToday * 7919 + quizNum * 193;
  let x = seed >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x % 100;
}

export function formatCountdown(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
