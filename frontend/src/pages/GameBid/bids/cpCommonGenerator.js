import { VALID_SINGLE_PANAS, VALID_DOUBLE_PANAS } from './panaRules';

const VALID_SINGLE_PANA_LIST = Array.from(VALID_SINGLE_PANAS);
const VALID_SINGLE_PANA_SET = new Set(VALID_SINGLE_PANA_LIST);
const VALID_DOUBLE_PANA_LIST = Array.from(VALID_DOUBLE_PANAS);

const normalizeInput = (input) => String(input ?? '').trim();

// Keep in sync with backend/utils/singlePattiUtils.js (isSinglePatti)
const isSinglePatti = (patti) => {
    const s = normalizeInput(patti);
    if (s.length !== 3 || !/^\d{3}$/.test(s)) return false;
    const a = s[0];
    const b = s[1];
    const c = s[2];
    return a !== b && b !== c && a !== c;
};

const isValidSinglePanaFromList = (pana) => {
    const s = normalizeInput(pana);
    if (!isSinglePatti(s)) return false;
    return VALID_SINGLE_PANA_SET.has(s);
};

/**
 * CP (Common Pana): 1–2 digits. Lists chart single panas + chart double panas that contain every entered digit.
 */
export const generateCPCommon = ({ digitsInput, points }) => {
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

    const singles = VALID_SINGLE_PANA_LIST.filter((pana) => isValidSinglePanaFromList(pana)).filter((pana) =>
        required.every((ch) => pana.includes(ch))
    );

    const doubles = VALID_DOUBLE_PANA_LIST.filter((pana) => VALID_DOUBLE_PANAS.has(pana)).filter((pana) =>
        required.every((ch) => pana.includes(ch))
    );

    const byPana = new Map();
    for (const pana of singles) {
        byPana.set(pana, safePoints);
    }
    for (const pana of doubles) {
        if (!byPana.has(pana)) byPana.set(pana, safePoints);
    }

    const results = [...byPana.entries()]
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([pana, pts]) => ({ pana, points: pts }));

    if (results.length === 0) {
        return {
            success: false,
            message: 'No chart single or double panna contains those digits together.',
            data: [],
        };
    }

    return { success: true, message: '', data: results };
};
