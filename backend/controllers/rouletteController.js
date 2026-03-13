import RouletteGame from '../models/rouletteGame/rouletteGame.js';
import { getStats } from '../models/rouletteGame/RouletteStats.js';
import { getConfig } from '../models/rouletteGame/rouletteConfig.js';
import { getReserve } from '../models/rouletteGame/HouseReserve.js';
import { executeSpin } from '../services/spinService.js';
import { liabilityByNumberAndBetType, exposureRatio } from '../engine/exposureStatus.js';
import { runMonteCarlo } from '../engine/simulator.js';
import { runLiquidityStress } from '../services/liquiditySimulator.js';
import { getCurrentRTP, checkRTPDeviation, EXPECTED_RTP } from '../services/rtpMonitor.js';

/**
 * POST /roulette/spin - body: { userId, bets, idempotencyKey?, clientSeed?, nonce? }
 */
export async function spinRoulette(req, res) {
    try {
        const userId = req.userId || req.body?.userId;
        if (!userId) {
            return res.status(400).json({ success: false, message: 'User not found. Please log in.' });
        }
        const body = { ...req.body, userId };
        const result = await executeSpin(body);
        if (!result.success) {
            const status = result.code === 'RATE_LIMIT' ? 429 : 403;
            return res.status(status).json({ success: false, message: result.message });
        }
        return res.status(200).json({ success: true, data: result.data });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message || 'Spin failed' });
    }
}

/**
 * GET /roulette/stats?userId= - per-user stats (from User model or aggregate)
 */
export async function getRouletteStats(req, res) {
    try {
        const userId = req.userId || req.query?.userId;
        if (!userId) {
            return res.status(400).json({ success: false, message: 'userId required' });
        }
        const games = await RouletteGame.find({ user: userId }).lean();
        const gamesPlayed = games.length;
        const gamesWon = games.filter((g) => g.payout > 0).length;
        const totalWagered = games.reduce((s, g) => s + (g.totalBet || 0), 0);
        const totalWon = games.reduce((s, g) => s + (g.payout || 0), 0);
        const biggestWin = games.length ? Math.max(...games.map((g) => g.payout || 0)) : 0;
        const winRate = gamesPlayed > 0 ? (gamesWon / gamesPlayed) * 100 : 0;
        return res.status(200).json({
            success: true,
            data: {
                gamesPlayed,
                gamesWon,
                totalWagered,
                totalWon,
                biggestWin,
                winRate,
            },
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message || 'Failed to get stats' });
    }
}

/**
 * GET /roulette/history?userId=&limit=10
 */
export async function getRouletteHistory(req, res) {
    try {
        const userId = req.userId || req.query?.userId;
        const limit = Math.min(Number(req.query?.limit) || 10, 100);
        if (!userId) {
            return res.status(400).json({ success: false, message: 'userId required' });
        }
        const list = await RouletteGame.find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .select('spinId winningNumber totalBet payout profit createdAt')
            .lean();
        return res.status(200).json({ success: true, data: list });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message || 'Failed to get history' });
    }
}

/**
 * GET /roulette/config - public config (limits, provablyFairEnabled, etc.)
 */
export async function getRouletteConfig(req, res) {
    try {
        const config = await getConfig();
        return res.status(200).json({
            success: true,
            data: config || {},
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message || 'Failed to get config' });
    }
}

/**
 * GET /roulette/global-stats - global RouletteStats
 */
export async function getGlobalStats(req, res) {
    try {
        const stats = await getStats();
        return res.status(200).json({ success: true, data: stats });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message || 'Failed to get global stats' });
    }
}

/**
 * GET /roulette/proof/:spinId - provably fair proof for a spin (if stored)
 */
export async function getProof(req, res) {
    try {
        const spinId = req.params?.spinId;
        if (!spinId) return res.status(400).json({ success: false, message: 'spinId required' });
        const game = await RouletteGame.findOne({ spinId }).select('spinId serverSeedHash clientSeed nonce winningNumber').lean();
        if (!game) return res.status(404).json({ success: false, message: 'Spin not found' });
        return res.status(200).json({ success: true, data: game });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message || 'Failed to get proof' });
    }
}

/**
 * GET /roulette/exposure-status - liability summary (admin)
 */
export async function getExposureStatus(req, res) {
    try {
        const recent = await RouletteGame.find({}).sort({ createdAt: -1 }).limit(100).lean();
        const { byNumber, byBetType, totalMaxPayout } = liabilityByNumberAndBetType(recent.map((r) => ({ bets: r.bets })));
        const reserveDoc = await getReserve();
        const ratio = exposureRatio(totalMaxPayout, reserveDoc?.balance ?? 0);
        return res.status(200).json({
            success: true,
            data: { byNumber, byBetType, totalMaxPayout, reserveBalance: reserveDoc?.balance ?? 0, exposureRatio: ratio },
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message || 'Failed' });
    }
}

/**
 * GET /roulette/system-health - reserve, config, table halted?
 */
export async function getSystemHealth(req, res) {
    try {
        const [config, reserveDoc] = await Promise.all([getConfig(), getReserve()]);
        const reserve = reserveDoc?.balance ?? 0;
        const haltThreshold = config?.reserveHaltThreshold ?? 0;
        const tableHalted = reserve <= haltThreshold;
        return res.status(200).json({
            success: true,
            data: { reserveBalance: reserve, tableHalted, config: config || {} },
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message || 'Failed' });
    }
}

/**
 * POST /roulette/monte-carlo - body: { bets, numSpins } (admin / internal)
 */
export async function runMonteCarloRoute(req, res) {
    try {
        const { bets, numSpins = 1000 } = req.body || {};
        if (!Array.isArray(bets) || bets.length === 0) {
            return res.status(400).json({ success: false, message: 'bets array required' });
        }
        const n = Math.min(Number(numSpins) || 1000, 50000);
        const result = runMonteCarlo(bets, n);
        return res.status(200).json({ success: true, data: result });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message || 'Failed' });
    }
}

/**
 * POST /roulette/liquidity-stress - body: { bets, numSpins }
 */
export async function runLiquidityStressRoute(req, res) {
    try {
        const { bets, numSpins = 10000 } = req.body || {};
        if (!Array.isArray(bets) || bets.length === 0) {
            return res.status(400).json({ success: false, message: 'bets array required' });
        }
        const result = await runLiquidityStress(bets, Math.min(Number(numSpins) || 10000, 100000));
        return res.status(200).json({ success: true, data: result });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message || 'Failed' });
    }
}

/**
 * GET /roulette/rtp - current RTP (totalPaid/totalWagered). Expected ~97.3%.
 */
export async function getRTP(req, res) {
    try {
        const data = await getCurrentRTP();
        return res.status(200).json({
            success: true,
            data: {
                ...data,
                rtpPercent: data.totalWagered > 0 ? (data.rtp * 100).toFixed(2) : null,
                expectedRtpPercent: (EXPECTED_RTP * 100).toFixed(2),
            },
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message || 'Failed' });
    }
}

/**
 * GET /roulette/rtp-check - RTP deviation check (admin). Triggers alert if RTP deviates from expected.
 */
export async function getRTPCheck(req, res) {
    try {
        const threshold = Number(req.query?.threshold) || 0.05;
        const result = await checkRTPDeviation(threshold);
        return res.status(200).json({ success: true, data: result });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message || 'Failed' });
    }
}
