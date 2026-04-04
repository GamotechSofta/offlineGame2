import { VALID_SINGLE_PANAS, VALID_DOUBLE_PANAS } from '../../../utils/panaRules';

const SINGLE_LIST = Array.from(VALID_SINGLE_PANAS);
const DOUBLE_LIST = Array.from(VALID_DOUBLE_PANAS);

const normalizeInput = (input) => String(input ?? '').trim();

/**
 * CP (Common Pana): 1–2 digits. Chart single + double panas that contain every entered digit.
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

  const singles = SINGLE_LIST.filter((pana) => VALID_SINGLE_PANAS.has(pana)).filter((pana) =>
    required.every((ch) => pana.includes(ch))
  );
  const doubles = DOUBLE_LIST.filter((pana) => VALID_DOUBLE_PANAS.has(pana)).filter((pana) =>
    required.every((ch) => pana.includes(ch))
  );

  const byPana = new Map();
  for (const pana of singles) byPana.set(pana, safePoints);
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
