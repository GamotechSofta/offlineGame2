import mongoose from 'mongoose';
import Bet from '../models/bet/bet.js';
import Market from '../models/market/market.js';
import User from '../models/user/user.js';
import Admin from '../models/admin/admin.js';
import { Wallet, WalletTransaction } from '../models/wallet/wallet.js';
import { getRatesMap, DEFAULT_RATES } from '../models/rate/rate.js';
import { isSpCommon } from '../config/spCommonList.js';
import { isValidDoublePana } from './doublePanaValidate.js';

/** Normalize betNumber to 3-digit panna string or null. */
function normalizeThreeDigitPanna(num) {
    const raw = String(num ?? '').replace(/\D/g, '').slice(0, 3);
    return raw.length === 3 ? raw.padStart(3, '0') : null;
}

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

/** True if bet type is panna, sp-motor, or dp-motor (all settle as 3-digit panna). sp-common / dp-common: 3-digit = exact panna, else legacy digit (0-9). */
function isPannaLike(type) {
    const t = (type || '').toLowerCase();
    return t === 'panna' || t === 'sp-motor' || t === 'dp-motor';
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
        } else if (type === 'odd-even' && (num === 'odd' || num === 'even')) {
            const digit = openDigit != null ? Number(openDigit) : null;
            const isOddDigit = digit != null && digit % 2 === 1;
            const won = digit != null && ((num === 'odd' && isOddDigit) || (num === 'even' && !isOddDigit));
            const payout = won ? amount * getRateForKey(rates, 'oddEven') : 0;
            await Bet.updateOne(
                { _id: bet._id },
                { status: won ? 'won' : 'lost', payout }
            );
            if (won && payout > 0) {
                await payWinnings(bet.userId, payout, `Win – ${market.marketName} (Odd Even ${num})`, bet._id, { placedByBookie: bet.placedByBookie, placedByBookieId: bet.placedByBookieId });
            }
        } else if (type === 'sp-common') {
            const n3 = normalizeThreeDigitPanna(num);
            if (n3 && isSpCommon(n3)) {
                const won = open3 === n3;
                const payout = won ? amount * getRateForKey(rates, 'singlePatti') : 0;
                await Bet.updateOne(
                    { _id: bet._id },
                    { status: won ? 'won' : 'lost', payout }
                );
                if (won && payout > 0) {
                    await payWinnings(bet.userId, payout, `Win – ${market.marketName} (SP Common ${n3})`, bet._id, { placedByBookie: bet.placedByBookie, placedByBookieId: bet.placedByBookieId });
                }
            } else if (/^[0-9]$/.test(num)) {
                const won = openDigit != null && num === openDigit;
                const payout = won ? amount * getRateForKey(rates, 'single') : 0;
                await Bet.updateOne(
                    { _id: bet._id },
                    { status: won ? 'won' : 'lost', payout }
                );
                if (won && payout > 0) {
                    await payWinnings(bet.userId, payout, `Win – ${market.marketName} (SP Common ${num})`, bet._id, { placedByBookie: bet.placedByBookie, placedByBookieId: bet.placedByBookieId });
                }
            }
        } else if (type === 'dp-common') {
            const n3 = normalizeThreeDigitPanna(num);
            if (n3 && isValidDoublePana(n3)) {
                const won = open3 === n3;
                const payout = won ? amount * getRateForKey(rates, 'doublePatti') : 0;
                await Bet.updateOne(
                    { _id: bet._id },
                    { status: won ? 'won' : 'lost', payout }
                );
                if (won && payout > 0) {
                    await payWinnings(bet.userId, payout, `Win – ${market.marketName} (DP Common ${n3})`, bet._id, { placedByBookie: bet.placedByBookie, placedByBookieId: bet.placedByBookieId });
                }
            } else if (/^[0-9]$/.test(num)) {
                const won = openDigit != null && num === openDigit;
                const payout = won ? amount * getRateForKey(rates, 'doublePatti') : 0;
                await Bet.updateOne(
                    { _id: bet._id },
                    { status: won ? 'won' : 'lost', payout }
                );
                if (won && payout > 0) {
                    await payWinnings(bet.userId, payout, `Win – ${market.marketName} (DP Common ${num})`, bet._id, { placedByBookie: bet.placedByBookie, placedByBookieId: bet.placedByBookieId });
                }
            }
        } else if (isPannaLike(type) && /^[0-9]{3}$/.test(num)) {
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
        // CLOSE-session Odd Even (settles on closing digit)
        else if (type === 'odd-even' && (bet.betOn || '').toString().toLowerCase() === 'close' && (num === 'odd' || num === 'even')) {
            const digit = lastDigitClose != null ? Number(lastDigitClose) : null;
            const isOddDigit = digit != null && digit % 2 === 1;
            const won = digit != null && ((num === 'odd' && isOddDigit) || (num === 'even' && !isOddDigit));
            const payout = won ? amount * getRateForKey(rates, 'oddEven') : 0;
            await Bet.updateOne({ _id: bet._id }, { status: won ? 'won' : 'lost', payout });
            if (won && payout > 0) {
                await payWinnings(bet.userId, payout, `Win – ${market.marketName} (Odd Even ${num})`, bet._id, { placedByBookie: bet.placedByBookie, placedByBookieId: bet.placedByBookieId });
            }
        }
        // CLOSE-session SP Common: 3-digit = exact close panna; 1-digit = legacy close ank
        else if (type === 'sp-common' && (bet.betOn || '').toString().toLowerCase() === 'close') {
            const n3 = normalizeThreeDigitPanna(num);
            if (n3 && isSpCommon(n3)) {
                const won = n3 === close3;
                const payout = won ? amount * getRateForKey(rates, 'singlePatti') : 0;
                await Bet.updateOne({ _id: bet._id }, { status: won ? 'won' : 'lost', payout });
                if (won && payout > 0) {
                    await payWinnings(bet.userId, payout, `Win – ${market.marketName} (SP Common ${n3})`, bet._id, { placedByBookie: bet.placedByBookie, placedByBookieId: bet.placedByBookieId });
                }
            } else if (/^[0-9]$/.test(num)) {
                const won = num === lastDigitClose;
                const payout = won ? amount * getRateForKey(rates, 'single') : 0;
                await Bet.updateOne({ _id: bet._id }, { status: won ? 'won' : 'lost', payout });
                if (won && payout > 0) {
                    await payWinnings(bet.userId, payout, `Win – ${market.marketName} (SP Common ${num})`, bet._id, { placedByBookie: bet.placedByBookie, placedByBookieId: bet.placedByBookieId });
                }
            }
        }
        // CLOSE-session DP Common: 3-digit = exact close panna; 1-digit = legacy close ank
        else if (type === 'dp-common' && (bet.betOn || '').toString().toLowerCase() === 'close') {
            const n3 = normalizeThreeDigitPanna(num);
            if (n3 && isValidDoublePana(n3)) {
                const won = n3 === close3;
                const payout = won ? amount * getRateForKey(rates, 'doublePatti') : 0;
                await Bet.updateOne({ _id: bet._id }, { status: won ? 'won' : 'lost', payout });
                if (won && payout > 0) {
                    await payWinnings(bet.userId, payout, `Win – ${market.marketName} (DP Common ${n3})`, bet._id, { placedByBookie: bet.placedByBookie, placedByBookieId: bet.placedByBookieId });
                }
            } else if (/^[0-9]$/.test(num)) {
                const won = num === lastDigitClose;
                const payout = won ? amount * getRateForKey(rates, 'doublePatti') : 0;
                await Bet.updateOne({ _id: bet._id }, { status: won ? 'won' : 'lost', payout });
                if (won && payout > 0) {
                    await payWinnings(bet.userId, payout, `Win – ${market.marketName} (DP Common ${num})`, bet._id, { placedByBookie: bet.placedByBookie, placedByBookieId: bet.placedByBookieId });
                }
            }
        }
        // CLOSE-session Patti/Panna (settles on closing patti); sp-motor same as panna
        else if (isPannaLike(type) && (bet.betOn || '').toString().toLowerCase() === 'close' && /^[0-9]{3}$/.test(num)) {
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
 * In-memory open preview (same rules as previewDeclareOpen main bet loop). For profit-outcome scans.
 * @param {object[]} allOpenBets
 * @param {string|null} open3 - three-digit string or null
 * @param {object} rates - rates map from getRatesMap()
 */
export function computeOpenPreviewFromBets(allOpenBets, open3, rates) {
    const open3n = open3 && /^\d{3}$/.test(String(open3)) ? String(open3).padStart(3, '0') : null;
    const lastDigitOpen = open3n ? digitFromPatti(open3n) : null;

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
        } else if (type === 'odd-even') {
            const num = (bet.betNumber || '').toString().trim().toLowerCase();
            if (num === 'odd' || num === 'even') {
                totalBetAmount += amount;
                userIds.add(bet.userId.toString());
                if (lastDigitOpen != null) {
                    const digit = Number(lastDigitOpen);
                    const isOddDigit = digit % 2 === 1;
                    if ((num === 'odd' && isOddDigit) || (num === 'even' && !isOddDigit)) {
                        totalBetAmountOnPatti += amount;
                        playersBetOnPatti.add(bet.userId.toString());
                        if (isPending) {
                            const payout = amount * getRateForKey(rates, 'oddEven');
                            totalWinAmount += payout;
                            totalWinAmountOnPatti += payout;
                        }
                    }
                }
            }
        } else if (type === 'sp-common') {
            const n3 = normalizeThreeDigitPanna(rawNum);
            totalBetAmount += amount;
            userIds.add(bet.userId.toString());
            if (n3 && isSpCommon(n3)) {
                if (open3n != null && n3 === open3n) {
                    totalBetAmountOnPatti += amount;
                    playersBetOnPatti.add(bet.userId.toString());
                    if (isPending) {
                        const payout = amount * getRateForKey(rates, 'singlePatti');
                        totalWinAmount += payout;
                        totalWinAmountOnPatti += payout;
                    }
                }
            } else if (/^[0-9]$/.test(rawNum)) {
                const num = rawNum;
                if (lastDigitOpen != null && num === lastDigitOpen) {
                    totalBetAmountOnPatti += amount;
                    playersBetOnPatti.add(bet.userId.toString());
                    if (isPending) {
                        const payout = amount * getRateForKey(rates, 'single');
                        totalWinAmount += payout;
                        totalWinAmountOnPatti += payout;
                    }
                }
            }
        } else if (type === 'dp-common') {
            const n3 = normalizeThreeDigitPanna(rawNum);
            totalBetAmount += amount;
            userIds.add(bet.userId.toString());
            if (n3 && isValidDoublePana(n3)) {
                if (open3n != null && n3 === open3n) {
                    totalBetAmountOnPatti += amount;
                    playersBetOnPatti.add(bet.userId.toString());
                    if (isPending) {
                        const payout = amount * getRateForKey(rates, 'doublePatti');
                        totalWinAmount += payout;
                        totalWinAmountOnPatti += payout;
                    }
                }
            } else if (/^[0-9]$/.test(rawNum)) {
                const num = rawNum;
                if (lastDigitOpen != null && num === lastDigitOpen) {
                    totalBetAmountOnPatti += amount;
                    playersBetOnPatti.add(bet.userId.toString());
                    if (isPending) {
                        const payout = amount * getRateForKey(rates, 'doublePatti');
                        totalWinAmount += payout;
                        totalWinAmountOnPatti += payout;
                    }
                }
            }
        } else if (isPannaLike(type) && rawNum.length >= 3) {
            const num = rawNum.slice(0, 3).padStart(3, '0');
            totalBetAmount += amount;
            userIds.add(bet.userId.toString());
            if (open3n != null && num === open3n) {
                totalBetAmountOnPatti += amount;
                playersBetOnPatti.add(bet.userId.toString());
                if (isPending) {
                    const pannaType = getPannaType(open3n);
                    const rateKey = pannaType || 'singlePatti';
                    const payout = amount * getRateForKey(rates, rateKey);
                    totalWinAmount += payout;
                    totalWinAmountOnPatti += payout;
                }
            }
        }
    }

    totalBetAmount = Math.round(totalBetAmount * 100) / 100;
    totalWinAmount = Math.round(totalWinAmount * 100) / 100;
    totalBetAmountOnPatti = Math.round(totalBetAmountOnPatti * 100) / 100;
    totalWinAmountOnPatti = Math.round(totalWinAmountOnPatti * 100) / 100;
    const profit = Math.round((totalBetAmount - totalWinAmount) * 100) / 100;

    return {
        totalBetAmount,
        totalWinAmount,
        profit,
        totalBetAmountOnPatti,
        totalWinAmountOnPatti,
        noOfPlayers: userIds.size,
        totalPlayersBetOnPatti: playersBetOnPatti.size,
        allMarketUserIds,
    };
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

    const core = computeOpenPreviewFromBets(allOpenBets, open3, rates);
    let {
        totalBetAmount,
        profit,
        totalBetAmountOnPatti,
        totalWinAmountOnPatti,
        noOfPlayers,
        totalPlayersBetOnPatti,
        allMarketUserIds,
    } = core;

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

    // Jodi percentage based on the same "Open Digit" rule used in this codebase:
    // digitFromPatti("123") -> "6" (because 1+2+3=6).
    // Then compute what % of today's Jodi bets (by bet count) start with that digit (betNumber first digit).
    const derivedSingleDigit = open3 ? digitFromPatti(open3) : null;

    let jodiPercentage = 0;
    let jodiStartDigit = derivedSingleDigit;

    try {
        const matchFilterJodi = {
            marketId: oid,
            betType: 'jodi',
            createdAt: { $gte: todayIST.start, $lte: todayIST.end },
        };
        if (hasBookieFilter) matchFilterJodi.userId = { $in: bookieUserIds };

        const jodiBets = await Bet.find(matchFilterJodi).lean();

        if (derivedSingleDigit != null) {
            let totalJodiBets = 0;
            let startDigitJodiBets = 0;

            for (const bet of jodiBets) {
                const num = (bet.betNumber || '')
                    .toString()
                    .trim()
                    .replace(/\D/g, '');
                if (!/^[0-9]{2}$/.test(num)) continue;

                totalJodiBets += 1;
                if (num[0] === String(derivedSingleDigit)) startDigitJodiBets += 1;
            }

            jodiPercentage = totalJodiBets ? (startDigitJodiBets / totalJodiBets) * 100 : 0;
            jodiPercentage = Math.round(jodiPercentage * 100) / 100; // 2 decimals
        }
    } catch (_) {
        // Keep percentage at default 0 if jodi query fails.
    }

    return {
        totalBetAmount,
        noOfPlayers,
        profit,
        totalBetAmountOnPatti,
        totalWinAmountOnPatti,
        totalPlayersBetOnPatti,
        totalPlayersInMarket: allMarketUserIds.size,
        totalBetAmountHalfSangam,
        totalBetsHalfSangam: halfSangamBets.length,
        jodiPercentage,
        jodiStartDigit,
    };
}

