import Payment from '../models/payment/payment.js';
import { Wallet } from '../models/wallet/wallet.js';
import { getBookieUserIds } from '../utils/bookieFilter.js';
import { logActivity, getClientIp } from '../utils/activityLogger.js';

export const getPayments = async (req, res) => {
    try {
        const { status, type } = req.query;
        const query = {};

        const bookieUserIds = await getBookieUserIds(req.admin);
        if (bookieUserIds !== null) {
            query.userId = { $in: bookieUserIds };
        }
        if (status) query.status = status;
        if (type) query.type = type;

        const payments = await Payment.find(query)
            .populate('userId', 'username email')
            .sort({ createdAt: -1 })
            .limit(1000);

        res.status(200).json({ success: true, data: payments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updatePaymentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const payment = await Payment.findById(id).populate('userId');
        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }

        payment.status = status;
        await payment.save();

        // If approved and completed, update wallet
        if (status === 'approved' || status === 'completed') {
            let wallet = await Wallet.findOne({ userId: payment.userId._id });
            if (!wallet) {
                wallet = new Wallet({ userId: payment.userId._id, balance: 0 });
            }

            if (payment.type === 'deposit') {
                wallet.balance += payment.amount;
            } else if (payment.type === 'withdrawal') {
                wallet.balance -= payment.amount;
            }
            await wallet.save();
        }

        await logActivity({
            action: 'payment_status_update',
            performedBy: req.admin?.username || 'Admin',
            performedByType: req.admin?.role || 'admin',
            targetType: 'payment',
            targetId: id,
            details: `Payment ${payment.type} ₹${payment.amount} for "${payment.userId?.username || payment.userId}" updated to ${status}`,
            meta: { paymentId: id, status, type: payment.type, amount: payment.amount },
            ip: getClientIp(req),
        });

        res.status(200).json({ success: true, data: payment });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
