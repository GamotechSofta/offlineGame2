import mongoose from 'mongoose';
const schema = new mongoose.Schema({
    key: { type: String, required: true, unique: true, default: 'global' },
    totalWagered: { type: Number, default: 0 },
    totalPaid: { type: Number, default: 0 },
    spinCount: { type: Number, default: 0 },
}, { timestamps: true });
const RouletteStats = mongoose.model('RouletteStats', schema);
export async function getStats(session) {
    let doc = await RouletteStats.findOne({ key: 'global' }).session(session || null).lean();
    if (!doc) {
        const created = await RouletteStats.create([{ key: 'global' }], { session: session || undefined });
        doc = created[0] ? created[0].toObject() : { totalWagered: 0, totalPaid: 0, spinCount: 0 };
    }
    return doc;
}
export async function incrementSpin(totalBet, payout, session) {
    await RouletteStats.findOneAndUpdate(
        { key: 'global' },
        { $inc: { totalWagered: totalBet, totalPaid: payout, spinCount: 1 } },
        { upsert: true, new: true, session: session || undefined }
    );
}
export default RouletteStats;
