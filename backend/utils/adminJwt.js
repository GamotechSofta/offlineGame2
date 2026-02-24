import jwt from 'jsonwebtoken';

const isProduction = process.env.NODE_ENV === 'production';
const rawSecret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
const SECRET = rawSecret || (isProduction ? null : 'admin-jwt-secret-change-in-production');

if (isProduction && !SECRET) {
    throw new Error(
        'ADMIN_JWT_SECRET or JWT_SECRET must be set in production. ' +
        'Set one of these in your environment (e.g. in .env) and restart the server.'
    );
}

const EXPIRES_IN = process.env.ADMIN_JWT_EXPIRES_IN || '7d';

/**
 * Sign a JWT for admin (after login). Payload: { id, username, role }.
 */
export function signAdminToken(admin) {
    return jwt.sign(
        { id: admin._id.toString(), username: admin.username, role: admin.role },
        SECRET,
        { expiresIn: EXPIRES_IN }
    );
}

/**
 * Verify admin JWT. Returns payload or throws.
 */
export function verifyAdminToken(token) {
    return jwt.verify(token, SECRET);
}
