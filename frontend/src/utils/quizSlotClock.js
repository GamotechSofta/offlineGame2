/** 2D Quiz: 15 minutes = one game; first 13.5 minutes study phase, then hint only (one question, no number). All time in IST. */

export const SLOT_MINUTES = 15;
export const STUDY_MINUTES = 13.5;

/** 2D study list: first row at slot start, each following row after this delay (same clock for every user). */
export const QUESTION_REVEAL_STAGGER_MS = 8100;

/** 3D study list stagger (0.81 s between rows). */
export const QUESTION_REVEAL_STAGGER_MS_3D = 810;

/**
 * Rows visible for the current wall time vs server slot start (ISO UTC).
 * All users in the same slot see the same row count at the same moment.
 */
export function getVisibleQuestionCountFromSlotStart(slotStartIso, totalQuestions, staggerMs = QUESTION_REVEAL_STAGGER_MS) {
  if (!totalQuestions || typeof slotStartIso !== 'string' || !slotStartIso) return 0;
  const slotStartMs = new Date(slotStartIso).getTime();
  if (!Number.isFinite(slotStartMs)) return 0;
  const elapsed = Math.max(0, Date.now() - slotStartMs);
  return Math.min(totalQuestions, Math.max(1, Math.floor(elapsed / staggerMs) + 1));
}
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
