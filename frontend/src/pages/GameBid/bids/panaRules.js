// Shared Pana validation rules used across bid screens.

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

// Double Pana rules (copied from existing DoublePanaBid)
export const isValidDoublePana = (n) => {
  if (!n) return false;
  const str = n.toString().trim();
  if (!/^[0-9]{3}$/.test(str)) return false;

  const digits = str.split('').map(Number);
  const [first, second, third] = digits;

  // Two consecutive digits must be the same (positions 0-1 or 1-2)
  const hasConsecutiveSame = (first === second) || (second === third);
  if (!hasConsecutiveSame) return false;

  // Numbers starting with zero are not allowed (001-099)
  if (first === 0) return false;

  // Special case: Two zeros at the end are allowed (300, 900, 100)
  if (second === 0 && third === 0) return true;

  // Special case: Numbers ending with zero where first two digits are the same (220, 990, 880, 660)
  if (first === second && third === 0) return true;

  // For all other cases, last digit must be greater than first
  if (third <= first) return false;

  return true;
};

export const isValidTriplePana = (n) => {
  const s = (n ?? '').toString().trim();
  if (!/^[0-9]{3}$/.test(s)) return false;
  return s[0] === s[1] && s[1] === s[2]; // 000, 111, ... 999
};

export const isValidAnyPana = (n) =>
  isValidSinglePana(n) || isValidDoublePana(n) || isValidTriplePana(n);

