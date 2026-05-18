import Admin from '../models/admin/admin.js';
import { verifyAdminToken } from '../utils/adminJwt.js';
import { hasAdminTabAccess } from '../utils/adminTabAccess.js';

/**
 * Middleware to verify admin authentication.
 * Prefers Bearer JWT (fast); falls back to Basic Auth (username + password, slower).
 */
export const verifyAdmin = async (req, res, next) => {
    if (typeof next !== 'function') {
        return res.status(500).json({ success: false, message: 'Server configuration error' });
    }
    try {
        const authHeader = req.headers.authorization;

        // Prefer Bearer token (no bcrypt – fast)
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.slice(7).trim();
            if (token) {
                try {
                    const payload = verifyAdminToken(token);
                    const admin = await Admin.findById(payload.id).select('-password');
                    if (admin && admin.status === 'active') {
                        req.admin = admin;
                        return next();
                    }
                } catch (err) {
                    // Token invalid or expired – fall through to Basic auth
                }
            }
        }

        // Fallback: Basic Auth from header only (username + password – slower)
        let username, password;
        if (authHeader && authHeader.startsWith('Basic ')) {
            try {
                const credentials = Buffer.from(authHeader.replace('Basic ', ''), 'base64').toString('ascii');
                [username, password] = credentials.split(':');
            } catch (err) {}
        }
        if (!username || !password) {
            return res.status(401).json({
                success: false,
                message: 'Admin authentication required. Use Authorization: Bearer <token> or Basic <base64(username:password)>.',
            });
        }

        const admin = await Admin.findOne({ username });
        if (!admin) {
            return res.status(401).json({
                success: false,
                message: 'Invalid admin credentials',
            });
        }
        if (admin.status === 'inactive') {
            return res.status(403).json({
                success: false,
                message: 'Account suspended',
            });
        }
        const isPasswordValid = await admin.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid admin credentials',
            });
        }

        req.admin = admin;
        next();
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/** Only super_admin can access - use after verifyAdmin */
export const requireSuperAdmin = (req, res, next) => {
    if (req.admin?.role !== 'super_admin') {
        return res.status(403).json({
            success: false,
            message: 'Super admin access required',
        });
    }
    next();
};

/** Combined: verifyAdmin + requireSuperAdmin - single middleware to avoid "next is not a function" */
export const verifySuperAdmin = (req, res, next) => {
    const checkRoleAndContinue = () => {
        if (req.admin?.role !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Super admin access required',
            });
        }
        next();
    };
    verifyAdmin(req, res, checkRoleAndContinue);
};

/**
 * After verifyAdmin: super_admin or Super Bookie with tab in allowedTabs.
 */
export const requireAdminTab = (tabPath) => (req, res, next) => {
    if (hasAdminTabAccess(req.admin, tabPath)) return next();
    return res.status(403).json({
        success: false,
        message: 'You do not have access to this resource',
    });
};

/** Only bookie can access - use after verifyAdmin */
export const requireBookie = (req, res, next) => {
    if (req.admin?.role !== 'bookie') {
        return res.status(403).json({
            success: false,
            message: 'Bookie access required',
        });
    }
    next();
};

/** Only super_bookie can access - use after verifyAdmin */
export const requireSuperBookie = (req, res, next) => {
    if (req.admin?.role !== 'super_bookie') {
        return res.status(403).json({
            success: false,
            message: 'Super bookie access required',
        });
    }
    next();
};
