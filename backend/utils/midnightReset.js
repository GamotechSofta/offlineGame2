/**
 * Scheduled task to reset all market results at midnight IST (12:00 AM).
 * This runs automatically every day and clears openingNumber and closingNumber for all markets.
 * Results are saved to MarketResult history before clearing.
 */

import Market from '../models/market/market.js';
import MarketResult from '../models/marketResult/marketResult.js';

/** Current date in IST as YYYY-MM-DD */
function getTodayIST() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
}

/** Yesterday's date in IST as YYYY-MM-DD */
function getYesterdayIST() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(d);
}

/** Get current time in IST */
function getCurrentTimeIST() {
    return new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).format(new Date());
}

function computeDisplayResult(openingNumber, closingNumber) {
    const opening = openingNumber && /^\d{3}$/.test(String(openingNumber)) ? String(openingNumber) : null;
    const closing = closingNumber && /^\d{3}$/.test(String(closingNumber)) ? String(closingNumber) : null;
    const openingDisplay = opening ? opening : '***';
    const closingDisplay = closing ? closing : '***';
    const sumDigits = (s) => [...s].reduce((acc, c) => acc + parseInt(c, 10), 0);
    let displayResult = '***-**-***';
    if (opening) {
        const first = sumDigits(opening) % 10;
        if (!closing) {
            displayResult = `${openingDisplay}-${first}*-${closingDisplay}`;
        } else {
            const second = sumDigits(closing) % 10;
            displayResult = `${openingDisplay}-${first}${second}-${closingDisplay}`;
        }
    }
    return displayResult;
}

/**
 * Save current result of each market (that has opening/closing set) to MarketResult for yesterday's dateKey.
 * Ensures view history is preserved before we clear the live market documents.
 */
async function saveYesterdaySnapshotsToHistory() {
    const yesterdayKey = getYesterdayIST();
    const marketsWithResults = await Market.find({
        $or: [
            { openingNumber: { $nin: [null, ''] } },
            { closingNumber: { $nin: [null, ''] } },
        ],
    }).lean();

    console.log(`[Midnight Reset] Saving ${marketsWithResults.length} market results to history for ${yesterdayKey}`);

    for (const m of marketsWithResults) {
        const displayResult = computeDisplayResult(m.openingNumber, m.closingNumber);
        await MarketResult.findOneAndUpdate(
            { marketId: m._id, dateKey: yesterdayKey },
            {
                $set: {
                    marketName: m.marketName,
                    openingNumber: m.openingNumber ?? null,
                    closingNumber: m.closingNumber ?? null,
                    displayResult: displayResult || '***-**-***',
                },
            },
            { upsert: true, new: true }
        );
    }
}

/**
 * Reset all market results by clearing openingNumber and closingNumber.
 * This is called at midnight IST to prepare markets for the new day.
 */
async function resetAllMarketResults() {
    try {
        console.log('[Midnight Reset] Starting market result reset at midnight IST...');
        
        // First, save yesterday's results to history
        await saveYesterdaySnapshotsToHistory();
        
        // Then clear all market results
        const result = await Market.updateMany(
            {},
            { $set: { openingNumber: null, closingNumber: null, result: null } }
        );
        
        console.log(`[Midnight Reset] Successfully reset ${result.modifiedCount} market results at midnight IST`);
        return { success: true, resetCount: result.modifiedCount };
    } catch (error) {
        console.error('[Midnight Reset] Error resetting market results:', error);
        return { success: false, error: error.message };
    }
}

let lastResetDate = null;
let resetInProgress = false;

/**
 * Check if it's midnight IST and reset results if needed.
 * This function is called periodically (every minute) to check for midnight.
 */
export async function checkAndResetAtMidnight() {
    // Prevent concurrent resets
    if (resetInProgress) {
        return;
    }

    const currentTime = getCurrentTimeIST();
    const today = getTodayIST();
    
    // Check if it's exactly midnight (00:00:00 to 00:00:59 IST)
    const isMidnight = currentTime.startsWith('00:00:');
    
    // Check if we've already reset today
    if (lastResetDate === today) {
        return;
    }
    
    // If it's midnight and we haven't reset today, do the reset
    if (isMidnight) {
        resetInProgress = true;
        try {
            await resetAllMarketResults();
            lastResetDate = today;
            console.log(`[Midnight Reset] Market results reset completed for ${today}`);
        } catch (error) {
            console.error('[Midnight Reset] Failed to reset results:', error);
        } finally {
            // Allow reset again after 1 minute (to handle edge cases)
            setTimeout(() => {
                resetInProgress = false;
            }, 60000);
        }
    }
}

/**
 * Initialize the midnight reset scheduler.
 * Checks every minute if it's midnight IST and resets results if needed.
 */
export function startMidnightResetScheduler() {
    console.log('[Midnight Reset] Scheduler started. Will reset market results at 12:00 AM IST daily.');
    
    // Check immediately on startup (in case server restarted after midnight)
    checkAndResetAtMidnight();
    
    // Then check every minute
    setInterval(() => {
        checkAndResetAtMidnight();
    }, 60000); // Check every minute
    
    // Also check every 10 seconds during the midnight window (00:00:00 to 00:01:00) for more precision
    setInterval(() => {
        const currentTime = getCurrentTimeIST();
        if (currentTime.startsWith('00:00:')) {
            checkAndResetAtMidnight();
        }
    }, 10000); // Check every 10 seconds during midnight window
}
