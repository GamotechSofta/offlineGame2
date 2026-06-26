import mongoose from 'mongoose';
import { SETTLEMENT_STATUS } from '../../services/commissionEngine/constants.js';

const settlementStatusEnum = Object.values(SETTLEMENT_STATUS);

const commissionSettlementSchema = new mongoose.Schema(
    {
        parentOperatorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
            default: null,
            index: true,
        },
        childOperatorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
            required: true,
            index: true,
        },
        originLeafOperatorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
            default: null,
        },
        idempotencyKey: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        periodStart: { type: Date, required: true },
        periodEnd: { type: Date, required: true },
        totalBet: { type: Number, default: 0, min: 0 },
        playerWinning: { type: Number, default: 0, min: 0 },
        grossProfit: { type: Number, default: 0 },
        remainingDistributableIn: { type: Number, default: 0 },
        remainingDistributableOut: { type: Number, default: 0 },
        commissionPercentage: { type: Number, default: 0, min: 0, max: 100 },
        calculatedCommission: { type: Number, default: 0, min: 0 },
        actualCommission: { type: Number, default: 0, min: 0 },
        settlementOrder: { type: Number, default: 0 },
        childSettlementIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CommissionSettlement' }],
        status: {
            type: String,
            enum: settlementStatusEnum,
            default: SETTLEMENT_STATUS.PENDING,
        },
        failureReason: { type: String, default: '' },
        childWalletBefore: { type: Number, default: null },
        childWalletAfter: { type: Number, default: null },
        parentWalletBefore: { type: Number, default: null },
        parentWalletAfter: { type: Number, default: null },
        childLedgerTxId: { type: mongoose.Schema.Types.ObjectId, default: null },
        parentLedgerTxId: { type: mongoose.Schema.Types.ObjectId, default: null },
        commissionPaymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommissionPayment', default: null },
        settledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
        settledAt: { type: Date, default: null },
    },
    { timestamps: true },
);

commissionSettlementSchema.index({ childOperatorId: 1, periodStart: 1, periodEnd: 1 });
commissionSettlementSchema.index({ parentOperatorId: 1, settledAt: -1 });
commissionSettlementSchema.index({ status: 1, settledAt: -1 });

const CommissionSettlement = mongoose.model('CommissionSettlement', commissionSettlementSchema);
export default CommissionSettlement;
