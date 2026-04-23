import mongoose from 'mongoose';
import QuizSlotDeclaration from '../models/quiz/QuizSlotDeclaration.js';

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
  return {
    autoDeclareBlocked: Boolean(row.autoDeclareBlocked),
    declared: Boolean(row.declaredAt),
    declaredAt: row.declaredAt || null,
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

export async function markSlotDeclared(slotStartIso, gameMode = '2d', adminId = null, options = {}) {
  const mode = normalizeMode(gameMode);
  const updatedBy = toObjectIdOrNull(adminId);
  const force = Boolean(options?.force);
  const filter = force
    ? { gameMode: mode, slotStartIso }
    : { gameMode: mode, slotStartIso, autoDeclareBlocked: { $ne: true } };
  const updated = await QuizSlotDeclaration.findOneAndUpdate(
    filter,
    { $set: { autoDeclareBlocked: false, declaredAt: new Date(), updatedBy } },
    { upsert: true, new: true },
  );
  return Boolean(updated);
}

