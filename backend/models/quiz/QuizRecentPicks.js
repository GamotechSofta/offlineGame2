import mongoose from 'mongoose';

/**
 * Last up to 5 chosen indices per quiz (across recent slots) for anti-repeat.
 */
const quizRecentPicksSchema = new mongoose.Schema(
  {
    gameMode: { type: String, required: true, enum: ['2d', '3d'], default: '2d' },
    quizId: { type: Number, required: true, min: 1, max: 30 },
    recentIndices: { type: [Number], default: [] },
  },
  { timestamps: true },
);
quizRecentPicksSchema.index({ gameMode: 1, quizId: 1 }, { unique: true });

const QuizRecentPicks = mongoose.model('QuizRecentPicks', quizRecentPicksSchema);
export default QuizRecentPicks;
