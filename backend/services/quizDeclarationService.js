import mongoose from 'mongoose';
import QuizSlotDeclaration from '../models/quiz/QuizSlotDeclaration.js';
import QuizSlotPick from '../models/quiz/QuizSlotPick.js';

const normalizeMode = (mode) => (String(mode || '2d').toLowerCase() === '3d' ? '3d' : '2d');

function toObjectIdOrNull(value) {
  return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
}

export async function getSlotDeclarationRow(slotStartIso, gameMode = '2d') {
  return QuizSlotDeclaration.findOne({ gameMode: normalizeMode(gameMode), slotStartIso }).lean();
}

export async function getSlotDeclarationState(slotStartIso, gameMode = '2d', slotEndMs = null) {
  const row = await getSlotDeclarationRow(slotStartIso, gameMode);
  if (!row) {
    return {
      autoDeclareBlocked: false,
      declared: false,
      declaredAt: null,
    };
  }
  const rawTargetProfitPercent = row?.targetProfitPercent;
  return {
    autoDeclareBlocked: Boolean(row.autoDeclareBlocked),
    declared: Boolean(row.declaredAt),
    declaredAt: row.declaredAt || null,
    targetProfitPercent: Number.isFinite(rawTargetProfitPercent) ? rawTargetProfitPercent : null,
  };
}

export async function isAutoDeclareBlocked(slotStartIso, gameMode = '2d') {
  const row = await getSlotDeclarationRow(slotStartIso, gameMode);
  if (!row) return false;
  return Boolean(row.autoDeclareBlocked) && !row.declaredAt;
}

export async function isSlotDeclared(slotStartIso, gameMode = '2d', slotEndMs = null) {
  const state = await getSlotDeclarationState(slotStartIso, gameMode, slotEndMs);
  return Boolean(state.declared);
}

export async function blockAutoDeclare(slotStartIso, gameMode = '2d', adminId = null) {
  const mode = normalizeMode(gameMode);
  const updatedBy = toObjectIdOrNull(adminId);
  await QuizSlotDeclaration.findOneAndUpdate(
    { gameMode: mode, slotStartIso },
    { $set: { autoDeclareBlocked: true, declaredAt: null, updatedBy } },
    { upsert: true, new: true },
  );
}

export async function enableAutoDeclare(slotStartIso, gameMode = '2d', adminId = null) {
  const mode = normalizeMode(gameMode);
  const updatedBy = toObjectIdOrNull(adminId);
  await QuizSlotDeclaration.findOneAndUpdate(
    { gameMode: mode, slotStartIso },
    { $set: { autoDeclareBlocked: false, updatedBy }, $setOnInsert: { declaredAt: null } },
    { upsert: true, new: true },
  );
}

export async function setSlotTargetProfitPercent(slotStartIso, gameMode = '2d', targetProfitPercent = null, adminId = null) {
  const mode = normalizeMode(gameMode);
  const updatedBy = toObjectIdOrNull(adminId);
  const hasExplicitTarget = targetProfitPercent !== null && targetProfitPercent !== undefined && targetProfitPercent !== '';
  const parsedTarget = hasExplicitTarget ? Number(targetProfitPercent) : NaN;
  const normalized = Number.isFinite(parsedTarget)
    ? Math.min(1000, Math.max(-100, parsedTarget))
    : null;
  await QuizSlotDeclaration.findOneAndUpdate(
    { gameMode: mode, slotStartIso },
    { $set: { targetProfitPercent: normalized, updatedBy }, $setOnInsert: { declaredAt: null, autoDeclareBlocked: false } },
    { upsert: true, new: true },
  );
}

export async function markSlotDeclared(slotStartIso, gameMode = '2d', adminId = null, options = {}) {
  const mode = normalizeMode(gameMode);
  const updatedBy = toObjectIdOrNull(adminId);
  const force = Boolean(options?.force);
  let declaredResults = null;
  if (options?.captureResults) {
    const maxQuizId = mode === '3d' ? 3 : 30;
    const maxPos = mode === '3d' ? 999 : 99;
    const picks = await QuizSlotPick.find({ gameMode: mode, slotStartIso })
      .select('quizId hintPosition')
      .lean();
    const byQuiz = new Map(
      picks
        .filter((p) => Number.isInteger(p?.quizId))
        .map((p) => [p.quizId, p.hintPosition]),
    );
    declaredResults = [];
    for (let quizId = 1; quizId <= maxQuizId; quizId += 1) {
      const hp = byQuiz.get(quizId);
      const isValid = Number.isInteger(hp) && hp >= 0 && hp <= maxPos;
      declaredResults.push({ quizId, result: isValid ? hp : null });
    }
  }
  const filter = force
    ? { gameMode: mode, slotStartIso }
    : { gameMode: mode, slotStartIso, autoDeclareBlocked: { $ne: true } };
  const setPayload = { autoDeclareBlocked: false, declaredAt: new Date(), updatedBy };
  if (Array.isArray(declaredResults)) {
    setPayload.declaredResults = declaredResults;
  }
  const updated = await QuizSlotDeclaration.findOneAndUpdate(
    filter,
    { $set: setPayload },
    { upsert: true, new: true },
  );
  return Boolean(updated);
}

