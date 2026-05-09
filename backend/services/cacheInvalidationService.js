import { cacheDelByPrefix } from './cacheService.js';
import { emitAdminDashboardUpdate, emitAdminMarketUpdate } from '../socket/socketHub.js';

export const QUIZ_PUBLIC_LAST_SLOT_RESULTS_PREFIX = 'quiz:slot-results:last:';

/** Bust cached `GET /quiz/slot-results?limit=1` responses after a draw is declared (avoid stale banners). */
export async function bustQuizPublicLastSlotResultsCaches() {
  await cacheDelByPrefix(QUIZ_PUBLIC_LAST_SLOT_RESULTS_PREFIX);
}

/**
 * Invalidate admin-facing read caches and notify live clients.
 * Keep this centralized so write endpoints stay small and consistent.
 */
export async function invalidateAdminReadCaches(reason = 'write') {
  await cacheDelByPrefix('dashboard:stats:');
  emitAdminDashboardUpdate({ reason });
  emitAdminMarketUpdate({ reason });
}
