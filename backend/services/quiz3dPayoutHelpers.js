/**
 * 3D quiz bet evaluation + payout multipliers — matches frontend helpers (threeD/helpers.js).
 * Multipliers loaded from Rate collection keys quiz3d_* with legacy quiz3d fallback.
 */

const pad3 = (n) =>
  String(n ?? '')
    .replace(/\D/g, '')
    .slice(-3)
    .padStart(3, '0');

export const hasTwoSameDigits = (num) => new Set(String(num).split('')).size === 2;
export const hasAllSameDigits = (num) => new Set(String(num).split('')).size === 1;
export const hasAllUniqueDigits = (num) => new Set(String(num).split('')).size === 3;

const digitsSignature = (num) => String(num).split('').sort().join('');
export const getBoxTypeFromNum = (num) => {
  if (hasAllSameDigits(num)) return '1-way';
  if (hasAllUniqueDigits(num)) return '6-way';
  if (hasTwoSameDigits(num)) return '3-way';
  return null;
};

const normalizeStoredMode = (modeRaw) => {
  const m = String(modeRaw || '').trim().toLowerCase();
  if (m === 'single') return 'str';
  if (m === 'straight') return 'str';
  if (m === 'duplicate' || m === 'dup') return 'duplicates';
  if (m === 'dp') return 'duplicates';
  if (m === 'triple') return 'triples';
  if (m === 'tp') return 'triples';
  return m;
};

/**
 * @returns {{ matched: boolean, boxType?: string|null, reason?: string }}
 */
export function evaluate3DBetAgainstResult(betModeRaw, betNumRaw, resultNumRaw) {
  const mode = normalizeStoredMode(betModeRaw);
  const betNum = pad3(betNumRaw);
  const resultNum = pad3(resultNumRaw);
  if (!/^\d{3}$/.test(betNum)) return { matched: false, boxType: null, reason: 'invalid bet' };
  if (!/^\d{3}$/.test(resultNum)) return { matched: false, boxType: null, reason: 'invalid result' };

  const frontPair = betNum[0] === resultNum[0] && betNum[1] === resultNum[1];
  const backPair = betNum[1] === resultNum[1] && betNum[2] === resultNum[2];
  const splitPair = betNum[0] === resultNum[0] && betNum[2] === resultNum[2];

  if (mode === 'str') {
    const matched = betNum === resultNum;
    return { matched, boxType: null };
  }
  if (mode === 'box') {
    const boxType = getBoxTypeFromNum(betNum);
    if (!boxType) return { matched: false, boxType: null };
    const matched = digitsSignature(betNum) === digitsSignature(resultNum);
    return { matched, boxType };
  }
  if (mode === 'fp') return { matched: frontPair, boxType: null };
  if (mode === 'bp') return { matched: backPair, boxType: null };
  if (mode === 'sp') return { matched: splitPair, boxType: null };
  if (mode === 'ap') {
    return { matched: frontPair || backPair || splitPair, boxType: null };
  }
  if (mode === 'duplicates') {
    if (!hasTwoSameDigits(betNum)) return { matched: false, boxType: null };
    return { matched: betNum === resultNum, boxType: null };
  }
  if (mode === 'triples') {
    if (!hasAllSameDigits(betNum)) return { matched: false, boxType: null };
    return { matched: betNum === resultNum, boxType: null };
  }
  return { matched: false, boxType: null };
}

function numRate(v, fb) {
  const x = Number(v);
  if (Number.isFinite(x) && x >= 0) return x;
  return fb;
}

const DEFAULTS_FROM_FRONTEND = {
  str: 900,
  box_1way: 900,
  box_3way: 300,
  box_6way: 150,
  fp: 90,
  bp: 90,
  sp: 90,
  ap: 30,
  duplicates: 300,
  triples: 900,
  legacy: 90,
};

/**
 * Winning-line multiplier (per ₹1 stake) from admin rates map.
 */
export function resolve3DPayoutMultiplier(ratesMap, betModeRaw, betNumRaw, evaluation) {
  const mode = normalizeStoredMode(betModeRaw);
  const legacyFb = () => numRate(ratesMap?.quiz3d, DEFAULTS_FROM_FRONTEND.legacy);

  if (!evaluation?.matched) return 0;

  if (mode === 'str') {
    return numRate(ratesMap?.quiz3d_str, numRate(ratesMap?.quiz3d, DEFAULTS_FROM_FRONTEND.str));
  }
  if (mode === 'box') {
    const bt = evaluation.boxType;
    if (bt === '1-way') return numRate(ratesMap?.quiz3d_box_1way, numRate(ratesMap?.quiz3d, DEFAULTS_FROM_FRONTEND.box_1way));
    if (bt === '3-way') return numRate(ratesMap?.quiz3d_box_3way, numRate(ratesMap?.quiz3d, DEFAULTS_FROM_FRONTEND.box_3way));
    if (bt === '6-way') return numRate(ratesMap?.quiz3d_box_6way, numRate(ratesMap?.quiz3d, DEFAULTS_FROM_FRONTEND.box_6way));
    return legacyFb();
  }
  if (mode === 'fp') return numRate(ratesMap?.quiz3d_fp, numRate(ratesMap?.quiz3d, DEFAULTS_FROM_FRONTEND.fp));
  if (mode === 'bp') return numRate(ratesMap?.quiz3d_bp, numRate(ratesMap?.quiz3d, DEFAULTS_FROM_FRONTEND.bp));
  if (mode === 'sp') return numRate(ratesMap?.quiz3d_sp, numRate(ratesMap?.quiz3d, DEFAULTS_FROM_FRONTEND.sp));
  if (mode === 'ap') return numRate(ratesMap?.quiz3d_ap, numRate(ratesMap?.quiz3d, DEFAULTS_FROM_FRONTEND.ap));
  if (mode === 'duplicates') {
    return numRate(ratesMap?.quiz3d_duplicates, numRate(ratesMap?.quiz3d, DEFAULTS_FROM_FRONTEND.duplicates));
  }
  if (mode === 'triples') {
    return numRate(ratesMap?.quiz3d_triples, numRate(ratesMap?.quiz3d, DEFAULTS_FROM_FRONTEND.triples));
  }

  return legacyFb();
}
