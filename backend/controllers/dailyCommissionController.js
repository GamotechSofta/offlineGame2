import DailyCommission from '../models/dailyCommission/dailyCommission.js';
import Admin from '../models/admin/admin.js';
import CommissionPayment from '../models/commission/commissionPayment.js';
import { ADMIN_TAB, denyUnlessTabAccess, denyUnlessSuperAdmin } from '../utils/adminTabAccess.js';
import { isBookiePanelRole } from '../utils/adminRoles.js';
import {
    aggregatePlayerBetMetrics,
    getCommissionDashboardForAccount,
    getCommissionSummaryForAccount,
    getCommissionPaymentKind,
    getAdvanceAvailableForSettlement,
    isSettlementPaidWithAdvance,
    calculateCommissionAmount,
    calculateAdminCommissionAmount,
    getAdminShareSettlementForBookie,
    buildAdminAllCommissionSummaryRows,
    round2,
} from '../utils/commissionMetrics.js';
import { notifyBookiePanelBalances } from '../utils/notifyBookiePanelBalance.js';
import {
    transferCommissionSettlementToSuperBookie,
    recordCommissionSettlementPaidWithAdvance,
    recordCommissionSettlementPaidWithOther,
    transferBetCommissionRecoveryToSuperBookie,
    InsufficientBookieBalanceError,
} from '../utils/advanceCommissionTransfer.js';

const getPaymentStatusFromAmounts = (commissionAmount, paidAmount) => {
    const total = round2(commissionAmount);
    const paid = round2(paidAmount);
    if (paid <= 0) return 'pending';
    if (paid >= total) return 'paid';
    return 'partial';
};

/**
 * Calculate and store daily commission for all bookies for a specific date
 * Commission is calculated on total daily revenue (sum of all bet amounts)
 * POST /api/v1/daily-commission/calculate
 * Body: { date: 'YYYY-MM-DD' } (optional, defaults to yesterday)
 */
export const calculateDailyCommission = async (req, res) => {
    try {
        const { date } = req.body;
        
        // Default to yesterday if no date provided
        let targetDate;
        if (date) {
            targetDate = new Date(date);
            targetDate.setHours(0, 0, 0, 0);
        } else {
            // Yesterday at midnight IST
            targetDate = new Date();
            targetDate.setDate(targetDate.getDate() - 1);
            targetDate.setHours(0, 0, 0, 0);
        }
        
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        // Get all bookies
        const bookies = await Admin.find({ role: 'bookie' })
            .select('_id username commissionPercentage role')
            .lean();
        
        const results = [];
        
        for (const bookie of bookies) {
            try {
                const dateFilter = { createdAt: { $gte: startOfDay, $lte: endOfDay } };
                const metrics = await aggregatePlayerBetMetrics({ admin: bookie, dateFilter });
                const totalRevenue = metrics.totalBetAmount;
                const totalBets = metrics.totalBets;
                const totalPayouts = metrics.totalPayouts;
                const commissionPercentage = bookie.commissionPercentage || 0;
                
                // Calculate commission on total daily revenue
                const commissionAmount = commissionPercentage > 0
                    ? Math.round((totalRevenue * commissionPercentage / 100) * 100) / 100
                    : 0;
                
                // Check if record already exists
                const existing = await DailyCommission.findOne({
                    bookieId: bookie._id,
                    date: startOfDay,
                });
                
                if (existing) {
                    // Update existing record
                    const safePaidAmount = round2(Math.min(existing.paidAmount || 0, commissionAmount));
                    const pendingAmount = round2(Math.max(0, commissionAmount - safePaidAmount));
                    existing.totalRevenue = totalRevenue;
                    existing.commissionPercentage = commissionPercentage;
                    existing.commissionAmount = commissionAmount;
                    existing.paidAmount = safePaidAmount;
                    existing.pendingAmount = pendingAmount;
                    existing.paymentStatus = getPaymentStatusFromAmounts(commissionAmount, safePaidAmount);
                    existing.totalBets = totalBets;
                    existing.totalPayouts = totalPayouts;
                    existing.status = 'processed';
                    existing.processedAt = new Date();
                    await existing.save();
                    
                    results.push({
                        bookieId: bookie._id,
                        bookieName: bookie.username,
                        date: targetDate.toISOString().split('T')[0],
                        totalRevenue,
                        commissionPercentage,
                        commissionAmount,
                        status: 'updated',
                    });
                } else {
                    // Create new record
                    await DailyCommission.create({
                        bookieId: bookie._id,
                        date: startOfDay,
                        totalRevenue,
                        commissionPercentage,
                        commissionAmount,
                        paidAmount: 0,
                        pendingAmount: commissionAmount,
                        paymentStatus: commissionAmount > 0 ? 'pending' : 'paid',
                        totalBets,
                        totalPayouts,
                        status: 'processed',
                        processedAt: new Date(),
                    });
                    
                    results.push({
                        bookieId: bookie._id,
                        bookieName: bookie.username,
                        date: targetDate.toISOString().split('T')[0],
                        totalRevenue,
                        commissionPercentage,
                        commissionAmount,
                        status: 'created',
                    });
                }
            } catch (bookieError) {
                console.error(`Error processing bookie ${bookie._id}:`, bookieError);
                results.push({
                    bookieId: bookie._id,
                    bookieName: bookie.username,
                    error: bookieError.message,
                });
            }
        }
        
        res.status(200).json({
            success: true,
            message: `Daily commission calculated for ${targetDate.toISOString().split('T')[0]}`,
            data: {
                date: targetDate.toISOString().split('T')[0],
                results,
            },
        });
    } catch (error) {
        console.error('[calculateDailyCommission]', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to calculate daily commission',
        });
    }
};

