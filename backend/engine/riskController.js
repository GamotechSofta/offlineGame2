/**
 * Production risk controller: dynamic bet limits from bankroll, reserve protection.
 * maxStraightBet = bankroll / bankrollDivisorStraight; when operational balance approaches reserve, reduce limits or freeze high-risk.
 */

/**
 * Compute dynamic bet limits from current bankroll and config.
 * @param {Object} config - RouletteConfig
 * @param {number} operationalBalance - Current house operational balance (e.g. HouseReserve.balance)
 * @param {number} houseBankroll - Configured house bankroll (e.g. houseReserve)
 * @returns {{ maxStraightBet: number, maxExposurePct: number, reserveLevel: 'ok'|'low'|'critical', limitsReduced: boolean }}
 */
export function getDynamicLimits(config, operationalBalance, houseBankroll) {
    const bankroll = Number(houseBankroll) || 1e9;
    const balance = Number(operationalBalance) ?? 0;
    const reserveRatio = config?.reserveRatio ?? 0.4;
    const reserveLevelAmount = bankroll * reserveRatio;
    const divisor = Math.max(1, config?.bankrollDivisorStraight ?? 500);

    let maxStraightBet = bankroll / divisor;
    let limitsReduced = false;

    if (reserveLevelAmount > 0 && balance < reserveLevelAmount * 1.2) {
        limitsReduced = true;
        maxStraightBet = Math.min(maxStraightBet, (balance - reserveLevelAmount * 0.5) / divisor);
        if (maxStraightBet < 0) maxStraightBet = 0;
    }

    let reserveLevel = 'ok';
    if (balance <= reserveLevelAmount * 0.5) reserveLevel = 'critical';
    else if (balance <= reserveLevelAmount) reserveLevel = 'low';

    const maxExposurePct = config?.maxExposurePctOfBankroll ?? 0.025;

    return {
        maxStraightBet: Math.max(0, Math.floor(maxStraightBet)),
        maxExposurePct,
        reserveLevel,
        limitsReduced,
    };
}

/**
 * Get effective max straight-up per number for exposure checks (from dynamic limits or config).
 */
export function getEffectiveMaxStraightUp(config, operationalBalance, houseBankroll) {
    const limits = getDynamicLimits(config, operationalBalance, houseBankroll);
    const fromConfig = config?.maxStraightUpPerNumber ?? 100000;
    if (limits.limitsReduced && limits.maxStraightBet >= 0) {
        return Math.min(fromConfig, limits.maxStraightBet * 36);
    }
    return fromConfig;
}
