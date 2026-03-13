/**
 * Stress test: max drawdown, required reserve for a target ruin probability.
 */
import { runMonteCarlo } from '../engine/simulator.js';

/**
 * Run Monte Carlo with a bet profile; return maxDrawdown and optional requiredReserve for ruin probability &lt;= target.
 * @param {Array} bets
 * @param {number} numSpins
 * @param {number} targetRuinProb - e.g. 0.01 for 1%
 * @returns {{ maxDrawdown, totalProfit, winRate, requiredReserveForRuin01?: number }}
 */
export async function runLiquidityStress(bets, numSpins = 10000, targetRuinProb = 0.01) {
    const { maxDrawdown, totalProfit, winRate, cumulativeProfit } = runMonteCarlo(bets, numSpins);
    const minCumulative = Math.min(...cumulativeProfit);
    const requiredReserveForRuin01 = minCumulative < 0 ? Math.abs(minCumulative) : 0;
    return {
        maxDrawdown,
        totalProfit,
        winRate,
        requiredReserveForRuin01: requiredReserveForRuin01 > 0 ? Math.ceil(requiredReserveForRuin01 * (1 / targetRuinProb)) : 0,
    };
}