/**
 * In-memory close preview for fixed open3 + candidate close3 (same rules as previewDeclareClose bet loop).
 */
export function computeClosePreviewFromBets(allBetsToday, open3, close3, rates) {
    const parsedResult = parseMarketResultParts(open3, close3);
    const { openAnk: lastDigitOpen, closeAnk: lastDigitClose } = parsedResult;
    const pannaTypeClose = getPannaType(close3);
    const pannaRateClose = getRateForKey(rates, pannaTypeClose || 'singlePatti');

    let totalBetAmount = 0;
    let totalWinAmount = 0;
    let totalBetAmountOnPatti = 0;
    let totalWinAmountOnPatti = 0;
    const userIds = new Set();
    const playersBetOnPatti = new Set();
    const allMarketUserIds = new Set();

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
            (type === 'odd-even' && isCloseSession) ||
            (type === 'sp-common' && isCloseSession) ||
            (type === 'dp-common' && isCloseSession) ||
            (isPannaLike(type) && isCloseSession);
        if (!isCloseSettleType) continue;

        totalBetAmount += amount;
        userIds.add(bet.userId.toString());

        if (type === 'sp-common' && isCloseSession) {
            const n3 = normalizeThreeDigitPanna(num);
            if (n3 && isSpCommon(n3)) {
                if (n3 === close3) {
                    totalBetAmountOnPatti += amount;
                    playersBetOnPatti.add(bet.userId.toString());
                    if (isPending) {
                        const payout = amount * getRateForKey(rates, 'singlePatti');
                        totalWinAmount += payout;
                        totalWinAmountOnPatti += payout;
                    }
                }
            } else if (/^[0-9]$/.test(num)) {
                if (lastDigitClose != null && num === lastDigitClose) {
                    totalBetAmountOnPatti += amount;
                    playersBetOnPatti.add(bet.userId.toString());
                    if (isPending) {
                        const payout = amount * getRateForKey(rates, 'single');
                        totalWinAmount += payout;
                        totalWinAmountOnPatti += payout;
                    }
                }
            }
        } else if (type === 'dp-common' && isCloseSession) {
            const n3 = normalizeThreeDigitPanna(num);
            if (n3 && isValidDoublePana(n3)) {
                if (n3 === close3) {
                    totalBetAmountOnPatti += amount;
                    playersBetOnPatti.add(bet.userId.toString());
                    if (isPending) {
                        const payout = amount * getRateForKey(rates, 'doublePatti');
                        totalWinAmount += payout;
                        totalWinAmountOnPatti += payout;
                    }
                }
            } else if (/^[0-9]$/.test(num)) {
                if (lastDigitClose != null && num === lastDigitClose) {
                    totalBetAmountOnPatti += amount;
                    playersBetOnPatti.add(bet.userId.toString());
                    if (isPending) {
                        const payout = amount * getRateForKey(rates, 'doublePatti');
                        totalWinAmount += payout;
                        totalWinAmountOnPatti += payout;
                    }
                }
            }
        } else if (type === 'single' && isCloseSession && /^[0-9]$/.test(num)) {
            if (lastDigitClose != null && num === lastDigitClose) {
                totalBetAmountOnPatti += amount;
                playersBetOnPatti.add(bet.userId.toString());
                if (isPending) {
                    const payout = amount * getRateForKey(rates, 'single');
                    totalWinAmount += payout;
                    totalWinAmountOnPatti += payout;
                }
            }
        } else if (type === 'odd-even' && isCloseSession && (num === 'odd' || num === 'even')) {
            const digit = lastDigitClose != null ? Number(lastDigitClose) : null;
            const isOddDigit = digit != null && digit % 2 === 1;
            if (digit != null && ((num === 'odd' && isOddDigit) || (num === 'even' && !isOddDigit))) {
                totalBetAmountOnPatti += amount;
                playersBetOnPatti.add(bet.userId.toString());
                if (isPending) {
                    const payout = amount * getRateForKey(rates, 'oddEven');
                    totalWinAmount += payout;
                    totalWinAmountOnPatti += payout;
                }
            }
        } else if (isPannaLike(type) && isCloseSession && /^[0-9]{3}$/.test(num)) {
            if (num === close3) {
                totalBetAmountOnPatti += amount;
                playersBetOnPatti.add(bet.userId.toString());
                if (isPending) {
                    const payout = amount * pannaRateClose;
                    totalWinAmount += payout;
                    totalWinAmountOnPatti += payout;
                }
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
            }
        } else if (type === 'half-sangam') {
            if (canEvaluateHalfSangam(num, parsedResult) && isWinningHalfSangam(num, parsedResult)) {
                totalBetAmountOnPatti += amount;
                playersBetOnPatti.add(bet.userId.toString());
                if (isPending) {
                    const payout = amount * getRateForKey(rates, 'halfSangam');
                    totalWinAmount += payout;
                    totalWinAmountOnPatti += payout;
                }
            }
        }
    }

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
        return type === 'jodi' || type === 'full-sangam' || type === 'half-sangam' || (type === 'single' && isCloseSession) || (type === 'odd-even' && isCloseSession) || (type === 'sp-common' && isCloseSession) || (type === 'dp-common' && isCloseSession) || (isPannaLike(type) && isCloseSession);
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
    const out = computeClosePreviewFromBets(allBetsToday, open3, close3, rates);
    return {
        ...out,
        totalBetAmountHalfSangam: 0,
        totalBetsHalfSangam: 0,
    };
}

