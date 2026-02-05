import mongoose from 'mongoose';
import Bet from '../models/bet/bet.js';
import Market from '../models/market/market.js';
import { Wallet, WalletTransaction } from '../models/wallet/wallet.js';
import { getRatesMap, DEFAULT_RATES } from '../models/rate/rate.js';

function toObjectId(id) {
    if (!id) return null;
    if (id instanceof mongoose.Types.ObjectId) return id;
    try {
        const str = String(id).trim();
        return mongoose.Types.ObjectId.isValid(str) && String(new mongoose.Types.ObjectId(str)) === str
            ? new mongoose.Types.ObjectId(str)
            : null;
    } catch {
        return null;
    }
}

/**
 * Classify 3-digit panna as single/double/triple patti and return rate key.
 */
function getPannaType(digits) {
    if (!digits || digits.length !== 3) return null;
    const a = digits[0], b = digits[1], c = digits[2];
    if (a === b && b === c) return 'triplePatti';
    if (a === b || b === c || a === c) return 'doublePatti';
    return 'singlePatti';
}

/**
 * Get payout rate for a rate key. Uses DEFAULT_RATES as fallback so winning players always get correct rate.
 */
function getRateForKey(rates, key) {
    if (!key) return 0;
    const val = rates[key];
    if (val != null && Number.isFinite(Number(val)) && Number(val) >= 0) return Number(val);
    return (DEFAULT_RATES[key] != null && Number.isFinite(DEFAULT_RATES[key])) ? DEFAULT_RATES[key] : 0;
}

/**
 * Helper: Get today's date at midnight (start of day) for scheduled bet filtering.
 */
function getTodayMidnight() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

/**
 * Helper: Check if a bet should be settled today.
 * Returns true if bet is NOT scheduled OR if it's scheduled for today or earlier.
 */
function shouldSettleToday(bet) {
    // Not scheduled - always settle
    if (!bet.isScheduled || !bet.scheduledDate) {
        return true;
    }
    // Scheduled - only settle if scheduledDate is today or in the past
    const today = getTodayMidnight();
    const schedDate = new Date(bet.scheduledDate);
    schedDate.setHours(0, 0, 0, 0);
    return schedDate.getTime() <= today.getTime();
}

/**
 * Settle opening: set market openingNumber, then mark single & panna bets as won/lost and credit winners.
 */
export async function settleOpening(marketId, openingNumber) {
    if (!openingNumber || !/^\d{3}$/.test(openingNumber)) {
        throw new Error('Opening number must be exactly 3 digits');
    }
    const market = await Market.findById(marketId);
    if (!market) throw new Error('Market not found');
    const canonicalId = market._id.toString();
    await Market.findByIdAndUpdate(marketId, { openingNumber });

    const rates = await getRatesMap();
    const lastDigitOpen = openingNumber.slice(-1);
    const open3 = openingNumber;

    const oid = toObjectId(canonicalId);
    const marketIdStr = String(canonicalId).trim();
    
    // Get today's midnight for scheduled bet filtering
    const todayMidnight = getTodayMidnight();
    
    const pendingBets = await Bet.find({
        status: 'pending',
        $or: oid ? [{ marketId: oid }, { marketId: marketIdStr }] : [{ marketId: marketIdStr }],
        // Only include bets that are NOT scheduled for a future date
        $and: [
            {
                $or: [
                    { isScheduled: { $ne: true } },
                    { scheduledDate: { $exists: false } },
                    { scheduledDate: null },
                    { scheduledDate: { $lte: todayMidnight } }
                ]
            }
        ]
    }).lean();
    for (const bet of pendingBets) {
        const type = (bet.betType || '').toLowerCase();
        const num = (bet.betNumber || '').toString().trim();
        const amount = Number(bet.amount) || 0;

        if (type === 'single' && /^[0-9]$/.test(num)) {
            const won = num === lastDigitOpen;
            const payout = won ? amount * getRateForKey(rates, 'single') : 0;
            await Bet.updateOne(
                { _id: bet._id },
                { status: won ? 'won' : 'lost', payout }
            );
            if (won && payout > 0) {
                await Wallet.findOneAndUpdate(
                    { userId: bet.userId },
                    { $inc: { balance: payout } },
                    { upsert: true }
                );
                await WalletTransaction.create({
                    userId: bet.userId,
                    type: 'credit',
                    amount: payout,
                    description: `Win – ${market.marketName} (Single ${num})`,
                    referenceId: bet._id.toString(),
                });
            }
        } else if (type === 'panna' && /^[0-9]{3}$/.test(num)) {
            const won = num === open3;
            const pannaType = getPannaType(open3);
            const rateKey = pannaType || 'singlePatti';
            const payout = won ? amount * getRateForKey(rates, rateKey) : 0;
            await Bet.updateOne(
                { _id: bet._id },
                { status: won ? 'won' : 'lost', payout }
            );
            if (won && payout > 0) {
                await Wallet.findOneAndUpdate(
                    { userId: bet.userId },
                    { $inc: { balance: payout } },
                    { upsert: true }
                );
                await WalletTransaction.create({
                    userId: bet.userId,
                    type: 'credit',
                    amount: payout,
                    description: `Win – ${market.marketName} (Panna ${num})`,
                    referenceId: bet._id.toString(),
                });
            }
        }
        // jodi, half-sangam, full-sangam remain pending until closing
    }
}

