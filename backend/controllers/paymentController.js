import mongoose from 'mongoose';
import Payment from '../models/payment/payment.js';
import BankDetail from '../models/bankDetail/bankDetail.js';
import { Wallet, WalletTransaction } from '../models/wallet/wallet.js';
import Admin from '../models/admin/admin.js';
import bcrypt from 'bcryptjs';
import { getBookieUserIds } from '../utils/bookieFilter.js';
import { logActivity, getClientIp } from '../utils/activityLogger.js';
import { uploadToCloudinary } from '../config/cloudinary.js';
import { invalidateAdminPaymentRelatedCaches } from '../services/cacheInvalidationService.js';
import { notifyPlayerWalletBalance } from '../utils/playerWalletNotify.js';

/** IST calendar day bounds → UTC Date (same semantics as dashboard stats `from`/`to`). */
function parseIstPaymentsCreatedAtRange(fromStr, toStr) {
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
    if (!from || !to) return null;
    const IST_OFFSET_MINUTES = 330;
    const startUtcMs = Date.UTC(from.y, from.m - 1, from.d, 0, 0, 0, 0) - (IST_OFFSET_MINUTES * 60 * 1000);
    const nextDayUtcMs = Date.UTC(to.y, to.m - 1, to.d + 1, 0, 0, 0, 0) - (IST_OFFSET_MINUTES * 60 * 1000);
    return { start: new Date(startUtcMs), end: new Date(nextDayUtcMs - 1) };
}

const SCREENSHOT_WEBHOOK_URL =
    process.env.SCREENSHOT_WEBHOOK_URL || 'https://api.thefashionista.in/api/v1/webhook/screenshot-uploaded';

const buildScreenshotWebhookHeaders = () => {
    const headers = { 'Content-Type': 'application/json' };
    const secret = process.env.WEBHOOK_SECRET;
    if (secret) {
        headers['x-webhook-secret'] = secret;
        headers['webhook-secret'] = secret;
        headers.Authorization = `Bearer ${secret}`;
    }
    return headers;
};

