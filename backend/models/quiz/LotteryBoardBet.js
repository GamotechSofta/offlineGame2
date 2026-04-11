import mongoose from 'mongoose';

const stakeLineSchema = new mongoose.Schema(
  {
    quizId: { type: Number, required: true, min: 1, max: 30 },
    num: { type: Number, required: true, min: 0, max: 99 },
    amount: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

/**
 * Aggregated stakes on the 2D lottery board for one IST slot and one owner.
 * Multiple BUY clicks append lines and increase totalAmount.
 */
const lotteryBoardBetSchema = new mongoose.Schema(
  {
    betOwnerKey: { type: String, required: true },
    slotStartIso: { type: String, required: true },
    lines: { type: [stakeLineSchema], default: [] },
    totalAmount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

lotteryBoardBetSchema.index({ betOwnerKey: 1, slotStartIso: 1 }, { unique: true });

const LotteryBoardBet = mongoose.model('LotteryBoardBet', lotteryBoardBetSchema);
export default LotteryBoardBet;
