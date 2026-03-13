/**
 * Production-grade payout engine: European roulette, all standard bet types.
 * House edge 1/37 (~2.7%). Flow: Spin → RNG → Evaluate Bets → Apply Payouts (no manipulation).
 */
import {
    isRed,
    isBlack,
    BET_TYPES,
    getNumbersCovered,
    getPayoutMultiplier,
    getMaxPayoutForBet,
    STREETS,
    SIX_LINES,
    DOZENS,
    COLUMNS,
} from './rouletteBets.js';
import { validSplitsSet as VALID_SPLITS, validCornersSet as VALID_CORNERS } from './rouletteBets.js';

// Re-export for exposure/validation
export { getNumbersCovered, getPayoutMultiplier, getMaxPayoutForBet };

function validateValue(bet) {
    const t = String(bet?.type || '').toLowerCase();
    const v = bet?.value;
    if (t === 'number') {
        const n = Number(v);
        return Number.isInteger(n) && n >= 0 && n <= 36;
    }
    if (t === 'split') {
        const arr = Array.isArray(v) ? v : (typeof v === 'string' && v.includes('-')) ? v.split('-').map(Number) : [];
        if (arr.length < 2) return false;
        const key = [Number(arr[0]), Number(arr[1])].sort((a, b) => a - b).join('-');
        return Number.isInteger(arr[0]) && Number.isInteger(arr[1]) && arr[0] >= 0 && arr[0] <= 36 && arr[1] >= 0 && arr[1] <= 36 && VALID_SPLITS.has(key);
    }
    if (t === 'street') {
        const idx = Number(v);
        return Number.isInteger(idx) && idx >= 1 && idx <= 12;
    }
    if (t === 'corner') {
        const arr = Array.isArray(v) ? v : (typeof v === 'string') ? v.split(/[-,]/).map(Number).filter(n => !Number.isNaN(n)) : [];
        if (arr.length < 4) return false;
        const key = arr.slice(0, 4).map(Number).sort((a, b) => a - b).join('-');
        return VALID_CORNERS.has(key);
    }
    if (t === 'sixline') {
        const idx = Number(v);
        return Number.isInteger(idx) && idx >= 0 && idx <= 10;
    }
    if (t === 'dozen') {
        const idx = Number(v);
        return Number.isInteger(idx) && idx >= 1 && idx <= 3;
    }
    if (t === 'column') {
        const idx = Number(v);
        return Number.isInteger(idx) && idx >= 1 && idx <= 3;
    }
    if (['red', 'black', 'odd', 'even', 'low', 'high'].includes(t)) return true;
    return false;
}

export function validateBets(bets) {
    if (!Array.isArray(bets) || bets.length === 0) return { valid: false, error: 'At least one bet is required' };
    for (const b of bets) {
        const t = String(b?.type || '').toLowerCase();
        if (!BET_TYPES.includes(t)) return { valid: false, error: `Invalid bet type: ${t}` };
        const amt = Number(b?.amount);
        if (!Number.isFinite(amt) || amt <= 0) return { valid: false, error: 'Positive amount required' };
        if (!validateValue(b)) return { valid: false, error: `Invalid value for bet type ${t}` };
    }
    return { valid: true };
}

function onePayout(bet, win) {
    const t = String(bet.type || '').toLowerCase();
    const a = Number(bet.amount) || 0;
    if (t === 'number') return Number(bet.value) === win ? a * 36 : 0;
    if (win === 0) {
        if (['red', 'black', 'odd', 'even', 'low', 'high'].includes(t)) return 0;
        if (['dozen', 'column', 'street', 'sixline', 'split', 'corner'].includes(t)) return 0;
        return 0;
    }
    if (t === 'red' && isRed(win)) return a * 2;
    if (t === 'black' && isBlack(win)) return a * 2;
    if (t === 'odd' && win % 2 === 1) return a * 2;
    if (t === 'even' && win % 2 === 0) return a * 2;
    if (t === 'low' && win >= 1 && win <= 18) return a * 2;
    if (t === 'high' && win >= 19 && win <= 36) return a * 2;
    if (t === 'dozen') {
        const idx = Number(bet.value);
        if (Number.isInteger(idx) && idx >= 1 && idx <= 3 && DOZENS[idx - 1].includes(win)) return a * 3;
        return 0;
    }
    if (t === 'column') {
        const idx = Number(bet.value);
        if (Number.isInteger(idx) && idx >= 1 && idx <= 3 && COLUMNS[idx - 1].includes(win)) return a * 3;
        return 0;
    }
    if (t === 'street') {
        const idx = Number(bet.value);
        if (Number.isInteger(idx) && idx >= 1 && idx <= 12 && STREETS[idx - 1].includes(win)) return a * 12;
        return 0;
    }
    if (t === 'sixline') {
        const idx = Number(bet.value);
        if (Number.isInteger(idx) && idx >= 0 && idx <= 10 && SIX_LINES[idx].includes(win)) return a * 6;
        return 0;
    }
    if (t === 'split') {
        const arr = Array.isArray(bet.value) ? bet.value : String(bet.value).split('-').map(Number);
        if (arr.length >= 2 && (arr[0] === win || arr[1] === win)) return a * 18;
        return 0;
    }
    if (t === 'corner') {
        const arr = Array.isArray(bet.value) ? bet.value : String(bet.value).split(/[-,]/).map(Number).filter(n => !Number.isNaN(n));
        if (arr.length >= 4 && arr.some(n => n === win)) return a * 9;
        return 0;
    }
    return 0;
}

export function calculatePayout(bets, winningNumber) {
    if (!Array.isArray(bets)) return 0;
    return bets.reduce((s, b) => s + onePayout(b, winningNumber), 0);
}

export function maxPayoutForBets(bets) {
    if (!Array.isArray(bets)) return 0;
    return bets.reduce((s, b) => s + getMaxPayoutForBet(b), 0);
}
