/**
 * Short-lived caches for hot quiz paths (slot context + locked pick per slot).
 */
import { getSlotContext } from './slotService.js';
import { clearShuffleOrderCache } from './quizShuffleService.js';

const SLOT_CACHE_MS = 1500;
const PICK_CACHE_MS = 60_000;
const PICK_CACHE_MAX = 80;

/** @type {Map<string, { at: number, ctx: object|null }>} */
const slotCacheByMode = new Map();
/** @type {Map<string, { at: number, pick: object }>} */
const pickCache = new Map();

export function clearPickCache() {
  pickCache.clear();
}

export function getCachedSlotContext(now = new Date(), gameMode = '2d') {
  const mode = String(gameMode || '2d').toLowerCase() === '3d' ? '3d' : '2d';
  const t = Date.now();
  const fresh = getSlotContext(now, mode);
  const slotCache = slotCacheByMode.get(mode) || { at: 0, ctx: null };

  if (t - slotCache.at < SLOT_CACHE_MS && slotCache.ctx) {
    if (slotCache.ctx.slotStartIso !== fresh.slotStartIso) {
      clearPickCache();
      clearShuffleOrderCache();
      slotCacheByMode.set(mode, { at: t, ctx: fresh });
      return fresh;
    }
    return slotCache.ctx;
  }

  const prev = slotCache.ctx?.slotStartIso;
  if (prev && prev !== fresh.slotStartIso) {
    clearPickCache();
    clearShuffleOrderCache();
  }
  slotCacheByMode.set(mode, { at: t, ctx: fresh });
  return fresh;
}

function prunePickCache() {
  const t = Date.now();
  for (const [k, v] of pickCache.entries()) {
    if (t - v.at > PICK_CACHE_MS) pickCache.delete(k);
  }
  while (pickCache.size > PICK_CACHE_MAX) {
    const first = pickCache.keys().next().value;
    if (first !== undefined) pickCache.delete(first);
    else break;
  }
}

export function getCachedPick(quizId, slotStartIso, gameMode = '2d') {
  const key = `${String(gameMode || '2d').toLowerCase()}|${quizId}|${slotStartIso}`;
  const row = pickCache.get(key);
  if (!row) return null;
  if (Date.now() - row.at > PICK_CACHE_MS) {
    pickCache.delete(key);
    return null;
  }
  return row.pick;
}

/** @param {object} pick - plain or mongoose doc (serialized fields used by API) */
export function setCachedPick(quizId, slotStartIso, pick, gameMode = '2d') {
  const key = `${String(gameMode || '2d').toLowerCase()}|${quizId}|${slotStartIso}`;
  const plain = pick?.toObject?.() ?? pick;
  pickCache.set(key, { at: Date.now(), pick: plain });
  prunePickCache();
}

export function invalidateSlotCache() {
  slotCacheByMode.clear();
  clearPickCache();
  clearShuffleOrderCache();
}
