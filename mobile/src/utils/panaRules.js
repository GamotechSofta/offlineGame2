// Shared pana validation (aligned with frontend panaRules.js).

const VALID_SINGLE_PANAS = new Set([
  '127','136','145','190','235','280','370','389','460','479','569','578',
  '128','137','146','236','245','290','380','470','489','560','579','678',
  '129','138','147','156','237','246','345','390','480','570','589','679',
  '120','139','148','157','238','247','256','346','490','580','670','689',
  '130','149','158','167','239','248','257','347','356','590','680','789',
  '140','159','168','230','249','258','267','348','357','456','690','780',
  '123','150','169','178','240','259','268','349','358','367','457','790',
  '124','133','142','151','160','179','250','278','340','359','467','890',
  '125','134','170','189','260','279','350','369','378','459','468','567',
  '126','135','180','234','270','289','360','379','450','469','478','568',
]);

export const isValidSinglePana = (n) => {
  const s = (n ?? '').toString().trim();
  if (!/^[0-9]{3}$/.test(s)) return false;
  return VALID_SINGLE_PANAS.has(s);
};

const TRIPLE_PERM_INDICES = [
  [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
];

export function generateSpMotorSinglePanas(digitStr) {
  const digits = [...new Set(String(digitStr ?? '').replace(/\D/g, '').split('').sort())];
  if (digits.length < 3) return [];
  const found = new Set();
  const n = digits.length;
  for (let i = 0; i < n - 2; i++) {
    for (let j = i + 1; j < n - 1; j++) {
      for (let k = j + 1; k < n; k++) {
        const t = [digits[i], digits[j], digits[k]];
        for (const [a, b, c] of TRIPLE_PERM_INDICES) {
          const pana = t[a] + t[b] + t[c];
          if (isValidSinglePana(pana)) found.add(pana);
        }
      }
    }
  }
  return [...found].sort((x, y) => Number(x) - Number(y));
}

/** SP / SP+DP Motor: digits 0–9, no duplicates, order preserved (max 10). */
export const sanitizeMotorDigitsUnique = (v, maxLen = 10) => {
  const raw = (v ?? '').toString().replace(/\D/g, '');
  const seen = new Set();
  let out = '';
  for (const ch of raw) {
    if (ch < '0' || ch > '9') continue;
    if (seen.has(ch)) continue;
    seen.add(ch);
    out += ch;
    if (out.length >= maxLen) break;
  }
  return out;
};
