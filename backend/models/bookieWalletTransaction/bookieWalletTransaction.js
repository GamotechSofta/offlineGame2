import mongoose from 'mongoose';

const bookieWalletTransactionSchema = new mongoose.Schema(
    {
        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
            required: true,
            index: true,
        },
        /** credit = balance increased, debit = balance decreased */
        direction: {
            type: String,
            enum: ['credit', 'debit'],
            required: true,
        },
        type: {
            type: String,
            required: true,
            index: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        balanceAfter: {
            type: Number,
            required: true,
            min: 0,
        },
        description: {
            type: String,
            default: '',
        },
        referenceId: {
            type: String,
            default: '',
        },
        meta: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },
    },
    { timestamps: true },
);

bookieWalletTransactionSchema.index({ adminId: 1, createdAt: -1 });

const BookieWalletTransaction = mongoose.model('BookieWalletTransaction', bookieWalletTransactionSchema);

export default BookieWalletTransaction;
