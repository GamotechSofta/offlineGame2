import mongoose from 'mongoose';

const dailyCommissionSchema = new mongoose.Schema({
    bookieId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true,
    },
    date: {
        type: Date,
        required: true,
        // Store date at midnight IST for the day
    },
    totalRevenue: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    commissionPercentage: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
    },
    commissionAmount: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    /** Engine V2: cap-aware commission (actualCommission from bottom-up settlement). */
    actualCommission: {
        type: Number,
        default: null,
        min: 0,
    },
    calculatedCommission: {
        type: Number,
        default: null,
        min: 0,
    },
    grossProfit: {
        type: Number,
        default: null,
    },
    engineV2: {
        type: Boolean,
        default: false,
    },
    paidAmount: {
        type: Number,
        default: 0,
        min: 0,
    },
    pendingAmount: {
        type: Number,
        default: 0,
        min: 0,
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'partial', 'paid'],
        default: 'pending',
    },
    lastPaidAt: {
        type: Date,
    },
    lastPaidBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
    },
    paymentNotes: {
        type: String,
        trim: true,
    },
    totalBets: {
        type: Number,
        default: 0,
        min: 0,
    },
    totalPayouts: {
        type: Number,
        default: 0,
        min: 0,
    },
    status: {
        type: String,
        enum: ['pending', 'processed', 'paid'],
        default: 'pending',
    },
    processedAt: {
        type: Date,
    },
    notes: {
        type: String,
        trim: true,
    },
}, {
    timestamps: true,
});

// Index for faster queries - unique combination of bookie and date
dailyCommissionSchema.index({ bookieId: 1, date: 1 }, { unique: true });
dailyCommissionSchema.index({ date: -1 });
dailyCommissionSchema.index({ status: 1 });
dailyCommissionSchema.index({ paymentStatus: 1 });

const DailyCommission = mongoose.model('DailyCommission', dailyCommissionSchema);
export default DailyCommission;