/**
 * Bookie / super bookie commission dashboard (all-time settlement + optional period).
 * GET /api/v1/daily-commission/my-summary?startDate=&endDate=
 */
export const getMyCommissionSummary = async (req, res) => {
    try {
        if (!isBookiePanelRole(req.admin)) {
            return res.status(403).json({
                success: false,
                message: 'Bookie or super bookie access required',
            });
        }

        const { startDate, endDate } = req.query;
        const data = await getCommissionDashboardForAccount(req.admin, { startDate, endDate });

        return res.status(200).json({
            success: true,
            data,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch commission summary',
        });
    }
};

/**
 * Get daily commission records for a bookie
 * GET /api/v1/daily-commission?startDate=&endDate=
 */
export const getDailyCommissions = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const bookie = req.admin;
        
        if (!isBookiePanelRole(bookie)) {
            return res.status(403).json({
                success: false,
                message: 'Only bookies or super bookies can view their daily commissions',
            });
        }
        
        const query = { bookieId: bookie._id };
        
        if (startDate || endDate) {
            query.date = {};
            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                query.date.$gte = start;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.date.$lte = end;
            }
        }
        
        const commissions = await DailyCommission.find(query)
            .sort({ date: -1 })
            .lean();
        
        res.status(200).json({
            success: true,
            data: commissions,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch daily commissions',
        });
    }
};

/**
 * Get daily commission records for all bookies (super admin only)
 * GET /api/v1/daily-commission/all?startDate=&endDate=&bookieId=
 */
export const getAllDailyCommissions = async (req, res) => {
    try {
        if (denyUnlessTabAccess(res, req.admin, ADMIN_TAB.BOOKIE_COMMISSIONS, 'You do not have access to bookie commissions')) {
            return;
        }
        
        const { startDate, endDate, bookieId, paymentStatus } = req.query;
        const query = {};
        
        if (bookieId) {
            query.bookieId = bookieId;
        }
        
        if (startDate || endDate) {
            query.date = {};
            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                query.date.$gte = start;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.date.$lte = end;
            }
        }

        if (paymentStatus && ['pending', 'partial', 'paid'].includes(paymentStatus)) {
            query.paymentStatus = paymentStatus;
        }
        
        const commissions = await DailyCommission.find(query)
            .populate('bookieId', 'username phone')
            .populate('lastPaidBy', 'username')
            .sort({ date: -1, bookieId: 1 })
            .lean();
        
        const normalizedCommissions = commissions.map((item) => {
            const commissionAmount = round2(item.commissionAmount || 0);
            const paidAmount = round2(item.paidAmount || 0);
            const pendingAmount = round2(
                item.pendingAmount === undefined || item.pendingAmount === null
                    ? Math.max(0, commissionAmount - paidAmount)
                    : item.pendingAmount
            );
            const normalizedPaymentStatus = item.paymentStatus
                || getPaymentStatusFromAmounts(commissionAmount, paidAmount);
            return {
                ...item,
                commissionAmount,
                paidAmount,
                pendingAmount,
                paymentStatus: normalizedPaymentStatus,
            };
        });

        const summary = normalizedCommissions.reduce((acc, item) => {
            acc.totalCommission += item.commissionAmount;
            acc.totalPaid += item.paidAmount;
            acc.totalPending += item.pendingAmount;
            return acc;
        }, { totalCommission: 0, totalPaid: 0, totalPending: 0 });

        res.status(200).json({
            success: true,
            data: {
                commissions: normalizedCommissions,
                summary: {
                    totalCommission: round2(summary.totalCommission),
                    totalPaid: round2(summary.totalPaid),
                    totalPending: round2(summary.totalPending),
                },
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch daily commissions',
        });
    }
};

