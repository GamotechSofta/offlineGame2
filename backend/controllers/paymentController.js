import Payment from '../models/payment/payment.js';
import BankDetail from '../models/bankDetail/bankDetail.js';
import { Wallet } from '../models/wallet/wallet.js';
import Admin from '../models/admin/admin.js';
import bcrypt from 'bcryptjs';
import { getBookieUserIds } from '../utils/bookieFilter.js';
import { logActivity, getClientIp } from '../utils/activityLogger.js';
import { uploadToCloudinary } from '../config/cloudinary.js';

// ============ CONFIG API ============

/**
 * Get payment configuration (UPI details, limits)
 * Public API - no auth required
 */
export const getPaymentConfig = async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            data: {
                upiId: process.env.UPI_ID || 'example@paytm',
                upiName: process.env.UPI_NAME || 'Golden Games',
                minDeposit: parseInt(process.env.MIN_DEPOSIT) || 100,
                maxDeposit: parseInt(process.env.MAX_DEPOSIT) || 50000,
                minWithdrawal: parseInt(process.env.MIN_WITHDRAWAL) || 500,
                maxWithdrawal: parseInt(process.env.MAX_WITHDRAWAL) || 25000,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============ USER APIs ============

/**
 * User: Create deposit request with screenshot
 */
export const createDepositRequest = async (req, res) => {
    try {
        const { amount, upiTransactionId, userNote } = req.body;
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const minDeposit = parseInt(process.env.MIN_DEPOSIT) || 100;
        const maxDeposit = parseInt(process.env.MAX_DEPOSIT) || 50000;

        // Parse amount as number
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount)) {
            console.error('❌ Invalid amount:', amount);
            return res.status(400).json({
                success: false,
                message: 'Invalid amount. Please enter a valid number.',
            });
        }

        if (!numAmount || numAmount < minDeposit || numAmount > maxDeposit) {
            console.error('❌ Amount out of range:', numAmount);
            return res.status(400).json({
                success: false,
                message: `Amount must be between ₹${minDeposit} and ₹${maxDeposit}`,
            });
        }

        // Upload screenshot to Cloudinary
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Screenshot is required for deposit requests.',
            });
        }

        if (!req.file.buffer) {
            return res.status(400).json({
                success: false,
                message: 'Invalid file. Please upload a valid image file.',
            });
        }

        // Upload screenshot to Cloudinary
        let screenshotUrl = null;
        try {
            // Check if Cloudinary is configured
            const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
            const apiKey = process.env.CLOUDINARY_API_KEY;
            const apiSecret = process.env.CLOUDINARY_API_SECRET;
            
            if (!cloudName || !apiKey || !apiSecret) {
                console.error('❌ Cloudinary credentials not configured');
                console.error('Missing variables:');
                if (!cloudName) console.error('  - CLOUDINARY_CLOUD_NAME');
                if (!apiKey) console.error('  - CLOUDINARY_API_KEY');
                if (!apiSecret) console.error('  - CLOUDINARY_API_SECRET');
                console.error('\n💡 Solution: Create Games/backend/.env with Cloudinary credentials from https://console.cloudinary.com/');
                console.error('   CLOUDINARY_CLOUD_NAME=your_cloud_name');
                console.error('   CLOUDINARY_API_KEY=your_api_key');
                console.error('   CLOUDINARY_API_SECRET=your_api_secret');
                console.error('\n   Then restart the backend server.\n');
                
                return res.status(500).json({
                    success: false,
                    message: 'Server configuration error: Cloudinary credentials not set. Please check backend .env file and restart server.',
                });
            }

            console.log('☁️ Uploading to Cloudinary...');
            const uploadResult = await uploadToCloudinary(req.file.buffer, 'payments');
            screenshotUrl = uploadResult.secure_url;
        } catch (uploadError) {
            console.error('❌ Cloudinary upload error:', uploadError);
            console.error('Error details:', {
                message: uploadError.message,
                name: uploadError.name,
                stack: uploadError.stack
            });
            return res.status(500).json({
                success: false,
                message: uploadError.message || 'Failed to upload screenshot. Please try again.',
            });
        }

        console.log('💾 Creating payment record...');
        const payment = await Payment.create({
            userId,
            type: 'deposit',
            amount: numAmount,
            method: 'upi',
            status: 'pending',
            screenshotUrl: screenshotUrl,
            upiTransactionId: upiTransactionId || '',
            userNote: userNote || '',
        });
        console.log('✅ Payment created:', payment._id);

        await logActivity({
            action: 'deposit_request_created',
            performedBy: userId,
            performedByType: 'user',
            targetType: 'payment',
            targetId: payment._id.toString(),
            details: `Deposit request ₹${amount} created`,
            ip: getClientIp(req),
        });

        console.log('✅ Deposit request completed successfully');
        res.status(201).json({
            success: true,
            message: 'Deposit request submitted successfully. Please wait for admin approval.',
            data: payment,
        });
    } catch (error) {
        console.error('❌ Deposit request error:', error);
        console.error('Error stack:', error.stack);
        console.error('Error details:', {
            message: error.message,
            name: error.name,
            code: error.code
        });
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Internal server error. Please try again later.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * User: Create withdrawal request
 */
export const createWithdrawalRequest = async (req, res) => {
    try {
        const userId = req.userId;
        const { amount, bankDetailId, userNote } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const minWithdrawal = parseInt(process.env.MIN_WITHDRAWAL) || 500;
        const maxWithdrawal = parseInt(process.env.MAX_WITHDRAWAL) || 25000;

        if (!amount || amount < minWithdrawal || amount > maxWithdrawal) {
            return res.status(400).json({
                success: false,
                message: `Amount must be between ₹${minWithdrawal} and ₹${maxWithdrawal}`,
            });
        }

        // Check wallet balance
        const wallet = await Wallet.findOne({ userId });
        if (!wallet || wallet.balance < amount) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient wallet balance',
            });
        }

        // Validate bank detail if provided
        if (bankDetailId) {
            const bankDetail = await BankDetail.findOne({ _id: bankDetailId, userId, isActive: true });
            if (!bankDetail) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid bank account selected',
                });
            }
        }

        // Check for pending withdrawal
        const pendingWithdrawal = await Payment.findOne({
            userId,
            type: 'withdrawal',
            status: 'pending',
        });

        if (pendingWithdrawal) {
            return res.status(400).json({
                success: false,
                message: 'You already have a pending withdrawal request. Please wait for it to be processed.',
            });
        }

        const payment = await Payment.create({
            userId,
            type: 'withdrawal',
            amount,
            method: 'bank_transfer',
            status: 'pending',
            bankDetailId: bankDetailId || null,
            userNote: userNote || '',
        });

        await logActivity({
            action: 'withdrawal_request_created',
            performedBy: userId,
            performedByType: 'user',
            targetType: 'payment',
            targetId: payment._id.toString(),
            details: `Withdrawal request ₹${amount} created`,
            ip: getClientIp(req),
        });

        res.status(201).json({
            success: true,
            message: 'Withdrawal request submitted successfully. Please wait for admin approval.',
            data: payment,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * User: Get my deposit history. Requires verifyUser (JWT).
 */
export const getMyDeposits = async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const deposits = await Payment.find({ userId, type: 'deposit' })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        // Process deposits - use Cloudinary URL if available, otherwise fallback to buffer endpoint
        const depositsWithScreenshotUrl = deposits.map(deposit => {
            const depositObj = { ...deposit };
            // If screenshotUrl exists (Cloudinary), use it directly
            // Otherwise, if old buffer exists, use the endpoint
            if (!depositObj.screenshotUrl && deposit.screenshot && deposit.screenshot.data) {
                depositObj.screenshotUrl = `/api/v1/payments/my-screenshot/${deposit._id}`;
            }
            // Remove the actual buffer data from response
            if (depositObj.screenshot) {
                delete depositObj.screenshot.data;
            }
            return depositObj;
        });

        res.status(200).json({ success: true, data: depositsWithScreenshotUrl });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * User: Get my withdrawal history. Requires verifyUser (JWT).
 */
export const getMyWithdrawals = async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const withdrawals = await Payment.find({ userId, type: 'withdrawal' })
            .populate('bankDetailId', 'accountHolderName bankName accountNumber upiId')
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        res.status(200).json({ success: true, data: withdrawals });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============ ADMIN APIs ============

/**
 * Admin: Get all payments with filters
 */
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
            .populate('userId', 'username email phone')
            .populate('bankDetailId', 'accountHolderName bankName accountNumber upiId ifscCode')
            .populate('processedBy', 'username')
            .sort({ createdAt: -1 })
            .limit(1000)
            .lean();

        // Process payments - use Cloudinary URL if available, otherwise fallback to buffer endpoint
        const paymentsWithScreenshotUrl = payments.map(payment => {
            const paymentObj = { ...payment };
            // If screenshotUrl exists (Cloudinary), use it directly
            // Otherwise, if old buffer exists, use the endpoint
            if (!paymentObj.screenshotUrl && payment.screenshot && payment.screenshot.data) {
                paymentObj.screenshotUrl = `/api/v1/payments/${payment._id}/screenshot`;
            }
            // Remove the actual buffer data from response
            if (paymentObj.screenshot) {
                delete paymentObj.screenshot.data;
            }
            return paymentObj;
        });

        res.status(200).json({ success: true, data: paymentsWithScreenshotUrl });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get payment screenshot image
 * For admin: can view any screenshot (via /:id/screenshot)
 * For users: can only view their own screenshots (via /my-screenshot/:id with userId query)
 * 
 * Note: New payments use Cloudinary URLs (screenshotUrl), old payments may have buffer data
 */
export const getPaymentScreenshot = async (req, res) => {
    try {
        const { id } = req.params;
        const payment = await Payment.findById(id).select('screenshot screenshotUrl userId');

        // If not admin (req.admin is undefined), user route: require ownership via req.userId
        if (!req.admin) {
            const userId = req.userId;
            if (!userId || !payment || payment.userId.toString() !== userId) {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }
        }

        // If Cloudinary URL exists, redirect to it
        if (payment && payment.screenshotUrl) {
            return res.redirect(payment.screenshotUrl);
        }

        // Fallback to buffer data for old payments
        if (!payment || !payment.screenshot || !payment.screenshot.data) {
            return res.status(404).json({ success: false, message: 'Screenshot not found' });
        }

        res.set('Content-Type', payment.screenshot.contentType || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
        res.send(payment.screenshot.data);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Admin: Get pending payments count
 */
export const getPendingCount = async (req, res) => {
    try {
        const query = { status: 'pending' };
        
        const bookieUserIds = await getBookieUserIds(req.admin);
        if (bookieUserIds !== null) {
            query.userId = { $in: bookieUserIds };
        }

        const depositCount = await Payment.countDocuments({ ...query, type: 'deposit' });
        const withdrawalCount = await Payment.countDocuments({ ...query, type: 'withdrawal' });

        res.status(200).json({
            success: true,
            data: {
                deposits: depositCount,
                withdrawals: withdrawalCount,
                total: depositCount + withdrawalCount,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Admin: Approve payment
 * Body: { adminRemarks?: string, secretDeclarePassword?: string } – secret required if admin has it set
 * Access: Super admin always allowed, bookie allowed if canManagePayments is true
 */
export const approvePayment = async (req, res) => {
    try {
        // Check if admin has permission to manage payments
        const admin = await Admin.findById(req.admin._id);
        if (!admin) {
            return res.status(403).json({ success: false, message: 'Admin not found' });
        }

        // Super admin always has permission, bookie needs canManagePayments
        if (admin.role === 'bookie' && !admin.canManagePayments) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to manage payments. Please contact super admin.',
            });
        }

        const adminWithSecret = await Admin.findById(req.admin._id).select('+secretDeclarePassword').lean();
        if (adminWithSecret?.secretDeclarePassword) {
            const provided = (req.body.secretDeclarePassword ?? '').toString().trim();
            const isValid = await bcrypt.compare(provided, adminWithSecret.secretDeclarePassword);
            if (!isValid) {
                return res.status(403).json({
                    success: false,
                    message: 'Invalid secret declare password',
                    code: 'INVALID_SECRET_DECLARE_PASSWORD',
                });
            }
        }

        const { id } = req.params;
        const { adminRemarks } = req.body;

        const payment = await Payment.findById(id).populate('userId');
        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }

        if (payment.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Payment is not pending' });
        }

        // For withdrawals, check balance again
        if (payment.type === 'withdrawal') {
            const wallet = await Wallet.findOne({ userId: payment.userId._id });
            if (!wallet || wallet.balance < payment.amount) {
                return res.status(400).json({
                    success: false,
                    message: 'User has insufficient balance for this withdrawal',
                });
            }
        }

        // Update payment status
        payment.status = 'approved';
        payment.adminRemarks = adminRemarks || 'Approved';
        payment.processedBy = req.admin._id;
        payment.processedAt = new Date();
        await payment.save();

        // Update wallet
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

        await logActivity({
            action: `payment_${payment.type}_approved`,
            performedBy: req.admin?.username || 'Admin',
            performedByType: req.admin?.role || 'admin',
            targetType: 'payment',
            targetId: id,
            details: `${payment.type === 'deposit' ? 'Deposit' : 'Withdrawal'} ₹${payment.amount} approved for "${payment.userId?.username}"`,
            meta: { paymentId: id, type: payment.type, amount: payment.amount },
            ip: getClientIp(req),
        });

        res.status(200).json({
            success: true,
            message: `${payment.type === 'deposit' ? 'Deposit' : 'Withdrawal'} approved successfully`,
            data: payment,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Admin: Reject payment
 * Access: Super admin always allowed, bookie allowed if canManagePayments is true
 */
export const rejectPayment = async (req, res) => {
    try {
        // Check if admin has permission to manage payments
        const admin = await Admin.findById(req.admin._id);
        if (!admin) {
            return res.status(403).json({ success: false, message: 'Admin not found' });
        }

        // Super admin always has permission, bookie needs canManagePayments
        if (admin.role === 'bookie' && !admin.canManagePayments) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to manage payments. Please contact super admin.',
            });
        }

        const { id } = req.params;
        const { adminRemarks } = req.body;

        const payment = await Payment.findById(id).populate('userId');
        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }

        if (payment.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Payment is not pending' });
        }

        payment.status = 'rejected';
        payment.adminRemarks = adminRemarks || 'Rejected';
        payment.processedBy = req.admin._id;
        payment.processedAt = new Date();
        await payment.save();

        await logActivity({
            action: `payment_${payment.type}_rejected`,
            performedBy: req.admin?.username || 'Admin',
            performedByType: req.admin?.role || 'admin',
            targetType: 'payment',
            targetId: id,
            details: `${payment.type === 'deposit' ? 'Deposit' : 'Withdrawal'} ₹${payment.amount} rejected for "${payment.userId?.username}"`,
            meta: { paymentId: id, type: payment.type, amount: payment.amount, reason: adminRemarks },
            ip: getClientIp(req),
        });

        res.status(200).json({
            success: true,
            message: `${payment.type === 'deposit' ? 'Deposit' : 'Withdrawal'} rejected`,
            data: payment,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Legacy: Update payment status (kept for backward compatibility)
 */
export const updatePaymentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, adminRemarks } = req.body;

        if (status === 'approved') {
            req.body.adminRemarks = adminRemarks;
            return approvePayment(req, res);
        } else if (status === 'rejected') {
            req.body.adminRemarks = adminRemarks;
            return rejectPayment(req, res);
        }

        const payment = await Payment.findById(id).populate('userId');
        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }

        payment.status = status;
        if (adminRemarks) payment.adminRemarks = adminRemarks;
        payment.processedBy = req.admin._id;
        payment.processedAt = new Date();
        await payment.save();

        res.status(200).json({ success: true, data: payment });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
