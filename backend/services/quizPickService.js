import Quiz from '../models/quiz/Quiz.js';
import QuizSlotPick from '../models/quiz/QuizSlotPick.js';
import QuizSlotSeed from '../models/quiz/QuizSlotSeed.js';
import QuizRecentPicks from '../models/quiz/QuizRecentPicks.js';
import { getCachedPick, setCachedPick } from './quizCacheService.js';
import { stripQuestionMetaForHint, buildSeedHex, buildSeedHashHex, computeHintPosition } from './randomService.js';
import { getShuffleOrderIndices } from './quizShuffleService.js';
import { ensure3DQuizQuestionBank } from './quizQuestionBankService.js';

const parseQuestionOrderKey = (row, fallback = null) => {
  const explicitOrderRaw = row?.order ?? row?.questionNo ?? row?.position ?? row?.seq;
  const explicitOrder = Number(
    typeof explicitOrderRaw === 'string' ? explicitOrderRaw.replace(/[^\d.-]/g, '') : explicitOrderRaw,
  );
  if (Number.isFinite(explicitOrder)) return explicitOrder;
  const questionText = String(row?.question || '');
  const fromLabelMatch = questionText.match(/\(\s*\d{1,2}\s*-\s*(\d{1,3})\s*\)/);
  if (fromLabelMatch) {
    const parsed = Number(fromLabelMatch[1]);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (fallback != null) return fallback;
  return null;
};

/** Seed hex from DB if committed, else deterministic formula (no DB write). */
async function loadOrDeriveSeedHex(quizId, slotStartIso, gameMode = '2d') {
  const doc = await QuizSlotSeed.findOne({ gameMode, quizId, slotStartIso }).lean();
  if (doc) {
    if (buildSeedHashHex(doc.seed) !== doc.seedHash) {
      throw new Error('SEED_TAMPER');
    }
    return doc.seed;
  }
  return buildSeedHex(quizId, slotStartIso, gameMode);
}

/**
 * Deterministic pick fields (same rules as persisted pick) — does not write QuizSlotPick or recent-picks.
 */
export async function computePickFields(quizId, slotStartIso, seedHex, gameMode = '2d') {
  const quiz = gameMode === '3d'
    ? await ensure3DQuizQuestionBank(quizId)
    : await Quiz.findOne({ gameMode, quizId }).lean();
  const questionCount = Array.isArray(quiz?.questions) ? quiz.questions.length : 0;
  const requiredQuestionCount = gameMode === '3d' ? 1000 : 100;
  if (!quiz || !Array.isArray(quiz.questions) || questionCount !== requiredQuestionCount) {
    throw new Error('QUIZ_DATA_INVALID');
  }

  const order = await getShuffleOrderIndices(quizId, slotStartIso, seedHex, gameMode, questionCount);
  const { hintPosition: seedHintPos } = computeHintPosition(seedHex, questionCount);
  const recentDoc = await QuizRecentPicks.findOne({ gameMode, quizId }).lean();
  const banned = new Set(recentDoc?.recentIndices ?? []);

  let pos = seedHintPos;
  let chosenIndex = order[pos];
  for (let step = 0; step < questionCount - 1 && banned.has(chosenIndex); step += 1) {
    pos = (pos + 1) % questionCount;
    chosenIndex = order[pos];
  }

  const q = quiz.questions[chosenIndex];

  return {
    quizId,
    gameMode,
    slotStartIso,
    seedHex,
    chosenIndex,
    hintPosition: pos,
    hintQuestionText: stripQuestionMetaForHint(q.question),
  };
}

async function pushRecent(quizId, chosenIndex, gameMode = '2d') {
  const doc = await QuizRecentPicks.findOne({ gameMode, quizId });
  const prev = doc?.recentIndices ?? [];
  const merged = [chosenIndex, ...prev].slice(0, 5);
  await QuizRecentPicks.findOneAndUpdate(
    { gameMode, quizId },
    { $set: { recentIndices: merged } },
    { upsert: true },
  );
}

async function ensureSlotSeed(quizId, slotStartIso, gameMode = '2d') {
  const computedSeedHex = buildSeedHex(quizId, slotStartIso, gameMode);
  const computedHash = buildSeedHashHex(computedSeedHex);

  let doc = await QuizSlotSeed.findOne({ gameMode, quizId, slotStartIso }).lean();
  if (doc) {
    if (buildSeedHashHex(doc.seed) !== doc.seedHash) {
      throw new Error('SEED_TAMPER');
    }
    return doc;
  }

  const up = await QuizSlotSeed.updateOne(
    { gameMode, quizId, slotStartIso },
    { $setOnInsert: { seed: computedSeedHex, seedHash: computedHash } },
    { upsert: true },
  );
  if (up.upsertedCount > 0) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ tag: '[quiz:seed]', gameMode, quizId, slotStartIso, seedHash: computedHash }));
  }

  doc = await QuizSlotSeed.findOne({ gameMode, quizId, slotStartIso }).lean();
  if (!doc || buildSeedHashHex(doc.seed) !== doc.seedHash) {
    throw new Error('SEED_STATE_INVALID');
  }
  return doc;
}

