import CommissionRequest from '../models/commission/commission.js';
import Admin from '../models/admin/admin.js';
import { logActivity, getClientIp } from '../utils/activityLogger.js';

/**
 * Bookie: Create a new commission request
 */
export const createCommissionRequest = async (req, res) => {
    try {
        const bookie = req.admin;
        if (!bookie || bookie.role !== 'bookie') {
            return res.status(403).json({
                success: false,
                message: 'Only bookies can request commission',
            });
        }

        const { requestedPercentage, message } = req.body;

        if (requestedPercentage === undefined || requestedPercentage === null) {
            return res.status(400).json({
                success: false,
                message: 'Requested percentage is required',
            });
        }

        if (requestedPercentage < 0 || requestedPercentage > 100) {
            return res.status(400).json({
                success: false,
                message: 'Percentage must be between 0 and 100',
            });
        }

        // Check if there's already a pending request
        const existingPending = await CommissionRequest.findOne({
            bookieId: bookie._id,
            status: 'pending',
        });

        if (existingPending) {
            return res.status(400).json({
                success: false,
                message: 'You already have a pending commission request. Please wait for admin response.',
            });
        }

        // Get current commission percentage from bookie's profile
        const currentPercentage = bookie.commissionPercentage || 0;

        const request = await CommissionRequest.create({
            bookieId: bookie._id,
            requestedPercentage,
            currentPercentage,
            bookieMessage: message || '',
            status: 'pending',
        });

        await logActivity({
            action: 'commission_request_created',
            performedBy: bookie.username,
            performedByType: 'bookie',
            targetType: 'commission_request',
            targetId: request._id.toString(),
            details: `Bookie "${bookie.username}" requested ${requestedPercentage}% commission`,
            ip: getClientIp(req),
        });

        res.status(201).json({
            success: true,
            message: 'Commission request submitted successfully',
            data: request,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Bookie: Get their commission requests
 */
export const getMyCommissionRequests = async (req, res) => {
    try {
        const bookie = req.admin;
        if (!bookie || bookie.role !== 'bookie') {
            return res.status(403).json({
                success: false,
                message: 'Bookie access required',
            });
        }

        const requests = await CommissionRequest.find({ bookieId: bookie._id })
            .sort({ createdAt: -1 })
            .lean();

        // Get current commission from bookie profile
        const currentCommission = bookie.commissionPercentage || 0;

        res.status(200).json({
            success: true,
            data: {
                currentCommission,
                requests,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Bookie: Accept counter offer from admin
 */
export const acceptCounterOffer = async (req, res) => {
    try {
        const bookie = req.admin;
        if (!bookie || bookie.role !== 'bookie') {
            return res.status(403).json({
                success: false,
                message: 'Bookie access required',
            });
        }

        const { requestId } = req.params;

        const request = await CommissionRequest.findOne({
            _id: requestId,
            bookieId: bookie._id,
            status: 'negotiation',
        });

        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Negotiation request not found',
            });
        }

        // Update request status
        request.status = 'approved';
        request.processedAt = new Date();
        await request.save();

        // Update bookie's commission percentage
        await Admin.updateOne(
            { _id: bookie._id },
            { $set: { commissionPercentage: request.counterOffer } }
        );

        await logActivity({
            action: 'commission_counter_accepted',
            performedBy: bookie.username,
            performedByType: 'bookie',
            targetType: 'commission_request',
            targetId: request._id.toString(),
            details: `Bookie "${bookie.username}" accepted counter offer of ${request.counterOffer}%`,
            ip: getClientIp(req),
        });

        res.status(200).json({
            success: true,
            message: `Counter offer accepted. Your commission is now ${request.counterOffer}%`,
            data: request,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Bookie: Reject counter offer
 */
export const rejectCounterOffer = async (req, res) => {
    try {
        const bookie = req.admin;
        if (!bookie || bookie.role !== 'bookie') {
            return res.status(403).json({
                success: false,
                message: 'Bookie access required',
            });
        }

        const { requestId } = req.params;

        const request = await CommissionRequest.findOne({
            _id: requestId,
            bookieId: bookie._id,
            status: 'negotiation',
        });

        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Negotiation request not found',
            });
        }

        request.status = 'rejected';
        request.processedAt = new Date();
        await request.save();

        await logActivity({
            action: 'commission_counter_rejected',
            performedBy: bookie.username,
            performedByType: 'bookie',
            targetType: 'commission_request',
            targetId: request._id.toString(),
            details: `Bookie "${bookie.username}" rejected counter offer of ${request.counterOffer}%`,
            ip: getClientIp(req),
        });

        res.status(200).json({
            success: true,
            message: 'Counter offer rejected',
            data: request,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Super Admin: Get all commission requests
 */
export const getAllCommissionRequests = async (req, res) => {
    try {
        if (req.admin?.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Super Admin access required',
            });
        }

        const { status } = req.query;
        const query = {};
        if (status && ['pending', 'approved', 'rejected', 'negotiation'].includes(status)) {
            query.status = status;
        }

        const requests = await CommissionRequest.find(query)
            .populate('bookieId', 'username phone email commissionPercentage')
            .populate('processedBy', 'username')
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json({
            success: true,
            data: requests,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Super Admin: Approve commission request
 */
export const approveCommissionRequest = async (req, res) => {
    try {
        if (req.admin?.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Super Admin access required',
            });
        }

        const { requestId } = req.params;
        const { message } = req.body;

        const request = await CommissionRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Commission request not found',
            });
        }

        if (request.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Only pending requests can be approved',
            });
        }

        // Update request
        request.status = 'approved';
        request.adminResponse = message || 'Approved';
        request.processedBy = req.admin._id;
        request.processedAt = new Date();
        await request.save();

        // Update bookie's commission percentage
        await Admin.updateOne(
            { _id: request.bookieId },
            { $set: { commissionPercentage: request.requestedPercentage } }
        );

        await logActivity({
            action: 'commission_request_approved',
            performedBy: req.admin.username,
            performedByType: 'admin',
            targetType: 'commission_request',
            targetId: request._id.toString(),
            details: `Commission request approved: ${request.requestedPercentage}%`,
            ip: getClientIp(req),
        });

        res.status(200).json({
            success: true,
            message: 'Commission request approved',
            data: request,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Super Admin: Reject commission request
 */
export const rejectCommissionRequest = async (req, res) => {
    try {
        if (req.admin?.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Super Admin access required',
            });
        }

        const { requestId } = req.params;
        const { message } = req.body;

        const request = await CommissionRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Commission request not found',
            });
        }

        if (request.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Only pending requests can be rejected',
            });
        }

        request.status = 'rejected';
        request.adminResponse = message || 'Rejected';
        request.processedBy = req.admin._id;
        request.processedAt = new Date();
        await request.save();

        await logActivity({
            action: 'commission_request_rejected',
            performedBy: req.admin.username,
            performedByType: 'admin',
            targetType: 'commission_request',
            targetId: request._id.toString(),
            details: `Commission request rejected`,
            ip: getClientIp(req),
        });

        res.status(200).json({
            success: true,
            message: 'Commission request rejected',
            data: request,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Super Admin: Send counter offer (negotiation)
 */
export const negotiateCommissionRequest = async (req, res) => {
    try {
        if (req.admin?.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Super Admin access required',
            });
        }

        const { requestId } = req.params;
        const { counterOffer, message } = req.body;

        if (counterOffer === undefined || counterOffer === null) {
            return res.status(400).json({
                success: false,
                message: 'Counter offer percentage is required',
            });
        }

        if (counterOffer < 0 || counterOffer > 100) {
            return res.status(400).json({
                success: false,
                message: 'Counter offer must be between 0 and 100',
            });
        }

        const request = await CommissionRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Commission request not found',
            });
        }

        if (request.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Only pending requests can be negotiated',
            });
        }

        request.status = 'negotiation';
        request.counterOffer = counterOffer;
        request.adminResponse = message || `Counter offer: ${counterOffer}%`;
        request.processedBy = req.admin._id;
        await request.save();

        await logActivity({
            action: 'commission_request_negotiation',
            performedBy: req.admin.username,
            performedByType: 'admin',
            targetType: 'commission_request',
            targetId: request._id.toString(),
            details: `Counter offer sent: ${counterOffer}%`,
            ip: getClientIp(req),
        });

        res.status(200).json({
            success: true,
            message: 'Counter offer sent to bookie',
            data: request,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
