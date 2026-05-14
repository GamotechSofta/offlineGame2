import User from '../models/user/user.js';
import { verifyUserToken } from './userJwt.js';

/**
 * Same session rules as verifyUser middleware, for Socket.IO wallet:subscribe.
 * @param {string} rawToken Bearer value or userToken cookie value
 * @returns {Promise<{ userId: string } | { code: string }>}
 */
export async function resolveActivePlayerUserIdFromToken(rawToken) {
  const token = String(rawToken || '').trim();
  if (!token) return { code: 'AUTH_REQUIRED' };
  let payload;
  try {
    payload = verifyUserToken(token);
  } catch (e) {
    if (e?.name === 'TokenExpiredError') return { code: 'TOKEN_EXPIRED' };
    return { code: 'AUTH_REQUIRED' };
  }
  const userId = payload?.userId;
  if (!userId) return { code: 'AUTH_REQUIRED' };

  const user = await User.findById(userId).select('isActive sessionVersion currentAuthToken').lean();
  if (!user || !user.isActive) return { code: 'AUTH_REQUIRED' };

  const tokenSessionVersion = Number(payload?.sv);
  const currentSessionVersion = Number(user?.sessionVersion);
  if (
    Number.isFinite(tokenSessionVersion) &&
    Number.isFinite(currentSessionVersion) &&
    tokenSessionVersion !== currentSessionVersion
  ) {
    return { code: 'SESSION_REVOKED' };
  }
  const activeToken = user?.currentAuthToken ? String(user.currentAuthToken).trim() : '';
  if (activeToken && activeToken !== token) {
    return { code: 'SESSION_REVOKED' };
  }
  return { userId: String(userId) };
}

/** @param {import('socket.io').Socket} socket */
export function extractUserTokenFromSocketHandshake(socket) {
  const authTok = String(socket?.handshake?.auth?.token ?? '').trim();
  if (authTok) return authTok;
  const raw = String(socket?.handshake?.headers?.cookie || '');
  const m = raw.match(/(?:^|;\s*)userToken=([^;]+)/);
  return m ? decodeURIComponent(m[1].trim()) : '';
}
