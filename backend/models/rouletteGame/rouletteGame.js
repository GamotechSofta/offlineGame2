import mongoose from 'mongoose';

const rouletteGameSchema = new mongoose.Schema({
    spinId: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    bets: { type: mongoose.Schema.Types.Mixed, required: true },
    winningNumber: { type: Number, required: true, min: 0, max: 36 },
    totalBet: { type: Number, required: true, min: 0 },
    payout: { type: Number, required: true, min: 0 },
    profit: { type: Number, required: true },
    spinDataHash: { type: String, trim: true },
    preSpinBankrollSnapshot: { type: Number },
    betStructure: { type: mongoose.Schema.Types.Mixed },
    idempotencyKey: { type: String, trim: true, index: true },
    clientSeed: { type: String, trim: true },
    nonce: { type: Number },
    serverSeedHash: { type: String, trim: true },
    /** RTP snapshot at spin time: totalPaid/totalWagered (global). Expected ~0.973. */
    rtpSnapshot: { type: Number },
    /** Entropy reference for audit (e.g. serverSeedHash or 'crypto'). */
    rngEntropyRef: { type: String, trim: true },
}, { timestamps: true });

rouletteGameSchema.index({ user: 1, createdAt: -1 });
rouletteGameSchema.index({ user: 1, idempotencyKey: 1 }, { unique: true });

const RouletteGame = mongoose.model('RouletteGame', rouletteGameSchema);
export default RouletteGame;
