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