/**
 * Locked pick in QuizSlotPick — never recomputes index on repeat requests.
 */
export async function getOrCreatePick(quizId, slotStartIso, gameMode = '2d') {
  const mem = getCachedPick(quizId, slotStartIso, gameMode);
  if (mem?.hintQuestionText != null) {
    return mem;
  }

  let pick = await QuizSlotPick.findOne({ gameMode, quizId, slotStartIso }).lean();
  if (pick) {
    setCachedPick(quizId, slotStartIso, pick, gameMode);
    return pick;
  }

  const seedDoc = await ensureSlotSeed(quizId, slotStartIso, gameMode);
  const fields = await computePickFields(quizId, slotStartIso, seedDoc.seed, gameMode);

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      tag: '[quiz:hint]',
      gameMode,
      quizId,
      slotStartIso,
      hintPosition: fields.hintPosition,
      chosenIndex: fields.chosenIndex,
    }),
  );

  try {
    const created = await QuizSlotPick.create(fields);
    pick = created.toObject();
  } catch (e) {
    if (e?.code === 11000) {
      pick = await QuizSlotPick.findOne({ gameMode, quizId, slotStartIso }).lean();
      if (pick) {
        setCachedPick(quizId, slotStartIso, pick, gameMode);
        return pick;
      }
    }
    throw e;
  }

  await pushRecent(quizId, pick.chosenIndex, gameMode);
  setCachedPick(quizId, slotStartIso, pick, gameMode);
  return pick;
}

/**
 * Read pick from DB if present; otherwise compute winning numbers only (no QuizSlotPick / no pushRecent).
 * Used for read-only day result boards.
 */
export async function peekPickForSlotResult(quizId, slotStartIso, gameMode = '2d') {
  const existing = await QuizSlotPick.findOne({ gameMode, quizId, slotStartIso }).lean();
  if (existing) {
    return existing;
  }
  const seedHex = await loadOrDeriveSeedHex(quizId, slotStartIso, gameMode);
  return computePickFields(quizId, slotStartIso, seedHex, gameMode);
}

/** Random-mode winning position from seed + chosenIndex (ignores target-overridden hintPosition). */
export async function getRandomModeHintPosition(quizId, slotStartIso, gameMode = '2d') {
  const gm = String(gameMode || '2d').toLowerCase() === '3d' ? '3d' : '2d';
  const maxPos = gm === '3d' ? 999 : 99;
  const pick = await getOrCreatePick(quizId, slotStartIso, gm);
  if (pick?.seedHex && Number.isInteger(pick?.chosenIndex)) {
    const len = gm === '3d' ? 1000 : 100;
    const order = await getShuffleOrderIndices(quizId, slotStartIso, pick.seedHex, gm, len);
    const pos = order.indexOf(pick.chosenIndex);
    if (Number.isInteger(pos) && pos >= 0 && pos <= maxPos) return pos;
  }
  const hp = pick?.hintPosition;
  return Number.isInteger(hp) && hp >= 0 && hp <= maxPos ? hp : null;
}

/** Resolve hint question text for shuffled slot position (2D: 0–99, 3D: 0–999). */
export async function resolveHintQuestionTextByPosition(quizId, hintPosition, gameMode = '2d', slotStartIso = null) {
  if (!Number.isInteger(hintPosition) || hintPosition < 0) return null;
  const quiz = gameMode === '3d'
    ? await ensure3DQuizQuestionBank(quizId)
    : await Quiz.findOne({ gameMode, quizId }).lean();
  if (!quiz || !Array.isArray(quiz.questions) || !quiz.questions.length) return null;

  const requiredCount = gameMode === '3d' ? 1000 : 100;
  if (quiz.questions.length !== requiredCount) return null;

  const slotIso = typeof slotStartIso === 'string' ? slotStartIso.trim() : '';
  if (slotIso) {
    const order = await getShuffleOrderIndices(quizId, slotIso, null, gameMode, requiredCount);
    if (hintPosition >= order.length) return null;
    const chosenIndex = order[hintPosition];
    const row = quiz.questions[chosenIndex];
    if (row?.question) return stripQuestionMetaForHint(row.question);
    return null;
  }

  const direct = quiz.questions.find((q) => parseQuestionOrderKey(q) === hintPosition);
  if (direct?.question) return stripQuestionMetaForHint(direct.question);

  // Fallback: index-based compatibility for legacy question banks.
  const byIndex = quiz.questions[hintPosition];
  if (byIndex?.question) return stripQuestionMetaForHint(byIndex.question);
  return null;
}
