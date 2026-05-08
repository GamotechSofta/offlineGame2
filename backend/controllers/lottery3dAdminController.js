import mongoose from 'mongoose';
import QuizBet from '../models/quiz/QuizBet.js';
import QuizSlotPick from '../models/quiz/QuizSlotPick.js';
import QuizSlotDeclaration from '../models/quiz/QuizSlotDeclaration.js';
import User from '../models/user/user.js';
import { getRatesMap } from '../models/rate/rate.js';
import { evaluate3DBetAgainstResult, resolve3DPayoutMultiplier } from '../services/quiz3dPayoutHelpers.js';
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
import { ensure3DQuizQuestionBank } from '../services/quizQuestionBankService.js';
import {
  blockAutoDeclare,
  enableAutoDeclare,
  ensureDeclaredResultsSnapshots,
  getDeclaredTargetPercentForHintApply,
  getSlotDeclarationState,
  markSlotDeclared,
  setSlotTargetProfitPercent,
} from '../services/quizDeclarationService.js';
import { getQuizSocketIo, syncQuizSlotUpdates } from '../socket/socketHub.js';
import { settleQuizBetsForSlot } from '../services/quizBetSettlement.js';
import { getBookieUserIds } from '../utils/bookieFilter.js';
import { apply3DTargetProfitHintsToSlot, build3DTargetProfitHints } from '../services/quizTargetProfitService.js';
import { invalidateAdminReadCaches } from '../services/cacheInvalidationService.js';
import { cacheGet, cacheSet } from '../services/cacheService.js';

const QUIZ_IDS = [1, 2, 3];
const GAME_MODE = '3d';
const CURRENT_SLOT_CACHE_TTL_SECONDS = 3;
const CURRENT_SLOT_INFLIGHT = new Map();

async function getLotteryScopeFilter(req) {
  const bookieUserIds = await getBookieUserIds(req.admin);
  if (bookieUserIds === null) return {};
  return { userId: { $in: bookieUserIds } };
}

function lotteryScopeKey(req, lotteryScopeFilter) {
  if (!lotteryScopeFilter?.userId?.$in) return `admin:${String(req.admin?._id || 'root')}:all`;
  return `admin:${String(req.admin?._id || 'root')}:scoped`;
}

function currentSlotCacheKey(req, slotStartIso, lotteryScopeFilter) {
  return `lottery3d:current-slot:${lotteryScopeKey(req, lotteryScopeFilter)}:${slotStartIso}`;
}

function computedWin3d(bet, hintPosition) {
  return evaluate3DBetAgainstResult(bet.betMode || 'str', bet.number, hintPosition).matched;
}

function payoutUnsettledWin3d(bet, hintPosition, ratesMap) {
  const ev = evaluate3DBetAgainstResult(bet.betMode || 'str', bet.number, hintPosition);
  if (!ev.matched) return 0;
  const mult = resolve3DPayoutMultiplier(ratesMap, bet.betMode || 'str', bet.number, ev);
  return Math.round(Number(bet.amount || 0) * mult);
}

function quizBetTicketKey(bet) {
  const tid = bet.ticketId ? String(bet.ticketId).trim() : '';
  return tid || `legacy:${String(bet._id)}`;
}

