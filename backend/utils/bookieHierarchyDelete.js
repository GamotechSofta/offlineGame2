import mongoose from 'mongoose';
import Admin from '../models/admin/admin.js';
import User from '../models/user/user.js';
import { Wallet, WalletTransaction } from '../models/wallet/wallet.js';
import CommissionPayment from '../models/commission/commissionPayment.js';
import CommissionRequest from '../models/commission/commission.js';
import BookieWalletTransaction from '../models/bookieWalletTransaction/bookieWalletTransaction.js';

const toObjectId = (id) => {
    if (!id) return null;
    if (id instanceof mongoose.Types.ObjectId) return id;
    if (mongoose.Types.ObjectId.isValid(String(id))) return new mongoose.Types.ObjectId(String(id));
    return id;
};

/**
 * Delete a top-level bookie (SuperBookie) and all sub-bookies + players under them.
 */
export async function cascadeDeleteSuperBookieHierarchy(parentBookieId) {
    const bookieOid = toObjectId(parentBookieId);
    if (!bookieOid) {
        throw new Error('Invalid bookie id');
    }

    const parent = await Admin.findOne({ _id: bookieOid, role: 'bookie' }).lean();
    if (!parent) {
        return null;
    }

    const superBookies = await Admin.find({
        parentBookieId: bookieOid,
        role: 'super_bookie',
    })
        .select('_id username')
        .lean();

    const superBookieIds = superBookies.map((sb) => sb._id);
    const ownerIds = [bookieOid, ...superBookieIds];

    const users = await User.find({ referredBy: { $in: ownerIds } })
        .select('_id username')
        .lean();
    const userIds = users.map((u) => u._id);

    if (userIds.length > 0) {
        await WalletTransaction.deleteMany({ userId: { $in: userIds } });
        await Wallet.deleteMany({ userId: { $in: userIds } });
        await User.deleteMany({ _id: { $in: userIds } });
    }

    await CommissionPayment.deleteMany({ bookieId: { $in: ownerIds } });
    await CommissionRequest.deleteMany({ bookieId: { $in: ownerIds } });
    await BookieWalletTransaction.deleteMany({ adminId: { $in: ownerIds } });

    if (superBookieIds.length > 0) {
        await Admin.deleteMany({ _id: { $in: superBookieIds } });
    }

    await Admin.findByIdAndDelete(bookieOid);

    return {
        parentUsername: parent.username,
        superBookiesDeleted: superBookies.length,
        playersDeleted: users.length,
    };
}
