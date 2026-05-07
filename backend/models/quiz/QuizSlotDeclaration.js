import mongoose from 'mongoose';

const quizSlotDeclarationSchema = new mongoose.Schema(
  {
    gameMode: { type: String, enum: ['2d', '3d'], required: true },
    slotStartIso: { type: String, required: true },
    autoDeclareBlocked: { type: Boolean, default: false },
    targetProfitPercent: { type: Number, default: null },
    declaredAt: { type: Date, default: null },
    declaredResults: {
      type: [
        {
          quizId: { type: Number, required: true },
          result: { type: Number, default: null },
        },
      ],
      default: [],
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  },
  { timestamps: true },
);

quizSlotDeclarationSchema.index({ gameMode: 1, slotStartIso: 1 }, { unique: true });

export default mongoose.model('QuizSlotDeclaration', quizSlotDeclarationSchema);

