import mongoose from 'mongoose';
import Bet from '../models/bet/bet.js';
import Payment from '../models/payment/payment.js';
import User from '../models/user/user.js';
import Market from '../models/market/market.js';
import Admin from '../models/admin/admin.js';

import { Wallet, WalletTransaction } from '../models/wallet/wallet.js';
import HelpDesk from '../models/helpDesk/helpDesk.js';
import { getBookieUserIds, getBookieHierarchySummary, getAdminDirectUserIds } from '../utils/bookieFilter.js';
import { isBettingClosed, isMarketOpenOnISTDay } from '../utils/marketTiming.js';
import { cacheGet, cacheSet, getCacheMetrics } from '../services/cacheService.js';
import { getRuntimeMetrics } from '../services/runtimeMonitorService.js';
import { getTraceMetrics } from '../services/traceMetricsService.js';

const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;
const DASHBOARD_CACHE_TTL_SECONDS = 12;
const DASHBOARD_STATS_INFLIGHT = new Map();
const DASHBOARD_SUMMARY_INFLIGHT = new Map();

function getDashboardCacheKey(req) {
    const adminId = String(req.admin?._id || 'guest');
    const role = String(req.admin?.role || '');
    const q = req.query || {};
    const keyPayload = {
        adminId,
        role,
        from: q.from || '',
        to: q.to || '',
        marketId: q.marketId || '',
    };
    return `dashboard:stats:${Buffer.from(JSON.stringify(keyPayload)).toString('base64url')}`;
}

/** Parse from/to query (YYYY-MM-DD). Returns { start, end } in UTC-like range for DB. 
 * If fromStr and toStr are not provided, returns null to indicate "all time" */
function getDateRange(fromStr, toStr) {
    // If no dates provided, return null to show all data
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

    // Dashboard ranges are business dates in IST (Asia/Kolkata), regardless of server timezone.
    // Convert IST day bounds to UTC timestamps so local/dev/live return identical results.
    const IST_OFFSET_MINUTES = 330;
    if (from) {
        const startUtcMs = Date.UTC(from.y, from.m - 1, from.d, 0, 0, 0, 0) - (IST_OFFSET_MINUTES * 60 * 1000);
        start = new Date(startUtcMs);
    }
    if (to) {
        const nextDayUtcMs = Date.UTC(to.y, to.m - 1, to.d + 1, 0, 0, 0, 0) - (IST_OFFSET_MINUTES * 60 * 1000);
        end = new Date(nextDayUtcMs - 1);
    }

    // If dates are invalid, return null for "all time"
    if (!start || !end) {
        return { start: null, end: null };
    }

    return { start, end };
}

