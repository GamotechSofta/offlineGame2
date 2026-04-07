import { verifyUserToken } from '../utils/userJwt.js';

/**
 * Middleware to verify player authentication via JWT.
 * Expects: Authorization: Bearer <token>
 * On success sets req.userId and calls next(). On failure returns 401.
 */
export const verifyUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const bearerToken = authHeader && authHeader.startsWith('Bearer ')
            ? authHeader.slice(7).trim()
            : '';
        const cookieToken = req.cookies?.userToken ? String(req.cookies.userToken).trim() : '';
        const token = bearerToken || cookieToken;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required. Please log in.',
                code: 'AUTH_REQUIRED',
            });
        }
        const payload = verifyUserToken(token);
        const userId = payload.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token.',
                code: 'AUTH_REQUIRED',
            });
        }
        req.userId = userId;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Session expired. Please log in again.',
                code: 'TOKEN_EXPIRED',
            });
        }
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token. Please log in again.',
            code: 'AUTH_REQUIRED',
        });
    }
};
