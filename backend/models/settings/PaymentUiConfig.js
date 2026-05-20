import mongoose from 'mongoose';

/**
 * Singleton-style document: UPI + deposit/withdraw limits shown to players.
 * Empty string / null numeric fields → fall back to env (UPI_ID, MIN_DEPOSIT, …) then code defaults.
 * Payee display name uses UPI_NAME env only (not overridden from admin).
 */
const paymentUiConfigSchema = new mongoose.Schema(
    {
        upiId: { type: String, default: '', trim: true },
        upiName: { type: String, default: '', trim: true },
        minDeposit: { type: Number, default: null },
        maxDeposit: { type: Number, default: null },
        minWithdrawal: { type: Number, default: null },
        maxWithdrawal: { type: Number, default: null },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    },
    { timestamps: true }
);

const PaymentUiConfig = mongoose.model('PaymentUiConfig', paymentUiConfigSchema);

export default PaymentUiConfig;
