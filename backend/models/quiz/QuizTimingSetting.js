import mongoose from 'mongoose';

const quizTimingSettingSchema = new mongoose.Schema(
  {
    gameMode: { type: String, enum: ['2d', '3d'], required: true, unique: true, index: true },
    studyMinutes: { type: Number, required: true, min: 1, max: 15 },
    questionRevealStaggerMs: { type: Number, required: true, min: 100, max: 120000 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  },
  { timestamps: true },
);

export default mongoose.model('QuizTimingSetting', quizTimingSettingSchema);
