import Admin from '../models/admin/admin.js';
import { filterAllowedTabs } from '../config/specificAdminTabs.js';
import { logActivity, getClientIp } from '../utils/activityLogger.js';

function mapSpecificAdminRow(doc) {
    const row = doc.toObject ? doc.toObject() : doc;
    return {
        id: row._id?.toString?.() ?? row._id,
        username: row.username,
        role: row.role,
        status: row.status,
        allowedTabs: row.allowedTabs || [],
        hasSecretDeclarePassword: !!(row.secretDeclarePassword && String(row.secretDeclarePassword).length > 0),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

/**
 * GET /admin/specific-admins
 */
export const listSpecificAdmins = async (req, res) => {
    try {
        const admins = await Admin.find({ role: 'specific_admin' })
            .select('+secretDeclarePassword')
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json({
            success: true,
            data: admins.map((a) => mapSpecificAdminRow(a)),
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST /admin/specific-admins
 * Body: { username, password, allowedTabs, secretDeclarePassword }
 */
export const createSpecificAdmin = async (req, res) => {
    try {
        const username = (req.body.username ?? '').toString().trim();
        const password = (req.body.password ?? '').toString();
        const secretDeclarePassword = (req.body.secretDeclarePassword ?? '').toString().trim();
        const allowedTabs = filterAllowedTabs(req.body.allowedTabs);

        if (!username) {
            return res.status(400).json({ success: false, message: 'Username is required' });
        }
        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }
        if (secretDeclarePassword.length < 4) {
            return res.status(400).json({
                success: false,
                message: 'Secret declare password is required (min 4 characters)',
            });
        }
        if (allowedTabs.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Select at least one allowed tab',
            });
        }

        const admin = new Admin({
            username,
            password,
            role: 'specific_admin',
            allowedTabs,
            secretDeclarePassword,
        });
        await admin.save();

        await logActivity({
            action: 'create_specific_admin',
            performedBy: req.admin.username,
            performedByType: 'super_admin',
            targetType: 'admin',
            targetId: admin._id.toString(),
            details: `Super Bookie "${username}" created with ${allowedTabs.length} tab(s)`,
            ip: getClientIp(req),
        });

        res.status(201).json({
            success: true,
            message: 'Super Bookie created successfully',
            data: {
                ...mapSpecificAdminRow(await Admin.findById(admin._id).select('+secretDeclarePassword').lean()),
                secretDeclarePasswordPlain: secretDeclarePassword,
            },
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: 'Username already exists' });
        }
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * PUT /admin/specific-admins/:id
 */
export const updateSpecificAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const admin = await Admin.findOne({ _id: id, role: 'specific_admin' }).select('+secretDeclarePassword');
        if (!admin) {
            return res.status(404).json({ success: false, message: 'Super Bookie not found' });
        }

        if (req.body.allowedTabs !== undefined) {
            const filtered = filterAllowedTabs(req.body.allowedTabs);
            if (filtered.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Select at least one allowed tab',
                });
            }
            admin.allowedTabs = filtered;
        }

        if (req.body.password !== undefined && req.body.password !== null && String(req.body.password).length > 0) {
            const pwd = String(req.body.password);
            if (pwd.length < 6) {
                return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
            }
            admin.password = pwd;
        }

        if (req.body.secretDeclarePassword !== undefined) {
            const raw = req.body.secretDeclarePassword;
            if (raw === null || String(raw).trim() === '') {
                admin.secretDeclarePassword = null;
            } else {
                const val = String(raw).trim();
                if (val.length < 4) {
                    return res.status(400).json({
                        success: false,
                        message: 'Secret declare password must be at least 4 characters',
                    });
                }
                admin.secretDeclarePassword = val;
            }
        }

        await admin.save();

        await logActivity({
            action: 'update_specific_admin',
            performedBy: req.admin.username,
            performedByType: 'super_admin',
            targetType: 'admin',
            targetId: admin._id.toString(),
            details: `Super Bookie "${admin.username}" updated`,
            ip: getClientIp(req),
        });

        res.status(200).json({
            success: true,
            message: 'Super Bookie updated successfully',
            data: mapSpecificAdminRow(await Admin.findById(admin._id).select('+secretDeclarePassword').lean()),
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * DELETE /admin/specific-admins/:id
 */
export const deleteSpecificAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const admin = await Admin.findOne({ _id: id, role: 'specific_admin' });
        if (!admin) {
            return res.status(404).json({ success: false, message: 'Super Bookie not found' });
        }

        const username = admin.username;
        await Admin.findByIdAndDelete(id);

        await logActivity({
            action: 'delete_specific_admin',
            performedBy: req.admin.username,
            performedByType: 'super_admin',
            targetType: 'admin',
            targetId: id,
            details: `Super Bookie "${username}" deleted`,
            ip: getClientIp(req),
        });

        res.status(200).json({
            success: true,
            message: 'Super Bookie deleted successfully',
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
