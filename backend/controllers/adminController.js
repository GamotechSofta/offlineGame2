import Admin from '../models/admin/admin.js';
import bcrypt from 'bcryptjs';
import User from '../models/user/user.js';
import {
    getCommissionSummaryForAccount,
    getCommissionDashboardForAccount,
    getPerPlayerCommissionRows,
    getCommissionPaymentKind,
    aggregatePlayerBetMetrics,
} from '../utils/commissionMetrics.js';
import CommissionPayment from '../models/commission/commissionPayment.js';
import BookieWalletTransaction from '../models/bookieWalletTransaction/bookieWalletTransaction.js';
import { getBookieWalletTxLabel } from '../utils/bookieWalletLedger.js';
import { SP_COMMON_LIST } from '../config/spCommonList.js';
import { DP_COMMON_LIST } from '../config/dpCommonList.js';
import { logActivity, getClientIp } from '../utils/activityLogger.js';
import { signAdminToken } from '../utils/adminJwt.js';
import { invalidateAdminReadCaches } from '../services/cacheInvalidationService.js';
import { canAccessBookieManagement, isSuperAdmin } from '../utils/adminTabAccess.js';
import { notifyBookiePanelBalance } from '../utils/notifyBookiePanelBalance.js';
import { getBookieHierarchySummary, getBookieHierarchyUserIds } from '../utils/bookieFilter.js';
import { getPanelRevenueKpisForAdmin } from '../utils/panelRevenueDashboard.js';
import Bet from '../models/bet/bet.js';
import { Wallet } from '../models/wallet/wallet.js';

/**
 * Admin login
 * Body: { username, password }
 */
export const adminLogin = async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required',
            });
        }

        const admin = await Admin.findOne({ username }).select('password status role username _id allowedTabs');
        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        // Check if admin account is active
        if (admin.status === 'inactive') {
            return res.status(403).json({
                success: false,
                message: 'Your account has been suspended. Please contact support for assistance.',
                code: 'ACCOUNT_SUSPENDED',
            });
        }

        const isPasswordValid = await admin.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        if (admin.role === 'bookie' || admin.role === 'super_bookie') {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        const roleLabel =
            admin.role === 'super_admin'
                ? 'Super Admin Panel'
                : admin.role === 'specific_admin'
                  ? 'Specific Admin Panel'
                  : 'Admin Panel';

        // Log in background so login response returns immediately (no await)
        logActivity({
            action: 'admin_login',
            performedBy: admin.username,
            performedByType: admin.role === 'super_admin' ? 'super_admin' : 'admin',
            targetType: 'admin',
            targetId: admin._id.toString(),
            details: `${admin.username} logged in (${roleLabel})`,
            ip: getClientIp(req),
        }).catch(() => {});

        const token = signAdminToken(admin);
        const data = {
            id: admin._id,
            username: admin.username,
            role: admin.role,
            token,
        };
        if (admin.role === 'specific_admin') {
            data.allowedTabs = Array.isArray(admin.allowedTabs) ? admin.allowedTabs : [];
        }

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Create admin (for initial setup)
 * Body: { username, password }
 */
export const createAdmin = async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required',
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters',
            });
        }

        const admin = new Admin({ username, password });
        await admin.save();

        await logActivity({
            action: 'create_admin',
            performedBy: 'System',
            performedByType: 'system',
            targetType: 'admin',
            targetId: admin._id.toString(),
            details: `Super admin "${username}" created`,
            ip: getClientIp(req),
        });

        res.status(201).json({
            success: true,
            message: 'Admin created successfully',
            data: {
                id: admin._id,
                username: admin.username,
                role: admin.role,
            },
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Admin with this username already exists',
            });
        }
        return res.status(500).json({ success: false, message: error.message });
    }
};

const PHONE_REGEX = /^[6-9]\d{9}$/;

