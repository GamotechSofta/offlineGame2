/**
 * Ensures QuizSlotPick exists for all 30 quizzes for the current and previous IST slots,
 * without waiting for user-driven hint API calls.
 */
import QuizSlotPick from '../models/quiz/QuizSlotPick.js';
import { getQuizSocketIo } from '../socket/socketHub.js';
import { getSlotContext, SLOT_MS } from './slotService.js';
import { getOrCreatePick } from './quizPickService.js';
import { settleQuizBetsForSlot } from './quizBetSettlement.js';
import {
  getDeclaredTargetPercentForHintApply,
  getSlotDeclarationRow,
  isAutoDeclareBlocked,
  markSlotDeclared,
} from './quizDeclarationService.js';
import { apply2DTargetProfitHintsToSlot, apply3DTargetProfitHintsToSlot } from './quizTargetProfitService.js';
import { bustQuizPublicLastSlotResultsCaches } from './cacheInvalidationService.js';
const TICK_MS = 60_000;
const INITIAL_DELAY_MS = 3_000;
const SLOT_END_TRIGGER_DELAY_MS = 150;

/** @type {ReturnType<typeof setInterval> | null} */
let intervalId = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let slotBoundaryTimeoutId = null;

/** Avoid re-emitting the same completed slot every minute. */
const emittedQuizResultSlots = new Set();
async function ensureAllPicksForSlot(slotStartIso, gameMode = '2d') {
  const settled = await Promise.allSettled(
    Array.from({ length: 30 }, (_, i) => getOrCreatePick(i + 1, slotStartIso, gameMode)),
  );
  let ok = 0;
  for (const r of settled) {
    if (r.status === 'fulfilled') ok += 1;
  }
  const failed = settled.length - ok;
  if (failed > 0) {
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        tag: '[slot:generate:error]',
        gameMode,
        slotStartIso,
        failed,
        succeeded: ok,
      }),
    );
  }
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      tag: '[slot:generate]',
      gameMode,
      slotStartIso,
      totalGenerated: ok,
    }),
  );
}

/**
 * After slot end: broadcast completion marker for all quizzes.
 */
async function emitCompletedSlotResults(slotStartIso, gameMode = '2d') {
  const slotEndMs = new Date(slotStartIso).getTime() + SLOT_MS;
  if (Date.now() < slotEndMs) return;
  if (await isAutoDeclareBlocked(slotStartIso, gameMode)) return;

  if (gameMode === '2d' || gameMode === '3d') {
    const declarationRow = await getSlotDeclarationRow(slotStartIso, gameMode);
    if (declarationRow?.declaredAt) return;
    const targetProfitPercent = getDeclaredTargetPercentForHintApply(declarationRow);
    if (targetProfitPercent != null) {
      if (gameMode === '2d') {
        await apply2DTargetProfitHintsToSlot(slotStartIso, targetProfitPercent);
      } else {
        await apply3DTargetProfitHintsToSlot(slotStartIso, targetProfitPercent);
      }
    }
  }

  const io = getQuizSocketIo();
  if (!io) return;
  const emitKey = `${gameMode}|${slotStartIso}`;
  if (emittedQuizResultSlots.has(emitKey)) return;

  const picks = await QuizSlotPick.find({ gameMode, slotStartIso }, { quizId: 1, hintPosition: 1, _id: 0 }).lean();
  const byQuiz = new Map(picks.map((p) => [p.quizId, p.hintPosition]));
  const maxQuizId = gameMode === '3d' ? 3 : 30;
  const results = [];
  for (let quizId = 1; quizId <= maxQuizId; quizId += 1) {
    const hp = byQuiz.get(quizId);
    const ready = hp != null && Number.isInteger(hp);
    results.push({ quizId, ready });
  }

  // Re-check right before emit/declare to avoid race:
  // admin may click "Hold" while this tick is still in progress.
  if (await isAutoDeclareBlocked(slotStartIso, gameMode)) return;

  emittedQuizResultSlots.add(emitKey);
  while (emittedQuizResultSlots.size > 500) {
    const first = emittedQuizResultSlots.values().next().value;
    if (first === undefined) break;
    emittedQuizResultSlots.delete(first);
  }

  const declared = await markSlotDeclared(slotStartIso, gameMode, null, { force: false, captureResults: true });
  if (!declared) {
    // Slot was held while scheduler was processing; skip auto declaration.
    return;
  }

  io.emit('quiz:result', { gameMode, slotStartIso, results });
  bustQuizPublicLastSlotResultsCaches().catch(() => {});
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ tag: '[socket:emit]', event: 'quiz:result', gameMode, slotStartIso }));

  settleQuizBetsForSlot(slotStartIso, gameMode).catch((err) => {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ tag: '[quiz:bet:settle:error]', slotStartIso, message: err?.message }));
  });
}
async function tick() {
  const ctx = getSlotContext(new Date());
  const slots = [ctx.slotStartIso, ctx.previousSlotStartIso].filter(Boolean);
  const seen = new Set();
  for (const slotStartIso of slots) {
    if (seen.has(slotStartIso)) continue;
    seen.add(slotStartIso);
    // eslint-disable-next-line no-await-in-loop
    await ensureAllPicksForSlot(slotStartIso, '2d');
    await ensureAllPicksForSlot(slotStartIso, '3d');
    // eslint-disable-next-line no-await-in-loop
    await emitCompletedSlotResults(slotStartIso, '2d');
    await emitCompletedSlotResults(slotStartIso, '3d');
  }
}