/** Parse tolerance from API: default 2; allow 0 for exact match (do not treat 0 as falsy). */
function normalizeProfitScanTolerance(tolerance) {
    const t = Number(tolerance);
    if (!Number.isFinite(t)) return 2;
    return Math.min(50, Math.max(0, t));
}

/**
 * True if house profit % is within tolerance of target.
 * Uses 2-decimal rounding for both sides — same as chips in the bucket table and `profitPercent` in responses —
 * so tolerance 0 matches what you see (e.g. 9.58%) instead of failing on float noise.
 */
function profitPercentMatchesTarget(pct, targetPct, tol) {
    const p = Number(pct);
    const tgt = Number(targetPct);
    if (!Number.isFinite(p) || !Number.isFinite(tgt)) return false;
    const pR = Math.round(p * 100) / 100;
    const tR = Math.round(tgt * 100) / 100;
    return Math.abs(pR - tR) <= tol;
}

/**
 * 3-digit pannas that appear on open-session tickets (panna / sp-dp common as 3-digit), i.e. numbers players actually played.
 */
function collectOpenBetPannaCandidates(allOpenBets) {
    const set = new Set();
    for (const bet of allOpenBets) {
        const type = (bet.betType || '').toLowerCase();
        const rawNum = (bet.betNumber || '').toString().trim().replace(/\D/g, '');
        const isCloseSession = (bet.betOn || '').toString().toLowerCase() === 'close';
        if (isCloseSession) continue;

        if (isPannaLike(type) && rawNum.length >= 3) {
            set.add(rawNum.slice(0, 3).padStart(3, '0'));
        } else if (type === 'sp-common') {
            const n3 = normalizeThreeDigitPanna(rawNum);
            if (n3 && isSpCommon(n3)) set.add(n3);
        } else if (type === 'dp-common') {
            const n3 = normalizeThreeDigitPanna(rawNum);
            if (n3 && isValidDoublePana(n3)) set.add(n3);
        }
    }
    return set;
}

