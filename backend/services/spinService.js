/**
 * Spin service: Validate -> Exposure check -> Spin (RNG) -> Payout -> Persist.
 */
import crypto from 'crypto';
import mongoose from 'mongoose';
import User from '../models/user/user.js';
import { Wallet, WalletTransaction } from '../models/wallet/wallet.js';
import RouletteGame from '../models/rouletteGame/rouletteGame.js';
import RouletteStats, { getStats, incrementSpin } from '../models/rouletteGame/RouletteStats.js';
import { getConfig as getRouletteConfig } from '../models/rouletteGame/rouletteConfig.js';
import RouletteSeedCycle from '../models/rouletteGame/RouletteSeedCycle.js';
import HouseReserve, { getReserve, addHouseProfit } from '../models/rouletteGame/HouseReserve.js';
import RouletteAuditLog, { getNextSequenceId, hashRecord } from '../models/rouletteGame/RouletteAuditLog.js';
import { spin } from '../engine/wheel.js';
import { calculatePayout, validateBets, maxPayoutForBets } from '../engine/payout.js';
import { runExposureChecks } from '../engine/exposure.js';
import { getOperationalPolicyState } from '../engine/operationalPolicy.js';
import { getWinningNumberFromSeeds } from '../engine/provablyFair.js';
import { recordSpinForUser } from '../middleware/rouletteAntiAbuse.js';

const SPIN_COOLDOWN_MS = 2000;
const lastSpinByUser = new Map();

