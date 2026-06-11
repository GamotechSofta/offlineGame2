import mongoose from 'mongoose';
import Payment from '../models/payment/payment.js';
import User from '../models/user/user.js';
import BankDetail from '../models/bankDetail/bankDetail.js';
import { Wallet, WalletTransaction } from '../models/wallet/wallet.js';
import Admin from '../models/admin/admin.js';
import bcrypt from 'bcryptjs';
import { getBookieUserIds } from '../utils/bookieFilter.js';
import { logActivity, getClientIp } from '../utils/activityLogger.js';
import { uploadToCloudinary } from '../config/cloudinary.js';
import { invalidateAdminPaymentRelatedCaches } from '../services/cacheInvalidationService.js';
import { notifyPlayerWalletBalance } from '../utils/playerWalletNotify.js';
import { notifyBookiePanelBalance } from '../utils/notifyBookiePanelBalance.js';
import PaymentUiConfig from '../models/settings/PaymentUiConfig.js';
import { enrichPaymentsWithUserReferrerChain } from '../utils/referrerChain.js';

const DEFAULT_UPI_FALLBACK = 'upi@ybl';
const DEFAULT_PAYEE_NAME = 'Golden Games';

function mergePaymentUiFromDoc(doc) {
    const d = doc || {};
    const pickStr = (dbVal, envKey, fallback) => {
        const x = (dbVal ?? '').toString().trim();
        if (x) return x;
        const e = (process.env[envKey] ?? '').toString().trim();
        return e || fallback;
    };
    const pickNum = (dbVal, envKey, fallback) => {
        const n = Number(dbVal);
        if (Number.isFinite(n) && n > 0) return Math.round(n);
        const e = parseInt(process.env[envKey], 10);
        if (Number.isFinite(e) && e > 0) return e;
        return fallback;
    };
    let minDeposit = pickNum(d.minDeposit, 'MIN_DEPOSIT', 100);
    let maxDeposit = pickNum(d.maxDeposit, 'MAX_DEPOSIT', 50000);
    if (minDeposit >= maxDeposit) {
        minDeposit = 100;
        maxDeposit = 50000;
    }
    let minWithdrawal = pickNum(d.minWithdrawal, 'MIN_WITHDRAWAL', 500);
    let maxWithdrawal = pickNum(d.maxWithdrawal, 'MAX_WITHDRAWAL', 25000);
    if (minWithdrawal >= maxWithdrawal) {
        minWithdrawal = 500;
        maxWithdrawal = 25000;
    }
    return {
        upiId: pickStr(d.upiId, 'UPI_ID', DEFAULT_UPI_FALLBACK),
        upiName: pickStr(d.upiName, 'UPI_NAME', DEFAULT_PAYEE_NAME),
        minDeposit,
        maxDeposit,
        minWithdrawal,
        maxWithdrawal,
    };
}

export async function getMergedPublicPaymentConfig() {
    const doc = await PaymentUiConfig.findOne().sort({ updatedAt: -1 }).lean();
    return mergePaymentUiFromDoc(doc);
}

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

/**
 * IST day-range filter for admin payment lists.
 * - Pending: only `createdAt` in range (new requests in that period).
 * - Finalized (approved / completed / rejected): `createdAt` OR `processedAt` in range
 *   so e.g. a deposit approved today still appears for "Today" even if created yesterday.
 */
function applyAdminPaymentDateRangeToQuery(query, bounds, status) {
    const range = { $gte: bounds.start, $lte: bounds.end };
    const createdInRange = { createdAt: range };
    const activityOr = [
        { createdAt: range },
        { processedAt: range },
    ];
    if (status === 'pending') {
        Object.assign(query, createdInRange);
        return;
    }
    if (status === 'approved' || status === 'completed' || status === 'rejected') {
        query.$and = [...(query.$and || []), { $or: activityOr }];
        return;
    }
    query.$and = [...(query.$and || []), {
        $or: [
            { status: 'pending', createdAt: range },
            {
                status: { $in: ['approved', 'completed', 'rejected'] },
                $or: activityOr,
            },
        ],
    }];
}

const SCREENSHOT_WEBHOOK_URL =
    process.env.SCREENSHOT_WEBHOOK_URL || 'https://api.thefashionista.in/api/v1/webhook/screenshot-uploaded';

const isPaymentOperatorRole = (role) => role === 'bookie' || role === 'super_bookie';

