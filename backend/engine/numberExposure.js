/**
 * Production exposure: per-number potential payout (numberExposure).
 * Used for: reject bet if potential payout > bankroll × maxExposurePct (e.g. 2–3%).
 * Multi-player: pass existing numberExposure from aggregated pending bets; new bets add on top.
 */
import { getNumbersCovered, getMaxPayoutForBet } from './payout.js';

/**
 * Build numberExposure map: for each number 0–36, sum of potential payout from bets that cover it.
 * @param {Array} bets - Array of bet objects
 * @param {Object} [existingExposure] - Optional { 0: number, 1: number, ... } from other pending bets
 * @returns {{ numberExposure: Object, totalMaxPayout: number }}
 */
export function buildNumberExposure(bets, existingExposure = {}) {
    const numberExposure = { ...existingExposure };
    for (let n = 0; n <= 36; n++) {
        if (numberExposure[n] == null) numberExposure[n] = 0;
    }
    let totalMaxPayout = 0;

    for (const b of bets || []) {
        const maxPayout = getMaxPayoutForBet(b);
        totalMaxPayout += maxPayout;
        const numbers = getNumbersCovered(b);
        if (numbers.length > 0) {
            for (const n of numbers) {
                numberExposure[n] = (numberExposure[n] || 0) + maxPayout;
            }
        }
    }

    return { numberExposure, totalMaxPayout };
}

/**
 * Check if adding these bets would exceed max allowed exposure per number (e.g. 2–3% of bankroll).
 * @param {Array} bets
 * @param {Object} context - { bankroll, maxExposurePct (0.02–0.03), existingNumberExposure? }
 * @returns {{ allowed: boolean, errors: string[] }}
 */
export function checkNumberExposure(bets, context) {
    const { bankroll = 1e9, maxExposurePct = 0.025, existingNumberExposure = {} } = context || {};
    const maxPerNumber = Number(bankroll) * Number(maxExposurePct);
    const errors = [];
    const { numberExposure } = buildNumberExposure(bets, existingNumberExposure);

    for (let n = 0; n <= 36; n++) {
        const exposure = numberExposure[n] || 0;
        if (exposure > maxPerNumber) {
            errors.push(`Exposure for number ${n} (${exposure.toFixed(0)}) exceeds ${(maxExposurePct * 100)}% of bankroll (max ${maxPerNumber.toFixed(0)})`);
        }
    }
    return {
        allowed: errors.length === 0,
        errors,
        numberExposure,
    };
}
