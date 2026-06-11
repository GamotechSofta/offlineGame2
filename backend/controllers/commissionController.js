import CommissionRequest from '../models/commission/commission.js';
import Admin from '../models/admin/admin.js';
import { getEffectiveCommissionPercentage } from '../utils/commissionMetrics.js';
import { logActivity, getClientIp } from '../utils/activityLogger.js';
import { ADMIN_TAB, denyUnlessTabAccess, denyUnlessSuperAdmin } from '../utils/adminTabAccess.js';
import { isBookiePanelRole } from '../utils/adminRoles.js';

const assertPanelAccount = (admin, res) => {
    if (!isBookiePanelRole(admin)) {
        res.status(403).json({
            success: false,
            message: 'Bookie or super bookie access required',
        });
        return false;
    }
    return true;
};

const assertParentBookie = (admin, res) => {
    if (admin?.role !== 'bookie') {
        res.status(403).json({ success: false, message: 'Bookie access required' });
        return false;
    }
    return true;
};

const loadSuperBookieRequestForParent = async (requestId, parentBookieId) => {
    const request = await CommissionRequest.findById(requestId);
    if (!request) return { error: { status: 404, message: 'Commission request not found' } };

    const superBookie = await Admin.findOne({
        _id: request.bookieId,
        role: 'super_bookie',
        parentBookieId,
    });
    if (!superBookie) {
        return { error: { status: 404, message: 'Super bookie commission request not found' } };
    }
    return { request, superBookie };
};

/**
 * Bookie / Super Bookie: Create a commission % change request
 */
