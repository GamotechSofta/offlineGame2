/**
 * Batch run roulette simulation using engine/simulator.
 */
import { runMonteCarlo } from '../engine/simulator.js';

const bets = [
    { type: 'number', value: 17, amount: 10 },
    { type: 'red', amount: 50 },
];
const numSpins = 5000;

const result = runMonteCarlo(bets, numSpins);
console.log('Spins:', numSpins);
console.log('Total profit:', result.totalProfit);
console.log('Win rate:', (result.winRate * 100).toFixed(2) + '%');
console.log('Max drawdown:', result.maxDrawdown);
