/**
 * Anti-abuse and fraud detection for roulette.
 * - Rate limit: enforced in spinService (2s cooldown per user).
 * - Last-millisecond bet: not applicable (no shared spin clock; each user spins independently).
 * - Bot detection: flag if same user sends very high spin rate over a window (e.g. >30/min).
 * - Coordinated betting: can be detected by correlating bet patterns across users (analytics).
 * - Latency exploitation: server always resolves RNG after bet acceptance; no client timing.
 */
const spinsPerUser = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_SPINS_PER_WINDOW = 45;

function pruneOld(userId, now) {
    const arr = spinsPerUser.get(userId);
    if (!arr) return;
    const cut = now - WINDOW_MS;
    while (arr.length && arr[0] < cut) arr.shift();
    if (arr.length === 0) spinsPerUser.delete(userId);
}

/**
 * Record a spin for the user (call from spinService after accepting spin).
 */
export function recordSpinForUser(userId) {
    const now = Date.now();
    if (!spinsPerUser.has(userId)) spinsPerUser.set(userId, []);
    spinsPerUser.get(userId).push(now);
    pruneOld(userId, now);
}

/**
 * Check if user is over spin rate limit (e.g. bot). Call before processing spin.
 * Returns { allowed: boolean, message?: string }.
 */
export function checkSpinRateLimit(userId) {
    const now = Date.now();
    pruneOld(userId, now);
    const arr = spinsPerUser.get(userId) || [];
    if (arr.length >= MAX_SPINS_PER_WINDOW) {
        return { allowed: false, message: 'Too many spins in a short period. Please slow down.' };
    }
    return { allowed: true };
}

/**
 * Middleware: optional spin rate check. Use after verifyUser.
 * Does not block by default; set ROULETTE_ANTIABUSE_STRICT=1 to enable blocking.
 */
export function rouletteAntiAbuse(req, res, next) {
    const userId = req.userId || req.body?.userId;
    if (!userId) return next();
    const result = checkSpinRateLimit(userId);
    if (!result.allowed && process.env.ROULETTE_ANTIABUSE_STRICT === '1') {
        return res.status(429).json({ success: false, message: result.message, code: 'RATE_LIMIT' });
    }
    next();
}
