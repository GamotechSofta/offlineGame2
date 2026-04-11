import mongoose from 'mongoose';
import QuizBet from '../models/quiz/QuizBet.js';
import QuizSlotPick from '../models/quiz/QuizSlotPick.js';
import { Wallet } from '../models/wallet/wallet.js';
import { resolveWinningShuffledPosition } from './quizPickPositionService.js';

function winMultiplier() {
  const m = parseInt(process.env.QUIZ_BET_WIN_MULTIPLIER ?? '90', 10);
  return Number.isFinite(m) && m > 0 ? m : 90;
}

/**
 * Settle all pending quiz bets for a completed slot (idempotent per bet via status: pending).
 */
export async function settleQuizBetsForSlot(slotStartIso) {
  const pending = await QuizBet.find({ slotStartIso, status: 'pending' }).lean();
  if (!pending.length) return { settled: 0 };

  const picks = await QuizSlotPick.find({ slotStartIso }).lean();
  const pickByQuiz = new Map(picks.map((p) => [p.quizId, p]));

  const mult = winMultiplier();
  let settled = 0;

  for (const bet of pending) {
    const pick = pickByQuiz.get(bet.quizId);
    if (!pick) {
      // eslint-disable-next-line no-continue
      continue;
    }
    let winningNumber;
    try {
      winningNumber = await resolveWinningShuffledPosition(bet.quizId, slotStartIso, pick);
    } catch {
      // eslint-disable-next-line no-continue
      continue;
    }

    const isWin = bet.number === winningNumber;
    const status = isWin ? 'win' : 'lose';
    const winPayout = isWin ? Math.round(bet.amount * mult) : 0;

    const up = await QuizBet.updateOne(
      { _id: bet._id, status: 'pending' },
      { $set: { status, winPayout } },
    );
    if (up.modifiedCount !== 1) {
      // eslint-disable-next-line no-continue
      continue;
    }
    settled += 1;

    if (isWin && winPayout > 0 && bet.betOwnerKey?.startsWith('u:')) {
      const uid = bet.betOwnerKey.slice(2);
      if (mongoose.Types.ObjectId.isValid(uid)) {
        // eslint-disable-next-line no-await-in-loop
        await Wallet.findOneAndUpdate({ userId: uid }, { $inc: { balance: winPayout } }, { upsert: true });
      }
    }
  }

  if (settled > 0) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ tag: '[quiz:bet:settle]', slotStartIso, settled }));
  }
  return { settled };
}
