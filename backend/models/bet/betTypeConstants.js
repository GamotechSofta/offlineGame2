/**
 * Single source of truth for allowed betType values (Mongoose + controller validation).
 * Add new types here only — schema and placeBet both stay in sync.
 */
export const BET_TYPES = [
    'single',
    'jodi',
    'panna',
    'sp-motor',
    'dp-motor',
    't-motor',
    'half-sangam',
    'full-sangam',
    'odd-even',
    'sp-common',
    'cp-common',
    'dp-common',
];
