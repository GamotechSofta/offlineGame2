import QuizBet from '../models/quiz/QuizBet.js';
import QuizSlotPick from '../models/quiz/QuizSlotPick.js';
import { getRatesMap } from '../models/rate/rate.js';

const QUIZ_IDS_2D = Array.from({ length: 30 }, (_, i) => i + 1);

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
    const targetHouseNet = (totalStake * target) / 100;
    let bestAtOrAboveTarget = null;
    let bestNearest = null;
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
          || candidate.deltaFromTarget < bestAtOrAboveTarget.deltaFromTarget
          || (candidate.deltaFromTarget === bestAtOrAboveTarget.deltaFromTarget && candidate.number < bestAtOrAboveTarget.number)
        ) {
          bestAtOrAboveTarget = candidate;
        }
      }
      if (
        !bestNearest
        || candidate.absDelta < bestNearest.absDelta
        || (candidate.absDelta === bestNearest.absDelta && candidate.number < bestNearest.number)
      ) {
        bestNearest = candidate;
      }
      if (stake > 0) candidates.push(candidate);
    }

    const selected = bestAtOrAboveTarget || bestNearest || { number: 0, houseNetIfWins: 0, deltaFromTarget: 0 };
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
