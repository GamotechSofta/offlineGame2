import { VALID_SINGLE_PANAS } from './panaRules';

const VALID_SINGLE_PANA_LIST = Array.from(VALID_SINGLE_PANAS);
const VALID_SINGLE_PANA_SET = new Set(VALID_SINGLE_PANA_LIST);

const normalizeInput = (input) => String(input ?? '').trim();

// Keep in sync with backend/utils/singlePattiUtils.js (isSinglePatti):
// valid only when 3 digits and all are unique.
const isSinglePatti = (patti) => {
    const s = normalizeInput(patti);
    if (s.length !== 3 || !/^\d{3}$/.test(s)) return false;
    const a = s[0];
    const b = s[1];
    const c = s[2];
    return a !== b && b !== c && a !== c;
};

export const validateDigit = (digit) => {
    const normalized = normalizeInput(digit);
    if (!normalized) return { valid: false, message: 'Please enter a digit.' };
    if (normalized.length !== 1) return { valid: false, message: 'Only one digit is allowed.' };
    if (!/^[0-9]$/.test(normalized)) return { valid: false, message: 'Digit must be between 0 and 9.' };
    return { valid: true, message: '', digit: normalized };
};

const isValidSinglePanaFromList = (pana) => {
    const s = normalizeInput(pana);
    if (!isSinglePatti(s)) return false;
    return VALID_SINGLE_PANA_SET.has(s);
};

export const generateSinglePanaForDigit = (digit, points) => {
    const safePoints = Number(points);
    if (!Number.isFinite(safePoints) || safePoints <= 0) {
        return { success: false, message: 'Points must be greater than 0.', data: [] };
    }

    const digitValidation = validateDigit(digit);
    if (!digitValidation.valid) {
        return { success: false, message: digitValidation.message, data: [] };
    }
    const d = digitValidation.digit;

    const results = VALID_SINGLE_PANA_LIST
        .filter((pana) => isValidSinglePanaFromList(pana))
        // Match backend first-digit grouping style for Single Patti summary.
        .filter((pana) => pana.startsWith(d))
        .sort((a, b) => Number(a) - Number(b))
        .map((pana) => ({ pana, points: safePoints }));

    return { success: true, message: '', data: results };
};

export const generateSPCommon = ({ digit, points }) => generateSinglePanaForDigit(digit, points);
