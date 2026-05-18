import mongoose from 'mongoose';
import User from '../models/user/user.js';
import Admin from '../models/admin/admin.js';
import { hasFullPlayerListScope } from './adminTabAccess.js';

const toObjectId = (id) => {
    if (!id) return null;
    if (id instanceof mongoose.Types.ObjectId) return id;
    if (mongoose.Types.ObjectId.isValid(String(id))) return new mongoose.Types.ObjectId(String(id));
    return id;
};

/**
 * Resolve bookie/super_bookie for commission when lean() omits `role`
 * (e.g. Admin.find({ role: 'bookie' }).select('_id username ...')).
 */
export const resolveCommissionRole = (admin) => {
    if (!admin) return null;
    if (admin.role === 'bookie' || admin.role === 'super_bookie') return admin.role;
    if (admin.parentBookieId != null) return 'super_bookie';
    // Bookie list queries often omit role; no parentBookieId => bookie account.
    if (admin._id) return 'bookie';
    return null;
};

/**
 * Get user IDs scoped to bookie / super bookie (referredBy = operator id).
 * Returns null if admin can see all players (super_admin / Super Bookie with All Players tab).
 */
export const getBookieUserIds = async (admin) => {
    if (!admin) return null;
    if (hasFullPlayerListScope(admin)) return null;
    const role = resolveCommissionRole(admin);
    if (role === 'bookie') {
        return getBookieHierarchyUserIds(admin._id);
    }
    if (role === 'super_bookie') {
        const users = await User.find({ referredBy: admin._id }).select('_id').lean();
        return users.map((u) => u._id);
    }
    return [];
};

/** All player IDs under a bookie (direct + via super bookies). */
export const getBookieHierarchyUserIds = async (bookieId) => {
    const bookieOid = toObjectId(bookieId);
    const superBookies = await Admin.find({ parentBookieId: bookieOid, role: 'super_bookie' })
        .select('_id')
        .lean();
    const ownerIds = [bookieOid, ...superBookies.map((sb) => sb._id)];
    const users = await User.find({ referredBy: { $in: ownerIds } }).select('_id').lean();
    return users.map((u) => u._id);
};

/** Admin ids whose placed-by-bookie bets count toward this account's commission. */
export const getCommissionOperatorIds = async (admin) => {
    if (!admin?._id) return [];
    const role = resolveCommissionRole(admin);
    if (role === 'bookie') {
        const superBookies = await Admin.find({
            parentBookieId: toObjectId(admin._id),
            role: 'super_bookie',
        })
            .select('_id')
            .lean();
        return [toObjectId(admin._id), ...superBookies.map((sb) => sb._id)];
    }
    if (role === 'super_bookie') {
        return [toObjectId(admin._id)];
    }
    return [];
};

/** True if player user id is in this operator's downline. */
export const isPlayerUnderOperator = async (admin, userId) => {
    const allowed = await getBookieUserIds(admin);
    if (allowed === null) return true;
    return allowed.some((id) => String(id) === String(userId));
};

/** Dashboard summary: super bookies + direct vs downstream players for a bookie. */
export const getBookieHierarchySummary = async (bookieId, dateMatch = {}) => {
    const superBookies = await Admin.find({ parentBookieId: bookieId, role: 'super_bookie' })
        .select('username phone status balance createdAt')
        .sort({ createdAt: -1 })
        .lean();

    const sbIds = superBookies.map((sb) => sb._id);
    const [directPlayers, directActive, directNewInRange, sbPlayerAgg] = await Promise.all([
        User.countDocuments({ referredBy: bookieId }),
        User.countDocuments({ referredBy: bookieId, isActive: true }),
        User.countDocuments({ referredBy: bookieId, ...dateMatch }),
        sbIds.length
            ? User.aggregate([
                  { $match: { referredBy: { $in: sbIds } } },
                  { $group: { _id: '$referredBy', count: { $sum: 1 }, active: { $sum: { $cond: ['$isActive', 1, 0] } } } },
              ])
            : Promise.resolve([]),
    ]);

    const sbCountMap = Object.fromEntries(
        sbPlayerAgg.map((row) => [String(row._id), { count: row.count, active: row.active }])
    );

    let superBookiePlayers = 0;
    let superBookiePlayersActive = 0;
    const superBookiesEnriched = superBookies.map((sb) => {
        const stats = sbCountMap[String(sb._id)] || { count: 0, active: 0 };
        superBookiePlayers += stats.count;
        superBookiePlayersActive += stats.active;
        return {
            id: sb._id,
            username: sb.username,
            phone: sb.phone,
            status: sb.status,
            balance: sb.balance ?? 0,
            playerCount: stats.count,
            activePlayerCount: stats.active,
        };
    });

    return {
        superBookiesCount: superBookies.length,
        superBookiesActive: superBookies.filter((sb) => sb.status === 'active').length,
        directPlayers,
        directActive,
        directNewInRange,
        superBookiePlayers,
        superBookiePlayersActive,
        totalPlayers: directPlayers + superBookiePlayers,
        superBookies: superBookiesEnriched,
    };
};
