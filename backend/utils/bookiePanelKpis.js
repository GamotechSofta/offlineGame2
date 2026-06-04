import Bet from '../models/bet/bet.js';
import QuizBet from '../models/quiz/QuizBet.js';
import QuizSlotPick from '../models/quiz/QuizSlotPick.js';
import User from '../models/user/user.js';
import { getRatesMap } from '../models/rate/rate.js';
import { getBookieUserIds } from './bookieFilter.js';
import {
    aggregatePlayerBetMetrics,
    buildCommissionDateFilter,
    getCommissionScopeMatch,
    round2,
} from './commissionMetrics.js';
import {
    getSlotContext,
    istDayKey,
    listSlotStartIsoForISTDayRange,
} from '../services/slotService.js';

const USER_PLACED_MATKA = {
    $or: [{ placedByBookie: false }, { placedByBookie: { $exists: false } }],
};

const IST_OFFSET_MINUTES = 330;

/** Same IST business-day bounds as GET /dashboard/stats (from + to YYYY-MM-DD). */
export function getIstBusinessDayRange(fromStr, toStr) {
    if (!fromStr || !toStr) {
        return { start: null, end: null };
    }

    const parseDayKey = (value) => {
        if (typeof value !== 'string') return null;
        const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return null;
        const y = Number(m[1]);
        const mo = Number(m[2]);
        const d = Number(m[3]);
        if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(d)) return null;
        const utcMs = Date.UTC(y, mo - 1, d);
        const check = new Date(utcMs);
        if (
            check.getUTCFullYear() !== y
            || (check.getUTCMonth() + 1) !== mo
            || check.getUTCDate() !== d
        ) {
            return null;
        }
        return { y, m: mo, d };
    };

    const from = parseDayKey(fromStr);
    const to = parseDayKey(toStr);
    let start = null;
    let end = null;

    if (from) {
        const startUtcMs = Date.UTC(from.y, from.m - 1, from.d, 0, 0, 0, 0)
            - (IST_OFFSET_MINUTES * 60 * 1000);
        start = new Date(startUtcMs);
    }
    if (to) {
        const nextDayUtcMs = Date.UTC(to.y, to.m - 1, to.d + 1, 0, 0, 0, 0)
            - (IST_OFFSET_MINUTES * 60 * 1000);
        end = new Date(nextDayUtcMs - 1);
    }

    if (!start || !end) {
        return { start: null, end: null };
    }
    return { start, end };
}

/** Same as GET /bets/history startDate/endDate filter (local calendar day). */
function getBetHistoryDateFilter(startDate, endDate) {
    if (!startDate && !endDate) return {};
    const filter = { createdAt: {} };
    if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = start;
    }
    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
    }
    return filter;
}

/** Bookie dashboard default is "today" (IST), not all-time. */
export function resolveBookiePanelDateRange({ startDate, endDate } = {}) {
    const s = typeof startDate === 'string' ? startDate.trim() : '';
    const e = typeof endDate === 'string' ? endDate.trim() : '';
    if (s || e) {
        const from = s || e;
        const to = e || s;
        return { from, to, allTime: false };
    }
    const today = istDayKey();
    return { from: today, to: today, allTime: false };
}

