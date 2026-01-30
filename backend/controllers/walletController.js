import { Wallet, WalletTransaction } from '../models/wallet/wallet.js';
import User from '../models/user/user.js';

export const getAllWallets = async (req, res) => {
    try {
        const wallets = await Wallet.find()
            .populate('userId', 'username email')
            .sort({ balance: -1 });

        res.status(200).json({ success: true, data: wallets });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getTransactions = async (req, res) => {
    try {
        const transactions = await WalletTransaction.find()
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

        res.status(200).json({ success: true, data: wallet });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
