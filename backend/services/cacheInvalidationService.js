import { cacheDelByPrefix } from './cacheService.js';
import { emitAdminDashboardUpdate, emitAdminMarketUpdate, emitAdminPaymentsUpdate } from '../socket/socketHub.js';
import { emitBookiePanelPaymentsUpdate } from '../socket/bookiePanelSocketBridge.js';

function collectPaymentPanelAdminIds(payment, { actorId, ownerOperator } = {}) {
    const ids = new Set();
    const add = (id) => {
        if (id) ids.add(String(id));
    };
    add(actorId);
    add(ownerOperator?._id);
    const chain = payment?.userId?.referrerChain;
    add(chain?.bookie?._id);
    add(chain?.superBookie?._id);
    const ref = payment?.userId?.referredBy;
    add(ref?._id ?? ref);
    if (chain?.superBookie?._id) add(chain.superBookie._id);
    else if (chain?.bookie?._id) add(chain.bookie._id);
    return [...ids];
}

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
/**
 * @param {string} reason
 * @param {{ payment?: object, actorId?: string, ownerOperator?: object }} [options]
 */
export async function invalidateAdminPaymentRelatedCaches(reason = 'payments', options = null) {
  await invalidateAdminReadCaches(reason);
  const payment = options?.payment;
  const patch = payment?._id
    ? {
        paymentId: String(payment._id),
        status: payment.status,
        adminRemarks: payment.adminRemarks,
        processedAt: payment.processedAt,
      }
    : {};
  emitAdminPaymentsUpdate({ reason, ...patch });
  if (payment?._id && payment?.status) {
    emitBookiePanelPaymentsUpdate({
      adminIds: collectPaymentPanelAdminIds(payment, {
        actorId: options?.actorId,
        ownerOperator: options?.ownerOperator,
      }),
      ...patch,
      reason,
    });
  }
}
