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

        if (!userId || !amount || !type) {
            return res.status(400).json({
                success: false,
                message: 'userId, amount and type are required',
            });
        }

        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            wallet = new Wallet({ userId, balance: 0 });
        }

        if (type === 'credit') {
            wallet.balance += amount;
        } else if (type === 'debit') {
            if (wallet.balance < amount) {
                return res.status(400).json({
                    success: false,
                    message: 'Insufficient balance',
                });
            }
            wallet.balance -= amount;
        }

        await wallet.save();

        // Create transaction record
        await WalletTransaction.create({
            userId,
            type,
            amount,
            description: `Admin ${type}: ₹${amount}`,
        });

        const player = await User.findById(userId).select('username').lean();
        if (req.admin) {
            await logActivity({
                action: 'wallet_adjust',
                performedBy: req.admin.username,
                performedByType: req.admin.role || 'admin',
                targetType: 'wallet',
                targetId: String(userId),
                details: `Wallet ${type} ₹${amount} for player "${player?.username || userId}"`,
                meta: { userId, amount, type },
                ip: getClientIp(req),
            });
        }

        res.status(200).json({ success: true, data: wallet });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
