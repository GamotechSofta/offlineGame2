import Rate, { getRatesMap } from '../models/rate/rate.js';
import Admin from '../models/admin/admin.js';
import bcrypt from 'bcryptjs';

/**
 * GET /rates/current – public. Returns current payout rates for user-side display (e.g. "You Won ₹X").
 * Same rates used when settling bets (admin Update Rate screen).
 */
export const getRatesCurrent = async (req, res) => {
    try {
        const map = await getRatesMap();
        res.status(200).json({ success: true, data: { ...map } });
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
        const list = [
            { gameType: 'single', label: 'Single Digit', rate: map.single },
            { gameType: 'jodi', label: 'Jodi', rate: map.jodi },
            { gameType: 'singlePatti', label: 'Single Patti', rate: map.singlePatti },
            { gameType: 'doublePatti', label: 'Double Patti', rate: map.doublePatti },
            { gameType: 'triplePatti', label: 'Triple Patti', rate: map.triplePatti },
            { gameType: 'halfSangam', label: 'Half Sangam', rate: map.halfSangam },
            { gameType: 'fullSangam', label: 'Full Sangam', rate: map.fullSangam },
        ];
        res.status(200).json({ success: true, data: list });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const RATE_GAME_TYPES = ['single', 'jodi', 'singlePatti', 'doublePatti', 'triplePatti', 'halfSangam', 'fullSangam'];

/**
 * PATCH /rates/:gameType – update one rate. Body: { rate: number, secretDeclarePassword?: string }
 * These rates are used when settling winning players (declare result).
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
            { new: true, upsert: true, runValidators: true }
        );
        // Return full list (same as GET) so admin UI and settlement both use these rates
        const map = await getRatesMap();
        const list = [
            { gameType: 'single', label: 'Single Digit', rate: map.single },
            { gameType: 'jodi', label: 'Jodi', rate: map.jodi },
            { gameType: 'singlePatti', label: 'Single Patti', rate: map.singlePatti },
            { gameType: 'doublePatti', label: 'Double Patti', rate: map.doublePatti },
            { gameType: 'triplePatti', label: 'Triple Patti', rate: map.triplePatti },
            { gameType: 'halfSangam', label: 'Half Sangam', rate: map.halfSangam },
            { gameType: 'fullSangam', label: 'Full Sangam', rate: map.fullSangam },
        ];
        res.status(200).json({ success: true, data: list });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
