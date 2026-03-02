import mongoose from 'mongoose';
import Bet from '../models/bet/bet.js';
import Market from '../models/market/market.js';
import User from '../models/user/user.js';
import Admin from '../models/admin/admin.js';
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
 * Open/Close "Digit" (Ank) = last digit of sum of 3 digits (0–9).
 * Example: "156" → 1+5+6=12 → digit "2"
 */
function digitFromPatti(threeDigitStr) {
    const s = String(threeDigitStr || '').trim();
    if (!/^\d{3}$/.test(s)) return null;
    const sum = Number(s[0]) + Number(s[1]) + Number(s[2]);
    return String(sum % 10);
}

/**
 * Half Sangam winner validation (cross-side only).
 *
 * Market result shape:
 *   OpenPana_OpenClose_ClosePana
 * Example:
 *   234_26_222
 *   - openPana  = 234
 *   - openAnk   = 2
 *   - closeAnk  = 6
 *   - closePana = 222
 *
 * Supported bet formats:
 * 1) Open Half Sangam  -> "OpenPana-CloseAnk" (PPP-D)
 * 2) Close Half Sangam -> "OpenAnk-ClosePana" (D-PPP)
 */
function parseMarketResultParts(openingNumber, closingNumber) {
    const openPana = /^\d{3}$/.test(String(openingNumber || '').trim()) ? String(openingNumber).trim() : null;
    const closePana = /^\d{3}$/.test(String(closingNumber || '').trim()) ? String(closingNumber).trim() : null;
    const openAnk = openPana ? digitFromPatti(openPana) : null;
    const closeAnk = closePana ? digitFromPatti(closePana) : null;
    return { openPana, openAnk, closeAnk, closePana };
}

/**
 * Partial-result safe gate for Half Sangam:
 * Half Sangam is close-result dependent and must be evaluated only
 * after close panna is declared.
 * - Open Half (PPP-D) needs openPana + closeAnk (derived from closePana)
 * - Close Half (D-PPP) needs openAnk + closePana
 * If closePana is missing (open-only declaration), keep bet pending.
 */
function canEvaluateHalfSangam(betNumber, resultParts = {}) {
    const { openPana, openAnk, closeAnk, closePana } = resultParts;
    if (closePana == null) return false;
    const normalized = String(betNumber || '').replace(/[._·]/g, '-');
    const parts = normalized.split('-').map((p) => (p || '').trim()).filter(Boolean);
    if (parts.length !== 2) return false;
    const first = parts[0] || '';
    const second = parts[1] || '';

    const isOpenHalfFormat = /^[0-9]{3}$/.test(first) && /^[0-9]$/.test(second);
    const isCloseHalfFormat = /^[0-9]$/.test(first) && /^[0-9]{3}$/.test(second);

    if (isOpenHalfFormat) return openPana != null && closeAnk != null;
    if (isCloseHalfFormat) return openAnk != null && closePana != null;
    return false;
}

function isWinningHalfSangam(betNumber, resultParts = {}) {
    const { openPana, openAnk, closeAnk, closePana } = resultParts;
    const normalized = String(betNumber || '').replace(/[._·]/g, '-');
    const parts = normalized.split('-').map((p) => (p || '').trim()).filter(Boolean);
    if (parts.length !== 2) return false;
    const first = parts[0] || '';
    const second = parts[1] || '';

    const isOpenHalfFormat = /^[0-9]{3}$/.test(first) && /^[0-9]$/.test(second);
    const isCloseHalfFormat = /^[0-9]$/.test(first) && /^[0-9]{3}$/.test(second);

    const isOpenHalfWin =
        isOpenHalfFormat &&
        openPana != null &&
        closeAnk != null &&
        first === openPana &&
        second === closeAnk;

    const isCloseHalfWin =
        isCloseHalfFormat &&
        openAnk != null &&
        closePana != null &&
        first === openAnk &&
        second === closePana;

    return isOpenHalfWin || isCloseHalfWin;
}

/**
 * Helper: Get today's date at midnight (start of day) for scheduled bet filtering.
 */
function getTodayMidnight() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

