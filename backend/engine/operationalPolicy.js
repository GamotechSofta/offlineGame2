/**
 * Operational policy: reserve thresholds, freeze high-risk, exposure check.
 * Rejects the current bet (before spin) when exposure exceeds limit; does not halt the table globally.
 * @param {Object} config - RouletteConfig
 * @param {number} reserveBalance - Current HouseReserve balance
 * @param {number} maxPayoutThisSpin - Max possible payout for this spin
 */
export function getOperationalPolicyState(config, reserveBalance, maxPayoutThisSpin) {
    const state = {
        tableHalted: false,
        reason: null,
        highRiskFrozen: false,
        effectiveMaxStraightUpPerNumber: config?.maxStraightUpPerNumber ?? 100000,
    };
    const reserve = Number(reserveBalance) || 0;
    const haltThreshold = config?.reserveHaltThreshold ?? 0;
    const freezeThreshold = config?.highRiskFreezeThreshold ?? 0;
    // Only halt table when explicitly configured (haltThreshold > 0) and reserve is at or below it
    if (haltThreshold > 0 && reserve <= haltThreshold) {
        state.tableHalted = true;
        state.reason = 'Table temporarily unavailable';
        return state;
    }
    if (reserve <= freezeThreshold) state.highRiskFrozen = true;

    // Casino-style exposure: reject THIS bet if max payout exceeds reserve * multiplier (before spin; spin engine is never blocked)
    const minReserveRequired = config?.minReserveRequired ?? 1000;
    const exposureMultiplier = config?.exposureMultiplier ?? 5;
    const reserveForCheck = Math.max(reserve, minReserveRequired);
    if (maxPayoutThisSpin > reserveForCheck * exposureMultiplier) {
        state.tableHalted = true;
        state.reason = 'Bet exceeds maximum allowed for current reserve';
        return state;
    }

    if (state.highRiskFrozen && config?.reducedStraightUpLimit != null) {
        state.effectiveMaxStraightUpPerNumber = config.reducedStraightUpLimit;
    }
    return state;
}
