import mongoose from 'mongoose';
import Quiz from '../models/quiz/Quiz.js';
import QuizSlotPick from '../models/quiz/QuizSlotPick.js';
import QuizSlotSeed from '../models/quiz/QuizSlotSeed.js';
import QuizBet from '../models/quiz/QuizBet.js';
import User from '../models/user/user.js';
import { Wallet } from '../models/wallet/wallet.js';
import { getCachedSlotContext } from '../services/quizCacheService.js';
import {
  SLOT_MINUTES,
  SLOT_MS,
  formatDrawLabel,
  getStudyMinutesForMode,
  getStudySecondsForMode,
  isValidISTSlotStartIso,
  isSlotStartInFuture,
} from '../services/slotService.js';
import { buildSeedHashHex } from '../services/randomService.js';
import { getShuffleOrderIndices } from '../services/quizShuffleService.js';
import { getOrCreatePick } from '../services/quizPickService.js';
import { resolveWinningShuffledPosition } from '../services/quizPickPositionService.js';
import { settleQuizBetsForSlot } from '../services/quizBetSettlement.js';
import { getBetOwnerKey } from '../utils/betOwnerKey.js';
import { ensure3DQuizQuestionBank } from '../services/quizQuestionBankService.js';
import { getQuizTimingSettingsSnapshot } from '../services/quizTimingSettingsService.js';
import { isSlotDeclared } from '../services/quizDeclarationService.js';

const QUIZ_BET_MIN_STAKE = 1;
const QUIZ_BET_MAX_STAKE = 1_000_000;
const QUIZ_BET_MODE_ALIASES = new Map([
  ['single', 'str'],
  ['str', 'str'],
  ['box', 'box'],
  ['fp', 'fp'],
  ['bp', 'bp'],
  ['sp', 'sp'],
  ['ap', 'ap'],
  ['duplicates', 'duplicates'],
  ['dp', 'duplicates'],
  ['triples', 'triples'],
  ['tp', 'triples'],
]);
const resolveGameMode = (req) => (String(req.query?.mode || req.body?.mode || '2d').toLowerCase() === '3d' ? '3d' : '2d');
const getQuizIdUpperLimit = (gameMode) => (gameMode === '3d' ? 3 : 30);
const getQuizNumberUpperLimit = (gameMode) => (gameMode === '3d' ? 999 : 99);
const getQuizQuestionCount = (gameMode) => (gameMode === '3d' ? 1000 : 100);
const normalizeQuizBetMode = (modeRaw) => {
  const key = String(modeRaw || '').trim().toLowerCase();
  return QUIZ_BET_MODE_ALIASES.get(key) || null;
};
let ensureQuizBetIndexesPromise = null;
async function ensureQuizBetIndexes() {
  if (!ensureQuizBetIndexesPromise) {
    ensureQuizBetIndexesPromise = QuizBet.syncIndexes().catch((err) => {
      ensureQuizBetIndexesPromise = null;
      throw err;
    });
  }
  await ensureQuizBetIndexesPromise;
}

function slotAcceptsBets(ctx, nowMs = Date.now()) {
  if (ctx?.slotStartMs == null || ctx?.slotEndMs == null) return false;
  return nowMs >= ctx.slotStartMs && nowMs < ctx.slotEndMs;
}

function resolveRequestedSlotStartIso(ctx, requestedSlotRaw, nowMs = Date.now()) {
  const requested = String(requestedSlotRaw || '').trim();
  if (!requested) {
    if (!slotAcceptsBets(ctx, nowMs)) return { ok: false, code: 'SLOT_CLOSED' };
    return { ok: true, slotStartIso: ctx.slotStartIso };
  }
  if (!isValidISTSlotStartIso(requested)) return { ok: false, code: 'INVALID_SLOT' };
  const slotStartMs = new Date(requested).getTime();
  if (!Number.isFinite(slotStartMs)) return { ok: false, code: 'INVALID_SLOT' };
  const slotEndMs = slotStartMs + SLOT_MS;
  if (nowMs >= slotEndMs) return { ok: false, code: 'SLOT_CLOSED' };
  return { ok: true, slotStartIso: requested };
}

/**
 * Apply amount increases + new QuizBet rows. On failure, reverse applied ops and refund wallet once.
 */
