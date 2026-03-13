import mongoose from 'mongoose';
import crypto from 'crypto';

const schema = new mongoose.Schema({
    sequenceId: { type: Number, required: true, unique: true },
    spinId: { type: String, required: true },
    previousRecordHash: { type: String, required: true },
    recordHash: { type: String, required: true },
    timestamp: { type: Date, required: true },
    payloadHash: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

const RouletteAuditLog = mongoose.model('RouletteAuditLog', schema);

export async function getNextSequenceId(session) {
    const last = await RouletteAuditLog.findOne().session(session || null).sort({ sequenceId: -1 }).select('sequenceId').lean();
    return (last?.sequenceId ?? 0) + 1;
}

export function hashRecord(sequenceId, spinId, previousRecordHash, timestamp, payloadHash) {
    const data = [sequenceId, spinId, previousRecordHash, timestamp.toISOString(), payloadHash].join('|');
    return crypto.createHash('sha256').update(data).digest('hex');
}

export default RouletteAuditLog;
