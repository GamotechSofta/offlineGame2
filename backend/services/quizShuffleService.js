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
async function getCanonicalSeedHex(quizId, slotStartIso) {
  const row = await QuizSlotSeed.findOne({ quizId, slotStartIso }).select('seed').lean();
  if (row?.seed) return row.seed;
  return buildSeedHex(quizId, slotStartIso);
}

/** Synchronous shuffle from canonical 64-char seed hex (single source with DB seed). */
export function getShuffleOrderFromSeedHex(seedHex) {
  return seededShuffleIndices(seedHex, 100);
}

/**
 * Permutation indices [0..99] for this quiz+slot — order[i] is the original DB question index at shuffled position i.
 * @param {string} [seedHexIfKnown] — when already loaded (e.g. after ensureSlotSeed), avoids extra read.
 */
export async function getShuffleOrderIndices(quizId, slotStartIso, seedHexIfKnown = null) {
  const key = `${quizId}|${slotStartIso}`;
  const hit = orderCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return hit.order;
  }

  const seedHex = seedHexIfKnown ?? (await getCanonicalSeedHex(quizId, slotStartIso));
  const order = getShuffleOrderFromSeedHex(seedHex);
  orderCache.set(key, { at: Date.now(), order });
  cachePrune();

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      tag: '[quiz:shuffle]',
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
