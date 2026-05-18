// Shared Pana validation rules - copied from frontend

// Valid Single Panna set (as per chart/screenshots)
export const VALID_SINGLE_PANAS = new Set([
  // sum=0
  '127','136','145','190','235','280','370','389','460','479','569','578',
  // sum=1
  '128','137','146','236','245','290','380','470','489','560','579','678',
  // sum=2
  '129','138','147','156','237','246','345','390','480','570','589','679',
  // sum=3
  '120','139','148','157','238','247','256','346','490','580','670','689',
  // sum=4
  '130','149','158','167','239','248','257','347','356','590','680','789',
  // sum=5
  '140','159','168','230','249','258','267','348','357','456','690','780',
  // sum=6
  '123','150','169','178','240','259','268','349','358','367','457','790',
  // sum=7
  '124','133','142','151','160','179','250','278','340','359','467','890',
  // sum=8
  '125','134','170','189','260','279','350','369','378','459','468','567',
  // sum=9
  '126','135','180','234','270','289','360','379','450','469','478','568',
]);

export const isValidSinglePana = (n) => {
  const s = (n ?? '').toString().trim();
  if (!/^[0-9]{3}$/.test(s)) return false;
  return VALID_SINGLE_PANAS.has(s);
};

// Chart double panna list (aligned with frontend panaRules / DP Common pool)
export const VALID_DOUBLE_PANAS = new Set([
  '100', '110', '112', '113', '114', '115', '116', '117', '118', '119',
  '122', '133', '144', '155', '166', '177', '188', '199', '200', '220',
  '223', '224', '225', '226', '227', '228', '229', '233', '244', '255',
  '266', '277', '288', '299', '300', '330', '334', '335', '336', '337',
  '338', '339', '344', '355', '366', '377', '388', '399', '400', '440',
  '445', '446', '447', '448', '449', '455', '466', '477', '488', '499',
  '500', '550', '556', '557', '558', '559', '566', '577', '588', '599',
  '600', '660', '667', '668', '669', '677', '688', '699', '700', '770',
  '778', '779', '788', '799', '800', '880', '889', '899', '900', '990',
]);

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

export const isValidDoublePana = (n) => {
  if (!n) return false;
  const str = n.toString().trim();
  if (!/^[0-9]{3}$/.test(str)) return false;
  const digits = str.split('').map(Number);
  const [first, second, third] = digits;
  const hasConsecutiveSame = (first === second) || (second === third);
  if (!hasConsecutiveSame) return false;
  if (first === 0) return false;
  if (second === 0 && third === 0) return true;
  if (first === second && third === 0) return true;
  if (third <= first) return false;
  return true;
};

export const isValidTriplePana = (n) => {
  const s = (n ?? '').toString().trim();
  if (!/^[0-9]{3}$/.test(s)) return false;
  return s[0] === s[1] && s[1] === s[2];
};

export const isValidAnyPana = (n) =>
  isValidSinglePana(n) || isValidDoublePana(n) || isValidTriplePana(n);

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