/**
 * Get all-time commission summary grouped by bookie (super admin only)
 * GET /api/v1/daily-commission/all-summary?paymentStatus=
 */
export const getAllCommissionSummary = async (req, res) => {
    try {
        if (denyUnlessTabAccess(res, req.admin, ADMIN_TAB.BOOKIE_COMMISSIONS, 'You do not have access to bookie commissions')) {
            return;
        }

        const { paymentStatus } = req.query;

        const [parentBookies, subBookies] = await Promise.all([
            Admin.find({ role: 'bookie' })
                .select('_id username phone commissionPercentage adminCommissionPercentage role')
                .lean(),
            Admin.find({ role: 'super_bookie' })
                .select('_id username phone commissionPercentage role parentBookieId')
                .populate('parentBookieId', 'username')
                .lean(),
        ]);

        const normalized = await buildAdminAllCommissionSummaryRows(parentBookies, subBookies);

        let filtered = normalized;
        if (paymentStatus === 'paid') {
            filtered = normalized.filter((row) => row.paymentStatus === 'paid');
        } else if (paymentStatus === 'pending') {
            filtered = normalized.filter((row) => row.paymentStatus === 'pending' || row.paymentStatus === 'partial');
        }

        const summary = filtered.reduce((acc, row) => {
            acc.totalCommission += row.totalCommission;
            acc.totalPaid += row.totalPaid;
            acc.totalPending += row.totalPending;
            return acc;
        }, { totalCommission: 0, totalPaid: 0, totalPending: 0 });

        return res.status(200).json({
            success: true,
            data: {
                commissions: filtered,
                summary: {
                    totalCommission: round2(summary.totalCommission),
                    totalPaid: round2(summary.totalPaid),
                    totalPending: round2(summary.totalPending),
                },
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch all-time commissions',
        });
    }
};

/**
 * Record commission payment for a specific daily commission row (super admin only)
 * POST /api/v1/daily-commission/:commissionId/pay
 * Body: { paidAmount: number, notes?: string }
 */
export const recordCommissionPayment = async (req, res) => {
    try {
        if (denyUnlessSuperAdmin(res, req.admin, 'Only Super Admin can mark commission payments')) {
            return;
        }

        const { commissionId } = req.params;
        const { paidAmount, notes } = req.body;
        const paymentToAdd = Number(paidAmount);

        if (!Number.isFinite(paymentToAdd) || paymentToAdd <= 0) {
            return res.status(400).json({
                success: false,
                message: 'paidAmount must be a valid number greater than 0',
            });
        }

        const commission = await DailyCommission.findById(commissionId);
        if (!commission) {
            return res.status(404).json({
                success: false,
                message: 'Commission record not found',
            });
        }

        const totalCommission = round2(commission.commissionAmount || 0);
        const existingPaid = round2(commission.paidAmount || 0);
        const remaining = round2(Math.max(0, totalCommission - existingPaid));
        const appliedPayment = round2(Math.min(paymentToAdd, remaining));

        if (appliedPayment <= 0) {
            return res.status(400).json({
                success: false,
                message: 'This commission is already fully paid',
            });
        }

        const newPaid = round2(existingPaid + appliedPayment);
        const newPending = round2(Math.max(0, totalCommission - newPaid));

        commission.paidAmount = newPaid;
        commission.pendingAmount = newPending;
        commission.paymentStatus = getPaymentStatusFromAmounts(totalCommission, newPaid);
        commission.lastPaidAt = new Date();
        commission.lastPaidBy = req.admin._id;
        if (typeof notes === 'string') {
            commission.paymentNotes = notes.trim();
        }

        await commission.save();

        await CommissionPayment.create({
            bookieId: commission.bookieId,
            amount: appliedPayment,
            notes: typeof notes === 'string' ? notes.trim() : '',
            paymentType: 'settlement',
            createdBy: req.admin._id,
        });

        return res.status(200).json({
            success: true,
            message: 'Commission payment recorded',
            data: {
                commission,
                appliedPayment,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to record commission payment',
        });
    }
};

/**
 * Record commission payment against a bookie's total pending amount.
 * Amount is distributed to oldest pending daily rows first.
 * POST /api/v1/daily-commission/bookie/:bookieId/pay
 * Body: { paidAmount: number, notes?: string }
 */
export const recordBookieCommissionPayment = async (req, res) => {
    try {
        if (denyUnlessSuperAdmin(res, req.admin, 'Only Super Admin can mark commission payments')) {
            return;
        }

        const { bookieId } = req.params;
        const { paidAmount, notes } = req.body;
        const paymentToApply = Number(paidAmount);
        if (!Number.isFinite(paymentToApply) || paymentToApply <= 0) {
            return res.status(400).json({
                success: false,
                message: 'paidAmount must be a valid number greater than 0',
            });
        }

        const bookie = await Admin.findOne({
            _id: bookieId,
            role: { $in: ['bookie', 'super_bookie'] },
        })
            .select('_id commissionPercentage role')
            .lean();
        if (!bookie) {
            return res.status(404).json({
                success: false,
                message: 'Bookie account not found',
            });
        }

        const summary = await getCommissionSummaryForAccount(bookie);
        let totalPending = summary.totalPending;
        if (bookie.role === 'bookie') {
            const adminCommissionAmount = Number(
                summary.adminCommissionAmount
                ?? calculateAdminCommissionAmount(
                    summary.totalCommission ?? 0,
                    summary.adminCommissionPercentage ?? 10,
                ),
            );
            const { adminPending } = await getAdminShareSettlementForBookie(
                bookie._id,
                adminCommissionAmount,
            );
            totalPending = adminPending;
        }

        if (totalPending <= 0) {
            return res.status(400).json({
                success: false,
                message: 'No pending admin commission found for this account',
            });
        }

        const appliedPayment = round2(Math.min(paymentToApply, totalPending));
        const remaining = round2(Math.max(0, totalPending - appliedPayment));

        await CommissionPayment.create({
            bookieId: bookie._id,
            amount: appliedPayment,
            notes: typeof notes === 'string' ? notes.trim() : '',
            paymentType: 'settlement',
            createdBy: req.admin._id,
        });

        return res.status(200).json({
            success: true,
            message: 'Commission payment recorded',
            data: {
                bookieId,
                appliedPayment,
                leftoverAmount: remaining,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to record commission payment',
        });
    }
};

/**
 * Get payment history for one bookie (super admin only)
 * GET /api/v1/daily-commission/bookie/:bookieId/payments
 */
export const getBookieCommissionPaymentHistory = async (req, res) => {
    try {
        if (denyUnlessTabAccess(res, req.admin, ADMIN_TAB.BOOKIE_COMMISSIONS, 'You do not have access to bookie commissions')) {
            return;
        }

        const { bookieId } = req.params;
        const payments = await CommissionPayment.find({ bookieId })
            .sort({ createdAt: -1 })
            .limit(50)
            .populate('createdBy', 'username')
            .lean();

        return res.status(200).json({
            success: true,
            data: payments.map((payment) => ({
                _id: payment._id,
                amount: round2(payment.amount || 0),
                notes: payment.notes || '',
                createdAt: payment.createdAt,
                createdBy: payment.createdBy?.username || 'Admin',
            })),
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch payment history',
        });
    }
};

/**
 * Bookie / Super Bookie: own commission payment history
 * GET /api/v1/daily-commission/my-payments
 */
export const getMyCommissionPayments = async (req, res) => {
    try {
        if (!isBookiePanelRole(req.admin)) {
            return res.status(403).json({
                success: false,
                message: 'Bookie or super bookie access required',
            });
        }

        const payments = await CommissionPayment.find({ bookieId: req.admin._id })
            .sort({ createdAt: -1 })
            .limit(50)
            .populate('createdBy', 'username role')
            .lean();

        let totalAdvance = 0;
        let totalSettled = 0;
        const rows = payments.map((payment) => {
            const kind = getCommissionPaymentKind(payment);
            const amount = round2(payment.amount || 0);
            if (kind === 'settlement') totalSettled += amount;
            else totalAdvance += amount;
            const notes = payment.notes || '';
            const payerRole = payment.createdBy?.role;
            const isFromAdmin = payerRole === 'super_admin' || payerRole === 'admin';
            const isSuperBookie = req.admin?.role === 'super_bookie';
            let label = isSuperBookie
                ? (isFromAdmin ? 'Advance from admin' : 'Advance from bookie')
                : 'Advance from admin';
            if (kind === 'settlement') label = 'Commission settled';
            else if (kind === 'recovery') label = 'Bet commission → advance recovery';
            else if (/initial balance/i.test(notes)) label = 'Initial balance';
            return {
                _id: payment._id,
                amount,
                notes,
                paymentType: kind,
                createdAt: payment.createdAt,
                label,
                createdBy:
                    payerRole === 'bookie'
                        ? payment.createdBy?.username || 'Bookie'
                        : payment.createdBy?.username || 'Admin',
            };
        });

        return res.status(200).json({
            success: true,
            data: rows,
            totalAdvanceCommission: round2(totalAdvance),
            totalCommissionSettled: round2(totalSettled),
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch payment history',
        });
    }
};

/**
 * Parent bookie: commission summary for all super bookies
 * GET /api/v1/daily-commission/super-bookie-summary
 */
export const getSuperBookieCommissionSummary = async (req, res) => {
    try {
        if (req.admin?.role !== 'bookie') {
            return res.status(403).json({ success: false, message: 'Bookie access required' });
        }

        const superBookies = await Admin.find({
            role: 'super_bookie',
            parentBookieId: req.admin._id,
        })
            .select('_id username phone commissionPercentage role parentBookieId initialBalancePaymentMode')
            .lean();

        const commissions = [];
        for (const sb of superBookies) {
            const summary = await getCommissionSummaryForAccount(sb);
            const subCommissionPct = Number(sb.commissionPercentage ?? summary.parentCommissionPercentage ?? 0);
            const parentCommissionFromSub = calculateCommissionAmount(summary.totalBetAmount, subCommissionPct);
            commissions.push({
                superBookieId: sb._id,
                username: sb.username || 'Unknown',
                phone: sb.phone || '',
                commissionPercentage: subCommissionPct,
                subEarnedCommission: 0,
                playerCount: summary.playerCount,
                betCount: summary.betCount,
                totalBetAmount: summary.totalBetAmount,
                totalCommission: parentCommissionFromSub,
                parentCommissionFromSub,
                totalPaid: 0,
                totalPending: parentCommissionFromSub,
                paymentStatus: parentCommissionFromSub > 0 ? 'pending' : 'none',
                lastPaidAt: null,
                advanceCommissionPaid: 0,
                advancePaidInitial: 0,
                advanceSettledFromAdvance: 0,
                advanceRecoverable: 0,
                initialBalancePaymentMode: summary.initialBalancePaymentMode ?? sb.initialBalancePaymentMode ?? 'advance_paid',
                advanceOutstanding: 0,
                advanceRecovered: 0,
                recoveryPendingFromBets: 0,
                commissionPayable: parentCommissionFromSub,
                displaySettled: 0,
                displayPending: parentCommissionFromSub,
                advanceAvailableForSettlement: 0,
            });
        }

        commissions.sort((a, b) => b.totalPending - a.totalPending);

        const totals = commissions.reduce(
            (acc, row) => {
                acc.totalCommission += row.totalCommission;
                acc.totalPaid += row.displaySettled ?? round2((row.advanceRecovered ?? 0) + (row.totalPaid ?? 0));
                acc.totalPending += row.displayPending ?? round2((row.recoveryPendingFromBets ?? 0) + (row.totalPending ?? 0));
                acc.advanceCommissionPaid += row.advanceCommissionPaid;
                acc.advanceOutstanding += row.advanceOutstanding;
                return acc;
            },
            {
                totalCommission: 0,
                totalPaid: 0,
                totalPending: 0,
                advanceCommissionPaid: 0,
                advanceOutstanding: 0,
            }
        );

        return res.status(200).json({
            success: true,
            data: {
                commissions,
                summary: {
                    totalCommission: round2(totals.totalCommission),
                    totalPaid: round2(totals.totalPaid),
                    totalPending: round2(totals.totalPending),
                    totalAdvanceCommissionPaid: round2(totals.advanceCommissionPaid),
                    totalAdvanceOutstanding: round2(totals.advanceOutstanding),
                },
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch super bookie commissions',
        });
    }
};

/**
 * Parent bookie: pay super bookie commission
 * POST /api/v1/daily-commission/super-bookie/:superBookieId/pay
 */
export const recordSuperBookieCommissionPayment = async (req, res) => {
    try {
        if (req.admin?.role !== 'bookie') {
            return res.status(403).json({ success: false, message: 'Bookie access required' });
        }

        const { superBookieId } = req.params;
        const { paidAmount, notes, settlementSource } = req.body;
        const payFromAdvance = settlementSource === 'paid_with_advance';
        const paymentToApply = Number(paidAmount);
        if (!Number.isFinite(paymentToApply) || paymentToApply <= 0) {
            return res.status(400).json({
                success: false,
                message: 'paidAmount must be a valid number greater than 0',
            });
        }

        const superBookie = await Admin.findOne({
            _id: superBookieId,
            role: 'super_bookie',
            parentBookieId: req.admin._id,
        }).select('_id username commissionPercentage role parentBookieId');
        if (!superBookie) {
            return res.status(404).json({ success: false, message: 'Super bookie not found' });
        }

        const summary = await getCommissionSummaryForAccount(superBookie);
        if (Number(summary.recoveryPendingFromBets || 0) > 0) {
            return res.status(400).json({
                success: false,
                message: `Settle bet commission first (₹${summary.recoveryPendingFromBets} from player bets can be applied to advance recovery).`,
            });
        }
        if (summary.totalPending <= 0) {
            return res.status(400).json({
                success: false,
                message: 'No pending commission for this super bookie',
            });
        }

        const appliedPayment = round2(Math.min(paymentToApply, summary.totalPending));

        let transferResult;
        try {
            if (payFromAdvance) {
                const advanceAvailable = await getAdvanceAvailableForSettlement(superBookie);
                if (advanceAvailable <= 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'No advance balance available to settle with "paid with advance"',
                    });
                }
                if (appliedPayment > advanceAvailable) {
                    return res.status(400).json({
                        success: false,
                        message: `Paid with advance cannot exceed available advance (₹${advanceAvailable})`,
                    });
                }
                transferResult = await recordCommissionSettlementPaidWithAdvance({
                    parentBookieId: req.admin._id,
                    superBookieId: superBookie._id,
                    amount: appliedPayment,
                    notes: typeof notes === 'string' ? notes.trim() : 'Commission settlement',
                    createdById: req.admin._id,
                });
            } else {
                const cashNotes =
                    typeof notes === 'string' && notes.trim()
                        ? notes.trim()
                        : 'Commission settlement';
                transferResult = await recordCommissionSettlementPaidWithOther({
                    parentBookieId: req.admin._id,
                    parentUsername: req.admin.username,
                    superBookieId: superBookie._id,
                    superBookieUsername: superBookie.username,
                    amount: appliedPayment,
                    notes: cashNotes,
                    createdById: req.admin._id,
                });
            }
        } catch (error) {
            if (error instanceof InsufficientBookieBalanceError || error?.code === 'INSUFFICIENT_BOOKIE_BALANCE') {
                return res.status(400).json({
                    success: false,
                    message: payFromAdvance
                        ? 'Insufficient advance paid balance to settle with advance'
                        : 'Insufficient child bookie wallet balance (paid with other)',
                });
            }
            throw error;
        }

        return res.status(200).json({
            success: true,
                message: payFromAdvance
                ? 'Commission settled from advance pool'
                : 'Commission settlement recorded',
            data: {
                superBookieId,
                appliedPayment,
                leftoverAmount: round2(Math.max(0, summary.totalPending - appliedPayment)),
                parentBalanceAfter: transferResult?.parentBalanceAfter ?? 0,
                newSuperBookieBalance: transferResult?.superBookieBalanceAfter ?? 0,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to record payment',
        });
    }
};

/**
 * Parent bookie: apply earned bet commission toward advance recovery (wallet: parent → super bookie).
 * POST /api/v1/daily-commission/super-bookie/:superBookieId/settle-bets
 */
export const settleSuperBookieCommissionFromBets = async (req, res) => {
    try {
        if (req.admin?.role !== 'bookie') {
            return res.status(403).json({ success: false, message: 'Bookie access required' });
        }

        const { superBookieId } = req.params;
        const superBookie = await Admin.findOne({
            _id: superBookieId,
            role: 'super_bookie',
            parentBookieId: req.admin._id,
        }).select('_id username commissionPercentage role parentBookieId');
        if (!superBookie) {
            return res.status(404).json({ success: false, message: 'Super bookie not found' });
        }

        const summary = await getCommissionSummaryForAccount(superBookie);
        const pending = round2(Number(summary.recoveryPendingFromBets || 0));
        if (pending <= 0) {
            return res.status(400).json({
                success: false,
                message: 'No bet commission available to settle toward advance recovery',
            });
        }

        const requested = round2(Number(req.body?.paidAmount));
        const appliedPayment = round2(
            Number.isFinite(requested) && requested > 0
                ? Math.min(requested, pending)
                : pending,
        );
        if (appliedPayment <= 0) {
            return res.status(400).json({
                success: false,
                message: 'paidAmount must be a valid number greater than 0',
            });
        }

        let transferResult;
        try {
            transferResult = await transferBetCommissionRecoveryToSuperBookie({
                parentBookieId: req.admin._id,
                parentUsername: req.admin.username,
                superBookieId: superBookie._id,
                superBookieUsername: superBookie.username,
                amount: appliedPayment,
                createdById: req.admin._id,
            });
        } catch (error) {
            if (error instanceof InsufficientBookieBalanceError || error?.code === 'INSUFFICIENT_BOOKIE_BALANCE') {
                return res.status(400).json({
                    success: false,
                    message: 'Insufficient bookie balance to settle commission',
                });
            }
            throw error;
        }

        const updated = await getCommissionSummaryForAccount(superBookie);

        return res.status(200).json({
            success: true,
            message: `₹${appliedPayment} applied toward advance recovery for ${superBookie.username || 'super bookie'}`,
            data: {
                superBookieId,
                appliedRecovery: appliedPayment,
                parentBalanceAfter: transferResult?.parentBalanceAfter ?? 0,
                newSuperBookieBalance: transferResult?.superBookieBalanceAfter ?? 0,
                summary: updated,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to settle bet commission',
        });
    }
};

/**
 * Parent bookie: payment history for one super bookie
 * GET /api/v1/daily-commission/super-bookie/:superBookieId/payments
 */
export const getSuperBookieCommissionPaymentHistory = async (req, res) => {
    try {
        if (req.admin?.role !== 'bookie') {
            return res.status(403).json({ success: false, message: 'Bookie access required' });
        }

        const { superBookieId } = req.params;
        const superBookie = await Admin.findOne({
            _id: superBookieId,
            role: 'super_bookie',
            parentBookieId: req.admin._id,
        });
        if (!superBookie) {
            return res.status(404).json({ success: false, message: 'Super bookie not found' });
        }

        const payments = await CommissionPayment.find({ bookieId: superBookieId })
            .sort({ createdAt: -1 })
            .limit(50)
            .populate('createdBy', 'username')
            .lean();

        return res.status(200).json({
            success: true,
            data: payments.map((payment) => {
                const notes = payment.notes || '';
                const kind = getCommissionPaymentKind(payment);
                const isInitial = /initial balance/i.test(notes);
                let label = 'Advance commission';
                if (kind === 'settlement') {
                    label = isSettlementPaidWithAdvance(payment)
                        ? 'Commission settled (paid with advance)'
                        : /paid with other/i.test(notes)
                          ? 'Commission settled (paid with other)'
                          : 'Commission settled';
                } else if (kind === 'recovery') label = 'Bet commission → advance recovery';
                else if (isInitial) label = 'Initial balance';
                return {
                    _id: payment._id,
                    amount: round2(payment.amount || 0),
                    notes,
                    paymentType: kind,
                    label,
                    createdAt: payment.createdAt,
                    createdBy: payment.createdBy?.username || 'Bookie',
                };
            }),
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch payment history',
        });
    }
};

