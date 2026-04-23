import mongoose from 'mongoose';
import QuizBet from '../models/quiz/QuizBet.js';
import QuizSlotPick from '../models/quiz/QuizSlotPick.js';
import User from '../models/user/user.js';
import { getRatesMap } from '../models/rate/rate.js';
import Admin from '../models/admin/admin.js';
import bcrypt from 'bcryptjs';
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
import { getShuffleOrderIndices } from '../services/quizShuffleService.js';
import { stripQuestionMetaForHint } from '../services/randomService.js';
import { ensure3DQuizQuestionBank } from '../services/quizQuestionBankService.js';
import {
  blockAutoDeclare,
  enableAutoDeclare,
  getSlotDeclarationState,
  markSlotDeclared,
} from '../services/quizDeclarationService.js';
import { getQuizSocketIo } from '../socket/socketHub.js';
import { settleQuizBetsForSlot } from '../services/quizBetSettlement.js';

const QUIZ_IDS = [1, 2, 3];
const GAME_MODE = '3d';

async function getQuiz3DMultiplier() {
  try {
    const rates = await getRatesMap();
    const rate = Number(rates?.quiz3d);
    if (Number.isFinite(rate) && rate > 0) return rate;
  } catch {
    // Fall back to env/default when rates are unavailable.
  }
  const fallback = parseInt(process.env.QUIZ3D_BET_WIN_MULTIPLIER || process.env.QUIZ_BET_WIN_MULTIPLIER || '90', 10);
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
    if (String(bet?.status || '').toLowerCase() === 'cancelled') {
      // eslint-disable-next-line no-continue
      continue;
    }
    ticketCount += 1;
    revenue += Number(bet.amount || 0);
    if (bet.userId) users.add(String(bet.userId));
    const hp = picksByQuiz.get(bet.quizId);
    const explicitStatus = String(bet?.status || '').toLowerCase();
    const explicitPayout = Number(bet?.winPayout || 0);
    const isWinByStored = explicitStatus === 'win' || explicitPayout > 0;
    const isWinByComputed = Number.isInteger(hp) && hp === bet.number;
    if (isWinByStored || isWinByComputed) {
      winnerTickets += 1;
      if (bet.userId) winnerUsers.add(String(bet.userId));
      winnerPayout += explicitPayout > 0
        ? explicitPayout
        : Math.round(Number(bet.amount || 0) * winMultiplier);
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

async function verifySecretDeclarePassword(req) {
  const adminWithSecret = await Admin.findById(req.admin._id).select('+secretDeclarePassword').lean();
  if (!adminWithSecret?.secretDeclarePassword) {
    return { success: true, hasSecretDeclarePassword: false };
  }

  const provided = (req.body?.secretDeclarePassword ?? '').toString().trim();
  const isValid = await bcrypt.compare(provided, adminWithSecret.secretDeclarePassword);
  if (!isValid) {
    return {
      success: false,
      hasSecretDeclarePassword: true,
      error: {
        status: 403,
        body: {
          success: false,
          message: 'Invalid secret declare password',
          code: 'INVALID_SECRET_DECLARE_PASSWORD',
        },
      },
    };
  }

  return { success: true, hasSecretDeclarePassword: true };
}

const getSetLabelByQuizId = (quizId) => {
  if (Number(quizId) === 1) return 'Set A';
  if (Number(quizId) === 2) return 'Set B';
  if (Number(quizId) === 3) return 'Set C';
  return `Q${String(quizId).padStart(2, '0')}`;
};

function getOutcomeAndPayout({ isCompleted, pickByQuiz, bet, winMultiplier }) {
  if (String(bet?.status || '').toLowerCase() === 'cancelled') {
    return { outcome: 'cancelled', payout: 0, net: 0 };
  }
  if (!isCompleted) {
    return { outcome: 'pending', payout: 0, net: -Number(bet.amount || 0) };
  }
  const explicitStatus = String(bet?.status || '').toLowerCase();
  const explicitPayout = Number(bet?.winPayout || 0);
  if (explicitStatus === 'win') {
    const payout = explicitPayout > 0 ? explicitPayout : Math.round(Number(bet.amount || 0) * Number(winMultiplier || 0));
    return { outcome: 'win', payout, net: payout - Number(bet.amount || 0) };
  }
  if (explicitStatus === 'lose') {
    return { outcome: 'lose', payout: 0, net: -Number(bet.amount || 0) };
  }
  const hp = pickByQuiz.get(bet.quizId);
  const won = Number.isInteger(hp) && hp === Number(bet.number);
  if (!won) {
    return { outcome: 'lose', payout: 0, net: -Number(bet.amount || 0) };
  }
  const payout = explicitPayout > 0 ? explicitPayout : Math.round(Number(bet.amount || 0) * Number(winMultiplier || 0));
  return { outcome: 'win', payout, net: payout - Number(bet.amount || 0) };
}

async function buildPlayersForSlot(slotStartIso) {
  const slotStartMs = new Date(slotStartIso).getTime();
  const slotEndMs = slotStartMs + SLOT_MS;
  const isCompleted = Date.now() >= slotEndMs;
  const [bets, picks, winMultiplier] = await Promise.all([
    QuizBet.find({ gameMode: GAME_MODE, slotStartIso })
      .select('_id userId quizId number amount status winPayout createdAt')
      .sort({ createdAt: -1 })
      .lean(),
    QuizSlotPick.find({ gameMode: GAME_MODE, slotStartIso })
      .select('quizId hintPosition')
      .lean(),
    getQuiz3DMultiplier(),
  ]);

  const userIds = Array.from(new Set(bets.map((b) => String(b.userId || '')).filter(Boolean)));
  const users = await User.find({ _id: { $in: userIds } }).select('username phone').lean();
  const userById = new Map(users.map((u) => [String(u._id), u]));
  const overallStatsRaw = userIds.length
    ? await QuizBet.aggregate([
      {
        $match: {
          gameMode: GAME_MODE,
          userId: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) },
          status: { $ne: 'cancelled' },
        },
      },
      {
        $group: {
          _id: '$userId',
          totalBetCountAllTime: { $sum: 1 },
          totalStakeAllTime: { $sum: '$amount' },
        },
      },
    ])
    : [];
  const overallStatsByUserId = new Map(
    overallStatsRaw.map((row) => [String(row._id), {
      totalBetCountAllTime: Number(row.totalBetCountAllTime || 0),
      totalStakeAllTime: Number(row.totalStakeAllTime || 0),
    }]),
  );
  const pickByQuiz = new Map(picks.map((p) => [p.quizId, p.hintPosition]));
  const playerMap = new Map();

  for (const bet of bets) {
    const userId = String(bet.userId || '');
    if (!userId) continue;
    const user = userById.get(userId);
    if (!playerMap.has(userId)) {
      playerMap.set(userId, {
        userId,
        username: user?.username || 'unknown',
        phone: user?.phone || '',
        totalBetCountAllTime: 0,
        totalStakeAllTime: 0,
        betCount: 0,
        totalStake: 0,
        totalPayout: 0,
        netProfitLoss: 0,
        wins: 0,
        losses: 0,
        pending: 0,
        bets: [],
      });
    }
    const row = playerMap.get(userId);
    const amount = Number(bet.amount || 0);
    const result = getOutcomeAndPayout({ isCompleted, pickByQuiz, bet, winMultiplier });
    row.betCount += 1;
    if (result.outcome === 'cancelled') {
      row.bets.push({
        betId: String(bet._id),
        quizId: bet.quizId,
        setLabel: getSetLabelByQuizId(bet.quizId),
        number: String(bet.number).padStart(3, '0'),
        amount,
        outcome: 'cancelled',
        payout: 0,
        netProfitLoss: 0,
        createdAt: bet.createdAt,
      });
      // eslint-disable-next-line no-continue
      continue;
    }
    row.totalStake += amount;
    row.totalPayout += result.payout;
    row.netProfitLoss += result.net;
    if (result.outcome === 'win') row.wins += 1;
    else if (result.outcome === 'lose') row.losses += 1;
    else row.pending += 1;
    row.bets.push({
      betId: String(bet._id),
      quizId: bet.quizId,
      setLabel: getSetLabelByQuizId(bet.quizId),
      number: String(bet.number).padStart(3, '0'),
      amount,
      outcome: result.outcome,
      payout: result.payout,
      netProfitLoss: result.net,
      createdAt: bet.createdAt,
    });
  }

  for (const [userId, row] of playerMap.entries()) {
    const overall = overallStatsByUserId.get(userId);
    row.totalBetCountAllTime = Number(overall?.totalBetCountAllTime || row.betCount || 0);
    row.totalStakeAllTime = Number(overall?.totalStakeAllTime || row.totalStake || 0);
  }

  return {
    slot: {
      slotStartIso,
      slotEndIso: new Date(slotEndMs).toISOString(),
      drawLabelEnd: formatDrawLabel(slotEndMs),
      isCompleted,
    },
    players: Array.from(playerMap.values()).sort((a, b) => b.totalStake - a.totalStake),
  };
}

