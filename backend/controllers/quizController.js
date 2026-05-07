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
import { getRatesMap } from '../models/rate/rate.js';
import { evaluate3DBetAgainstResult, resolve3DPayoutMultiplier } from '../services/quiz3dPayoutHelpers.js';
import { getBetOwnerKey } from '../utils/betOwnerKey.js';
import { ensure3DQuizQuestionBank } from '../services/quizQuestionBankService.js';
import { getQuizTimingSettingsSnapshot } from '../services/quizTimingSettingsService.js';
import { ensureDeclaredResultsSnapshots, isSlotDeclared } from '../services/quizDeclarationService.js';

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

/** Insert new ticket rows. On failure, reverse inserts and refund wallet once. */
async function applyInsertsOrRefund(userId, totalStake, insertDocs) {
  try {
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
    await Wallet.findOneAndUpdate({ userId }, { $inc: { balance: totalStake } });
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
 * Body: { quizId, bets: [{ number, amount }] } — any time while current 15m IST slot is open.
 * Each request creates a brand-new ticket (no merge with previous tickets).
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
    const ticketId = new mongoose.Types.ObjectId().toString();
    const uid = new mongoose.Types.ObjectId(userId);
    const insertDocs = [];
    for (const { num, amount, betMode } of lines) {
      insertDocs.push({
        _id: new mongoose.Types.ObjectId(),
        gameMode,
        betOwnerKey: owner,
        ticketId,
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

    await applyInsertsOrRefund(userId, totalStake, insertDocs);

    res.status(201).json({
      success: true,
      data: {
        ticketId,
        quizId,
        slotStartIso,
        betsInserted: insertDocs.length,
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
 * Body: { rounds: [{ quizId, bets: [{ number, amount }] }] } — one wallet debit while slot open.
 * Each request creates a brand-new ticket (no merge with previous tickets).
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
    const ticketId = new mongoose.Types.ObjectId().toString();
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

    for (const [quizId, byKey] of normalizedByQuiz.entries()) {
      const lines = [...byKey.values()];
      const insertDocs = [];
      for (const { num, amount, betMode } of lines) {
        insertDocs.push({
          _id: new mongoose.Types.ObjectId(),
          gameMode,
          betOwnerKey: owner,
          ticketId,
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
      roundsData.push({ quizId, lines, insertDocs });
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

    const flatInserts = roundsData.flatMap((r) => r.insertDocs);
    await applyInsertsOrRefund(userId, totalStake, flatInserts);

    res.status(201).json({
      success: true,
      data: {
        ticketId,
        slotStartIso,
        linesProcessed: roundsData.reduce((n, r) => n + r.lines.length, 0),
        betsInserted: flatInserts.length,
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
 * GET /api/v1/quiz/my-quiz-bets?limit= (default 1200, max 50000)
 * Logged-in user's QuizBet rows (wallet tickets): pending | win | lose + optional winning number after draw.
 */
export const getMyQuizBets = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const limit = Math.min(50000, Math.max(1, parseInt(String(req.query.limit || '1200'), 10) || 1200));
    const ticketLimitRaw = parseInt(String(req.query.ticketLimit || '0'), 10);
    const ticketLimit = Number.isFinite(ticketLimitRaw) ? Math.min(100, Math.max(0, ticketLimitRaw)) : 0;
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const scope = String(req.query.scope || 'all').trim().toLowerCase();
    const skipTickets = (page - 1) * (ticketLimit || 1);
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
      }).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()).slice(0, 8);
      if (endedPendingSlotStarts.length) {
        await Promise.allSettled(
          endedPendingSlotStarts.map(async (slotStartIso) => {
            // eslint-disable-next-line no-await-in-loop
            const declared = await isSlotDeclared(slotStartIso, gameMode);
            if (declared) {
              await settleQuizBetsForSlot(slotStartIso, gameMode);
              return;
            }
            await settleQuizBetsForSlot(slotStartIso, gameMode, { skipDeclaredCheck: true });
          }),
        );
      }
    } catch {
      // If fallback settle fails, continue with best-effort read.
    }

    // 3D payout safety reconcile:
    // If older rows were settled with legacy fallback multiplier, repair underpaid wins.
    if (gameMode === '3d') {
      try {
        const recentSettled = await QuizBet.find({
          gameMode,
          userId: uid,
          status: { $in: ['win', 'lose'] },
        })
          .select('_id quizId slotStartIso number amount betMode status winPayout')
          .sort({ createdAt: -1, _id: -1 })
          .limit(2500)
          .lean();

        if (recentSettled.length) {
          const nowForReconcile = Date.now();
          const ended = recentSettled.filter((b) => {
            const startMs = new Date(b.slotStartIso).getTime();
            return Number.isFinite(startMs) && nowForReconcile >= (startMs + SLOT_MS);
          });
          if (ended.length) {
            const slotSet = new Set();
            for (const b of ended) slotSet.add(String(b.slotStartIso || '').trim());
            const picks = await QuizSlotPick.find({
              gameMode,
              slotStartIso: { $in: [...slotSet] },
            }).select('slotStartIso quizId hintPosition').lean();
            const pickMap = new Map();
            for (const p of picks) {
              pickMap.set(`${p.slotStartIso}|${p.quizId}`, p.hintPosition);
            }
            const ratesMap = await getRatesMap();

            let totalExtraCredit = 0;
            const bulk = [];
            for (const b of ended) {
              if (String(b.status || '').toLowerCase() === 'cancelled') continue;
              const hp = pickMap.get(`${b.slotStartIso}|${b.quizId}`);
              if (!Number.isInteger(hp) || hp < 0 || hp > 999) continue;
              const ev = evaluate3DBetAgainstResult(b.betMode || 'str', b.number, hp);
              const expectedStatus = ev.matched ? 'win' : 'lose';
              const expectedPayout = ev.matched
                ? Math.round(Number(b.amount || 0) * resolve3DPayoutMultiplier(ratesMap, b.betMode || 'str', b.number, ev))
                : 0;
              const existingPayout = Number(b.winPayout || 0);
              const existingStatus = String(b.status || '').toLowerCase();

              // Apply only safe upgrades (never claw back user payouts).
              if (expectedStatus === 'win' && (existingStatus !== 'win' || expectedPayout > existingPayout)) {
                const delta = Math.max(0, expectedPayout - existingPayout);
                if (delta > 0) totalExtraCredit += delta;
                bulk.push({
                  updateOne: {
                    filter: { _id: b._id },
                    update: { $set: { status: 'win', winPayout: expectedPayout } },
                  },
                });
              }
            }

            if (bulk.length) {
              await QuizBet.bulkWrite(bulk, { ordered: false });
              if (totalExtraCredit > 0) {
                await Wallet.findOneAndUpdate(
                  { userId: uid },
                  { $inc: { balance: totalExtraCredit } },
                  { upsert: true },
                );
              }
            }
          }
        }
      } catch {
        // Reconcile is best-effort; reads should continue.
      }
    }

    const baseMatch = { gameMode, userId: uid };
    if (scope === 'today') {
      const now = new Date();
      const nowInIst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const istMidnight = new Date(nowInIst);
      istMidnight.setHours(0, 0, 0, 0);
      const startUtc = new Date(istMidnight.getTime() - (5.5 * 60 * 60 * 1000));
      const endUtc = new Date(startUtc.getTime() + (24 * 60 * 60 * 1000));
      baseMatch.createdAt = { $gte: startUtc, $lt: endUtc };
    }

    let bets = [];
    let ticketAgg = [];
    let pagination = null;

    if (ticketLimit > 0) {
      const ticketPipelineBase = [
        { $match: baseMatch },
        {
          $group: {
            _id: { ticketId: '$ticketId', slotStartIso: '$slotStartIso' },
            createdAt: { $min: '$createdAt' },
            lineCountAll: { $sum: 1 },
            lineCountActive: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 0, 1] } },
            stakeAll: { $sum: '$amount' },
            stakeActive: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 0, '$amount'] } },
            winLineCount: { $sum: { $cond: [{ $eq: ['$status', 'win'] }, 1, 0] } },
            totalWinPayout: { $sum: { $ifNull: ['$winPayout', 0] } },
          },
        },
      ];
      const ticketAggPaged = await QuizBet.aggregate([
        ...ticketPipelineBase,
        { $sort: { createdAt: -1, '_id.slotStartIso': -1 } },
        { $skip: skipTickets },
        { $limit: ticketLimit + 1 },
      ]);
      const hasMore = ticketAggPaged.length > ticketLimit;
      ticketAgg = hasMore ? ticketAggPaged.slice(0, ticketLimit) : ticketAggPaged;
      pagination = { page, ticketLimit, hasMore };

      const ticketOr = ticketAgg
        .map((row) => {
          const ticketId = row?._id?.ticketId;
          const slotStartIso = row?._id?.slotStartIso;
          if (!ticketId || !slotStartIso) return null;
          return { ticketId, slotStartIso };
        })
        .filter(Boolean);

      bets = ticketOr.length
        ? await QuizBet.find({ gameMode, userId: uid, $or: ticketOr })
          .sort({ createdAt: -1, _id: -1 })
          .limit(Math.max(limit, ticketLimit * 150))
          .lean()
        : [];
    } else {
      const result = await Promise.all([
        QuizBet.find(baseMatch)
          .sort({ createdAt: -1, _id: -1 })
          .limit(limit)
          .lean(),
        QuizBet.aggregate([
          { $match: baseMatch },
          {
            $group: {
              _id: { ticketId: '$ticketId', slotStartIso: '$slotStartIso' },
              lineCountAll: { $sum: 1 },
              lineCountActive: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 0, 1] } },
              stakeAll: { $sum: '$amount' },
              stakeActive: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 0, '$amount'] } },
              winLineCount: { $sum: { $cond: [{ $eq: ['$status', 'win'] }, 1, 0] } },
              totalWinPayout: { $sum: { $ifNull: ['$winPayout', 0] } },
            },
          },
        ]),
      ]);
      bets = result[0];
      ticketAgg = result[1];
    }

    const ticketSummaryByKey = {};
    for (const row of ticketAgg) {
      const tid = row?._id?.ticketId;
      const slot = row?._id?.slotStartIso;
      if (!tid || !slot) continue;
      const key = `${String(tid).trim()}|${slot}`;
      ticketSummaryByKey[key] = {
        lineCountAll: Number(row.lineCountAll || 0),
        lineCountActive: Number(row.lineCountActive || 0),
        stakeAll: Number(row.stakeAll || 0),
        stakeActive: Number(row.stakeActive || 0),
        winLineCount: Number(row.winLineCount || 0),
        totalWinPayout: Number(row.totalWinPayout || 0),
      };
    }

    const slotIsoSet = new Set();
    for (const r of ticketAgg) {
      if (r?._id?.slotStartIso) slotIsoSet.add(r._id.slotStartIso);
    }
    for (const b of bets) {
      if (b?.slotStartIso) slotIsoSet.add(b.slotStartIso);
    }
    const slotList = [...slotIsoSet];

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

    const nowMs = Date.now();
    const declaredResultsBySlot = await ensureDeclaredResultsSnapshots(slotList, gameMode);
    const declaredSlotSet = new Set([...declaredResultsBySlot.keys()]);

    const slotWinnersBySlot = {};
    if (slotList.length) {
      const allPicks = await QuizSlotPick.find({ gameMode, slotStartIso: { $in: slotList } })
        .select('slotStartIso quizId hintPosition')
        .lean();
      const maxPos = gameMode === '3d' ? 999 : 99;
      const padLength = gameMode === '3d' ? 3 : 2;
      for (const p of allPicks) {
        const slotIso = p.slotStartIso;
        const slotStartMs = new Date(slotIso).getTime();
        const slotEndMs = slotStartMs + SLOT_MS;
        const slotEnded = nowMs >= slotEndMs;
        const slotDeclared = declaredSlotSet.has(String(slotIso || ''));
        const snapshotHp = declaredResultsBySlot.get(String(slotIso || ''))?.get(Number(p.quizId));
        const hp = snapshotHp != null ? snapshotHp : p.hintPosition;
        const winningNumber =
          slotEnded && slotDeclared && hp != null && Number.isInteger(hp) && hp >= 0 && hp <= maxPos
            ? String(hp).padStart(padLength, '0')
            : null;
        if (winningNumber == null) continue;
        if (!slotWinnersBySlot[slotIso]) slotWinnersBySlot[slotIso] = {};
        slotWinnersBySlot[slotIso][String(p.quizId)] = winningNumber;
      }
    }

    const now = nowMs;
    const data = bets.map((b) => {
      const slotStartMs = new Date(b.slotStartIso).getTime();
      const slotEndMs = slotStartMs + SLOT_MS;
      const slotEnded = now >= slotEndMs;
      const slotDeclared = declaredSlotSet.has(String(b.slotStartIso || ''));
      const snapshotHp = declaredResultsBySlot.get(String(b.slotStartIso || ''))?.get(Number(b.quizId));
      const hp = snapshotHp != null ? snapshotHp : pickMap.get(pairKey(b.slotStartIso, b.quizId));
      const maxPos = gameMode === '3d' ? 999 : 99;
      const padLength = gameMode === '3d' ? 3 : 2;
      const winningNumber =
        slotEnded && slotDeclared && hp != null && Number.isInteger(hp) && hp >= 0 && hp <= maxPos
          ? String(hp).padStart(padLength, '0')
          : null;
      return {
        id: String(b._id),
        ticketId: b.ticketId || null,
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

    const walletRow = await Wallet.findOne({ userId: uid }).select('balance').lean();
    const balance = walletRow?.balance != null ? Number(walletRow.balance) : null;

    res.json({
      success: true,
      data,
      ticketSummaryByKey,
      slotWinnersBySlot,
      ...(pagination ? { pagination } : {}),
      ...(balance != null && Number.isFinite(balance) ? { balance } : {}),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('getMyQuizBets', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

/**
 * GET /api/v1/quiz/my-quiz-ticket-summary?mode=&limit=
 * Lightweight ticket-level history for large accounts (no per-line payload).
 */
export const getMyQuizTicketSummary = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const limit = Math.min(5000, Math.max(1, parseInt(String(req.query.limit || '1200'), 10) || 1200));
    const uid = new mongoose.Types.ObjectId(userId);
    const gameMode = resolveGameMode(req);

    const ticketAgg = await QuizBet.aggregate([
      { $match: { gameMode, userId: uid } },
      {
        $group: {
          _id: { ticketId: '$ticketId', slotStartIso: '$slotStartIso' },
          createdAt: { $min: '$createdAt' },
          totalBets: { $sum: 1 },
          totalStake: { $sum: '$amount' },
          totalWinPayout: { $sum: { $ifNull: ['$winPayout', 0] } },
          pendingBets: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          winBets: { $sum: { $cond: [{ $eq: ['$status', 'win'] }, 1, 0] } },
          loseBets: { $sum: { $cond: [{ $eq: ['$status', 'lose'] }, 1, 0] } },
          cancelledBets: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          quizzes: { $addToSet: '$quizId' },
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: limit },
    ]);

    const nowMs = Date.now();
    const tickets = ticketAgg.map((row) => {
      const slotStartIso = String(row?._id?.slotStartIso || '');
      const slotStartMs = new Date(slotStartIso).getTime();
      const slotEndMs = slotStartMs + SLOT_MS;
      const slotEnded = Number.isFinite(slotEndMs) ? nowMs >= slotEndMs : false;
      const pendingBets = Number(row?.pendingBets || 0);
      const winBets = Number(row?.winBets || 0);
      const loseBets = Number(row?.loseBets || 0);
      const cancelledBets = Number(row?.cancelledBets || 0);
      const outcome = pendingBets > 0
        ? 'pending'
        : winBets > 0
          ? 'win'
          : (cancelledBets > 0 && loseBets === 0 ? 'cancelled' : 'loss');
      const createdAtIso = row?.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString();
      const createdAtMs = new Date(createdAtIso).getTime();
      const isAdvanceDraw = Number.isFinite(createdAtMs) && Number.isFinite(slotStartMs)
        ? (slotStartMs - createdAtMs) > ((SLOT_MS) + (60 * 1000))
        : false;
      return {
        ticketId: row?._id?.ticketId || null,
        slotStartIso,
        drawLabelEnd: Number.isFinite(slotEndMs) ? formatDrawLabel(slotEndMs) : '-',
        createdAt: createdAtIso,
        slotEnded,
        totalBets: Number(row?.totalBets || 0),
        totalStake: Number(row?.totalStake || 0),
        totalWinPayout: Number(row?.totalWinPayout || 0),
        pendingBets,
        winBets,
        loseBets,
        cancelledBets,
        outcome,
        isAdvanceDraw,
        quizzes: Array.isArray(row?.quizzes) ? row.quizzes : [],
      };
    });

    const walletRow = await Wallet.findOne({ userId: uid }).select('balance').lean();
    const balance = walletRow?.balance != null ? Number(walletRow.balance) : null;

    return res.json({
      success: true,
      data: tickets,
      ...(balance != null && Number.isFinite(balance) ? { balance } : {}),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('getMyQuizTicketSummary', err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};

/**
 * GET /api/v1/quiz/my-quiz-ticket-lines?ticketId=&slotStartIso=&mode=
 * Fetch detailed rows for one ticket only.
 */
export const getMyQuizTicketLines = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    const uid = new mongoose.Types.ObjectId(userId);
    const gameMode = resolveGameMode(req);
    const ticketId = String(req.query?.ticketId || '').trim();
    const slotStartIso = String(req.query?.slotStartIso || '').trim();
    if (!ticketId) {
      return res.status(400).json({ success: false, message: 'ticketId is required.' });
    }

    const match = { gameMode, userId: uid, ticketId };
    if (slotStartIso) match.slotStartIso = slotStartIso;
    const bets = await QuizBet.find(match)
      .sort({ createdAt: -1, _id: -1 })
      .lean();

    if (!bets.length) {
      return res.json({ success: true, data: [] });
    }

    const pairKey = (s, q) => `${s}|${q}`;
    const uniquePairs = new Map();
    for (const b of bets) {
      uniquePairs.set(pairKey(b.slotStartIso, b.quizId), { slotStartIso: b.slotStartIso, quizId: b.quizId });
    }
    const picks = await QuizSlotPick.find({ gameMode, $or: [...uniquePairs.values()] })
      .select('slotStartIso quizId hintPosition')
      .lean();
    const pickMap = new Map();
    for (const p of picks) {
      pickMap.set(pairKey(p.slotStartIso, p.quizId), p.hintPosition);
    }

    const now = Date.now();
    const slotIsoSet = new Set((bets || []).map((b) => String(b?.slotStartIso || '')).filter(Boolean));
    const declaredResultsBySlot = await ensureDeclaredResultsSnapshots([...slotIsoSet], gameMode);
    const declaredSlotSet = new Set([...declaredResultsBySlot.keys()]);
    const maxPos = gameMode === '3d' ? 999 : 99;
    const padLength = gameMode === '3d' ? 3 : 2;
    const data = bets.map((b) => {
      const slotStartMs = new Date(b.slotStartIso).getTime();
      const slotEndMs = slotStartMs + SLOT_MS;
      const slotEnded = now >= slotEndMs;
      const slotDeclared = declaredSlotSet.has(String(b.slotStartIso || ''));
      const snapshotHp = declaredResultsBySlot.get(String(b.slotStartIso || ''))?.get(Number(b.quizId));
      const hp = snapshotHp != null ? snapshotHp : pickMap.get(pairKey(b.slotStartIso, b.quizId));
      const winningNumber =
        slotEnded && slotDeclared && hp != null && Number.isInteger(hp) && hp >= 0 && hp <= maxPos
          ? String(hp).padStart(padLength, '0')
          : null;
      return {
        id: String(b._id),
        ticketId: b.ticketId || null,
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

    return res.json({ success: true, data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('getMyQuizTicketLines', err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
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

/**
 * DELETE /api/v1/quiz/my-quiz-tickets/:ticketId?mode=
 * Cancels own full pending ticket before slot closes (refund = sum of pending ticket rows).
 */
export const cancelMyQuizTicket = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    const ticketId = String(req.params?.ticketId || '').trim();
    if (!ticketId) {
      return res.status(400).json({ success: false, message: 'Invalid ticket id.' });
    }

    const gameMode = resolveGameMode(req);
    const uid = new mongoose.Types.ObjectId(userId);
    await ensureQuizBetIndexes();

    const pendingRows = await QuizBet.find({
      userId: uid,
      gameMode,
      ticketId,
      status: 'pending',
    }).lean();

    if (!pendingRows.length) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found or already settled.',
      });
    }

    let refund = 0;
    for (const row of pendingRows) {
      const slotStartMs = new Date(row.slotStartIso).getTime();
      if (!Number.isFinite(slotStartMs)) {
        return res.status(400).json({ success: false, message: 'Invalid slot on ticket.' });
      }
      const slotEndMs = slotStartMs + SLOT_MS;
      if (Date.now() >= slotEndMs) {
        return res.status(403).json({
          success: false,
          code: 'SLOT_CLOSED',
          message: 'This draw has closed — pending tickets cannot be cancelled.',
        });
      }
      refund += Math.floor(Number(row.amount || 0));
    }

    if (!Number.isFinite(refund) || refund <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid ticket stake amount.' });
    }

    const updateRes = await QuizBet.updateMany(
      { userId: uid, gameMode, ticketId, status: 'pending' },
      { $set: { status: 'cancelled', winPayout: 0 } },
    );
    const modified = Number(updateRes?.modifiedCount || 0);
    if (modified === 0) {
      return res.status(409).json({
        success: false,
        message: 'Could not cancel — ticket may have been settled.',
      });
    }

    const walletUpdate = await Wallet.findOneAndUpdate({ userId: uid }, { $inc: { balance: refund } }, { new: true }).lean();

    return res.json({
      success: true,
      data: {
        ticketId,
        refunded: refund,
        rowsCancelled: modified,
        balance: walletUpdate?.balance ?? null,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('cancelMyQuizTicket', err);
    return res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
};
