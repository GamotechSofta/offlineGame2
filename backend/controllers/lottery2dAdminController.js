import mongoose from 'mongoose';
import Quiz from '../models/quiz/Quiz.js';
import QuizBet from '../models/quiz/QuizBet.js';
import QuizSlotPick from '../models/quiz/QuizSlotPick.js';
import QuizSlotDeclaration from '../models/quiz/QuizSlotDeclaration.js';
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
  istInclusiveDaySpan,
  listSlotStartIsoForISTDay,
  listSlotStartIsoForISTDayRange,
} from '../services/slotService.js';
import { getOrCreatePick } from '../services/quizPickService.js';
import { getShuffleOrderIndices } from '../services/quizShuffleService.js';
import { stripQuestionMetaForHint } from '../services/randomService.js';
import {
  blockAutoDeclare,
  enableAutoDeclare,
  ensureDeclaredResultsSnapshots,
  getDeclaredTargetPercentForHintApply,
  getSlotDeclarationState,
  markSlotDeclared,
  setSlotTargetProfitPercent,
} from '../services/quizDeclarationService.js';
import { getQuizSocketIo } from '../socket/socketHub.js';
import { settleQuizBetsForSlot } from '../services/quizBetSettlement.js';
import { getBookieUserIds } from '../utils/bookieFilter.js';
import { apply2DTargetProfitHintsToSlot, build2DTargetProfitHints } from '../services/quizTargetProfitService.js';

const QUIZ_IDS = Array.from({ length: 30 }, (_, i) => i + 1);
const GAME_MODE = '2d';

async function getLotteryScopeFilter(req) {
  const bookieUserIds = await getBookieUserIds(req.admin);
  if (bookieUserIds === null) return {};
  return { userId: { $in: bookieUserIds } };
}

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

function quizBetTicketKey(bet) {
  const tid = bet.ticketId ? String(bet.ticketId).trim() : '';
  return tid || `legacy:${String(bet._id)}`;
}

