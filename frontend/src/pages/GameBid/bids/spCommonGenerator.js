import { VALID_SINGLE_PANAS } from './panaRules';

const VALID_SINGLE_PANA_LIST = Array.from(VALID_SINGLE_PANAS);
const VALID_SINGLE_PANA_SET = new Set(VALID_SINGLE_PANA_LIST);

export const normalizeInput = (input) => String(input ?? '').trim();

export const validateDigit = (digit) => {
    const normalized = normalizeInput(digit);
    if (!normalized) return { valid: false, message: 'Please enter a digit.' };
    if (normalized.length !== 1) return { valid: false, message: 'Only one digit is allowed.' };
    if (!/^[0-9]$/.test(normalized)) return { valid: false, message: 'Digit must be between 0 and 9.' };
    return { valid: true, message: '', digit: normalized };
};

const isValidSinglePanaFromList = (pana) => {
    const s = normalizeInput(pana);
    if (!/^\d{3}$/.test(s)) return false;
    if (s[0] === '0') return false;
    if (new Set(s.split('')).size !== 3) return false;
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
        .filter((pana) => pana.includes(d))
        .sort((a, b) => Number(a) - Number(b))
        .map((pana) => ({ pana, points: safePoints }));

    return { success: true, message: '', data: results };
};

export const generateSPCommon = ({ digit, points }) => {
    return generateSinglePanaForDigit(digit, points);
};

