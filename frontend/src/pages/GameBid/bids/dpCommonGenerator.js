<<<<<<< Updated upstream
import { VALID_DOUBLE_PANAS } from './panaRules';

const VALID_DOUBLE_PANA_LIST = Array.from(VALID_DOUBLE_PANAS);
const VALID_DOUBLE_PANA_SET = new Set(VALID_DOUBLE_PANA_LIST);

const normalizeInput = (input) => String(input ?? '').trim();

// Keep in sync with backend/utils/doublePattiUtils.js (isDoublePatti):
// valid only when 3 digits and exactly two are the same.
const isDoublePatti = (patti) => {
    const s = normalizeInput(patti);
    if (s.length !== 3 || !/^\d{3}$/.test(s)) return false;
    const a = s[0];
    const b = s[1];
    const c = s[2];
    return (a === b && b !== c) || (b === c && a !== b);
};

export const validateDigit = (digit) => {
    const normalized = normalizeInput(digit);
    if (!normalized) return { valid: false, message: 'Please enter a digit.' };
    if (normalized.length !== 1) return { valid: false, message: 'Only one digit is allowed.' };
    if (!/^[0-9]$/.test(normalized)) return { valid: false, message: 'Digit must be between 0 and 9.' };
    return { valid: true, message: '', digit: normalized };
};

const isValidDoublePanaFromList = (pana) => {
    const s = normalizeInput(pana);
    if (!isDoublePatti(s)) return false;
    return VALID_DOUBLE_PANA_SET.has(s);
};

export const generateDoublePanaForDigit = (digit, points) => {
    const safePoints = Number(points);
    if (!Number.isFinite(safePoints) || safePoints <= 0) {
        return { success: false, message: 'Points must be greater than 0.', data: [] };
    }

    const digitValidation = validateDigit(digit);
    if (!digitValidation.valid) {
        return { success: false, message: digitValidation.message, data: [] };
    }
    const d = digitValidation.digit;

    const results = VALID_DOUBLE_PANA_LIST
        .filter((pana) => isValidDoublePanaFromList(pana))
        // DP Common panel generation is digit-membership based (all pannas containing selected digit).
        .filter((pana) => pana.includes(d))
        .sort((a, b) => Number(a) - Number(b))
        .map((pana) => ({ pana, points: safePoints }));

    return { success: true, message: '', data: results };
};

export const generateDPCommon = ({ digit, points }) => generateDoublePanaForDigit(digit, points);
=======
import { isValidDoublePana } from './panaRules';

const normalizeDigit = (digit) => String(digit ?? '').trim();

/**
 * Validates a single digit 0–9 for DP Common generation.
 * @returns {{ valid: boolean, message?: string, digit?: string }}
 */
export const validateDigit = (digit) => {
    const d = normalizeDigit(digit);
    if (!d) return { valid: false, message: 'Please enter a digit.' };
    if (d.length !== 1) return { valid: false, message: 'Only one digit is allowed.' };
    if (!/^[0-9]$/.test(d)) return { valid: false, message: 'Digit must be between 0 and 9.' };
    return { valid: true, digit: d };
};

/**
 * All 3-digit double patti (double pana) numbers in 100–999 that contain the given digit.
 * Uses same rules as `isValidDoublePana` (consecutive pair, ordering, etc.).
 */
export function collectDoublePattisContainingDigit(digitChar) {
    const d = normalizeDigit(digitChar);
    if (!/^[0-9]$/.test(d)) return [];

    const out = [];
    for (let n = 100; n <= 999; n++) {
        const s = String(n);
        if (!isValidDoublePana(s)) continue;
        if (!s.includes(d)) continue;
        out.push(s);
    }
    out.sort((a, b) => Number(a) - Number(b));
    return out;
}

/**
 * @param {{ digit: string, points: number }} params
 * @returns {{ success: boolean, message: string, data: Array<{ pana: string, points: number }> }}
 */
export const generateDPCommon = ({ digit, points }) => {
    const pts = Number(points);
    if (!Number.isFinite(pts) || pts <= 0) {
        return { success: false, message: 'Points must be greater than 0.', data: [] };
    }

    const v = validateDigit(digit);
    if (!v.valid) {
        return { success: false, message: v.message || 'Invalid digit.', data: [] };
    }

    const panas = collectDoublePattisContainingDigit(v.digit);
    if (!panas.length) {
        return { success: false, message: 'No double panna matches for selected digit.', data: [] };
    }

    return {
        success: true,
        message: '',
        data: panas.map((pana) => ({ pana, points: pts })),
    };
};
>>>>>>> Stashed changes
