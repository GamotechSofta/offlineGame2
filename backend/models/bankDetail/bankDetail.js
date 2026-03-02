import mongoose from 'mongoose';

const bankDetailSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    // Bank account details
    accountHolderName: {
        type: String,
        required: true,
        trim: true,
    },
    accountNumber: {
        type: String,
        trim: true,
    },
    ifscCode: {
        type: String,
        trim: true,
        uppercase: true,
    },
    bankName: {
        type: String,
        trim: true,
    },
    // UPI ID for withdrawals (alternative to bank)
    upiId: {
        type: String,
        trim: true,
    },
    // Account type
    accountType: {
        type: String,
        enum: ['savings', 'current', 'upi_only'],
        default: 'savings',
    },
    // Is this the default withdrawal account?
    isDefault: {
        type: Boolean,
        default: false,
    },
    // Admin verified this account?
    isVerified: {
        type: Boolean,
        default: false,
    },
    // Is active?
    isActive: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
});

// Index for faster queries
bankDetailSchema.index({ userId: 1, isActive: 1 });

// Ensure only one default per user
bankDetailSchema.pre('save', async function() {
    if (this.isDefault && this.isModified('isDefault')) {
        await this.constructor.updateMany(
            { userId: this.userId, _id: { $ne: this._id } },
            { $set: { isDefault: false } }
        );
    }
});

const BankDetail = mongoose.model('BankDetail', bankDetailSchema);
export default BankDetail;
