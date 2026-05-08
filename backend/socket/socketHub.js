import { Server } from 'socket.io';
import { formatDrawLabel, getSlotContext, getStudySecondsForMode } from '../services/slotService.js';
import QuizSlotSeed from '../models/quiz/QuizSlotSeed.js';
import { getOrCreatePick } from '../services/quizPickService.js';
import { noteSocketEmit, noteSocketListener } from '../services/traceMetricsService.js';

/** @type {Server | null} */
let io = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let slotChangeTimerId = null;
const slotModes = ['2d', '3d'];
const ADMIN_ROOM = 'admin:live';
/** @type {Map<string, { slotStartIso: string, phase: string }>} */
const lastEmittedSlotState = new Map();
/** @type {Map<string, string>} */
const lastHintEmitSlotByMode = new Map();

function buildSlotSnapshot(gameMode = '2d') {
  const now = Date.now();
  const ctx = getSlotContext(new Date(now), gameMode);
  const studySeconds = getStudySecondsForMode(gameMode);
  const secondsUntilHint = Math.max(0, Math.floor(studySeconds - ctx.secIntoSlot));
  const secondsUntilSlotEnd = Math.max(0, Math.floor((ctx.slotEndMs - now) / 1000));
  const acceptsBets = now >= ctx.slotStartMs && now < ctx.slotEndMs;
  return {
    gameMode,
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
  };
}

function hasSlotStateChanged(prev, next) {
  return !prev || prev.slotStartIso !== next.slotStartIso || prev.phase !== next.phase;
}

async function buildHintSnapshot(quizId, gameMode = '2d') {
  const ctx = getSlotContext(new Date(), gameMode);
  if (ctx.phase !== 'hint') return null;
  const pick = await getOrCreatePick(quizId, ctx.slotStartIso, gameMode);
  const seedRow = await QuizSlotSeed.findOne({ gameMode, quizId, slotStartIso: ctx.slotStartIso }).lean();
  return {
    questionText: pick.hintQuestionText,
    slotStartIso: ctx.slotStartIso,
    seedHash: seedRow?.seedHash ?? null,
  };
}

function normalizeQuizSubscription(rawQuizId, gameMode) {
  const quizId = Number(rawQuizId);
  const maxQuizId = gameMode === '3d' ? 3 : 30;
  if (!Number.isInteger(quizId) || quizId < 1 || quizId > maxQuizId) return null;
  return quizId;
}

async function emitHintUpdateToSocket(socket) {
  const gameMode = String(socket.data?.hintGameMode || '2d').toLowerCase() === '3d' ? '3d' : '2d';
  const quizId = normalizeQuizSubscription(socket.data?.hintQuizId, gameMode);
  if (!quizId) return;
  const payload = await buildHintSnapshot(quizId, gameMode);
  if (!payload) return;
  socket.emit('hint:update', payload);
}

async function emitHintUpdatesForMode(gameMode) {
  if (!io) return;
  const ctx = getSlotContext(new Date(), gameMode);
  if (ctx.phase !== 'hint') return;
  const hintEmitKey = `${ctx.slotStartIso}|hint`;
  if (lastHintEmitSlotByMode.get(gameMode) === hintEmitKey) return;

  const tasks = [];
  for (const socket of io.sockets.sockets.values()) {
    const socketMode = String(socket.data?.hintGameMode || '2d').toLowerCase() === '3d' ? '3d' : '2d';
    const quizId = normalizeQuizSubscription(socket.data?.hintQuizId, socketMode);
    if (socketMode !== gameMode || !quizId) continue;
    tasks.push(
      emitHintUpdateToSocket(socket).catch((err) => {
        // eslint-disable-next-line no-console
        console.error(JSON.stringify({ tag: '[socket:hint:error]', gameMode, quizId, message: err?.message || String(err) }));
      }),
    );
  }
  if (tasks.length) {
    await Promise.all(tasks);
  }
  lastHintEmitSlotByMode.set(gameMode, hintEmitKey);
}