/**
 * 3-digit closing pannas that appear on close-side tickets (or full sangam second leg matching open).
 */
function collectCloseBetPannaCandidates(allBetsToday, open3Fixed) {
    const set = new Set();
    const open3 = /^\d{3}$/.test(String(open3Fixed || '').trim()) ? String(open3Fixed).trim().padStart(3, '0') : null;
    if (!open3) return set;

    for (const bet of allBetsToday) {
        const type = (bet.betType || '').toLowerCase();
        const rawStr = (bet.betNumber || '').toString().trim();
        const digits = rawStr.replace(/\D/g, '');
        const isCloseSession = (bet.betOn || '').toString().toLowerCase() === 'close';

        if (type === 'sp-common' && isCloseSession) {
            const n3 = normalizeThreeDigitPanna(digits);
            if (n3 && isSpCommon(n3)) set.add(n3);
        } else if (type === 'dp-common' && isCloseSession) {
            const n3 = normalizeThreeDigitPanna(digits);
            if (n3 && isValidDoublePana(n3)) set.add(n3);
        } else if (isPannaLike(type) && isCloseSession && digits.length >= 3) {
            set.add(digits.slice(0, 3).padStart(3, '0'));
        } else if (type === 'full-sangam') {
            const parts = rawStr.split('-').map((p) => (p || '').trim());
            const betOpen3 = (parts[0] || '').replace(/\D/g, '').slice(0, 3).padStart(3, '0');
            const betClose3 = (parts[1] || '').replace(/\D/g, '').slice(0, 3).padStart(3, '0');
            if (/^[0-9]{3}$/.test(betOpen3) && /^[0-9]{3}$/.test(betClose3) && betOpen3 === open3) {
                set.add(betClose3);
            }
        } else if (type === 'half-sangam') {
            const normalized = rawStr.replace(/[._·]/g, '-');
            const parts = normalized.split('-').map((p) => (p || '').trim()).filter(Boolean);
            if (parts.length === 2 && /^[0-9]$/.test(parts[0]) && /^[0-9]{3}$/.test(parts[1])) {
                set.add(parts[1].padStart(3, '0'));
            }
        }
    }
    return set;
}