/**
 * Settle closing: set market closingNumber, then settle jodi, half-sangam, full-sangam.
 */
export async function settleClosing(marketId, closingNumber) {
    if (!closingNumber || !/^\d{3}$/.test(closingNumber)) {
        throw new Error('Closing number must be exactly 3 digits');
    }
    const market = await Market.findById(marketId);
    if (!market) throw new Error('Market not found');
    const open3 = (market.openingNumber || '').toString();
    if (!/^\d{3}$/.test(open3)) throw new Error('Opening number must be set before declaring closing');
    await Market.findByIdAndUpdate(marketId, { closingNumber });

    const rates = await getRatesMap();
    const lastDigitOpen = open3.slice(-1);
    const lastDigitClose = closingNumber.slice(-1);
    const close3 = closingNumber;

    const canonicalId = market._id.toString();
    const oid = toObjectId(canonicalId);
    const marketIdStr = String(canonicalId).trim();
    
    // Get today's midnight for scheduled bet filtering
    const todayMidnight = getTodayMidnight();
    
    const pendingBets = await Bet.find({
        status: 'pending',
        $or: oid ? [{ marketId: oid }, { marketId: marketIdStr }] : [{ marketId: marketIdStr }],
        // Only include bets that are NOT scheduled for a future date
        $and: [
            {
                $or: [
                    { isScheduled: { $ne: true } },
                    { scheduledDate: { $exists: false } },
                    { scheduledDate: null },
                    { scheduledDate: { $lte: todayMidnight } }
                ]
            }
        ]
    }).lean();
    for (const bet of pendingBets) {
        const type = (bet.betType || '').toLowerCase();
        const num = (bet.betNumber || '').toString().trim();
        const amount = Number(bet.amount) || 0;

        if (type === 'jodi' && /^[0-9]{2}$/.test(num)) {
            const expectedJodi = lastDigitOpen + lastDigitClose;
            const won = num === expectedJodi;
            const payout = won ? amount * getRateForKey(rates, 'jodi') : 0;
            await Bet.updateOne(
                { _id: bet._id },
                { status: won ? 'won' : 'lost', payout }
            );
            if (won && payout > 0) {
                await Wallet.findOneAndUpdate(
                    { userId: bet.userId },
                    { $inc: { balance: payout } },
                    { upsert: true }
                );
                await WalletTransaction.create({
                    userId: bet.userId,
                    type: 'credit',
                    amount: payout,
                    description: `Win – ${market.marketName} (Jodi ${num})`,
                    referenceId: bet._id.toString(),
                });
            }
        } else if (type === 'half-sangam') {
            const parts = num.split('-').map((p) => (p || '').trim());
            const first = parts[0] || '';
            const second = parts[1] || '';
            // Half Sangam A: open3-close1 (e.g. "156-6")
            const isFormatA = /^[0-9]{3}$/.test(first) && /^[0-9]$/.test(second);
            // Half Sangam B: open1-close3 (e.g. "6-156")
            const isFormatB = /^[0-9]$/.test(first) && /^[0-9]{3}$/.test(second);
            let won = false;
            if (isFormatA) won = first === open3 && second === lastDigitClose;
            else if (isFormatB) won = first === lastDigitOpen && second === close3;
            const payout = won ? amount * getRateForKey(rates, 'halfSangam') : 0;
            await Bet.updateOne(
                { _id: bet._id },
                { status: won ? 'won' : 'lost', payout }
            );
            if (won && payout > 0) {
                await Wallet.findOneAndUpdate(
                    { userId: bet.userId },
                    { $inc: { balance: payout } },
                    { upsert: true }
                );
                await WalletTransaction.create({
                    userId: bet.userId,
                    type: 'credit',
                    amount: payout,
                    description: `Win – ${market.marketName} (Half Sangam)`,
                    referenceId: bet._id.toString(),
                });
            }
        } else if (type === 'full-sangam') {
            const parts = num.split('-');
            const betOpen3 = parts[0]?.trim() || '';
            const betClose3 = parts[1]?.trim() || '';
            const won = /^[0-9]{3}$/.test(betOpen3) && /^[0-9]{3}$/.test(betClose3) &&
                betOpen3 === open3 && betClose3 === close3;
            const payout = won ? amount * getRateForKey(rates, 'fullSangam') : 0;
            await Bet.updateOne(
                { _id: bet._id },
                { status: won ? 'won' : 'lost', payout }
            );
            if (won && payout > 0) {
                await Wallet.findOneAndUpdate(
                    { userId: bet.userId },
                    { $inc: { balance: payout } },
                    { upsert: true }
                );
                await WalletTransaction.create({
                    userId: bet.userId,
                    type: 'credit',
                    amount: payout,
                    description: `Win – ${market.marketName} (Full Sangam)`,
                    referenceId: bet._id.toString(),
                });
            }
        }
    }
}

