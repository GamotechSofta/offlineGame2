/**
 * RTP (Return to Player) monitoring: totalPayout / totalWagered.
 * Expected RTP ≈ 97.3% for European roulette. Alert and optionally adjust when deviation is significant.
 */
import { getStats } from '../models/rouletteGame/RouletteStats.js';

const EXPECTED_RTP = 1 - 1 / 37; // ~0.97297
const DEFAULT_DEVIATION_THRESHOLD = 0.05; // 5% absolute deviation triggers alert

/**
 * Get current RTP from global stats.
 * @returns {{ rtp: number, totalWagered: number, totalPaid: number, spinCount: number }}
 */
export async function getCurrentRTP() {
    const stats = await getStats();
    const totalWagered = Number(stats?.totalWagered) || 0;
    const totalPaid = Number(stats?.totalPaid) || 0;
    const spinCount = Number(stats?.spinCount) || 0;
    const rtp = totalWagered > 0 ? totalPaid / totalWagered : 0;
    return { rtp, totalWagered, totalPaid, spinCount };
}

/**
 * Check if RTP deviates significantly from expected; return alert if so.
 * @param {number} [threshold] - Absolute deviation (e.g. 0.05 = 5%)
 * @returns {{ inRange: boolean, rtp: number, expectedRtp: number, deviation: number, alert: string|null }}
 */
export async function checkRTPDeviation(threshold = DEFAULT_DEVIATION_THRESHOLD) {
    const { rtp, totalWagered, spinCount } = await getCurrentRTP();
    const deviation = Math.abs(rtp - EXPECTED_RTP);
    const inRange = deviation <= threshold;
    let alert = null;
    if (!inRange && totalWagered > 0 && spinCount >= 100) {
        alert = `RTP ${(rtp * 100).toFixed(2)}% deviates from expected ${(EXPECTED_RTP * 100).toFixed(2)}% by ${(deviation * 100).toFixed(2)}%. Consider reviewing bet limits or exposure.`;
    }
    return {
        inRange,
        rtp,
        expectedRtp: EXPECTED_RTP,
        deviation,
        alert,
        totalWagered,
        spinCount,
    };
}

export { EXPECTED_RTP };