async function applyMergesAndInsertsOrRefund(userId, totalStake, incs, insertDocs) {
  try {
    if (incs.length) {
      const incOps = incs.map(({ _id, amount }) => ({
        updateOne: {
          filter: { _id },
          update: { $inc: { amount } },
        },
      }));
      const incResult = await QuizBet.bulkWrite(incOps, { ordered: true });
      const matched = Number(incResult?.matchedCount || 0);
      if (matched !== incs.length) throw new Error('MERGE_TARGET_MISSING');
    }
    if (insertDocs.length) {
      await QuizBet.insertMany(insertDocs, { ordered: true });
    }
  } catch (e) {
    // Rollback in bulk to keep refund path fast even for large payloads.
    if (insertDocs.length) {
      const insertedIds = insertDocs.map((d) => d?._id).filter(Boolean);
      if (insertedIds.length) {
        await QuizBet.deleteMany({ _id: { $in: insertedIds } });
      }
    }
    if (incs.length) {
      const rollbackIncOps = incs.map(({ _id, amount }) => ({
        updateOne: {
          filter: { _id },
          update: { $inc: { amount: -amount } },
        },
      }));
      await QuizBet.bulkWrite(rollbackIncOps, { ordered: false });
    }
    await Wallet.findOneAndUpdate({ userId }, { $inc: { balance: totalStake } });
    if (e?.code === 11000) {
      const err = new Error('Duplicate number');
      err.code = 11000;
      throw err;
    }
    throw e;
  }
}

