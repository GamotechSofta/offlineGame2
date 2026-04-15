import User from '../../models/user/user.js';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Wallet, WalletTransaction } from '../../models/wallet/wallet.js';

dotenv.config();

const DEFAULT_PARTNER_TOKEN = 'partner-token';
const DEFAULT_CURRENCY = 'INR';
const DEFAULT_START_BALANCE = 10000;

const isAutoCreateUsersEnabled = () => {
    const raw = String(process.env.AUTO_CREATE_USERS ?? 'true').trim().toLowerCase();
    return ['1', 'true', 'yes', 'y', 'on'].includes(raw);
};

const getPartnerToken = () => String(process.env.PARTNER_TOKEN || DEFAULT_PARTNER_TOKEN);

const parseBearerToken = (authorizationHeader) => {
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
        return '';
    }
    return authorizationHeader.slice(7).trim();
};

const parsePositiveAmount = (amount) => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }
    return parsed;
};

const readPlayerIdFromRequest = (req) => {
    const fromParams = req.params?.playerId;
    const fromBody = req.body?.playerId;
    const fromQuery = req.query?.playerId;
    const raw = fromParams || fromBody || fromQuery || '';
    return String(raw).trim();
};

const sanitizeEmailPart = (value) => value.toLowerCase().replace(/[^a-z0-9._-]/g, '-');

const ensureWalletForPlayer = async (playerId, { autoCreate = isAutoCreateUsersEnabled() } = {}) => {
    const isObjectId = mongoose.Types.ObjectId.isValid(playerId);
    let user = null;

    if (isObjectId) {
        user = await User.findById(playerId);
    } else {
        user = await User.findOne({ username: playerId });
    }

    if (!user && !autoCreate) {
        return { user: null, wallet: null };
    }

    if (!user) {
        const safeId = sanitizeEmailPart(playerId) || 'player';
        const uniqueEmail = `${safeId}-${Date.now()}@mock-wallet.local`;
        user = await User.create({
            username: playerId,
            email: uniqueEmail,
            password: `mock-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
            role: 'user',
        });
    }

    let wallet = await Wallet.findOne({ userId: user._id });
    if (!wallet) {
        wallet = await Wallet.create({
            userId: user._id,
            balance: DEFAULT_START_BALANCE,
        });
    }

    return { user, wallet };
};

export const verifyGenericPartnerAuth = (req, res, next) => {
    const token = parseBearerToken(req.headers.authorization);
    if (!token || token !== getPartnerToken()) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized',
        });
    }
    next();
};

export const getGenericWalletBalance = async (req, res) => {
    try {
        const playerId = readPlayerIdFromRequest(req);
        if (!playerId) {
            return res.status(400).json({
                success: false,
                error: 'playerId is required',
            });
        }

        const { user, wallet } = await ensureWalletForPlayer(playerId);

        if (!wallet) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                playerId: String(user?._id || playerId),
                balance: wallet.balance,
                currency: DEFAULT_CURRENCY,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error',
        });
    }
};

export const genericWalletDebit = async (req, res) => {
    try {
        const { amount, transactionId, roundId, game } = req.body || {};
        const playerId = readPlayerIdFromRequest(req);
        const validAmount = parsePositiveAmount(amount);

        if (!playerId || !transactionId || !String(transactionId).trim() || !validAmount) {
            return res.status(400).json({
                success: false,
                error: 'playerId, transactionId, and valid amount are required',
            });
        }

        const normalizedTransactionId = String(transactionId).trim();
        const { user, wallet } = await ensureWalletForPlayer(playerId);

        if (!user || !wallet) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
            });
        }

        const duplicateTxn = await WalletTransaction.findOne({
            userId: user._id,
            type: 'debit',
            referenceId: normalizedTransactionId,
        }).lean();

        if (duplicateTxn) {
            return res.status(200).json({
                success: true,
                duplicate: true,
                data: {
                    playerId: String(user._id),
                    balance: wallet.balance,
                    transactionId: normalizedTransactionId,
                },
            });
        }

        if (wallet.balance < validAmount) {
            return res.status(400).json({
                success: false,
                error: 'Insufficient balance',
                data: {
                    playerId: String(user._id),
                    balance: wallet.balance,
                },
            });
        }

        wallet.balance -= validAmount;
        await wallet.save();

        await WalletTransaction.create({
            userId: user._id,
            type: 'debit',
            amount: validAmount,
            referenceId: normalizedTransactionId,
            description: `Generic debit | roundId=${roundId || ''} | game=${game || ''}`,
        });

        return res.status(200).json({
            success: true,
            data: {
                playerId: String(user._id),
                balance: wallet.balance,
                transactionId: normalizedTransactionId,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error',
        });
    }
};

export const genericWalletCredit = async (req, res) => {
    try {
        const { amount, transactionId, roundId } = req.body || {};
        const playerId = readPlayerIdFromRequest(req);
        const validAmount = parsePositiveAmount(amount);

        if (!playerId || !transactionId || !String(transactionId).trim() || !validAmount) {
            return res.status(400).json({
                success: false,
                error: 'playerId, transactionId, and valid amount are required',
            });
        }

        const normalizedTransactionId = String(transactionId).trim();
        const { user, wallet } = await ensureWalletForPlayer(playerId);

        if (!user || !wallet) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
            });
        }

        const duplicateTxn = await WalletTransaction.findOne({
            userId: user._id,
            type: 'credit',
            referenceId: normalizedTransactionId,
        }).lean();

        if (duplicateTxn) {
            return res.status(200).json({
                success: true,
                duplicate: true,
                data: {
                    playerId: String(user._id),
                    balance: wallet.balance,
                    transactionId: normalizedTransactionId,
                },
            });
        }

        wallet.balance += validAmount;
        await wallet.save();

        await WalletTransaction.create({
            userId: user._id,
            type: 'credit',
            amount: validAmount,
            referenceId: normalizedTransactionId,
            description: `Generic credit | roundId=${roundId || ''}`,
        });

        return res.status(200).json({
            success: true,
            data: {
                playerId: String(user._id),
                balance: wallet.balance,
                transactionId: normalizedTransactionId,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error',
        });
    }
};
