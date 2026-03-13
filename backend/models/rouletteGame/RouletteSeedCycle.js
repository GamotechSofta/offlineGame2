import mongoose from 'mongoose';
import crypto from 'crypto';

const schema = new mongoose.Schema({
    serverSeedHash: { type: String, required: true },
    serverSeed: { type: String },
    activeFrom: { type: Date, default: Date.now },
    revealedAt: { type: Date },
}, { timestamps: true });

const RouletteSeedCycle = mongoose.model('RouletteSeedCycle', schema);

export async function getActiveCycle(session) {
    return RouletteSeedCycle.findOne({ revealedAt: null }).session(session || null).sort({ activeFrom: -1 }).lean();
}

export function generateNewCycle() {
    const serverSeed = crypto.randomBytes(32).toString('hex');
    const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
    return { serverSeed, serverSeedHash };
}

export default RouletteSeedCycle;
