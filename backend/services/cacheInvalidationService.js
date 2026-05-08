import { cacheDelByPrefix } from './cacheService.js';
import { emitAdminDashboardUpdate, emitAdminMarketUpdate } from '../socket/socketHub.js';

/**
 * Invalidate admin-facing read caches and notify live clients.
 * Keep this centralized so write endpoints stay small and consistent.
 */
export async function invalidateAdminReadCaches(reason = 'write') {
  await cacheDelByPrefix('dashboard:stats:');
  emitAdminDashboardUpdate({ reason });
  emitAdminMarketUpdate({ reason });
}
