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

const DailyCommission = mongoose.model('DailyCommission', dailyCommissionSchema);
export default DailyCommission;
