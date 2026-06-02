import Admin from '../models/admin/admin.js';
import { logActivity, getClientIp } from '../utils/activityLogger.js';
import { signAdminToken } from '../utils/adminJwt.js';

const PHONE_REGEX = /^[6-9]\d{9}$/;

const findSuperBookieByLogin = async (phone, username) => {
    const normalizedPhone = phone ? String(phone).replace(/\D/g, '').slice(0, 10) : '';
    let account = null;

    if (normalizedPhone.length >= 10) {
        account = await Admin.findOne({ phone: normalizedPhone, role: 'super_bookie' });
        if (!account) {
            const all = await Admin.find({ role: 'super_bookie' }).select('phone username').lean();
            const matched = all.find((b) => {
                if (!b.phone) return false;
                return String(b.phone).replace(/\D/g, '').slice(0, 10) === normalizedPhone;
            });
            if (matched) account = await Admin.findOne({ _id: matched._id, role: 'super_bookie' });
        }
    }
    if (!account && username) {
        account = await Admin.findOne({ username: String(username).trim(), role: 'super_bookie' });
    }
    return account;
};

export const superBookieLogin = async (req, res) => {
    try {
        const { username, phone, password } = req.body;
        const loginIdentifier = phone || username;
        if (!loginIdentifier || !password) {
            return res.status(400).json({
                success: false,
                message: 'Phone number (or username) and password are required',
            });
        }

        const superBookie = await findSuperBookieByLogin(phone, username);
        if (!superBookie) {
            const normalizedPhone = phone ? String(phone).replace(/\D/g, '').slice(0, 10) : '';
            let topBookie = null;
            if (normalizedPhone.length >= 10) {
                topBookie = await Admin.findOne({ phone: normalizedPhone, role: 'bookie' });
                if (!topBookie) {
                    const all = await Admin.find({ role: 'bookie' }).select('phone username').lean();
                    const matched = all.find((b) => {
                        if (!b.phone) return false;
                        return String(b.phone).replace(/\D/g, '').slice(0, 10) === normalizedPhone;
                    });
                    if (matched) {
                        topBookie = await Admin.findOne({ _id: matched._id, role: 'bookie' });
                    }
                }
            }
            if (!topBookie && username) {
                topBookie = await Admin.findOne({
                    username: String(username).trim(),
                    role: 'bookie',
                });
            }
            if (topBookie && (await topBookie.comparePassword(password))) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid credentials. Check phone and password.',
                });
            }

            const count = await Admin.countDocuments({ role: 'super_bookie' });
            return res.status(401).json({
                success: false,
                message: count === 0
                    ? 'No bookie accounts found. Contact your SuperBookie to create your account.'
                    : 'Invalid credentials. Check phone and password.',
            });
        }

        if (superBookie.status === 'inactive') {
            return res.status(403).json({
                success: false,
                message: 'Your account has been suspended. Contact your bookie.',
                code: 'ACCOUNT_SUSPENDED',
            });
        }

        const isPasswordValid = await superBookie.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        await logActivity({
            action: 'super_bookie_login',
            performedBy: superBookie.username,
            performedByType: 'super_bookie',
            targetType: 'admin',
            targetId: superBookie._id.toString(),
            details: `Super bookie "${superBookie.username}" logged in`,
            ip: getClientIp(req),
        });

        const token = signAdminToken(superBookie);
        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                id: superBookie._id,
                username: superBookie.username,
                role: superBookie.role,
                email: superBookie.email,
                phone: superBookie.phone,
                balance: superBookie.balance || 0,
                canManagePayments: superBookie.canManagePayments || false,
                parentBookieId: superBookie.parentBookieId,
                token,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const superBookieHeartbeat = async (req, res) => {
    try {
        const sb = req.admin;
        if (!sb || sb.role !== 'super_bookie') {
            return res.status(403).json({ success: false, message: 'Super bookie access required', code: 'ACCOUNT_SUSPENDED' });
        }
        if (sb.status === 'inactive') {
            return res.status(403).json({
                success: false,
                message: 'Your account has been suspended.',
                code: 'ACCOUNT_SUSPENDED',
            });
        }
        res.status(200).json({ success: true, message: 'OK' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getSuperBookieProfile = async (req, res) => {
    try {
        const sb = await Admin.findOne({ _id: req.admin._id, role: 'super_bookie' })
            .select('-password')
            .lean();
        if (!sb) {
            return res.status(403).json({ success: false, message: 'Super bookie access required' });
        }
        res.status(200).json({
            success: true,
            data: {
                id: sb._id,
                username: sb.username,
                email: sb.email,
                phone: sb.phone,
                role: sb.role,
                balance: sb.balance || 0,
                canManagePayments: sb.canManagePayments || false,
                parentBookieId: sb.parentBookieId,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getSuperBookieReferralLink = async (req, res) => {
    try {
        const sb = await Admin.findOne({ _id: req.admin._id, role: 'super_bookie' });
        if (!sb) {
            return res.status(403).json({ success: false, message: 'Super bookie access required' });
        }
        res.status(200).json({
            success: true,
            data: { bookieId: sb._id, username: sb.username },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export { PHONE_REGEX };