/**
 * Preview declare open: for a proposed opening number, return totalBetAmount (single + panna only),
 * totalWinAmount (payout to winners for single + panna), noOfPlayers, profit.
 * Only single and panna are settled on open; totalBetAmount and profit refer to that subset.
 */
export async function previewDeclareOpen(marketId, openingNumber) {
    const oid = toObjectId(marketId);
    if (!oid) {
        return { totalBetAmount: 0, totalWinAmount: 0, noOfPlayers: 0, profit: 0 };
    }
    const marketIdStr = String(marketId).trim();
    
    // Get today's midnight for scheduled bet filtering
    const todayMidnight = getTodayMidnight();
    
    const pendingBets = await Bet.find({
        status: 'pending',
        $or: [{ marketId: oid }, { marketId: marketIdStr }],
        // Only include bets that are NOT scheduled for a future date
        $and: [
            {
                $or: [
                    { isScheduled: { $ne: true } },
                    { scheduledDate: { $exists: false } },
                    { scheduledDate: null },
                    { scheduledDate: { $lte: todayMidnight } }
                ]
            }
        ]
    }).lean();

    const rates = await getRatesMap();
    const lastDigitOpen = openingNumber && /^\d{3}$/.test(openingNumber) ? openingNumber.slice(-1) : null;
    const open3 = openingNumber && /^\d{3}$/.test(openingNumber) ? openingNumber : null;

    let totalBetAmount = 0; // only single + panna (bets settled on open)
    let totalWinAmount = 0;
    const userIds = new Set();

    for (const bet of pendingBets) {
        const type = (bet.betType || '').toLowerCase();
        const num = (bet.betNumber || '').toString().trim();
        const amount = Number(bet.amount) || 0;

        if (type === 'single' && /^[0-9]$/.test(num)) {
            totalBetAmount += amount;
            userIds.add(bet.userId.toString());
            if (lastDigitOpen != null && num === lastDigitOpen) {
                const rate = getRateForKey(rates, 'single');
                totalWinAmount += amount * rate;
            }
        } else if (type === 'panna' && /^[0-9]{3}$/.test(num)) {
            totalBetAmount += amount;
            userIds.add(bet.userId.toString());
            if (open3 != null && num === open3) {
                const pannaType = getPannaType(open3);
                const rateKey = pannaType || 'singlePatti';
                const rate = getRateForKey(rates, rateKey);
                totalWinAmount += amount * rate;
            }
        } else {
            userIds.add(bet.userId.toString());
        }
    }

    totalWinAmount = Math.round(totalWinAmount * 100) / 100;
    const profit = Math.round((totalBetAmount - totalWinAmount) * 100) / 100;

    return {
        totalBetAmount,
        totalWinAmount,
        noOfPlayers: userIds.size,
        profit,
    };
}

