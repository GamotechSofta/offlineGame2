import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    type: {
        type: String,
        required: true,
        enum: ['deposit', 'withdrawal'],
    },
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
    method: {
        type: String,
        required: true,
        enum: ['upi', 'bank_transfer', 'wallet', 'cash'],
        default: 'upi',
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'completed'],
        default: 'pending',
    },
    // For deposits - user uploads payment proof
    screenshotUrl: {
        type: String,
        trim: true,
    },
    // UTR / Transaction ID entered by user
    upiTransactionId: {
        type: String,
        trim: true,
    },
    // Legacy field
    transactionId: {
        type: String,
        trim: true,
    },
    // User's note when submitting
    userNote: {
        type: String,
        trim: true,
    },
    // Admin's remarks when approving/rejecting
    adminRemarks: {
        type: String,
        trim: true,
    },
    // Which admin processed this
    processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
    },
    // When was it processed
    processedAt: {
        type: Date,
    },
    // For withdrawals - which bank account to use
    bankDetailId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BankDetail',
    },
    // Legacy notes field
    notes: {
        type: String,
        trim: true,
    },
}, {
    timestamps: true,
});

// Indexes for faster queries
paymentSchema.index({ userId: 1, type: 1, status: 1 });
paymentSchema.index({ status: 1, createdAt: -1 });

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