/**
 * Helper: Pay winnings to the correct account.
 * - If bet was placed by bookie (placedByBookie=true), credit to BOOKIE's balance
 * - If bet was placed by player themselves, credit to PLAYER's wallet
 * Returns the amount added.
 */
async function payWinnings(userId, payout, description, referenceId, betInfo = {}) {
    if (!payout || payout <= 0) return 0;

    const { placedByBookie, placedByBookieId } = betInfo;
    console.log(`[payWinnings] betInfo received:`, JSON.stringify(betInfo));
    console.log(`[payWinnings] placedByBookie=${placedByBookie}, placedByBookieId=${placedByBookieId}`);

    // If bet was placed by bookie, credit winnings to bookie's balance
    if (placedByBookie && placedByBookieId) {
        await Admin.findByIdAndUpdate(
            placedByBookieId,
            { $inc: { balance: payout } }
        );
        console.log(`[payWinnings] Credited ₹${payout} to BOOKIE ${placedByBookieId} (bet placed by bookie)`);
        return payout;
    }

    // Otherwise, credit to player's wallet (original behavior)
    await Wallet.findOneAndUpdate(
        { userId },
        { $inc: { balance: payout } },
        { upsert: true }
    );

    // Create transaction record for player
    await WalletTransaction.create({
        userId,
        type: 'credit',
        amount: payout,
        description: description,
        referenceId: referenceId?.toString(),
    });

    console.log(`[payWinnings] Credited ₹${payout} to PLAYER ${userId} wallet`);
    return payout;
}

/** Today in IST (YYYY-MM-DD) – same as getMarketStats so preview matches Market Detail. */
function getTodayKeyIST() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
}

