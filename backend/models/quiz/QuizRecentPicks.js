import mongoose from 'mongoose';

/**
 * Last up to 5 chosen indices per quiz (across recent slots) for anti-repeat.
 */
const quizRecentPicksSchema = new mongoose.Schema(
  {
    quizId: { type: Number, required: true, unique: true, min: 1, max: 30 },
    recentIndices: { type: [Number], default: [] },
  },
  { timestamps: true },
);

const QuizRecentPicks = mongoose.model('QuizRecentPicks', quizRecentPicksSchema);
export default QuizRecentPicks;
