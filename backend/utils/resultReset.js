/**
 * Market result reset at midnight IST.
 * Market opens at midnight and closes at closing time; results are cleared at the start of each new day (IST)
 * so the same markets can be used for the next day with fresh results.
 * Before clearing, yesterday's result for each market is saved to MarketResult so view history is preserved.
 */

import MarketResult from '../models/marketResult/marketResult.js';

/** Current date in IST as YYYY-MM-DD */
export function getTodayIST() {
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
async function saveYesterdaySnapshotsToHistory(Market) {
    const yesterdayKey = getYesterdayIST();
    const marketsWithResults = await Market.find({
        $or: [
            { openingNumber: { $nin: [null, ''] } },
            { closingNumber: { $nin: [null, ''] } },
        ],
    }).lean();

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

let lastResultResetDate = null;

/**
 * If we've crossed into a new calendar day (IST), save yesterday's results to history, then clear
 * openingNumber and closingNumber for all markets. View history (result-history by date) is preserved.
 * Called when fetching markets so admin and frontend always see reset results after midnight IST.
 * @param {Model} Market - Mongoose Market model
 */
export async function ensureResultsResetForNewDay(Market) {
    const today = getTodayIST();
    // Same day already reset – skip
    if (lastResultResetDate !== null && today <= lastResultResetDate) return;

    // Midnight passed or server restart: save yesterday's results and clear all markets
    // (Server restart after midnight: lastResultResetDate was null, so reset runs and clears declared results)
    // Preserve yesterday's results into MarketResult before clearing live data
    try {
        await saveYesterdaySnapshotsToHistory(Market);
    } catch (err) {
        console.error('[resultReset] Failed to save yesterday snapshots to history:', err.message);
    }

    await Market.updateMany(
        {},
        { $set: { openingNumber: null, closingNumber: null } }
    );
    lastResultResetDate = today;
}
