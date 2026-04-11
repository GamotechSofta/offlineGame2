import mongoose from 'mongoose';

const optionSchema = new mongoose.Schema(
  {
    A: { type: String, required: true },
    B: { type: String, required: true },
    C: { type: String, required: true },
    D: { type: String, required: true },
  },
  { _id: false },
);

const questionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    questionNo: { type: String, required: true },
    question: { type: String, required: true },
    options: { type: optionSchema, required: true },
    answer: { type: String, required: true },
  },
  { _id: false },
);

const quizSchema = new mongoose.Schema(
  {
    quizId: { type: Number, required: true, unique: true, min: 1, max: 30 },
    /** Bumped in seedService when JSON changes; mismatch triggers full reseed. */
    version: { type: Number, required: true },
    questions: { type: [questionSchema], required: true },
  },
  { timestamps: true },
);

quizSchema.index({ quizId: 1 });

const Quiz = mongoose.model('Quiz', quizSchema);
export default Quiz;