/**
 * Preview declare close: for pending jodi, half-sangam, full-sangam bets with given closing number.
 * Returns totalBetAmount (sum of those pending), totalWinAmount, noOfPlayers, profit.
 */
export async function previewDeclareClose(marketId, closingNumber) {
    const oid = toObjectId(marketId);
    if (!oid) return { totalBetAmount: 0, totalWinAmount: 0, noOfPlayers: 0, profit: 0 };
    const market = await Market.findById(oid).lean();
    if (!market) return { totalBetAmount: 0, totalWinAmount: 0, noOfPlayers: 0, profit: 0 };
    const open3 = (market.openingNumber || '').toString();
    if (!/^\d{3}$/.test(open3)) return { totalBetAmount: 0, totalWinAmount: 0, noOfPlayers: 0, profit: 0 };

    const marketIdStr = String(marketId).trim();
    
    // Get today's midnight for scheduled bet filtering
    const todayMidnight = getTodayMidnight();
    
    const pendingBets = await Bet.find({
        status: 'pending',
        $or: [{ marketId: oid }, { marketId: marketIdStr }],
        // Only include bets that are NOT scheduled for a future date
        $and: [
            {
                $or: [
                    { isScheduled: { $ne: true } },
                    { scheduledDate: { $exists: false } },
                    { scheduledDate: null },
                    { scheduledDate: { $lte: todayMidnight } }
                ]
            }
        ]
    }).lean();
    let totalBetAmount = 0;
    let totalWinAmount = 0;
    const userIds = new Set();

    if (!closingNumber || !/^\d{3}$/.test(closingNumber)) {
        for (const bet of pendingBets) {
            const type = (bet.betType || '').toLowerCase();
            if (type === 'jodi' || type === 'half-sangam' || type === 'full-sangam') {
                totalBetAmount += Number(bet.amount) || 0;
                userIds.add(bet.userId.toString());
            }
        }
        totalBetAmount = Math.round(totalBetAmount * 100) / 100;
        return { totalBetAmount, totalWinAmount: 0, noOfPlayers: userIds.size, profit: totalBetAmount };
    }

    const rates = await getRatesMap();
    const lastDigitOpen = open3.slice(-1);
    const lastDigitClose = closingNumber.slice(-1);
    const close3 = closingNumber;

    for (const bet of pendingBets) {
        const type = (bet.betType || '').toLowerCase();
        const num = (bet.betNumber || '').toString().trim();
        const amount = Number(bet.amount) || 0;
        const isCloseType = type === 'jodi' || type === 'half-sangam' || type === 'full-sangam';
        if (!isCloseType) continue;

        totalBetAmount += amount;
        userIds.add(bet.userId.toString());

        if (type === 'jodi' && /^[0-9]{2}$/.test(num)) {
            const expectedJodi = lastDigitOpen + lastDigitClose;
            if (num === expectedJodi) totalWinAmount += amount * getRateForKey(rates, 'jodi');
        } else if (type === 'half-sangam') {
            const parts = num.split('-').map((p) => (p || '').trim());
            const first = parts[0] || '';
            const second = parts[1] || '';
            const isFormatA = /^[0-9]{3}$/.test(first) && /^[0-9]$/.test(second);
            const isFormatB = /^[0-9]$/.test(first) && /^[0-9]{3}$/.test(second);
            if (isFormatA && first === open3 && second === lastDigitClose) totalWinAmount += amount * getRateForKey(rates, 'halfSangam');
            else if (isFormatB && first === lastDigitOpen && second === close3) totalWinAmount += amount * getRateForKey(rates, 'halfSangam');
        } else if (type === 'full-sangam') {
            const parts = (num || '').split('-').map((p) => (p || '').trim());
            const betOpen3 = parts[0] || '';
            const betClose3 = parts[1] || '';
            if (/^[0-9]{3}$/.test(betOpen3) && /^[0-9]{3}$/.test(betClose3) && betOpen3 === open3 && betClose3 === close3) {
                totalWinAmount += amount * getRateForKey(rates, 'fullSangam');
            }
        }
    }

    totalBetAmount = Math.round(totalBetAmount * 100) / 100;
    totalWinAmount = Math.round(totalWinAmount * 100) / 100;
    const profit = Math.round((totalBetAmount - totalWinAmount) * 100) / 100;
    return {
        totalBetAmount,
        totalWinAmount,
        noOfPlayers: userIds.size,
        profit,
    };
}
