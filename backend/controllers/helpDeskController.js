import HelpDesk from '../models/helpDesk/helpDesk.js';
import User from '../models/user/user.js';
import { getBookieUserIds } from '../utils/bookieFilter.js';
import { logActivity, getClientIp } from '../utils/activityLogger.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/help-desk';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    },
});

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
        const { userId, subject, description } = req.body;
        const screenshots = req.files ? req.files.map(file => `/uploads/help-desk/${file.filename}`) : [];

        if (!userId || !subject || !description) {
            return res.status(400).json({
                success: false,
                message: 'userId, subject and description are required',
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
        const { status } = req.query;
        const query = {};
        const bookieUserIds = await getBookieUserIds(req.admin);
        if (bookieUserIds !== null) {
            query.userId = { $in: bookieUserIds };
        }
        if (status) query.status = status;

        const tickets = await HelpDesk.find(query)
            .populate('userId', 'username email')
            .sort({ createdAt: -1 });

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