function getMsUntilNextSlotBoundary(nowMs = Date.now()) {
  const remainder = nowMs % SLOT_MS;
  const msUntilBoundary = remainder === 0 ? SLOT_MS : SLOT_MS - remainder;
  return msUntilBoundary + SLOT_END_TRIGGER_DELAY_MS;
}

async function processJustEndedSlot() {
  const now = new Date();
  const ctx = getSlotContext(now);
  const justEndedSlotStartIso = ctx.previousSlotStartIso;
  if (!justEndedSlotStartIso) return;

  await ensureAllPicksForSlot(justEndedSlotStartIso, '2d');
  await ensureAllPicksForSlot(justEndedSlotStartIso, '3d');
  await emitCompletedSlotResults(justEndedSlotStartIso, '2d');
  await emitCompletedSlotResults(justEndedSlotStartIso, '3d');
}

function scheduleNextSlotBoundaryRun() {
  if (slotBoundaryTimeoutId) {
    clearTimeout(slotBoundaryTimeoutId);
    slotBoundaryTimeoutId = null;
  }

  const delayMs = getMsUntilNextSlotBoundary(Date.now());
  slotBoundaryTimeoutId = setTimeout(() => {
    processJustEndedSlot()
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error(JSON.stringify({ tag: '[slot:boundary:fatal]', message: err?.message || String(err) }));
      })
      .finally(() => {
        scheduleNextSlotBoundaryRun();
      });
  }, delayMs);
}
/**
 * Run every minute + once shortly after startup (covers restart mid-slot).
 * Set QUIZ_SLOT_SCHEDULER=0 to disable.
 */
export function startQuizSlotPickScheduler() {
  if (process.env.QUIZ_SLOT_SCHEDULER === '0') {
    // eslint-disable-next-line no-console
    console.log('[slot:generate] scheduler disabled (QUIZ_SLOT_SCHEDULER=0)');
    return;
  }

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  const run = () => {
    tick().catch((err) => {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify({ tag: '[slot:generate:fatal]', message: err?.message || String(err) }));
    });
  };

  intervalId = setInterval(run, TICK_MS);
  setTimeout(run, INITIAL_DELAY_MS);
  scheduleNextSlotBoundaryRun();
}

export function stopQuizSlotPickScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (slotBoundaryTimeoutId) {
    clearTimeout(slotBoundaryTimeoutId);
    slotBoundaryTimeoutId = null;
  }
}
