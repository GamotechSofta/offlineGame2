import mongoose from 'mongoose';

/**
 * Multiple number bets per logged-in user per (quizId, slotStartIso).
 * Winning number = persisted hintPosition (shuffled position 0–99).
 */
const quizBetSchema = new mongoose.Schema(
  {
    gameMode: { type: String, required: true, enum: ['2d', '3d'], default: '2d' },
    betOwnerKey: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    quizId: { type: Number, required: true, min: 1, max: 30 },
    slotStartIso: { type: String, required: true },
    number: { type: Number, required: true, min: 0, max: 99 },
    amount: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'win', 'lose'],
      default: 'pending',
    },
    /** Gross payout on win (stake × multiplier). Zero on lose. */
    winPayout: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

quizBetSchema.index({ gameMode: 1, betOwnerKey: 1, quizId: 1, slotStartIso: 1, number: 1 }, { unique: true });
quizBetSchema.index({ gameMode: 1, slotStartIso: 1, quizId: 1, status: 1 });

const QuizBet = mongoose.model('QuizBet', quizBetSchema);
export default QuizBet;
