/** Allowed chart codes for bet type `chart`. */
export const CHART_CODES = ['20CHT', '30CHT', '40CHT', '50CHT', '60CHT', '70CHT'];

/**
 * Parse and normalize betNumber as "NNCHT:D" (e.g. 20CHT:7).
 * @returns {{ normalized: string } | null}
 */
export function parseChartBet(betNumber) {
    const s = String(betNumber || '').trim();
    const m = s.match(/^(\d{2})CHT:([0-9])$/i);
    if (!m) return null;
    const chart = `${m[1]}CHT`.toUpperCase();
    if (!CHART_CODES.includes(chart)) return null;
    const digit = m[2];
    return { normalized: `${chart}:${digit}` };
}
