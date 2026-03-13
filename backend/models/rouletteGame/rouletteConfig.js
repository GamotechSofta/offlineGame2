import mongoose from 'mongoose';
const schema = new mongoose.Schema({
    key: { type: String, required: true, unique: true, default: 'main' },
    houseReserve: { type: Number, default: 1e9 },
    riskFactor: { type: Number, default: 0.1 },
    tableLiabilityCap: { type: Number },
    maxStraightUpPerNumber: { type: Number, default: 100000 },
    reducedStraightUpLimit: { type: Number },
    reserveHaltThreshold: { type: Number, default: 0 },
    highRiskFreezeThreshold: { type: Number, default: 0 },
    maxSingleSpinReserveFraction: { type: Number, default: 0.5 },
    /** Reject bet (not halt table) when maxPayout > reserveForCheck * exposureMultiplier. reserveForCheck = max(reserve, minReserveRequired). Default 5. */
    exposureMultiplier: { type: Number, default: 5 },
    /** Minimum reserve used in exposure check so low reserve does not block normal bets. Default 1000. */
    minReserveRequired: { type: Number, default: 1000 },
    /** Per-number exposure cap as fraction of bankroll (e.g. 0.025 = 2.5%). Reject bet if exceeded. */
    maxExposurePctOfBankroll: { type: Number, default: 0.025 },
    /** Reserve as fraction of bankroll (e.g. 0.4 = 40%). When operational balance approaches this, reduce limits. */
    reserveRatio: { type: Number, default: 0.4 },
    /** Dynamic max straight bet = bankroll / this (e.g. 500). */
    bankrollDivisorStraight: { type: Number, default: 500 },
    perBetTypeLimits: { type: mongoose.Schema.Types.Mixed },
    kellyFraction: { type: Number },
    provablyFairEnabled: { type: Boolean, default: false },
    /** Display target win rate % (e.g. 40). Super admin can manage. Used in UI and optionally for loyalty bonus threshold. */
    targetWinRatePercent: { type: Number, default: 40, min: 0, max: 100 },
}, { timestamps: true });
const RouletteConfig = mongoose.model('RouletteConfig', schema);
export async function getConfig() {
    const doc = await RouletteConfig.findOne({ key: 'main' }).lean();
    return doc || null;
}
export default RouletteConfig;
