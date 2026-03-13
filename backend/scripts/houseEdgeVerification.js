/**
 * House edge verification: run many spins and report HOUSE profit and effective edge.
 * Use this to confirm that with standard European roulette (no RNG manipulation),
 * the house earns ~2.7% of total wagered over the long run.
 *
 * Run from repo root: node backend/scripts/houseEdgeVerification.js
 */
import { runMonteCarlo } from '../engine/simulator.js';

const NUM_SPINS = 50000;
const BET_PROFILES = [
    { name: 'Even-money only (red)', bets: [{ type: 'red', amount: 10 }] },
    { name: 'Straight-up only (#17)', bets: [{ type: 'number', value: 17, amount: 10 }] },
    { name: 'Mixed (number + red)', bets: [{ type: 'number', value: 17, amount: 10 }, { type: 'red', amount: 50 }] },
];

const THEORETICAL_HOUSE_EDGE = 1 / 37;

console.log('=== House edge verification ===\n');
console.log('European roulette: 37 numbers (0-36). House edge = 1/37 ≈', (THEORETICAL_HOUSE_EDGE * 100).toFixed(2), '%\n');

for (const profile of BET_PROFILES) {
    const totalBetPerSpin = profile.bets.reduce((s, b) => s + (Number(b.amount) || 0), 0);
    const { totalProfit: playerProfit, results } = runMonteCarlo(profile.bets, NUM_SPINS);
    const totalWagered = NUM_SPINS * totalBetPerSpin;
    const totalPaid = results.reduce((s, r) => s + r.payout, 0);
    const houseProfit = totalWagered - totalPaid;
    const effectiveHouseEdgePct = totalWagered > 0 ? (houseProfit / totalWagered) * 100 : 0;

    console.log('Profile:', profile.name);
    console.log('  Spins:', NUM_SPINS, '| Total wagered:', totalWagered, '| Total paid to players:', totalPaid);
    console.log('  House profit:', houseProfit.toFixed(2), '| Effective house edge:', effectiveHouseEdgePct.toFixed(2) + '%');
    console.log('  (Player profit:', playerProfit.toFixed(2) + ')\n');
}

console.log('Conclusion: Effective house edge should be close to 2.7%. Short runs can deviate; 50k+ spins should converge.');
console.log('The house profits in production because of this mathematical edge—no outcome manipulation is used.');
