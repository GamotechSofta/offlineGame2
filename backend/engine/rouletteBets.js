/**
 * European roulette bet type definitions: number coverage and payout multipliers.
 * House edge 1/37 (~2.7%) is preserved for all bet types.
 * Payout = stake × (multiplier + 1) i.e. return includes stake.
 */
export const RED = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

export const STREETS = [
    [1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12], [13, 14, 15], [16, 17, 18],
    [19, 20, 21], [22, 23, 24], [25, 26, 27], [28, 29, 30], [31, 32, 33], [34, 35, 36],
];
export const SIX_LINES = [
    [1, 2, 3, 4, 5, 6], [4, 5, 6, 7, 8, 9], [7, 8, 9, 10, 11, 12], [10, 11, 12, 13, 14, 15],
    [13, 14, 15, 16, 17, 18], [16, 17, 18, 19, 20, 21], [19, 20, 21, 22, 23, 24], [22, 23, 24, 25, 26, 27],
    [25, 26, 27, 28, 29, 30], [28, 29, 30, 31, 32, 33], [31, 32, 33, 34, 35, 36],
];
export const DOZENS = [
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
    [25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36],
];
export const COLUMNS = [
    [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
    [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
    [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
];

// Valid split pairs (adjacent on layout): 0 with 1,2,3; same row (n, n+1); same column (n, n+3)
function buildValidSplits() {
    const set = new Set();
    const add = (a, b) => set.add(a < b ? `${a}-${b}` : `${b}-${a}`);
    add(0, 1); add(0, 2); add(0, 3);
    for (let row = 0; row < 12; row++) {
        const base = row * 3 + 1;
        add(base, base + 1); add(base, base + 4);   // 1-2, 1-4
        add(base + 1, base + 2); add(base + 1, base + 4); add(base + 1, base + 5); // 2-3, 2-4, 2-5
        add(base + 2, base + 5); add(base + 2, base + 6); // 3-5, 3-6
        if (row < 11) add(base + 3, base + 4); add(base + 4, base + 5); add(base + 5, base + 6);
    }
    return set;
}
const VALID_SPLITS = buildValidSplits();
export const validSplitsSet = VALID_SPLITS;

// Valid corners: 2x2 blocks on the layout
function buildValidCorners() {
    const set = new Set();
    for (let row = 0; row < 11; row++) {
        const a = row * 3 + 1, b = a + 1, c = a + 3, d = a + 4;
        set.add([a, b, c, d].sort((x, y) => x - y).join('-'));
    }
    return set;
}
const VALID_CORNERS = buildValidCorners();
export const validCornersSet = VALID_CORNERS;

export function isRed(n) { return n >= 1 && n <= 36 && RED.includes(n); }
export function isBlack(n) { return n >= 1 && n <= 36 && !RED.includes(n); }

export const BET_TYPES = [
    'number', 'split', 'street', 'corner', 'sixline', 'dozen', 'column',
    'red', 'black', 'odd', 'even', 'low', 'high',
];

/** Payout multiplier (return = amount * (mult + 1), i.e. mult 35 means 35:1 so return 36x) */
export const PAYOUT_MULTIPLIER = {
    number: 35,   // 35:1 → return 36x
    split: 17,    // 17:1 → 18x
    street: 11,   // 11:1 → 12x
    corner: 8,    // 8:1 → 9x
    sixline: 5,   // 5:1 → 6x
    dozen: 2,     // 2:1 → 3x
    column: 2,    // 2:1 → 3x
    red: 1, black: 1, odd: 1, even: 1, low: 1, high: 1,
};

/** Get numbers covered by a bet (for exposure by number). Empty for even-money (handled by type). */
export function getNumbersCovered(bet) {
    const t = String(bet?.type || '').toLowerCase();
    const v = bet?.value;
    if (t === 'number') {
        const n = Number(v);
        return Number.isInteger(n) && n >= 0 && n <= 36 ? [n] : [];
    }
    if (t === 'split') {
        const arr = Array.isArray(v) ? v : (typeof v === 'string' && v.includes('-')) ? v.split('-').map(Number) : [Number(v)];
        if (arr.length >= 2 && arr.every(n => Number.isInteger(n) && n >= 0 && n <= 36)) {
            const key = arr.slice(0, 2).sort((a, b) => a - b).join('-');
            return VALID_SPLITS.has(key) ? arr.slice(0, 2) : [];
        }
        return [];
    }
    if (t === 'street') {
        const idx = Number(v);
        if (Number.isInteger(idx) && idx >= 1 && idx <= 12) return STREETS[idx - 1].slice();
        return [];
    }
    if (t === 'corner') {
        const arr = Array.isArray(v) ? v : (typeof v === 'string') ? v.split(/[-,]/).map(Number).filter(n => !Number.isNaN(n)) : [];
        if (arr.length >= 4) {
            const key = arr.slice(0, 4).sort((a, b) => a - b).join('-');
            return VALID_CORNERS.has(key) ? arr.slice(0, 4) : [];
        }
        return [];
    }
    if (t === 'sixline') {
        const idx = Number(v);
        if (Number.isInteger(idx) && idx >= 0 && idx <= 10) return SIX_LINES[idx].slice();
        return [];
    }
    if (t === 'dozen') {
        const idx = Number(v);
        if (Number.isInteger(idx) && idx >= 1 && idx <= 3) return DOZENS[idx - 1].slice();
        return [];
    }
    if (t === 'column') {
        const idx = Number(v);
        if (Number.isInteger(idx) && idx >= 1 && idx <= 3) return COLUMNS[idx - 1].slice();
        return [];
    }
    return [];
}

export function getPayoutMultiplier(bet) {
    const t = String(bet?.type || '').toLowerCase();
    return PAYOUT_MULTIPLIER[t] ?? 0;
}

/** Max payout for a single bet (stake * (mult + 1)). */
export function getMaxPayoutForBet(bet) {
    const amt = Number(bet?.amount) || 0;
    const mult = getPayoutMultiplier(bet);
    return amt * (mult + 1);
}
