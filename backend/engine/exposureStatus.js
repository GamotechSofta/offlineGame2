import { getNumbersCovered, getMaxPayoutForBet } from './payout.js';

export function liabilityByNumberAndBetType(betsOrSpins) {
    const byNumber = {};
    const byBetType = {};
    let total = 0;
    for (const item of betsOrSpins || []) {
        const bets = Array.isArray(item?.bets) ? item.bets : Array.isArray(item) ? item : [];
        for (const b of bets) {
            const t = String(b?.type || '').toLowerCase();
            const maxPayout = getMaxPayoutForBet(b);
            byBetType[t] = (byBetType[t] || 0) + maxPayout;
            total += maxPayout;
            const numbers = getNumbersCovered(b);
            for (const n of numbers) {
                const key = String(n);
                byNumber[key] = (byNumber[key] || 0) + maxPayout;
            }
        }
    }
    return { byNumber, byBetType, totalMaxPayout: total };
}
export function exposureRatio(totalMaxPayout,reserveBalance){
  if(!Number.isFinite(reserveBalance)||reserveBalance<=0) return 0;
  return totalMaxPayout/reserveBalance;
}