/**
 * Create bookie (Admin collection with role 'bookie')
 * Only super_admin can create. Bookie logs in to Bookie Panel with phone + password.
 * Body: { username | (firstName + lastName), password, email, phone }
 */
export const createBookie = async (req, res) => {
    try {
        if (!isSuperAdmin(req.admin)) {
            return res.status(403).json({
                success: false,
                message: 'Only Super Admin can create bookies',
            });
        }

        const { username, firstName, lastName, email, password, phone, commissionPercentage, balance } = req.body;

        const derivedUsername = (firstName != null && lastName != null)
            ? `${String(firstName).trim()} ${String(lastName).trim()}`.trim()
            : (username != null ? String(username).trim() : '');

        if (!derivedUsername) {
            return res.status(400).json({
                success: false,
                message: 'Username or both First name and Last name are required',
            });
        }

        if (!password) {
            return res.status(400).json({
                success: false,
                message: 'Password is required',
            });
        }

        if (!phone || typeof phone !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required (bookies log in with phone + password)',
            });
        }

        const trimmedPhone = phone.replace(/\D/g, '').slice(0, 10);
        if (!PHONE_REGEX.test(trimmedPhone)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid 10-digit phone number (starting with 6–9)',
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters',
            });
        }

        const existingBookie = await Admin.findOne({
            $or: [
                { username: derivedUsername },
                { phone: trimmedPhone },
                ...(email ? [{ email: email.toLowerCase() }] : []),
            ].filter(Boolean),
        });
        if (existingBookie) {
            if (existingBookie.phone === trimmedPhone) {
                return res.status(409).json({ success: false, message: 'A bookie with this phone number already exists' });
            }
            if (email && existingBookie.email === email.toLowerCase()) {
                return res.status(409).json({ success: false, message: 'A bookie with this email already exists' });
            }
            return res.status(409).json({ success: false, message: 'A bookie with this name already exists' });
        }

        const initialBalance = (balance != null && Number.isFinite(Number(balance))) ? Math.max(0, Number(balance)) : 0;
        const bookie = new Admin({
            username: derivedUsername,
            password,
            role: 'bookie',
            email: (email && String(email).trim()) ? email.trim().toLowerCase() : '',
            phone: trimmedPhone,
            status: 'active',
            commissionPercentage: (commissionPercentage != null && Number.isFinite(Number(commissionPercentage))) ? Math.min(100, Math.max(0, Number(commissionPercentage))) : 0,
            balance: initialBalance,
        });
        await bookie.save();
        await invalidateAdminReadCaches('bookie_created');
        
        console.log(`[Bookie Created] ID: ${bookie._id}, Username: ${bookie.username}, Phone: ${bookie.phone}, Balance: ${bookie.balance}, canManagePayments: ${bookie.canManagePayments}, Status: ${bookie.status}`);
        
        // Verify by re-fetching from database
        const verifyBookie = await Admin.findById(bookie._id).select('balance canManagePayments').lean();
        console.log(`[Bookie Verify] Database values - Balance: ${verifyBookie?.balance}, canManagePayments: ${verifyBookie?.canManagePayments}`);

        await logActivity({
            action: 'create_bookie',
            performedBy: req.admin?.username || 'Admin',
            performedByType: req.admin?.role || 'admin',
            targetType: 'bookie',
            targetId: bookie._id.toString(),
            details: `Bookie "${bookie.username}" created`,
            ip: getClientIp(req),
        });

        res.status(201).json({
            success: true,
            message: `Bookie created successfully. Login credentials - Phone: ${trimmedPhone}, Password: [as provided]`,
            data: {
                id: bookie._id,
                username: bookie.username,
                role: bookie.role,
                email: bookie.email,
                phone: bookie.phone,
                status: bookie.status,
                commissionPercentage: bookie.commissionPercentage,
                balance: bookie.balance ?? 0,
            },
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Username already exists',
            });
        }
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get all super admins
 * Only super_admin can access
 */