export const createCommissionRequest = async (req, res) => {
    try {
        const account = req.admin;
        if (!assertPanelAccount(account, res)) return;

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

        const existingPending = await CommissionRequest.findOne({
            bookieId: account._id,
            status: 'pending',
        });

        if (existingPending) {
            return res.status(400).json({
                success: false,
                message: 'You already have a pending commission request. Please wait for a response.',
            });
        }

        const currentPercentage = await getEffectiveCommissionPercentage(account);

        const request = await CommissionRequest.create({
            bookieId: account._id,
            requestedPercentage,
            currentPercentage,
            bookieMessage: message || '',
            status: 'pending',
        });

        const approverLabel = account.role === 'super_bookie' ? 'parent bookie' : 'admin';

        await logActivity({
            action: 'commission_request_created',
            performedBy: account.username,
            performedByType: account.role,
            targetType: 'commission_request',
            targetId: request._id.toString(),
            details: `${account.role} "${account.username}" requested ${requestedPercentage}% commission`,
            ip: getClientIp(req),
        });

        res.status(201).json({
            success: true,
            message: `Commission request submitted. Awaiting ${approverLabel} approval.`,
            data: request,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Bookie / Super Bookie: Get own commission requests
 */
export const getMyCommissionRequests = async (req, res) => {
    try {
        const account = req.admin;
        if (!assertPanelAccount(account, res)) return;

        const requests = await CommissionRequest.find({ bookieId: account._id })
            .sort({ createdAt: -1 })
            .lean();

        const currentCommission = await getEffectiveCommissionPercentage(account);

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
 * Bookie / Super Bookie: Accept counter offer
 */
export const acceptCounterOffer = async (req, res) => {
    try {
        const account = req.admin;
        if (!assertPanelAccount(account, res)) return;

        const { requestId } = req.params;

        const request = await CommissionRequest.findOne({
            _id: requestId,
            bookieId: account._id,
            status: 'negotiation',
        });

        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Negotiation request not found',
            });
        }

        request.status = 'approved';
        request.processedAt = new Date();
        await request.save();

        await Admin.updateOne(
            { _id: account._id },
            { $set: { commissionPercentage: request.counterOffer } }
        );

        await logActivity({
            action: 'commission_counter_accepted',
            performedBy: account.username,
            performedByType: account.role,
            targetType: 'commission_request',
            targetId: request._id.toString(),
            details: `Accepted counter offer of ${request.counterOffer}%`,
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
 * Bookie / Super Bookie: Reject counter offer
 */
export const rejectCounterOffer = async (req, res) => {
    try {
        const account = req.admin;
        if (!assertPanelAccount(account, res)) return;

        const { requestId } = req.params;

        const request = await CommissionRequest.findOne({
            _id: requestId,
            bookieId: account._id,
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
 * Super Admin: Get bookie commission requests (excludes super bookie requests)
 */
export const getAllCommissionRequests = async (req, res) => {
    try {
        if (denyUnlessTabAccess(res, req.admin, ADMIN_TAB.BOOKIE_COMMISSIONS, 'You do not have access to bookie commissions')) {
            return;
        }

        const { status } = req.query;
        const query = {};
        if (status && ['pending', 'approved', 'rejected', 'negotiation'].includes(status)) {
            query.status = status;
        }

        const bookieIds = await Admin.find({ role: 'bookie' }).distinct('_id');
        query.bookieId = { $in: bookieIds };

        const requests = await CommissionRequest.find(query)
            .populate('bookieId', 'username phone email commissionPercentage role')
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
 * Parent bookie: Get commission requests from their super bookies
 */
export const getSuperBookieCommissionRequests = async (req, res) => {
    try {
        if (!assertParentBookie(req.admin, res)) return;

        const { status } = req.query;
        const superBookieIds = await Admin.find({
            role: 'super_bookie',
            parentBookieId: req.admin._id,
        }).distinct('_id');

        const query = { bookieId: { $in: superBookieIds } };
        if (status && ['pending', 'approved', 'rejected', 'negotiation'].includes(status)) {
            query.status = status;
        }

        const requests = await CommissionRequest.find(query)
            .populate('bookieId', 'username phone email commissionPercentage')
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
 * Super Admin: Approve bookie commission request
 */
export const approveCommissionRequest = async (req, res) => {
    try {
        if (denyUnlessSuperAdmin(res, req.admin)) return;

        const { requestId } = req.params;
        const { message } = req.body;

        const request = await CommissionRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({ success: false, message: 'Commission request not found' });
        }

        const bookie = await Admin.findOne({ _id: request.bookieId, role: 'bookie' });
        if (!bookie) {
            return res.status(400).json({ success: false, message: 'Only bookie requests can be approved here' });
        }

        if (request.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Only pending requests can be approved' });
        }

        request.status = 'approved';
        request.adminResponse = message || 'Approved';
        request.processedBy = req.admin._id;
        request.processedAt = new Date();
        await request.save();

        await Admin.updateOne(
            { _id: request.bookieId },
            { $set: { commissionPercentage: request.requestedPercentage } }
        );

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
 * Parent bookie: Approve super bookie commission request
 */
export const approveSuperBookieCommissionRequest = async (req, res) => {
    try {
        if (!assertParentBookie(req.admin, res)) return;

        const { requestId } = req.params;
        const { message } = req.body;
        const loaded = await loadSuperBookieRequestForParent(requestId, req.admin._id);
        if (loaded.error) {
            return res.status(loaded.error.status).json({ success: false, message: loaded.error.message });
        }
        const { request } = loaded;

        if (request.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Only pending requests can be approved' });
        }

        request.status = 'approved';
        request.adminResponse = message || 'Approved by bookie';
        request.processedBy = req.admin._id;
        request.processedAt = new Date();
        await request.save();

        await Admin.updateOne(
            { _id: request.bookieId },
            { $set: { commissionPercentage: request.requestedPercentage } }
        );

        res.status(200).json({
            success: true,
            message: 'Super bookie commission request approved',
            data: request,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Super Admin: Reject bookie commission request
 */
export const rejectCommissionRequest = async (req, res) => {
    try {
        if (denyUnlessSuperAdmin(res, req.admin)) return;

        const { requestId } = req.params;
        const { message } = req.body;

        const request = await CommissionRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({ success: false, message: 'Commission request not found' });
        }

        const bookie = await Admin.findOne({ _id: request.bookieId, role: 'bookie' });
        if (!bookie) {
            return res.status(400).json({ success: false, message: 'Only bookie requests can be rejected here' });
        }

        if (request.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Only pending requests can be rejected' });
        }

        request.status = 'rejected';
        request.adminResponse = message || 'Rejected';
        request.processedBy = req.admin._id;
        request.processedAt = new Date();
        await request.save();

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
 * Parent bookie: Reject super bookie commission request
 */
export const rejectSuperBookieCommissionRequest = async (req, res) => {
    try {
        if (!assertParentBookie(req.admin, res)) return;

        const { requestId } = req.params;
        const { message } = req.body;
        const loaded = await loadSuperBookieRequestForParent(requestId, req.admin._id);
        if (loaded.error) {
            return res.status(loaded.error.status).json({ success: false, message: loaded.error.message });
        }
        const { request } = loaded;

        if (request.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Only pending requests can be rejected' });
        }

        request.status = 'rejected';
        request.adminResponse = message || 'Rejected';
        request.processedBy = req.admin._id;
        request.processedAt = new Date();
        await request.save();

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
 * Super Admin: Send counter offer to bookie
 */
export const negotiateCommissionRequest = async (req, res) => {
    try {
        if (denyUnlessSuperAdmin(res, req.admin)) return;

        const { requestId } = req.params;
        const { counterOffer, message } = req.body;

        if (counterOffer === undefined || counterOffer === null) {
            return res.status(400).json({ success: false, message: 'Counter offer percentage is required' });
        }
        if (counterOffer < 0 || counterOffer > 100) {
            return res.status(400).json({ success: false, message: 'Counter offer must be between 0 and 100' });
        }

        const request = await CommissionRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({ success: false, message: 'Commission request not found' });
        }

        const bookie = await Admin.findOne({ _id: request.bookieId, role: 'bookie' });
        if (!bookie) {
            return res.status(400).json({ success: false, message: 'Only bookie requests can be negotiated here' });
        }

        if (request.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Only pending requests can be negotiated' });
        }

        request.status = 'negotiation';
        request.counterOffer = counterOffer;
        request.adminResponse = message || `Counter offer: ${counterOffer}%`;
        request.processedBy = req.admin._id;
        await request.save();

        res.status(200).json({
            success: true,
            message: 'Counter offer sent to bookie',
            data: request,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Parent bookie: Send counter offer to super bookie
 */
export const negotiateSuperBookieCommissionRequest = async (req, res) => {
    try {
        if (!assertParentBookie(req.admin, res)) return;

        const { requestId } = req.params;
        const { counterOffer, message } = req.body;

        if (counterOffer === undefined || counterOffer === null) {
            return res.status(400).json({ success: false, message: 'Counter offer percentage is required' });
        }
        if (counterOffer < 0 || counterOffer > 100) {
            return res.status(400).json({ success: false, message: 'Counter offer must be between 0 and 100' });
        }

        const loaded = await loadSuperBookieRequestForParent(requestId, req.admin._id);
        if (loaded.error) {
            return res.status(loaded.error.status).json({ success: false, message: loaded.error.message });
        }
        const { request } = loaded;

        if (request.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Only pending requests can be negotiated' });
        }

        request.status = 'negotiation';
        request.counterOffer = counterOffer;
        request.adminResponse = message || `Counter offer: ${counterOffer}%`;
        request.processedBy = req.admin._id;
        await request.save();

        res.status(200).json({
            success: true,
            message: 'Counter offer sent to super bookie',
            data: request,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