function getTodayISTRange() {
    const todayKey = getTodayKeyIST();
    return {
        start: new Date(`${todayKey}T00:00:00+05:30`),
        end: new Date(`${todayKey}T23:59:59.999+05:30`),
    };
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
    
    // Check if market is already closed (has closing number)
    if (market.closingNumber && /^\d{3}$/.test(String(market.closingNumber))) {
        throw new Error('Cannot open a market that is already closed. The closing number has already been declared.');
    }
    
    const canonicalId = market._id.toString();
    await Market.findByIdAndUpdate(marketId, { openingNumber });

    const rates = await getRatesMap();
    const openDigit = digitFromPatti(openingNumber);
    const open3 = openingNumber;

    const oid = toObjectId(canonicalId);
    const marketIdStr = String(canonicalId).trim();
    
    // Get today's midnight for scheduled bet filtering
    const todayMidnight = getTodayMidnight();
    
    const pendingBets = await Bet.find({
        status: 'pending',
        $or: oid ? [{ marketId: oid }, { marketId: marketIdStr }] : [{ marketId: marketIdStr }],
        // Only settle OPEN-session bets on opening (legacy bets without betOn also treated as open)
        betOn: { $ne: 'close' },
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
            const won = openDigit != null && num === openDigit;
            const payout = won ? amount * getRateForKey(rates, 'single') : 0;
            await Bet.updateOne(
                { _id: bet._id },
                { status: won ? 'won' : 'lost', payout }
            );
            if (won && payout > 0) {
                await payWinnings(bet.userId, payout, `Win – ${market.marketName} (Single ${num})`, bet._id, { placedByBookie: bet.placedByBookie, placedByBookieId: bet.placedByBookieId });
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
                await payWinnings(bet.userId, payout, `Win – ${market.marketName} (Panna ${num})`, bet._id, { placedByBookie: bet.placedByBookie, placedByBookieId: bet.placedByBookieId });
            }
        } else if (type === 'half-sangam') {
            // Correct Half Sangam is cross-side and needs close-side data.
            // So do NOT settle on opening declaration; keep pending for settleClosing().
            // - Open Half Sangam:  Open Pana + Close Ank
            // - Close Half Sangam: Open Ank  + Close Pana
        }
        // jodi, full-sangam remain pending until closing
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
    const close3 = String(closingNumber || '').trim();
    const parsedResult = parseMarketResultParts(open3, close3);
    const { openAnk: lastDigitOpen, closeAnk: lastDigitClose } = parsedResult;

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

        // CLOSE-session Single Digit (settles on closing digit)
        if (type === 'single' && (bet.betOn || '').toString().toLowerCase() === 'close' && /^[0-9]$/.test(num)) {
            const won = num === lastDigitClose;
            const payout = won ? amount * getRateForKey(rates, 'single') : 0;
            await Bet.updateOne({ _id: bet._id }, { status: won ? 'won' : 'lost', payout });
            if (won && payout > 0) {
                await payWinnings(bet.userId, payout, `Win – ${market.marketName} (Single ${num})`, bet._id, { placedByBookie: bet.placedByBookie, placedByBookieId: bet.placedByBookieId });
            }
        }
        // CLOSE-session Patti/Panna (settles on closing patti)
        else if (type === 'panna' && (bet.betOn || '').toString().toLowerCase() === 'close' && /^[0-9]{3}$/.test(num)) {
            const won = num === close3;
            const pannaType = getPannaType(close3);
            const rateKey = pannaType || 'singlePatti';
            const payout = won ? amount * getRateForKey(rates, rateKey) : 0;
            await Bet.updateOne({ _id: bet._id }, { status: won ? 'won' : 'lost', payout });
            if (won && payout > 0) {
                await payWinnings(bet.userId, payout, `Win – ${market.marketName} (Panna ${num})`, bet._id, { placedByBookie: bet.placedByBookie, placedByBookieId: bet.placedByBookieId });
            }
        }
        else if (type === 'jodi' && /^[0-9]{2}$/.test(num)) {
            const expectedJodi = (lastDigitOpen != null && lastDigitClose != null) ? (lastDigitOpen + lastDigitClose) : null;
            const won = expectedJodi != null && num === expectedJodi;
            const payout = won ? amount * getRateForKey(rates, 'jodi') : 0;
            await Bet.updateOne(
                { _id: bet._id },
                { status: won ? 'won' : 'lost', payout }
            );
            if (won && payout > 0) {
                await payWinnings(bet.userId, payout, `Win – ${market.marketName} (Jodi ${num})`, bet._id, { placedByBookie: bet.placedByBookie, placedByBookieId: bet.placedByBookieId });
            }
        } else if (type === 'half-sangam') {
            // Correct cross-side Half Sangam settlement:
            // 1) Open Half Sangam  -> Open Pana + Close Ank  (PPP-D)
            // 2) Close Half Sangam -> Open Ank  + Close Pana (D-PPP)
            // Partial-result safe rule:
            // if opposite-side result is not available yet, keep as pending for reprocessing.
            if (!canEvaluateHalfSangam(num, parsedResult)) continue;
            const won = isWinningHalfSangam(num, parsedResult);
            const payout = won ? amount * getRateForKey(rates, 'halfSangam') : 0;
            await Bet.updateOne(
                { _id: bet._id },
                { status: won ? 'won' : 'lost', payout }
            );
            if (won && payout > 0) {
                await payWinnings(bet.userId, payout, `Win – ${market.marketName} (Half Sangam)`, bet._id, { placedByBookie: bet.placedByBookie, placedByBookieId: bet.placedByBookieId });
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
                await payWinnings(bet.userId, payout, `Win – ${market.marketName} (Full Sangam)`, bet._id, { placedByBookie: bet.placedByBookie, placedByBookieId: bet.placedByBookieId });
            }
        }
    }
}

/**
 * Preview declare open: for a proposed opening number, return totalBetAmount (single + panna only),
 * totalWinAmount (payout to winners for single + panna), noOfPlayers, profit,
 * totalBetAmountOnPatti, totalPlayersBetOnPatti, totalPlayersInMarket.
 * Only single and panna are settled on open.
 * @param {string} marketId - Market ID
 * @param {string|null} openingNumber - 3-digit open number e.g. "123"
 * @param {{ bookieUserIds?: string[]|null }} [options] - If bookieUserIds is non-null and non-empty, filter bets by these user IDs (same scope as market stats).
 */
