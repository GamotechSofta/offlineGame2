import DailyCommission from '../models/dailyCommission/dailyCommission.js';
import Admin from '../models/admin/admin.js';
import CommissionPayment from '../models/commission/commissionPayment.js';
import { ADMIN_TAB, denyUnlessTabAccess, denyUnlessSuperAdmin } from '../utils/adminTabAccess.js';
import { isBookiePanelRole } from '../utils/adminRoles.js';
import {
    aggregatePlayerBetMetrics,
    getCommissionDashboardForAccount,
    getCommissionSummaryForAccount,
    round2,
} from '../utils/commissionMetrics.js';

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

        const bookies = await Admin.find({ role: 'bookie' })
            .select('_id username phone commissionPercentage role')
            .lean();

        const paymentAgg = await CommissionPayment.aggregate([
            { $group: { _id: '$bookieId', totalPaid: { $sum: '$amount' }, lastPaidAt: { $max: '$createdAt' } } },
        ]);
        const paidMap = {};
        for (const item of paymentAgg) {
            paidMap[String(item._id)] = {
                totalPaid: round2(item.totalPaid || 0),
                lastPaidAt: item.lastPaidAt || null,
            };
        }

        const normalized = [];
        for (const bookie of bookies) {
            const summary = await getCommissionSummaryForAccount(bookie);
            normalized.push({
                bookieId: bookie._id,
                username: bookie.username || 'Unknown',
                phone: bookie.phone || '',
                commissionPercentage: summary.commissionPercentage,
                playerCount: summary.playerCount,
                betCount: summary.betCount,
                totalBetAmount: summary.totalBetAmount,
                totalCommission: summary.totalCommission,
                totalPaid: summary.totalPaid,
                totalPending: summary.totalPending,
                paymentStatus: summary.paymentStatus,
                lastPaidAt: paidMap[String(bookie._id)]?.lastPaidAt || null,
            });
        }

        normalized.sort((a, b) => {
            if (b.totalPending !== a.totalPending) return b.totalPending - a.totalPending;
            return String(a.username).localeCompare(String(b.username));
        });

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

        const bookie = await Admin.findOne({ _id: bookieId, role: 'bookie' })
            .select('_id commissionPercentage role')
            .lean();
        if (!bookie) {
            return res.status(404).json({
                success: false,
                message: 'Bookie not found',
            });
        }

        const summary = await getCommissionSummaryForAccount(bookie);
        const totalPending = summary.totalPending;

        if (totalPending <= 0) {
            return res.status(400).json({
                success: false,
                message: 'No pending commission found for this bookie',
            });
        }

        const appliedPayment = round2(Math.min(paymentToApply, totalPending));
        const remaining = round2(Math.max(0, totalPending - appliedPayment));

        await CommissionPayment.create({
            bookieId: bookie._id,
            amount: appliedPayment,
            notes: typeof notes === 'string' ? notes.trim() : '',
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

        return res.status(200).json({
            success: true,
            data: payments.map((payment) => ({
                _id: payment._id,
                amount: round2(payment.amount || 0),
                notes: payment.notes || '',
                createdAt: payment.createdAt,
                createdBy:
                    payment.createdBy?.role === 'bookie'
                        ? payment.createdBy?.username || 'Bookie'
                        : payment.createdBy?.username || 'Admin',
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
            .select('_id username phone commissionPercentage role parentBookieId')
            .lean();

        const paymentAgg = await CommissionPayment.aggregate([
            { $match: { bookieId: { $in: superBookies.map((sb) => sb._id) } } },
            { $group: { _id: '$bookieId', totalPaid: { $sum: '$amount' }, lastPaidAt: { $max: '$createdAt' } } },
        ]);
        const paidMap = Object.fromEntries(
            paymentAgg.map((row) => [
                String(row._id),
                { totalPaid: round2(row.totalPaid || 0), lastPaidAt: row.lastPaidAt || null },
            ])
        );

        const commissions = [];
        for (const sb of superBookies) {
            const summary = await getCommissionSummaryForAccount(sb);
            commissions.push({
                superBookieId: sb._id,
                username: sb.username || 'Unknown',
                phone: sb.phone || '',
                commissionPercentage: summary.commissionPercentage,
                playerCount: summary.playerCount,
                betCount: summary.betCount,
                totalBetAmount: summary.totalBetAmount,
                totalCommission: summary.totalCommission,
                totalPaid: summary.totalPaid,
                totalPending: summary.totalPending,
                paymentStatus: summary.paymentStatus,
                lastPaidAt: paidMap[String(sb._id)]?.lastPaidAt || null,
            });
        }

        commissions.sort((a, b) => b.totalPending - a.totalPending);

        const totals = commissions.reduce(
            (acc, row) => {
                acc.totalCommission += row.totalCommission;
                acc.totalPaid += row.totalPaid;
                acc.totalPending += row.totalPending;
                return acc;
            },
            { totalCommission: 0, totalPaid: 0, totalPending: 0 }
        );

        return res.status(200).json({
            success: true,
            data: {
                commissions,
                summary: {
                    totalCommission: round2(totals.totalCommission),
                    totalPaid: round2(totals.totalPaid),
                    totalPending: round2(totals.totalPending),
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
        const { paidAmount, notes } = req.body;
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
        }).select('_id commissionPercentage role parentBookieId');
        if (!superBookie) {
            return res.status(404).json({ success: false, message: 'Super bookie not found' });
        }

        const summary = await getCommissionSummaryForAccount(superBookie);
        if (summary.totalPending <= 0) {
            return res.status(400).json({
                success: false,
                message: 'No pending commission for this super bookie',
            });
        }

        const appliedPayment = round2(Math.min(paymentToApply, summary.totalPending));

        await CommissionPayment.create({
            bookieId: superBookie._id,
            amount: appliedPayment,
            notes: typeof notes === 'string' ? notes.trim() : '',
            createdBy: req.admin._id,
        });

        return res.status(200).json({
            success: true,
            message: 'Commission payment recorded',
            data: {
                superBookieId,
                appliedPayment,
                leftoverAmount: round2(Math.max(0, summary.totalPending - appliedPayment)),
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
            data: payments.map((payment) => ({
                _id: payment._id,
                amount: round2(payment.amount || 0),
                notes: payment.notes || '',
                createdAt: payment.createdAt,
                createdBy: payment.createdBy?.username || 'Bookie',
            })),
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch payment history',
        });
    }
};
