import Admin from '../models/admin/admin.js';
import User from '../models/user/user.js';
import CommissionPayment from '../models/commission/commissionPayment.js';
import BookieWalletTransaction from '../models/bookieWalletTransaction/bookieWalletTransaction.js';
import { Wallet } from '../models/wallet/wallet.js';
import { logActivity, getClientIp } from '../utils/activityLogger.js';
import { invalidateAdminReadCaches } from '../services/cacheInvalidationService.js';
import { PHONE_REGEX } from './superBookieController.js';
import { canAccessBookieManagement } from '../utils/adminTabAccess.js';
import {
    getCommissionSummaryForAccount,
    getCommissionDashboardForAccount,
    getPerPlayerCommissionRows,
    getCommissionPaymentKind,
} from '../utils/commissionMetrics.js';
import { getPanelRevenueKpisForAdmin } from '../utils/panelRevenueDashboard.js';
import { getBookieWalletTxLabel } from '../utils/bookieWalletLedger.js';
import { notifyBookiePanelBalance, notifyBookiePanelBalances } from '../utils/notifyBookiePanelBalance.js';
import { recordBookieWalletTransaction } from '../utils/bookieWalletLedger.js';
import {
    transferAdvanceCommissionToSuperBookie,
    transferAfterPaidInitialBalanceToSuperBookie,
} from '../utils/advanceCommissionTransfer.js';

