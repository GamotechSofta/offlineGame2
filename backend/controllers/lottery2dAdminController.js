import QuizBet from '../models/quiz/QuizBet.js';
import QuizSlotPick from '../models/quiz/QuizSlotPick.js';
import { getRatesMap } from '../models/rate/rate.js';
import {
  SLOT_MS,
  formatDrawLabel,
  getSlotContext,
  isValidISTDayKey,
  isValidISTSlotStartIso,
  istDayKey,
  listSlotStartIsoForISTDay,
} from '../services/slotService.js';
import { getOrCreatePick } from '../services/quizPickService.js';

const QUIZ_IDS = Array.from({ length: 30 }, (_, i) => i + 1);
const GAME_MODE = '2d';

async function getQuiz2DMultiplier() {
  try {
    const rates = await getRatesMap();
    const rate = Number(rates?.quiz2d);
    if (Number.isFinite(rate) && rate > 0) return rate;
  } catch {
    // Fall back to env/default when rates are unavailable.
  }
  const fallback = parseInt(process.env.QUIZ_BET_WIN_MULTIPLIER || '90', 10);
  return Number.isFinite(fallback) && fallback > 0 ? fallback : 90;
}

function baseQuizStatsById() {
  const map = new Map();
  for (const quizId of QUIZ_IDS) {
    map.set(quizId, {
      quizId,
      result: null,
      ticketCount: 0,
      totalBetAmount: 0,
      uniqueUsers: 0,
      winnerTickets: 0,
      winnerUsers: 0,
    });
  }
  return map;
}

function toSlotSummary(slotStartIso, slotEndMs, bets, picksByQuiz, winMultiplier) {
  const users = new Set();
  const winnerUsers = new Set();
  let ticketCount = 0;
  let revenue = 0;
  let winnerTickets = 0;
  let winnerPayout = 0;

  for (const bet of bets) {
    ticketCount += 1;
    revenue += Number(bet.amount || 0);
    if (bet.userId) users.add(String(bet.userId));
    const hp = picksByQuiz.get(bet.quizId);
    if (Number.isInteger(hp) && hp === bet.number) {
      winnerTickets += 1;
      if (bet.userId) winnerUsers.add(String(bet.userId));
      winnerPayout += Math.round(Number(bet.amount || 0) * winMultiplier);
    }
  }

  return {
    slotStartIso,
    slotEndIso: new Date(slotEndMs).toISOString(),
    drawLabelEnd: formatDrawLabel(slotEndMs),
    isCompleted: Date.now() >= slotEndMs,
    totalTickets: ticketCount,
    revenue,
    totalBetAmount: revenue,
    totalUsers: users.size,
    winnerTickets,
    winnerUsers: winnerUsers.size,
    winnerPayout,
    amountRemaining: revenue - winnerPayout,
  };
}