/**
 * Admin tool: among 3-digit pannas that players actually bet on, list those whose open-declare preview has house profit % ≈ target.
 * Profit % = (pool − payout) / pool × 100 on open-session bets only (same as preview declare open).
 */
export async function scanProfitOutcomesOpen(marketId, targetPct, tolerance = 2, options = {}) {
    const oid = toObjectId(marketId);
    if (!oid) return { success: false, message: 'Invalid market', matches: [] };
    const bookieUserIds = options.bookieUserIds;
    const hasBookieFilter = Array.isArray(bookieUserIds) && bookieUserIds.length > 0;
    const todayIST = getTodayISTRange();
    const matchFilterAll = {
        marketId: oid,
        betOn: { $ne: 'close' },
        createdAt: { $gte: todayIST.start, $lte: todayIST.end },
    };
    if (hasBookieFilter) matchFilterAll.userId = { $in: bookieUserIds };

    const allOpenBets = await Bet.find(matchFilterAll).lean();
    const rates = await getRatesMap();
    const matches = [];
    const tol = normalizeProfitScanTolerance(tolerance);
    const tgt = Number(targetPct);

    const candidates = collectOpenBetPannaCandidates(allOpenBets);
    const toScan = candidates.size > 0 ? [...candidates].sort() : [];

    for (const open3 of toScan) {
        const { totalBetAmount, profit } = computeOpenPreviewFromBets(allOpenBets, open3, rates);
        if (totalBetAmount <= 0) continue;
        const pct = (profit / totalBetAmount) * 100;
        if (profitPercentMatchesTarget(pct, tgt, tol)) {
            matches.push({
                openingPanna: open3,
                profit,
                totalBetAmount,
                profitPercent: Math.round(pct * 100) / 100,
            });
        }
    }
    matches.sort((a, b) => Math.abs(a.profitPercent - tgt) - Math.abs(b.profitPercent - tgt));
    return {
        success: true,
        mode: 'open',
        targetPct: tgt,
        tolerance: tol,
        onlyPlayedPannas: true,
        betPannaCount: candidates.size,
        count: matches.length,
        matches,
    };
}