export const getAllSuperAdmins = async (req, res) => {
    try {
        if (req.admin?.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Only Super Admin can view super admins',
            });
        }

        const admins = await Admin.find({ role: 'super_admin' })
            .select('-password')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: admins.length,
            data: admins,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get all bookies
 * super_admin or Super Bookie with /bookie-management tab
 */
export const getAllBookies = async (req, res) => {
    try {
        if (!canAccessBookieManagement(req.admin)) {
            return res.status(403).json({
                success: false,
                message: 'You do not have access to bookie accounts',
            });
        }

        const bookies = await Admin.find({ role: 'bookie' })
            .select('-password')
            .sort({ createdAt: -1 });

        const enrichedBookies = await Promise.all(
            bookies.map(async (b) => {
                const summary = await getCommissionSummaryForAccount(b);
                return {
                    ...b.toObject(),
                    totalCommissionAmount: summary.totalCommission,
                    totalCommissionPaid: summary.totalPaid,
                    totalCommissionPending: summary.totalPending,
                    totalBetAmountForCommission: summary.totalBetAmount,
                };
            })
        );

        // Debug: log first bookie's balance
        if (bookies.length > 0) {
            console.log(`[getAllBookies] First bookie - Username: ${bookies[0].username}, Balance: ${bookies[0].balance}, canManagePayments: ${bookies[0].canManagePayments}`);
        }

        res.status(200).json({
            success: true,
            count: bookies.length,
            data: enrichedBookies,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get single bookie by ID
 * super_admin or Super Bookie with /bookie-management tab
 */
export const getBookieById = async (req, res) => {
    try {
        if (!canAccessBookieManagement(req.admin)) {
            return res.status(403).json({
                success: false,
                message: 'You do not have access to bookie accounts',
            });
        }

        const { id } = req.params;

        const bookie = await Admin.findOne({ _id: id, role: 'bookie' }).select('-password');
        if (!bookie) {
            return res.status(404).json({
                success: false,
                message: 'Bookie not found',
            });
        }

        res.status(200).json({
            success: true,
            data: bookie,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Full SuperBookie (bookie role) detail for admin bookie-management screen.
 * Players, sub-bookies (super_bookie), revenue, commission — no /revenue tab required.
 */
export const getBookieManagementDetail = async (req, res) => {
    try {
        if (!canAccessBookieManagement(req.admin)) {
            return res.status(403).json({
                success: false,
                message: 'You do not have access to bookie accounts',
            });
        }

        const { id } = req.params;
        const { startDate, endDate } = req.query;

        const bookie = await Admin.findOne({ _id: id, role: 'bookie' }).select('-password').lean();
        if (!bookie) {
            return res.status(404).json({ success: false, message: 'Bookie not found' });
        }

        const commissionSummary = await getCommissionSummaryForAccount(bookie);

        const dateMatch = {};
        if (startDate || endDate) {
            dateMatch.createdAt = {};
            if (startDate) dateMatch.createdAt.$gte = new Date(startDate + 'T00:00:00.000Z');
            if (endDate) dateMatch.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
        }

        const hierarchy = await getBookieHierarchySummary(bookie._id, dateMatch);

        const dateFilter = {};
        if (startDate || endDate) {
            dateFilter.createdAt = {};
            if (startDate) dateFilter.createdAt.$gte = new Date(startDate + 'T00:00:00.000Z');
            if (endDate) dateFilter.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
        }

        const userIds = await getBookieHierarchyUserIds(bookie._id);
        let revenue = {
            totalBetAmount: 0,
            totalPayouts: 0,
            totalBetCount: 0,
            winningBets: 0,
            losingBets: 0,
            bookieShare: 0,
            adminPool: 0,
            adminProfit: 0,
            winRate: '0',
        };

        if (userIds.length > 0) {
            const metrics = await aggregatePlayerBetMetrics({ userIds, dateFilter });
            const commPct = bookie.commissionPercentage || 0;
            const totalBetAmount = metrics.totalBetAmount;
            const totalPayouts = metrics.totalPayouts;
            const bookieShare = Math.round((totalBetAmount * commPct / 100) * 100) / 100;
            const adminPool = Math.round((totalBetAmount * (100 - commPct) / 100) * 100) / 100;
            const adminProfit = Math.round((adminPool - totalPayouts) * 100) / 100;
            revenue = {
                totalBetAmount,
                totalPayouts,
                totalBetCount: metrics.totalBets,
                winningBets: metrics.winningBets,
                losingBets: metrics.losingBets,
                bookieShare,
                adminPool,
                adminProfit,
                winRate:
                    metrics.totalBets > 0
                        ? ((metrics.winningBets / metrics.totalBets) * 100).toFixed(2)
                        : '0',
            };
        }

        const superBookiesWithCommission = await Promise.all(
            (hierarchy.superBookies || []).map(async (sb) => {
                const sbDoc = await Admin.findById(sb.id).select('-password').lean();
                const sbCommission = sbDoc
                    ? await getCommissionSummaryForAccount(sbDoc)
                    : { totalCommission: 0, totalPaid: 0, totalPending: 0 };
                return {
                    ...sb,
                    commissionPercentage: sbDoc?.commissionPercentage ?? 0,
                    totalCommissionAmount: sbCommission.totalCommission,
                    totalCommissionPaid: sbCommission.totalPaid,
                    totalCommissionPending: sbCommission.totalPending,
                };
            })
        );

        const directPlayers = await User.find({ referredBy: bookie._id })
            .select('username phone email isActive createdAt')
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        let recentBets = [];
        if (userIds.length > 0) {
            recentBets = await Bet.find({ userId: { $in: userIds }, ...dateFilter })
                .sort({ createdAt: -1 })
                .limit(20)
                .populate('userId', 'username')
                .populate('marketId', 'marketName')
                .lean();
        }

        return res.status(200).json({
            success: true,
            data: {
                bookie: {
                    ...bookie,
                    totalCommissionAmount: commissionSummary.totalCommission,
                    totalCommissionPaid: commissionSummary.totalPaid,
                    totalCommissionPending: commissionSummary.totalPending,
                    totalBetAmountForCommission: commissionSummary.totalBetAmount,
                },
                commission: commissionSummary,
                hierarchy: {
                    ...hierarchy,
                    superBookies: superBookiesWithCommission,
                },
                revenue,
                directPlayers,
                recentBets: recentBets.map((b) => ({
                    _id: b._id,
                    username: b.userId?.username || '—',
                    marketName: b.marketId?.marketName || '—',
                    betType: b.betType,
                    amount: b.amount,
                    payout: b.payout,
                    status: b.status,
                    createdAt: b.createdAt,
                })),
                totalNetworkPlayers: hierarchy.totalPlayers,
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/** Players under a sub-bookie (role super_bookie) for SuperBookie detail screen */
export const getSuperBookiePlayersUnderBookie = async (req, res) => {
    try {
        if (!canAccessBookieManagement(req.admin)) {
            return res.status(403).json({
                success: false,
                message: 'You do not have access to bookie accounts',
            });
        }

        const { id, superBookieId } = req.params;
        const bookie = await Admin.findOne({ _id: id, role: 'bookie' }).select('_id').lean();
        if (!bookie) {
            return res.status(404).json({ success: false, message: 'Bookie not found' });
        }

        const superBookie = await Admin.findOne({
            _id: superBookieId,
            parentBookieId: id,
            role: 'super_bookie',
        }).select('_id username').lean();
        if (!superBookie) {
            return res.status(404).json({ success: false, message: 'Sub-account not found' });
        }

        const players = await User.find({ referredBy: superBookieId })
            .select('username phone email isActive createdAt lastActiveAt')
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        let playersWithWallet = players;
        if (players.length > 0) {
            const userIds = players.map((p) => p._id);
            const wallets = await Wallet.find({ userId: { $in: userIds } }).select('userId balance').lean();
            const walletMap = Object.fromEntries(wallets.map((w) => [String(w.userId), w.balance ?? 0]));
            playersWithWallet = players.map((p) => ({
                ...p,
                walletBalance: walletMap[String(p._id)] ?? 0,
            }));
        }

        return res.status(200).json({ success: true, data: playersWithWallet });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/** Commission dashboard + per-player breakdown for a sub-bookie under a SuperBookie */
export const getAdminSuperBookieCommissionDashboard = async (req, res) => {
    try {
        if (!canAccessBookieManagement(req.admin)) {
            return res.status(403).json({
                success: false,
                message: 'You do not have access to bookie accounts',
            });
        }

        const { id, superBookieId } = req.params;
        const { startDate, endDate } = req.query;

        const bookie = await Admin.findOne({ _id: id, role: 'bookie' })
            .select('_id username')
            .lean();
        if (!bookie) {
            return res.status(404).json({ success: false, message: 'Bookie not found' });
        }

        const superBookie = await Admin.findOne({
            _id: superBookieId,
            parentBookieId: id,
            role: 'super_bookie',
        })
            .select('_id username phone email status balance commissionPercentage role createdAt')
            .lean();
        if (!superBookie) {
            return res.status(404).json({ success: false, message: 'Sub-account not found' });
        }

        const [summary, dashboard, players, payments, walletTxs, revenueKpis] = await Promise.all([
            getCommissionSummaryForAccount(superBookie),
            getCommissionDashboardForAccount(superBookie, { startDate, endDate }),
            getPerPlayerCommissionRows(superBookie, { startDate, endDate }),
            CommissionPayment.find({ bookieId: superBookieId })
                .sort({ createdAt: -1 })
                .limit(50)
                .lean(),
            BookieWalletTransaction.find({ adminId: superBookieId })
                .sort({ createdAt: -1, _id: -1 })
                .limit(100)
                .lean(),
            getPanelRevenueKpisForAdmin(superBookie, { startDate, endDate }),
        ]);

        const settledCommission =
            summary.displaySettled
            ?? (Number(summary.advanceRecovered || 0) + Number(summary.totalPaid || 0));
        const pendingCommission =
            summary.displayPending
            ?? (Number(summary.recoveryPendingFromBets || 0) + Number(summary.totalPending || 0));

        return res.status(200).json({
            success: true,
            data: {
                parentBookie: {
                    _id: bookie._id,
                    username: bookie.username,
                },
                superBookie: {
                    _id: superBookie._id,
                    username: superBookie.username,
                    phone: superBookie.phone || '',
                    status: superBookie.status,
                    balance: superBookie.balance ?? 0,
                    commissionPercentage: superBookie.commissionPercentage ?? 0,
                    createdAt: superBookie.createdAt,
                },
                revenueKpis,
                topDashboard: {
                    totalRevenue: revenueKpis.totalBetAmount ?? summary.totalBetAmount ?? 0,
                    walletBalance: superBookie.balance ?? 0,
                    commissionSettled: settledCommission,
                    commissionPending: pendingCommission,
                    totalPlayers: summary.playerCount ?? 0,
                    totalCommission: summary.totalCommission ?? 0,
                    betCount: summary.betCount ?? 0,
                    paymentStatus: summary.paymentStatus,
                },
                summary,
                dashboard,
                players,
                payments: payments.map((p) => ({
                    _id: p._id,
                    amount: p.amount,
                    notes: p.notes,
                    paymentType: p.paymentType || getCommissionPaymentKind(p),
                    createdAt: p.createdAt,
                })),
                walletTransactions: walletTxs.map((tx) => ({
                    _id: tx._id,
                    type: tx.type,
                    label: getBookieWalletTxLabel(tx.type),
                    direction: tx.direction,
                    amount: tx.amount,
                    balanceAfter: tx.balanceAfter,
                    description: tx.description,
                    createdAt: tx.createdAt,
                })),
                dateRange: {
                    startDate: revenueKpis.dateFrom ?? startDate ?? null,
                    endDate: revenueKpis.dateTo ?? endDate ?? null,
                    periodLabel: revenueKpis.periodLabel ?? 'Today',
                },
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Update bookie
 * Only super_admin can update
 * Body: { username | (firstName + lastName), email, phone, status, password (optional), uiTheme }
 */
export const updateBookie = async (req, res) => {
    try {
        if (req.admin?.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Only Super Admin can update bookies',
            });
        }

        const { id } = req.params;
        const { username, firstName, lastName, email, phone, status, password, uiTheme, commissionPercentage, canManagePayments, balance } = req.body;

        const bookie = await Admin.findOne({ _id: id, role: 'bookie' });
        if (!bookie) {
            return res.status(404).json({
                success: false,
                message: 'Bookie not found',
            });
        }

        const derivedUsername = (firstName != null && lastName != null)
            ? `${String(firstName).trim()} ${String(lastName).trim()}`.trim()
            : (username != null ? String(username).trim() : null);

        if (derivedUsername) {
            if (derivedUsername !== bookie.username) {
                const existingBookie = await Admin.findOne({ username: derivedUsername });
                if (existingBookie) {
                    return res.status(409).json({
                        success: false,
                        message: 'A bookie with this name already exists',
                    });
                }
                bookie.username = derivedUsername;
            }
        }

        if (email !== undefined) bookie.email = email ? String(email).trim().toLowerCase() : '';
        if (phone !== undefined) {
            const trimmedPhone = String(phone).replace(/\D/g, '').slice(0, 10);
            if (trimmedPhone && !PHONE_REGEX.test(trimmedPhone)) {
                return res.status(400).json({
                    success: false,
                    message: 'Please enter a valid 10-digit phone number (starting with 6–9)',
                });
            }
            const newPhone = trimmedPhone || '';
            if (newPhone && newPhone !== bookie.phone) {
                const existingByPhone = await Admin.findOne({ phone: newPhone });
                if (existingByPhone) {
                    return res.status(409).json({
                        success: false,
                        message: 'A bookie with this phone number already exists',
                    });
                }
            }
            bookie.phone = newPhone;
        }
        if (status && ['active', 'inactive'].includes(status)) bookie.status = status;
        if (uiTheme && typeof uiTheme === 'object') {
            if (!bookie.uiTheme) bookie.uiTheme = { themeId: 'default' };
            const validThemeIds = ['default', 'gold', 'blue', 'green', 'red', 'purple'];
            if (uiTheme.themeId && validThemeIds.includes(uiTheme.themeId)) bookie.uiTheme.themeId = uiTheme.themeId;
            if (uiTheme.primaryColor !== undefined) bookie.uiTheme.primaryColor = uiTheme.primaryColor ? String(uiTheme.primaryColor).trim() : undefined;
            if (uiTheme.accentColor !== undefined) bookie.uiTheme.accentColor = uiTheme.accentColor ? String(uiTheme.accentColor).trim() : undefined;
        }
        // Update commission percentage if provided
        if (commissionPercentage != null) {
            const cp = Number(commissionPercentage);
            if (Number.isFinite(cp) && cp >= 0 && cp <= 100) {
                bookie.commissionPercentage = cp;
            }
        }
        // Update payment management permission if provided
        if (canManagePayments !== undefined) {
            bookie.canManagePayments = Boolean(canManagePayments);
        }
        // Update balance if provided (super admin can set bookie balance)
        console.log(`[updateBookie] Balance from request: ${balance}, type: ${typeof balance}`);
        if (balance !== undefined && balance !== null && balance !== '') {
            const newBal = Number(balance);
            console.log(`[updateBookie] Setting balance: old=${bookie.balance}, new=${newBal}`);
            if (Number.isFinite(newBal) && newBal >= 0) {
                bookie.balance = newBal;
                console.log(`[updateBookie] Balance set to: ${bookie.balance}`);
            }
        }
        // Update password if provided
        if (password) {
            if (password.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: 'Password must be at least 6 characters',
                });
            }
            bookie.password = password;
        }

        await bookie.save();
        await invalidateAdminReadCaches('bookie_updated');
        if (balance !== undefined && balance !== null && balance !== '') {
            await notifyBookiePanelBalance(bookie._id, 'admin_update', bookie.balance);
        }

        await logActivity({
            action: 'update_bookie',
            performedBy: req.admin?.username || 'Admin',
            performedByType: req.admin?.role || 'admin',
            targetType: 'bookie',
            targetId: bookie._id.toString(),
            details: `Bookie "${bookie.username}" updated`,
            ip: getClientIp(req),
        });

        res.status(200).json({
            success: true,
            message: 'Bookie updated successfully',
            data: {
                id: bookie._id,
                username: bookie.username,
                email: bookie.email,
                phone: bookie.phone,
                status: bookie.status,
                role: bookie.role,
                uiTheme: bookie.uiTheme,
                commissionPercentage: bookie.commissionPercentage,
                canManagePayments: bookie.canManagePayments,
            },
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Username already exists',
            });
        }
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Delete bookie
 * Only super_admin can delete
 * Body: { secretDeclarePassword?: string } – required if admin has it set
 */
export const deleteBookie = async (req, res) => {
    try {
        if (req.admin?.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Only Super Admin can delete bookies',
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

        const bookie = await Admin.findOne({ _id: id, role: 'bookie' });
        if (!bookie) {
            return res.status(404).json({
                success: false,
                message: 'Bookie not found',
            });
        }

        const username = bookie.username;
        await Admin.findByIdAndDelete(id);
        await invalidateAdminReadCaches('bookie_deleted');

        await logActivity({
            action: 'delete_bookie',
            performedBy: req.admin?.username || 'Admin',
            performedByType: req.admin?.role || 'admin',
            targetType: 'bookie',
            targetId: id,
            details: `Bookie "${username}" deleted`,
            ip: getClientIp(req),
        });

        res.status(200).json({
            success: true,
            message: 'Bookie deleted successfully',
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Toggle bookie status (active/inactive)
 * Only super_admin can toggle.
 * Body: { secretDeclarePassword?: string } – required if admin has it set
 */
export const toggleBookieStatus = async (req, res) => {
    try {
        if (req.admin?.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Only Super Admin can toggle bookie status',
            });
        }
        const adminWithSecret = await Admin.findById(req.admin._id).select('+secretDeclarePassword').lean();
        if (adminWithSecret?.secretDeclarePassword) {
            const provided = (req.body.secretDeclarePassword ?? '').toString().trim();
            const isValid = await bcrypt.compare(provided, adminWithSecret.secretDeclarePassword);
            if (!isValid) {
                return res.status(403).json({
                    success: false,
                    message: 'Invalid secret declare password. Please enter the correct password.',
                    code: 'INVALID_SECRET_DECLARE_PASSWORD',
                });
            }
        }
        const { id } = req.params;

        const bookie = await Admin.findOne({ _id: id, role: 'bookie' });
        if (!bookie) {
            return res.status(404).json({
                success: false,
                message: 'Bookie not found',
            });
        }

        bookie.status = bookie.status === 'active' ? 'inactive' : 'active';
        await bookie.save();
        await invalidateAdminReadCaches('bookie_status_toggled');

        await logActivity({
            action: 'toggle_bookie_status',
            performedBy: req.admin?.username || 'Admin',
            performedByType: req.admin?.role || 'admin',
            targetType: 'bookie',
            targetId: bookie._id.toString(),
            details: `Bookie "${bookie.username}" ${bookie.status === 'active' ? 'activated' : 'deactivated'}`,
            ip: getClientIp(req),
        });

        res.status(200).json({
            success: true,
            message: `Bookie ${bookie.status === 'active' ? 'activated' : 'deactivated'} successfully`,
            data: {
                id: bookie._id,
                username: bookie.username,
                status: bookie.status,
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /admin/me/secret-declare-password-status
 * Super admin only. Returns whether secret declare password is set.
 */
export const getSecretDeclarePasswordStatus = async (req, res) => {
    try {
        const role = req.admin?.role;
        if (role !== 'super_admin' && role !== 'specific_admin') {
            return res.status(403).json({ success: false, message: 'Not allowed' });
        }
        const admin = await Admin.findById(req.admin._id).select('secretDeclarePassword').lean();
        if (!admin) {
            return res.status(404).json({ success: false, message: 'Admin not found' });
        }
        res.status(200).json({
            success: true,
            hasSecretDeclarePassword: !!(admin.secretDeclarePassword && admin.secretDeclarePassword.length > 0),
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * PATCH /admin/me/secret-declare-password
 * Super admin only. Set or update secret declare password.
 * Body: { secretDeclarePassword: string } – min 4 chars
 *       { currentSecretDeclarePassword: string } – required when updating (if you remember it)
 *       { adminLoginPassword: string } – alternative when forgot secret: use admin login password to reset
 */
export const setSecretDeclarePassword = async (req, res) => {
    try {
        const { secretDeclarePassword, currentSecretDeclarePassword, adminLoginPassword } = req.body;
        const val = (secretDeclarePassword ?? '').toString().trim();
        if (val.length < 4) {
            return res.status(400).json({
                success: false,
                message: 'Secret declare password must be at least 4 characters',
            });
        }
        const admin = await Admin.findById(req.admin._id).select('+secretDeclarePassword');
        if (!admin) {
            return res.status(404).json({ success: false, message: 'Admin not found' });
        }
        // If secret is already set, require verification: either current secret OR admin login password (forgot flow)
        if (admin.secretDeclarePassword && admin.secretDeclarePassword.length > 0) {
            const current = (currentSecretDeclarePassword ?? '').toString().trim();
            const adminPwd = (adminLoginPassword ?? '').toString().trim();
            if (current) {
                const isMatch = await admin.compareSecretDeclarePassword(current);
                if (!isMatch) {
                    return res.status(401).json({
                        success: false,
                        message: 'Current secret password is incorrect',
                    });
                }
            } else if (adminPwd) {
                const isLoginMatch = await admin.comparePassword(adminPwd);
                if (!isLoginMatch) {
                    return res.status(401).json({
                        success: false,
                        message: 'Admin login password is incorrect',
                    });
                }
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Enter current secret password, or your admin login password if you forgot it',
                });
            }
        }
        admin.secretDeclarePassword = val;
        await admin.save({ validateBeforeSave: false });
        await logActivity({
            action: 'set_secret_declare_password',
            performedBy: req.admin.username,
            performedByType: 'super_admin',
            targetType: 'admin',
            targetId: admin._id.toString(),
            details: 'Secret declare password updated',
            ip: getClientIp(req),
        });
        res.status(200).json({
            success: true,
            message: 'Secret declare password set successfully',
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET SP Common list – chart list for SP Common bets (reference / UI); declare accepts any 3-digit patti.
 */
export const getSpCommonList = async (req, res) => {
    try {
        res.status(200).json({ success: true, data: { list: SP_COMMON_LIST } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET DP Common list – chart list for DP Common bets (reference / UI); declare accepts any 3-digit patti.
 */
export const getDpCommonList = async (req, res) => {
    try {
        res.status(200).json({ success: true, data: { list: DP_COMMON_LIST } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