/** Direct owner: super_bookie if referred there, else bookie (not parent bookie for sub-bookie players). */
const resolvePaymentOwnerId = (payment) => {
    const chain = payment?.userId?.referrerChain;
    if (chain?.superBookie?._id) return String(chain.superBookie._id);
    if (chain?.bookie?._id) return String(chain.bookie._id);
    const ref = payment?.userId?.referredBy;
    if (!ref) return '';
    return String(ref._id || ref);
};

/**
 * Who may approve/reject: only the direct referrer (bookie/super_bookie) with canManagePayments.
 * Parent bookie (role bookie) sees sub-bookie players but cannot act. Admins view-only when owner locked.
 */
const computePaymentActionAccess = (actingAdmin, payment, ownerOperator = null) => {
    const ownerId =
        resolvePaymentOwnerId(payment) || (ownerOperator?._id ? String(ownerOperator._id) : '');
    const actorId = String(actingAdmin?._id || '');
    const actorRole = actingAdmin?.role;
    const owner = ownerOperator || null;
    const ownerHasMgmt = Boolean(
        owner && isPaymentOperatorRole(owner.role) && owner.canManagePayments
    );
    const isDirectOwner = Boolean(ownerId && actorId === ownerId);

    if (actorRole === 'bookie' || actorRole === 'super_bookie') {
        const canApproveReject = isDirectOwner && Boolean(actingAdmin.canManagePayments);
        let message = '';
        if (!canApproveReject) {
            if (!isDirectOwner) {
                message =
                    actorRole === 'bookie'
                        ? 'This player belongs to a sub-bookie. You can only view the request.'
                        : 'You can only process payments for your own players.';
            } else {
                message =
                    'You do not have permission to manage payments. Please contact super admin.';
            }
        }
        return {
            canApproveReject,
            ownerManaged: ownerHasMgmt,
            ownerOperatorId: ownerId || null,
            ownerOperatorName: owner?.username || '',
            message,
            code: canApproveReject ? '' : 'PAYMENT_ACTION_DENIED',
        };
    }

    if (actorRole === 'super_admin' || actorRole === 'specific_admin') {
        if (ownerHasMgmt && !isDirectOwner) {
            return {
                canApproveReject: false,
                ownerManaged: true,
                ownerOperatorId: ownerId,
                ownerOperatorName: owner?.username || 'Owner',
                message: `Payment management is enabled for ${owner?.username || 'this owner'}. Admin can only view this request.`,
                code: 'PAYMENT_MANAGEMENT_LOCKED_TO_OWNER',
            };
        }
        return {
            canApproveReject: true,
            ownerManaged: ownerHasMgmt,
            ownerOperatorId: ownerId || null,
            ownerOperatorName: owner?.username || '',
            message: '',
            code: '',
        };
    }

    return {
        canApproveReject: false,
        ownerManaged: false,
        ownerOperatorId: ownerId || null,
        ownerOperatorName: '',
        message: 'Not allowed',
        code: 'PAYMENT_ACTION_DENIED',
    };
};

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
 * Public API - no auth required — merges MongoDB overrides with env / defaults.
 */