/**
 * Admin tool: closing pannas (000–999) whose close-declare preview has house profit % ≈ target (open must be declared).
 */
export async function scanProfitOutcomesClose(marketId, targetPct, tolerance = 2, options = {}) {
    const oid = toObjectId(marketId);
    if (!oid) return { success: false, message: 'Invalid market', matches: [] };
    const market = await Market.findById(oid).lean();
    if (!market) return { success: false, message: 'Market not found', matches: [] };
    const open3 = (market.openingNumber || '').toString();
    if (!/^\d{3}$/.test(open3)) {
        return { success: false, message: 'Opening result not declared yet', matches: [] };
    }

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
                    { scheduledDate: { $lte: todayMidnight } },
                ],
            },
        ],
    };
    if (hasBookieFilter) matchFilterAll.userId = { $in: bookieUserIds };

    const allBetsToday = await Bet.find(matchFilterAll).lean();
    const rates = await getRatesMap();
    const matches = [];
    const tol = normalizeProfitScanTolerance(tolerance);
    const tgt = Number(targetPct);

    const candidates = collectCloseBetPannaCandidates(allBetsToday, open3);
    const toScan = candidates.size > 0 ? [...candidates].sort() : [];

    for (const close3 of toScan) {
        const { totalBetAmount, profit } = computeClosePreviewFromBets(allBetsToday, open3, close3, rates);
        if (totalBetAmount <= 0) continue;
        const pct = (profit / totalBetAmount) * 100;
        if (profitPercentMatchesTarget(pct, tgt, tol)) {
            matches.push({
                openPanna: open3,
                closingPanna: close3,
                profit,
                totalBetAmount,
                profitPercent: Math.round(pct * 100) / 100,
            });
        }
    }
    matches.sort((a, b) => Math.abs(a.profitPercent - tgt) - Math.abs(b.profitPercent - tgt));
    return {
        success: true,
        mode: 'close',
        openPanna: open3,
        targetPct: tgt,
        tolerance: tol,
        onlyPlayedPannas: true,
        betPannaCount: candidates.size,
        count: matches.length,
        matches,
    };
}

