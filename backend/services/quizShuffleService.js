/**
 * Single deterministic shuffle per (quizId, slotStartIso) — same seed as QuizSlotSeed / hint / result.
 * Fisher–Yates via randomService (no Math.random).
 */
import QuizSlotSeed from '../models/quiz/QuizSlotSeed.js';
import { buildSeedHex, seededShuffleIndices } from './randomService.js';

const CACHE_MS = 20 * 60 * 1000;
const CACHE_MAX = 250;
/** @type {Map<string, { at: number, order: number[] }>} */
const orderCache = new Map();

function cachePrune() {
  while (orderCache.size > CACHE_MAX) {
    const k = orderCache.keys().next().value;
    if (k === undefined) break;
    orderCache.delete(k);
  }
}

/** Canonical seed hex: DB row if present, else same formula as seed upsert (no write). */
async function getCanonicalSeedHex(quizId, slotStartIso, gameMode = '2d') {
  const row = await QuizSlotSeed.findOne({ gameMode, quizId, slotStartIso }).select('seed').lean();
  if (row?.seed) return row.seed;
  return buildSeedHex(quizId, slotStartIso, gameMode);
}

/** Synchronous shuffle from canonical 64-char seed hex (single source with DB seed). */
export function getShuffleOrderFromSeedHex(seedHex, length = 100) {
  return seededShuffleIndices(seedHex, length);
}

/**
 * Permutation indices for this quiz+slot (2D: 0..99, 3D: 0..999) —
 * order[i] is the original DB question index at shuffled position i.
 * @param {string} [seedHexIfKnown] — when already loaded (e.g. after ensureSlotSeed), avoids extra read.
 */
export async function getShuffleOrderIndices(quizId, slotStartIso, seedHexIfKnown = null, gameMode = '2d', length = 100) {
  const key = `${gameMode}|${quizId}|${slotStartIso}|len:${length}`;
  const hit = orderCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return hit.order;
  }

  const seedHex = seedHexIfKnown ?? (await getCanonicalSeedHex(quizId, slotStartIso, gameMode));
  const order = getShuffleOrderFromSeedHex(seedHex, length);
  orderCache.set(key, { at: Date.now(), order });
  cachePrune();

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      tag: '[quiz:shuffle]',
        gameMode,
      quizId,
      slotStartIso,
      first5Indices: order.slice(0, 5),
    }),
  );
  return order;
}

export function clearShuffleOrderCache() {
  orderCache.clear();
}