function emitSlotUpdates({ force = false, targetSocket = null } = {}) {
  if (!io && !targetSocket) return;
  for (const gameMode of slotModes) {
    const snapshot = buildSlotSnapshot(gameMode);
    const nextState = { slotStartIso: snapshot.slotStartIso, phase: snapshot.phase };
    const prevState = lastEmittedSlotState.get(gameMode);
    const shouldEmit = force || hasSlotStateChanged(prevState, nextState);
    if (!shouldEmit) continue;
    if (targetSocket) {
      noteSocketEmit('slot:update');
      targetSocket.emit('slot:update', snapshot);
    } else {
      noteSocketEmit('slot:update');
      io.emit('slot:update', snapshot);
    }
    lastEmittedSlotState.set(gameMode, nextState);
  }
}

function getNextSlotChangeDelayMs(gameMode = '2d') {
  const now = Date.now();
  const ctx = getSlotContext(new Date(now), gameMode);
  const studyMs = getStudySecondsForMode(gameMode) * 1000;
  const hintStartMs = ctx.slotStartMs + studyMs;
  const nextBoundaryMs = ctx.phase === 'study' ? Math.min(hintStartMs, ctx.slotEndMs) : ctx.slotEndMs;
  return Math.max(250, nextBoundaryMs - now + 75);
}

function scheduleNextSlotChangeCheck() {
  if (slotChangeTimerId) {
    clearTimeout(slotChangeTimerId);
    slotChangeTimerId = null;
  }
  const nextDelayMs = Math.min(...slotModes.map((mode) => getNextSlotChangeDelayMs(mode)));
  slotChangeTimerId = setTimeout(async () => {
    emitSlotUpdates();
    await Promise.all(slotModes.map((mode) => emitHintUpdatesForMode(mode)));
    scheduleNextSlotChangeCheck();
  }, nextDelayMs);
}

/**
 * Attach Socket.IO to the HTTP server (same port as Express API).
 * @param {import('http').Server} httpServer
 * @param {{ allowedOrigins: string[]; isProduction: boolean }} opts
 */
export function initQuizSocket(httpServer, opts) {
  const { allowedOrigins, isProduction } = opts;
  const allowAll = !allowedOrigins?.length || allowedOrigins.includes('*');
  const origin =
    !isProduction || allowAll
      ? true
      : allowedOrigins;

  io = new Server(httpServer, {
    path: '/socket.io',
    cors: {
      origin,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket'],
  });

  io.on('connection', (socket) => {
    socket.data.hintQuizId = null;
    socket.data.hintGameMode = '2d';
    emitSlotUpdates({ force: true, targetSocket: socket });

    socket.on('hint:subscribe', async (payload = {}) => {
      const gameMode = String(payload?.gameMode || '2d').toLowerCase() === '3d' ? '3d' : '2d';
      const quizId = normalizeQuizSubscription(payload?.quizId, gameMode);
      socket.data.hintGameMode = gameMode;
      socket.data.hintQuizId = quizId;
      if (!quizId) return;
      try {
        noteSocketListener('hint:subscribe', socket.listeners('hint:subscribe').length + 1);
        await emitHintUpdateToSocket(socket);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(JSON.stringify({ tag: '[socket:hint:subscribe:error]', gameMode, quizId, message: err?.message || String(err) }));
      }
    });

    socket.on('admin:subscribe', () => {
      noteSocketListener('admin:subscribe', socket.listeners('admin:subscribe').length);
      socket.join(ADMIN_ROOM);
      noteSocketEmit('admin:subscribed');
      socket.emit('admin:subscribed', { ok: true, ts: Date.now() });
    });
  });

  emitSlotUpdates({ force: true });
  scheduleNextSlotChangeCheck();

  // eslint-disable-next-line no-console
  console.log('[socket] quiz Socket.IO ready at /socket.io');
  return io;
}

/** @returns {Server | null} */
export function getQuizSocketIo() {
  return io;
}

/** Manual sync hook: keeps payload unchanged, forces immediate push. */
export function syncQuizSlotUpdates() {
  emitSlotUpdates({ force: true });
  scheduleNextSlotChangeCheck();
}

export function emitAdminDashboardUpdate(payload = {}) {
  if (!io) return;
  noteSocketEmit('admin:dashboard:update');
  io.to(ADMIN_ROOM).emit('admin:dashboard:update', {
    ts: Date.now(),
    ...payload,
  });
}

export function emitAdminMarketUpdate(payload = {}) {
  if (!io) return;
  noteSocketEmit('admin:market:update');
  io.to(ADMIN_ROOM).emit('admin:market:update', {
    ts: Date.now(),
    ...payload,
  });
}
