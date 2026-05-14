import mongoose from 'mongoose';

const quizGameAutoDeclarePreferenceSchema = new mongoose.Schema(
  {
    gameMode: { type: String, enum: ['2d', '3d'], required: true },
    /** Last super-admin choice: carries to new slots until changed. */
    preferenceAutoDeclareMode: { type: String, enum: ['target', 'random'], default: 'random' },
    preferenceTargetProfitPercent: { type: Number, default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  },
  { timestamps: true },
);

quizGameAutoDeclarePreferenceSchema.index({ gameMode: 1 }, { unique: true });

export default mongoose.model('QuizGameAutoDeclarePreference', quizGameAutoDeclarePreferenceSchema);
