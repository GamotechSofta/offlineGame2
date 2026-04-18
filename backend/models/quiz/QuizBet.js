import mongoose from 'mongoose';

/**
 * Multiple number bets per logged-in user per (quizId, slotStartIso).
 * Winning number = persisted hintPosition (2D: 0-99, 3D: 0-999).
 */
const quizBetSchema = new mongoose.Schema(
  {
    gameMode: { type: String, required: true, enum: ['2d', '3d'], default: '2d' },
    betOwnerKey: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    quizId: { type: Number, required: true, min: 1, max: 30 },
    slotStartIso: { type: String, required: true },
    number: { type: Number, required: true, min: 0, max: 999 },
    /** 3D play type (str/box/fp/bp/sp/ap/duplicates/triples). */
    betMode: { type: String, required: true, default: 'str' },
    amount: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'win', 'lose', 'cancelled'],
      default: 'pending',
    },
    /** Gross payout on win (stake × multiplier). Zero on lose. */
    winPayout: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

/** Unique for non-cancelled tickets only. Cancelled rows are excluded from this index so the same key can be reused (MongoDB partial indexes do not support `$ne`). */
quizBetSchema.index(
  { gameMode: 1, betOwnerKey: 1, quizId: 1, slotStartIso: 1, number: 1, betMode: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['pending', 'win', 'lose'] } },
  },
);
quizBetSchema.index({ gameMode: 1, slotStartIso: 1, quizId: 1, status: 1 });

const QuizBet = mongoose.model('QuizBet', quizBetSchema);
export default QuizBet;
