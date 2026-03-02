import DailyCommission from '../models/dailyCommission/dailyCommission.js';
import Bet from '../models/bet/bet.js';
import Admin from '../models/admin/admin.js';
import User from '../models/user/user.js';

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
            .select('_id username commissionPercentage')
            .lean();
        
        const results = [];
        
        for (const bookie of bookies) {
            try {
                // Get all users referred by this bookie
                const users = await User.find({ referredBy: bookie._id })
                    .select('_id')
                    .lean();
                
                const userIds = users.map(u => u._id);
                
                if (userIds.length === 0) {
                    // No users, create record with zero values
                    const existing = await DailyCommission.findOne({
                        bookieId: bookie._id,
                        date: startOfDay,
                    });
                    
                    if (!existing) {
                        await DailyCommission.create({
                            bookieId: bookie._id,
                            date: startOfDay,
                            totalRevenue: 0,
                            commissionPercentage: bookie.commissionPercentage || 0,
                            commissionAmount: 0,
                            totalBets: 0,
                            totalPayouts: 0,
                            status: 'processed',
                            processedAt: new Date(),
                        });
                    }
                    continue;
                }
                
                // Calculate total revenue for the day (sum of all bet amounts)
                const [revenueAgg] = await Bet.aggregate([
                    {
                        $match: {
                            userId: { $in: userIds },
                            createdAt: { $gte: startOfDay, $lte: endOfDay },
                            status: { $ne: 'cancelled' },
                        },
                    },
                    {
                        $group: {
                            _id: null,
                            totalRevenue: { $sum: '$amount' },
                            totalBets: { $sum: 1 },
                        },
                    },
                ]);
                
                // Calculate total payouts for the day
                const [payoutAgg] = await Bet.aggregate([
                    {
                        $match: {
                            userId: { $in: userIds },
                            createdAt: { $gte: startOfDay, $lte: endOfDay },
                            status: 'won',
                        },
                    },
                    {
                        $group: {
                            _id: null,
                            totalPayouts: { $sum: '$payout' },
                        },
                    },
                ]);
                
                const totalRevenue = revenueAgg?.totalRevenue || 0;
                const totalBets = revenueAgg?.totalBets || 0;
                const totalPayouts = payoutAgg?.totalPayouts || 0;
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
                    existing.totalRevenue = totalRevenue;
                    existing.commissionPercentage = commissionPercentage;
                    existing.commissionAmount = commissionAmount;
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
 * Get daily commission records for a bookie
 * GET /api/v1/daily-commission?startDate=&endDate=
 */
export const getDailyCommissions = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const bookie = req.admin;
        
        if (!bookie || bookie.role !== 'bookie') {
            return res.status(403).json({
                success: false,
                message: 'Only bookies can view their daily commissions',
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
        if (req.admin?.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Only super admin can view all daily commissions',
            });
        }
        
        const { startDate, endDate, bookieId } = req.query;
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
        
        const commissions = await DailyCommission.find(query)
            .populate('bookieId', 'username phone')
            .sort({ date: -1, bookieId: 1 })
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
