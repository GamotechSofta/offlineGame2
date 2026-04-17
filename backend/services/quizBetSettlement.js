import mongoose from 'mongoose';
import QuizBet from '../models/quiz/QuizBet.js';
import QuizSlotPick from '../models/quiz/QuizSlotPick.js';
import { getRatesMap } from '../models/rate/rate.js';
import { Wallet, WalletTransaction } from '../models/wallet/wallet.js';
import { resolveWinningShuffledPosition } from './quizPickPositionService.js';

async function winMultiplier(gameMode = '2d') {
  try {
    const rates = await getRatesMap();
    const m = Number(gameMode === '3d' ? rates?.quiz3d : rates?.quiz2d);
    if (Number.isFinite(m) && m > 0) return m;
  } catch {
    // Fall back to env/default when rates are unavailable.
  }
  const envMultiplier = parseInt(
    gameMode === '3d'
      ? (process.env.QUIZ3D_BET_WIN_MULTIPLIER ?? process.env.QUIZ_BET_WIN_MULTIPLIER ?? '90')
      : (process.env.QUIZ_BET_WIN_MULTIPLIER ?? '90'),
    10,
  );
  return Number.isFinite(envMultiplier) && envMultiplier > 0 ? envMultiplier : 90;
}

/**
 * Settle all pending quiz bets for a completed slot (idempotent per bet via status: pending).
 */
export async function settleQuizBetsForSlot(slotStartIso, gameMode = '2d') {
  const pending = await QuizBet.find({ gameMode, slotStartIso, status: 'pending' }).lean();
  if (!pending.length) return { settled: 0 };

  const picks = await QuizSlotPick.find({ gameMode, slotStartIso }).lean();
  const pickByQuiz = new Map(picks.map((p) => [p.quizId, p]));

  const mult = await winMultiplier(gameMode);
  let settled = 0;

  for (const bet of pending) {
    const pick = pickByQuiz.get(bet.quizId);
    if (!pick) {
      // eslint-disable-next-line no-continue
      continue;
    }
    let winningNumber;
    try {
      winningNumber = await resolveWinningShuffledPosition(bet.quizId, slotStartIso, pick, gameMode);
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
        // eslint-disable-next-line no-await-in-loop
        await WalletTransaction.create({
          userId: uid,
          type: 'credit',
          amount: winPayout,
          description: `Quiz ${String(gameMode).toUpperCase()} win payout`,
          referenceId: String(bet._id),
        });
      }
    }
  }

  if (settled > 0) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ tag: '[quiz:bet:settle]', gameMode, slotStartIso, settled }));
  }
  return { settled };
}
