/**
 * Exposure checks: max payout vs reserve, per-number limits (numberExposure), liability cap, per-type limits.
 * Production: per-number exposure must not exceed bankroll × maxExposurePct (e.g. 2–3%).
 */
import { maxPayoutForBets } from './payout.js';
import { checkNumberExposure } from './numberExposure.js';

/**
 * Run exposure checks on bets.
 * @param {Array} bets
 * @param {Object} context { houseBankroll, riskFactor, tableLiabilityCap, currentTableLiability, maxStraightUpPerNumber, perBetTypeLimits, maxExposurePct, existingNumberExposure }
 * @returns {{ allowed: boolean, errors: string[] }}
 */
export function runExposureChecks(bets, context) {
    const errors = [];
    const maxPayout = maxPayoutForBets(bets);
    const {
        houseBankroll = 1e9,
        riskFactor = 0.1,
        tableLiabilityCap,
        currentTableLiability,
        maxStraightUpPerNumber,
        perBetTypeLimits,
        maxExposurePct = 0.025,
        existingNumberExposure = {},
    } = context || {};

    if (maxPayout > houseBankroll * riskFactor) {
        errors.push('Bet exposure exceeds house risk limit');
    }
    if (tableLiabilityCap != null && Number.isFinite(tableLiabilityCap) && (currentTableLiability || 0) + maxPayout > tableLiabilityCap) {
        errors.push('Table liability cap would be exceeded');
    }

    // Per-number exposure: no number's potential payout > bankroll × maxExposurePct (2–3%)
    const numberCheck = checkNumberExposure(bets, {
        bankroll: houseBankroll,
        maxExposurePct,
        existingNumberExposure,
    });
    if (!numberCheck.allowed) errors.push(...numberCheck.errors);

    // Per-number straight-up cap (legacy; inside bets also limited by numberExposure above)
    if (maxStraightUpPerNumber != null && Number.isFinite(maxStraightUpPerNumber)) {
        const straightUpByNumber = {};
        for (const b of bets || []) {
            if (String(b?.type || '').toLowerCase() === 'number') {
                const n = Number(b.value);
                if (Number.isInteger(n) && n >= 0 && n <= 36) {
                    straightUpByNumber[n] = (straightUpByNumber[n] || 0) + (Number(b.amount) || 0) * 36;
                }
            }
        }
        for (const [num, liability] of Object.entries(straightUpByNumber)) {
            if (liability > maxStraightUpPerNumber) {
                errors.push(`Straight-up exposure for number ${num} exceeds limit`);
            }
        }
    }

    if (perBetTypeLimits && typeof perBetTypeLimits === 'object') {
        const byType = {};
        for (const b of bets || []) {
            const t = String(b?.type || '').toLowerCase();
            byType[t] = (byType[t] || 0) + (Number(b.amount) || 0);
        }
        for (const [type, limit] of Object.entries(perBetTypeLimits)) {
            if (Number.isFinite(limit) && (byType[type] || 0) > limit) {
                errors.push(`Bet type "${type}" exceeds per-type limit`);
            }
        }
    }

    return {
        allowed: errors.length === 0,
        errors,
    };
}