export const getLottery3DCurrentSlot = async (req, res) => {
  try {
    const ctx = getSlotContext(new Date(), '3d');
    const slotStartIso = ctx.slotStartIso;
    const slotEndMs = ctx.slotEndMs;

    const [bets, picks, winMultiplier] = await Promise.all([
      QuizBet.find({ gameMode: GAME_MODE, slotStartIso }).select('quizId userId number amount status winPayout').lean(),
      QuizSlotPick.find({ gameMode: GAME_MODE, slotStartIso }).select('quizId hintPosition').lean(),
      getQuiz3DMultiplier(),
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
      if (String(bet?.status || '').toLowerCase() === 'cancelled') {
        // eslint-disable-next-line no-continue
        continue;
      }
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
    const declaration = await getSlotDeclarationState(slotStartIso, GAME_MODE, slotEndMs);
    return res.json({
      success: true,
      data: {
        slot: {
          slotStartIso,
          slotEndIso: new Date(slotEndMs).toISOString(),
          drawLabelEnd: formatDrawLabel(slotEndMs),
          phase: ctx.phase,
          istDayKey: ctx.istDayKey,
          declaration,
        },
        summary: slotSummary,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export const getLottery3DCurrentSlotHints = async (req, res) => {
  try {
    const verification = await verifySecretDeclarePassword(req);
    if (!verification.success) {
      return res.status(verification.error.status).json(verification.error.body);
    }

    const ctx = getSlotContext(new Date(), '3d');
    const slotStartIso = ctx.slotStartIso;

    // Ensure all 3D sets (Q01/Q02/Q03 => A/B/C) exist for running slot.
    await Promise.all(QUIZ_IDS.map((quizId) => getOrCreatePick(quizId, slotStartIso, GAME_MODE)));

    let picks = await QuizSlotPick.find({ gameMode: GAME_MODE, slotStartIso }).select('quizId hintPosition').lean();

    // Self-heal legacy/corrupt rows where hintPosition is missing, so admin UI doesn't show "--".
    const pickByQuiz = new Map(picks.map((p) => [p.quizId, p]));
    const invalidQuizIds = QUIZ_IDS.filter((quizId) => {
      const row = pickByQuiz.get(quizId);
      return !row || !Number.isInteger(row.hintPosition) || row.hintPosition < 0 || row.hintPosition > 999;
    });
    if (invalidQuizIds.length) {
      await Promise.all(invalidQuizIds.map(async (quizId) => {
        await QuizSlotPick.deleteOne({ gameMode: GAME_MODE, quizId, slotStartIso });
        await getOrCreatePick(quizId, slotStartIso, GAME_MODE);
      }));
      picks = await QuizSlotPick.find({ gameMode: GAME_MODE, slotStartIso }).select('quizId hintPosition').lean();
    }

    const perQuiz = baseQuizStatsById();
    for (const p of picks) {
      const row = perQuiz.get(p.quizId);
      if (row) row.result = Number.isInteger(p.hintPosition) ? p.hintPosition : null;
    }

    return res.json({
      success: true,
      data: {
        slot: {
          slotStartIso,
          slotEndIso: new Date(ctx.slotEndMs).toISOString(),
          drawLabelEnd: formatDrawLabel(ctx.slotEndMs),
          phase: ctx.phase,
          istDayKey: ctx.istDayKey,
        },
        perQuiz: QUIZ_IDS.map((q) => perQuiz.get(q)),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export const getLottery3DSlotHistory = async (req, res) => {
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
    const daySlots = listSlotStartIsoForISTDay(date)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .slice(0, limit);

    if (!daySlots.length) {
      return res.json({ success: true, data: { date, slots: [] } });
    }

    const [bets, picks, winMultiplier] = await Promise.all([
      QuizBet.find({ gameMode: GAME_MODE, slotStartIso: { $in: daySlots } }).select('slotStartIso quizId userId number amount status winPayout').lean(),
      QuizSlotPick.find({ gameMode: GAME_MODE, slotStartIso: { $in: daySlots } }).select('slotStartIso quizId hintPosition').lean(),
      getQuiz3DMultiplier(),
    ]);

    const picksBySlot = new Map();
    for (const p of picks) {
      if (!picksBySlot.has(p.slotStartIso)) picksBySlot.set(p.slotStartIso, new Map());
      picksBySlot.get(p.slotStartIso).set(p.quizId, p.hintPosition);
    }

    const betsBySlot = new Map();
    for (const slotIso of daySlots) betsBySlot.set(slotIso, []);
    for (const b of bets) {
      if (!betsBySlot.has(b.slotStartIso)) betsBySlot.set(b.slotStartIso, []);
      betsBySlot.get(b.slotStartIso).push(b);
    }

    const slotsBase = daySlots.map((slotStartIso) => {
      const slotEndMs = new Date(slotStartIso).getTime() + SLOT_MS;
      return toSlotSummary(
        slotStartIso,
        slotEndMs,
        betsBySlot.get(slotStartIso) || [],
        picksBySlot.get(slotStartIso) || new Map(),
        winMultiplier,
      );
    });
    const slots = await Promise.all(
      slotsBase.map(async (slot) => {
        const slotStartIso = slot.slotStartIso;
        const slotEndMs = new Date(slotStartIso).getTime() + SLOT_MS;
        const declaration = await getSlotDeclarationState(slotStartIso, GAME_MODE, slotEndMs);
        const pickByQuiz = picksBySlot.get(slotStartIso) || new Map();
        const perQuiz = QUIZ_IDS.map((quizId) => {
          const result = pickByQuiz.get(quizId);
          return {
            quizId,
            result: Number.isInteger(result) ? result : null,
            resultLabel: Number.isInteger(result) ? String(result).padStart(3, '0') : '--',
            declared: Boolean(declaration?.declared),
          };
        });
        return {
          ...slot,
          declaration,
          perQuiz,
        };
      }),
    );

    return res.json({ success: true, data: { date, slots } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export const getLottery3DSlotDetail = async (req, res) => {
  try {
    const { slotStartIso } = req.params;
    if (!isValidISTSlotStartIso(slotStartIso)) {
      return res.status(400).json({ success: false, message: 'Invalid slotStartIso.' });
    }

    const [bets, picks, winMultiplier] = await Promise.all([
      QuizBet.find({ gameMode: GAME_MODE, slotStartIso }).select('quizId userId number amount status winPayout').lean(),
      QuizSlotPick.find({ gameMode: GAME_MODE, slotStartIso }).select('quizId hintPosition').lean(),
      getQuiz3DMultiplier(),
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
      if (String(bet?.status || '').toLowerCase() === 'cancelled') {
        // eslint-disable-next-line no-continue
        continue;
      }
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

/**
 * GET /admin/lottery3d/slots/:slotStartIso/players
 * Returns all players for a slot with each bet + slot P/L.
 */
export const getLottery3DSlotPlayers = async (req, res) => {
  try {
    const { slotStartIso } = req.params;
    if (!isValidISTSlotStartIso(slotStartIso)) {
      return res.status(400).json({ success: false, message: 'Invalid slotStartIso.' });
    }
    const data = await buildPlayersForSlot(slotStartIso);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/**
 * GET /admin/lottery3d/players/:userId/history?limit=30
 * Returns full 3D betting history for selected player with slot-wise and overall P/L.
 */
export const getLottery3DPlayerHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid userId.' });
    }
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '30'), 10) || 30));
    const user = await User.findById(userId).select('username phone').lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'Player not found.' });
    }

    const bets = await QuizBet.find({ gameMode: GAME_MODE, userId })
      .select('_id slotStartIso quizId number amount status winPayout createdAt')
      .sort({ slotStartIso: -1, createdAt: -1 })
      .lean();
    if (!bets.length) {
      return res.json({
        success: true,
        data: {
          player: { userId, username: user.username || 'unknown', phone: user.phone || '' },
          summary: { totalBets: 0, totalStake: 0, totalPayout: 0, netProfitLoss: 0, wins: 0, losses: 0, pending: 0 },
          slots: [],
        },
      });
    }

    const slotStarts = Array.from(new Set(bets.map((b) => b.slotStartIso))).slice(0, limit);
    const picks = await QuizSlotPick.find({ gameMode: GAME_MODE, slotStartIso: { $in: slotStarts } })
      .select('slotStartIso quizId hintPosition')
      .lean();
    const winMultiplier = await getQuiz3DMultiplier();
    const picksBySlot = new Map();
    for (const p of picks) {
      if (!picksBySlot.has(p.slotStartIso)) picksBySlot.set(p.slotStartIso, new Map());
      picksBySlot.get(p.slotStartIso).set(p.quizId, p.hintPosition);
    }

    const slotsMap = new Map();
    const summary = { totalBets: 0, totalStake: 0, totalPayout: 0, netProfitLoss: 0, wins: 0, losses: 0, pending: 0 };
    for (const bet of bets) {
      const includeInSlots = slotStarts.includes(bet.slotStartIso);
      const slotStartMs = new Date(bet.slotStartIso).getTime();
      const slotEndMs = slotStartMs + SLOT_MS;
      const isCompleted = Date.now() >= slotEndMs;
      const pickByQuiz = picksBySlot.get(bet.slotStartIso) || new Map();
      const amount = Number(bet.amount || 0);
      const result = getOutcomeAndPayout({ isCompleted, pickByQuiz, bet, winMultiplier });
      if (includeInSlots && !slotsMap.has(bet.slotStartIso)) {
        slotsMap.set(bet.slotStartIso, {
          slotStartIso: bet.slotStartIso,
          slotEndIso: new Date(slotEndMs).toISOString(),
          drawLabelEnd: formatDrawLabel(slotEndMs),
          isCompleted,
          betCount: 0,
          totalStake: 0,
          totalPayout: 0,
          netProfitLoss: 0,
          wins: 0,
          losses: 0,
          pending: 0,
          bets: [],
        });
      }

      if (result.outcome === 'cancelled') {
        summary.totalBets += 1;
        if (includeInSlots) {
          const slotRow = slotsMap.get(bet.slotStartIso);
          slotRow.betCount += 1;
          slotRow.bets.push({
            betId: String(bet._id),
            quizId: bet.quizId,
            setLabel: getSetLabelByQuizId(bet.quizId),
            number: String(bet.number).padStart(3, '0'),
            amount,
            outcome: 'cancelled',
            payout: 0,
            netProfitLoss: 0,
            createdAt: bet.createdAt,
          });
        }
        // eslint-disable-next-line no-continue
        continue;
      }

      if (includeInSlots) {
        const slotRow = slotsMap.get(bet.slotStartIso);
        slotRow.betCount += 1;
        slotRow.totalStake += amount;
        slotRow.totalPayout += result.payout;
        slotRow.netProfitLoss += result.net;
        if (result.outcome === 'win') slotRow.wins += 1;
        else if (result.outcome === 'lose') slotRow.losses += 1;
        else slotRow.pending += 1;
        slotRow.bets.push({
          betId: String(bet._id),
          quizId: bet.quizId,
          setLabel: getSetLabelByQuizId(bet.quizId),
          number: String(bet.number).padStart(3, '0'),
          amount,
          outcome: result.outcome,
          payout: result.payout,
          netProfitLoss: result.net,
          createdAt: bet.createdAt,
        });
      }

      summary.totalBets += 1;
      summary.totalStake += amount;
      summary.totalPayout += result.payout;
      summary.netProfitLoss += result.net;
      if (result.outcome === 'win') summary.wins += 1;
      else if (result.outcome === 'lose') summary.losses += 1;
      else summary.pending += 1;
    }

    const slots = slotStarts
      .map((slotStartIso) => slotsMap.get(slotStartIso))
      .filter(Boolean)
      .sort((a, b) => new Date(b.slotStartIso).getTime() - new Date(a.slotStartIso).getTime());

    return res.json({
      success: true,
      data: {
        player: { userId, username: user.username || 'unknown', phone: user.phone || '' },
        summary,
        slots,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export const updateLottery3DSlotResult = async (req, res) => {
  try {
    const { slotStartIso } = req.params;
    const quizId = Number(req.body?.quizId);
    const result = Number(req.body?.result);

    if (req.admin?.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Super admin access required.' });
    }

    if (!isValidISTSlotStartIso(slotStartIso)) {
      return res.status(400).json({ success: false, message: 'Invalid slotStartIso.' });
    }
    if (!Number.isInteger(quizId) || !QUIZ_IDS.includes(quizId)) {
      return res.status(400).json({ success: false, message: 'quizId must be one of 1, 2, 3.' });
    }
    if (!Number.isInteger(result) || result < 0 || result > 999) {
      return res.status(400).json({ success: false, message: 'result must be between 000 and 999.' });
    }

    const ctx = getSlotContext(new Date(), '3d');
    if (slotStartIso !== ctx.slotStartIso) {
      return res.status(400).json({
        success: false,
        message: 'Manual hint changes are allowed only for the current running slot.',
      });
    }

    if (Date.now() >= ctx.slotEndMs) {
      return res.status(400).json({
        success: false,
        message: 'This slot has already closed. Hint changes are no longer allowed.',
      });
    }

    const existingPick = await getOrCreatePick(quizId, slotStartIso, GAME_MODE);
    const quiz = await ensure3DQuizQuestionBank(quizId);
    const canBuildShuffledQuestion = Array.isArray(quiz?.questions) && quiz.questions.length === 1000 && existingPick?.seedHex;
    let chosenIndex = null;
    let hintQuestionText = null;
    if (canBuildShuffledQuestion) {
      const order = await getShuffleOrderIndices(quizId, slotStartIso, existingPick.seedHex, GAME_MODE, 1000);
      chosenIndex = Number.isInteger(order?.[result]) ? order[result] : null;
      if (Number.isInteger(chosenIndex) && chosenIndex >= 0 && chosenIndex < quiz.questions.length) {
        const q = quiz.questions[chosenIndex];
        hintQuestionText = stripQuestionMetaForHint(q?.question);
      }
    }

    const setDoc = { hintPosition: result };
    if (Number.isInteger(chosenIndex)) setDoc.chosenIndex = chosenIndex;
    if (typeof hintQuestionText === 'string' && hintQuestionText.length > 0) setDoc.hintQuestionText = hintQuestionText;

    const updated = await QuizSlotPick.findOneAndUpdate(
      { gameMode: GAME_MODE, quizId, slotStartIso },
      { $set: setDoc },
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

/**
 * GET /admin/lottery3d/quizzes/:quizId/stake-by-number?slotStartIso=...
 * Per-number stakes for one set in a slot; house net if that number wins (pool − payout).
 */
export const getLottery3DQuizStakeByNumber = async (req, res) => {
  try {
    const quizId = Number(req.params.quizId);
    const slotStartIso = typeof req.query.slotStartIso === 'string' ? req.query.slotStartIso.trim() : '';
    if (!Number.isInteger(quizId) || !QUIZ_IDS.includes(quizId)) {
      return res.status(400).json({ success: false, message: 'quizId must be one of 1, 2, 3.' });
    }
    if (!isValidISTSlotStartIso(slotStartIso)) {
      return res.status(400).json({ success: false, message: 'Valid slotStartIso query parameter is required.' });
    }

    const slotStartMs = new Date(slotStartIso).getTime();
    const slotEndMs = slotStartMs + SLOT_MS;

    const [bets, pick, winMultiplier] = await Promise.all([
      QuizBet.find({ gameMode: GAME_MODE, slotStartIso, quizId }).select('number amount status').lean(),
      QuizSlotPick.findOne({ gameMode: GAME_MODE, slotStartIso, quizId }).select('hintPosition').lean(),
      getQuiz3DMultiplier(),
    ]);

    const stakeByNumber = new Map();
    const ticketCountByNumber = new Map();
    let totalStake = 0;
    let totalTickets = 0;

    for (const bet of bets) {
      if (String(bet?.status || '').toLowerCase() === 'cancelled') continue;
      const n = Number(bet.number);
      if (!Number.isInteger(n) || n < 0 || n > 999) continue;
      const amt = Number(bet.amount || 0);
      totalStake += amt;
      totalTickets += 1;
      stakeByNumber.set(n, (stakeByNumber.get(n) || 0) + amt);
      ticketCountByNumber.set(n, (ticketCountByNumber.get(n) || 0) + 1);
    }

    const rows = [];
    let uniqueNumbersWithBets = 0;
    for (let num = 0; num <= 999; num += 1) {
      const stake = stakeByNumber.get(num) || 0;
      const tickets = ticketCountByNumber.get(num) || 0;
      if (stake > 0) uniqueNumbersWithBets += 1;
      const payoutIfWin = Math.round(stake * winMultiplier);
      const houseNetIfWins = totalStake - payoutIfWin;
      rows.push({
        number: num,
        numberLabel: String(num).padStart(3, '0'),
        stake,
        tickets,
        payoutIfWin,
        houseNetIfWins,
      });
    }

    const hintPosition = Number.isInteger(pick?.hintPosition) ? pick.hintPosition : null;

    return res.json({
      success: true,
      data: {
        quizId,
        setLabel: getSetLabelByQuizId(quizId),
        slotStartIso,
        drawLabelEnd: formatDrawLabel(slotEndMs),
        slotEndIso: new Date(slotEndMs).toISOString(),
        winMultiplier,
        hintPosition,
        totalStake,
        totalTickets,
        uniqueNumbersWithBets,
        rows,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export const updateLottery3DSlotDeclaration = async (req, res) => {
  try {
    if (req.admin?.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Super admin access required.' });
    }
    const slotStartIso = String(req.body?.slotStartIso || '').trim() || getSlotContext(new Date(), '3d').slotStartIso;
    const action = String(req.body?.action || '').trim().toLowerCase();
    if (!isValidISTSlotStartIso(slotStartIso)) {
      return res.status(400).json({ success: false, message: 'Invalid slotStartIso.' });
    }
    if (!['hold', 'auto', 'declare'].includes(action)) {
      return res.status(400).json({ success: false, message: 'action must be hold, auto, or declare.' });
    }
    const slotEndMs = new Date(slotStartIso).getTime() + SLOT_MS;
    const existingDeclaration = await getSlotDeclarationState(slotStartIso, GAME_MODE, slotEndMs);
    if (existingDeclaration.declared) {
      return res.status(400).json({
        success: false,
        message: 'Result already declared for this slot. It can be declared only once.',
      });
    }

    if (action === 'hold') {
      await blockAutoDeclare(slotStartIso, GAME_MODE, req.admin?._id);
    } else if (action === 'auto') {
      await enableAutoDeclare(slotStartIso, GAME_MODE, req.admin?._id);
    } else {
      if (Date.now() < slotEndMs) {
        return res.status(400).json({
          success: false,
          message: 'Result can be declared only after the slot is completed.',
        });
      }
      await markSlotDeclared(slotStartIso, GAME_MODE, req.admin?._id, { force: true });
      const io = getQuizSocketIo();
      if (io) {
        const picks = await QuizSlotPick.find({ gameMode: GAME_MODE, slotStartIso }, { quizId: 1, hintPosition: 1, _id: 0 }).lean();
        const byQuiz = new Map(picks.map((p) => [p.quizId, p.hintPosition]));
        const results = QUIZ_IDS.map((quizId) => ({ quizId, ready: Number.isInteger(byQuiz.get(quizId)) }));
        io.emit('quiz:result', { gameMode: GAME_MODE, slotStartIso, results });
      }
      await settleQuizBetsForSlot(slotStartIso, GAME_MODE);
    }

    const declaration = await getSlotDeclarationState(slotStartIso, GAME_MODE, slotEndMs);
    return res.json({ success: true, data: { slotStartIso, declaration } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

