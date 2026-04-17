import mongoose from 'mongoose';

/**
 * One document per (quizId, slotStartIso) — deterministic hint for that slot.
 * chosenIndex: original question row index in DB (0..99) — internal only.
 * hintPosition: winning shuffled list position (2D: 0..99, 3D: 0..999) — same numbering as study UI / guesses.
 * Neither index is sent in the hint API.
 */
const quizSlotPickSchema = new mongoose.Schema(
  {
    gameMode: { type: String, required: true, enum: ['2d', '3d'], default: '2d' },
    quizId: { type: Number, required: true, min: 1, max: 30 },
    slotStartIso: { type: String, required: true },
    seedHex: { type: String, required: true },
    chosenIndex: { type: Number, required: true, min: 0, max: 999 },
    hintPosition: { type: Number, required: false, min: 0, max: 999 },
    hintQuestionText: { type: String, required: true },
    /** Legacy / optional — hint API does not expose options. */
    hintOptions: {
      type: {
        A: String,
        B: String,
        C: String,
        D: String,
      },
      required: false,
    },
  },
  { timestamps: true },
);

quizSlotPickSchema.index({ gameMode: 1, quizId: 1, slotStartIso: 1 }, { unique: true });
/** Slot-first history queries (e.g. IST day result chart). */
quizSlotPickSchema.index({ gameMode: 1, slotStartIso: 1, quizId: 1 });

const QuizSlotPick = mongoose.model('QuizSlotPick', quizSlotPickSchema);
export default QuizSlotPick;
