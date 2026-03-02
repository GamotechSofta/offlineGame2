import HelpDesk from '../models/helpDesk/helpDesk.js';
import User from '../models/user/user.js';
import { getBookieUserIds } from '../utils/bookieFilter.js';
import { logActivity, getClientIp } from '../utils/activityLogger.js';
import multer from 'multer';
import path from 'path';
import { uploadToCloudinary } from '../config/cloudinary.js';

// Configure multer with memory storage for Cloudinary uploads
const storage = multer.memoryStorage();

export const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed'));
    },
}).array('screenshots', 5);

export const createTicket = async (req, res) => {
    try {
        const userId = req.userId;
        const { subject, description } = req.body;

        // Upload screenshots to Cloudinary
        let screenshots = [];
        if (req.files && req.files.length > 0) {
            try {
                const uploadPromises = req.files.map(file =>
                    uploadToCloudinary(file.buffer, 'help-desk')
                );
                const results = await Promise.all(uploadPromises);
                screenshots = results.map(result => result.secure_url);
            } catch (uploadError) {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to upload screenshots. Please try again.',
                });
            }
        }

        if (!userId || !subject || !description) {
            return res.status(400).json({
                success: false,
                message: 'Subject and description are required',
            });
        }

        const ticket = new HelpDesk({
            userId,
            subject,
            description,
            screenshots,
        });
        await ticket.save();

        const user = await User.findById(userId).select('username').lean();
        await logActivity({
            action: 'help_ticket_create',
            performedBy: user?.username || userId,
            performedByType: 'user',
            targetType: 'help_ticket',
            targetId: ticket._id.toString(),
            details: `Player "${user?.username || userId}" created ticket: ${subject}`,
            meta: { subject },
            ip: getClientIp(req),
        });

        res.status(201).json({ success: true, data: ticket });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getTickets = async (req, res) => {
    try {
        const { status, userSource, bookieId } = req.query;
        const query = {};
        const bookieUserIds = await getBookieUserIds(req.admin);
        if (bookieUserIds !== null) {
            query.userId = { $in: bookieUserIds };
        }
        if (status) query.status = status;

        // Filter by specific bookie (super_admin only): tickets from users whose referredBy = bookieId
        if (bookieId && req.admin?.role === 'super_admin') {
            const userIdsForBookie = await User.find({ referredBy: bookieId }).select('_id').lean();
            const ids = userIdsForBookie.map((u) => u._id);
            if (query.userId && query.userId.$in) {
                query.userId = { $in: query.userId.$in.filter((id) => ids.some((x) => x.toString() === id.toString())) };
            } else {
                query.userId = { $in: ids };
            }
        }

        // Filter by user source: bookie user vs admin user (super_admin)
        if (userSource === 'bookie' || userSource === 'super_admin') {
            const sourceUserIds = await User.find({ source: userSource }).select('_id').lean();
            const ids = sourceUserIds.map((u) => u._id);
            if (query.userId && query.userId.$in) {
                query.userId = { $in: query.userId.$in.filter((id) => ids.some((x) => x.toString() === id.toString())) };
            } else {
                query.userId = { $in: ids };
            }
        }

        const tickets = await HelpDesk.find(query)
            .populate({ path: 'userId', select: 'username email source referredBy', populate: { path: 'referredBy', select: 'username' } })
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, data: tickets });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/** Get tickets for the authenticated user. Requires verifyUser (JWT). */
export const getMyTickets = async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        const tickets = await HelpDesk.find({ userId })
            .sort({ createdAt: -1 })
            .lean();
        res.status(200).json({ success: true, data: tickets });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateTicketStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, adminResponse } = req.body;

        const ticket = await HelpDesk.findById(id);
        if (!ticket) {
            return res.status(404).json({ success: false, message: 'Ticket not found' });
        }

        ticket.status = status;
        if (adminResponse) ticket.adminResponse = adminResponse;
        await ticket.save();

        const performer = req.admin?.username || 'Admin';
        await logActivity({
            action: 'help_ticket_update',
            performedBy: performer,
            performedByType: req.admin?.role || 'admin',
            targetType: 'help_ticket',
            targetId: id,
            details: `Ticket "${ticket.subject}" status updated to ${status} by ${performer}`,
            meta: { status, adminResponse: adminResponse ? true : false },
            ip: getClientIp(req),
        });

        res.status(200).json({ success: true, data: ticket });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
