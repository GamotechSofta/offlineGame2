import mongoose from 'mongoose';
import QuizBet from '../models/quiz/QuizBet.js';
import QuizSlotPick from '../models/quiz/QuizSlotPick.js';
import { getRatesMap } from '../models/rate/rate.js';
import { Wallet, WalletTransaction } from '../models/wallet/wallet.js';
import { resolveWinningShuffledPosition } from './quizPickPositionService.js';
import { isSlotDeclared } from './quizDeclarationService.js';
import { evaluate3DBetAgainstResult, resolve3DPayoutMultiplier } from './quiz3dPayoutHelpers.js';

async function quiz2dWinMultiplier() {
  try {
    const rates = await getRatesMap();
    const m = Number(rates?.quiz2d);
    if (Number.isFinite(m) && m > 0) return m;
  } catch {}
  const envMultiplier = parseInt(process.env.QUIZ_BET_WIN_MULTIPLIER ?? '90', 10);
  return Number.isFinite(envMultiplier) && envMultiplier > 0 ? envMultiplier : 90;
}

/**
 * Settle all pending quiz bets for a completed slot (idempotent per bet via status: pending).
 * @param {{ skipDeclaredCheck?: boolean }} [options] - When true, settle using picks after slot end even if admin declaration row is missing (player my-bets read path).
 */
export async function settleQuizBetsForSlot(slotStartIso, gameMode = '2d', options = {}) {
  const skipDeclaredCheck = Boolean(options?.skipDeclaredCheck);
  if (!skipDeclaredCheck && !(await isSlotDeclared(slotStartIso, gameMode))) return { settled: 0 };
  const pending = await QuizBet.find({ gameMode, slotStartIso, status: 'pending' }).lean();
  if (!pending.length) return { settled: 0 };

  const picks = await QuizSlotPick.find({ gameMode, slotStartIso }).lean();
  const pickByQuiz = new Map(picks.map((p) => [p.quizId, p]));

  let ratesMap = null;
  if (gameMode === '3d') {
    ratesMap = await getRatesMap();
  }
  const mult2d = gameMode !== '3d' ? await quiz2dWinMultiplier() : null;
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

    let status;
    let winPayout;
    let isWin = false;
    if (gameMode === '3d') {
      const evalResult = evaluate3DBetAgainstResult(bet.betMode || 'str', bet.number, winningNumber);
      const mult = evalResult.matched
        ? resolve3DPayoutMultiplier(ratesMap, bet.betMode || 'str', bet.number, evalResult)
        : 0;
      isWin = Boolean(evalResult.matched);
      status = isWin ? 'win' : 'lose';
      winPayout = isWin ? Math.round(bet.amount * mult) : 0;
    } else {
      isWin = bet.number === winningNumber;
      status = isWin ? 'win' : 'lose';
      winPayout = isWin ? Math.round(bet.amount * mult2d) : 0;
    }

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
