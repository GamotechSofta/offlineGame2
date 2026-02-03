import { Wallet, WalletTransaction } from '../models/wallet/wallet.js';
import User from '../models/user/user.js';
import { getBookieUserIds } from '../utils/bookieFilter.js';
import { logActivity, getClientIp } from '../utils/activityLogger.js';

export const getAllWallets = async (req, res) => {
    try {
        const query = {};
        const bookieUserIds = await getBookieUserIds(req.admin);
        if (bookieUserIds !== null) {
            query.userId = { $in: bookieUserIds };
        }
        const wallets = await Wallet.find(query)
            .populate('userId', 'username email')
            .sort({ balance: -1 });

        res.status(200).json({ success: true, data: wallets });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getTransactions = async (req, res) => {
    try {
        const { userId } = req.query;
        const query = {};
        const bookieUserIds = await getBookieUserIds(req.admin);
        if (bookieUserIds !== null) {
            query.userId = { $in: bookieUserIds };
        }
        if (userId) {
            query.userId = userId;
        }
        const transactions = await WalletTransaction.find(query)
            .populate('userId', 'username email')
            .sort({ createdAt: -1 })
            .limit(1000);

        res.status(200).json({ success: true, data: transactions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const adjustBalance = async (req, res) => {
    try {
        const { userId, amount, type } = req.body;

        if (!userId || amount == null || amount === '' || !type) {
            return res.status(400).json({
                success: false,
                message: 'userId, amount and type are required',
            });
        }

        const numAmount = Number(amount);
        if (!Number.isFinite(numAmount) || numAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Amount must be a positive number',
            });
        }

        const bookieUserIds = await getBookieUserIds(req.admin);
        if (bookieUserIds !== null && !bookieUserIds.some((id) => String(id) === String(userId))) {
            return res.status(403).json({
                success: false,
                message: 'You can only adjust wallet for your assigned players',
            });
        }

        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            wallet = new Wallet({ userId, balance: 0 });
        }

        if (type === 'credit') {
            wallet.balance += numAmount;
        } else if (type === 'debit') {
            if (wallet.balance < numAmount) {
                return res.status(400).json({
                    success: false,
                    message: 'Insufficient balance',
                });
            }
            wallet.balance -= numAmount;
        } else {
            return res.status(400).json({
                success: false,
                message: 'type must be credit or debit',
            });
        }

        await wallet.save();

        await WalletTransaction.create({
            userId,
            type,
            amount: numAmount,
            description: `Admin ${type}: ₹${numAmount}`,
        });

        const player = await User.findById(userId).select('username').lean();
        if (req.admin) {
            await logActivity({
                action: 'wallet_adjust',
                performedBy: req.admin.username,
                performedByType: req.admin.role || 'admin',
                targetType: 'wallet',
                targetId: String(userId),
                details: `Wallet ${type} ₹${numAmount} for player "${player?.username || userId}"`,
                meta: { userId, amount: numAmount, type },
                ip: getClientIp(req),
            });
        }

        res.status(200).json({ success: true, data: wallet });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Admin: set a user's wallet balance to an exact value.
 * Body: { userId, balance } (balance >= 0)
 */
export const setBalance = async (req, res) => {
    try {
        const { userId, balance } = req.body;

        if (!userId || balance == null || balance === '') {
            return res.status(400).json({
                success: false,
                message: 'userId and balance are required',
            });
        }

        const newBalance = Number(balance);
        if (!Number.isFinite(newBalance) || newBalance < 0) {
            return res.status(400).json({
                success: false,
                message: 'Balance must be a non-negative number',
            });
        }

        const bookieUserIds = await getBookieUserIds(req.admin);
        if (bookieUserIds !== null && !bookieUserIds.some((id) => String(id) === String(userId))) {
            return res.status(403).json({
                success: false,
                message: 'You can only set wallet for your assigned players',
            });
        }

        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            wallet = new Wallet({ userId, balance: 0 });
        }

        const previousBalance = wallet.balance;
        wallet.balance = newBalance;
        await wallet.save();

        const diff = newBalance - previousBalance;
        const type = diff >= 0 ? 'credit' : 'debit';
        await WalletTransaction.create({
            userId,
            type,
            amount: Math.abs(diff),
            description: `Admin set balance to ₹${newBalance} (was ₹${previousBalance})`,
        });

        const player = await User.findById(userId).select('username').lean();
        if (req.admin) {
            await logActivity({
                action: 'wallet_set_balance',
                performedBy: req.admin.username,
                performedByType: req.admin.role || 'admin',
                targetType: 'wallet',
                targetId: String(userId),
                details: `Wallet set to ₹${newBalance} for player "${player?.username || userId}"`,
                meta: { userId, balance: newBalance, previousBalance },
                ip: getClientIp(req),
            });
        }

        res.status(200).json({ success: true, data: wallet });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * User-facing: get current wallet balance by userId (for refresh).
 * Body or query: { userId }
 */
export const getBalance = async (req, res) => {
    try {
        const userId = req.body?.userId || req.query?.userId;
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'userId is required',
            });
        }

        let wallet = await Wallet.findOne({ userId }).lean();
        if (!wallet) {
            wallet = { balance: 0 };
        }
        const balance = wallet.balance ?? 0;
        res.status(200).json({ success: true, data: { balance } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