/** POST { refId, screenshotUrl, amount, utr } to partner screenshot-uploaded webhook. */
const notifyScreenshotWebhook = async ({ refId, screenshotUrl, amount, utr }) => {
    try {
        const payload = {
            refId,
            screenshotUrl,
            amount,
            utr,
        };

        console.log('---------------- WEBHOOK LOG START ----------------');
        console.log('Webhook URL:', SCREENSHOT_WEBHOOK_URL);
        console.log('📤 Sending data to webhook...');
        console.log('Webhook payload:', JSON.stringify(payload));
        if (!process.env.WEBHOOK_SECRET) {
            console.warn('WEBHOOK_SECRET not set — sending payload without auth headers');
        }

        const controller = new AbortController();
        const timeoutMs = Number(process.env.WEBHOOK_FORWARD_TIMEOUT_MS || 8000);
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        let response;
        try {
            response = await fetch(SCREENSHOT_WEBHOOK_URL, {
                method: 'POST',
                headers: buildScreenshotWebhookHeaders(),
                body: JSON.stringify(payload),
                signal: controller.signal,
            });
        } finally {
            clearTimeout(timeout);
        }

        const responseBody = await response.text();
        console.log('Webhook response status:', response.status);
        console.log('Webhook response body:', responseBody || '(empty)');

        if (!response.ok) {
            let parsedMsg = responseBody;
            try {
                const j = JSON.parse(responseBody);
                if (j && typeof j.message === 'string') parsedMsg = j.message;
            } catch {
                /* keep raw body */
            }
            console.error('❌ Webhook HTTP error:', response.status, response.statusText || '', '-', parsedMsg);
            if (response.status === 401 || response.status === 403) {
                console.error(
                    '   Fix: set WEBHOOK_SECRET in backend .env to the exact secret Fashionista gave you for this webhook, then restart the server.'
                );
            }
            console.log('---------------- WEBHOOK LOG END ------------------');
            return { ok: false, status: response.status, message: String(parsedMsg).slice(0, 500) };
        }

        console.log('✅ Data is submitted successfully in webhook');
        console.log('---------------- WEBHOOK LOG END ------------------');
        return { ok: true, status: response.status };
    } catch (error) {
        console.error('Webhook error:', error.message);
        console.error('❌ Data is not submitted in the webhook (network/timeout or invalid URL)');
        console.log('---------------- WEBHOOK LOG END ------------------');
        return { ok: false, status: null, message: error.message };
    }
};

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

        const utr = String(upiTransactionId || '').trim();
        if (!/^\d{12}$/.test(utr)) {
            return res.status(400).json({
                success: false,
                message: 'UTR / Transaction ID must be exactly 12 digits',
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
            upiTransactionId: utr,
            userNote: userNote || '',
        });
        payment.webhookRefId = `upload_${payment._id}`;
        await payment.save();
        await invalidateAdminPaymentRelatedCaches('deposit_request_created');
        console.log('✅ Payment created:', payment._id);
        console.log('---------------- DEPOSIT LOG START ----------------');
        console.log('Saved deposit data:', JSON.stringify({
            id: String(payment._id),
            refId: payment.webhookRefId || `upload_${payment._id}`,
            screenshotUrl: payment.screenshotUrl || '',
            amount: Number(payment.amount || 0),
            utr: payment.upiTransactionId || '',
        }));

        await notifyScreenshotWebhook({
            refId: payment.webhookRefId || `upload_${payment._id}`,
            screenshotUrl,
            amount: numAmount,
            utr,
        });
        console.log('---------------- DEPOSIT LOG END ------------------');

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

        const uid = new mongoose.Types.ObjectId(userId);
        const session = await mongoose.startSession();
        session.startTransaction();
        let payment;
        let newBalance;
        try {
            const walletUpdate = await Wallet.findOneAndUpdate(
                { userId: uid, balance: { $gte: amount } },
                { $inc: { balance: -amount } },
                { new: true, session },
            ).lean();
            if (!walletUpdate) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    success: false,
                    message: 'Insufficient wallet balance',
                });
            }
            const [created] = await Payment.create([{
                userId: uid,
                type: 'withdrawal',
                amount,
                method: 'bank_transfer',
                status: 'pending',
                bankDetailId: bankDetailId ? new mongoose.Types.ObjectId(bankDetailId) : null,
                userNote: userNote || '',
                withdrawalWalletHeld: true,
            }], { session });
            payment = created;
            newBalance = Number(walletUpdate.balance || 0);
            await WalletTransaction.create([{
                userId: uid,
                type: 'debit',
                amount,
                description: 'Withdrawal request — funds held until admin approves or rejects',
                referenceId: String(created._id),
            }], { session });
            await session.commitTransaction();
        } catch (txnErr) {
            await session.abortTransaction();
            throw txnErr;
        } finally {
            session.endSession();
        }

        await invalidateAdminPaymentRelatedCaches('withdrawal_request_created');

        await notifyPlayerWalletBalance(userId, 'withdrawal_requested');

        await logActivity({
            action: 'withdrawal_request_created',
            performedBy: userId,
            performedByType: 'user',
            targetType: 'payment',
            targetId: payment._id.toString(),
            details: `Withdrawal request ₹${amount} created (wallet held)`,
            ip: getClientIp(req),
        });

        res.status(201).json({
            success: true,
            message: 'Withdrawal request submitted. Amount has been deducted from your wallet; it will be processed after admin approval.',
            data: {
                ...(typeof payment.toObject === 'function' ? payment.toObject() : payment),
                walletBalance: newBalance,
            },
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
        const fromQ = typeof req.query.from === 'string' ? req.query.from.trim() : '';
        const toQ = typeof req.query.to === 'string' ? req.query.to.trim() : '';
        const userIdRaw = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(10, parseInt(req.query.limit, 10) || 50));
        const skip = (page - 1) * limit;
        const query = {};

        if ((fromQ && !toQ) || (!fromQ && toQ)) {
            return res.status(400).json({
                success: false,
                message: 'Both from and to are required for a date range (YYYY-MM-DD, IST).',
            });
        }
        if (fromQ && toQ) {
            if (fromQ > toQ) {
                return res.status(400).json({ success: false, message: 'from must be on or before to.' });
            }
            const bounds = parseIstPaymentsCreatedAtRange(fromQ, toQ);
            if (!bounds) {
                return res.status(400).json({ success: false, message: 'Invalid from/to. Use YYYY-MM-DD (IST).' });
            }
            query.createdAt = { $gte: bounds.start, $lte: bounds.end };
        }

        const bookieUserIds = await getBookieUserIds(req.admin);
        if (userIdRaw) {
            if (!mongoose.Types.ObjectId.isValid(userIdRaw)) {
                return res.status(400).json({ success: false, message: 'Invalid userId' });
            }
            if (bookieUserIds !== null) {
                const allowed = bookieUserIds.some((id) => String(id) === userIdRaw);
                if (!allowed) {
                    return res.status(403).json({ success: false, message: 'You can only view payments for your players' });
                }
            }
            query.userId = new mongoose.Types.ObjectId(userIdRaw);
        } else if (bookieUserIds !== null) {
            query.userId = { $in: bookieUserIds };
        }
        if (status) query.status = status;
        if (type) query.type = type;

        const [payments, total] = await Promise.all([
            Payment.find(query)
                .select('userId type amount method status screenshot screenshotUrl upiTransactionId webhookRefId userNote adminRemarks processedBy processedAt bankDetailId createdAt updatedAt')
                .populate('userId', 'username email phone')
                .populate('bankDetailId', 'accountHolderName bankName accountNumber upiId ifscCode')
                .populate('processedBy', 'username')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Payment.countDocuments(query),
        ]);

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

        res.status(200).json({
            success: true,
            data: paymentsWithScreenshotUrl,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / limit)),
                hasNextPage: skip + paymentsWithScreenshotUrl.length < total,
                hasPrevPage: page > 1,
            },
        });
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

        // Bookie can only process their own players' payment requests.
        if (
            admin.role === 'bookie' &&
            String(payment.userId?.referredBy || '') !== String(admin._id)
        ) {
            return res.status(403).json({
                success: false,
                message: 'You can only process payments for your own players',
            });
        }

        let updatedBookieBalance = null;
        let deductedBookieId = null;

        // Deduct from the owner bookie when payment management is enabled for that bookie.
        // This keeps behavior correct even if approval comes via different admin route.
        if (payment.type === 'deposit') {
            const ownerBookieId = payment.userId?.referredBy;
            if (ownerBookieId) {
                const ownerBookie = await Admin.findById(ownerBookieId).select('role canManagePayments');
                if (ownerBookie && ownerBookie.role === 'bookie' && ownerBookie.canManagePayments) {
                    const updatedBookie = await Admin.findOneAndUpdate(
                        { _id: ownerBookie._id, balance: { $gte: payment.amount } },
                        { $inc: { balance: -payment.amount } },
                        { new: true }
                    ).select('balance');

                    if (!updatedBookie) {
                        return res.status(400).json({
                            success: false,
                            message: 'Insufficient bookie balance to approve this add-fund request',
                        });
                    }
                    deductedBookieId = String(ownerBookie._id);
                    updatedBookieBalance = Number(updatedBookie.balance || 0);
                }
            }
        }

        // For withdrawals without prior wallet hold (legacy pending), ensure balance still covers the payout.
        if (payment.type === 'withdrawal' && !payment.withdrawalWalletHeld) {
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
        await invalidateAdminPaymentRelatedCaches('payment_approved');

        // Update wallet (deposits credit; legacy withdrawals debit — new withdrawals already debited on request)
        let wallet = await Wallet.findOne({ userId: payment.userId._id });
        if (!wallet) {
            wallet = new Wallet({ userId: payment.userId._id, balance: 0 });
        }

        if (payment.type === 'deposit') {
            wallet.balance += payment.amount;
            await wallet.save();
        } else if (payment.type === 'withdrawal' && !payment.withdrawalWalletHeld) {
            wallet.balance -= payment.amount;
            await wallet.save();
        }

        const walletNotifyUid = payment.userId?._id || payment.userId;
        if (
            walletNotifyUid
            && (payment.type === 'deposit' || (payment.type === 'withdrawal' && !payment.withdrawalWalletHeld))
        ) {
            await notifyPlayerWalletBalance(
                walletNotifyUid,
                payment.type === 'deposit' ? 'deposit_approved' : 'withdrawal_approved',
            );
        }

        await logActivity({
            action: `payment_${payment.type}_approved`,
            performedBy: req.admin?.username || 'Admin',
            performedByType: req.admin?.role || 'admin',
            targetType: 'payment',
            targetId: id,
            details: `${payment.type === 'deposit' ? 'Deposit' : 'Withdrawal'} ₹${payment.amount} approved for "${payment.userId?.username}"`,
            meta: {
                paymentId: id,
                type: payment.type,
                amount: payment.amount,
                bookieDeducted: deductedBookieId !== null,
                deductedBookieId,
            },
            ip: getClientIp(req),
        });

        res.status(200).json({
            success: true,
            message: `${payment.type === 'deposit' ? 'Deposit' : 'Withdrawal'} approved successfully`,
            data: payment,
            ...(updatedBookieBalance !== null ? { bookieBalance: updatedBookieBalance } : {}),
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
        await invalidateAdminPaymentRelatedCaches('payment_rejected');

        if (payment.type === 'withdrawal' && payment.withdrawalWalletHeld) {
            const uid = payment.userId._id || payment.userId;
            await Wallet.findOneAndUpdate(
                { userId: uid },
                { $inc: { balance: payment.amount } },
                { upsert: true, new: true },
            );
            await WalletTransaction.create({
                userId: uid,
                type: 'credit',
                amount: payment.amount,
                description: 'Withdrawal rejected — refund of held amount',
                referenceId: String(payment._id),
            });
            await notifyPlayerWalletBalance(uid, 'withdrawal_rejected_refund');
        }

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
        await invalidateAdminPaymentRelatedCaches('payment_status_updated');

        res.status(200).json({ success: true, data: payment });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
