import mongoose from 'mongoose';

const betSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    marketId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Market',
        required: true,
    },
    betType: {
        type: String,
        required: true,
        enum: ['single', 'jodi', 'panna', 'half-sangam', 'full-sangam'],
    },
    betNumber: {
        type: String,
        required: true,
    },
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
    status: {
        type: String,
        enum: ['pending', 'won', 'lost', 'cancelled'],
        default: 'pending',
    },
    payout: {
        type: Number,
        default: 0,
    },
    scheduledDate: {
        type: Date,
        default: null,
    },
    isScheduled: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
});

const Bet = mongoose.model('Bet', betSchema);
export default Bet;
