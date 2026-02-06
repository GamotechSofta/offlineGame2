/**
 * Bid Types Configuration
 * Each bid type has: key, label, validation, mode (easy/bulk/both)
 */

export const BID_TYPES = {
  SINGLE_DIGIT: {
    key: 'single',
    label: 'Single Digit',
    digitCount: 1,
    validRange: [0, 9],
    regex: /^[0-9]$/,
    hasSpecialMode: true,
    specialModeDigits: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  },
  SINGLE_DIGIT_BULK: {
    key: 'single',
    label: 'Single Digit Bulk',
    digitCount: 1,
    validRange: [0, 9],
    regex: /^[0-9]$/,
    hasSpecialMode: true,
    defaultMode: 'bulk',
  },
  JODI: {
    key: 'jodi',
    label: 'Jodi',
    digitCount: 2,
    validRange: [0, 99],
    regex: /^[0-9]{2}$/,
    hasSpecialMode: false,
  },
  JODI_BULK: {
    key: 'jodi',
    label: 'Jodi Bulk',
    digitCount: 2,
    hasSpecialMode: false,
  },
  SINGLE_PANA: {
    key: 'panna',
    label: 'Single Pana',
    digitCount: 3,
    hasSpecialMode: false,
    // Pana: 3 distinct digits, 120 combos (e.g. 123, 456)
  },
  SINGLE_PANA_BULK: {
    key: 'panna',
    label: 'Single Pana Bulk',
    digitCount: 3,
    hasSpecialMode: false,
  },
  DOUBLE_PANA: {
    key: 'panna',
    label: 'Double Pana',
    digitCount: 3,
    hasSpecialMode: false,
    // 2 same + 1 different (e.g. 112, 223)
  },
  DOUBLE_PANA_BULK: {
    key: 'panna',
    label: 'Double Pana Bulk',
    digitCount: 3,
    hasSpecialMode: false,
  },
  TRIPLE_PANA: {
    key: 'panna',
    label: 'Triple Pana',
    digitCount: 3,
    hasSpecialMode: false,
    // Same 3 digits (111, 222, ..., 999)
  },
  FULL_SANGAM: {
    key: 'full-sangam',
    label: 'Full Sangam',
    hasSpecialMode: false,
    // Pana + Digit
  },
  HALF_SANGAM_A: {
    key: 'half-sangam',
    label: 'Half Sangam (O)',
    hasSpecialMode: false,
  },
};

// Map bet type title to config
export const getBidTypeConfig = (title) => {
  const t = (title || '').toLowerCase();
  if (t.includes('single digit bulk')) return BID_TYPES.SINGLE_DIGIT_BULK;
  if (t.includes('single digit')) return BID_TYPES.SINGLE_DIGIT;
  if (t.includes('jodi bulk')) return BID_TYPES.JODI_BULK;
  if (t.includes('jodi')) return BID_TYPES.JODI;
  if (t.includes('single pana bulk')) return BID_TYPES.SINGLE_PANA_BULK;
  if (t.includes('single pana')) return BID_TYPES.SINGLE_PANA;
  if (t.includes('double pana bulk')) return BID_TYPES.DOUBLE_PANA_BULK;
  if (t.includes('double pana')) return BID_TYPES.DOUBLE_PANA;
  if (t.includes('triple pana')) return BID_TYPES.TRIPLE_PANA;
  if (t.includes('full sangam')) return BID_TYPES.FULL_SANGAM;
  if (t.includes('half sangam') && (t.includes('(a)') || t.includes('(o)'))) return BID_TYPES.HALF_SANGAM_A;
  return BID_TYPES.SINGLE_DIGIT;
};
