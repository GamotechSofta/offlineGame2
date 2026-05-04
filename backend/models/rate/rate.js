import mongoose from 'mongoose';

/** Payout ₹ per ₹1 stake for each 3D play mode (editable in Admin → Update Rate). */
export const QUIZ_3D_RATE_DEFAULTS = {
    quiz3d_str: 900,
    quiz3d_box_1way: 900,
    quiz3d_box_3way: 300,
    quiz3d_box_6way: 150,
    quiz3d_fp: 90,
    quiz3d_bp: 90,
    quiz3d_sp: 90,
    quiz3d_ap: 30,
    quiz3d_duplicates: 300,
    quiz3d_triples: 900,
};

/** All known rate keys — must match PATCH /rates/:gameType allowlist via schema enum below. */
const DEFAULT_RATES = {
    single: 10,
    jodi: 100,
    singlePatti: 150,
    doublePatti: 300,
    triplePatti: 1000,
    halfSangam: 5000,
    fullSangam: 10000,
    oddEven: 2,
    quiz2d: 90,
    quiz3d: 90,
    ...QUIZ_3D_RATE_DEFAULTS,
};

const RATE_GAME_TYPE_ENUM = Object.keys(DEFAULT_RATES);

const rateSchema = new mongoose.Schema({
    gameType: {
        type: String,
        required: true,
        unique: true,
        enum: RATE_GAME_TYPE_ENUM,
    },
    rate: {
        type: Number,
        required: true,
        min: 0,
    },
}, { timestamps: true });

const Rate = mongoose.model('Rate', rateSchema);

async function ensureAllDefaultRatesInDb() {
    const docs = await Rate.find().select('gameType').lean();
    const have = new Set(docs.map((d) => String(d.gameType || '').trim()).filter(Boolean));
    for (const [gameType, rate] of Object.entries(DEFAULT_RATES)) {
        if (have.has(gameType)) continue;
        try {
            // eslint-disable-next-line no-await-in-loop
            await Rate.create({ gameType, rate });
        } catch (e) {
            if (String(e?.code || e?.codeStr) !== '11000') throw e;
        }
        have.add(gameType);
    }
}

/**
 * Full map — used by settlement & admin GET.
 */
export async function getRatesMap() {
    await ensureAllDefaultRatesInDb();
    const docs = await Rate.find().lean();
    const map = { ...DEFAULT_RATES };
    for (const d of docs) {
        const key = (d.gameType && String(d.gameType).trim()) || '';
        if (!(key in DEFAULT_RATES)) continue;
        const num = d.rate != null ? Number(d.rate) : NaN;
        if (Number.isFinite(num) && num >= 0) {
            map[key] = num;
        }
    }
    return map;
}

export default Rate;
export { DEFAULT_RATES };
