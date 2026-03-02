import mongoose from 'mongoose';

const DEFAULT_RATES = {
    single: 10,
    jodi: 100,
    singlePatti: 150,
    doublePatti: 300,
    triplePatti: 1000,
    halfSangam: 5000,
    fullSangam: 10000,
};

const rateSchema = new mongoose.Schema({
    gameType: {
        type: String,
        required: true,
        unique: true,
        enum: ['single', 'jodi', 'singlePatti', 'doublePatti', 'triplePatti', 'halfSangam', 'fullSangam'],
    },
    rate: {
        type: Number,
        required: true,
        min: 0,
    },
}, { timestamps: true });

const Rate = mongoose.model('Rate', rateSchema);

/**
 * Get all rates as a map { single: 10, jodi: 100, ... }. Seeds defaults if empty.
 * Every key from DEFAULT_RATES is guaranteed to be a finite number (from DB or default).
 * Used by settlement to pay winning players – must always reflect Update Rate screen values.
 */
export async function getRatesMap() {
    let docs = await Rate.find().lean();
    if (docs.length === 0) {
        for (const [gameType, rate] of Object.entries(DEFAULT_RATES)) {
            await Rate.create({ gameType, rate });
        }
        docs = await Rate.find().lean();
    }
    const map = { ...DEFAULT_RATES };
    for (const d of docs) {
        const key = (d.gameType && String(d.gameType).trim()) || '';
        const normalizedKey = key in DEFAULT_RATES ? key : null;
        if (!normalizedKey) continue;
        const raw = d.rate;
        const num = raw != null ? Number(raw) : NaN;
        if (Number.isFinite(num) && num >= 0) {
            map[normalizedKey] = num;
        }
    }
    return map;
}

export default Rate;
export { DEFAULT_RATES };