export function formatBookiePanelPeriodLabel(from, to) {
    const today = istDayKey();
    if (from === to && from === today) return 'Today';
    if (!from || !to) return 'All time';
    if (from === to) {
        const d = new Date(`${from}T12:00:00+05:30`);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    const a = new Date(`${from}T12:00:00+05:30`);
    const b = new Date(`${to}T12:00:00+05:30`);
    const fmt = (x) => x.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    return `${fmt(a)} – ${fmt(b)} ${b.getFullYear()}`;
}

async function getQuizWinMultiplier(gameMode) {
    try {
        const rates = await getRatesMap();
        const key = gameMode === '3d' ? 'quiz3d' : 'quiz2d';
        const rate = Number(rates?.[key]);
        if (Number.isFinite(rate) && rate > 0) return rate;
    } catch {
        // fall through
    }
    const fallback = parseInt(process.env.QUIZ_BET_WIN_MULTIPLIER || '90', 10);
    return Number.isFinite(fallback) && fallback > 0 ? fallback : 90;
}

function quizBetTicketKey(bet) {
    const tid = bet.ticketId ? String(bet.ticketId).trim() : '';
    return tid || `legacy:${String(bet._id)}`;
}

async function summarizeCurrentSlot(userIds, gameMode) {
    if (!userIds?.length) {
        return {
            totalTickets: 0,
            totalBets: 0,
            revenue: 0,
            winnerPayout: 0,
            amountRemaining: 0,
        };
    }
    const ctx = getSlotContext(new Date(), gameMode);
    const scope = { userId: { $in: userIds } };
    const [bets, picks, winMultiplier] = await Promise.all([
        QuizBet.find({
            gameMode,
            slotStartIso: ctx.slotStartIso,
            status: { $ne: 'cancelled' },
            ...scope,
        })
            .select('ticketId quizId userId number amount status')
            .lean(),
        QuizSlotPick.find({ gameMode, slotStartIso: ctx.slotStartIso })
            .select('quizId hintPosition')
            .lean(),
        getQuizWinMultiplier(gameMode),
    ]);

    const pickByQuiz = new Map(picks.map((p) => [p.quizId, p.hintPosition]));
    const ticketKeys = new Set();
    let totalBets = 0;
    let revenue = 0;
    let winnerPayout = 0;

    for (const bet of bets) {
        totalBets += 1;
        ticketKeys.add(quizBetTicketKey(bet));
        revenue += Number(bet.amount || 0);
        const hp = pickByQuiz.get(bet.quizId);
        if (Number.isInteger(hp) && hp === bet.number) {
            winnerPayout += Math.round(Number(bet.amount || 0) * winMultiplier);
        }
    }

    return {
        totalTickets: ticketKeys.size,
        totalBets,
        revenue,
        winnerPayout,
        amountRemaining: revenue - winnerPayout,
    };
}

async function aggregateLotteryStats(userIds, gameMode, dateFrom, dateTo) {
    if (!userIds?.length) {
        return {
            totalTickets: 0,
            totalBets: 0,
            totalStake: 0,
            totalPayout: 0,
            adminNet: 0,
        };
    }

    const match = {
        gameMode,
        status: { $ne: 'cancelled' },
        userId: { $in: userIds },
    };

    if (dateFrom && dateTo) {
        const slotIsos = listSlotStartIsoForISTDayRange(dateFrom, dateTo);
        if (!slotIsos.length) {
            return {
                totalTickets: 0,
                totalBets: 0,
                totalStake: 0,
                totalPayout: 0,
                adminNet: 0,
            };
        }
        match.slotStartIso = { $in: slotIsos };
    }

    const rows = await QuizBet.aggregate([
        { $match: match },
        {
            $group: {
                _id: null,
                totalBets: { $sum: 1 },
                totalStake: { $sum: '$amount' },
                totalPayout: { $sum: '$winPayout' },
                ticketIds: { $addToSet: '$ticketId' },
            },
        },
        {
            $project: {
                totalTickets: { $size: '$ticketIds' },
                totalBets: 1,
                totalStake: 1,
                totalPayout: 1,
                adminNet: { $subtract: ['$totalStake', '$totalPayout'] },
            },
        },
    ]);

    const row = rows[0] || {};
    return {
        totalTickets: Number(row.totalTickets || 0),
        totalBets: Number(row.totalBets || 0),
        totalStake: round2(row.totalStake || 0),
        totalPayout: round2(row.totalPayout || 0),
        adminNet: round2(row.adminNet || 0),
    };
}

/** Mirrors superbookie Dashboard.jsx fetchLotteryModeStats allSlots.net */
function resolveLotteryAllSlots(aggregate, currentSummary) {
    const aggregateHasSignal = (
        Number(aggregate?.totalTickets || 0) > 0
        || Number(aggregate?.totalBets || 0) > 0
        || Number(aggregate?.totalStake || 0) > 0
        || Number(aggregate?.totalPayout || 0) > 0
    );
    const currentHasSignal = (
        Number(currentSummary?.totalTickets || 0) > 0
        || Number(currentSummary?.totalBets || 0) > 0
        || Number(currentSummary?.revenue || 0) > 0
        || Number(currentSummary?.winnerPayout || 0) > 0
    );

    if (aggregateHasSignal) {
        return {
            revenue: Number(aggregate.totalStake || 0),
            net: Number(aggregate.adminNet || 0),
        };
    }
    if (currentHasSignal) {
        return {
            revenue: Number(currentSummary.revenue || 0),
            net: Number(currentSummary.amountRemaining || 0),
        };
    }
    return { revenue: 0, net: 0 };
}

async function computeMarketReport(userIds, { from, to, allTime }) {
    if (!userIds.length) {
        return { totalBetAmount: 0, totalPayout: 0, pendingAmount: 0, netProfit: 0 };
    }

    const dateFilter = allTime ? {} : getBetHistoryDateFilter(from, to);
    const base = {
        userId: { $in: userIds },
        status: { $ne: 'cancelled' },
        ...USER_PLACED_MATKA,
        ...dateFilter,
    };

    const [stakeAgg, payoutAgg, pendingAgg] = await Promise.all([
        Bet.aggregate([{ $match: base }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
        Bet.aggregate([
            { $match: { ...base, status: 'won' } },
            { $group: { _id: null, total: { $sum: '$payout' } } },
        ]),
        Bet.aggregate([
            { $match: { ...base, status: 'pending' } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
    ]);

    const totalBetAmount = round2(stakeAgg[0]?.total || 0);
    const totalPayout = round2(payoutAgg[0]?.total || 0);
    const pendingAmount = round2(pendingAgg[0]?.total || 0);
    return {
        totalBetAmount,
        totalPayout,
        pendingAmount,
        netProfit: round2(totalBetAmount - totalPayout),
    };
}

async function computeDashboardMatkaRevenue(admin, userIds, { from, to, allTime }) {
    const scope = await getCommissionScopeMatch(admin);
    if (!scope) return 0;

    const { start, end } = allTime
        ? { start: null, end: null }
        : getIstBusinessDayRange(from, to);
    const dateMatch = (start && end) ? { createdAt: { $gte: start, $lte: end } } : {};

    const rows = await Bet.aggregate([
        {
            $match: {
                status: { $ne: 'cancelled' },
                ...scope,
                ...dateMatch,
            },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return round2(rows[0]?.total || 0);
}

/**
 * Same KPIs as superbookie/src/pages/Dashboard.jsx primary revenue row.
 */
export async function computeBookiePanelKpis(admin, { startDate, endDate } = {}) {
    const { from, to, allTime } = resolveBookiePanelDateRange({ startDate, endDate });
    const userIds = (await getBookieUserIds(admin)) || [];
    const periodLabel = formatBookiePanelPeriodLabel(from, to);
    const dateFrom = allTime ? null : from;
    const dateTo = allTime ? null : to;

    if (!userIds.length) {
        return {
            totalBetAmount: 0,
            matkaBetAmount: 0,
            lotteryBetAmount: 0,
            totalPayouts: 0,
            matkaNetProfit: 0,
            marketNetProfit: 0,
            netProfit: 0,
            toTake: 0,
            toGive: 0,
            pendingAmount: 0,
            pendingMatka: 0,
            pendingLottery: 0,
            lotteryNet: 0,
            twoDNet: 0,
            threeDNet: 0,
            twoDRevenue: 0,
            threeDRevenue: 0,
            totalProfit: 0,
            totalPlayers: 0,
            dateFrom,
            dateTo,
            periodLabel,
        };
    }

    const commissionDateFilter = allTime
        ? {}
        : buildCommissionDateFilter(from, to);

    const [
        marketReport,
        commissionMetrics,
        dashboardMatkaRevenue,
        twoDAgg,
        threeDAgg,
        twoDCurrent,
        threeDCurrent,
        toGiveTakeAgg,
    ] = await Promise.all([
        computeMarketReport(userIds, { from, to, allTime }),
        aggregatePlayerBetMetrics({ admin, dateFilter: commissionDateFilter }),
        computeDashboardMatkaRevenue(admin, userIds, { from, to, allTime }),
        aggregateLotteryStats(userIds, '2d', dateFrom, dateTo),
        aggregateLotteryStats(userIds, '3d', dateFrom, dateTo),
        summarizeCurrentSlot(userIds, '2d'),
        summarizeCurrentSlot(userIds, '3d'),
        User.aggregate([
            { $match: { _id: { $in: userIds } } },
            {
                $group: {
                    _id: null,
                    toGive: { $sum: { $ifNull: ['$toGive', 0] } },
                    toTake: { $sum: { $ifNull: ['$toTake', 0] } },
                },
            },
        ]),
    ]);

    const twoDSlots = resolveLotteryAllSlots(twoDAgg, {
        totalTickets: twoDCurrent.totalTickets,
        totalBets: twoDCurrent.totalBets,
        revenue: twoDCurrent.revenue,
        winnerPayout: twoDCurrent.winnerPayout,
        amountRemaining: twoDCurrent.amountRemaining,
    });
    const threeDSlots = resolveLotteryAllSlots(threeDAgg, {
        totalTickets: threeDCurrent.totalTickets,
        totalBets: threeDCurrent.totalBets,
        revenue: threeDCurrent.revenue,
        winnerPayout: threeDCurrent.winnerPayout,
        amountRemaining: threeDCurrent.amountRemaining,
    });

    const twoDNet = round2(twoDSlots.net);
    const threeDNet = round2(threeDSlots.net);
    const lotteryAllSlotsNet = round2(twoDNet + threeDNet);
    const lotteryAllSlotsRevenue = round2(twoDSlots.revenue + threeDSlots.revenue);

    const commissionBaseTotal = commissionMetrics.totalBetAmount;
    const commissionMatkaTotal = commissionMetrics.matkaBetAmount;
    const commissionLotteryTotal = commissionMetrics.lotteryBetAmount;

    const displayTotalBetAmount = commissionBaseTotal > 0
        ? commissionBaseTotal
        : round2(dashboardMatkaRevenue + (commissionLotteryTotal || lotteryAllSlotsRevenue));

    const toTake = round2(toGiveTakeAgg[0]?.toTake || 0);
    const toGive = round2(toGiveTakeAgg[0]?.toGive || 0);
    const marketPendingAmount = marketReport.pendingAmount;
    const pendingAmount = round2(marketPendingAmount + lotteryAllSlotsNet);
    const totalProfit = round2(
        marketReport.netProfit + lotteryAllSlotsNet + (toTake - toGive),
    );

    return {
        totalBetAmount: displayTotalBetAmount,
        matkaBetAmount: commissionMatkaTotal > 0 ? commissionMatkaTotal : dashboardMatkaRevenue,
        lotteryBetAmount: commissionLotteryTotal > 0
            ? commissionLotteryTotal
            : lotteryAllSlotsRevenue,
        totalPayouts: commissionMetrics.totalPayouts,
        matkaNetProfit: marketReport.netProfit,
        marketNetProfit: marketReport.netProfit,
        netProfit: marketReport.netProfit,
        toTake,
        toGive,
        pendingAmount,
        pendingMatka: marketPendingAmount,
        pendingLottery: lotteryAllSlotsNet,
        lotteryNet: lotteryAllSlotsNet,
        twoDNet,
        threeDNet,
        twoDRevenue: twoDSlots.revenue,
        threeDRevenue: threeDSlots.revenue,
        totalProfit,
        totalPlayers: userIds.length,
        dateFrom,
        dateTo,
        periodLabel,
    };
}
