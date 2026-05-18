import Admin from '../models/admin/admin.js';
import { verifyAdminToken } from './adminJwt.js';
import { isBookiePanelRole } from './adminRoles.js';

/**
 * Resolve bookie / super_bookie panel token for Socket.IO bookie:subscribe.
 * @param {string} rawToken Bearer token from client
 */
export async function resolveBookiePanelAdminFromToken(rawToken) {
    const token = String(rawToken || '').trim();
    if (!token) return { code: 'AUTH_REQUIRED' };

    let payload;
    try {
        payload = verifyAdminToken(token);
    } catch (e) {
        if (e?.name === 'TokenExpiredError') return { code: 'TOKEN_EXPIRED' };
        return { code: 'AUTH_REQUIRED' };
    }

    const adminId = payload?.id;
    if (!adminId) return { code: 'AUTH_REQUIRED' };

    const admin = await Admin.findById(adminId).select('_id role status balance username').lean();
    if (!admin || !isBookiePanelRole(admin)) return { code: 'AUTH_REQUIRED' };
    if (admin.status !== 'active') return { code: 'ACCOUNT_SUSPENDED' };

    return {
        adminId: String(admin._id),
        role: admin.role,
        balance: Number(admin.balance || 0),
        username: admin.username,
    };
}

/** @param {import('socket.io').Socket} socket */
export function extractBookiePanelTokenFromSocket(socket) {
    const authTok = String(socket?.handshake?.auth?.token ?? '').trim();
    if (authTok) return authTok;
    const header = String(socket?.handshake?.headers?.authorization ?? '');
    if (header.startsWith('Bearer ')) return header.slice(7).trim();
    return '';
}
