/** 2D Quiz: 15 मिनिटे = एक गेम; पहिले १३ मिनिटे सर्व प्रश्न, नंतर फक्त Hint (एक प्रश्न, नंबर नाही). सर्व वेळ IST. */

export const SLOT_MINUTES = 15;
export const STUDY_MINUTES = 13;
export const SLOT_SECONDS = SLOT_MINUTES * 60;
export const STUDY_SECONDS = STUDY_MINUTES * 60;

const TZ = 'Asia/Kolkata';

/** आज IST मध्ये मध्यरात्रीपासून सेकंद. */
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

/** मध्यरात्रीपासून सेकंद → 12h लेबल (IST). */
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
 * त्या स्लॉटची **ड्रॉ वेळ** (स्लॉट संपतो तिथे) — मध्यरात्रीपासून सेकंद, [0, 86400).
 * Slot i चा कालावधी [i*900, (i+1)*900) — ड्रॉ = (i+1)*900 mod 86400.
 */
function drawEndSecondsForSlotIndex(slotIdx) {
  const i = ((slotIdx % slotsPerDay) + slotsPerDay) % slotsPerDay;
  return ((i + 1) * SLOT_SECONDS) % 86400;
}

/**
 * सध्याचा १५ मिनिटांचा स्लॉट + फेज.
 * `currentLabel` / `prevLabel` / `nextLabel` = त्या स्लॉटची **ड्रॉ वेळ** (स्टार्ट वेळ नाही).
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

/** एकाच स्लॉट + क्विझसाठी सर्वांना सारखा “random” प्रश्न क्रमांक 0–99. */
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
