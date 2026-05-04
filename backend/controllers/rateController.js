import Rate, { getRatesMap, DEFAULT_RATES, QUIZ_3D_RATE_DEFAULTS } from '../models/rate/rate.js';
import Admin from '../models/admin/admin.js';
import bcrypt from 'bcryptjs';

const RATE_GAME_TYPES = Object.keys(DEFAULT_RATES);

/** Admin list row builder — order is display order in Update Rate. */
function buildAdminRatesList(map) {
    const list = [
        { gameType: 'single', label: 'Single Digit', rate: map.single, category: 'matka' },
        { gameType: 'jodi', label: 'Jodi', rate: map.jodi, category: 'matka' },
        { gameType: 'singlePatti', label: 'Single Patti', rate: map.singlePatti, category: 'matka' },
        { gameType: 'doublePatti', label: 'Double Patti', rate: map.doublePatti, category: 'matka' },
        { gameType: 'triplePatti', label: 'Triple Patti', rate: map.triplePatti, category: 'matka' },
        { gameType: 'halfSangam', label: 'Half Sangam', rate: map.halfSangam, category: 'matka' },
        { gameType: 'fullSangam', label: 'Full Sangam', rate: map.fullSangam, category: 'matka' },
        { gameType: 'oddEven', label: 'Odd Even', rate: map.oddEven, category: 'matka' },
        { gameType: 'quiz2d', label: '2D Quiz (board)', rate: map.quiz2d, category: 'quiz2d' },
        { gameType: 'quiz3d_str', label: '3D — Straight (STR)', rate: map.quiz3d_str, category: 'quiz3d', playCode: 'STR' },
        { gameType: 'quiz3d_box_1way', label: '3D — BOX 1-way (e.g. 111)', rate: map.quiz3d_box_1way, category: 'quiz3d', playCode: 'BOX 1-way' },
        { gameType: 'quiz3d_box_3way', label: '3D — BOX 3-way (e.g. 112)', rate: map.quiz3d_box_3way, category: 'quiz3d', playCode: 'BOX 3-way' },
        { gameType: 'quiz3d_box_6way', label: '3D — BOX 6-way (e.g. 123)', rate: map.quiz3d_box_6way, category: 'quiz3d', playCode: 'BOX 6-way' },
        { gameType: 'quiz3d_fp', label: '3D — Front pair (FP)', rate: map.quiz3d_fp, category: 'quiz3d', playCode: 'FP' },
        { gameType: 'quiz3d_bp', label: '3D — Back pair (BP)', rate: map.quiz3d_bp, category: 'quiz3d', playCode: 'BP' },
        { gameType: 'quiz3d_sp', label: '3D — Split pair (SP)', rate: map.quiz3d_sp, category: 'quiz3d', playCode: 'SP' },
        { gameType: 'quiz3d_ap', label: '3D — Any pair (AP)', rate: map.quiz3d_ap, category: 'quiz3d', playCode: 'AP' },
        { gameType: 'quiz3d_duplicates', label: '3D — Duplicates (DP)', rate: map.quiz3d_duplicates, category: 'quiz3d', playCode: 'DP' },
        { gameType: 'quiz3d_triples', label: '3D — Triples (TP)', rate: map.quiz3d_triples, category: 'quiz3d', playCode: 'TP' },
        {
            gameType: 'quiz3d',
            label: '3D — Fallback (if a mode above is missing)',
            rate: map.quiz3d,
            category: 'quiz3d',
            playCode: '—',
            note: 'Used when a specific 3D row is not set; usually keep same as old single 3D rate.',
        },
    ];
    return list;
}

function buildQuiz3dChartForPlayers(map) {
    const chart = {};
    for (const key of Object.keys(QUIZ_3D_RATE_DEFAULTS)) {
        const short = key.replace(/^quiz3d_/, '');
        chart[short] = map[key];
    }
    chart.fallback = map.quiz3d;
    return chart;
}

/**
 * GET /rates/current – public. Flat map + `quiz3dChart` for player UI.
 */
export const getRatesCurrent = async (req, res) => {
    try {
        const map = await getRatesMap();
        res.status(200).json({
            success: true,
            data: {
                ...map,
                quiz3dChart: buildQuiz3dChartForPlayers(map),
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /rates – list all game rates (admin).
 */
export const getRates = async (req, res) => {
    try {
        const map = await getRatesMap();
        res.status(200).json({ success: true, data: buildAdminRatesList(map) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * PATCH /rates/:gameType – update one rate. Body: { rate: number, secretDeclarePassword?: string }
 */
export const updateRate = async (req, res) => {
    try {
        const adminWithSecret = await Admin.findById(req.admin._id).select('+secretDeclarePassword').lean();
        if (adminWithSecret?.secretDeclarePassword) {
            const provided = (req.body.secretDeclarePassword ?? '').toString().trim();
            const isValid = await bcrypt.compare(provided, adminWithSecret.secretDeclarePassword);
            if (!isValid) {
                return res.status(403).json({
                    success: false,
                    message: 'Invalid secret declare password',
                    code: 'INVALID_SECRET_DECLARE_PASSWORD',
                });
            }
        }

        const gameType = (req.params.gameType || '').trim();
        const rate = req.body?.rate;
        if (!RATE_GAME_TYPES.includes(gameType)) {
            return res.status(400).json({ success: false, message: 'Invalid game type' });
        }
        const rateNum = rate != null ? Number(rate) : NaN;
        if (!Number.isFinite(rateNum) || rateNum < 0) {
            return res.status(400).json({ success: false, message: 'Rate must be a non-negative number' });
        }
        await Rate.findOneAndUpdate(
            { gameType },
            { rate: rateNum },
            { new: true, upsert: true, runValidators: true },
        );
        const map = await getRatesMap();
        res.status(200).json({ success: true, data: buildAdminRatesList(map) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