export const getDashboardStats = async (req, res) => {
    try {
        const cacheKey = getDashboardCacheKey(req);
        const cached = await cacheGet(cacheKey);
        if (cached) {
            res.set('X-Cache', 'HIT');
            return res.status(200).json({ success: true, data: cached, cached: true });
        }
        const inFlight = DASHBOARD_STATS_INFLIGHT.get(cacheKey);
        if (inFlight) {
            const payload = await inFlight;
            res.set('X-Cache', 'DEDUPED');
            return res.status(200).json({ success: true, data: payload, deduped: true });
        }
        res.set('X-Cache', 'MISS');
        const computePromise = (async () => {
        // Get all user IDs that belong to this bookie (via referredBy field)
        // Returns null for super_admin (no filter - see all), array of IDs for bookie, empty array if no users
        const bookieUserIds = await getBookieUserIds(req.admin);
        // SuperBookie (parent): bet revenue KPIs exclude sub-bookie player bets.
        const revenueUserIds = req.admin?.role === 'bookie'
            ? await getBookieUserIds(req.admin, { directOnly: true })
            : bookieUserIds;

        // Build filters: if bookieUserIds is null (super_admin), filter is {} (match all)
        // If bookieUserIds is array (even empty), filter by those IDs (empty array = match nothing, which is correct)
        const userFilter = bookieUserIds !== null ? { _id: { $in: bookieUserIds } } : {};
        const betFilter = bookieUserIds !== null ? { userId: { $in: bookieUserIds } } : {};
        const revenueBetFilter = revenueUserIds !== null ? { userId: { $in: revenueUserIds } } : betFilter;
        // SuperBookie (bookie role): deposits/withdrawals = direct players only, not sub-bookie downline.
        const paymentUserIds = req.admin?.role === 'bookie' ? revenueUserIds : bookieUserIds;
        const paymentFilter = paymentUserIds !== null ? { userId: { $in: paymentUserIds } } : {};
        const walletMatch = bookieUserIds !== null ? { userId: { $in: bookieUserIds } } : {};
        const helpDeskFilter = bookieUserIds !== null ? { userId: { $in: bookieUserIds } } : {};

        const { from, to, marketId } = req.query;
        const { start: rangeStart, end: rangeEnd } = getDateRange(from, to);
        // If rangeStart is null, don't apply date filter (show all data)
        const dateMatch = (rangeStart === null || rangeEnd === null) 
            ? {} 
            : { createdAt: { $gte: rangeStart, $lte: rangeEnd } };

        const selectedMarketId =
            typeof marketId === 'string' && OBJECT_ID_RE.test(marketId.trim())
                ? marketId.trim()
                : null;
        // Aggregation pipelines do not cast string → ObjectId; use explicit ObjectId or $match fails silently.
        const marketMatch = selectedMarketId
            ? { marketId: new mongoose.Types.ObjectId(selectedMarketId) }
            : {};

        const revenueMatch = { ...dateMatch, ...revenueBetFilter, ...marketMatch, status: { $ne: 'cancelled' } };
        const payoutMatch = { status: 'won', ...dateMatch, ...revenueBetFilter, ...marketMatch };
        const betCountMatch = { ...dateMatch, ...betFilter, ...marketMatch, status: { $ne: 'cancelled' } };
        const lossMatch = { status: 'lost', ...dateMatch, ...betFilter, ...marketMatch };
        const isSuperAdmin = bookieUserIds === null && req.admin?.role === 'super_admin';
        const adminDirectUserIds = isSuperAdmin ? await getAdminDirectUserIds() : [];
        const adminDirectPaymentFilter = isSuperAdmin
            ? { userId: { $in: adminDirectUserIds } }
            : null;

        // Run all independent DB queries in parallel for faster dashboard load
        const [
            totalUsers,
            activeUsers,
            newUsersInRange,
            totalMarkets,
            allMarketsForOpen,
            mainMarkets,
            starlineMarkets,
            totalRevenue,
            totalPayouts,
            totalBets,
            winningBets,
            losingBets,
            pendingBets,
            pendingBetAmount,
            totalDeposits,
            totalWithdrawals,
            totalPayments,
            pendingPayments,
            pendingDeposits,
            pendingWithdrawals,
            totalWalletBalance,
            walletFlowAgg,
            toGiveTakeAgg,
            totalAdvance,
            totalLoss,
            totalTickets,
            openTickets,
            inProgressTickets,
            bookiesTotal,
            bookiesActive,
            adminPlayerDeposits,
            adminPlayerWithdrawals,
        ] = await Promise.all([
            User.countDocuments(userFilter),
            User.countDocuments({ ...userFilter, isActive: true }),
            User.countDocuments({ ...userFilter, ...dateMatch }),
            Market.countDocuments(),
            Market.find().select('_id marketName marketType startingTime closingTime days openingNumber closingNumber').lean(),
            Market.countDocuments({ marketType: { $ne: 'startline' } }),
            Market.countDocuments({ marketType: 'startline' }),
            Bet.aggregate([{ $match: revenueMatch }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
            Bet.aggregate([{ $match: payoutMatch }, { $group: { _id: null, total: { $sum: '$payout' } } }]),
            Bet.countDocuments(betCountMatch),
            Bet.countDocuments({ status: 'won', ...dateMatch, ...betFilter, ...marketMatch }),
            Bet.countDocuments({ status: 'lost', ...dateMatch, ...betFilter, ...marketMatch }),
            Bet.countDocuments({ status: 'pending', ...dateMatch, ...betFilter, ...marketMatch }),
            Bet.aggregate([{ $match: { status: 'pending', ...dateMatch, ...betFilter, ...marketMatch } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
            Payment.aggregate([{ $match: { type: 'deposit', status: { $in: ['approved', 'completed'] }, ...dateMatch, ...paymentFilter } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
            Payment.aggregate([{ $match: { type: 'withdrawal', status: { $in: ['approved', 'completed'] }, ...dateMatch, ...paymentFilter } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
            Payment.countDocuments({ ...dateMatch, ...paymentFilter }),
            Payment.countDocuments({ status: 'pending', ...dateMatch, ...paymentFilter }),
            Payment.countDocuments({ type: 'deposit', status: 'pending', ...dateMatch, ...paymentFilter }),
            Payment.countDocuments({ type: 'withdrawal', status: 'pending', ...dateMatch, ...paymentFilter }),
            Wallet.aggregate([...(Object.keys(walletMatch).length ? [{ $match: walletMatch }] : []), { $group: { _id: null, total: { $sum: '$balance' } } }]),
            Wallet.aggregate([
                ...(Object.keys(walletMatch).length ? [{ $match: walletMatch }] : []),
                {
                    $group: {
                        _id: null,
                        toGive: {
                            $sum: {
                                $cond: [{ $gt: ['$balance', 0] }, '$balance', 0],
                            },
                        },
                        toReceive: {
                            $sum: {
                                $cond: [{ $lt: ['$balance', 0] }, { $abs: '$balance' }, 0],
                            },
                        },
                    },
                },
            ]),
            User.aggregate([
                ...(Object.keys(userFilter).length ? [{ $match: userFilter }] : []),
                {
                    $group: {
                        _id: null,
                        toGive: { $sum: { $ifNull: ['$toGive', 0] } },
                        toTake: { $sum: { $ifNull: ['$toTake', 0] } },
                    },
                },
            ]),
            Payment.aggregate([{ $match: { type: 'deposit', status: { $in: ['approved', 'completed'] }, ...paymentFilter } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
            Bet.aggregate([{ $match: lossMatch }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
            HelpDesk.countDocuments(helpDeskFilter),
            HelpDesk.countDocuments({ status: 'open', ...helpDeskFilter }),
            HelpDesk.countDocuments({ status: 'in-progress', ...helpDeskFilter }),
            isSuperAdmin ? Admin.countDocuments({ role: 'bookie' }) : 0,
            isSuperAdmin ? Admin.countDocuments({ role: 'bookie', status: 'active' }) : 0,
            adminDirectPaymentFilter
                ? Payment.aggregate([
                    { $match: { type: 'deposit', status: { $in: ['approved', 'completed'] }, ...dateMatch, ...adminDirectPaymentFilter } },
                    { $group: { _id: null, total: { $sum: '$amount' } } },
                ])
                : Promise.resolve([]),
            adminDirectPaymentFilter
                ? Payment.aggregate([
                    { $match: { type: 'withdrawal', status: { $in: ['approved', 'completed'] }, ...dateMatch, ...adminDirectPaymentFilter } },
                    { $group: { _id: null, total: { $sum: '$amount' } } },
                ])
                : Promise.resolve([]),
        ]);

        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const scopedMarkets = selectedMarketId
            ? allMarketsForOpen.filter((m) => String(m?._id) === selectedMarketId)
            : allMarketsForOpen;

        let openMarkets = 0;
        let openMainMarkets = 0;
        let openStarlineMarkets = 0;
        const marketsPendingResultList = [];
        for (const m of scopedMarkets) {
            const startTime = parseTimeToMinutes(m.startingTime);
            const endTime = parseTimeToMinutes(m.closingTime);
            if (
                startTime &&
                endTime &&
                currentTime >= startTime &&
                currentTime <= endTime &&
                isMarketOpenOnISTDay(m, now)
            ) {
                openMarkets++;
                if (m.marketType === 'startline') openStarlineMarkets++;
                else openMainMarkets++;
            }
            if (isBettingClosed(m, now)) {
                const isStarline = m.marketType === 'startline';
                const needsResult = isStarline
                    ? !(m.openingNumber && /^\d{3}$/.test(String(m.openingNumber)))
                    : !(m.openingNumber && /^\d{3}$/.test(String(m.openingNumber)) && m.closingNumber && /^\d{3}$/.test(String(m.closingNumber)));
                if (needsResult) {
                    marketsPendingResultList.push({ _id: m._id, marketName: m.marketName, marketType: m.marketType || 'main' });
                }
            }
        }
        const marketsPendingResult = marketsPendingResultList.length;
        const scopedTotalMarkets = selectedMarketId ? scopedMarkets.length : totalMarkets;

        let marketWise = null;
        if (isSuperAdmin && !selectedMarketId) {
            const breakdown = await Bet.aggregate([
                {
                    $match: {
                        ...dateMatch,
                        ...betFilter,
                        status: { $ne: 'cancelled' },
                    },
                },
                {
                    $group: {
                        _id: '$marketId',
                        revenue: { $sum: '$amount' },
                        bets: { $sum: 1 },
                        payouts: {
                            $sum: {
                                $cond: [{ $eq: ['$status', 'won'] }, { $ifNull: ['$payout', 0] }, 0],
                            },
                        },
                    },
                },
                { $sort: { revenue: -1 } },
            ]);
            const nameById = new Map((allMarketsForOpen || []).map((m) => [String(m._id), m.marketName]));
            marketWise = breakdown.map((row) => ({
                marketId: String(row._id),
                marketName: nameById.get(String(row._id)) || 'Unknown',
                bets: row.bets,
                revenue: row.revenue,
                payouts: row.payouts,
                netProfit: row.revenue - row.payouts,
            }));
        }

        const gameRevenueMatch = {
            ...dateMatch,
            ...(bookieUserIds !== null ? { userId: { $in: bookieUserIds } } : {}),
        };
        const gameTransactions = await WalletTransaction.find({
            ...gameRevenueMatch,
            type: { $in: ['debit', 'credit'] },
        })
            .select('userId type amount description referenceId')
            .lean();
        const detectGameKey = (text) => {
            const s = String(text || '').toLowerCase();
            if (s.includes('aviator')) return 'aviator';
            if (s.includes('funtimer') || s.includes('fun timer')) return 'funTimer';
            if (s.includes('roulette')) return 'roulette';
            return '';
        };
        const extractRoundId = (text) => {
            const s = String(text || '');
            const m = s.match(/roundId=([^|]+)/i);
            return m?.[1] ? String(m[1]).trim() : '';
        };
        const gameWiseRevenue = {
            aviator: { revenue: 0, payout: 0, totalProfit: 0 },
            funTimer: { revenue: 0, payout: 0, totalProfit: 0 },
            roulette: { revenue: 0, payout: 0, totalProfit: 0 },
        };

        const gameByUserRef = new Map();
        const gameByUserRound = new Map();

        gameTransactions.forEach((txn) => {
            if (String(txn?.type || '').toLowerCase() !== 'debit') return;
            const detectedGame = detectGameKey(txn?.description);
            if (!detectedGame) return;
            const userId = String(txn?.userId || '');
            const ref = String(txn?.referenceId || '').trim();
            const roundId = extractRoundId(txn?.description);
            if (ref) gameByUserRef.set(`${userId}::${ref}`, detectedGame);
            if (roundId) gameByUserRound.set(`${userId}::${roundId}`, detectedGame);
        });

        gameTransactions.forEach((txn) => {
            const type = String(txn?.type || '').toLowerCase();
            const amount = Number(txn?.amount || 0);
            if (!Number.isFinite(amount) || amount <= 0) return;

            const userId = String(txn?.userId || '');
            const ref = String(txn?.referenceId || '').trim();
            const roundId = extractRoundId(txn?.description);
            const detectedGame =
                detectGameKey(txn?.description) ||
                (ref ? gameByUserRef.get(`${userId}::${ref}`) : '') ||
                (roundId ? gameByUserRound.get(`${userId}::${roundId}`) : '');

            if (!detectedGame || !Object.prototype.hasOwnProperty.call(gameWiseRevenue, detectedGame)) return;

            if (type === 'debit') {
                gameWiseRevenue[detectedGame].revenue += amount;
            } else if (type === 'credit') {
                gameWiseRevenue[detectedGame].payout += amount;
            }
        });
        Object.keys(gameWiseRevenue).forEach((k) => {
            gameWiseRevenue[k].totalProfit = gameWiseRevenue[k].revenue - gameWiseRevenue[k].payout;
        });
        gameWiseRevenue.total = {
            revenue:
                gameWiseRevenue.aviator.revenue +
                gameWiseRevenue.funTimer.revenue +
                gameWiseRevenue.roulette.revenue,
            payout:
                gameWiseRevenue.aviator.payout +
                gameWiseRevenue.funTimer.payout +
                gameWiseRevenue.roulette.payout,
            totalProfit:
                gameWiseRevenue.aviator.totalProfit +
                gameWiseRevenue.funTimer.totalProfit +
                gameWiseRevenue.roulette.totalProfit,
        };

        const scopedMainMarkets = selectedMarketId
            ? scopedMarkets.filter((m) => (m.marketType || '').toString().toLowerCase() !== 'startline').length
            : mainMarkets;
        const scopedStarlineMarkets = selectedMarketId
            ? scopedMarkets.filter((m) => (m.marketType || '').toString().toLowerCase() === 'startline').length
            : starlineMarkets;

        const toGiveFromWallet = Number(walletFlowAgg?.[0]?.toGive || 0);
        const toReceiveFromWallet = Number(walletFlowAgg?.[0]?.toReceive || 0);
        const toGive = Number(toGiveTakeAgg?.[0]?.toGive || 0);
        const toTake = Number(toGiveTakeAgg?.[0]?.toTake || 0);

        const bookies = { total: bookiesTotal || 0, active: bookiesActive || 0 };

        const revenue = totalRevenue[0]?.total || 0;
        const payouts = totalPayouts[0]?.total || 0;
        const netProfit = revenue - payouts;
        // Calculate Total Profit: Net Profit + (To Take - To Give)
        // This represents the overall financial position including bet profits and outstanding amounts
        const totalProfit = netProfit + (toTake - toGive);
        const winRate = totalBets > 0 ? ((winningBets / totalBets) * 100).toFixed(2) : 0;

        let hierarchy = null;
        if (req.admin?.role === 'bookie') {
            hierarchy = await getBookieHierarchySummary(req.admin._id, dateMatch);
        }

        const responseData = {
                selectedMarketId,
                dateRange: { 
                    from: rangeStart ? rangeStart.toISOString() : null, 
                    to: rangeEnd ? rangeEnd.toISOString() : null 
                },
                users: {
                    total: totalUsers,
                    active: activeUsers,
                    newToday: newUsersInRange,
                    newThisWeek: newUsersInRange,
                    newThisMonth: newUsersInRange,
                },
                markets: {
                    total: scopedTotalMarkets,
                    open: openMarkets,
                    main: scopedMainMarkets,
                    starline: scopedStarlineMarkets,
                    openMain: openMainMarkets,
                    openStarline: openStarlineMarkets,
                },
                revenue: {
                    total: revenue,
                    today: revenue,
                    thisWeek: revenue,
                    thisMonth: revenue,
                    payouts: payouts,
                    netProfit: netProfit,
                },
                bets: {
                    total: totalBets,
                    today: totalBets,
                    thisWeek: totalBets,
                    thisMonth: totalBets,
                    winning: winningBets,
                    losing: losingBets,
                    pending: pendingBets,
                    winRate: parseFloat(winRate),
                },
                payments: {
                    total: totalPayments,
                    pending: pendingPayments,
                    pendingDeposits,
                    pendingWithdrawals,
                    totalDeposits: totalDeposits[0]?.total || 0,
                    totalWithdrawals: totalWithdrawals[0]?.total || 0,
                    ...(isSuperAdmin
                        ? {
                            adminPlayerDeposits: adminPlayerDeposits[0]?.total || 0,
                            adminPlayerWithdrawals: adminPlayerWithdrawals[0]?.total || 0,
                        }
                        : {}),
                },
                wallet: {
                    totalBalance: totalWalletBalance[0]?.total || 0,
                    toGive: toGiveFromWallet,
                    toReceive: toReceiveFromWallet,
                },
                toGive: toGive,
                toTake: toTake,
                totalProfit: totalProfit,
                pending: pendingBetAmount[0]?.total || 0,
                advance: totalAdvance[0]?.total || 0,
                loss: totalLoss[0]?.total || 0,
                helpDesk: {
                    total: totalTickets,
                    open: openTickets,
                    inProgress: inProgressTickets,
                },
                bookies,
                marketsPendingResult,
                marketsPendingResultList,
                marketWise,
                gameWiseRevenue,
                hierarchy,
            };
        await cacheSet(cacheKey, responseData, DASHBOARD_CACHE_TTL_SECONDS);
        return responseData;
        })();

        DASHBOARD_STATS_INFLIGHT.set(cacheKey, computePromise);
        try {
            const payload = await computePromise;
            return res.status(200).json({ success: true, data: payload });
        } finally {
            DASHBOARD_STATS_INFLIGHT.delete(cacheKey);
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getDashboardSummary = async (req, res) => {
    try {
        const cacheKey = `${getDashboardCacheKey(req)}:summary`;
        const cached = await cacheGet(cacheKey);
        if (cached) {
            return res.status(200).json({ success: true, data: cached, cached: true });
        }
        const inFlight = DASHBOARD_SUMMARY_INFLIGHT.get(cacheKey);
        if (inFlight) {
            const payload = await inFlight;
            return res.status(200).json({ success: true, data: payload, deduped: true });
        }
        const computePromise = (async () => {
        const bookieUserIds = await getBookieUserIds(req.admin);
        const revenueUserIds = req.admin?.role === 'bookie'
            ? await getBookieUserIds(req.admin, { directOnly: true })
            : bookieUserIds;
        const userFilter = bookieUserIds !== null ? { _id: { $in: bookieUserIds } } : {};
        const betFilter = bookieUserIds !== null ? { userId: { $in: bookieUserIds } } : {};
        const paymentUserIds = req.admin?.role === 'bookie' ? revenueUserIds : bookieUserIds;
        const paymentFilter = paymentUserIds !== null ? { userId: { $in: paymentUserIds } } : {};
        const { from, to } = req.query;
        const { start: rangeStart, end: rangeEnd } = getDateRange(from, to);
        const dateMatch = (rangeStart === null || rangeEnd === null)
            ? {}
            : { createdAt: { $gte: rangeStart, $lte: rangeEnd } };

        const [
            totalUsers,
            activeUsers,
            totalMarkets,
            pendingPayments,
            totalBets,
            totalRevenueAgg,
            totalPayoutAgg,
            totalWalletBalanceAgg,
        ] = await Promise.all([
            User.countDocuments(userFilter),
            User.countDocuments({ ...userFilter, isActive: true }),
            Market.countDocuments(),
            Payment.countDocuments({ ...paymentFilter, ...dateMatch, status: 'pending' }),
            Bet.countDocuments({ ...betFilter, ...dateMatch, status: { $ne: 'cancelled' } }),
            Bet.aggregate([{ $match: { ...betFilter, ...dateMatch, status: { $ne: 'cancelled' } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
            Bet.aggregate([{ $match: { ...betFilter, ...dateMatch, status: 'won' } }, { $group: { _id: null, total: { $sum: '$payout' } } }]),
            Wallet.aggregate([...(bookieUserIds !== null ? [{ $match: { userId: { $in: bookieUserIds } } }] : []), { $group: { _id: null, total: { $sum: '$balance' } } }]),
        ]);

        const revenue = Number(totalRevenueAgg?.[0]?.total || 0);
        const payouts = Number(totalPayoutAgg?.[0]?.total || 0);
        const payload = {
            users: { total: totalUsers, active: activeUsers },
            markets: { total: totalMarkets },
            bets: { total: totalBets },
            payments: { pending: pendingPayments },
            wallet: { totalBalance: Number(totalWalletBalanceAgg?.[0]?.total || 0) },
            revenue: {
                total: revenue,
                payouts,
                netProfit: revenue - payouts,
            },
            dateRange: {
                from: rangeStart ? rangeStart.toISOString() : null,
                to: rangeEnd ? rangeEnd.toISOString() : null,
            },
        };
        await cacheSet(cacheKey, payload, DASHBOARD_CACHE_TTL_SECONDS);
        return payload;
        })();
        DASHBOARD_SUMMARY_INFLIGHT.set(cacheKey, computePromise);
        try {
            const payload = await computePromise;
            return res.status(200).json({ success: true, data: payload });
        } finally {
            DASHBOARD_SUMMARY_INFLIGHT.delete(cacheKey);
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getDashboardPerfMetrics = async (req, res) => {
    try {
        if (req.admin?.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Super admin access required',
            });
        }
        return res.status(200).json({
            success: true,
            data: {
                cache: getCacheMetrics(),
                runtime: getRuntimeMetrics(),
                trace: getTraceMetrics(),
                sampledAt: new Date().toISOString(),
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

function parseTimeToMinutes(timeStr) {
    if (!timeStr) return null;
    const [hour, min] = timeStr.split(':').map(Number);
    if (hour >= 0 && hour < 24 && min >= 0 && min < 60) {
        return hour * 60 + min;
    }
    return null;
}
