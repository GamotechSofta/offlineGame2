import mongoose from 'mongoose';

const walletSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
    },
    balance: {
        type: Number,
        default: 0,
        min: 0,
    },
}, {
    timestamps: true,
});

const walletTransactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    type: {
        type: String,
        required: true,
        enum: ['credit', 'debit'],
    },
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
    description: {
        type: String,
        trim: true,
    },
    referenceId: {
        type: String,
        trim: true,
    },
}, {
    timestamps: true,
});

walletSchema.index({ updatedAt: -1 });
walletSchema.index({ balance: 1, updatedAt: -1 });
walletTransactionSchema.index({ userId: 1, createdAt: -1 });
walletTransactionSchema.index({ userId: 1, type: 1, createdAt: -1 });
walletTransactionSchema.index({ referenceId: 1, createdAt: -1 }, { sparse: true });

const Wallet = mongoose.model('Wallet', walletSchema);
const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema);

export { Wallet, WalletTransaction };
