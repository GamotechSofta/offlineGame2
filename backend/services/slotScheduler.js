/**
 * Ensures QuizSlotPick exists for all 30 quizzes for the current and previous IST slots,
 * without waiting for user-driven hint API calls.
 */
import QuizSlotPick from '../models/quiz/QuizSlotPick.js';
import { getQuizSocketIo } from '../socket/socketHub.js';
import { getSlotContext, SLOT_MS } from './slotService.js';
import { getOrCreatePick } from './quizPickService.js';
import { settleQuizBetsForSlot } from './quizBetSettlement.js';
const TICK_MS = 60_000;
const INITIAL_DELAY_MS = 3_000;

/** @type {ReturnType<typeof setInterval> | null} */
let intervalId = null;

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
 * After slot end: broadcast persisted hintPosition for all quizzes (no chosenIndex).
 */
async function emitCompletedSlotResults(slotStartIso, gameMode = '2d') {
  const slotEndMs = new Date(slotStartIso).getTime() + SLOT_MS;
  if (Date.now() < slotEndMs) return;

  const io = getQuizSocketIo();
  if (!io) return;
  const emitKey = `${gameMode}|${slotStartIso}`;
  if (emittedQuizResultSlots.has(emitKey)) return;

  const picks = await QuizSlotPick.find({ gameMode, slotStartIso }, { quizId: 1, hintPosition: 1, _id: 0 }).lean();
  const byQuiz = new Map(picks.map((p) => [p.quizId, p.hintPosition]));
  const maxPos = gameMode === '3d' ? 999 : 99;
  const maxQuizId = gameMode === '3d' ? 3 : 30;
  const results = [];
  for (let quizId = 1; quizId <= maxQuizId; quizId += 1) {
    const hp = byQuiz.get(quizId);
    const ok = hp != null && Number.isInteger(hp) && hp >= 0 && hp <= maxPos;
    results.push({ quizId, result: ok ? hp : null });
  }

  emittedQuizResultSlots.add(emitKey);
  while (emittedQuizResultSlots.size > 500) {
    const first = emittedQuizResultSlots.values().next().value;
    if (first === undefined) break;
    emittedQuizResultSlots.delete(first);
  }

  io.emit('quiz:result', { gameMode, slotStartIso, results });
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
}

export function stopQuizSlotPickScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
