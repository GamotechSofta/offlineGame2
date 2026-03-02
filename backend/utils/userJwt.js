import jwt from 'jsonwebtoken';

const isProduction = process.env.NODE_ENV === 'production';
const rawSecret = process.env.USER_JWT_SECRET || process.env.JWT_SECRET;
const SECRET = rawSecret || (isProduction ? null : 'user-jwt-secret-change-in-production');

if (isProduction && !SECRET) {
    throw new Error(
        'USER_JWT_SECRET or JWT_SECRET must be set in production. Set one of these in your environment and restart the server.'
    );
}

const EXPIRES_IN = process.env.USER_JWT_EXPIRES_IN || '7d';

/**
 * Sign a JWT for player (after login). Payload: { userId }.
 */
export function signUserToken(user) {
    const userId = user._id?.toString?.() || user.id;
    if (!userId) throw new Error('User must have _id or id');
    return jwt.sign(
        { userId },
        SECRET,
        { expiresIn: EXPIRES_IN }
    );
}

/**
 * Verify player JWT. Returns payload { userId } or throws.
 */
export function verifyUserToken(token) {
    return jwt.verify(token, SECRET);
}