export async function previewDeclareOpen(marketId, openingNumber, options = {}) {
    const oid = toObjectId(marketId);
    if (!oid) {
        return { totalBetAmount: 0, noOfPlayers: 0, profit: 0, totalBetAmountOnPatti: 0, totalPlayersBetOnPatti: 0, totalPlayersInMarket: 0 };
    }
    const marketIdStr = String(marketId).trim();
    const bookieUserIds = options.bookieUserIds;
    const hasBookieFilter = Array.isArray(bookieUserIds) && bookieUserIds.length > 0;

    const todayIST = getTodayISTRange();
    // Same scope as getMarketStats: same market (ObjectId like getMarketStats after Mongoose cast), same today IST range, same bookie filter
    const matchFilterAll = {
        marketId: oid,
        betOn: { $ne: 'close' },
        createdAt: { $gte: todayIST.start, $lte: todayIST.end },
    };
    if (hasBookieFilter) matchFilterAll.userId = { $in: bookieUserIds };

    const allOpenBets = await Bet.find(matchFilterAll).lean();

    const rates = await getRatesMap();
    // Normalize opening number: digits only, exactly 3 (pad with 0), so "12" -> "012", "156" -> "156"
    const openNumRaw = (openingNumber || '').toString().replace(/\D/g, '').slice(0, 3);
    const open3 = openNumRaw.length === 3 ? openNumRaw.padStart(3, '0') : null;
    const lastDigitOpen = open3 ? digitFromPatti(open3) : null;

    let totalBetAmount = 0;
    let totalWinAmount = 0;
    let totalBetAmountOnPatti = 0;
    let totalWinAmountOnPatti = 0;
    const userIds = new Set();
    const playersBetOnPatti = new Set();
    const allMarketUserIds = new Set();

    for (const bet of allOpenBets) {
        const type = (bet.betType || '').toLowerCase();
        const rawNum = (bet.betNumber || '').toString().trim().replace(/\D/g, '');
        const amount = Number(bet.amount) || 0;
        const isPending = (bet.status || '').toString().toLowerCase() === 'pending';
        allMarketUserIds.add(bet.userId.toString());

        if (type === 'single' && /^[0-9]$/.test(rawNum)) {
            const num = rawNum;
            totalBetAmount += amount;
            userIds.add(bet.userId.toString());
            if (lastDigitOpen != null && num === lastDigitOpen) {
                totalBetAmountOnPatti += amount;
                playersBetOnPatti.add(bet.userId.toString());
                if (isPending) {
                    const payout = amount * getRateForKey(rates, 'single');
                    totalWinAmount += payout;
                    totalWinAmountOnPatti += payout;
                }
            }
        } else if (type === 'panna' && rawNum.length >= 3) {
            const num = rawNum.slice(0, 3).padStart(3, '0');
            totalBetAmount += amount;
            userIds.add(bet.userId.toString());
            if (open3 != null && num === open3) {
                totalBetAmountOnPatti += amount;
                playersBetOnPatti.add(bet.userId.toString());
                if (isPending) {
                    const pannaType = getPannaType(open3);
                    const rateKey = pannaType || 'singlePatti';
                    const payout = amount * getRateForKey(rates, rateKey);
                    totalWinAmount += payout;
                    totalWinAmountOnPatti += payout;
                }
            }
        }
    }

    // Half Sangam is cross-side (needs close ank/close panna), so it is NOT settled in open preview.
    const matchHalfSangam = {
        marketId: oid,
        betType: 'half-sangam',
        createdAt: { $gte: todayIST.start, $lte: todayIST.end },
    };
    if (hasBookieFilter) matchHalfSangam.userId = { $in: bookieUserIds };
    let totalBetAmountHalfSangam = 0;
    const halfSangamBets = await Bet.find(matchHalfSangam).lean();
    for (const bet of halfSangamBets) {
        const amount = Number(bet.amount) || 0;
        totalBetAmountHalfSangam += amount;
        allMarketUserIds.add(bet.userId.toString());
    }
    totalBetAmountHalfSangam = Math.round(totalBetAmountHalfSangam * 100) / 100;

    totalBetAmount = Math.round(totalBetAmount * 100) / 100;
    totalWinAmount = Math.round(totalWinAmount * 100) / 100;
    totalBetAmountOnPatti = Math.round(totalBetAmountOnPatti * 100) / 100;
    totalWinAmountOnPatti = Math.round(totalWinAmountOnPatti * 100) / 100;
    const profit = Math.round((totalBetAmount - totalWinAmount) * 100) / 100;

    return {
        totalBetAmount,
        noOfPlayers: userIds.size,
        profit,
        totalBetAmountOnPatti,
        totalWinAmountOnPatti,
        totalPlayersBetOnPatti: playersBetOnPatti.size,
        totalPlayersInMarket: allMarketUserIds.size,
        totalBetAmountHalfSangam,
        totalBetsHalfSangam: halfSangamBets.length,
    };
}

