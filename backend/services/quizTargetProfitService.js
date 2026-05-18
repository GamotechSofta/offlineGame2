import QuizBet from '../models/quiz/QuizBet.js';
import QuizSlotPick from '../models/quiz/QuizSlotPick.js';
import { getRatesMap } from '../models/rate/rate.js';
import { evaluate3DBetAgainstResult, resolve3DPayoutMultiplier } from './quiz3dPayoutHelpers.js';
import { getRandomModeHintPosition } from './quizPickService.js';

const QUIZ_IDS_2D = Array.from({ length: 30 }, (_, i) => i + 1);
const QUIZ_IDS_3D = [1, 2, 3];
const EPSILON = 1e-9;
const isValid2DResult = (n) => Number.isInteger(n) && n >= 0 && n <= 99;
const isValid3DResult = (n) => Number.isInteger(n) && n >= 0 && n <= 999;

async function resolveRandomModeResult(quizId, slotStartIso, gameMode, isValid) {
  const hp = await getRandomModeHintPosition(quizId, slotStartIso, gameMode);
  return isValid(hp) ? hp : null;
}
const pickLowestNumberFrom = (arr) => {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  let best = null;
  for (const item of arr) {
    const n = Number(item?.number);
    if (!Number.isFinite(n)) continue;
    if (!best || n < Number(best.number)) best = item;
  }
  return best;
};
const hashStringToPositiveInt = (input) => {
  const str = String(input || '');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};
const findCandidateInPool = (pool, number) => {
  if (!Array.isArray(pool) || pool.length === 0) return null;
  const n = Number(number);
  if (!Number.isFinite(n)) return null;
  return pool.find((item) => Number(item?.number) === n) || null;
};
const pickSeededRandomFrom = (arr, seed) => {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const valid = arr.filter((item) => Number.isFinite(Number(item?.number)));
  if (valid.length === 0) return null;
  const idx = hashStringToPositiveInt(seed) % valid.length;
  return valid[idx];
};
/** Reuse persisted pick when still in tie pool; else stable pseudo-random (not Math.random). */
const pickFromTiePool = (pool, { stableTieBreak, seed, existingNumber, respectStickyPick = true }) => {
  if (!Array.isArray(pool) || pool.length === 0) return null;
  if (respectStickyPick) {
    const sticky = findCandidateInPool(pool, existingNumber);
    if (sticky) return sticky;
  }
  if (stableTieBreak) return pickLowestNumberFrom(pool);
  return pickSeededRandomFrom(pool, seed);
};
async function getQuiz2DMultiplier() {
  try {
    const rates = await getRatesMap();
    const rate = Number(rates?.quiz2d);
    if (Number.isFinite(rate) && rate > 0) return rate;
  } catch {
    // fall back
  }
  const fallback = parseInt(process.env.QUIZ_BET_WIN_MULTIPLIER || '90', 10);
  return Number.isFinite(fallback) && fallback > 0 ? fallback : 90;
}

export async function build2DTargetProfitHints(slotStartIso, targetProfitPercent) {
  return build2DTargetProfitHintsWithOptions(slotStartIso, targetProfitPercent, {});
}

