import mongoose from 'mongoose';

const starlineGroupSchema = new mongoose.Schema({
    /** Unique key (e.g. 'kalyan', 'milan'). Used in Market.starlineGroup and in URLs. */
    key: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
    },
    /** Display name (e.g. 'Kalyan Starline'). */
    label: {
        type: String,
        required: true,
        trim: true,
    },
    /** Order for tabs/cards (lower first). */
    order: {
        type: Number,
        default: 0,
    },
}, { timestamps: true });

const StarlineGroup = mongoose.model('StarlineGroup', starlineGroupSchema);
export default StarlineGroup;