/**
 * Preview declare close: for pending jodi, half-sangam, full-sangam bets with given closing number.
 * Returns totalBetAmount, totalWinAmount, noOfPlayers, profit, totalBetAmountOnPatti, totalPlayersBetOnPatti, totalPlayersInMarket.
 * @param {{ bookieUserIds?: string[]|null }} [options] - If bookieUserIds is non-null and non-empty, filter bets by these user IDs.
 */
export async function previewDeclareClose(marketId, closingNumber, options = {}) {
    const oid = toObjectId(marketId);
    if (!oid) return { totalBetAmount: 0, noOfPlayers: 0, profit: 0, totalBetAmountOnPatti: 0, totalPlayersBetOnPatti: 0, totalPlayersInMarket: 0 };
    const market = await Market.findById(oid).lean();
    if (!market) return { totalBetAmount: 0, noOfPlayers: 0, profit: 0, totalBetAmountOnPatti: 0, totalPlayersBetOnPatti: 0, totalPlayersInMarket: 0 };
    const open3 = (market.openingNumber || '').toString();
    if (!/^\d{3}$/.test(open3)) return { totalBetAmount: 0, noOfPlayers: 0, profit: 0, totalBetAmountOnPatti: 0, totalPlayersBetOnPatti: 0, totalPlayersInMarket: 0 };

    const marketIdStr = String(marketId).trim();
    const bookieUserIds = options.bookieUserIds;
    const hasBookieFilter = Array.isArray(bookieUserIds) && bookieUserIds.length > 0;

    const todayMidnight = getTodayMidnight();
    const todayIST = getTodayISTRange();

    const matchFilterAll = {
        $or: [{ marketId: oid }, { marketId: marketIdStr }],
        createdAt: { $gte: todayIST.start, $lte: todayIST.end },
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
    };
    if (hasBookieFilter) matchFilterAll.userId = { $in: bookieUserIds };

    const allBetsToday = await Bet.find(matchFilterAll).lean();
    let totalBetAmount = 0;
    let totalWinAmount = 0;
    let totalBetAmountOnPatti = 0;
    const userIds = new Set();
    const playersBetOnPatti = new Set();
    const allMarketUserIds = new Set();

    const isCloseSettleTypeBet = (bet) => {
        const type = (bet.betType || '').toLowerCase();
        const isCloseSession = (bet.betOn || '').toString().toLowerCase() === 'close';
        // Half Sangam is cross-side and settles on close declaration.
        return type === 'jodi' || type === 'full-sangam' || type === 'half-sangam' || (type === 'single' && isCloseSession) || (type === 'panna' && isCloseSession);
    };

    if (!closingNumber || !/^\d{3}$/.test(closingNumber)) {
        for (const bet of allBetsToday) {
            allMarketUserIds.add(bet.userId.toString());
            if (isCloseSettleTypeBet(bet)) {
                const amt = Number(bet.amount) || 0;
                totalBetAmount += amt;
                userIds.add(bet.userId.toString());
            }
        }
        totalBetAmount = Math.round(totalBetAmount * 100) / 100;
        return {
            totalBetAmount,
            noOfPlayers: userIds.size,
            profit: totalBetAmount,
            totalBetAmountOnPatti: 0,
            totalWinAmountOnPatti: 0,
            totalPlayersBetOnPatti: 0,
            totalPlayersInMarket: allMarketUserIds.size,
            totalBetAmountHalfSangam: 0,
            totalBetsHalfSangam: 0,
        };
    }

    const rates = await getRatesMap();
    const close3 = String(closingNumber || '').trim();
    const parsedResult = parseMarketResultParts(open3, close3);
    const { openAnk: lastDigitOpen, closeAnk: lastDigitClose } = parsedResult;
    const pannaTypeClose = getPannaType(close3);
    const pannaRateKeyClose = pannaTypeClose || 'singlePatti';
    const pannaRateClose = getRateForKey(rates, pannaRateKeyClose);

    let totalWinAmountOnPatti = 0;

    for (const bet of allBetsToday) {
        const type = (bet.betType || '').toLowerCase();
        const num = (bet.betNumber || '').toString().trim();
        const amount = Number(bet.amount) || 0;
        const isPending = (bet.status || '').toString().toLowerCase() === 'pending';
        allMarketUserIds.add(bet.userId.toString());
        const isCloseSession = (bet.betOn || '').toString().toLowerCase() === 'close';
        const isCloseSettleType =
            type === 'jodi' ||
            type === 'full-sangam' ||
            type === 'half-sangam' ||
            (type === 'single' && isCloseSession) ||
            (type === 'panna' && isCloseSession);
        if (!isCloseSettleType) continue;

        totalBetAmount += amount;
        userIds.add(bet.userId.toString());

        let isWinning = false;
        if (type === 'single' && isCloseSession && /^[0-9]$/.test(num)) {
            if (lastDigitClose != null && num === lastDigitClose) {
                totalBetAmountOnPatti += amount;
                playersBetOnPatti.add(bet.userId.toString());
                if (isPending) {
                    const payout = amount * getRateForKey(rates, 'single');
                    totalWinAmount += payout;
                    totalWinAmountOnPatti += payout;
                }
                isWinning = true;
            }
        } else if (type === 'panna' && isCloseSession && /^[0-9]{3}$/.test(num)) {
            if (num === close3) {
                totalBetAmountOnPatti += amount;
                playersBetOnPatti.add(bet.userId.toString());
                if (isPending) {
                    const payout = amount * pannaRateClose;
                    totalWinAmount += payout;
                    totalWinAmountOnPatti += payout;
                }
                isWinning = true;
            }
        } else if (type === 'jodi' && /^[0-9]{2}$/.test(num)) {
            const expectedJodi = (lastDigitOpen != null && lastDigitClose != null) ? (lastDigitOpen + lastDigitClose) : null;
            if (expectedJodi != null && num === expectedJodi) {
                totalBetAmountOnPatti += amount;
                playersBetOnPatti.add(bet.userId.toString());
                if (isPending) {
                    const payout = amount * getRateForKey(rates, 'jodi');
                    totalWinAmount += payout;
                    totalWinAmountOnPatti += payout;
                }
                isWinning = true;
            }
        } else if (type === 'full-sangam') {
            const parts = (num || '').split('-').map((p) => (p || '').trim());
            const betOpen3 = parts[0] || '';
            const betClose3 = parts[1] || '';
            if (/^[0-9]{3}$/.test(betOpen3) && /^[0-9]{3}$/.test(betClose3) && betOpen3 === open3 && betClose3 === close3) {
                totalBetAmountOnPatti += amount;
                playersBetOnPatti.add(bet.userId.toString());
                if (isPending) {
                    const payout = amount * getRateForKey(rates, 'fullSangam');
                    totalWinAmount += payout;
                    totalWinAmountOnPatti += payout;
                }
                isWinning = true;
            }
        } else if (type === 'half-sangam') {
            // Cross-side Half Sangam preview:
            // - Open Half:  Open Pana + Close Ank  (PPP-D)
            // - Close Half: Open Ank  + Close Pana (D-PPP)
            // Close-result dependent: never evaluate while close panna is missing/placeholder.
            if (canEvaluateHalfSangam(num, parsedResult) && isWinningHalfSangam(num, parsedResult)) {
                totalBetAmountOnPatti += amount;
                playersBetOnPatti.add(bet.userId.toString());
                if (isPending) {
                    const payout = amount * getRateForKey(rates, 'halfSangam');
                    totalWinAmount += payout;
                    totalWinAmountOnPatti += payout;
                }
                isWinning = true;
            }
        }
    }

    totalBetAmount = Math.round(totalBetAmount * 100) / 100;
    totalWinAmount = Math.round(totalWinAmount * 100) / 100;
    totalBetAmountOnPatti = Math.round(totalBetAmountOnPatti * 100) / 100;
    totalWinAmountOnPatti = Math.round(totalWinAmountOnPatti * 100) / 100;
    const profit = Math.round((totalBetAmount - totalWinAmount) * 100) / 100;
    // Same fields as Open: no totalWinAmount, no totalWinAmountHalfSangam
    return {
        totalBetAmount,
        noOfPlayers: userIds.size,
        profit,
        totalBetAmountOnPatti,
        totalWinAmountOnPatti,
        totalPlayersBetOnPatti: playersBetOnPatti.size,
        totalPlayersInMarket: allMarketUserIds.size,
        totalBetAmountHalfSangam: 0,
        totalBetsHalfSangam: 0,
    };
}

