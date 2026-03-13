import mongoose from 'mongoose';
const schema = new mongoose.Schema({
    key: { type: String, required: true, unique: true, default: 'main' },
    balance: { type: Number, default: 0 },
}, { timestamps: true });
const HouseReserve = mongoose.model('HouseReserve', schema);
export async function getReserve(session) {
    let doc = await HouseReserve.findOne({ key: 'main' }).session(session || null);
    if (!doc) {
        const created = await HouseReserve.create([{ key: 'main', balance: 0 }], { session: session || undefined });
        doc = created[0] || doc;
    }
    return doc;
}
export async function addHouseProfit(amount, session) {
    await HouseReserve.findOneAndUpdate(
        { key: 'main' },
        { $inc: { balance: amount } },
        { upsert: true, new: true, session: session || undefined }
    );
}
export default HouseReserve;
