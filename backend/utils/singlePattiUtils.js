/**
 * Single Patti utilities for validation and aggregation.
 *
 * Business meaning:
 * - Single Patti = 3-digit number with ALL UNIQUE digits (e.g. 102, 132, 849).
 * - Invalid: 111 (triple), 112, 121, 101 (any repeated digit).
 * - In the DB, these bets are stored as betType === 'panna' with betNumber as the 3-digit string.
 */

/**
 * Returns true only for 3-digit numbers with all unique digits.
 * Excludes 112, 121, 101, 111, etc.
 * @param {string|number} patti - 3-digit patti (e.g. "102", 132)
 * @returns {boolean}
 */
export function isSinglePatti(patti) {
    const s = String(patti ?? '').trim();
    if (s.length !== 3 || !/^\d{3}$/.test(s)) return false;
    const a = s[0], b = s[1], c = s[2];
    return a !== b && b !== c && a !== c;
}

/**
 * Builds a summary of Single Patti bets grouped by FIRST digit (0–9).
 * Used for the admin "Single Patti summary bar": each column = total amount and count
 * of all Single Pattis that START with that digit (e.g. column 3 = 301, 302, 304, …).
 *
 * Filters (SINGLE_PATTI in business terms = these two conditions):
 * - Only bets with type === 'panna' (schema: 3-digit patti bets; logically "SINGLE_PATTI" when valid).
 * - Only valid Single Pattis (all unique digits); invalid pattis (112, 121, 101, 111) are excluded.
 *
 * Data correctness: totalAmount and totalBets equal the sum of all bucket values; maxIndex = digit with highest amount.
 *
 * @param {Array<{ betType: string, betNumber: string, amount: number }>} bets - Raw bet documents (or lean objects)
 * @returns {{ buckets: Array<{ amount: number, count: number }>, maxIndex: number, totalAmount: number, totalBets: number }}
 */
export function buildSinglePattiFirstDigitSummary(bets) {
    const buckets = Array.from({ length: 10 }, () => ({ amount: 0, count: 0 }));

    for (const bet of bets || []) {
        const type = (bet.betType || '').toLowerCase();
        const num = (bet.betNumber || '').toString().trim();
        const amount = Number(bet.amount) || 0;

        // Only Single Patti: in schema = panna; must be valid 3-digit all-unique (excludes double/triple patti)
        if (type !== 'panna' || num.length !== 3 || !/^\d{3}$/.test(num)) continue;
        if (!isSinglePatti(num)) continue;

        const firstDigit = parseInt(num[0], 10);
        if (firstDigit < 0 || firstDigit > 9) continue;

        buckets[firstDigit].amount += amount;
        buckets[firstDigit].count += 1;
    }

    let totalAmount = 0;
    let totalBets = 0;
    let maxIndex = 0;
    let maxAmount = 0;

    for (let i = 0; i < 10; i++) {
        totalAmount += buckets[i].amount;
        totalBets += buckets[i].count;
        if (buckets[i].amount > maxAmount) {
            maxAmount = buckets[i].amount;
            maxIndex = i;
        }
    }

    return {
        buckets,
        maxIndex,
        totalAmount,
        totalBets,
    };
}
