import mongoose from 'mongoose';
import QuizTimingSetting from '../models/quiz/QuizTimingSetting.js';

const MODES = ['2d', '3d'];
const CACHE_TTL_MS = 30_000;

const DEFAULTS = Object.freeze({
  '2d': { studyMinutes: 14.5, questionRevealStaggerMs: 8700 },
  '3d': { studyMinutes: 14.5, questionRevealStaggerMs: 810 },
});

let cache = {
  at: 0,
  byMode: {
    '2d': { ...DEFAULTS['2d'] },
    '3d': { ...DEFAULTS['3d'] },
  },
};
let refreshPromise = null;

function normalizeMode(mode) {
  return String(mode || '2d').toLowerCase() === '3d' ? '3d' : '2d';
}

function normalizeStudyMinutes(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(15, Math.max(1, n));
}

function normalizeStaggerMs(value, fallback) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(120000, Math.max(100, n));
}

export async function refreshQuizTimingSettingsCache(force = false) {
  if (!force && Date.now() - cache.at < CACHE_TTL_MS) return cache.byMode;
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const docs = await QuizTimingSetting.find({ gameMode: { $in: MODES } }).lean();
    const nextByMode = {
      '2d': { ...DEFAULTS['2d'] },
      '3d': { ...DEFAULTS['3d'] },
    };
    for (const doc of docs) {
      const mode = normalizeMode(doc?.gameMode);
      nextByMode[mode] = {
        studyMinutes: normalizeStudyMinutes(doc?.studyMinutes, DEFAULTS[mode].studyMinutes),
        questionRevealStaggerMs: normalizeStaggerMs(doc?.questionRevealStaggerMs, DEFAULTS[mode].questionRevealStaggerMs),
      };
    }
    cache = { at: Date.now(), byMode: nextByMode };
    return nextByMode;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export function getQuizTimingSettingsSnapshot(mode = '2d') {
  const m = normalizeMode(mode);
  if (!refreshPromise && Date.now() - cache.at >= CACHE_TTL_MS) {
    refreshQuizTimingSettingsCache(false).catch(() => {
      // Keep serving latest in-memory/default values on read path.
    });
  }
  return { ...cache.byMode[m] };
}

export async function getQuizTimingSettings(mode = '2d') {
  await refreshQuizTimingSettingsCache(false);
  return getQuizTimingSettingsSnapshot(mode);
}

export async function getAllQuizTimingSettings() {
  await refreshQuizTimingSettingsCache(false);
  return {
    '2d': getQuizTimingSettingsSnapshot('2d'),
    '3d': getQuizTimingSettingsSnapshot('3d'),
  };
}

export async function updateQuizTimingSettings(mode, payload, adminId = null) {
  const m = normalizeMode(mode);
  const prev = await getQuizTimingSettings(m);
  const next = {
    studyMinutes: normalizeStudyMinutes(payload?.studyMinutes, prev.studyMinutes),
    questionRevealStaggerMs: normalizeStaggerMs(payload?.questionRevealStaggerMs, prev.questionRevealStaggerMs),
  };

  const update = {
    studyMinutes: next.studyMinutes,
    questionRevealStaggerMs: next.questionRevealStaggerMs,
    updatedBy: mongoose.Types.ObjectId.isValid(adminId) ? new mongoose.Types.ObjectId(adminId) : null,
  };

  await QuizTimingSetting.findOneAndUpdate(
    { gameMode: m },
    { $set: update, $setOnInsert: { gameMode: m } },
    { upsert: true, new: true },
  );

  cache.byMode[m] = { ...next };
  cache.at = Date.now();
  return { ...next };
}