/** House profit % tiers shown in admin (10% … 100%). */
export const PROFIT_BUCKET_TARGETS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

/** Map actual profit % to nearest 10% label (10–100). */
function nearestProfitBucketTen(pct) {
    const p = Number(pct);
    if (!Number.isFinite(p)) return 10;
    let b = Math.round(p / 10) * 10;
    if (b < 10) b = 10;
    if (b > 100) b = 100;
    return b;
}

const BUCKET_NEAREST_FILL_MAX = 20;

/** If a band has no nearest-10 matches, fill with played pannas closest to that band’s % (so 10–100 rows always have data when any panna exists). */
function fillEmptyBucketsWithNearest(allRows, bucketMap) {
    for (const T of PROFIT_BUCKET_TARGETS) {
        const arr = bucketMap.get(T);
        if (arr.length > 0) continue;
        const ranked = [...allRows]
            .map((row) => ({
                row,
                d: Math.abs(Number(row.profitPercent) - T),
            }))
            .sort((a, b) => a.d - b.d || b.row.profitPercent - a.row.profitPercent)
            .slice(0, BUCKET_NEAREST_FILL_MAX);
        for (const { row } of ranked) {
            arr.push({ ...row, nearestBandFill: true });
        }
    }
}

/**
 * All played open pannas with preview profit %, grouped under nearest 10% tier (10 … 100).
 */
export async function scanProfitBucketsOpen(marketId, options = {}) {
    const oid = toObjectId(marketId);
    if (!oid) return { success: false, message: 'Invalid market', buckets: [] };
    const bookieUserIds = options.bookieUserIds;
    const hasBookieFilter = Array.isArray(bookieUserIds) && bookieUserIds.length > 0;
    const todayIST = getTodayISTRange();
    const matchFilterAll = {
        marketId: oid,
        betOn: { $ne: 'close' },
        createdAt: { $gte: todayIST.start, $lte: todayIST.end },
    };
    if (hasBookieFilter) matchFilterAll.userId = { $in: bookieUserIds };

    const allOpenBets = await Bet.find(matchFilterAll).lean();
    const rates = await getRatesMap();
    const candidates = collectOpenBetPannaCandidates(allOpenBets);
    const toScan = candidates.size > 0 ? [...candidates].sort() : [];

    const allRows = [];
    for (const open3 of toScan) {
        const { totalBetAmount, profit } = computeOpenPreviewFromBets(allOpenBets, open3, rates);
        if (totalBetAmount <= 0) continue;
        const pct = (profit / totalBetAmount) * 100;
        const profitPercent = Math.round(pct * 100) / 100;
        allRows.push({
            openingPanna: open3,
            profit,
            totalBetAmount,
            profitPercent,
        });
    }

    const bucketMap = new Map(PROFIT_BUCKET_TARGETS.map((t) => [t, []]));
    for (const row of allRows) {
        const b = nearestProfitBucketTen(row.profitPercent);
        const arr = bucketMap.get(b);
        if (arr) arr.push({ ...row });
    }
    if (allRows.length > 0) {
        fillEmptyBucketsWithNearest(allRows, bucketMap);
    }
    for (const t of PROFIT_BUCKET_TARGETS) {
        bucketMap.get(t).sort((a, b) => b.profitPercent - a.profitPercent);
    }
    const buckets = PROFIT_BUCKET_TARGETS.map((targetPct) => ({
        targetPct,
        matches: bucketMap.get(targetPct) || [],
        nearestFill: (bucketMap.get(targetPct) || []).some((m) => m.nearestBandFill),
    }));
    return {
        success: true,
        mode: 'open',
        onlyPlayedPannas: true,
        betPannaCount: candidates.size,
        grouping: 'nearest10PlusFill',
        buckets,
    };
}

/**
 * All played close pannas with preview profit %, grouped under nearest 10% tier (open must be declared).
 */
