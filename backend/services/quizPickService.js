import Quiz from '../models/quiz/Quiz.js';
import QuizSlotPick from '../models/quiz/QuizSlotPick.js';
import QuizSlotSeed from '../models/quiz/QuizSlotSeed.js';
import QuizRecentPicks from '../models/quiz/QuizRecentPicks.js';
import { getCachedPick, setCachedPick } from './quizCacheService.js';
import { stripQuestionMetaForHint, buildSeedHex, buildSeedHashHex, computeHintPosition } from './randomService.js';
import { getShuffleOrderIndices } from './quizShuffleService.js';

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
  const quiz = await Quiz.findOne({ gameMode, quizId }).lean();
  if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length !== 100) {
    throw new Error('QUIZ_DATA_INVALID');
  }

  const order = await getShuffleOrderIndices(quizId, slotStartIso, seedHex, gameMode);
  const { hintPosition: seedHintPos } = computeHintPosition(seedHex);
  const recentDoc = await QuizRecentPicks.findOne({ quizId }).lean();
  const banned = new Set(recentDoc?.recentIndices ?? []);

  let pos = seedHintPos;
  let chosenIndex = order[pos];
  for (let step = 0; step < 99 && banned.has(chosenIndex); step += 1) {
    pos = (pos + 1) % 100;
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
  const mem = getCachedPick(quizId, slotStartIso);
  if (mem?.hintQuestionText != null) {
    return mem;
  }

  let pick = await QuizSlotPick.findOne({ gameMode, quizId, slotStartIso }).lean();
  if (pick) {
    setCachedPick(quizId, slotStartIso, pick);
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
        setCachedPick(quizId, slotStartIso, pick);
        return pick;
      }
    }
    throw e;
  }

  await pushRecent(quizId, pick.chosenIndex, gameMode);
  setCachedPick(quizId, slotStartIso, pick);
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
