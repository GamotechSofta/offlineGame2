/**
 * Validate roulette spin body: userId, bets array, optional idempotencyKey.
 */
export function validateRouletteSpin(req, res, next) {
    const userId = req.userId || req.body?.userId;
    const bets = req.body?.bets;
    if (!userId) {
        return res.status(400).json({ success: false, message: 'userId is required' });
    }
    if (!Array.isArray(bets) || bets.length === 0) {
        return res.status(400).json({ success: false, message: 'bets array with at least one bet is required' });
    }
    const idempotencyKey = req.body?.idempotencyKey;
    if (idempotencyKey != null && typeof idempotencyKey !== 'string') {
        return res.status(400).json({ success: false, message: 'idempotencyKey must be a string' });
    }
    next();
}
