/**
 * Market result reset at midnight IST.
 * Market opens at midnight and closes at closing time; results are cleared at the start of each new day (IST)
 * so the same markets can be used for the next day with fresh results.
 * Before clearing, yesterday's result for each market is saved to MarketResult so view history is preserved.
 *
 * IMPORTANT: lastResultResetDate is persisted in the database (AppState collection) so that
 * server restarts during the same day do NOT accidentally clear already-declared results.
 */

import MarketResult from '../models/marketResult/marketResult.js';
import AppState from '../models/appState/appState.js';

const RESET_DATE_KEY = 'lastResultResetDate';

/**
 * In-memory cache: undefined = not loaded yet, null = loaded but no DB doc, string = loaded date.
 * Using undefined vs null lets us distinguish "haven't read DB yet" from "DB had no record".
 */
let cachedResetDate = undefined;

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

/** Read the persisted lastResultResetDate from DB (only once per server lifecycle) */
async function getLastResetDateFromDB() {
    if (cachedResetDate !== undefined) return cachedResetDate;
    try {
        const doc = await AppState.findOne({ key: RESET_DATE_KEY }).lean();
        cachedResetDate = doc?.value || null;
    } catch (err) {
        console.error('[resultReset] Failed to read lastResultResetDate from DB:', err.message);
        cachedResetDate = null;
    }
    return cachedResetDate;
}

/** Persist lastResultResetDate to DB and update in-memory cache */
async function setLastResetDateInDB(dateStr) {
    cachedResetDate = dateStr;
    try {
        await AppState.findOneAndUpdate(
            { key: RESET_DATE_KEY },
            { $set: { value: dateStr } },
            { upsert: true }
        );
    } catch (err) {
        console.error('[resultReset] Failed to persist lastResultResetDate to DB:', err.message);
    }
}

/**
 * If we've crossed into a new calendar day (IST), save yesterday's results to history, then clear
 * openingNumber and closingNumber for all markets. View history (result-history by date) is preserved.
 * Called when fetching markets so admin and frontend always see reset results after midnight IST.
 *
 * The reset date is persisted in the database so server restarts on the same day
 * will NOT clear already-declared results.
 *
 * @param {Model} Market - Mongoose Market model
 */
export async function ensureResultsResetForNewDay(Market) {
    const today = getTodayIST();
    const lastResetDate = await getLastResetDateFromDB();

    // Same day already reset – skip
    if (lastResetDate !== null && today <= lastResetDate) return;

    // FIRST BOOT / NO DB RECORD: Don't clear results – just record today's date.
    // This prevents server restarts from wiping declared results.
    // The proper midnight reset will happen when the date actually changes tomorrow.
    if (lastResetDate === null) {
        console.log('[resultReset] First boot – recording today as reset date WITHOUT clearing results.');
        await setLastResetDateInDB(today);
        return;
    }

    // DATE HAS CHANGED (lastResetDate < today): perform actual midnight reset.
    // Save yesterday's results to history, then clear all markets for the new day.
    console.log(`[resultReset] New day detected (${lastResetDate} -> ${today}). Resetting market results...`);

    try {
        await saveYesterdaySnapshotsToHistory(Market);
    } catch (err) {
        console.error('[resultReset] Failed to save yesterday snapshots to history:', err.message);
    }

    await Market.updateMany(
        {},
        { $set: { openingNumber: null, closingNumber: null } }
    );

    await setLastResetDateInDB(today);
    console.log('[resultReset] Market results cleared for new day.');
}
