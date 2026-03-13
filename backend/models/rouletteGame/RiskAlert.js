import mongoose from 'mongoose';

const schema = new mongoose.Schema({
    type: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    payload: { type: mongoose.Schema.Types.Mixed },
    resolved: { type: Boolean, default: false },
}, { timestamps: true });

const RiskAlert = mongoose.model('RiskAlert', schema);
export default RiskAlert;
