import { cacheDelByPrefix } from './cacheService.js';
import { emitAdminDashboardUpdate, emitAdminMarketUpdate, emitAdminPaymentsUpdate } from '../socket/socketHub.js';

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

/**
 * Dashboard/market cache bust + live events, plus **payments-only** socket for Payment Management
 * (avoids coupling payment refetches to unrelated admin:dashboard traffic).
 */
export async function invalidateAdminPaymentRelatedCaches(reason = 'payments') {
  await invalidateAdminReadCaches(reason);
  emitAdminPaymentsUpdate({ reason });
}
