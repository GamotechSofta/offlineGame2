/**
 * Deterministic randomness — NO Math.random.
 * seed = sha256(quizId + slotStartIso + SERVER_SECRET) — SERVER_SECRET never leaves the server.
 * Fisher–Yates shuffle using HMAC-SHA256 stream; hint row uses a separate sha256(seed + "_hint") position.
 */
import crypto from 'crypto';

let warnedMissingQuizSecret = false;

function getQuizServerSecret() {
  const s = process.env.QUIZ_SERVER_SECRET || process.env.SERVER_SECRET;
  if (s && String(s).length >= 16) {
    return String(s);
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'QUIZ_SERVER_SECRET or SERVER_SECRET (min 16 characters) must be set for quiz fairness.',
    );
  }
  if (!warnedMissingQuizSecret) {
    // eslint-disable-next-line no-console
    console.warn(
      '[quiz] QUIZ_SERVER_SECRET / SERVER_SECRET not set (or too short). Using insecure dev default — set a strong secret in .env.',
    );
    warnedMissingQuizSecret = true;
  }
  return '__quiz_dev_placeholder_secret_min16__';
}

export function buildSeedHex(quizId, slotStartIso) {
  const payload = `${String(quizId)}${String(slotStartIso)}${getQuizServerSecret()}`;
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

/** Commitment: sha256(32-byte digest of seed) as hex — verify after reveal with same rule. */
export function buildSeedHashHex(seedHex) {
  const buf = Buffer.from(seedHex, 'hex');
  if (buf.length !== 32) {
    throw new Error('INVALID_SEED_HEX');
  }
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * Slot-local hint position in shuffled order (0–99), same for all users for this quiz+slot.
 * hintSeed = sha256(seedHex + "_hint")
 */
export function computeHintPosition(seedHex) {
  const hintSeedHex = crypto.createHash('sha256').update(`${seedHex}_hint`, 'utf8').digest('hex');
  const hintPosition = parseInt(hintSeedHex.slice(0, 8), 16) % 100;
  return { hintSeedHex, hintPosition };
}

/** Uniform int [0, max) from seed and counter (deterministic). */
function intFromSeed(seedHex, counter) {
  const buf = crypto.createHmac('sha256', seedHex).update(`k:${counter}`, 'utf8').digest();
  return buf.readUInt32BE(0);
}

/**
 * Fisher–Yates shuffle of [0,…,length-1] using crypto-derived ints.
 * @param {string} seedHex - 64 hex chars from SHA-256
 * @param {number} length - default 100
 */
export function seededShuffleIndices(seedHex, length = 100) {
  const arr = Array.from({ length }, (_, i) => i);
  let c = 0;
  for (let i = length - 1; i > 0; i -= 1) {
    const j = intFromSeed(seedHex, c++) % (i + 1);
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

/**
 * Walk shuffled order; return first index not in `banned` (recent picks).
 * If all are banned (pathological), returns shuffled[0].
 */
export function pickIndexAvoidingRecent(seedHex, banned, length = 100) {
  const shuffled = seededShuffleIndices(seedHex, length);
  const ban = new Set(banned);
  for (let i = 0; i < shuffled.length; i += 1) {
    if (!ban.has(shuffled[i])) return shuffled[i];
  }
  return shuffled[0];
}

/** Strip embedded (quiz-XX) index from question line for hint-only payload. */
export function stripQuestionMetaForHint(text) {
  return String(text || '').replace(/^प्रश्न\s*\(\d{1,2}-\d{2}\)\s*:\s*/u, 'प्रश्न: ');
}

/** Chosen index from existing shuffle seed (deterministic; no Math.random). */
export function computeChosenIndexFromSeed(seedHex, banned, length = 100) {
  return pickIndexAvoidingRecent(seedHex, banned, length);
}
