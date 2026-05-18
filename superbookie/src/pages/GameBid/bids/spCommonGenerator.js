import { VALID_SINGLE_PANAS, VALID_DOUBLE_PANAS, isValidTriplePana } from '../panaRules';

const VALID_SINGLE_PANA_LIST = Array.from(VALID_SINGLE_PANAS);
const VALID_SINGLE_PANA_SET = new Set(VALID_SINGLE_PANA_LIST);
const VALID_DOUBLE_PANA_LIST = Array.from(VALID_DOUBLE_PANAS);

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

/**
 * CP (Common Pana): 1–2 digits. Lists chart single / double / (optionally) triple panas
 * that contain every entered digit. Flags control SP / DP / T / combinations.
 */
export const generateCPCommon = ({
    digitsInput,
    points,
    includeSingles = true,
    includeDoubles = true,
    includeTriples = false,
}) => {
    const safePoints = Number(points);
    if (!Number.isFinite(safePoints) || safePoints <= 0) {
        return { success: false, message: 'Points must be greater than 0.', data: [] };
    }

    const raw = normalizeInput(digitsInput).replace(/\D/g, '');
    if (raw.length < 1 || raw.length > 2) {
        return { success: false, message: 'Enter 1 or 2 digits (0–9).', data: [] };
    }
    if (raw.length === 2 && raw[0] === raw[1]) {
        return { success: false, message: 'For two digits, both must be different.', data: [] };
    }

    const required = [...raw];

    const singles = includeSingles
        ? VALID_SINGLE_PANA_LIST.filter((pana) => isValidSinglePanaFromList(pana)).filter((pana) =>
              required.every((ch) => pana.includes(ch))
          )
        : [];

    const doubles = includeDoubles
        ? VALID_DOUBLE_PANA_LIST.filter((pana) => VALID_DOUBLE_PANAS.has(pana)).filter((pana) =>
              required.every((ch) => pana.includes(ch))
          )
        : [];

    const byPana = new Map();
    for (const pana of singles) byPana.set(pana, safePoints);
    for (const pana of doubles) {
        if (!byPana.has(pana)) byPana.set(pana, safePoints);
    }

    if (includeTriples) {
        for (let d = 0; d <= 9; d += 1) {
            const pana = `${d}${d}${d}`;
            if (!isValidTriplePana(pana)) continue;
            // For triples, check if ANY of the required digits is in the pana (not ALL)
            if (!required.some((ch) => pana.includes(ch))) continue;
            if (!byPana.has(pana)) byPana.set(pana, safePoints);
        }
    }

    const results = [...byPana.entries()]
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([pana, pts]) => ({ pana, points: pts }));

    if (results.length === 0) {
        return {
            success: false,
            message: 'No chart panna (single / double / triple) contains those digits together for current filters.',
            data: [],
        };
    }

    return { success: true, message: '', data: results };
};

