import { verifyUserToken } from '../utils/userJwt.js';

/**
 * Sets req.userId when a valid Bearer / userToken cookie is present; never 401.
 */
export function optionalUserQuiz(req, res, next) {
  req.userId = null;
  try {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const cookieToken = req.cookies?.userToken ? String(req.cookies.userToken).trim() : '';
    const token = bearerToken || cookieToken;
    if (!token) return next();
    const payload = verifyUserToken(token);
    if (payload?.userId) req.userId = payload.userId;
  } catch {
    /* ignore invalid token for public quiz flows */
  }
  next();
}