/**
 * Get list of winning bets (with payout) for open declaration. Same filter as previewDeclareOpen.
 */
export async function getWinningBetsForOpen(marketId, openingNumber, options = {}) {
    const oid = toObjectId(marketId);
    if (!oid) return { winningBets: [], totalWinAmount: 0 };
    const marketIdStr = String(marketId).trim();
    const bookieUserIds = options.bookieUserIds;
    const hasBookieFilter = Array.isArray(bookieUserIds) && bookieUserIds.length > 0;
    const todayMidnight = getTodayMidnight();
    const todayIST = getTodayISTRange();
    const matchFilter = {
        status: 'pending',
        $or: [{ marketId: oid }, { marketId: marketIdStr }],
        createdAt: { $gte: todayIST.start, $lte: todayIST.end },
        $and: [
            { $or: [{ isScheduled: { $ne: true } }, { scheduledDate: { $exists: false } }, { scheduledDate: null }, { scheduledDate: { $lte: todayMidnight } }] },
            { betOn: { $ne: 'close' } },
        ],
    };
    if (hasBookieFilter) matchFilter.userId = { $in: bookieUserIds };
    const pendingBets = await Bet.find(matchFilter).lean();
    const rates = await getRatesMap();
    const lastDigitOpen = openingNumber && /^\d{3}$/.test(openingNumber) ? digitFromPatti(openingNumber) : null;
    const open3 = openingNumber && /^\d{3}$/.test(openingNumber) ? openingNumber : null;
    const winningBets = [];
    let totalWinAmount = 0;
    for (const bet of pendingBets) {
        const type = (bet.betType || '').toLowerCase();
        const num = (bet.betNumber || '').toString().trim();
        const amount = Number(bet.amount) || 0;
        let payout = 0;
        if (type === 'single' && /^[0-9]$/.test(num) && lastDigitOpen != null && num === lastDigitOpen) {
            payout = amount * getRateForKey(rates, 'single');
        } else if (type === 'panna' && /^[0-9]{3}$/.test(num) && open3 != null && num === open3) {
            const pannaType = getPannaType(open3);
            const rateKey = pannaType || 'singlePatti';
            payout = amount * getRateForKey(rates, rateKey);
        }
        if (payout > 0) {
            payout = Math.round(payout * 100) / 100;
            totalWinAmount += payout;
            winningBets.push({ bet: { _id: bet._id, userId: bet.userId, betType: bet.betType, betNumber: bet.betNumber, amount: bet.amount }, payout });
        }
    }
    totalWinAmount = Math.round(totalWinAmount * 100) / 100;
    return { winningBets, totalWinAmount };
}

