import Bet from '../models/bet/bet.js';
import Payment from '../models/payment/payment.js';
import Market from '../models/market/market.js';

let monitorTimer = null;
let lastSignature = '';

function buildSignature(snapshot) {
  return JSON.stringify(snapshot);
}

async function readRealtimeSignature() {
  const since = new Date(Date.now() - 20_000);
  const [recentBets, pendingPayments, pendingBets, pendingMarketResults] = await Promise.all([
    Bet.countDocuments({ createdAt: { $gte: since } }),
    Payment.countDocuments({ status: 'pending' }),
    Bet.countDocuments({ status: 'pending' }),
    Market.countDocuments({
      $or: [
        { openingNumber: { $in: [null, ''] } },
        { closingNumber: { $in: [null, ''] } },
      ],
    }),
  ]);
  return {
    recentBets,
    pendingPayments,
    pendingBets,
    pendingMarketResults,
    sampledAtBucket: Math.floor(Date.now() / 5000),
  };
}

export function startAdminRealtimeMonitor(onChange) {
  if (monitorTimer) return;
  monitorTimer = setInterval(async () => {
    try {
      const snapshot = await readRealtimeSignature();
      const sig = buildSignature(snapshot);
      if (sig === lastSignature) return;
      lastSignature = sig;
      onChange?.(snapshot);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[admin-realtime] monitor error', err?.message || String(err));
    }
  }, 5000);
}

export function stopAdminRealtimeMonitor() {
  if (!monitorTimer) return;
  clearInterval(monitorTimer);
  monitorTimer = null;
}
