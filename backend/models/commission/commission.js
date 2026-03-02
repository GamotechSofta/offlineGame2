import mongoose from 'mongoose';

const commissionRequestSchema = new mongoose.Schema({
    bookieId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true,
    },
    requestedPercentage: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
    },
    currentPercentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'negotiation'],
        default: 'pending',
    },
    adminResponse: {
        type: String,
        trim: true,
    },
    counterOffer: {
        type: Number,
        min: 0,
        max: 100,
    },
    bookieMessage: {
        type: String,
        trim: true,
    },
    processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
    },
    processedAt: {
        type: Date,
    },
}, {
    timestamps: true,
});

// Index for faster queries
commissionRequestSchema.index({ bookieId: 1, status: 1 });
commissionRequestSchema.index({ status: 1, createdAt: -1 });

const CommissionRequest = mongoose.model('CommissionRequest', commissionRequestSchema);
export default CommissionRequest;