export const getSlot = async (req, res) => {
  try {
    const now = Date.now();
    const gameMode = resolveGameMode(req);
    const ctx = getCachedSlotContext(new Date(now), gameMode);
    const studySeconds = getStudySecondsForMode(gameMode);
    const secondsUntilHint = Math.max(0, studySeconds - ctx.secIntoSlot);
    const secondsUntilSlotEnd = Math.max(0, Math.floor((ctx.slotEndMs - now) / 1000));
    const acceptsBets = slotAcceptsBets(ctx, now);

    res.json({
      success: true,
      data: {
        serverNowIso: new Date(now).toISOString(),
        slotStartIso: ctx.slotStartIso,
        slotEndIso: new Date(ctx.slotEndMs).toISOString(),
        phase: ctx.phase,
        acceptsBets,
        slotIndex: ctx.slotIndex,
        istDayKey: ctx.istDayKey,
        secondsUntilHint,
        secondsUntilSlotEnd,
        drawLabelPrev: formatDrawLabel(ctx.previousSlotEndMs),
        drawLabelCurrent: formatDrawLabel(ctx.slotEndMs),
        drawLabelNext: formatDrawLabel(ctx.nextSlotEndMs),
        previousSlotStartIso: ctx.previousSlotStartIso,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('getSlot', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

export const getQuestions = async (req, res) => {
  try {
    const quizId = req.quizId;
    const gameMode = resolveGameMode(req);
    const ctx = getCachedSlotContext(new Date(), gameMode);
    const studyMinutes = getStudyMinutesForMode(gameMode);
    if (ctx.phase !== 'study') {
      return res.status(403).json({
        success: false,
        code: 'NOT_STUDY_PHASE',
        message: `Questions list is only available during the study phase (first ${studyMinutes} minutes of the slot, IST).`,
        phase: ctx.phase,
      });
    }

    const quiz = gameMode === '3d'
      ? await ensure3DQuizQuestionBank(quizId)
      : await Quiz.findOne({ gameMode, quizId }).lean();
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }
    const expectedCount = getQuizQuestionCount(gameMode);
    if (!Array.isArray(quiz.questions) || quiz.questions.length !== expectedCount) {
      return res.status(500).json({ success: false, message: 'Quiz data invalid' });
    }

    const order = await getShuffleOrderIndices(quizId, ctx.slotStartIso, null, gameMode, expectedCount);
    const questions = order.map((idx) => quiz.questions[idx]);
    const data = {
      quizId,
      slotStartIso: ctx.slotStartIso,
      questions,
    };
    if (process.env.DEBUG_QUIZ_SHUFFLE === '1') {
      data.shuffledIndices = order;
    }
    res.json({ success: true, data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('getQuestions', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

export const getHint = async (req, res) => {
  try {
    const quizId = req.quizId;
    const gameMode = resolveGameMode(req);
    const ctx = getCachedSlotContext(new Date(), gameMode);
    const studyMinutes = getStudyMinutesForMode(gameMode);
    if (ctx.phase !== 'hint') {
      return res.status(403).json({
        success: false,
        code: 'NOT_HINT_PHASE',
        message: `Hint is only available during the last ${SLOT_MINUTES - studyMinutes} minutes of the slot (IST).`,
        phase: ctx.phase,
      });
    }

    const pick = await getOrCreatePick(quizId, ctx.slotStartIso, gameMode);
    const seedRow = await QuizSlotSeed.findOne({ gameMode, quizId, slotStartIso: ctx.slotStartIso }).lean();

    res.json({
      success: true,
      data: {
        questionText: pick.hintQuestionText,
        slotStartIso: ctx.slotStartIso,
        seedHash: seedRow?.seedHash ?? null,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('getHint', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

export const getResult = async (req, res) => {
  try {
    const quizId = req.quizId;
    const gameMode = resolveGameMode(req);
    const slotStartIso = req.query.slotStartIso;
    if (!slotStartIso || typeof slotStartIso !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'slotStartIso query is required (use the value returned with the hint).',
      });
    }

    if (!isValidISTSlotStartIso(slotStartIso)) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_SLOT',
        message: 'slotStartIso is not a valid IST 15-minute slot boundary.',
      });
    }

    if (isSlotStartInFuture(slotStartIso)) {
      return res.status(400).json({
        success: false,
        code: 'FUTURE_SLOT',
        message: 'Invalid slotStartIso for this server time.',
      });
    }

    const slotStartMs = new Date(slotStartIso).getTime();
    const slotEndMs = slotStartMs + SLOT_MS;
    if (Date.now() < slotEndMs) {
      return res.status(403).json({
        success: false,
        code: 'SLOT_NOT_ENDED',
        message: 'Result is published only after this slot ends (IST).',
      });
    }
    if (!(await isSlotDeclared(slotStartIso, gameMode, slotEndMs))) {
      return res.status(403).json({
        success: false,
        code: 'RESULT_NOT_DECLARED',
        message: 'Result is not declared yet for this slot.',
      });
    }

    /** Result index is read-only from persisted pick — never recomputed. */
    const pick = await QuizSlotPick.findOne({ gameMode, quizId, slotStartIso }).lean();
    if (!pick) {
      return res.status(404).json({ success: false, message: 'No hint record for this slot.' });
    }

    const seedRow = await QuizSlotSeed.findOne({ gameMode, quizId, slotStartIso }).lean();
    if (!seedRow || buildSeedHashHex(seedRow.seed) !== seedRow.seedHash) {
      return res.status(404).json({ success: false, message: 'No seed record for this slot.' });
    }

    const winningPos = await resolveWinningShuffledPosition(quizId, slotStartIso, pick, gameMode);

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        tag: '[quiz:result]',
        quizId,
        slotStartIso,
        hintPosition: winningPos,
        seedHash: seedRow.seedHash,
      }),
    );

    res.json({
      success: true,
      data: {
        slotStartIso,
        seed: seedRow.seed,
        seedHash: seedRow.seedHash,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('getResult', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

export const getQuizSettings = async (req, res) => {
  try {
    const mode = resolveGameMode(req);
    const settings = getQuizTimingSettingsSnapshot(mode);
    return res.json({ success: true, data: { mode, ...settings } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

/**
 * POST /api/v1/quiz/bet
 * Body: { quizId, bets: [{ number, amount }] } — any time while current 15m IST slot is open;
 * repeat number adds to stake (merge).
 */
export const postQuizBet = async (req, res) => {
  try {
    const userId = req.userId;
    const gameMode = resolveGameMode(req);
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    await ensureQuizBetIndexes();

    const numberUpperLimit = getQuizNumberUpperLimit(gameMode);
    const { quizId: rawQuizId, bets: rawBets } = req.body || {};
    const quizIdUpperLimit = getQuizIdUpperLimit(gameMode);
    const quizId = Number(rawQuizId);
    if (!Number.isInteger(quizId) || quizId < 1 || quizId > quizIdUpperLimit) {
      return res.status(400).json({ success: false, message: `quizId must be 1–${quizIdUpperLimit}` });
    }
    if (!Array.isArray(rawBets) || rawBets.length === 0) {
      return res.status(400).json({ success: false, message: 'bets array is required' });
    }

    const now = Date.now();
    const ctx = getCachedSlotContext(new Date(now), gameMode);
    const slotResolution = resolveRequestedSlotStartIso(ctx, req.body?.slotStartIso, now);
    if (!slotResolution.ok) {
      if (slotResolution.code === 'INVALID_SLOT') {
        return res.status(400).json({ success: false, code: 'INVALID_SLOT', message: 'Invalid slotStartIso.' });
      }
      return res.status(403).json({
        success: false,
        code: 'SLOT_CLOSED',
        message: 'Selected draw slot is closed.',
      });
    }
    const slotStartIso = slotResolution.slotStartIso;
    if (!isValidISTSlotStartIso(slotStartIso)) {
      return res.status(400).json({ success: false, code: 'INVALID_SLOT', message: 'Invalid slot' });
    }

    const user = await User.findById(userId).select('isActive').lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_SUSPENDED',
        message: 'Your account has been suspended.',
      });
    }

    const numbersSeen = new Set();
    const lines = [];
    let totalStake = 0;
    for (const b of rawBets) {
      const num =
        typeof b.number === 'number' && Number.isInteger(b.number)
          ? b.number
          : parseInt(String(b.number ?? '').replace(/\D/g, '').slice(0, gameMode === '3d' ? 3 : 2), 10);
      if (Number.isNaN(num) || num < 0 || num > numberUpperLimit) {
        return res.status(400).json({ success: false, message: `Each number must be 0–${numberUpperLimit}` });
      }
      const betMode = normalizeQuizBetMode(b?.betMode || b?.mode || 'str');
      if (!betMode) {
        return res.status(400).json({ success: false, message: 'Invalid bet mode in request' });
      }
      const duplicateKey = `${num}|${betMode}`;
      if (numbersSeen.has(duplicateKey)) {
        return res.status(400).json({ success: false, message: 'Duplicate numbers in request' });
      }
      numbersSeen.add(duplicateKey);
      const amount = Number(b.amount);
      if (!Number.isFinite(amount) || amount < QUIZ_BET_MIN_STAKE || amount > QUIZ_BET_MAX_STAKE) {
        return res.status(400).json({
          success: false,
          message: `Each amount must be between ${QUIZ_BET_MIN_STAKE} and ${QUIZ_BET_MAX_STAKE}`,
        });
      }
      totalStake += amount;
      lines.push({ num, amount, betMode });
    }

    const owner = getBetOwnerKey(req);
    const existing = await QuizBet.find({
      gameMode,
      betOwnerKey: owner,
      quizId,
      slotStartIso,
      status: { $ne: 'cancelled' },
    }).lean();
    const existingByKey = new Map(existing.map((e) => [`${e.number}|${normalizeQuizBetMode(e.betMode || 'str') || 'str'}`, e]));
    const uid = new mongoose.Types.ObjectId(userId);
    const incs = [];
    const insertDocs = [];
    for (const { num, amount, betMode } of lines) {
      const ex = existingByKey.get(`${num}|${betMode}`);
      if (ex) {
        incs.push({ _id: ex._id, amount });
      } else {
        insertDocs.push({
          _id: new mongoose.Types.ObjectId(),
          gameMode,
          betOwnerKey: owner,
          userId: uid,
          quizId,
          slotStartIso,
          number: num,
          betMode,
          amount,
          status: 'pending',
          winPayout: 0,
        });
      }
    }

    const walletUpdate = await Wallet.findOneAndUpdate(
      { userId, balance: { $gte: totalStake } },
      { $inc: { balance: -totalStake } },
      { new: true },
    ).lean();
    if (!walletUpdate) {
      const w = await Wallet.findOne({ userId }).select('balance').lean();
      const bal = w?.balance ?? 0;
      return res.status(400).json({
        success: false,
        code: 'INSUFFICIENT_BALANCE',
        message: `Insufficient balance. Need ₹${totalStake}, available ₹${bal}`,
      });
    }

    try {
      await applyMergesAndInsertsOrRefund(userId, totalStake, incs, insertDocs);
    } catch (e) {
      if (e?.code === 11000) {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_NUMBER',
          message: 'Could not apply bet (duplicate). Try again.',
        });
      }
      throw e;
    }

    res.status(201).json({
      success: true,
      data: {
        quizId,
        slotStartIso,
        betsInserted: insertDocs.length,
        stakeAddedToExisting: incs.length,
        linesProcessed: lines.length,
        totalStake,
        balance: walletUpdate.balance,
        bets: lines.map((l) => ({ number: l.num, amount: l.amount, betMode: l.betMode })),
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('postQuizBet', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

/**
 * POST /api/v1/quiz/bet-batch
 * Body: { rounds: [{ quizId, bets: [{ number, amount }] }] } — one wallet debit while slot open;
 * same number again increases stake.
 */
export const postQuizBetsBatch = async (req, res) => {
  try {
    const userId = req.userId;
    const gameMode = resolveGameMode(req);
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    await ensureQuizBetIndexes();

    const numberUpperLimit = getQuizNumberUpperLimit(gameMode);
    const { rounds: rawRounds } = req.body || {};
    const quizIdUpperLimit = getQuizIdUpperLimit(gameMode);
    if (!Array.isArray(rawRounds) || rawRounds.length === 0) {
      return res.status(400).json({ success: false, message: 'rounds array is required' });
    }

    const now = Date.now();
    const ctx = getCachedSlotContext(new Date(now), gameMode);
    const slotResolution = resolveRequestedSlotStartIso(ctx, req.body?.slotStartIso, now);
    if (!slotResolution.ok) {
      if (slotResolution.code === 'INVALID_SLOT') {
        return res.status(400).json({ success: false, code: 'INVALID_SLOT', message: 'Invalid slotStartIso.' });
      }
      return res.status(403).json({
        success: false,
        code: 'SLOT_CLOSED',
        message: 'Selected draw slot is closed.',
      });
    }
    const slotStartIso = slotResolution.slotStartIso;
    if (!isValidISTSlotStartIso(slotStartIso)) {
      return res.status(400).json({ success: false, code: 'INVALID_SLOT', message: 'Invalid slot' });
    }

    const user = await User.findById(userId).select('isActive').lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_SUSPENDED',
        message: 'Your account has been suspended.',
      });
    }

    const owner = getBetOwnerKey(req);
    const uid = new mongoose.Types.ObjectId(userId);
    const normalizedByQuiz = new Map();
    const roundsData = [];

    for (const round of rawRounds) {
      const quizId = Number(round.quizId);
      if (!Number.isInteger(quizId) || quizId < 1 || quizId > quizIdUpperLimit) {
        return res.status(400).json({ success: false, message: `Each round needs quizId 1–${quizIdUpperLimit}` });
      }

      const rawBets = round.bets;
      if (!Array.isArray(rawBets) || rawBets.length === 0) {
        return res.status(400).json({ success: false, message: 'Each round needs a non-empty bets array' });
      }
      const byKey = normalizedByQuiz.get(quizId) || new Map();
      for (const b of rawBets) {
        const num =
          typeof b.number === 'number' && Number.isInteger(b.number)
            ? b.number
            : parseInt(String(b.number ?? '').replace(/\D/g, '').slice(0, gameMode === '3d' ? 3 : 2), 10);
        if (Number.isNaN(num) || num < 0 || num > numberUpperLimit) {
          return res.status(400).json({ success: false, message: `Each number must be 0–${numberUpperLimit} (quiz ${quizId})` });
        }
        const betMode = normalizeQuizBetMode(b?.betMode || b?.mode || 'str');
        if (!betMode) {
          return res.status(400).json({ success: false, message: `Invalid bet mode in request (quiz ${quizId})` });
        }
        const amount = Number(b.amount);
        if (!Number.isFinite(amount) || amount < QUIZ_BET_MIN_STAKE || amount > QUIZ_BET_MAX_STAKE) {
          return res.status(400).json({
            success: false,
            message: `Each amount must be between ${QUIZ_BET_MIN_STAKE} and ${QUIZ_BET_MAX_STAKE} (quiz ${quizId})`,
          });
        }
        const key = `${num}|${betMode}`;
        byKey.set(key, {
          num,
          betMode,
          amount: Number(byKey.get(key)?.amount || 0) + amount,
        });
      }
      normalizedByQuiz.set(quizId, byKey);
    }

    const quizIds = [...normalizedByQuiz.keys()];
    const existingAll = quizIds.length
      ? await QuizBet.find({
          gameMode,
          betOwnerKey: owner,
          slotStartIso,
          quizId: { $in: quizIds },
          status: { $ne: 'cancelled' },
        }).lean()
      : [];
    const existingByCompositeKey = new Map(
      existingAll.map((e) => [
        `${e.quizId}|${e.number}|${normalizeQuizBetMode(e.betMode || 'str') || 'str'}`,
        e,
      ]),
    );

    for (const [quizId, byKey] of normalizedByQuiz.entries()) {
      const lines = [...byKey.values()];
      const incs = [];
      const insertDocs = [];
      for (const { num, amount, betMode } of lines) {
        const ex = existingByCompositeKey.get(`${quizId}|${num}|${betMode}`);
        if (ex) {
          incs.push({ _id: ex._id, amount });
        } else {
          const doc = {
            _id: new mongoose.Types.ObjectId(),
            gameMode,
            betOwnerKey: owner,
            userId: uid,
            quizId,
            slotStartIso,
            number: num,
            betMode,
            amount,
            status: 'pending',
            winPayout: 0,
          };
          insertDocs.push(doc);
          existingByCompositeKey.set(`${quizId}|${num}|${betMode}`, doc);
        }
      }
      roundsData.push({ quizId, lines, incs, insertDocs });
    }

    const totalStake = roundsData.reduce(
      (sum, r) => sum + r.lines.reduce((s, l) => s + l.amount, 0),
      0,
    );

    const walletUpdate = await Wallet.findOneAndUpdate(
      { userId, balance: { $gte: totalStake } },
      { $inc: { balance: -totalStake } },
      { new: true },
    ).lean();
    if (!walletUpdate) {
      const w = await Wallet.findOne({ userId }).select('balance').lean();
      const bal = w?.balance ?? 0;
      return res.status(400).json({
        success: false,
        code: 'INSUFFICIENT_BALANCE',
        message: `Insufficient balance. Need ₹${totalStake}, available ₹${bal}`,
      });
    }

    const flatIncs = roundsData.flatMap((r) => r.incs);
    const flatInserts = roundsData.flatMap((r) => r.insertDocs);
    try {
      await applyMergesAndInsertsOrRefund(userId, totalStake, flatIncs, flatInserts);
    } catch (e) {
      if (e?.code === 11000) {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_NUMBER',
          message: 'Could not apply batch bet (duplicate). Try again.',
        });
      }
      throw e;
    }

    res.status(201).json({
      success: true,
      data: {
        slotStartIso,
        linesProcessed: roundsData.reduce((n, r) => n + r.lines.length, 0),
        betsInserted: flatInserts.length,
        stakeAddedToExisting: flatIncs.length,
        totalStake,
        balance: walletUpdate.balance,
        rounds: roundsData.map((r) => ({
          quizId: r.quizId,
          bets: r.lines.map((l) => ({ number: l.num, amount: l.amount, betMode: l.betMode })),
        })),
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('postQuizBetsBatch', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

/**
 * GET /api/v1/quiz/my-quiz-bets?limit= (default 10000, max 50000)
 * Logged-in user's QuizBet rows (wallet tickets): pending | win | lose + optional winning number after draw.
 */
export const getMyQuizBets = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const limit = Math.min(50000, Math.max(1, parseInt(String(req.query.limit || '10000'), 10) || 10000));
    const uid = new mongoose.Types.ObjectId(userId);
    const gameMode = resolveGameMode(req);

    // Safety net: settle ended pending slots on demand so winners are credited
    // even if scheduler execution was delayed/restarted.
    try {
      const pendingSlotStarts = await QuizBet.distinct('slotStartIso', { gameMode, userId: uid, status: 'pending' });
      const endedPendingSlotStarts = (Array.isArray(pendingSlotStarts) ? pendingSlotStarts : []).filter((slotStartIso) => {
        const slotStartMs = new Date(slotStartIso).getTime();
        if (!Number.isFinite(slotStartMs)) return false;
        return Date.now() >= (slotStartMs + SLOT_MS);
      });
      const declaredSlotStarts = [];
      for (const slotStartIso of endedPendingSlotStarts) {
        // eslint-disable-next-line no-await-in-loop
        const declared = await isSlotDeclared(slotStartIso, gameMode, new Date(slotStartIso).getTime() + SLOT_MS);
        if (declared) declaredSlotStarts.push(slotStartIso);
      }
      if (declaredSlotStarts.length) {
        await Promise.allSettled(
          declaredSlotStarts.map((slotStartIso) => settleQuizBetsForSlot(slotStartIso, gameMode)),
        );
      }
    } catch {
      // If fallback settle fails, continue with best-effort read.
    }

    const bets = await QuizBet.find({ gameMode, userId: uid })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .lean();

    const pairKey = (s, q) => `${s}|${q}`;
    const uniquePairs = new Map();
    for (const b of bets) {
      uniquePairs.set(pairKey(b.slotStartIso, b.quizId), { slotStartIso: b.slotStartIso, quizId: b.quizId });
    }
    const pairs = [...uniquePairs.values()];
    const pickMap = new Map();
    if (pairs.length) {
      const picks = await QuizSlotPick.find({ gameMode, $or: pairs }).select('slotStartIso quizId hintPosition').lean();
      for (const p of picks) {
        pickMap.set(pairKey(p.slotStartIso, p.quizId), p.hintPosition);
      }
    }

    const now = Date.now();
    const data = bets.map((b) => {
      const slotStartMs = new Date(b.slotStartIso).getTime();
      const slotEndMs = slotStartMs + SLOT_MS;
      const slotEnded = now >= slotEndMs;
      const hp = pickMap.get(pairKey(b.slotStartIso, b.quizId));
      const maxPos = gameMode === '3d' ? 999 : 99;
      const padLength = gameMode === '3d' ? 3 : 2;
      const winningNumber =
        slotEnded && hp != null && Number.isInteger(hp) && hp >= 0 && hp <= maxPos ? String(hp).padStart(padLength, '0') : null;
      return {
        id: String(b._id),
        quizId: b.quizId,
        number: b.number,
        betMode: b.betMode || 'str',
        amount: b.amount,
        status: b.status,
        winPayout: b.winPayout,
        slotStartIso: b.slotStartIso,
        drawLabelEnd: formatDrawLabel(slotEndMs),
        slotEnded,
        winningNumber,
        createdAt: b.createdAt,
      };
    });

    res.json({ success: true, data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('getMyQuizBets', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

/**
 * DELETE /api/v1/quiz/my-quiz-bets/:betId?mode=
 * Cancels own pending quiz ticket before the slot ends (result not finalized); refunds stake to wallet.
 */
export const cancelMyQuizBet = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const rawId = req.params?.betId;
    if (!rawId || !mongoose.Types.ObjectId.isValid(String(rawId))) {
      return res.status(400).json({ success: false, message: 'Invalid bet id.' });
    }

    const gameMode = resolveGameMode(req);
    const uid = new mongoose.Types.ObjectId(userId);
    const betId = new mongoose.Types.ObjectId(String(rawId));

    await ensureQuizBetIndexes();

    const bet = await QuizBet.findOne({
      _id: betId,
      userId: uid,
      gameMode,
      status: 'pending',
    }).lean();

    if (!bet) {
      return res.status(404).json({
        success: false,
        message: 'Bet not found or already settled.',
      });
    }

    const slotStartMs = new Date(bet.slotStartIso).getTime();
    if (!Number.isFinite(slotStartMs)) {
      return res.status(400).json({ success: false, message: 'Invalid slot on bet.' });
    }
    const slotEndMs = slotStartMs + SLOT_MS;
    if (Date.now() >= slotEndMs) {
      return res.status(403).json({
        success: false,
        code: 'SLOT_CLOSED',
        message: 'This draw has closed — pending tickets cannot be cancelled.',
      });
    }

    const refund = Math.floor(Number(bet.amount || 0));
    if (!Number.isFinite(refund) || refund <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid stake amount.' });
    }

    const updated = await QuizBet.findOneAndUpdate(
      {
        _id: betId,
        userId: uid,
        gameMode,
        status: 'pending',
      },
      { $set: { status: 'cancelled', winPayout: 0 } },
      { new: true },
    ).lean();

    if (!updated) {
      return res.status(409).json({
        success: false,
        message: 'Could not cancel — bet may have been settled.',
      });
    }

    const walletUpdate = await Wallet.findOneAndUpdate({ userId: uid }, { $inc: { balance: refund } }, { new: true }).lean();

    res.json({
      success: true,
      data: {
        refunded: refund,
        balance: walletUpdate?.balance ?? null,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('cancelMyQuizBet', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};
