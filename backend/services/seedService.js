/**
 * Quiz seeding from JSON file only (bootstrap). Runtime APIs never read this file.
 * - Versioned documents; mismatch or wrong count → full replace.
 * - Atomic when MongoDB supports transactions (replica set); otherwise ordered delete+insert at startup/CLI.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Quiz from '../models/quiz/Quiz.js';
import QuizSlotPick from '../models/quiz/QuizSlotPick.js';
import QuizSlotSeed from '../models/quiz/QuizSlotSeed.js';
import QuizRecentPicks from '../models/quiz/QuizRecentPicks.js';
import QuizBet from '../models/quiz/QuizBet.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JSON_PATH = path.join(__dirname, '../data/quizQuestions.mock.json');

/** Bump when seed JSON or schema shape changes — triggers automatic reseed. */
export const QUIZ_DATA_VERSION = 1;

const EXPECTED_QUIZ_COUNT = 30;
const QUESTIONS_PER_QUIZ = 100;

function isReplicaSetTransactionError(err) {
  const msg = String(err?.message || '');
  return (
    msg.includes('replica set') ||
    msg.includes('mongos') ||
    msg.includes('Transaction numbers are only allowed') ||
    err?.code === 20
  );
}

export function readQuizSeedDocumentsFromFile() {
  if (!fs.existsSync(JSON_PATH)) {
    throw new Error(`Quiz seed file missing: ${JSON_PATH}`);
  }
  const raw = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const bulk = [];
  for (let q = 1; q <= EXPECTED_QUIZ_COUNT; q += 1) {
    const arr = raw[String(q)];
    if (!Array.isArray(arr) || arr.length !== QUESTIONS_PER_QUIZ) {
      throw new Error(`Quiz ${q}: expected ${QUESTIONS_PER_QUIZ} questions in seed JSON`);
    }
    bulk.push({ quizId: q, version: QUIZ_DATA_VERSION, questions: arr });
  }
  return bulk;
}

async function replaceAllQuizDataInTransaction(docs) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await QuizBet.deleteMany({}, { session });
    await QuizSlotPick.deleteMany({}, { session });
    await QuizRecentPicks.deleteMany({}, { session });
    await Quiz.deleteMany({}, { session });
    await Quiz.insertMany(docs, { session });
    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

/** Same outcome without transaction (standalone MongoDB). */
async function replaceAllQuizDataSequential(docs) {
  await QuizBet.deleteMany({});
  await QuizSlotPick.deleteMany({});
  await QuizSlotSeed.deleteMany({});
  await QuizRecentPicks.deleteMany({});
  await Quiz.deleteMany({});
  await Quiz.insertMany(docs);
}

/**
 * Full replace from JSON — clears slot picks / recent picks so indices stay consistent with questions.
 */
export async function reseedQuizzesFromJsonFile() {
  const docs = readQuizSeedDocumentsFromFile();
  try {
    await replaceAllQuizDataInTransaction(docs);
  } catch (err) {
    if (isReplicaSetTransactionError(err)) {
      // eslint-disable-next-line no-console
      console.warn('[quiz:seed] transaction unavailable, using sequential reseed');
      await replaceAllQuizDataSequential(docs);
    } else {
      throw err;
    }
  }
  return { inserted: docs.length, version: QUIZ_DATA_VERSION };
}

async function needsReseed() {
  const total = await Quiz.countDocuments();
  if (total !== EXPECTED_QUIZ_COUNT) return true;
  const wrongVersion = await Quiz.countDocuments({ version: QUIZ_DATA_VERSION });
  if (wrongVersion !== EXPECTED_QUIZ_COUNT) return true;
  return false;
}

/**
 * Call after MongoDB is connected, before accepting quiz traffic.
 */
export async function syncQuizSeedsOnStartup() {
  if (!(await needsReseed())) {
    // eslint-disable-next-line no-console
    console.log(`[quiz:seed] OK — ${EXPECTED_QUIZ_COUNT} quizzes at version ${QUIZ_DATA_VERSION}`);
    return { reseeded: false };
  }
  // eslint-disable-next-line no-console
  console.warn('[quiz:seed] Reseeding quizzes from JSON (count or version mismatch)…');
  const { inserted, version } = await reseedQuizzesFromJsonFile();
  // eslint-disable-next-line no-console
  console.log(`[quiz:seed] Reseeded ${inserted} quizzes at version ${version}`);
  return { reseeded: true, inserted, version };
}