function sha256(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

function canonicalSpinData(payload) {
    return JSON.stringify({
        userId: payload.userId,
        bets: payload.bets,
        totalBet: payload.totalBet,
        preSpinBalance: payload.preSpinBalance,
        timestamp: payload.timestamp,
    });
}

export async function executeSpin(body) {
    const { userId, bets, idempotencyKey, clientSeed, nonce } = body || {};
    if (!userId) return { success: false, message: 'userId is required' };
    const effectiveIdempotencyKey = (idempotencyKey && String(idempotencyKey).trim()) ? String(idempotencyKey).trim() : crypto.randomUUID();
    const spinId = crypto.randomUUID();

    const validation = validateBets(bets);
    if (!validation.valid) return { success: false, message: validation.error };

    const totalBet = bets.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
    if (totalBet <= 0) return { success: false, message: 'Total bet must be greater than 0' };

    const now = Date.now();
    const last = lastSpinByUser.get(userId);
    if (last != null && now - last < SPIN_COOLDOWN_MS) {
        return { success: false, message: 'Please wait a moment before spinning again', code: 'RATE_LIMIT' };
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const user = await User.findById(userId).session(session).select('isActive gamesPlayed gamesWon totalWagered totalWon biggestWin');
        if (!user) {
            await session.abortTransaction();
            return { success: false, message: 'User not found' };
        }
        if (user.isActive === false) {
            await session.abortTransaction();
            return { success: false, message: 'Account is blocked' };
        }

        let wallet = await Wallet.findOne({ userId }).session(session);
        if (!wallet) {
            wallet = new Wallet({ userId, balance: 0 });
            await wallet.save({ session });
        }
        if (wallet.balance < totalBet) {
            await session.abortTransaction();
            return { success: false, message: 'Insufficient balance' };
        }

        const existing = await RouletteGame.findOne({ user: userId, idempotencyKey: effectiveIdempotencyKey }).session(session).lean();
        if (existing) {
            await session.abortTransaction();
            const walletNow = await Wallet.findOne({ userId }).lean();
            return {
                success: true,
                data: {
                    spinId: existing.spinId,
                    winningNumber: existing.winningNumber,
                    payout: existing.payout,
                    balance: walletNow?.balance ?? 0,
                    profit: existing.profit,
                    idempotent: true,
                },
            };
        }

        const config = await getRouletteConfig();
        const stats = await getStats(session);
        const houseBankroll = config?.houseReserve ?? 1e9;
        const reserveDoc = await getReserve(session);
        let reserveBalance = reserveDoc?.balance ?? 0;
        // When reserve was never seeded (0) or no config doc exists, use houseReserve fallback so the table is not halted
        if (reserveBalance <= 0) {
            reserveBalance = config?.houseReserve ?? houseBankroll;
        }
        const maxPayoutThisSpin = maxPayoutForBets(bets);
        const policy = getOperationalPolicyState(config, reserveBalance, maxPayoutThisSpin);

        if (policy.tableHalted) {
            await session.abortTransaction();
            return { success: false, message: policy.reason || 'Table temporarily unavailable' };
        }
        if (policy.highRiskFrozen && bets.some(b => String(b?.type || '').toLowerCase() === 'number')) {
            await session.abortTransaction();
            return { success: false, message: 'High-risk bet types are temporarily disabled' };
        }

        const effectiveMaxStraightUp = policy.effectiveMaxStraightUpPerNumber ?? config?.maxStraightUpPerNumber;
        const exposureContext = {
            houseBankroll,
            riskFactor: config?.riskFactor ?? 0.1,
            tableLiabilityCap: config?.tableLiabilityCap,
            currentTableLiability: 0,
            maxStraightUpPerNumber: effectiveMaxStraightUp,
            perBetTypeLimits: config?.perBetTypeLimits,
            kellyFraction: config?.kellyFraction,
            maxExposurePct: config?.maxExposurePctOfBankroll ?? 0.025,
            existingNumberExposure: {},
        };
        const exposure = runExposureChecks(bets, exposureContext);
        if (!exposure.allowed) {
            await session.abortTransaction();
            return { success: false, message: exposure.errors[0] || 'Exposure limit exceeded' };
        }

        const preSpinBalance = wallet.balance;
        wallet.balance -= totalBet;
        await wallet.save({ session });

        await WalletTransaction.create([{
            userId,
            type: 'debit',
            amount: totalBet,
            description: 'Roulette bet',
        }], { session });

        let winningNumber;
        let serverSeedHash = null;
        const useProvablyFair = config?.provablyFairEnabled && clientSeed != null && String(nonce) !== '';
        if (useProvablyFair) {
            const cycle = await RouletteSeedCycle.getActiveCycle(session);
            if (cycle?.serverSeed) {
                winningNumber = getWinningNumberFromSeeds(cycle.serverSeed, String(clientSeed), Number(nonce));
                serverSeedHash = cycle.serverSeedHash;
            } else {
                winningNumber = spin();
            }
        } else {
            winningNumber = spin();
        }
        const payout = calculatePayout(bets, winningNumber);

        wallet.balance += payout;
        await wallet.save({ session });

        if (payout > 0) {
            await WalletTransaction.create([{
                userId,
                type: 'credit',
                amount: payout,
                description: 'Roulette win',
            }], { session });
        }

        user.gamesPlayed = (user.gamesPlayed || 0) + 1;
        user.totalWagered = (user.totalWagered || 0) + totalBet;
        if (payout > 0) {
            user.gamesWon = (user.gamesWon || 0) + 1;
            user.totalWon = (user.totalWon || 0) + payout;
            user.biggestWin = Math.max(user.biggestWin || 0, payout);
        }
        await user.save({ session });

        await incrementSpin(totalBet, payout, session);

        const profit = payout - totalBet;
        const houseProfit = totalBet - payout;
        await addHouseProfit(houseProfit, session);

        const auditPayload = { userId, bets, totalBet, preSpinBalance, timestamp: new Date().toISOString() };
        const spinDataHash = sha256(canonicalSpinData(auditPayload));
        const payloadHash = sha256(JSON.stringify({ spinId, totalBet, payout, winningNumber, userId: userId.toString() }));

        const sequenceId = await getNextSequenceId(session);
        const lastLog = await RouletteAuditLog.findOne().session(session).sort({ sequenceId: -1 }).select('recordHash').lean();
        const previousRecordHash = lastLog?.recordHash ?? '0';
        const timestamp = new Date();
        const recordHash = hashRecord(sequenceId, spinId, previousRecordHash, timestamp, payloadHash);
        await RouletteAuditLog.create([{
            sequenceId,
            spinId,
            previousRecordHash,
            recordHash,
            timestamp,
            payloadHash,
            payload: { userId: userId.toString(), totalBet, payout, winningNumber },
        }], { session });

        const totalWageredAfter = (stats?.totalWagered ?? 0) + totalBet;
        const totalPaidAfter = (stats?.totalPaid ?? 0) + payout;
        const rtpSnapshot = totalWageredAfter > 0 ? totalPaidAfter / totalWageredAfter : null;

        await RouletteGame.create([{
            spinId,
            user: userId,
            bets,
            winningNumber,
            totalBet,
            payout,
            profit,
            spinDataHash,
            preSpinBankrollSnapshot: preSpinBalance,
            betStructure: JSON.parse(JSON.stringify(bets)),
            idempotencyKey: effectiveIdempotencyKey,
            clientSeed: clientSeed != null ? String(clientSeed) : undefined,
            nonce: nonce != null ? Number(nonce) : undefined,
            serverSeedHash: serverSeedHash ?? undefined,
            rtpSnapshot: rtpSnapshot != null ? Math.round(rtpSnapshot * 1e6) / 1e6 : undefined,
            rngEntropyRef: serverSeedHash ? 'provably_fair' : 'crypto',
        }], { session });

        lastSpinByUser.set(userId, now);
        recordSpinForUser(userId.toString());
        await session.commitTransaction();

        return {
            success: true,
            data: {
                spinId,
                winningNumber,
                payout,
                balance: wallet.balance,
                profit,
            },
        };
    } catch (err) {
        await session.abortTransaction().catch(() => {});
        return { success: false, message: err.message || 'Spin failed' };
    } finally {
        session.endSession();
    }
}
