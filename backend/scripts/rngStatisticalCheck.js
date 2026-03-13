/**
 * RNG statistical validation: chi-square uniformity, frequency test, run test.
 * Ensures distribution across 0-36 is statistically uniform (production-grade).
 */
import { spin } from '../engine/wheel.js';

const NUM_SAMPLES = 37000;
const NUM_BUCKETS = 37;

function chiSquareTest(counts, expected) {
    let chi2 = 0;
    for (let i = 0; i < NUM_BUCKETS; i++) {
        const d = counts[i] - expected;
        chi2 += (d * d) / expected;
    }
    return chi2;
}

function runTest(spinResults) {
    let runs = 0;
    let prev = -1;
    for (const n of spinResults) {
        if (n !== prev) runs++;
        prev = n;
    }
    const n = spinResults.length;
    const expectedRuns = 1 + (n - 1) * (NUM_BUCKETS - 1) / NUM_BUCKETS;
    const variance = (n - 1) * (NUM_BUCKETS - 1) * (NUM_BUCKETS * NUM_BUCKETS - 2 * NUM_BUCKETS + 2) / (NUM_BUCKETS * NUM_BUCKETS * NUM_BUCKETS);
    const z = (runs - expectedRuns) / Math.sqrt(variance || 1);
    return { runs, expectedRuns, z, pass: Math.abs(z) < 2.5 };
}

function runCheck() {
    const counts = Array(NUM_BUCKETS).fill(0);
    const spinResults = [];
    for (let i = 0; i < NUM_SAMPLES; i++) {
        const n = spin();
        if (n >= 0 && n < NUM_BUCKETS) {
            counts[n]++;
            spinResults.push(n);
        }
    }
    const expected = NUM_SAMPLES / NUM_BUCKETS;
    const chi2 = chiSquareTest(counts, expected);
    const critical36 = 52.0;
    const chiPass = chi2 < critical36;

    console.log('=== RNG Statistical Validation ===\n');
    console.log('1. Chi-square uniformity:', chi2.toFixed(2), 'Critical (0.05, df=36):', critical36, chiPass ? 'PASS' : 'FAIL');
    console.log('2. Frequency: min count', Math.min(...counts), 'max', Math.max(...counts), 'expected', expected.toFixed(0));

    const runResult = runTest(spinResults);
    console.log('3. Run test: runs', runResult.runs, 'expected', runResult.expectedRuns.toFixed(0), 'z', runResult.z.toFixed(2), runResult.pass ? 'PASS' : 'FAIL');

    console.log('\nAll tests:', (chiPass && runResult.pass) ? 'PASS' : 'REVIEW');
}

runCheck();
