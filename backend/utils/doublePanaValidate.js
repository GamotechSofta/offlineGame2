/**
 * Valid Double Pana (same rules as DP Motor / user Double Pana chart).
 * 3 digits, two consecutive same, first !== 0, ordering rules.
 */
export function isValidDoublePana(str) {
    if (!str || typeof str !== 'string') return false;
    const s = str.trim();
    if (!/^[0-9]{3}$/.test(s)) return false;
    const first = Number(s[0]);
    const second = Number(s[1]);
    const third = Number(s[2]);
    const hasConsecutiveSame = first === second || second === third;
    if (!hasConsecutiveSame) return false;
    if (first === 0) return false;
    if (second === 0 && third === 0) return true;
    if (first === second && third === 0) return true;
    if (third <= first) return false;
    return true;
}
