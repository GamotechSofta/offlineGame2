import mongoose from 'mongoose';

const commissionPaymentSchema = new mongoose.Schema({
    bookieId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true,
        index: true,
    },
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
    notes: {
        type: String,
        trim: true,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
    },
}, {
    timestamps: true,
});

commissionPaymentSchema.index({ bookieId: 1, createdAt: -1 });

const CommissionPayment = mongoose.model('CommissionPayment', commissionPaymentSchema);
export default CommissionPayment;
