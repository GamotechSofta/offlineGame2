import QuizBet from '../models/quiz/QuizBet.js';
import QuizSlotPick from '../models/quiz/QuizSlotPick.js';
import { getRatesMap } from '../models/rate/rate.js';
import { evaluate3DBetAgainstResult, resolve3DPayoutMultiplier } from './quiz3dPayoutHelpers.js';

const QUIZ_IDS_2D = Array.from({ length: 30 }, (_, i) => i + 1);
const QUIZ_IDS_3D = [1, 2, 3];
const EPSILON = 1e-9;
const pickRandomFrom = (arr) => {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx] ?? null;
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

  const perQuiz = QUIZ_IDS_2D.map((quizId) => {
    const row = quizTotals.get(quizId) || { totalStake: 0, stakeByNumber: new Map() };
    const totalStake = Number(row.totalStake || 0);
    if (totalStake <= 0) {
      const randomNumber = Math.floor(Math.random() * 100);
      return {
        quizId,
        currentResult: Number.isInteger(pickByQuiz.get(quizId)) ? pickByQuiz.get(quizId) : null,
        suggestedResult: randomNumber,
        suggestedResultLabel: String(randomNumber).padStart(2, '0'),
        totalStake: 0,
        targetProfitPercent: target,
        targetHouseNet: 0,
        houseNetIfSuggestedWins: 0,
        deltaFromTarget: 0,
        meetsOrExceedsTarget: true,
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

    const selected = pickRandomFrom(bestAtOrAbovePool)
      || pickRandomFrom(bestNearestPool)
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
  const payload = await build2DTargetProfitHints(slotStartIso, targetProfitPercent);
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

  const perQuiz = QUIZ_IDS_3D.map((quizId) => {
    const setBets = quizRows.get(quizId) || [];
    const totalStake = setBets.reduce((sum, b) => sum + Number(b.amount || 0), 0);
    if (totalStake <= 0) {
      const randomNumber = Math.floor(Math.random() * 1000);
      return {
        quizId,
        currentResult: Number.isInteger(pickByQuiz.get(quizId)) ? pickByQuiz.get(quizId) : null,
        suggestedResult: randomNumber,
        suggestedResultLabel: String(randomNumber).padStart(3, '0'),
        totalStake: 0,
        targetProfitPercent: target,
        targetHouseNet: 0,
        houseNetIfSuggestedWins: 0,
        deltaFromTarget: 0,
        meetsOrExceedsTarget: true,
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

    const selected = pickRandomFrom(bestAtOrAbovePool)
      || pickRandomFrom(bestNearestPool)
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
  const payload = await build3DTargetProfitHints(slotStartIso, targetProfitPercent);
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
