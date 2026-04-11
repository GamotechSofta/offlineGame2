import mongoose from 'mongoose';

/**
 * Commitment for provably fair quiz: seed = sha256(quizId+slotStartIso) hex,
 * seedHash = sha256(binary seed bytes) hex — revealed after slot end.
 */
const quizSlotSeedSchema = new mongoose.Schema(
  {
    quizId: { type: Number, required: true, min: 1, max: 30 },
    slotStartIso: { type: String, required: true },
    seed: { type: String, required: true },
    seedHash: { type: String, required: true },
  },
  { timestamps: true },
);

quizSlotSeedSchema.index({ quizId: 1, slotStartIso: 1 }, { unique: true });

const QuizSlotSeed = mongoose.model('QuizSlotSeed', quizSlotSeedSchema);
export default QuizSlotSeed;
