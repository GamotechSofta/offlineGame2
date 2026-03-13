/**
 * Monte Carlo simulator: run many spins with given bet profile to estimate variance, max drawdown, etc.
 */

import { spin } from './wheel.js';
import { calculatePayout } from './payout.js';

/**
 * Run a single spin simulation (RNG + payout).
 * @param {Array} bets
 * @returns {{ winningNumber: number, payout: number, profit: number }}
 */
export function runOneSpin(bets, totalBet) {
    const winningNumber = spin();
    const payout = calculatePayout(bets, winningNumber);
    const profit = payout - totalBet;
    return { winningNumber, payout, profit };
}

/**
 * Run many spins with the same bet profile; return results array.
 * @param {Array} bets
 * @param {number} numSpins
 * @returns {Array<{ winningNumber, payout, profit }>}
 */
export function runSpins(bets, numSpins) {
    const totalBet = bets.reduce((s, b) => s + (Number(b.amount) || 0), 0);
    const results = [];
    for (let i = 0; i < numSpins; i++) {
        results.push(runOneSpin(bets, totalBet));
    }
    return results;
}

/**
 * Run Monte Carlo: many spins, compute cumulative profit, max drawdown, win rate.
 * @param {Array} bets
 * @param {number} numSpins
 * @returns {{ results: Array, cumulativeProfit: number[], maxDrawdown: number, winRate: number, totalProfit: number }}
 */
export function runMonteCarlo(bets, numSpins) {
    const totalBet = bets.reduce((s, b) => s + (Number(b.amount) || 0), 0);
    const results = [];
    let cumulative = 0;
    const cumulativeProfit = [];
    let peak = 0;
    let maxDrawdown = 0;

    for (let i = 0; i < numSpins; i++) {
        const { winningNumber, payout, profit } = runOneSpin(bets, totalBet);
        results.push({ winningNumber, payout, profit });
        cumulative += profit;
        cumulativeProfit.push(cumulative);
        if (cumulative > peak) peak = cumulative;
        const dd = peak - cumulative;
        if (dd > maxDrawdown) maxDrawdown = dd;
    }

    const wins = results.filter((r) => r.profit > 0).length;
    return {
        results,
        cumulativeProfit,
        maxDrawdown,
        winRate: numSpins > 0 ? wins / numSpins : 0,
        totalProfit: cumulative,
    };
}