export async function scanProfitBucketsClose(marketId, options = {}) {
    const oid = toObjectId(marketId);
    if (!oid) return { success: false, message: 'Invalid market', buckets: [] };
    const market = await Market.findById(oid).lean();
    if (!market) return { success: false, message: 'Market not found', buckets: [] };
    const open3 = (market.openingNumber || '').toString();
    if (!/^\d{3}$/.test(open3)) {
        return { success: false, message: 'Opening result not declared yet', buckets: [] };
    }

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
                    { scheduledDate: { $lte: todayMidnight } },
                ],
            },
        ],
    };
    if (hasBookieFilter) matchFilterAll.userId = { $in: bookieUserIds };

    const allBetsToday = await Bet.find(matchFilterAll).lean();
    const rates = await getRatesMap();
    const candidates = collectCloseBetPannaCandidates(allBetsToday, open3);
    const toScan = candidates.size > 0 ? [...candidates].sort() : [];

    const allRows = [];
    for (const close3 of toScan) {
        const { totalBetAmount, profit } = computeClosePreviewFromBets(allBetsToday, open3, close3, rates);
        if (totalBetAmount <= 0) continue;
        const pct = (profit / totalBetAmount) * 100;
        const profitPercent = Math.round(pct * 100) / 100;
        allRows.push({
            openPanna: open3,
            closingPanna: close3,
            profit,
            totalBetAmount,
            profitPercent,
        });
    }

    const bucketMap = new Map(PROFIT_BUCKET_TARGETS.map((t) => [t, []]));
    for (const row of allRows) {
        const b = nearestProfitBucketTen(row.profitPercent);
        const arr = bucketMap.get(b);
        if (arr) arr.push({ ...row });
    }
    if (allRows.length > 0) {
        fillEmptyBucketsWithNearest(allRows, bucketMap);
    }
    for (const t of PROFIT_BUCKET_TARGETS) {
        bucketMap.get(t).sort((a, b) => b.profitPercent - a.profitPercent);
    }
    const buckets = PROFIT_BUCKET_TARGETS.map((targetPct) => ({
        targetPct,
        matches: bucketMap.get(targetPct) || [],
        nearestFill: (bucketMap.get(targetPct) || []).some((m) => m.nearestBandFill),
    }));
    return {
        success: true,
        mode: 'close',
        openPanna: open3,
        onlyPlayedPannas: true,
        betPannaCount: candidates.size,
        grouping: 'nearest10PlusFill',
        buckets,
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
        } else if (type === 'odd-even' && (num === 'odd' || num === 'even') && lastDigitOpen != null) {
            const digit = Number(lastDigitOpen);
            const isOddDigit = digit % 2 === 1;
            if ((num === 'odd' && isOddDigit) || (num === 'even' && !isOddDigit)) {
                payout = amount * getRateForKey(rates, 'oddEven');
            }
        } else if (type === 'sp-common') {
            const n3 = normalizeThreeDigitPanna(num);
            if (n3 && isSpCommon(n3) && open3 != null && n3 === open3) {
                payout = amount * getRateForKey(rates, 'singlePatti');
            } else if (/^[0-9]$/.test(num) && lastDigitOpen != null && num === lastDigitOpen) {
                payout = amount * getRateForKey(rates, 'single');
            }
        } else if (type === 'dp-common') {
            const n3 = normalizeThreeDigitPanna(num);
            if (n3 && isValidDoublePana(n3) && open3 != null && n3 === open3) {
                payout = amount * getRateForKey(rates, 'doublePatti');
            } else if (/^[0-9]$/.test(num) && lastDigitOpen != null && num === lastDigitOpen) {
                payout = amount * getRateForKey(rates, 'doublePatti');
            }
        } else if (isPannaLike(type) && /^[0-9]{3}$/.test(num) && open3 != null && num === open3) {
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
            (type === 'odd-even' && isCloseSession) ||
            (type === 'sp-common' && isCloseSession) ||
            (type === 'dp-common' && isCloseSession) ||
            (isPannaLike(type) && isCloseSession);
        if (!isCloseSettleType) continue;
        let payout = 0;
        if (type === 'sp-common' && isCloseSession) {
            const n3w = normalizeThreeDigitPanna(num);
            if (n3w && isSpCommon(n3w) && n3w === close3) {
                payout = amount * getRateForKey(rates, 'singlePatti');
            } else if (/^[0-9]$/.test(num) && num === lastDigitClose) {
                payout = amount * getRateForKey(rates, 'single');
            }
        } else if (type === 'dp-common' && isCloseSession) {
            const n3w = normalizeThreeDigitPanna(num);
            if (n3w && isValidDoublePana(n3w) && n3w === close3) {
                payout = amount * getRateForKey(rates, 'doublePatti');
            } else if (/^[0-9]$/.test(num) && num === lastDigitClose) {
                payout = amount * getRateForKey(rates, 'doublePatti');
            }
        } else if (type === 'single' && isCloseSession && /^[0-9]$/.test(num)) {
            if (num === lastDigitClose) payout = amount * getRateForKey(rates, 'single');
        } else if (type === 'odd-even' && isCloseSession && (num === 'odd' || num === 'even')) {
            const digit = lastDigitClose != null ? Number(lastDigitClose) : null;
            const isOddDigit = digit != null && digit % 2 === 1;
            if (digit != null && ((num === 'odd' && isOddDigit) || (num === 'even' && !isOddDigit))) {
                payout = amount * getRateForKey(rates, 'oddEven');
            }
        } else if (isPannaLike(type) && isCloseSession && /^[0-9]{3}$/.test(num)) {
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
