import Admin from '../models/admin/admin.js';
import { logActivity, getClientIp } from '../utils/activityLogger.js';

/**
 * Admin login
 * Body: { username, password }
 */
export const adminLogin = async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required',
            });
        }

        const admin = await Admin.findOne({ username });
        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        const isPasswordValid = await admin.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }

        await logActivity({
            action: 'admin_login',
            performedBy: admin.username,
            performedByType: admin.role === 'super_admin' ? 'super_admin' : 'bookie',
            targetType: 'admin',
            targetId: admin._id.toString(),
            details: `${admin.username} logged in (${admin.role === 'super_admin' ? 'Admin Panel' : 'Bookie Panel'})`,
            ip: getClientIp(req),
        });

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                id: admin._id,
                username: admin.username,
                role: admin.role,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Create admin (for initial setup)
 * Body: { username, password }
 */
export const createAdmin = async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required',
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters',
            });
        }

        const admin = new Admin({ username, password });
        await admin.save();

        await logActivity({
            action: 'create_admin',
            performedBy: 'System',
            performedByType: 'system',
            targetType: 'admin',
            targetId: admin._id.toString(),
            details: `Super admin "${username}" created`,
            ip: getClientIp(req),
        });

        res.status(201).json({
            success: true,
            message: 'Admin created successfully',
            data: {
                id: admin._id,
                username: admin.username,
                role: admin.role,
            },
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Admin with this username already exists',
            });
        }
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Create bookie (Admin collection with role 'bookie')
 * Only super_admin can create. Bookie can then login via /bookie/login
 * Body: { username, password, email, phone }
 */
export const createBookie = async (req, res) => {
    try {
        if (req.admin?.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Only Super Admin can create bookies',
            });
        }

        const { username, password, email, phone } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required',
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters',
            });
        }

        const existingBookie = await Admin.findOne({ username });
        if (existingBookie) {
            return res.status(409).json({
                success: false,
                message: 'Username already exists',
            });
        }

        const bookie = new Admin({ 
            username, 
            password, 
            role: 'bookie',
            email: email || '',
            phone: phone || '',
            status: 'active'
        });
        await bookie.save();

        await logActivity({
            action: 'create_bookie',
            performedBy: req.admin?.username || 'Admin',
            performedByType: req.admin?.role || 'admin',
            targetType: 'bookie',
            targetId: bookie._id.toString(),
            details: `Bookie "${bookie.username}" created`,
            ip: getClientIp(req),
        });

        res.status(201).json({
            success: true,
            message: 'Bookie created successfully. They can now login to the Bookie Panel.',
            data: {
                id: bookie._id,
                username: bookie.username,
                role: bookie.role,
                email: bookie.email,
                phone: bookie.phone,
                status: bookie.status,
            },
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Username already exists',
            });
        }
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get all super admins
 * Only super_admin can access
 */
export const getAllSuperAdmins = async (req, res) => {
    try {
        if (req.admin?.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Only Super Admin can view super admins',
            });
        }

        const admins = await Admin.find({ role: 'super_admin' })
            .select('-password')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: admins.length,
            data: admins,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get all bookies
 * Only super_admin can access
 */
export const getAllBookies = async (req, res) => {
    try {
        if (req.admin?.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Only Super Admin can view bookies',
            });
        }

        const bookies = await Admin.find({ role: 'bookie' })
            .select('-password')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: bookies.length,
            data: bookies,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get single bookie by ID
 * Only super_admin can access
 */
export const getBookieById = async (req, res) => {
    try {
        if (req.admin?.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Only Super Admin can view bookie details',
            });
        }

        const { id } = req.params;

        const bookie = await Admin.findOne({ _id: id, role: 'bookie' }).select('-password');
        if (!bookie) {
            return res.status(404).json({
                success: false,
                message: 'Bookie not found',
            });
        }

        res.status(200).json({
            success: true,
            data: bookie,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Update bookie
 * Only super_admin can update
 * Body: { username, email, phone, status, password (optional) }
 */
export const updateBookie = async (req, res) => {
    try {
        if (req.admin?.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Only Super Admin can update bookies',
            });
        }

        const { id } = req.params;
        const { username, email, phone, status, password } = req.body;

        const bookie = await Admin.findOne({ _id: id, role: 'bookie' });
        if (!bookie) {
            return res.status(404).json({
                success: false,
                message: 'Bookie not found',
            });
        }

        // Check if new username already exists (excluding current bookie)
        if (username && username !== bookie.username) {
            const existingBookie = await Admin.findOne({ username });
            if (existingBookie) {
                return res.status(409).json({
                    success: false,
                    message: 'Username already exists',
                });
            }
            bookie.username = username;
        }

        if (email !== undefined) bookie.email = email;
        if (phone !== undefined) bookie.phone = phone;
        if (status && ['active', 'inactive'].includes(status)) bookie.status = status;
        
        // Update password if provided
        if (password) {
            if (password.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: 'Password must be at least 6 characters',
                });
            }
            bookie.password = password;
        }

        await bookie.save();

        await logActivity({
            action: 'update_bookie',
            performedBy: req.admin?.username || 'Admin',
            performedByType: req.admin?.role || 'admin',
            targetType: 'bookie',
            targetId: bookie._id.toString(),
            details: `Bookie "${bookie.username}" updated`,
            ip: getClientIp(req),
        });

        res.status(200).json({
            success: true,
            message: 'Bookie updated successfully',
            data: {
                id: bookie._id,
                username: bookie.username,
                email: bookie.email,
                phone: bookie.phone,
                status: bookie.status,
                role: bookie.role,
            },
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Username already exists',
            });
        }
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Delete bookie
 * Only super_admin can delete
 */
export const deleteBookie = async (req, res) => {
    try {
        if (req.admin?.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Only Super Admin can delete bookies',
            });
        }

        const { id } = req.params;

        const bookie = await Admin.findOne({ _id: id, role: 'bookie' });
        if (!bookie) {
            return res.status(404).json({
                success: false,
                message: 'Bookie not found',
            });
        }

        const username = bookie.username;
        await Admin.findByIdAndDelete(id);

        await logActivity({
            action: 'delete_bookie',
            performedBy: req.admin?.username || 'Admin',
            performedByType: req.admin?.role || 'admin',
            targetType: 'bookie',
            targetId: id,
            details: `Bookie "${username}" deleted`,
            ip: getClientIp(req),
        });

        res.status(200).json({
            success: true,
            message: 'Bookie deleted successfully',
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Toggle bookie status (active/inactive)
 * Only super_admin can toggle
 */
export const toggleBookieStatus = async (req, res) => {
    try {
        if (req.admin?.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Only Super Admin can toggle bookie status',
            });
        }

        const { id } = req.params;

        const bookie = await Admin.findOne({ _id: id, role: 'bookie' });
        if (!bookie) {
            return res.status(404).json({
                success: false,
                message: 'Bookie not found',
            });
        }

        bookie.status = bookie.status === 'active' ? 'inactive' : 'active';
        await bookie.save();

        await logActivity({
            action: 'toggle_bookie_status',
            performedBy: req.admin?.username || 'Admin',
            performedByType: req.admin?.role || 'admin',
            targetType: 'bookie',
            targetId: bookie._id.toString(),
            details: `Bookie "${bookie.username}" ${bookie.status === 'active' ? 'activated' : 'deactivated'}`,
            ip: getClientIp(req),
        });

        res.status(200).json({
            success: true,
            message: `Bookie ${bookie.status === 'active' ? 'activated' : 'deactivated'} successfully`,
            data: {
                id: bookie._id,
                username: bookie.username,
                status: bookie.status,
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