export async function build2DTargetProfitHintsWithOptions(slotStartIso, targetProfitPercent, options = {}) {
  const stableTieBreak = options?.stableTieBreak === true;
  const respectStickyPick = options?.respectStickyPick !== false;
  const target = Number.isFinite(Number(targetProfitPercent))
    ? Math.min(1000, Math.max(-100, Number(targetProfitPercent)))
    : 20;
  const [bets, picks, winMultiplier] = await Promise.all([
    QuizBet.find({ gameMode: '2d', slotStartIso })
      .select('quizId number amount status')
      .lean(),
    QuizSlotPick.find({ gameMode: '2d', slotStartIso }).select('quizId hintPosition').lean(),
    getQuiz2DMultiplier(),
  ]);

  const pickByQuiz = new Map();
  for (const p of picks) {
    if (Number.isInteger(p?.quizId) && Number.isInteger(p?.hintPosition)) {
      pickByQuiz.set(p.quizId, p.hintPosition);
    }
  }

  const quizTotals = new Map();
  for (const quizId of QUIZ_IDS_2D) {
    quizTotals.set(quizId, { totalStake: 0, stakeByNumber: new Map() });
  }

  for (const bet of bets) {
    if (String(bet?.status || '').toLowerCase() === 'cancelled') continue;
    const quizId = Number(bet?.quizId);
    const number = Number(bet?.number);
    if (!Number.isInteger(quizId) || quizId < 1 || quizId > 30) continue;
    if (!Number.isInteger(number) || number < 0 || number > 99) continue;
    const amount = Number(bet?.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const row = quizTotals.get(quizId);
    row.totalStake += amount;
    row.stakeByNumber.set(number, (row.stakeByNumber.get(number) || 0) + amount);
  }

  const noBetQuizIds2d = QUIZ_IDS_2D.filter((quizId) => (quizTotals.get(quizId)?.totalStake || 0) <= 0);
  const randomResultByQuiz2d = new Map();
  await Promise.all(noBetQuizIds2d.map(async (quizId) => {
    const randomResult = await resolveRandomModeResult(quizId, slotStartIso, '2d', isValid2DResult);
    if (randomResult != null) randomResultByQuiz2d.set(quizId, randomResult);
  }));

  const perQuiz = QUIZ_IDS_2D.map((quizId) => {
    const row = quizTotals.get(quizId) || { totalStake: 0, stakeByNumber: new Map() };
    const totalStake = Number(row.totalStake || 0);
    if (totalStake <= 0) {
      const randomResult = randomResultByQuiz2d.get(quizId) ?? null;
      const suggestedResult = isValid2DResult(randomResult) ? randomResult : 0;
      return {
        quizId,
        currentResult: Number.isInteger(pickByQuiz.get(quizId)) ? pickByQuiz.get(quizId) : null,
        suggestedResult,
        suggestedResultLabel: String(suggestedResult).padStart(2, '0'),
        totalStake: 0,
        targetProfitPercent: target,
        targetHouseNet: 0,
        houseNetIfSuggestedWins: 0,
        deltaFromTarget: 0,
        meetsOrExceedsTarget: true,
        usesRandomResult: true,
        topCandidates: [],
      };
    }
    const targetHouseNet = (totalStake * target) / 100;
    let bestAtOrAboveTarget = null;
    let bestNearest = null;
    let bestAtOrAbovePool = [];
    let bestNearestPool = [];
    const candidates = [];
    for (let number = 0; number <= 99; number += 1) {
      const stake = Number(row.stakeByNumber.get(number) || 0);
      const payoutIfWins = Math.round(stake * winMultiplier);
      const houseNetIfWins = totalStake - payoutIfWins;
      const deltaFromTarget = houseNetIfWins - targetHouseNet;
      const absDelta = Math.abs(deltaFromTarget);
      const stakePercent = totalStake > 0 ? (stake / totalStake) * 100 : 0;
      const profitPercent = totalStake > 0 ? (houseNetIfWins / totalStake) * 100 : 0;
      const candidate = { number, stake, stakePercent, houseNetIfWins, profitPercent, deltaFromTarget, absDelta };
      if (deltaFromTarget >= 0) {
        if (
          !bestAtOrAboveTarget
          || candidate.deltaFromTarget < bestAtOrAboveTarget.deltaFromTarget - EPSILON
        ) {
          bestAtOrAboveTarget = candidate;
          bestAtOrAbovePool = [candidate];
        } else if (Math.abs(candidate.deltaFromTarget - bestAtOrAboveTarget.deltaFromTarget) <= EPSILON) {
          bestAtOrAbovePool.push(candidate);
        }
      }
      if (
        !bestNearest
        || candidate.absDelta < bestNearest.absDelta - EPSILON
      ) {
        bestNearest = candidate;
        bestNearestPool = [candidate];
      } else if (Math.abs(candidate.absDelta - bestNearest.absDelta) <= EPSILON) {
        bestNearestPool.push(candidate);
      }
      if (stake > 0) candidates.push(candidate);
    }

    const existingNumber = pickByQuiz.get(quizId);
    const tieSeed = `${slotStartIso}|2d|${quizId}|${target}`;
    const tiePickOpts = { stableTieBreak, existingNumber, respectStickyPick };
    const selectedFromAbove = pickFromTiePool(bestAtOrAbovePool, { ...tiePickOpts, seed: tieSeed });
    const selectedFromNearest = pickFromTiePool(bestNearestPool, { ...tiePickOpts, seed: `${tieSeed}|nearest` });
    const selected = selectedFromAbove
      || selectedFromNearest
      || bestAtOrAboveTarget
      || bestNearest
      || { number: 0, houseNetIfWins: 0, deltaFromTarget: 0 };
    const topCandidates = candidates
      .slice()
      .sort((a, b) => a.absDelta - b.absDelta || b.stake - a.stake || a.number - b.number)
      .slice(0, 3)
      .map((c) => ({
        number: c.number,
        numberLabel: String(c.number).padStart(2, '0'),
        stake: c.stake,
        stakePercent: Math.round(c.stakePercent * 10) / 10,
        profitPercent: Math.round(c.profitPercent * 10) / 10,
        meetsOrExceedsTarget: c.deltaFromTarget >= 0,
      }));
    return {
      quizId,
      currentResult: Number.isInteger(pickByQuiz.get(quizId)) ? pickByQuiz.get(quizId) : null,
      suggestedResult: selected.number,
      suggestedResultLabel: String(selected.number).padStart(2, '0'),
      totalStake,
      targetProfitPercent: target,
      targetHouseNet,
      houseNetIfSuggestedWins: selected.houseNetIfWins,
      deltaFromTarget: selected.deltaFromTarget,
      meetsOrExceedsTarget: selected.deltaFromTarget >= 0,
      topCandidates,
    };
  });

  return { perQuiz, winMultiplier, targetProfitPercent: target };
}

export async function apply2DTargetProfitHintsToSlot(slotStartIso, targetProfitPercent) {
  const payload = await build2DTargetProfitHintsWithOptions(slotStartIso, targetProfitPercent, {
    respectStickyPick: false,
  });
  const updates = payload.perQuiz.map((row) => (
    QuizSlotPick.updateOne(
      { gameMode: '2d', slotStartIso, quizId: row.quizId },
      { $set: { hintPosition: row.suggestedResult } },
      { upsert: false },
    )
  ));
  await Promise.all(updates);
  return payload;
}

function payoutUnsettledWin3d(bet, hintPosition, ratesMap) {
  const ev = evaluate3DBetAgainstResult(bet.betMode || 'str', bet.number, hintPosition);
  if (!ev.matched) return 0;
  const mult = resolve3DPayoutMultiplier(ratesMap, bet.betMode || 'str', bet.number, ev);
  return Math.round(Number(bet.amount || 0) * mult);
}

export async function build3DTargetProfitHints(slotStartIso, targetProfitPercent) {
  return build3DTargetProfitHintsWithOptions(slotStartIso, targetProfitPercent, {});
}

export async function build3DTargetProfitHintsWithOptions(slotStartIso, targetProfitPercent, options = {}) {
  const stableTieBreak = options?.stableTieBreak === true;
  const respectStickyPick = options?.respectStickyPick !== false;
  const target = Number.isFinite(Number(targetProfitPercent))
    ? Math.min(1000, Math.max(-100, Number(targetProfitPercent)))
    : 20;
  const [bets, picks, ratesMap] = await Promise.all([
    QuizBet.find({ gameMode: '3d', slotStartIso })
      .select('quizId number amount status betMode')
      .lean(),
    QuizSlotPick.find({ gameMode: '3d', slotStartIso }).select('quizId hintPosition').lean(),
    getRatesMap(),
  ]);

  const pickByQuiz = new Map();
  for (const p of picks) {
    if (Number.isInteger(p?.quizId) && Number.isInteger(p?.hintPosition)) {
      pickByQuiz.set(p.quizId, p.hintPosition);
    }
  }

  const quizRows = new Map();
  for (const quizId of QUIZ_IDS_3D) {
    quizRows.set(quizId, []);
  }
  for (const bet of bets) {
    if (String(bet?.status || '').toLowerCase() === 'cancelled') continue;
    const quizId = Number(bet?.quizId);
    if (!QUIZ_IDS_3D.includes(quizId)) continue;
    const amount = Number(bet?.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    quizRows.get(quizId).push(bet);
  }

  const noBetQuizIds3d = QUIZ_IDS_3D.filter(
    (quizId) => (quizRows.get(quizId) || []).reduce((sum, b) => sum + Number(b.amount || 0), 0) <= 0,
  );
  const randomResultByQuiz3d = new Map();
  await Promise.all(noBetQuizIds3d.map(async (quizId) => {
    const randomResult = await resolveRandomModeResult(quizId, slotStartIso, '3d', isValid3DResult);
    if (randomResult != null) randomResultByQuiz3d.set(quizId, randomResult);
  }));

  const perQuiz = QUIZ_IDS_3D.map((quizId) => {
    const setBets = quizRows.get(quizId) || [];
    const totalStake = setBets.reduce((sum, b) => sum + Number(b.amount || 0), 0);
    if (totalStake <= 0) {
      const randomResult = randomResultByQuiz3d.get(quizId) ?? null;
      const suggestedResult = isValid3DResult(randomResult) ? randomResult : 0;
      return {
        quizId,
        currentResult: Number.isInteger(pickByQuiz.get(quizId)) ? pickByQuiz.get(quizId) : null,
        suggestedResult,
        suggestedResultLabel: String(suggestedResult).padStart(3, '0'),
        totalStake: 0,
        targetProfitPercent: target,
        targetHouseNet: 0,
        houseNetIfSuggestedWins: 0,
        deltaFromTarget: 0,
        meetsOrExceedsTarget: true,
        usesRandomResult: true,
      };
    }
    const targetHouseNet = (totalStake * target) / 100;
    let bestAtOrAboveTarget = null;
    let bestNearest = null;
    let bestAtOrAbovePool = [];
    let bestNearestPool = [];

    for (let number = 0; number <= 999; number += 1) {
      let payoutIfWins = 0;
      for (const bet of setBets) {
        if (evaluate3DBetAgainstResult(bet.betMode || 'str', bet.number, number).matched) {
          payoutIfWins += payoutUnsettledWin3d(bet, number, ratesMap);
        }
      }
      const houseNetIfWins = totalStake - payoutIfWins;
      const deltaFromTarget = houseNetIfWins - targetHouseNet;
      const absDelta = Math.abs(deltaFromTarget);
      const candidate = { number, houseNetIfWins, deltaFromTarget, absDelta };
      if (deltaFromTarget >= 0) {
        if (!bestAtOrAboveTarget || deltaFromTarget < bestAtOrAboveTarget.deltaFromTarget - EPSILON) {
          bestAtOrAboveTarget = candidate;
          bestAtOrAbovePool = [candidate];
        } else if (Math.abs(deltaFromTarget - bestAtOrAboveTarget.deltaFromTarget) <= EPSILON) {
          bestAtOrAbovePool.push(candidate);
        }
      }
      if (!bestNearest || absDelta < bestNearest.absDelta - EPSILON) {
        bestNearest = candidate;
        bestNearestPool = [candidate];
      } else if (Math.abs(absDelta - bestNearest.absDelta) <= EPSILON) {
        bestNearestPool.push(candidate);
      }
    }

    const existingNumber = pickByQuiz.get(quizId);
    const tieSeed = `${slotStartIso}|3d|${quizId}|${target}`;
    const tiePickOpts = { stableTieBreak, existingNumber, respectStickyPick };
    const selectedFromAbove = pickFromTiePool(bestAtOrAbovePool, { ...tiePickOpts, seed: tieSeed });
    const selectedFromNearest = pickFromTiePool(bestNearestPool, { ...tiePickOpts, seed: `${tieSeed}|nearest` });
    const selected = selectedFromAbove
      || selectedFromNearest
      || bestAtOrAboveTarget
      || bestNearest
      || { number: 0, houseNetIfWins: 0, deltaFromTarget: 0 };
    return {
      quizId,
      currentResult: Number.isInteger(pickByQuiz.get(quizId)) ? pickByQuiz.get(quizId) : null,
      suggestedResult: selected.number,
      suggestedResultLabel: String(selected.number).padStart(3, '0'),
      totalStake,
      targetProfitPercent: target,
      targetHouseNet,
      houseNetIfSuggestedWins: selected.houseNetIfWins,
      deltaFromTarget: selected.deltaFromTarget,
      meetsOrExceedsTarget: selected.deltaFromTarget >= 0,
    };
  });

  return { perQuiz, targetProfitPercent: target };
}

export async function apply3DTargetProfitHintsToSlot(slotStartIso, targetProfitPercent) {
  const payload = await build3DTargetProfitHintsWithOptions(slotStartIso, targetProfitPercent, {
    respectStickyPick: false,
  });
  const updates = payload.perQuiz.map((row) => (
    QuizSlotPick.updateOne(
      { gameMode: '3d', slotStartIso, quizId: row.quizId },
      { $set: { hintPosition: row.suggestedResult } },
      { upsert: false },
    )
  ));
  await Promise.all(updates);
  return payload;
}

/** @internal Automated checks for tie-break and no-bet random behaviour. */
export const verifyTargetProfitSelectionLogic = () => {
  const pool = [
    { number: 7 },
    { number: 23 },
    { number: 45 },
  ];
  const seed = 'slot|2d|5|20';
  const lowest = pickLowestNumberFrom(pool);
  const seededA = pickSeededRandomFrom(pool, seed);
  const seededB = pickSeededRandomFrom(pool, seed);
  const stickyOldLowest = pickFromTiePool(pool, {
    stableTieBreak: false,
    seed,
    existingNumber: 7,
    respectStickyPick: true,
  });
  const freshSeeded = pickFromTiePool(pool, {
    stableTieBreak: false,
    seed,
    existingNumber: 7,
    respectStickyPick: false,
  });

  const checks = [
    {
      name: 'seeded-random-is-deterministic',
      ok: seededA?.number === seededB?.number,
      detail: `got ${seededA?.number} vs ${seededB?.number}`,
    },
    {
      name: 'seeded-random-not-always-lowest',
      ok: lowest?.number === 7 && (seededA?.number !== 7 || pool.length === 1),
      detail: `lowest=${lowest?.number}, seeded=${seededA?.number}`,
    },
    {
      name: 'preview-sticky-keeps-saved-result',
      ok: stickyOldLowest?.number === 7,
      detail: `sticky=${stickyOldLowest?.number}`,
    },
    {
      name: 'apply-uses-seeded-not-sticky-lowest',
      ok: freshSeeded?.number === seededA?.number,
      detail: `fresh=${freshSeeded?.number}, seeded=${seededA?.number}`,
    },
  ];

  return {
    ok: checks.every((c) => c.ok),
    checks,
  };
};
