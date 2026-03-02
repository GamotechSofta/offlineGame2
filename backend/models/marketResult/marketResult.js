import mongoose from 'mongoose';

/**
 * Stores per-day market result snapshots for history screens.
 * We keep a simple dateKey (YYYY-MM-DD in Asia/Kolkata) so querying is easy.
 */
const marketResultSchema = new mongoose.Schema({
  marketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Market',
    required: true,
    index: true,
  },
  marketName: {
    type: String,
    required: true,
  },
  dateKey: {
    type: String, // YYYY-MM-DD (IST)
    required: true,
    index: true,
  },
  openingNumber: {
    type: String,
    default: null,
  },
  closingNumber: {
    type: String,
    default: null,
  },
  displayResult: {
    type: String, // ***-**-*** | 123-6*-*** | 123-65-456
    default: '***-**-***',
  },
}, { timestamps: true });

marketResultSchema.index({ marketId: 1, dateKey: 1 }, { unique: true });

const MarketResult = mongoose.model('MarketResult', marketResultSchema);
export default MarketResult;

