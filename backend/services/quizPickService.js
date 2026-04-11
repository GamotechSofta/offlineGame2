import Quiz from '../models/quiz/Quiz.js';
import QuizSlotPick from '../models/quiz/QuizSlotPick.js';
import QuizSlotSeed from '../models/quiz/QuizSlotSeed.js';
import QuizRecentPicks from '../models/quiz/QuizRecentPicks.js';
import { getCachedPick, setCachedPick } from './quizCacheService.js';
import { stripQuestionMetaForHint, buildSeedHex, buildSeedHashHex, computeHintPosition } from './randomService.js';
import { getShuffleOrderIndices } from './quizShuffleService.js';

/** Seed hex from DB if committed, else deterministic formula (no DB write). */
async function loadOrDeriveSeedHex(quizId, slotStartIso) {
  const doc = await QuizSlotSeed.findOne({ quizId, slotStartIso }).lean();
  if (doc) {
    if (buildSeedHashHex(doc.seed) !== doc.seedHash) {
      throw new Error('SEED_TAMPER');
    }
    return doc.seed;
  }
  return buildSeedHex(quizId, slotStartIso);
}

/**
 * Deterministic pick fields (same rules as persisted pick) — does not write QuizSlotPick or recent-picks.
 */
export async function computePickFields(quizId, slotStartIso, seedHex) {
  const quiz = await Quiz.findOne({ quizId }).lean();
  if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length !== 100) {
    throw new Error('QUIZ_DATA_INVALID');
  }

  const order = await getShuffleOrderIndices(quizId, slotStartIso, seedHex);
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
    slotStartIso,
    seedHex,
    chosenIndex,
    hintPosition: pos,
    hintQuestionText: stripQuestionMetaForHint(q.question),
  };
}

async function pushRecent(quizId, chosenIndex) {
  const doc = await QuizRecentPicks.findOne({ quizId });
  const prev = doc?.recentIndices ?? [];
  const merged = [chosenIndex, ...prev].slice(0, 5);
  await QuizRecentPicks.findOneAndUpdate(
    { quizId },
    { $set: { recentIndices: merged } },
    { upsert: true },
  );
}

async function ensureSlotSeed(quizId, slotStartIso) {
  const computedSeedHex = buildSeedHex(quizId, slotStartIso);
  const computedHash = buildSeedHashHex(computedSeedHex);

  let doc = await QuizSlotSeed.findOne({ quizId, slotStartIso }).lean();
  if (doc) {
    if (buildSeedHashHex(doc.seed) !== doc.seedHash) {
      throw new Error('SEED_TAMPER');
    }
    return doc;
  }

  const up = await QuizSlotSeed.updateOne(
    { quizId, slotStartIso },
    { $setOnInsert: { seed: computedSeedHex, seedHash: computedHash } },
    { upsert: true },
  );
  if (up.upsertedCount > 0) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ tag: '[quiz:seed]', quizId, slotStartIso, seedHash: computedHash }));
  }

  doc = await QuizSlotSeed.findOne({ quizId, slotStartIso }).lean();
  if (!doc || buildSeedHashHex(doc.seed) !== doc.seedHash) {
    throw new Error('SEED_STATE_INVALID');
  }
  return doc;
}

/**
 * Locked pick in QuizSlotPick — never recomputes index on repeat requests.
 */
export async function getOrCreatePick(quizId, slotStartIso) {
  const mem = getCachedPick(quizId, slotStartIso);
  if (mem?.hintQuestionText != null) {
    return mem;
  }

  let pick = await QuizSlotPick.findOne({ quizId, slotStartIso }).lean();
  if (pick) {
    setCachedPick(quizId, slotStartIso, pick);
    return pick;
  }

  const seedDoc = await ensureSlotSeed(quizId, slotStartIso);
  const fields = await computePickFields(quizId, slotStartIso, seedDoc.seed);

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      tag: '[quiz:hint]',
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
      pick = await QuizSlotPick.findOne({ quizId, slotStartIso }).lean();
      if (pick) {
        setCachedPick(quizId, slotStartIso, pick);
        return pick;
      }
    }
    throw e;
  }

  await pushRecent(quizId, pick.chosenIndex);
  setCachedPick(quizId, slotStartIso, pick);
  return pick;
}

/**
 * Read pick from DB if present; otherwise compute winning numbers only (no QuizSlotPick / no pushRecent).
 * Used for read-only day result boards.
 */
export async function peekPickForSlotResult(quizId, slotStartIso) {
  const existing = await QuizSlotPick.findOne({ quizId, slotStartIso }).lean();
  if (existing) {
    return existing;
  }
  const seedHex = await loadOrDeriveSeedHex(quizId, slotStartIso);
  return computePickFields(quizId, slotStartIso, seedHex);
}