export const getLottery2DCurrentSlot = async (req, res) => {
  try {
    const ctx = getSlotContext(new Date());
    const slotStartIso = ctx.slotStartIso;
    const slotEndMs = ctx.slotEndMs;

    const [bets, picks, winMultiplier] = await Promise.all([
      QuizBet.find({ gameMode: GAME_MODE, slotStartIso }).select('quizId userId number amount winPayout').lean(),
      QuizSlotPick.find({ gameMode: GAME_MODE, slotStartIso }).select('quizId hintPosition').lean(),
      getQuiz2DMultiplier(),
    ]);

    const pickByQuiz = new Map();
    for (const p of picks) pickByQuiz.set(p.quizId, p.hintPosition);
    const perQuiz = baseQuizStatsById();

    for (const p of picks) {
      const row = perQuiz.get(p.quizId);
      if (row) row.result = Number.isInteger(p.hintPosition) ? p.hintPosition : null;
    }

    const quizUsers = new Map();
    const quizWinnerUsers = new Map();
    for (const quizId of QUIZ_IDS) {
      quizUsers.set(quizId, new Set());
      quizWinnerUsers.set(quizId, new Set());
    }

    for (const bet of bets) {
      const row = perQuiz.get(bet.quizId);
      if (!row) continue;
      row.ticketCount += 1;
      row.totalBetAmount += Number(bet.amount || 0);
      if (bet.userId) quizUsers.get(bet.quizId).add(String(bet.userId));

      const hp = pickByQuiz.get(bet.quizId);
      if (Number.isInteger(hp) && hp === bet.number) {
        row.winnerTickets += 1;
        if (bet.userId) quizWinnerUsers.get(bet.quizId).add(String(bet.userId));
      }
    }

    for (const quizId of QUIZ_IDS) {
      const row = perQuiz.get(quizId);
      row.uniqueUsers = quizUsers.get(quizId).size;
      row.winnerUsers = quizWinnerUsers.get(quizId).size;
    }

    const slotSummary = toSlotSummary(slotStartIso, slotEndMs, bets, pickByQuiz, winMultiplier);
    return res.json({
      success: true,
      data: {
        slot: {
          slotStartIso,
          slotEndIso: new Date(slotEndMs).toISOString(),
          drawLabelEnd: formatDrawLabel(slotEndMs),
          phase: ctx.phase,
          istDayKey: ctx.istDayKey,
        },
        summary: slotSummary,
        perQuiz: QUIZ_IDS.map((q) => perQuiz.get(q)),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export const getLottery2DSlotHistory = async (req, res) => {
  try {
    const date = typeof req.query.date === 'string' ? req.query.date.trim() : istDayKey();
    if (!isValidISTDayKey(date)) {
      return res.status(400).json({ success: false, message: 'Invalid date. Use YYYY-MM-DD (IST).' });
    }
    const today = istDayKey();
    if (date > today) {
      return res.status(400).json({ success: false, message: 'Future date is not allowed.' });
    }

    const limit = Math.min(96, Math.max(1, parseInt(String(req.query.limit || '30'), 10) || 30));
    const now = Date.now();
    const completedSlots = listSlotStartIsoForISTDay(date)
      .filter((iso) => new Date(iso).getTime() + SLOT_MS <= now)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .slice(0, limit);

    if (!completedSlots.length) {
      return res.json({ success: true, data: { date, slots: [] } });
    }

    const [bets, picks, winMultiplier] = await Promise.all([
      QuizBet.find({ gameMode: GAME_MODE, slotStartIso: { $in: completedSlots } }).select('slotStartIso quizId userId number amount winPayout').lean(),
      QuizSlotPick.find({ gameMode: GAME_MODE, slotStartIso: { $in: completedSlots } }).select('slotStartIso quizId hintPosition').lean(),
      getQuiz2DMultiplier(),
    ]);

    const picksBySlot = new Map();
    for (const p of picks) {
      if (!picksBySlot.has(p.slotStartIso)) picksBySlot.set(p.slotStartIso, new Map());
      picksBySlot.get(p.slotStartIso).set(p.quizId, p.hintPosition);
    }

    const betsBySlot = new Map();
    for (const slotIso of completedSlots) betsBySlot.set(slotIso, []);
    for (const b of bets) {
      if (!betsBySlot.has(b.slotStartIso)) betsBySlot.set(b.slotStartIso, []);
      betsBySlot.get(b.slotStartIso).push(b);
    }

    const slots = completedSlots.map((slotStartIso) => {
      const slotEndMs = new Date(slotStartIso).getTime() + SLOT_MS;
      return toSlotSummary(
        slotStartIso,
        slotEndMs,
        betsBySlot.get(slotStartIso) || [],
        picksBySlot.get(slotStartIso) || new Map(),
        winMultiplier,
      );
    });

    return res.json({ success: true, data: { date, slots } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export const getLottery2DSlotDetail = async (req, res) => {
  try {
    const { slotStartIso } = req.params;
    if (!isValidISTSlotStartIso(slotStartIso)) {
      return res.status(400).json({ success: false, message: 'Invalid slotStartIso.' });
    }

    const [bets, picks, winMultiplier] = await Promise.all([
      QuizBet.find({ gameMode: GAME_MODE, slotStartIso }).select('quizId userId number amount winPayout').lean(),
      QuizSlotPick.find({ gameMode: GAME_MODE, slotStartIso }).select('quizId hintPosition').lean(),
      getQuiz2DMultiplier(),
    ]);

    const pickByQuiz = new Map();
    for (const p of picks) pickByQuiz.set(p.quizId, p.hintPosition);

    const perQuiz = baseQuizStatsById();
    for (const p of picks) {
      const row = perQuiz.get(p.quizId);
      if (row) row.result = Number.isInteger(p.hintPosition) ? p.hintPosition : null;
    }

    const usersByQuiz = new Map();
    const winnerUsersByQuiz = new Map();
    for (const quizId of QUIZ_IDS) {
      usersByQuiz.set(quizId, new Set());
      winnerUsersByQuiz.set(quizId, new Set());
    }

    for (const bet of bets) {
      const row = perQuiz.get(bet.quizId);
      if (!row) continue;
      row.ticketCount += 1;
      row.totalBetAmount += Number(bet.amount || 0);
      if (bet.userId) usersByQuiz.get(bet.quizId).add(String(bet.userId));

      const hp = pickByQuiz.get(bet.quizId);
      if (Number.isInteger(hp) && hp === bet.number) {
        row.winnerTickets += 1;
        if (bet.userId) winnerUsersByQuiz.get(bet.quizId).add(String(bet.userId));
      }
    }

    for (const quizId of QUIZ_IDS) {
      const row = perQuiz.get(quizId);
      row.uniqueUsers = usersByQuiz.get(quizId).size;
      row.winnerUsers = winnerUsersByQuiz.get(quizId).size;
    }

    const slotEndMs = new Date(slotStartIso).getTime() + SLOT_MS;
    const summary = toSlotSummary(slotStartIso, slotEndMs, bets, pickByQuiz, winMultiplier);
    return res.json({
      success: true,
      data: {
        slot: {
          slotStartIso,
          slotEndIso: new Date(slotEndMs).toISOString(),
          drawLabelEnd: formatDrawLabel(slotEndMs),
        },
        summary,
        perQuiz: QUIZ_IDS.map((q) => perQuiz.get(q)),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export const updateLottery2DSlotResult = async (req, res) => {
  try {
    const { slotStartIso } = req.params;
    const quizId = Number(req.body?.quizId);
    const result = Number(req.body?.result);

    if (!isValidISTSlotStartIso(slotStartIso)) {
      return res.status(400).json({ success: false, message: 'Invalid slotStartIso.' });
    }
    if (!Number.isInteger(quizId) || quizId < 1 || quizId > 30) {
      return res.status(400).json({ success: false, message: 'quizId must be between 1 and 30.' });
    }
    if (!Number.isInteger(result) || result < 0 || result > 99) {
      return res.status(400).json({ success: false, message: 'result must be between 00 and 99.' });
    }

    await getOrCreatePick(quizId, slotStartIso, GAME_MODE);
    const updated = await QuizSlotPick.findOneAndUpdate(
      { gameMode: GAME_MODE, quizId, slotStartIso },
      { $set: { hintPosition: result } },
      { new: true },
    ).select('quizId slotStartIso hintPosition updatedAt').lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Slot result not found.' });
    }

    return res.json({
      success: true,
      message: 'Result updated successfully.',
      data: {
        quizId: updated.quizId,
        slotStartIso: updated.slotStartIso,
        result: updated.hintPosition,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};
