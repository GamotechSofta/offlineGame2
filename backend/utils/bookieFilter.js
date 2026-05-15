import User from '../models/user/user.js';
import { hasFullPlayerListScope } from './adminTabAccess.js';

/**
 * Get user IDs that belong to a bookie (referredBy = bookieId)
 * Returns null if admin can see all players (super_admin / Super Bookie with All Players tab)
 */
export const getBookieUserIds = async (admin) => {
    if (!admin) return null;
    if (hasFullPlayerListScope(admin)) return null;
    if (admin.role === 'bookie') {
        const users = await User.find({ referredBy: admin._id }).select('_id').lean();
        return users.map((u) => u._id);
    }
    return [];
};