/** Admin: list all super bookies with parent bookie + player counts */
export const getAllSuperBookiesAdmin = async (req, res) => {
    try {
        if (req.admin?.role !== 'super_admin' && !canAccessBookieManagement(req.admin)) {
            return res.status(403).json({
                success: false,
                message: 'You do not have access to super bookie accounts',
            });
        }

        const list = await Admin.find({ role: 'super_bookie' })
            .select('-password')
            .populate('parentBookieId', 'username phone status')
            .sort({ createdAt: -1 })
            .lean();

        const sbIds = list.map((sb) => sb._id);
        let countMap = {};
        if (sbIds.length > 0) {
            const counts = await User.aggregate([
                { $match: { referredBy: { $in: sbIds } } },
                { $group: { _id: '$referredBy', count: { $sum: 1 } } },
            ]);
            countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));
        }

        res.status(200).json({
            success: true,
            data: list.map((sb) => ({
                ...sb,
                playerCount: countMap[String(sb._id)] || 0,
            })),
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const assertParentBookie = (req, res) => {
    if (req.admin?.role !== 'bookie') {
        res.status(403).json({ success: false, message: 'Bookie access required' });
        return false;
    }
    return true;
};

export const listSuperBookies = async (req, res) => {
    try {
        if (!assertParentBookie(req, res)) return;
        const list = await Admin.find({
            role: 'super_bookie',
            parentBookieId: req.admin._id,
        })
            .select('username email phone status balance commissionPercentage canManagePayments createdAt role parentBookieId')
            .sort({ createdAt: -1 })
            .lean();

        const withCounts = await Promise.all(
            list.map(async (sb) => {
                const playerCount = await User.countDocuments({ referredBy: sb._id });
                const commissionSummary = await getCommissionSummaryForAccount(sb);
                return {
                    ...sb,
                    playerCount,
                    totalCommissionAmount: commissionSummary.totalCommission,
                    totalCommissionPaid: commissionSummary.totalPaid,
                    totalCommissionPending: commissionSummary.totalPending,
                };
            })
        );

        res.status(200).json({ success: true, data: withCounts });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const createSuperBookie = async (req, res) => {
    try {
        if (!assertParentBookie(req, res)) return;

        const {
            username,
            firstName,
            lastName,
            email,
            password,
            phone,
            balance,
            commissionPercentage,
            canManagePayments,
            initialBalancePaymentMode,
        } = req.body;
        const derivedUsername =
            firstName != null && lastName != null
                ? `${String(firstName).trim()} ${String(lastName).trim()}`.trim()
                : username != null
                  ? String(username).trim()
                  : '';

        if (!derivedUsername) {
            return res.status(400).json({ success: false, message: 'Name or username is required' });
        }
        if (!password || password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }
        if (!phone) {
            return res.status(400).json({ success: false, message: 'Phone number is required' });
        }

        const trimmedPhone = String(phone).replace(/\D/g, '').slice(0, 10);
        if (!PHONE_REGEX.test(trimmedPhone)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid 10-digit phone number (starting with 6–9)',
            });
        }

        const existing = await Admin.findOne({
            $or: [{ username: derivedUsername }, { phone: trimmedPhone }].filter(Boolean),
        });
        if (existing) {
            if (existing.phone === trimmedPhone) {
                return res.status(409).json({ success: false, message: 'Phone number already in use' });
            }
            return res.status(409).json({ success: false, message: 'Username already exists' });
        }

        const initialBalance =
            balance != null && Number.isFinite(Number(balance)) ? Math.max(0, Number(balance)) : 0;

        let parentAfterDeduct = null;
        if (initialBalance > 0) {
            parentAfterDeduct = await Admin.findOneAndUpdate(
                { _id: req.admin._id, role: 'bookie', balance: { $gte: initialBalance } },
                { $inc: { balance: -initialBalance } },
                { new: true }
            ).select('balance');
            if (!parentAfterDeduct) {
                return res.status(400).json({
                    success: false,
                    message: 'Insufficient bookie balance to allocate to super bookie',
                });
            }
        }

        let commissionPct = 0;
        if (commissionPercentage != null && commissionPercentage !== '') {
            commissionPct = Number(commissionPercentage);
            if (!Number.isFinite(commissionPct) || commissionPct < 0 || commissionPct > 100) {
                return res.status(400).json({
                    success: false,
                    message: 'Commission percentage must be between 0 and 100',
                });
            }
        }

        const paymentMode =
            initialBalancePaymentMode === 'after_paid' ? 'after_paid' : 'advance_paid';

        const superBookie = new Admin({
            username: derivedUsername,
            password,
            role: 'super_bookie',
            parentBookieId: req.admin._id,
            email: email && String(email).trim() ? String(email).trim().toLowerCase() : '',
            phone: trimmedPhone,
            status: 'active',
            balance: initialBalance,
            commissionPercentage: commissionPct,
            canManagePayments: Boolean(canManagePayments),
            initialBalancePaymentMode: initialBalance > 0 ? paymentMode : 'advance_paid',
        });
        await superBookie.save();
        await invalidateAdminReadCaches('super_bookie_created');
        await notifyBookiePanelBalances([req.admin._id, superBookie._id], 'super_bookie_created');

        if (initialBalance > 0) {
            try {
                if (paymentMode === 'advance_paid') {
                    await transferAfterPaidInitialBalanceToSuperBookie({
                        parentBookieId: req.admin._id,
                        parentUsername: req.admin.username,
                        superBookieId: superBookie._id,
                        superBookieUsername: superBookie.username,
                        amount: initialBalance,
                        notes: 'Advance paid initial balance from bookie',
                        parentBalanceAfter: parentAfterDeduct?.balance ?? null,
                        superBookieBalanceAfter: superBookie.balance ?? 0,
                    });
                } else {
                    await transferAdvanceCommissionToSuperBookie({
                        parentBookieId: req.admin._id,
                        parentUsername: req.admin.username,
                        superBookieId: superBookie._id,
                        superBookieUsername: superBookie.username,
                        amount: initialBalance,
                        notes: 'After paid initial balance from bookie',
                        createdById: req.admin._id,
                        parentBalanceAfter: parentAfterDeduct?.balance ?? null,
                        superBookieBalanceAfter: superBookie.balance ?? 0,
                        isInitialBalance: true,
                    });
                }
            } catch (ledgerErr) {
                await Admin.findByIdAndDelete(superBookie._id);
                if (parentAfterDeduct) {
                    await Admin.findByIdAndUpdate(req.admin._id, {
                        $inc: { balance: initialBalance },
                    });
                }
                console.error('[createSuperBookie] Wallet ledger failed:', ledgerErr.message);
                return res.status(500).json({
                    success: false,
                    message:
                        ledgerErr.message
                        || 'Super bookie created but wallet ledger failed. Please try again.',
                });
            }
        }

        await logActivity({
            action: 'create_super_bookie',
            performedBy: req.admin.username,
            performedByType: 'bookie',
            targetType: 'super_bookie',
            targetId: superBookie._id.toString(),
            details: `Super bookie "${superBookie.username}" created by bookie`,
            ip: getClientIp(req),
        });

        res.status(201).json({
            success: true,
            message: `Super bookie created. Login with phone ${trimmedPhone}`,
            data: {
                id: superBookie._id,
                username: superBookie.username,
                phone: superBookie.phone,
                status: superBookie.status,
                balance: superBookie.balance ?? 0,
                commissionPercentage: superBookie.commissionPercentage ?? 0,
                canManagePayments: Boolean(superBookie.canManagePayments),
            },
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: 'Username or phone already exists' });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateSuperBookie = async (req, res) => {
    try {
        if (!assertParentBookie(req, res)) return;
        const { id } = req.params;
        const sb = await Admin.findOne({
            _id: id,
            role: 'super_bookie',
            parentBookieId: req.admin._id,
        });
        if (!sb) {
            return res.status(404).json({ success: false, message: 'Super bookie not found' });
        }

        const {
            firstName,
            lastName,
            username,
            email,
            password,
            phone,
            commissionPercentage,
            canManagePayments,
        } = req.body;
        if (firstName != null && lastName != null) {
            const name = `${String(firstName).trim()} ${String(lastName).trim()}`.trim();
            if (name) sb.username = name;
        } else if (username) {
            sb.username = String(username).trim();
        }
        if (email !== undefined) sb.email = email ? String(email).trim().toLowerCase() : '';
        if (phone) {
            const trimmedPhone = String(phone).replace(/\D/g, '').slice(0, 10);
            if (!PHONE_REGEX.test(trimmedPhone)) {
                return res.status(400).json({ success: false, message: 'Invalid phone number' });
            }
            const phoneTaken = await Admin.findOne({
                phone: trimmedPhone,
                _id: { $ne: sb._id },
            });
            if (phoneTaken) {
                return res.status(409).json({ success: false, message: 'Phone already in use' });
            }
            sb.phone = trimmedPhone;
        }
        if (password && password.length >= 6) sb.password = password;
        if (commissionPercentage != null && commissionPercentage !== '') {
            const commissionPct = Number(commissionPercentage);
            if (!Number.isFinite(commissionPct) || commissionPct < 0 || commissionPct > 100) {
                return res.status(400).json({
                    success: false,
                    message: 'Commission percentage must be between 0 and 100',
                });
            }
            sb.commissionPercentage = commissionPct;
        }
        if (canManagePayments !== undefined) {
            sb.canManagePayments = Boolean(canManagePayments);
        }
        await sb.save();

        res.status(200).json({
            success: true,
            message: 'Super bookie updated',
            data: {
                id: sb._id,
                username: sb.username,
                phone: sb.phone,
                email: sb.email,
                status: sb.status,
                balance: sb.balance ?? 0,
                commissionPercentage: sb.commissionPercentage ?? 0,
                canManagePayments: Boolean(sb.canManagePayments),
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const toggleSuperBookieStatus = async (req, res) => {
    try {
        if (!assertParentBookie(req, res)) return;
        const sb = await Admin.findOne({
            _id: req.params.id,
            role: 'super_bookie',
            parentBookieId: req.admin._id,
        });
        if (!sb) {
            return res.status(404).json({ success: false, message: 'Super bookie not found' });
        }
        sb.status = sb.status === 'active' ? 'inactive' : 'active';
        await sb.save();
        res.status(200).json({
            success: true,
            message: `Super bookie ${sb.status === 'active' ? 'activated' : 'suspended'}`,
            data: { id: sb._id, status: sb.status },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Parent bookie: delete a super bookie (no linked players; balance returned to parent).
 * DELETE /api/v1/bookie/super-bookies/:id
 */
export const deleteSuperBookie = async (req, res) => {
    try {
        if (!assertParentBookie(req, res)) return;

        const sb = await Admin.findOne({
            _id: req.params.id,
            role: 'super_bookie',
            parentBookieId: req.admin._id,
        });
        if (!sb) {
            return res.status(404).json({ success: false, message: 'Super bookie not found' });
        }

        const playerCount = await User.countDocuments({ referredBy: sb._id });
        if (playerCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete: ${playerCount} player(s) are linked to this super bookie. Remove or reassign them first.`,
                code: 'HAS_PLAYERS',
                playerCount,
            });
        }

        const returnBalance = Math.max(0, Number(sb.balance) || 0);
        if (returnBalance > 0) {
            await Admin.findByIdAndUpdate(req.admin._id, { $inc: { balance: returnBalance } });
        }

        const username = sb.username;
        await Admin.findByIdAndDelete(sb._id);
        await invalidateAdminReadCaches('super_bookie_deleted');
        await notifyBookiePanelBalance(req.admin._id, 'super_bookie_deleted', undefined);

        await logActivity({
            action: 'delete_super_bookie',
            performedBy: req.admin.username,
            performedByType: 'bookie',
            targetType: 'super_bookie',
            targetId: String(sb._id),
            details: `Super bookie "${username}" deleted by parent bookie${
                returnBalance > 0 ? `; ₹${returnBalance} returned to bookie wallet` : ''
            }`,
            ip: getClientIp(req),
        });

        return res.status(200).json({
            success: true,
            message:
                returnBalance > 0
                    ? `Super bookie deleted. ₹${returnBalance} returned to your balance.`
                    : 'Super bookie deleted successfully',
            data: { returnedBalance: returnBalance },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const adjustSuperBookieBalance = async (req, res) => {
    try {
        if (!assertParentBookie(req, res)) return;
        const { operation, amount } = req.body;
        const delta = Number(amount);
        if (!Number.isFinite(delta) || delta <= 0) {
            return res.status(400).json({ success: false, message: 'Valid positive amount required' });
        }

        const sb = await Admin.findOne({
            _id: req.params.id,
            role: 'super_bookie',
            parentBookieId: req.admin._id,
        });
        if (!sb) {
            return res.status(404).json({ success: false, message: 'Super bookie not found' });
        }

        let parent = null;
        if (operation === 'add') {
            parent = await Admin.findOneAndUpdate(
                { _id: req.admin._id, role: 'bookie', balance: { $gte: delta } },
                { $inc: { balance: -delta } },
                { new: true }
            );
            if (!parent) {
                return res.status(400).json({ success: false, message: 'Insufficient bookie balance' });
            }
            sb.balance = (sb.balance || 0) + delta;
        } else if (operation === 'deduct') {
            if ((sb.balance || 0) < delta) {
                return res.status(400).json({ success: false, message: 'Insufficient super bookie balance' });
            }
            sb.balance = (sb.balance || 0) - delta;
            await Admin.findByIdAndUpdate(req.admin._id, { $inc: { balance: delta } });
        } else {
            return res.status(400).json({ success: false, message: 'operation must be add or deduct' });
        }

        await sb.save();
        await notifyBookiePanelBalances([req.admin._id, sb._id], 'super_bookie_balance_adjust');

        if (operation === 'add') {
            await transferAdvanceCommissionToSuperBookie({
                parentBookieId: req.admin._id,
                parentUsername: req.admin.username,
                superBookieId: sb._id,
                superBookieUsername: sb.username,
                amount: delta,
                notes: 'Advance commission (balance add)',
                createdById: req.admin._id,
                parentBalanceAfter: parent?.balance ?? null,
                superBookieBalanceAfter: sb.balance ?? 0,
            });
        } else if (operation === 'deduct') {
            const parentDoc = await Admin.findById(req.admin._id).select('balance').lean();
            await recordBookieWalletTransaction({
                adminId: sb._id,
                direction: 'debit',
                type: 'balance_adjustment',
                amount: delta,
                balanceAfter: sb.balance ?? 0,
                description: `Balance returned to bookie ${req.admin.username}`,
                referenceId: String(sb._id),
            });
            if (parentDoc) {
                await recordBookieWalletTransaction({
                    adminId: req.admin._id,
                    direction: 'credit',
                    type: 'balance_adjustment',
                    amount: delta,
                    balanceAfter: parentDoc.balance ?? 0,
                    description: `Recovered from super bookie ${sb.username}`,
                    referenceId: String(sb._id),
                });
            }
        }

        res.status(200).json({
            success: true,
            data: { id: sb._id, balance: sb.balance },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const findOwnedSuperBookie = async (parentBookieId, superBookieId, select = '_id username') => {
    return Admin.findOne({
        _id: superBookieId,
        parentBookieId,
        role: 'super_bookie',
    })
        .select(select)
        .lean();
};

/** Parent bookie: all players under a child super_bookie (same shape as admin players API) */
export const getSuperBookiePlayersForParent = async (req, res) => {
    try {
        if (!assertParentBookie(req, res)) return;

        const { id: superBookieId } = req.params;
        const superBookie = await findOwnedSuperBookie(req.admin._id, superBookieId, '_id username');
        if (!superBookie) {
            return res.status(404).json({ success: false, message: 'Sub-account not found' });
        }

        const players = await User.find({ referredBy: superBookieId })
            .select('username phone email isActive createdAt lastActiveAt')
            .sort({ createdAt: -1 })
            .limit(500)
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

/** Parent bookie: commission + revenue dashboard for a child super_bookie */
export const getSuperBookieCommissionDashboardForParent = async (req, res) => {
    try {
        if (!assertParentBookie(req, res)) return;

        const { id: superBookieId } = req.params;
        const { startDate, endDate } = req.query;

        const parentBookie = await Admin.findById(req.admin._id)
            .select('_id username')
            .lean();
        if (!parentBookie) {
            return res.status(404).json({ success: false, message: 'Bookie not found' });
        }

        const superBookie = await findOwnedSuperBookie(
            req.admin._id,
            superBookieId,
            '_id username phone email status balance commissionPercentage role createdAt',
        );
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
                    _id: parentBookie._id,
                    username: parentBookie.username,
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
