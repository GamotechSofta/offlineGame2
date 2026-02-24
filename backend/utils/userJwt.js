import jwt from 'jsonwebtoken';

const SECRET = process.env.USER_JWT_SECRET || process.env.JWT_SECRET || 'user-jwt-secret-change-in-production';
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
