import User from '../models/user/user.js';

/**
 * Get user IDs that belong to a bookie (referredBy = bookieId)
 * Returns null if admin is super_admin (no filter - see all)
 */
export const getBookieUserIds = async (admin) => {
    if (!admin) return null;
    if (admin.role === 'super_admin') return null;
    if (admin.role === 'bookie') {
        const users = await User.find({ referredBy: admin._id }).select('_id').lean();
        return users.map((u) => u._id);
    }
    return [];
};
