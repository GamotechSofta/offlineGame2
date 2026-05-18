import mongoose from 'mongoose';
import QuizGameAutoDeclarePreference from '../models/quiz/QuizGameAutoDeclarePreference.js';
import { getOrCreatePick } from './quizPickService.js';
import {
  getDeclaredTargetPercentForHintApply,
  getSlotDeclarationRow,
  setSlotTargetProfitPercent,
} from './quizDeclarationService.js';
import { apply2DTargetProfitHintsToSlot, apply3DTargetProfitHintsToSlot } from './quizTargetProfitService.js';

function normalizeGameMode(mode) {
  return String(mode || '2d').toLowerCase() === '3d' ? '3d' : '2d';
}

function toObjectIdOrNull(value) {
  return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
}

function clampTargetPercent(n) {
  if (!Number.isFinite(n)) return null;
  return Math.min(1000, Math.max(-100, n));
}

/**
 * Super-admin target/random choice for a game; applied to each new slot until changed.
 */
export async function getPersistedAutoDeclarePreference(gameMode = '2d') {
  const mode = normalizeGameMode(gameMode);
  const row = await QuizGameAutoDeclarePreference.findOne({ gameMode: mode }).lean();
  if (!row || row.preferenceAutoDeclareMode !== 'target') {
    return { mode: 'random', targetProfitPercent: null };
  }
  const t = clampTargetPercent(Number(row.preferenceTargetProfitPercent));
  if (t == null) return { mode: 'random', targetProfitPercent: null };
  return { mode: 'target', targetProfitPercent: t };
}

export async function setPersistedAutoDeclarePreference(gameMode, declareMode, targetProfitPercent, adminId = null) {
  const mode = normalizeGameMode(gameMode);
  const updatedBy = toObjectIdOrNull(adminId);
  const m = declareMode === 'target' ? 'target' : 'random';
  const t = m === 'target' ? clampTargetPercent(Number(targetProfitPercent)) : null;
  await QuizGameAutoDeclarePreference.findOneAndUpdate(
    { gameMode: mode },
    {
      $set: {
        preferenceAutoDeclareMode: m,
        preferenceTargetProfitPercent: t,
        updatedBy,
      },
    },
    { upsert: true, new: true },
  );
}

const quizCountForMode = (gameMode) => (normalizeGameMode(gameMode) === '3d' ? 3 : 30);

/** Recompute and persist target hints for an undeclared slot that has target % armed. */
export async function refreshTargetHintsForSlotIfActive(slotStartIso, gameMode = '2d') {
  const gm = normalizeGameMode(gameMode);
  const declarationRow = await getSlotDeclarationRow(slotStartIso, gm);
  if (declarationRow?.declaredAt) return false;
  const target = getDeclaredTargetPercentForHintApply(declarationRow);
  if (target == null) return false;
  const n = quizCountForMode(gm);
  await Promise.all(Array.from({ length: n }, (_, i) => getOrCreatePick(i + 1, slotStartIso, gm)));
  if (gm === '3d') {
    await apply3DTargetProfitHintsToSlot(slotStartIso, target);
  } else {
    await apply2DTargetProfitHintsToSlot(slotStartIso, target);
  }
  return true;
}

export async function ensurePicksThenApplyPersistedPreference(slotStartIso, gameMode = '2d') {
  const gm = normalizeGameMode(gameMode);
  const n = quizCountForMode(gm);
  await Promise.all(Array.from({ length: n }, (_, i) => getOrCreatePick(i + 1, slotStartIso, gm)));
  await tryApplyPersistedAutoDeclarePreferenceToSlot(slotStartIso, gm);
}

/**
 * If this slot has no explicit target yet and the game preference is target %,
 * upsert declaration and apply target hints (same outcome as admin "Use target mode").
 */
export async function tryApplyPersistedAutoDeclarePreferenceToSlot(slotStartIso, gameMode = '2d') {
  const gm = normalizeGameMode(gameMode);
  const declarationRow = await getSlotDeclarationRow(slotStartIso, gm);
  if (declarationRow?.declaredAt) return;

  const activeTarget = getDeclaredTargetPercentForHintApply(declarationRow);
  if (activeTarget != null) {
    await refreshTargetHintsForSlotIfActive(slotStartIso, gm);
    return;
  }

  if (declarationRow?.autoDeclareMode === 'random') return;

  const pref = await getPersistedAutoDeclarePreference(gm);
  if (pref.mode !== 'target' || pref.targetProfitPercent == null) return;

  /** Callers must have created picks for this slot (e.g. `ensurePicksThenApplyPersistedPreference`). */
  await setSlotTargetProfitPercent(slotStartIso, gm, pref.targetProfitPercent, null);
  if (gm === '3d') {
    await apply3DTargetProfitHintsToSlot(slotStartIso, pref.targetProfitPercent);
  } else {
    await apply2DTargetProfitHintsToSlot(slotStartIso, pref.targetProfitPercent);
  }
}