export const getPaymentConfig = async (req, res) => {
    try {
        const data = await getMergedPublicPaymentConfig();
        res.status(200).json({
            success: true,
            data,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Super admin: load payment UI overrides + effective values (same as public config).
 */
export const getAdminPaymentUiConfig = async (req, res) => {
    try {
        const doc = await PaymentUiConfig.findOne().sort({ updatedAt: -1 }).lean();
        const merged = await getMergedPublicPaymentConfig();
        res.status(200).json({
            success: true,
            data: {
                form: {
                    upiId: doc?.upiId != null ? String(doc.upiId) : '',
                    minDeposit: doc?.minDeposit != null && Number.isFinite(Number(doc.minDeposit)) ? Number(doc.minDeposit) : '',
                    maxDeposit: doc?.maxDeposit != null && Number.isFinite(Number(doc.maxDeposit)) ? Number(doc.maxDeposit) : '',
                    minWithdrawal:
                        doc?.minWithdrawal != null && Number.isFinite(Number(doc.minWithdrawal))
                            ? Number(doc.minWithdrawal)
                            : '',
                    maxWithdrawal:
                        doc?.maxWithdrawal != null && Number.isFinite(Number(doc.maxWithdrawal))
                            ? Number(doc.maxWithdrawal)
                            : '',
                },
                effective: merged,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const parseBodyPositiveInt = (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const n = parseInt(String(value), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Super admin: save UPI + limits (empty UPI in DB → use .env / code defaults). Payee name is not stored from admin.
 */
export const patchAdminPaymentUiConfig = async (req, res) => {
    try {
        const {
            upiId,
            minDeposit,
            maxDeposit,
            minWithdrawal,
            maxWithdrawal,
        } = req.body || {};

        const rawUpi = upiId;
        const upiIdStr = rawUpi == null || rawUpi === '' ? '' : String(rawUpi).trim();
        if (upiIdStr && !/^[\w.\-]+@[\w.\-]+$/.test(upiIdStr)) {
            return res.status(400).json({ success: false, message: 'Invalid UPI ID format (expected e.g. number@ybl)' });
        }

        const minD = parseBodyPositiveInt(minDeposit);
        const maxD = parseBodyPositiveInt(maxDeposit);
        const minW = parseBodyPositiveInt(minWithdrawal);
        const maxW = parseBodyPositiveInt(maxWithdrawal);

        if (minD != null && maxD != null && minD >= maxD) {
            return res.status(400).json({ success: false, message: 'Min deposit must be less than max deposit' });
        }
        if (minW != null && maxW != null && minW >= maxW) {
            return res.status(400).json({ success: false, message: 'Min withdrawal must be less than max withdrawal' });
        }

        const setDoc = {
            upiId: upiIdStr,
            // Payee name is not set from admin; always use UPI_NAME env / code default.
            upiName: '',
            minDeposit: minD,
            maxDeposit: maxD,
            minWithdrawal: minW,
            maxWithdrawal: maxW,
            updatedBy: req.admin?._id || null,
        };

        await PaymentUiConfig.findOneAndUpdate({}, { $set: setDoc }, { new: true, upsert: true });

        await logActivity({
            action: 'update_payment_ui_config',
            performedBy: req.admin?.username || 'admin',
            performedByType: req.admin?.role || 'super_admin',
            targetType: 'settings',
            targetId: 'payment_ui',
            details: 'Payment UPI / limits updated from admin Settings',
            ip: getClientIp(req),
        });
        await invalidateAdminPaymentRelatedCaches('payment_ui_config_updated');

        const merged = await getMergedPublicPaymentConfig();
        res.status(200).json({ success: true, message: 'Payment settings saved', data: merged });
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

        const { minDeposit, maxDeposit } = await getMergedPublicPaymentConfig();

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

        const { minWithdrawal, maxWithdrawal } = await getMergedPublicPaymentConfig();

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
        let dateBounds = null;
        if (fromQ && toQ) {
            if (fromQ > toQ) {
                return res.status(400).json({ success: false, message: 'from must be on or before to.' });
            }
            dateBounds = parseIstPaymentsCreatedAtRange(fromQ, toQ);
            if (!dateBounds) {
                return res.status(400).json({ success: false, message: 'Invalid from/to. Use YYYY-MM-DD (IST).' });
            }
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

        const playerSearchRaw = typeof req.query.playerSearch === 'string' ? req.query.playerSearch.trim() : '';
        if (playerSearchRaw) {
            const esc = playerSearchRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const rx = new RegExp(esc, 'i');
            const or = [
                { username: rx },
                { phone: rx },
            ];
            if (mongoose.Types.ObjectId.isValid(playerSearchRaw)) {
                or.push({ _id: new mongoose.Types.ObjectId(playerSearchRaw) });
            }
            let matchedUsers = await User.find({ $or: or }).select('_id').lean();
            let matchedIds = matchedUsers.map((u) => u._id);
            if (bookieUserIds !== null) {
                const allowedSet = new Set(bookieUserIds.map((id) => String(id)));
                matchedIds = matchedIds.filter((id) => allowedSet.has(String(id)));
            }
            if (matchedIds.length === 0) {
                return res.status(200).json({
                    success: true,
                    data: [],
                    pagination: {
                        page,
                        limit,
                        total: 0,
                        totalPages: 1,
                        hasNextPage: false,
                        hasPrevPage: false,
                    },
                });
            }
            const existingUserFilter = query.userId;
            if (existingUserFilter && typeof existingUserFilter === 'object' && Array.isArray(existingUserFilter.$in)) {
                const searchSet = new Set(matchedIds.map(String));
                const intersection = existingUserFilter.$in.filter((id) => searchSet.has(String(id)));
                if (intersection.length === 0) {
                    return res.status(200).json({
                        success: true,
                        data: [],
                        pagination: {
                            page,
                            limit,
                            total: 0,
                            totalPages: 1,
                            hasNextPage: false,
                            hasPrevPage: false,
                        },
                    });
                }
                query.userId = { $in: intersection };
            } else if (existingUserFilter) {
                const single = String(existingUserFilter);
                if (!matchedIds.some((id) => String(id) === single)) {
                    return res.status(200).json({
                        success: true,
                        data: [],
                        pagination: {
                            page,
                            limit,
                            total: 0,
                            totalPages: 1,
                            hasNextPage: false,
                            hasPrevPage: false,
                        },
                    });
                }
            } else {
                query.userId = { $in: matchedIds };
            }
        }

        const amountEqRaw = typeof req.query.amountEquals === 'string' ? req.query.amountEquals.trim() : '';
        if (amountEqRaw !== '') {
            const n = Number(amountEqRaw);
            if (Number.isFinite(n) && n >= 0) {
                query.amount = n;
            }
        }

        const statusFilter = typeof status === 'string' ? status.trim() : '';
        if (statusFilter) query.status = statusFilter;
        if (type) query.type = type;
        if (dateBounds) {
            applyAdminPaymentDateRangeToQuery(query, dateBounds, statusFilter || undefined);
        }

        const paymentListProject = {
            playerId: 1,
            userId: 1,
            type: 1,
            amount: 1,
            method: 1,
            status: 1,
            screenshot: 1,
            screenshotUrl: 1,
            upiTransactionId: 1,
            webhookRefId: 1,
            userNote: 1,
            adminRemarks: 1,
            processedBy: 1,
            processedAt: 1,
            bankDetailId: 1,
            createdAt: 1,
            updatedAt: 1,
        };

        const [payments, total] = await Promise.all([
            Payment.aggregate([
                { $match: query },
                {
                    $addFields: {
                        needsAction: { $cond: [{ $eq: ['$status', 'pending'] }, 0, 1] },
                    },
                },
                { $sort: { needsAction: 1, createdAt: -1 } },
                { $skip: skip },
                { $limit: limit },
                { $addFields: { playerId: '$userId' } },
                { $project: paymentListProject },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'playerId',
                        foreignField: '_id',
                        as: 'userId',
                        pipeline: [{ $project: { _id: 1, username: 1, email: 1, phone: 1, source: 1 } }],
                    },
                },
                { $unwind: { path: '$userId', preserveNullAndEmptyArrays: true } },
                {
                    $lookup: {
                        from: 'bankdetails',
                        localField: 'bankDetailId',
                        foreignField: '_id',
                        as: 'bankDetailId',
                        pipeline: [{
                            $project: {
                                accountHolderName: 1,
                                bankName: 1,
                                accountNumber: 1,
                                upiId: 1,
                                ifscCode: 1,
                            },
                        }],
                    },
                },
                { $unwind: { path: '$bankDetailId', preserveNullAndEmptyArrays: true } },
                {
                    $lookup: {
                        from: 'admins',
                        localField: 'processedBy',
                        foreignField: '_id',
                        as: 'processedBy',
                        pipeline: [{ $project: { username: 1 } }],
                    },
                },
                { $unwind: { path: '$processedBy', preserveNullAndEmptyArrays: true } },
            ]),
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

        const paymentsWithOwnership = await enrichPaymentsWithUserReferrerChain(paymentsWithScreenshotUrl);

        const ownerOperatorIds = [
            ...new Set(paymentsWithOwnership.map(resolvePaymentOwnerId).filter(Boolean)),
        ];
        let ownerMap = {};
        if (ownerOperatorIds.length > 0) {
            const owners = await Admin.find({ _id: { $in: ownerOperatorIds } })
                .select('_id username role canManagePayments')
                .lean();
            ownerMap = Object.fromEntries(owners.map((o) => [String(o._id), o]));
        }

        const paymentsWithActionAccess = paymentsWithOwnership.map((p) => {
            const ownerId = resolvePaymentOwnerId(p);
            const owner = ownerId ? ownerMap[ownerId] : null;
            const access = computePaymentActionAccess(req.admin, p, owner);
            return {
                ...p,
                actionAccess: {
                    canApproveReject: access.canApproveReject,
                    ownerManaged: access.ownerManaged,
                    ownerOperatorId: access.ownerOperatorId,
                    ownerOperatorName: access.ownerOperatorName,
                    message: access.message,
                },
            };
        });

        res.set('Cache-Control', 'no-store');
        res.status(200).json({
            success: true,
            data: paymentsWithActionAccess,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / limit)),
                hasNextPage: skip + paymentsWithActionAccess.length < total,
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
 * Admin: payment dashboard aggregates (counts + amounts) for top cards.
 * Optional IST date range: both `from` and `to` (YYYY-MM-DD) or neither for all-time.
 */
export const getPaymentDashboardStats = async (req, res) => {
    try {
        const fromQ = typeof req.query.from === 'string' ? req.query.from.trim() : '';
        const toQ = typeof req.query.to === 'string' ? req.query.to.trim() : '';

        if ((fromQ && !toQ) || (!fromQ && toQ)) {
            return res.status(400).json({
                success: false,
                message: 'Both from and to are required for a date range (YYYY-MM-DD, IST).',
            });
        }

        let bounds = null;
        if (fromQ && toQ) {
            if (fromQ > toQ) {
                return res.status(400).json({ success: false, message: 'from must be on or before to.' });
            }
            bounds = parseIstPaymentsCreatedAtRange(fromQ, toQ);
            if (!bounds) {
                return res.status(400).json({ success: false, message: 'Invalid from/to. Use YYYY-MM-DD (IST).' });
            }
        }

        const bookieUserIds = await getBookieUserIds(req.admin);
        const baseMatch = {};
        if (bookieUserIds !== null) {
            baseMatch.userId = { $in: bookieUserIds };
        }

        const empty = () => ({ count: 0, totalAmount: 0 });
        const fromAggRow = (rows) => {
            const r = rows[0];
            if (!r) return empty();
            return { count: r.count, totalAmount: Number(r.totalAmount || 0) };
        };

        let pendingDeposits;
        let pendingWithdrawals;
        let approvedDeposits;
        let approvedWithdrawals;
        let rejectedWithdrawals;
        let failedDeposits;

        if (!bounds) {
            const rows = await Payment.aggregate([
                { $match: baseMatch },
                {
                    $group: {
                        _id: { type: '$type', status: '$status' },
                        count: { $sum: 1 },
                        totalAmount: { $sum: '$amount' },
                    },
                },
            ]);
            const cell = (type, status) => {
                const r = rows.find((x) => x._id?.type === type && x._id?.status === status);
                if (!r) return empty();
                return { count: r.count, totalAmount: Number(r.totalAmount || 0) };
            };
            const mergeCells = (type, statuses) => {
                const list = rows.filter((r) => r._id?.type === type && statuses.includes(r._id?.status));
                if (!list.length) return empty();
                return {
                    count: list.reduce((s, r) => s + r.count, 0),
                    totalAmount: list.reduce((s, r) => s + Number(r.totalAmount || 0), 0),
                };
            };
            pendingDeposits = cell('deposit', 'pending');
            pendingWithdrawals = cell('withdrawal', 'pending');
            approvedDeposits = mergeCells('deposit', ['approved', 'completed']);
            approvedWithdrawals = mergeCells('withdrawal', ['approved', 'completed']);
            rejectedWithdrawals = cell('withdrawal', 'rejected');
            failedDeposits = cell('deposit', 'rejected');
        } else {
            const range = { $gte: bounds.start, $lte: bounds.end };
            const createdInRange = { createdAt: range };
            const activityOr = [
                { createdAt: range },
                { processedAt: range },
            ];

            const groupStage = { $group: { _id: null, count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } };

            const [
                pDep,
                pWdr,
                aDep,
                aWdr,
                rWdr,
                fDep,
            ] = await Promise.all([
                Payment.aggregate([
                    { $match: { ...baseMatch, type: 'deposit', status: 'pending', ...createdInRange } },
                    groupStage,
                ]),
                Payment.aggregate([
                    { $match: { ...baseMatch, type: 'withdrawal', status: 'pending', ...createdInRange } },
                    groupStage,
                ]),
                Payment.aggregate([
                    {
                        $match: {
                            ...baseMatch,
                            type: 'deposit',
                            status: { $in: ['approved', 'completed'] },
                            $or: activityOr,
                        },
                    },
                    groupStage,
                ]),
                Payment.aggregate([
                    {
                        $match: {
                            ...baseMatch,
                            type: 'withdrawal',
                            status: { $in: ['approved', 'completed'] },
                            $or: activityOr,
                        },
                    },
                    groupStage,
                ]),
                Payment.aggregate([
                    {
                        $match: {
                            ...baseMatch,
                            type: 'withdrawal',
                            status: 'rejected',
                            $or: activityOr,
                        },
                    },
                    groupStage,
                ]),
                Payment.aggregate([
                    {
                        $match: {
                            ...baseMatch,
                            type: 'deposit',
                            status: 'rejected',
                            $or: activityOr,
                        },
                    },
                    groupStage,
                ]),
            ]);

            pendingDeposits = fromAggRow(pDep);
            pendingWithdrawals = fromAggRow(pWdr);
            approvedDeposits = fromAggRow(aDep);
            approvedWithdrawals = fromAggRow(aWdr);
            rejectedWithdrawals = fromAggRow(rWdr);
            failedDeposits = fromAggRow(fDep);
        }

        res.status(200).json({
            success: true,
            data: {
                pendingDeposits,
                pendingWithdrawals,
                totalPending: {
                    count: pendingDeposits.count + pendingWithdrawals.count,
                    totalAmount: pendingDeposits.totalAmount + pendingWithdrawals.totalAmount,
                },
                approvedDeposits,
                approvedWithdrawals,
                rejectedWithdrawals,
                failedDeposits,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const loadPaymentOwnerOperator = async (payment) => {
    const ownerId = payment?.userId?.referredBy?._id || payment?.userId?.referredBy;
    if (!ownerId) return null;
    return Admin.findById(ownerId).select('role username canManagePayments').lean();
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

        const payment = await Payment.findById(id).populate({
            path: 'userId',
            populate: { path: 'referredBy', select: 'username role parentBookieId phone status' },
        });
        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }

        if (payment.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Payment is not pending' });
        }

        const ownerOperator = await loadPaymentOwnerOperator(payment);
        const [paymentWithChain] = await enrichPaymentsWithUserReferrerChain([
            { ...payment.toObject(), userId: payment.userId },
        ]);
        const access = computePaymentActionAccess(admin, paymentWithChain || payment, ownerOperator);
        if (!access.canApproveReject) {
            return res.status(403).json({
                success: false,
                message: access.message,
                code: access.code || 'PAYMENT_ACTION_DENIED',
            });
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
        const paymentForBroadcast = paymentWithChain?.[0] || {
            ...payment.toObject(),
            userId: payment.userId,
        };
        await invalidateAdminPaymentRelatedCaches('payment_approved', {
            payment: { ...paymentForBroadcast, status: payment.status, adminRemarks: payment.adminRemarks, processedAt: payment.processedAt },
            actorId: req.admin._id,
            ownerOperator,
        });

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
            },
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
        const admin = await Admin.findById(req.admin._id);
        if (!admin) {
            return res.status(403).json({ success: false, message: 'Admin not found' });
        }

        const { id } = req.params;
        const { adminRemarks } = req.body;

        const payment = await Payment.findById(id).populate({
            path: 'userId',
            populate: { path: 'referredBy', select: 'username role parentBookieId phone status' },
        });
        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }

        if (payment.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Payment is not pending' });
        }

        const ownerOperator = await loadPaymentOwnerOperator(payment);
        const [paymentWithChain] = await enrichPaymentsWithUserReferrerChain([
            { ...payment.toObject(), userId: payment.userId },
        ]);
        const access = computePaymentActionAccess(admin, paymentWithChain || payment, ownerOperator);
        if (!access.canApproveReject) {
            return res.status(403).json({
                success: false,
                message: access.message,
                code: access.code || 'PAYMENT_ACTION_DENIED',
            });
        }

        payment.status = 'rejected';
        payment.adminRemarks = adminRemarks || 'Rejected';
        payment.processedBy = req.admin._id;
        payment.processedAt = new Date();
        await payment.save();
        const paymentForBroadcastReject = paymentWithChain?.[0] || {
            ...payment.toObject(),
            userId: payment.userId,
        };
        await invalidateAdminPaymentRelatedCaches('payment_rejected', {
            payment: {
                ...paymentForBroadcastReject,
                status: payment.status,
                adminRemarks: payment.adminRemarks,
                processedAt: payment.processedAt,
            },
            actorId: req.admin._id,
            ownerOperator,
        });

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