async function ensureRandomHintsForCurrentSlot(slotStartIso) {
  // Ensure all slot picks exist first (Q01-Q03).
  await Promise.all(QUIZ_IDS.map((quizId) => getOrCreatePick(quizId, slotStartIso, GAME_MODE)));
  const picks = await QuizSlotPick.find({ gameMode: GAME_MODE, slotStartIso })
    .select('quizId seedHex chosenIndex hintPosition')
    .lean();

  const updates = await Promise.all(
    picks.map(async (pick) => {
      const quizId = Number(pick?.quizId);
      if (!QUIZ_IDS.includes(quizId)) return null;
      if (!pick?.seedHex || !Number.isInteger(pick?.chosenIndex)) return null;
      const order = await getShuffleOrderIndices(quizId, slotStartIso, pick.seedHex, GAME_MODE, 1000);
      const randomHintPosition = order.indexOf(pick.chosenIndex);
      if (!Number.isInteger(randomHintPosition) || randomHintPosition < 0 || randomHintPosition > 999) return null;
      if (pick.hintPosition === randomHintPosition) return null;
      return QuizSlotPick.updateOne(
        { gameMode: GAME_MODE, slotStartIso, quizId },
        { $set: { hintPosition: randomHintPosition } },
      );
    }),
  );

  await Promise.all(updates.filter(Boolean));
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

function toSlotSummary(slotStartIso, slotEndMs, bets, picksByQuiz, ratesMap) {
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
    const isWinByComputed = Number.isInteger(hp) && computedWin3d(bet, hp);
    if (isWinByStored || isWinByComputed) {
      winnerTickets += 1;
      if (bet.userId) winnerUsers.add(String(bet.userId));
      winnerPayout += explicitPayout > 0
        ? explicitPayout
        : payoutUnsettledWin3d(bet, hp, ratesMap);
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

async function buildLottery3DCurrentSlotPayload(ctx, lotteryScopeFilter) {
  const slotStartIso = ctx.slotStartIso;
  const slotEndMs = ctx.slotEndMs;
  const [bets, picks, ratesMap] = await Promise.all([
    QuizBet.find({ gameMode: GAME_MODE, slotStartIso, ...lotteryScopeFilter })
      .select('ticketId quizId userId number amount status winPayout betMode')
      .lean(),
    QuizSlotPick.find({ gameMode: GAME_MODE, slotStartIso }).select('quizId hintPosition').lean(),
    getRatesMap(),
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
    if (Number.isInteger(hp) && computedWin3d(bet, hp)) {
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

  const slotSummary = toSlotSummary(slotStartIso, slotEndMs, bets, pickByQuiz, ratesMap);
  const declaration = await getSlotDeclarationState(slotStartIso, GAME_MODE, slotEndMs);
  return {
    slot: {
      slotStartIso,
      slotEndIso: new Date(slotEndMs).toISOString(),
      drawLabelEnd: formatDrawLabel(slotEndMs),
      phase: ctx.phase,
      istDayKey: ctx.istDayKey,
      declaration,
    },
    summary: slotSummary,
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

function getOutcomeAndPayout({ isCompleted, pickByQuiz, bet, ratesMap }) {
  if (String(bet?.status || '').toLowerCase() === 'cancelled') {
    return { outcome: 'cancelled', payout: 0, net: 0 };
  }
  if (!isCompleted) {
    return { outcome: 'pending', payout: 0, net: -Number(bet.amount || 0) };
  }
  const explicitStatus = String(bet?.status || '').toLowerCase();
  const explicitPayout = Number(bet?.winPayout || 0);
  if (explicitStatus === 'win') {
    const hp = pickByQuiz.get(bet.quizId);
    const payout = explicitPayout > 0
      ? explicitPayout
      : (Number.isInteger(hp) ? payoutUnsettledWin3d(bet, hp, ratesMap) : 0);
    return { outcome: 'win', payout, net: payout - Number(bet.amount || 0) };
  }
  if (explicitStatus === 'lose') {
    return { outcome: 'lose', payout: 0, net: -Number(bet.amount || 0) };
  }
  const hp = pickByQuiz.get(bet.quizId);
  const won = Number.isInteger(hp) && computedWin3d(bet, hp);
  if (!won) {
    return { outcome: 'lose', payout: 0, net: -Number(bet.amount || 0) };
  }
  const payout = explicitPayout > 0 ? explicitPayout : payoutUnsettledWin3d(bet, hp, ratesMap);
  return { outcome: 'win', payout, net: payout - Number(bet.amount || 0) };
}

async function buildPlayersForSlot(slotStartIso, { includeBets = false } = {}) {
  const slotStartMs = new Date(slotStartIso).getTime();
  const slotEndMs = slotStartMs + SLOT_MS;
  const isCompleted = Date.now() >= slotEndMs;
  const [bets, picks, ratesMap] = await Promise.all([
    QuizBet.find({ gameMode: GAME_MODE, slotStartIso })
      .select('_id userId quizId number amount status winPayout betMode createdAt')
      .sort({ createdAt: -1 })
      .lean(),
    QuizSlotPick.find({ gameMode: GAME_MODE, slotStartIso })
      .select('quizId hintPosition')
      .lean(),
    getRatesMap(),
  ]);

  const userIds = Array.from(new Set(bets.map((b) => String(b.userId || '')).filter(Boolean)));
  const users = await User.find({ _id: { $in: userIds } }).select('username phone').lean();
  const userById = new Map(users.map((u) => [String(u._id), u]));
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
        ...(includeBets ? { bets: [] } : {}),
      });
    }
    const row = playerMap.get(userId);
    const amount = Number(bet.amount || 0);
    const result = getOutcomeAndPayout({ isCompleted, pickByQuiz, bet, ratesMap });
    row.betCount += 1;
    if (result.outcome === 'cancelled') {
      if (includeBets) {
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
      }
      // eslint-disable-next-line no-continue
      continue;
    }
    row.totalStake += amount;
    row.totalPayout += result.payout;
    row.netProfitLoss += result.net;
    if (result.outcome === 'win') row.wins += 1;
    else if (result.outcome === 'lose') row.losses += 1;
    else row.pending += 1;
    if (includeBets) {
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
  }

  for (const [, row] of playerMap.entries()) {
    row.totalBetCountAllTime = Number(row.betCount || 0);
    row.totalStakeAllTime = Number(row.totalStake || 0);
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
async function buildPlayersForISTDateRange(dateFrom, dateTo, { includeBets = false } = {}) {
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

  const [bets, picks, ratesMap] = await Promise.all([
    QuizBet.find({ gameMode: GAME_MODE, slotStartIso: { $in: slotList } })
      .select('_id userId quizId number amount status winPayout betMode createdAt slotStartIso')
      .sort({ createdAt: -1 })
      .lean(),
    QuizSlotPick.find({ gameMode: GAME_MODE, slotStartIso: { $in: slotList } })
      .select('slotStartIso quizId hintPosition')
      .lean(),
    getRatesMap(),
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
        ...(includeBets ? { bets: [] } : {}),
      });
    }
    const row = playerMap.get(userId);
    const amount = Number(bet.amount || 0);
    const result = getOutcomeAndPayout({ isCompleted, pickByQuiz, bet, ratesMap });
    row.betCount += 1;
    if (result.outcome === 'cancelled') {
      if (includeBets) {
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
      }
      // eslint-disable-next-line no-continue
      continue;
    }
    row.totalStake += amount;
    row.totalPayout += result.payout;
    row.netProfitLoss += result.net;
    if (result.outcome === 'win') row.wins += 1;
    else if (result.outcome === 'lose') row.losses += 1;
    else row.pending += 1;
    if (includeBets) {
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
  }

  for (const [, row] of playerMap.entries()) {
    row.totalBetCountAllTime = Number(row.betCount || 0);
    row.totalStakeAllTime = Number(row.totalStake || 0);
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
 * GET /admin/lottery3d/day-players?date= (legacy single day) or ?dateFrom=&dateTo=
 */
export const getLottery3DDayPlayers = async (req, res) => {
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
 * GET /admin/lottery3d/aggregate-stats?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD (optional, IST calendar days)
 * When omitted: all-time 3D totals. When set: bets whose slot falls on those IST days (inclusive).
 */
export const getLottery3DAggregateStats = async (req, res) => {
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
            total3DTickets: 0,
            totalBets: 0,
            totalStake: 0,
            totalPayout: 0,
            totalLoss: 0,
            adminNet: 0,
            uniqueUsers3D: 0,
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
              $cond: [{ $eq: ['$status', 'lost'] }, '$amount', 0],
            },
          },
          userIds: { $addToSet: '$userId' },
          ticketIds: { $addToSet: '$ticketId' },
        },
      },
      {
        $project: {
          _id: 0,
          total3DTickets: { $size: '$ticketIds' },
          totalBets: 1,
          totalStake: 1,
          totalPayout: 1,
          totalLoss: 1,
          adminNet: { $subtract: ['$totalStake', '$totalPayout'] },
          uniqueUsers3D: { $size: '$userIds' },
        },
      },
    ]);

    const row = rows[0] || {};
    const data = {
      total3DTickets: Number(row.total3DTickets || 0),
      totalBets: Number(row.totalBets || 0),
      totalStake: Number(row.totalStake || 0),
      totalPayout: Number(row.totalPayout || 0),
      totalLoss: Number(row.totalLoss || 0),
      adminNet: Number(row.adminNet || 0),
      uniqueUsers3D: Number(row.uniqueUsers3D || 0),
      dateFrom: filterMeta.dateFrom,
      dateTo: filterMeta.dateTo,
    };

    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export const getLottery3DCurrentSlot = async (req, res) => {
  try {
    const ctx = getSlotContext(new Date(), '3d');
    const slotStartIso = ctx.slotStartIso;
    const lotteryScopeFilter = await getLotteryScopeFilter(req);
    const cacheKey = currentSlotCacheKey(req, slotStartIso, lotteryScopeFilter);
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached, cached: true });
    }

    const inFlight = CURRENT_SLOT_INFLIGHT.get(cacheKey);
    if (inFlight) {
      const payload = await inFlight;
      return res.json({ success: true, data: payload, deduped: true });
    }

    const computePromise = (async () => {
      const payload = await buildLottery3DCurrentSlotPayload(ctx, lotteryScopeFilter);
      await cacheSet(cacheKey, payload, CURRENT_SLOT_CACHE_TTL_SECONDS);
      return payload;
    })();
    CURRENT_SLOT_INFLIGHT.set(cacheKey, computePromise);
    try {
      const payload = await computePromise;
      return res.json({ success: true, data: payload });
    } finally {
      CURRENT_SLOT_INFLIGHT.delete(cacheKey);
    }
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

export const getLottery3DCurrentSlotTargetHints = async (req, res) => {
  try {
    const ctx = getSlotContext(new Date(), '3d');
    const slotStartIso = ctx.slotStartIso;
    const targetProfitPercent = Number(req.query?.targetProfitPercent);
    const targetPayload = await build3DTargetProfitHints(slotStartIso, targetProfitPercent);
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
        targetProfitPercent: targetPayload.targetProfitPercent,
        perQuiz: targetPayload.perQuiz,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export const configureLottery3DCurrentSlotTargetAutoDeclare = async (req, res) => {
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
    const ctx = getSlotContext(new Date(), '3d');
    const slotStartIso = ctx.slotStartIso;
    const slotEndMs = ctx.slotEndMs;
    if (Date.now() >= slotEndMs) {
      return res.status(400).json({ success: false, message: 'Current slot already ended. Try next running slot.' });
    }
    if (mode === 'random') {
      // Random mode: clear target and restore pure random slot hints/results.
      await setSlotTargetProfitPercent(slotStartIso, GAME_MODE, null, req.admin?._id);
      const io = getQuizSocketIo();
      if (io) {
        io.emit('quiz:auto-declare-mode', {
          gameMode: GAME_MODE,
          slotStartIso,
          mode: 'random',
          targetProfitPercent: null,
        });
      }
      await ensureRandomHintsForCurrentSlot(slotStartIso);
    } else {
      // Target mode: clear random influence by overriding slot hints with target-driven picks.
      await setSlotTargetProfitPercent(slotStartIso, GAME_MODE, targetProfitPercent, req.admin?._id);
      const io = getQuizSocketIo();
      if (io) {
        io.emit('quiz:auto-declare-mode', {
          gameMode: GAME_MODE,
          slotStartIso,
          mode: 'target',
          targetProfitPercent,
        });
      }
      await Promise.all(QUIZ_IDS.map((quizId) => getOrCreatePick(quizId, slotStartIso, GAME_MODE)));
      await apply3DTargetProfitHintsToSlot(slotStartIso, targetProfitPercent);
    }
    await invalidateAdminReadCaches('lottery3d_auto_declare_configured');
    syncQuizSlotUpdates();
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
    const lotteryScopeFilter = await getLotteryScopeFilter(req);

    const [bets, picks, ratesMap] = await Promise.all([
      QuizBet.find({ gameMode: GAME_MODE, slotStartIso: { $in: daySlots }, ...lotteryScopeFilter }).select('slotStartIso quizId userId number amount status winPayout betMode').lean(),
      QuizSlotPick.find({ gameMode: GAME_MODE, slotStartIso: { $in: daySlots } }).select('slotStartIso quizId hintPosition').lean(),
      getRatesMap(),
    ]);

    const picksBySlot = new Map();
    for (const p of picks) {
      if (!picksBySlot.has(p.slotStartIso)) picksBySlot.set(p.slotStartIso, new Map());
      picksBySlot.get(p.slotStartIso).set(p.quizId, p.hintPosition);
    }
    const snapshotBySlot = await ensureDeclaredResultsSnapshots(daySlots, GAME_MODE);
    const resolvedPicksBySlot = new Map();
    for (const slotIso of daySlots) {
      const base = new Map(picksBySlot.get(slotIso) || []);
      const snapshot = snapshotBySlot.get(slotIso) || new Map();
      for (const [quizId, result] of snapshot.entries()) {
        base.set(quizId, result);
      }
      resolvedPicksBySlot.set(slotIso, base);
    }

    const betsBySlot = new Map();
    for (const slotIso of daySlots) betsBySlot.set(slotIso, []);
    for (const b of bets) {
      if (!betsBySlot.has(b.slotStartIso)) betsBySlot.set(b.slotStartIso, []);
      betsBySlot.get(b.slotStartIso).push(b);
    }

    const quizStatsBySlot = new Map();
    for (const slotIso of daySlots) {
      const perQuizMap = new Map();
      QUIZ_IDS.forEach((quizId) => {
        perQuizMap.set(quizId, { totalStake: 0, payoutIfHintWins: 0 });
      });
      quizStatsBySlot.set(slotIso, perQuizMap);
    }

    for (const bet of bets) {
      if (String(bet?.status || '').toLowerCase() === 'cancelled') continue;
      const slotIso = String(bet.slotStartIso || '');
      const perQuizMap = quizStatsBySlot.get(slotIso);
      if (!perQuizMap) continue;
      const quizId = Number(bet.quizId);
      const row = perQuizMap.get(quizId);
      if (!row) continue;
      const amount = Number(bet.amount || 0);
      row.totalStake += amount;
      const hp = resolvedPicksBySlot.get(slotIso)?.get(quizId);
      if (Number.isInteger(hp) && computedWin3d(bet, hp)) {
        row.payoutIfHintWins += payoutUnsettledWin3d(bet, hp, ratesMap);
      }
    }

    const slotsBase = daySlots.map((slotStartIso) => {
      const slotEndMs = new Date(slotStartIso).getTime() + SLOT_MS;
      return toSlotSummary(
        slotStartIso,
        slotEndMs,
        betsBySlot.get(slotStartIso) || [],
        resolvedPicksBySlot.get(slotStartIso) || new Map(),
        ratesMap,
      );
    });
    const slots = await Promise.all(
      slotsBase.map(async (slot) => {
        const slotStartIso = slot.slotStartIso;
        const slotEndMs = new Date(slotStartIso).getTime() + SLOT_MS;
        const declaration = await getSlotDeclarationState(slotStartIso, GAME_MODE, slotEndMs);
        const pickByQuiz = resolvedPicksBySlot.get(slotStartIso) || new Map();
        const perQuizStats = quizStatsBySlot.get(slotStartIso) || new Map();
        const perQuiz = QUIZ_IDS.map((quizId) => {
          const result = pickByQuiz.get(quizId);
          const stat = perQuizStats.get(quizId) || { totalStake: 0, payoutIfHintWins: 0 };
          const hasHint = Number.isInteger(result);
          return {
            quizId,
            result: Number.isInteger(result) ? result : null,
            resultLabel: Number.isInteger(result) ? String(result).padStart(3, '0') : '--',
            declared: Boolean(declaration?.declared),
            houseNetIfHintWins: hasHint ? Number(stat.totalStake || 0) - Number(stat.payoutIfHintWins || 0) : null,
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

/**
 * GET /admin/lottery3d/day-slot-schedule?date=YYYY-MM-DD
 * IST day schedule for 3D (same 15-minute grid as 2D); used to pick live or advance slots for player lists.
 */
export const getLottery3DDaySlotSchedule = async (req, res) => {
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
    const ctx = getSlotContext(new Date(), '3d');
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

export const getLottery3DSlotDetail = async (req, res) => {
  try {
    const { slotStartIso } = req.params;
    if (!isValidISTSlotStartIso(slotStartIso)) {
      return res.status(400).json({ success: false, message: 'Invalid slotStartIso.' });
    }

    const [bets, picks, ratesMap] = await Promise.all([
      QuizBet.find({ gameMode: GAME_MODE, slotStartIso })
        .select('ticketId quizId userId number amount status winPayout betMode')
        .lean(),
      QuizSlotPick.find({ gameMode: GAME_MODE, slotStartIso }).select('quizId hintPosition').lean(),
      getRatesMap(),
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
    const payoutIfHintWinByQuiz = new Map(QUIZ_IDS.map((q) => [q, 0]));
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
      if (Number.isInteger(hp) && computedWin3d(bet, hp)) {
        payoutIfHintWinByQuiz.set(
          bet.quizId,
          (payoutIfHintWinByQuiz.get(bet.quizId) || 0) + payoutUnsettledWin3d(bet, hp, ratesMap),
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
        const payoutIfHintWins = payoutIfHintWinByQuiz.get(quizId) || 0;
        row.houseNetIfHintWins = totalStake - payoutIfHintWins;
      }
    }

    const slotEndMs = new Date(slotStartIso).getTime() + SLOT_MS;
    const summary = toSlotSummary(slotStartIso, slotEndMs, bets, pickByQuiz, ratesMap);
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
    const includeBets = String(req.query?.includeBets || '').trim() === '1';
    if (!isValidISTSlotStartIso(slotStartIso)) {
      return res.status(400).json({ success: false, message: 'Invalid slotStartIso.' });
    }
    const data = await buildPlayersForSlot(slotStartIso, { includeBets });
    return res.json({ success: true, data: withPlayersPagination(data, req) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/**
 * GET /admin/lottery3d/slot-wise-bets?dateFrom=&dateTo=&filterMode=&slotStartIso=
 * Optimized single-call endpoint for Slot Wise Bets (3D).
 */
export const getLottery3DSlotWiseBets = async (req, res) => {
  try {
    const dateFromQ = typeof req.query.dateFrom === 'string' ? req.query.dateFrom.trim() : '';
    const dateToQ = typeof req.query.dateTo === 'string' ? req.query.dateTo.trim() : '';
    const filterMode = String(req.query.filterMode || 'all_day').trim().toLowerCase();
    const slotStartIso = String(req.query.slotStartIso || '').trim();
    const today = istDayKey();
    const dateFrom = dateFromQ || today;
    const dateTo = dateToQ || dateFrom;

    if (!isValidISTDayKey(dateFrom) || !isValidISTDayKey(dateTo)) {
      return res.status(400).json({ success: false, message: 'Invalid date range. Use YYYY-MM-DD (IST).' });
    }
    if (dateFrom > dateTo) {
      return res.status(400).json({ success: false, message: 'dateFrom must be on or before dateTo.' });
    }
    if (dateTo > today) {
      return res.status(400).json({ success: false, message: 'dateTo cannot be after today (IST).' });
    }

    let targetSlots = dateFrom === dateTo
      ? listSlotStartIsoForISTDay(dateFrom)
      : listSlotStartIsoForISTDayRange(dateFrom, dateTo);

    if (slotStartIso) {
      if (!isValidISTSlotStartIso(slotStartIso)) {
        return res.status(400).json({ success: false, message: 'Invalid slotStartIso.' });
      }
      targetSlots = [slotStartIso];
    } else if (filterMode === 'advance' || filterMode === 'past') {
      const nowMs = Date.now();
      targetSlots = targetSlots.filter((iso) => {
        const startMs = new Date(iso).getTime();
        const endMs = startMs + SLOT_MS;
        if (filterMode === 'past') return nowMs >= endMs;
        return nowMs < startMs;
      });
    }

    if (!targetSlots.length) {
      return res.json({
        success: true,
        data: {
          slot: { slotStartIso: dateFrom === dateTo ? dateFrom : `${dateFrom} to ${dateTo}`, drawLabelEnd: 'No slots' },
          players: [],
        },
      });
    }

    const lotteryScopeFilter = await getLotteryScopeFilter(req);
    const [bets, picks, ratesMap] = await Promise.all([
      QuizBet.find({ gameMode: GAME_MODE, slotStartIso: { $in: targetSlots }, ...lotteryScopeFilter })
        .select('_id userId quizId number amount status winPayout betMode createdAt slotStartIso')
        .sort({ createdAt: -1 })
        .lean(),
      QuizSlotPick.find({ gameMode: GAME_MODE, slotStartIso: { $in: targetSlots } })
        .select('slotStartIso quizId hintPosition')
        .lean(),
      getRatesMap(),
    ]);

    const picksBySlot = new Map();
    picks.forEach((p) => {
      if (!picksBySlot.has(p.slotStartIso)) picksBySlot.set(p.slotStartIso, new Map());
      picksBySlot.get(p.slotStartIso).set(p.quizId, p.hintPosition);
    });

    const userIds = Array.from(new Set(bets.map((b) => String(b.userId || '')).filter(Boolean)));
    const users = userIds.length
      ? await User.find({ _id: { $in: userIds } }).select('username phone').lean()
      : [];
    const userById = new Map(users.map((u) => [String(u._id), u]));

    const playerMap = new Map();
    const nowMs = Date.now();
    bets.forEach((bet) => {
      const userId = String(bet.userId || '');
      if (!userId) return;
      if (!playerMap.has(userId)) {
        const u = userById.get(userId);
        playerMap.set(userId, {
          userId,
          username: u?.username || 'unknown',
          phone: u?.phone || '',
          betCount: 0,
          totalStake: 0,
          totalPayout: 0,
          netProfitLoss: 0,
          bets: [],
        });
      }
      const row = playerMap.get(userId);
      const slotStartMs = new Date(bet.slotStartIso).getTime();
      const slotEndMs = slotStartMs + SLOT_MS;
      const isCompleted = nowMs >= slotEndMs;
      const pickByQuiz = picksBySlot.get(bet.slotStartIso) || new Map();
      const outcome = getOutcomeAndPayout({ isCompleted, pickByQuiz, bet, ratesMap });
      const amount = Number(bet.amount || 0);

      row.betCount += 1;
      row.totalStake += amount;
      row.totalPayout += Number(outcome.payout || 0);
      row.netProfitLoss += Number(outcome.net || 0);
      row.bets.push({
        betId: String(bet._id),
        setLabel: getSetLabelByQuizId(bet.quizId),
        number: String(bet.number ?? '').padStart(3, '0'),
        amount,
        outcome: outcome.outcome,
        payout: Number(outcome.payout || 0),
        netProfitLoss: Number(outcome.net || 0),
        createdAt: bet.createdAt || null,
      });
    });

    return res.json({
      success: true,
      data: {
        slot: {
          slotStartIso: slotStartIso || (dateFrom === dateTo ? dateFrom : `${dateFrom} to ${dateTo}`),
          drawLabelEnd: slotStartIso ? formatDrawLabel(new Date(slotStartIso).getTime() + SLOT_MS) : `${filterMode} (${targetSlots.length})`,
        },
        players: Array.from(playerMap.values()),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

/**
 * GET /admin/lottery3d/tickets?dateFrom=&dateTo=&date=&slotStartIso=&limit=&page=
 * Ticket-wise view (3D) — same shape as 2D tickets API for admin UI parity.
 */
export const getLottery3DTickets = async (req, res) => {
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
    const slotStartIso = hasSlotFilter ? rawSlotStartIso : getSlotContext(new Date(), '3d').slotStartIso;
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

    const ticketListPipeline = [
      { $match: match },
      {
        $group: {
          _id: {
            ticketId: '$ticketId',
            userId: '$userId',
            slotStartIso: '$slotStartIso',
          },
          totalBets: { $sum: 1 },
          totalStake: { $sum: '$amount' },
          totalWinPayout: { $sum: { $ifNull: ['$winPayout', 0] } },
          pendingBets: {
            $sum: {
              $cond: [{ $eq: ['$status', 'pending'] }, 1, 0],
            },
          },
          placedAt: { $min: '$createdAt' },
        },
      },
      { $sort: { placedAt: -1 } },
      { $skip: skip },
      { $limit: limit + 1 },
    ];

    const [rowsAll, summaryAgg, ticketCountAgg, uniqueUserCountAgg] = await Promise.all([
      QuizBet.aggregate(ticketListPipeline),
      QuizBet.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalBets: { $sum: 1 },
            totalStake: { $sum: '$amount' },
            totalPayout: { $sum: { $ifNull: ['$winPayout', 0] } },
          },
        },
      ]),
      QuizBet.aggregate([
        { $match: match },
        {
          $group: {
            _id: { ticketId: '$ticketId', userId: '$userId', slotStartIso: '$slotStartIso' },
          },
        },
        { $count: 'n' },
      ]),
      QuizBet.aggregate([
        { $match: match },
        { $group: { _id: '$userId' } },
        { $count: 'n' },
      ]),
    ]);

    const hasMore = Array.isArray(rowsAll) && rowsAll.length > limit;
    const rows = hasMore ? rowsAll.slice(0, limit) : (Array.isArray(rowsAll) ? rowsAll : []);
    const sum = summaryAgg[0] || {};
    const totalStake = Number(sum.totalStake || 0);
    const totalPayout = Number(sum.totalPayout || 0);
    const summary = {
      totalTickets: Number(ticketCountAgg[0]?.n || 0),
      totalBets: Number(sum.totalBets || 0),
      totalStake,
      totalPayout,
      adminProfit: totalStake - totalPayout,
      uniqueUsers: Number(uniqueUserCountAgg[0]?.n || 0),
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
      return {
        ticketId: row?._id?.ticketId || '-',
        userId: uid,
        username: user?.username || 'unknown',
        phone: user?.phone || '',
        slotStartIso: rowSlotStartIso,
        drawLabelEnd: Number.isFinite(rowSlotEndMs) ? formatDrawLabel(rowSlotEndMs) : '-',
        totalBets: Number(row?.totalBets || 0),
        pendingBets: Number(row?.pendingBets || 0),
        totalStake: Number(row?.totalStake || 0),
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
 * GET /admin/lottery3d/tickets/:ticketId/bets?slotStartIso=&userId=
 */
export const getLottery3DTicketBets = async (req, res) => {
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
      setLabel: getSetLabelByQuizId(Number(bet.quizId)),
      number: String(bet.number ?? '').padStart(3, '0'),
      betMode: String(bet.betMode || 'str').toLowerCase(),
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
      .select('_id ticketId slotStartIso quizId number amount status winPayout betMode createdAt')
      .sort({ slotStartIso: -1, createdAt: -1 })
      .lean();
    const picks = await QuizSlotPick.find({ gameMode: GAME_MODE, slotStartIso: { $in: slotStarts } })
      .select('slotStartIso quizId hintPosition')
      .lean();
    const ratesMap = await getRatesMap();
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
      const result = getOutcomeAndPayout({ isCompleted, pickByQuiz, bet, ratesMap });
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
        pagination: { page, limit, hasMore },
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
    await invalidateAdminReadCaches('lottery3d_slot_result_updated');

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

    const [bets, pick, ratesMap] = await Promise.all([
      QuizBet.find({ gameMode: GAME_MODE, slotStartIso, quizId }).select('number amount status betMode').lean(),
      QuizSlotPick.findOne({ gameMode: GAME_MODE, slotStartIso, quizId }).select('hintPosition').lean(),
      getRatesMap(),
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
      let payoutIfWin = 0;
      for (const bet of bets) {
        if (String(bet?.status || '').toLowerCase() === 'cancelled') continue;
        if (Number(bet.number) !== num) continue;
        if (computedWin3d(bet, num)) {
          payoutIfWin += payoutUnsettledWin3d(bet, num, ratesMap);
        }
      }
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
        winMultiplier: ratesMap?.quiz3d,
        payoutUsesPerPlayRates: true,
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
      const targetProfitPercent = getDeclaredTargetPercentForHintApply(existingDeclaration);
      if (targetProfitPercent != null) {
        await apply3DTargetProfitHintsToSlot(slotStartIso, targetProfitPercent);
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
    await invalidateAdminReadCaches('lottery3d_slot_declaration_updated');

    const declaration = await getSlotDeclarationState(slotStartIso, GAME_MODE, slotEndMs);
    return res.json({ success: true, data: { slotStartIso, declaration } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