/**
 * Get list of winning bets (with payout) for close declaration. Same filter as previewDeclareClose.
 */
export async function getWinningBetsForClose(marketId, closingNumber, options = {}) {
    const oid = toObjectId(marketId);
    if (!oid) return { winningBets: [], totalWinAmount: 0 };
    const market = await Market.findById(oid).lean();
    if (!market) return { winningBets: [], totalWinAmount: 0 };
    const open3 = (market.openingNumber || '').toString();
    if (!/^\d{3}$/.test(open3)) return { winningBets: [], totalWinAmount: 0 };
    if (!closingNumber || !/^\d{3}$/.test(closingNumber)) return { winningBets: [], totalWinAmount: 0 };

    const marketIdStr = String(marketId).trim();
    const bookieUserIds = options.bookieUserIds;
    const hasBookieFilter = Array.isArray(bookieUserIds) && bookieUserIds.length > 0;
    const todayMidnight = getTodayMidnight();
    const todayIST = getTodayISTRange();
    const matchFilter = {
        status: 'pending',
        $or: [{ marketId: oid }, { marketId: marketIdStr }],
        createdAt: { $gte: todayIST.start, $lte: todayIST.end },
        $and: [{ $or: [{ isScheduled: { $ne: true } }, { scheduledDate: { $exists: false } }, { scheduledDate: null }, { scheduledDate: { $lte: todayMidnight } }] }],
    };
    if (hasBookieFilter) matchFilter.userId = { $in: bookieUserIds };
    const pendingBets = await Bet.find(matchFilter).lean();
    const rates = await getRatesMap();
    const close3 = String(closingNumber || '').trim();
    const parsedResult = parseMarketResultParts(open3, close3);
    const { openAnk: lastDigitOpen, closeAnk: lastDigitClose } = parsedResult;
    const pannaTypeClose = getPannaType(close3);
    const pannaRateKeyClose = pannaTypeClose || 'singlePatti';
    const winningBets = [];
    let totalWinAmount = 0;
    for (const bet of pendingBets) {
        const type = (bet.betType || '').toLowerCase();
        const num = (bet.betNumber || '').toString().trim();
        const amount = Number(bet.amount) || 0;
        const isCloseSession = (bet.betOn || '').toString().toLowerCase() === 'close';
        const isCloseSettleType =
            type === 'jodi' ||
            type === 'full-sangam' ||
            type === 'half-sangam' ||
            (type === 'single' && isCloseSession) ||
            (type === 'panna' && isCloseSession);
        if (!isCloseSettleType) continue;
        let payout = 0;
        if (type === 'single' && isCloseSession && /^[0-9]$/.test(num)) {
            if (num === lastDigitClose) payout = amount * getRateForKey(rates, 'single');
        } else if (type === 'panna' && isCloseSession && /^[0-9]{3}$/.test(num)) {
            if (num === close3) payout = amount * getRateForKey(rates, pannaRateKeyClose);
        } else if (type === 'jodi' && /^[0-9]{2}$/.test(num)) {
            const expectedJodi = (lastDigitOpen != null && lastDigitClose != null) ? (lastDigitOpen + lastDigitClose) : null;
            if (expectedJodi != null && num === expectedJodi) payout = amount * getRateForKey(rates, 'jodi');
        } else if (type === 'full-sangam') {
            const parts = (num || '').split('-').map((p) => (p || '').trim());
            const betOpen3 = parts[0] || '';
            const betClose3 = parts[1] || '';
            if (/^[0-9]{3}$/.test(betOpen3) && /^[0-9]{3}$/.test(betClose3) && betOpen3 === open3 && betClose3 === close3) {
                payout = amount * getRateForKey(rates, 'fullSangam');
            }
        } else if (type === 'half-sangam') {
            // Cross-side Half Sangam winner detection at close.
            // Guard by close-result availability so skipped bets remain pending until close exists.
            if (canEvaluateHalfSangam(num, parsedResult) && isWinningHalfSangam(num, parsedResult)) {
                payout = amount * getRateForKey(rates, 'halfSangam');
            }
        }
        if (payout > 0) {
            payout = Math.round(payout * 100) / 100;
            totalWinAmount += payout;
            winningBets.push({ bet: { _id: bet._id, userId: bet.userId, betType: bet.betType, betNumber: bet.betNumber, amount: bet.amount }, payout });
        }
    }
    totalWinAmount = Math.round(totalWinAmount * 100) / 100;
    return { winningBets, totalWinAmount };
}