function baseQuizStatsById() {
  const map = new Map();
  for (const quizId of QUIZ_IDS) {
    map.set(quizId, {
      quizId,
      result: null,
      ticketCount: 0,
      betCount: 0,
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
  const ticketKeys = new Set();
  let totalBets = 0;
  let revenue = 0;
  let winnerTickets = 0;
  let winnerPayout = 0;

  for (const bet of bets) {
    if (String(bet?.status || '').toLowerCase() === 'cancelled') {
      // eslint-disable-next-line no-continue
      continue;
    }
    totalBets += 1;
    ticketKeys.add(quizBetTicketKey(bet));
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
    totalTickets: ticketKeys.size,
    totalBets,
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

const getQuizLabelByQuizId2d = (quizId) => `QUIZ${String(quizId).padStart(2, '0')}`;

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
    getQuiz2DMultiplier(),
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
        setLabel: getQuizLabelByQuizId2d(bet.quizId),
        number: String(bet.number).padStart(2, '0'),
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
      setLabel: getQuizLabelByQuizId2d(bet.quizId),
      number: String(bet.number).padStart(2, '0'),
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

/** All bets for every slot in an IST date range (inclusive), merged per user. */
async function buildPlayersForISTDateRange(dateFrom, dateTo) {
  const slotList = dateFrom === dateTo
    ? listSlotStartIsoForISTDay(dateFrom)
    : listSlotStartIsoForISTDayRange(dateFrom, dateTo);
  const isSingleDay = dateFrom === dateTo;
  if (!slotList.length) {
    return {
      slot: {
        view: isSingleDay ? 'day' : 'range',
        dateFrom,
        dateTo,
        ...(isSingleDay ? { date: dateFrom } : {}),
        label: isSingleDay
          ? `All draws · ${dateFrom} (IST)`
          : `All draws · ${dateFrom} – ${dateTo} (IST)`,
        slotStartIso: '',
      },
      players: [],
    };
  }

  const [bets, picks, winMultiplier] = await Promise.all([
    QuizBet.find({ gameMode: GAME_MODE, slotStartIso: { $in: slotList } })
      .select('_id userId quizId number amount status winPayout createdAt slotStartIso')
      .sort({ createdAt: -1 })
      .lean(),
    QuizSlotPick.find({ gameMode: GAME_MODE, slotStartIso: { $in: slotList } })
      .select('slotStartIso quizId hintPosition')
      .lean(),
    getQuiz2DMultiplier(),
  ]);

  const picksBySlot = new Map();
  for (const p of picks) {
    if (!picksBySlot.has(p.slotStartIso)) picksBySlot.set(p.slotStartIso, new Map());
    picksBySlot.get(p.slotStartIso).set(p.quizId, p.hintPosition);
  }

  const now = Date.now();
  const userIds = Array.from(new Set(bets.map((b) => String(b.userId || '')).filter(Boolean)));
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select('username phone').lean()
    : [];
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

  const playerMap = new Map();
  for (const bet of bets) {
    const userId = String(bet.userId || '');
    if (!userId) continue;
    const slotIso = bet.slotStartIso;
    const slotStartMs = new Date(slotIso).getTime();
    const slotEndMs = slotStartMs + SLOT_MS;
    const isCompleted = now >= slotEndMs;
    const pickByQuiz = picksBySlot.get(slotIso) || new Map();

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
        setLabel: getQuizLabelByQuizId2d(bet.quizId),
        number: String(bet.number).padStart(2, '0'),
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
      setLabel: getQuizLabelByQuizId2d(bet.quizId),
      number: String(bet.number).padStart(2, '0'),
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
    row.currentSlotBetCount = row.betCount;
  }

  return {
    slot: {
      view: isSingleDay ? 'day' : 'range',
      dateFrom,
      dateTo,
      ...(isSingleDay ? { date: dateFrom } : {}),
      label: isSingleDay
        ? `All draws · ${dateFrom} (IST)`
        : `All draws · ${dateFrom} – ${dateTo} (IST)`,
      slotStartIso: '',
    },
    players: Array.from(playerMap.values()).sort((a, b) => b.totalStake - a.totalStake),
  };
}

const withPlayersPagination = (data, req) => {
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const allPlayers = Array.isArray(data?.players) ? data.players : [];
  const skip = (page - 1) * limit;
  const hasMore = allPlayers.length > (skip + limit);
  return {
    ...data,
    players: allPlayers.slice(skip, skip + limit),
    pagination: {
      page,
      limit,
      hasMore,
      total: allPlayers.length,
    },
  };
};

/**
 * GET /admin/lottery2d/day-players?date=YYYY-MM-DD (single day, legacy)
 * or ?dateFrom=&dateTo= (IST inclusive range, max 62 days).
 */
export const getLottery2DDayPlayers = async (req, res) => {
  try {
    const dateFromQ = typeof req.query.dateFrom === 'string' ? req.query.dateFrom.trim() : '';
    const dateToQ = typeof req.query.dateTo === 'string' ? req.query.dateTo.trim() : '';
    const dateLegacy = typeof req.query.date === 'string' ? req.query.date.trim() : '';

    let dateFrom;
    let dateTo;
    if (dateFromQ && dateToQ) {
      dateFrom = dateFromQ;
      dateTo = dateToQ;
    } else if (dateLegacy) {
      dateFrom = dateLegacy;
      dateTo = dateLegacy;
    } else if (dateFromQ || dateToQ) {
      const single = dateFromQ || dateToQ;
      dateFrom = single;
      dateTo = single;
    } else {
      const today = istDayKey();
      dateFrom = today;
      dateTo = today;
    }

    if (!isValidISTDayKey(dateFrom) || !isValidISTDayKey(dateTo)) {
      return res.status(400).json({ success: false, message: 'Invalid date. Use YYYY-MM-DD (IST).' });
    }
    if (dateFrom > dateTo) {
      return res.status(400).json({ success: false, message: 'dateFrom must be on or before dateTo.' });
    }
    const today = istDayKey();
    if (dateTo > today) {
      return res.status(400).json({ success: false, message: 'dateTo cannot be after today (IST).' });
    }
    const rangeDays = istInclusiveDaySpan(dateFrom, dateTo);
    const MAX_RANGE_DAYS = 62;
    if (rangeDays > MAX_RANGE_DAYS) {
      return res.status(400).json({
        success: false,
        message: `Date range cannot exceed ${MAX_RANGE_DAYS} days (IST).`,
      });
    }

    const data = await buildPlayersForISTDateRange(dateFrom, dateTo);
    return res.json({ success: true, data: withPlayersPagination(data, req) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/**
 * GET /admin/lottery2d/slots/:slotStartIso/players
 */
export const getLottery2DSlotPlayers = async (req, res) => {
  try {
    const { slotStartIso } = req.params;
    if (!isValidISTSlotStartIso(slotStartIso)) {
      return res.status(400).json({ success: false, message: 'Invalid slotStartIso.' });
    }
    const data = await buildPlayersForSlot(slotStartIso);
    return res.json({ success: true, data: withPlayersPagination(data, req) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/**
 * GET /admin/lottery2d/tickets?dateFrom=&dateTo=&date=&slotStartIso=&limit=&page=
 * Ticket-wise view for admin with user + bet count + total stake.
 * Use dateFrom+dateTo (IST YYYY-MM-DD) for a range; omit both and pass legacy `date` for a single day.
 */
export const getLottery2DTickets = async (req, res) => {
  try {
    const rawSlotStartIso = typeof req.query.slotStartIso === 'string' ? req.query.slotStartIso.trim() : '';
    const dateFromQ = typeof req.query.dateFrom === 'string' ? req.query.dateFrom.trim() : '';
    const dateToQ = typeof req.query.dateTo === 'string' ? req.query.dateTo.trim() : '';
    const dateLegacy = typeof req.query.date === 'string' ? req.query.date.trim() : '';

    let dateFrom;
    let dateTo;
    if (dateFromQ && dateToQ) {
      dateFrom = dateFromQ;
      dateTo = dateToQ;
    } else if (dateLegacy) {
      dateFrom = dateLegacy;
      dateTo = dateLegacy;
    } else if (dateFromQ || dateToQ) {
      const single = dateFromQ || dateToQ;
      dateFrom = single;
      dateTo = single;
    } else {
      const today = istDayKey();
      dateFrom = today;
      dateTo = today;
    }

    if (!isValidISTDayKey(dateFrom) || !isValidISTDayKey(dateTo)) {
      return res.status(400).json({ success: false, message: 'Invalid date. Use YYYY-MM-DD (IST).' });
    }
    if (dateFrom > dateTo) {
      return res.status(400).json({ success: false, message: 'dateFrom must be on or before dateTo.' });
    }
    const rangeDays = istInclusiveDaySpan(dateFrom, dateTo);
    const MAX_RANGE_DAYS = 366;
    if (rangeDays > MAX_RANGE_DAYS) {
      return res.status(400).json({
        success: false,
        message: `Date range cannot exceed ${MAX_RANGE_DAYS} days (IST).`,
      });
    }

    const maxLimit = rangeDays > 1 ? 5000 : 1000;
    const limit = Math.min(maxLimit, Math.max(1, parseInt(String(req.query.limit || '300'), 10) || 300));
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const skip = (page - 1) * limit;

    const hasSlotFilter = rawSlotStartIso.length > 0;
    const slotStartIso = hasSlotFilter ? rawSlotStartIso : getSlotContext(new Date(), '2d').slotStartIso;
    if (hasSlotFilter && !isValidISTSlotStartIso(slotStartIso)) {
      return res.status(400).json({ success: false, message: 'Invalid slotStartIso.' });
    }

    const lotteryScopeFilter = await getLotteryScopeFilter(req);
    const match = {
      gameMode: GAME_MODE,
      ...lotteryScopeFilter,
    };
    if (hasSlotFilter) {
      match.slotStartIso = slotStartIso;
    } else {
      const slotList =
        dateFrom === dateTo
          ? listSlotStartIsoForISTDay(dateFrom)
          : listSlotStartIsoForISTDayRange(dateFrom, dateTo);
      match.slotStartIso = { $in: slotList };
    }

    /** Per-ticket roll-up: list includes fully cancelled tickets; stake/payout fields exclude cancelled lines. */
    const ticketGroupStage = {
      $group: {
        _id: {
          ticketId: '$ticketId',
          userId: '$userId',
          slotStartIso: '$slotStartIso',
        },
        totalLines: { $sum: 1 },
        activeLines: {
          $sum: {
            $cond: [{ $ne: ['$status', 'cancelled'] }, 1, 0],
          },
        },
        cancelledLines: {
          $sum: {
            $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0],
          },
        },
        totalStake: {
          $sum: {
            $cond: [{ $ne: ['$status', 'cancelled'] }, '$amount', 0],
          },
        },
        grossStake: { $sum: '$amount' },
        totalWinPayout: {
          $sum: {
            $cond: [{ $ne: ['$status', 'cancelled'] }, { $ifNull: ['$winPayout', 0] }, 0],
          },
        },
        pendingBets: {
          $sum: {
            $cond: [{ $eq: ['$status', 'pending'] }, 1, 0],
          },
        },
        placedAt: { $min: '$createdAt' },
      },
    };

    const matchNonCancelled = { ...match, status: { $ne: 'cancelled' } };

    const [facetResult, summaryAgg, distinctUserIds] = await Promise.all([
      QuizBet.aggregate([
        { $match: match },
        ticketGroupStage,
        {
          $facet: {
            ticketCounts: [
              {
                $group: {
                  _id: null,
                  totalTickets: { $sum: 1 },
                  totalActiveTickets: {
                    $sum: {
                      $cond: [{ $gt: ['$activeLines', 0] }, 1, 0],
                    },
                  },
                  totalCancelledTickets: {
                    $sum: {
                      $cond: [{ $eq: ['$activeLines', 0] }, 1, 0],
                    },
                  },
                },
              },
            ],
            rows: [{ $sort: { placedAt: -1 } }, { $skip: skip }, { $limit: limit + 1 }],
          },
        },
      ]),
      QuizBet.aggregate([
        { $match: matchNonCancelled },
        {
          $group: {
            _id: null,
            totalBets: { $sum: 1 },
            totalStake: { $sum: '$amount' },
            totalPayout: { $sum: { $ifNull: ['$winPayout', 0] } },
          },
        },
      ]),
      QuizBet.distinct('userId', matchNonCancelled),
    ]);

    const facet = facetResult[0] || { ticketCounts: [], rows: [] };
    const countRow = facet.ticketCounts[0] || {};
    const rowsAll = Array.isArray(facet.rows) ? facet.rows : [];
    const hasMore = rowsAll.length > limit;
    const rows = hasMore ? rowsAll.slice(0, limit) : rowsAll;

    const sum = summaryAgg[0] || {};
    const totalStake = Number(sum.totalStake || 0);
    const totalPayout = Number(sum.totalPayout || 0);
    const summary = {
      totalTickets: Number(countRow.totalTickets || 0),
      totalActiveTickets: Number(countRow.totalActiveTickets || 0),
      totalCancelledTickets: Number(countRow.totalCancelledTickets || 0),
      totalBets: Number(sum.totalBets || 0),
      totalStake,
      totalPayout,
      adminProfit: totalStake - totalPayout,
      uniqueUsers: Array.isArray(distinctUserIds) ? distinctUserIds.length : 0,
    };

    const userIds = Array.from(new Set(rows.map((row) => String(row?._id?.userId || '')).filter(Boolean)));
    const users = userIds.length
      ? await User.find({ _id: { $in: userIds } }).select('_id username phone').lean()
      : [];
    const userMap = new Map(users.map((u) => [String(u._id), u]));
    const tickets = rows.map((row) => {
      const uid = String(row?._id?.userId || '');
      const user = userMap.get(uid);
      const rowSlotStartIso = String(row?._id?.slotStartIso || '');
      const rowSlotStartMs = new Date(rowSlotStartIso).getTime();
      const rowSlotEndMs = rowSlotStartMs + SLOT_MS;
      const totalLines = Number(row?.totalLines || 0);
      const activeLines = Number(row?.activeLines || 0);
      const fullyCancelled = totalLines > 0 && activeLines === 0;
      return {
        ticketId: row?._id?.ticketId || '-',
        userId: uid,
        username: user?.username || 'unknown',
        phone: user?.phone || '',
        slotStartIso: rowSlotStartIso,
        drawLabelEnd: Number.isFinite(rowSlotEndMs) ? formatDrawLabel(rowSlotEndMs) : '-',
        /** All bet lines on this ticket (including cancelled). */
        totalBets: totalLines,
        activeBetLines: activeLines,
        cancelledBetLines: Number(row?.cancelledLines || 0),
        fullyCancelled,
        pendingBets: Number(row?.pendingBets || 0),
        /** Active stake only; 0 when fully cancelled. */
        totalStake: Number(row?.totalStake || 0),
        /** Sum of all line amounts (useful when fully cancelled). */
        grossStake: Number(row?.grossStake || 0),
        totalWinPayout: Number(row?.totalWinPayout || 0),
        placedAt: row?.placedAt || null,
      };
    });

    return res.json({
      success: true,
      data: {
        slot: {
          slotStartIso,
          dateFrom,
          dateTo,
          isDateRange: dateFrom !== dateTo,
          hasSlotFilter,
        },
        summary,
        tickets,
        pagination: { page, limit, hasMore },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/**
 * GET /admin/lottery2d/tickets/:ticketId/bets?slotStartIso=&userId=
 * Bet-line details for one ticket.
 */
export const getLottery2DTicketBets = async (req, res) => {
  try {
    const ticketId = String(req.params?.ticketId || '').trim();
    const slotStartIso = String(req.query?.slotStartIso || '').trim();
    const userId = String(req.query?.userId || '').trim();
    if (!ticketId) {
      return res.status(400).json({ success: false, message: 'ticketId is required.' });
    }
    if (!isValidISTSlotStartIso(slotStartIso)) {
      return res.status(400).json({ success: false, message: 'Valid slotStartIso is required.' });
    }

    const lotteryScopeFilter = await getLotteryScopeFilter(req);
    const match = {
      gameMode: GAME_MODE,
      ticketId,
      slotStartIso,
      ...lotteryScopeFilter,
    };
    if (mongoose.Types.ObjectId.isValid(userId)) {
      match.userId = new mongoose.Types.ObjectId(userId);
    }

    const bets = await QuizBet.find(match)
      .select('_id quizId number betMode amount status winPayout createdAt')
      .sort({ createdAt: 1, quizId: 1, number: 1 })
      .lean();

    const data = bets.map((bet) => ({
      betId: String(bet._id),
      quizId: Number(bet.quizId || 0),
      setLabel: getQuizLabelByQuizId2d(bet.quizId),
      number: String(bet.number ?? '').padStart(2, '0'),
      betMode: bet.betMode || 'str',
      amount: Number(bet.amount || 0),
      status: String(bet.status || '').toLowerCase(),
      winPayout: Number(bet.winPayout || 0),
      createdAt: bet.createdAt || null,
    }));

    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/**
 * GET /admin/lottery2d/players/:userId/history?limit=30
 */
export const getLottery2DPlayerHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid userId.' });
    }
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '30'), 10) || 30));
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const skip = (page - 1) * limit;
    const user = await User.findById(userId).select('username phone').lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'Player not found.' });
    }

    const slotStartRows = await QuizBet.aggregate([
      { $match: { gameMode: GAME_MODE, userId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: '$slotStartIso' } },
      { $sort: { _id: -1 } },
      { $skip: skip },
      { $limit: limit + 1 },
    ]);
    const hasMore = slotStartRows.length > limit;
    const slotStarts = slotStartRows.slice(0, limit).map((row) => row?._id).filter(Boolean);
    if (!slotStarts.length) {
      return res.json({
        success: true,
        data: {
          player: { userId, username: user.username || 'unknown', phone: user.phone || '' },
          summary: { totalBets: 0, totalStake: 0, totalPayout: 0, netProfitLoss: 0, wins: 0, losses: 0, pending: 0 },
          slots: [],
          pagination: { page, limit, hasMore },
        },
      });
    }

    const bets = await QuizBet.find({ gameMode: GAME_MODE, userId, slotStartIso: { $in: slotStarts } })
      .select('_id ticketId slotStartIso quizId number amount status winPayout createdAt')
      .sort({ slotStartIso: -1, createdAt: -1 })
      .lean();
    const picks = await QuizSlotPick.find({ gameMode: GAME_MODE, slotStartIso: { $in: slotStarts } })
      .select('slotStartIso quizId hintPosition')
      .lean();
    const winMultiplier = await getQuiz2DMultiplier();
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
        const pickMap = picksBySlot.get(bet.slotStartIso) || new Map();
        const winningQuizLabels = isCompleted
          ? [...pickMap.entries()]
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([quizId, hint]) => `Q${String(quizId).padStart(2, '0')}:${String(hint ?? '').padStart(2, '0')}`)
          : [];
        slotsMap.set(bet.slotStartIso, {
          slotStartIso: bet.slotStartIso,
          slotEndIso: new Date(slotEndMs).toISOString(),
          drawLabelEnd: formatDrawLabel(slotEndMs),
          isCompleted,
          winningQuizLabels,
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
            ticketId: bet.ticketId ? String(bet.ticketId) : null,
            quizId: bet.quizId,
            setLabel: getQuizLabelByQuizId2d(bet.quizId),
            number: String(bet.number).padStart(2, '0'),
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
          ticketId: bet.ticketId ? String(bet.ticketId) : null,
          quizId: bet.quizId,
          setLabel: getQuizLabelByQuizId2d(bet.quizId),
          number: String(bet.number).padStart(2, '0'),
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
      .map((iso) => slotsMap.get(iso))
      .filter(Boolean)
      .sort((a, b) => new Date(b.slotStartIso).getTime() - new Date(a.slotStartIso).getTime());

    return res.json({
      success: true,
      data: {
        player: { userId, username: user.username || 'unknown', phone: user.phone || '' },
        summary,
        slots,
        pagination: { page, limit, hasMore },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/**
 * GET /admin/lottery2d/aggregate-stats?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD (optional, IST calendar days)
 * When omitted: all-time 2D totals. When set: bets whose slot falls on those IST days (inclusive).
 */
export const getLottery2DAggregateStats = async (req, res) => {
  try {
    const lotteryScopeFilter = await getLotteryScopeFilter(req);
    const match = { gameMode: GAME_MODE, status: { $ne: 'cancelled' }, ...lotteryScopeFilter };

    const dateFromQ = typeof req.query.dateFrom === 'string' ? req.query.dateFrom.trim() : '';
    const dateToQ = typeof req.query.dateTo === 'string' ? req.query.dateTo.trim() : '';
    let filterMeta = { dateFrom: null, dateTo: null };

    if (dateFromQ || dateToQ) {
      if (!dateFromQ || !dateToQ) {
        return res.status(400).json({
          success: false,
          message: 'For a date range, both dateFrom and dateTo are required (IST YYYY-MM-DD).',
        });
      }
      if (!isValidISTDayKey(dateFromQ) || !isValidISTDayKey(dateToQ)) {
        return res.status(400).json({ success: false, message: 'Invalid date. Use YYYY-MM-DD (IST).' });
      }
      if (dateFromQ > dateToQ) {
        return res.status(400).json({ success: false, message: 'dateFrom must be on or before dateTo.' });
      }
      const rangeDays = istInclusiveDaySpan(dateFromQ, dateToQ);
      const MAX_RANGE_DAYS = 366;
      if (rangeDays > MAX_RANGE_DAYS) {
        return res.status(400).json({
          success: false,
          message: `Date range cannot exceed ${MAX_RANGE_DAYS} days (IST).`,
        });
      }
      const todayIst = istDayKey();
      if (dateFromQ > todayIst || dateToQ > todayIst) {
        return res.status(400).json({ success: false, message: 'Future IST dates are not allowed.' });
      }

      const slotIsos = listSlotStartIsoForISTDayRange(dateFromQ, dateToQ);
      if (!slotIsos.length) {
        return res.json({
          success: true,
          data: {
            total2DTickets: 0,
            totalBets: 0,
            totalStake: 0,
            totalPayout: 0,
            totalLoss: 0,
            adminNet: 0,
            uniqueUsers2D: 0,
            dateFrom: dateFromQ,
            dateTo: dateToQ,
          },
        });
      }
      match.slotStartIso = { $in: slotIsos };
      filterMeta = { dateFrom: dateFromQ, dateTo: dateToQ };
    }

    const rows = await QuizBet.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalBets: { $sum: 1 },
          totalStake: { $sum: '$amount' },
          totalPayout: { $sum: '$winPayout' },
          totalLoss: {
            $sum: {
              $cond: [{ $eq: ['$status', 'lose'] }, '$amount', 0],
            },
          },
          userIds: { $addToSet: '$userId' },
          ticketIds: { $addToSet: '$ticketId' },
        },
      },
      {
        $project: {
          _id: 0,
          total2DTickets: { $size: '$ticketIds' },
          totalBets: 1,
          totalStake: 1,
          totalPayout: 1,
          totalLoss: 1,
          adminNet: { $subtract: ['$totalStake', '$totalPayout'] },
          uniqueUsers2D: { $size: '$userIds' },
        },
      },
    ]);

    const row = rows[0] || {};
    const data = {
      total2DTickets: Number(row.total2DTickets || 0),
      totalBets: Number(row.totalBets || 0),
      totalStake: Number(row.totalStake || 0),
      totalPayout: Number(row.totalPayout || 0),
      totalLoss: Number(row.totalLoss || 0),
      adminNet: Number(row.adminNet || 0),
      uniqueUsers2D: Number(row.uniqueUsers2D || 0),
      dateFrom: filterMeta.dateFrom,
      dateTo: filterMeta.dateTo,
    };

    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export const getLottery2DCurrentSlot = async (req, res) => {
  try {
    const ctx = getSlotContext(new Date(), '2d');
    const slotStartIso = ctx.slotStartIso;
    const slotEndMs = ctx.slotEndMs;
    const lotteryScopeFilter = await getLotteryScopeFilter(req);

    const [bets, picks, winMultiplier] = await Promise.all([
      QuizBet.find({ gameMode: GAME_MODE, slotStartIso, ...lotteryScopeFilter })
        .select('ticketId quizId userId number amount status winPayout')
        .lean(),
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
    const ticketKeysByQuiz = new Map();
    for (const quizId of QUIZ_IDS) {
      quizUsers.set(quizId, new Set());
      quizWinnerUsers.set(quizId, new Set());
      ticketKeysByQuiz.set(quizId, new Set());
    }

    for (const bet of bets) {
      if (String(bet?.status || '').toLowerCase() === 'cancelled') {
        // eslint-disable-next-line no-continue
        continue;
      }
      const row = perQuiz.get(bet.quizId);
      if (!row) continue;
      row.betCount += 1;
      ticketKeysByQuiz.get(bet.quizId).add(quizBetTicketKey(bet));
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
      row.ticketCount = ticketKeysByQuiz.get(quizId).size;
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

export const getLottery2DCurrentSlotHints = async (req, res) => {
  try {
    const verification = await verifySecretDeclarePassword(req);
    if (!verification.success) {
      return res.status(verification.error.status).json(verification.error.body);
    }

    const ctx = getSlotContext(new Date(), '2d');
    const slotStartIso = ctx.slotStartIso;

    // Ensure all Q01-Q30 picks exist for the running slot so hints grid is fully populated.
    await Promise.all(QUIZ_IDS.map((quizId) => getOrCreatePick(quizId, slotStartIso, GAME_MODE)));

    const [picks] = await Promise.all([
      QuizSlotPick.find({ gameMode: GAME_MODE, slotStartIso }).select('quizId hintPosition').lean(),
    ]);

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

export const getLottery2DCurrentSlotTargetHints = async (req, res) => {
  try {
    const ctx = getSlotContext(new Date(), '2d');
    const slotStartIso = ctx.slotStartIso;
    const targetProfitPercent = Number(req.query?.targetProfitPercent);
    const targetPayload = await build2DTargetProfitHints(slotStartIso, targetProfitPercent);
    const declaration = await getSlotDeclarationState(slotStartIso, GAME_MODE, ctx.slotEndMs);

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
        declaration,
        winMultiplier: targetPayload.winMultiplier,
        targetProfitPercent: targetPayload.targetProfitPercent,
        perQuiz: targetPayload.perQuiz,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export const configureLottery2DCurrentSlotTargetAutoDeclare = async (req, res) => {
  try {
    if (req.admin?.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Super admin access required.' });
    }
    const mode = String(req.body?.mode || 'target').trim().toLowerCase();
    const targetProfitPercentRaw = Number(req.body?.targetProfitPercent);
    const hasTargetPercent = Number.isFinite(targetProfitPercentRaw);
    if (mode !== 'random' && !hasTargetPercent) {
      return res.status(400).json({ success: false, message: 'targetProfitPercent is required.' });
    }
    const targetProfitPercent = hasTargetPercent
      ? Math.min(1000, Math.max(-100, targetProfitPercentRaw))
      : null;
    const ctx = getSlotContext(new Date(), '2d');
    const slotStartIso = ctx.slotStartIso;
    const slotEndMs = ctx.slotEndMs;
    if (Date.now() >= slotEndMs) {
      return res.status(400).json({ success: false, message: 'Current slot already ended. Try next running slot.' });
    }
    if (mode === 'random') {
      await setSlotTargetProfitPercent(slotStartIso, GAME_MODE, null, req.admin?._id);
    } else {
      await setSlotTargetProfitPercent(slotStartIso, GAME_MODE, targetProfitPercent, req.admin?._id);
    }
    const declaration = await getSlotDeclarationState(slotStartIso, GAME_MODE, slotEndMs);
    const effectiveTarget = mode === 'random' ? null : targetProfitPercent;
    return res.json({
      success: true,
      message: mode === 'random'
        ? 'Switched to random auto declare for current running slot.'
        : `Target auto declare armed for running slot at ${targetProfitPercent}%`,
      data: {
        slot: {
          slotStartIso,
          slotEndIso: new Date(slotEndMs).toISOString(),
          drawLabelEnd: formatDrawLabel(slotEndMs),
          phase: ctx.phase,
          istDayKey: ctx.istDayKey,
        },
        declaration: {
          ...declaration,
          targetProfitPercent: effectiveTarget,
        },
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
    const lotteryScopeFilter = await getLotteryScopeFilter(req);

    const [bets, picks, winMultiplier] = await Promise.all([
      QuizBet.find({ gameMode: GAME_MODE, slotStartIso: { $in: completedSlots }, ...lotteryScopeFilter })
        .select('slotStartIso ticketId quizId userId number amount status winPayout')
        .lean(),
      QuizSlotPick.find({ gameMode: GAME_MODE, slotStartIso: { $in: completedSlots } }).select('slotStartIso quizId hintPosition').lean(),
      getQuiz2DMultiplier(),
    ]);

    const picksBySlot = new Map();
    for (const p of picks) {
      if (!picksBySlot.has(p.slotStartIso)) picksBySlot.set(p.slotStartIso, new Map());
      picksBySlot.get(p.slotStartIso).set(p.quizId, p.hintPosition);
    }
    const snapshotBySlot = await ensureDeclaredResultsSnapshots(completedSlots, GAME_MODE);
    const resolvedPicksBySlot = new Map();
    for (const slotIso of completedSlots) {
      const base = new Map(picksBySlot.get(slotIso) || []);
      const snapshot = snapshotBySlot.get(slotIso) || new Map();
      for (const [quizId, result] of snapshot.entries()) {
        base.set(quizId, result);
      }
      resolvedPicksBySlot.set(slotIso, base);
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
        resolvedPicksBySlot.get(slotStartIso) || new Map(),
        winMultiplier,
      );
    });

    return res.json({ success: true, data: { date, slots } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/**
 * GET /admin/lottery2d/day-slot-schedule?date=YYYY-MM-DD
 * All 15-minute IST slots for a calendar day (past ended, live, upcoming) so admins can
 * inspect players for historical draws, the active draw, or advance bets on later draws.
 */
export const getLottery2DDaySlotSchedule = async (req, res) => {
  try {
    const date = typeof req.query.date === 'string' ? req.query.date.trim() : istDayKey();
    if (!isValidISTDayKey(date)) {
      return res.status(400).json({ success: false, message: 'Invalid date. Use YYYY-MM-DD (IST).' });
    }
    const today = istDayKey();
    if (date > today) {
      return res.status(400).json({ success: false, message: 'Future date is not allowed.' });
    }

    const now = Date.now();
    const ctx = getSlotContext(new Date(), '2d');
    const all = listSlotStartIsoForISTDay(date).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    const slots = all.map((slotStartIso) => {
      const slotStartMs = new Date(slotStartIso).getTime();
      const slotEndMs = slotStartMs + SLOT_MS;
      let status = 'upcoming';
      if (now >= slotEndMs) status = 'past';
      else if (now >= slotStartMs) status = 'live';
      return {
        slotStartIso,
        slotEndIso: new Date(slotEndMs).toISOString(),
        drawLabelEnd: formatDrawLabel(slotEndMs),
        status,
        isLive: slotStartIso === ctx.slotStartIso,
      };
    });

    return res.json({ success: true, data: { date, slots } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export const getLottery2DDeclarationMatrix = async (req, res) => {
  try {
    const date = typeof req.query.date === 'string' ? req.query.date.trim() : istDayKey();
    if (!isValidISTDayKey(date)) {
      return res.status(400).json({ success: false, message: 'Invalid date. Use YYYY-MM-DD (IST).' });
    }
    const today = istDayKey();
    if (date > today) {
      return res.status(400).json({ success: false, message: 'Future date is not allowed.' });
    }
    const limit = Math.min(96, Math.max(1, parseInt(String(req.query.limit || '96'), 10) || 96));

    const slotStartIsos = listSlotStartIsoForISTDay(date)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .slice(0, limit);

    if (!slotStartIsos.length) {
      return res.json({ success: true, data: { date, slots: [] } });
    }

    const [picks, declarations] = await Promise.all([
      QuizSlotPick.find({ gameMode: GAME_MODE, slotStartIso: { $in: slotStartIsos } })
        .select('slotStartIso quizId hintPosition')
        .lean(),
      QuizSlotDeclaration.find({ gameMode: GAME_MODE, slotStartIso: { $in: slotStartIsos } })
        .select('slotStartIso autoDeclareBlocked declaredAt declaredResults')
        .lean(),
    ]);

    const picksBySlot = new Map();
    for (const p of picks) {
      if (!picksBySlot.has(p.slotStartIso)) picksBySlot.set(p.slotStartIso, new Map());
      picksBySlot.get(p.slotStartIso).set(p.quizId, p.hintPosition);
    }
    const declarationBySlot = new Map(declarations.map((d) => [d.slotStartIso, d]));
    const snapshotBySlot = await ensureDeclaredResultsSnapshots(slotStartIsos, GAME_MODE);

    const slots = slotStartIsos.map((slotStartIso) => {
      const slotStartMs = new Date(slotStartIso).getTime();
      const slotEndMs = slotStartMs + SLOT_MS;
      const slotEnded = Date.now() >= slotEndMs;
      const row = declarationBySlot.get(slotStartIso);
      const declaration = {
        autoDeclareBlocked: Boolean(row?.autoDeclareBlocked) && !row?.declaredAt,
        declared: Boolean(row?.declaredAt),
        declaredAt: row?.declaredAt || null,
      };
      const byQuiz = picksBySlot.get(slotStartIso) || new Map();
      const declaredByQuiz = snapshotBySlot.get(slotStartIso) || new Map();
      const perQuiz = QUIZ_IDS.map((quizId) => {
        const result = declaredByQuiz.has(quizId) ? declaredByQuiz.get(quizId) : byQuiz.get(quizId);
        return {
          quizId,
          result: Number.isInteger(result) ? result : null,
          resultLabel: Number.isInteger(result) ? String(result).padStart(2, '0') : '--',
          declared: declaration.declared,
        };
      });
      return {
        slotStartIso,
        slotEndIso: new Date(slotEndMs).toISOString(),
        drawLabelEnd: formatDrawLabel(slotEndMs),
        isCompleted: slotEnded,
        declaration,
        perQuiz,
      };
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
      QuizBet.find({ gameMode: GAME_MODE, slotStartIso })
        .select('ticketId quizId userId number amount status winPayout')
        .lean(),
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
    const stakeOnHintByQuiz = new Map(QUIZ_IDS.map((q) => [q, 0]));
    const ticketKeysByQuiz = new Map();
    for (const quizId of QUIZ_IDS) {
      usersByQuiz.set(quizId, new Set());
      winnerUsersByQuiz.set(quizId, new Set());
      ticketKeysByQuiz.set(quizId, new Set());
    }

    for (const bet of bets) {
      if (String(bet?.status || '').toLowerCase() === 'cancelled') {
        // eslint-disable-next-line no-continue
        continue;
      }
      const row = perQuiz.get(bet.quizId);
      if (!row) continue;
      row.betCount += 1;
      ticketKeysByQuiz.get(bet.quizId).add(quizBetTicketKey(bet));
      row.totalBetAmount += Number(bet.amount || 0);
      if (bet.userId) usersByQuiz.get(bet.quizId).add(String(bet.userId));

      const hp = pickByQuiz.get(bet.quizId);
      if (Number.isInteger(hp) && hp === bet.number) {
        stakeOnHintByQuiz.set(
          bet.quizId,
          (stakeOnHintByQuiz.get(bet.quizId) || 0) + Number(bet.amount || 0),
        );
        row.winnerTickets += 1;
        if (bet.userId) winnerUsersByQuiz.get(bet.quizId).add(String(bet.userId));
      }
    }

    for (const quizId of QUIZ_IDS) {
      const row = perQuiz.get(quizId);
      row.ticketCount = ticketKeysByQuiz.get(quizId).size;
      row.uniqueUsers = usersByQuiz.get(quizId).size;
      row.winnerUsers = winnerUsersByQuiz.get(quizId).size;
      const hp = pickByQuiz.get(quizId);
      const totalStake = Number(row.totalBetAmount || 0);
      if (!Number.isInteger(hp)) {
        row.houseNetIfHintWins = null;
      } else {
        const stakeOnHint = stakeOnHintByQuiz.get(quizId) || 0;
        const payoutIfHintWins = Math.round(stakeOnHint * winMultiplier);
        row.houseNetIfHintWins = totalStake - payoutIfHintWins;
      }
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

    if (req.admin?.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Super admin access required.' });
    }

    if (!isValidISTSlotStartIso(slotStartIso)) {
      return res.status(400).json({ success: false, message: 'Invalid slotStartIso.' });
    }
    if (!Number.isInteger(quizId) || quizId < 1 || quizId > 30) {
      return res.status(400).json({ success: false, message: 'quizId must be between 1 and 30.' });
    }
    if (!Number.isInteger(result) || result < 0 || result > 99) {
      return res.status(400).json({ success: false, message: 'result must be between 00 and 99.' });
    }

    const slotEndMs = new Date(slotStartIso).getTime() + SLOT_MS;
    const declarationState = await getSlotDeclarationState(slotStartIso, GAME_MODE, slotEndMs);
    if (declarationState?.declared) {
      return res.status(400).json({
        success: false,
        message: 'This slot is already declared. Manual result update is not allowed.',
      });
    }

    const ctx = getSlotContext(new Date(), '2d');
    const isCurrentRunningSlot = slotStartIso === ctx.slotStartIso && Date.now() < ctx.slotEndMs;
    const isBeforeHintReveal = ctx.phase === 'study';
    if (!isCurrentRunningSlot || !isBeforeHintReveal) {
      return res.status(400).json({
        success: false,
        message: 'Manual result update is allowed only for the current slot before hint questions are visible.',
      });
    }

    const existingPick = await getOrCreatePick(quizId, slotStartIso, GAME_MODE);
    const quiz = await Quiz.findOne({ gameMode: GAME_MODE, quizId }).select('questions').lean();
    const canBuildShuffledQuestion = Array.isArray(quiz?.questions) && quiz.questions.length === 100 && existingPick?.seedHex;
    let chosenIndex = null;
    let hintQuestionText = null;
    if (canBuildShuffledQuestion) {
      const order = await getShuffleOrderIndices(quizId, slotStartIso, existingPick.seedHex, GAME_MODE, 100);
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
 * GET /admin/lottery2d/quizzes/:quizId/stake-by-number?slotStartIso=...
 * Per-number stakes for one quiz in a slot; house net if that number wins (pool − payout).
 */
export const getLottery2DQuizStakeByNumber = async (req, res) => {
  try {
    const quizId = Number(req.params.quizId);
    const slotStartIso = typeof req.query.slotStartIso === 'string' ? req.query.slotStartIso.trim() : '';
    if (!Number.isInteger(quizId) || quizId < 1 || quizId > 30) {
      return res.status(400).json({ success: false, message: 'quizId must be between 1 and 30.' });
    }
    if (!isValidISTSlotStartIso(slotStartIso)) {
      return res.status(400).json({ success: false, message: 'Valid slotStartIso query parameter is required.' });
    }

    const slotStartMs = new Date(slotStartIso).getTime();
    const slotEndMs = slotStartMs + SLOT_MS;

    const [bets, pick, winMultiplier] = await Promise.all([
      QuizBet.find({ gameMode: GAME_MODE, slotStartIso, quizId }).select('number amount status').lean(),
      QuizSlotPick.findOne({ gameMode: GAME_MODE, slotStartIso, quizId }).select('hintPosition').lean(),
      getQuiz2DMultiplier(),
    ]);

    const stakeByNumber = new Map();
    const ticketCountByNumber = new Map();
    let totalStake = 0;
    let totalTickets = 0;

    for (const bet of bets) {
      if (String(bet?.status || '').toLowerCase() === 'cancelled') {
        // eslint-disable-next-line no-continue
        continue;
      }
      const n = Number(bet.number);
      if (!Number.isInteger(n) || n < 0 || n > 99) continue;
      const amt = Number(bet.amount || 0);
      totalStake += amt;
      totalTickets += 1;
      stakeByNumber.set(n, (stakeByNumber.get(n) || 0) + amt);
      ticketCountByNumber.set(n, (ticketCountByNumber.get(n) || 0) + 1);
    }

    const rows = [];
    let uniqueNumbersWithBets = 0;
    for (let num = 0; num <= 99; num += 1) {
      const stake = stakeByNumber.get(num) || 0;
      const tickets = ticketCountByNumber.get(num) || 0;
      if (stake > 0) uniqueNumbersWithBets += 1;
      const payoutIfWin = Math.round(stake * winMultiplier);
      const houseNetIfWins = totalStake - payoutIfWin;
      rows.push({
        number: num,
        numberLabel: String(num).padStart(2, '0'),
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

export const updateLottery2DSlotDeclaration = async (req, res) => {
  try {
    if (req.admin?.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Super admin access required.' });
    }
    const slotStartIso = String(req.body?.slotStartIso || '').trim() || getSlotContext(new Date(), '2d').slotStartIso;
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
      const targetProfitPercent = getDeclaredTargetPercentForHintApply(existingDeclaration);
      if (targetProfitPercent != null) {
        await apply2DTargetProfitHintsToSlot(slotStartIso, targetProfitPercent);
      }
      await markSlotDeclared(slotStartIso, GAME_MODE, req.admin?._id, { force: true, captureResults: true });
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
