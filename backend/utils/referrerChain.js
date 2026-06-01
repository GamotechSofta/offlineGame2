import Admin from '../models/admin/admin.js';
import User from '../models/user/user.js';

/** Attach bookie + super bookie chain for admin player lists */
export const enrichUsersWithReferrerChain = async (users) => {
    if (!users?.length) return users;

    const parentBookieIds = new Set();
    for (const u of users) {
        const ref = u.referredBy;
        if (ref && ref.role === 'super_bookie' && ref.parentBookieId) {
            parentBookieIds.add(String(ref.parentBookieId));
        }
    }

    let parentMap = {};
    if (parentBookieIds.size > 0) {
        const parents = await Admin.find({ _id: { $in: [...parentBookieIds] } })
            .select('username phone status')
            .lean();
        parentMap = Object.fromEntries(parents.map((p) => [String(p._id), p]));
    }

    return users.map((u) => {
        const ref = u.referredBy;
        if (!ref || !ref._id) {
            return { ...u, referrerChain: null };
        }
        if (ref.role === 'super_bookie') {
            const parentId = ref.parentBookieId ? String(ref.parentBookieId) : null;
            const parent = parentId ? parentMap[parentId] : null;
            return {
                ...u,
                referrerChain: {
                    bookie: parent
                        ? { _id: parentId, username: parent.username, phone: parent.phone, status: parent.status }
                        : parentId
                          ? { _id: parentId, username: '—' }
                          : null,
                    superBookie: {
                        _id: ref._id,
                        username: ref.username,
                        phone: ref.phone,
                        status: ref.status,
                    },
                },
            };
        }
        return {
            ...u,
            referrerChain: {
                bookie: {
                    _id: ref._id,
                    username: ref.username,
                    phone: ref.phone,
                    status: ref.status,
                },
                superBookie: null,
            },
        };
    });
};

const resolvePaymentPlayerId = (payment) => {
    if (payment?.playerId) return String(payment.playerId);
    const u = payment?.userId;
    if (!u) return '';
    if (typeof u === 'string') return u;
    if (u._id) return String(u._id);
    return '';
};

/** Enrich embedded user objects on payment list items */
export const enrichPaymentsWithUserReferrerChain = async (payments) => {
    if (!payments?.length) return payments;

    const userIds = [...new Set(payments.map(resolvePaymentPlayerId).filter(Boolean))];
    if (userIds.length === 0) return payments;

    const fullUsers = await User.find({ _id: { $in: userIds } })
        .select('referredBy source')
        .populate('referredBy', 'username role parentBookieId phone status')
        .lean();

    const enriched = await enrichUsersWithReferrerChain(fullUsers);
    const chainByUserId = Object.fromEntries(
        enriched.map((u) => [String(u._id), { referrerChain: u.referrerChain, source: u.source }])
    );

    return payments.map((p) => {
        const playerId = resolvePaymentPlayerId(p);
        if (!playerId) return p;
        const extra = chainByUserId[playerId];
        if (!extra) return p;
        const baseUser =
            p.userId && typeof p.userId === 'object'
                ? p.userId
                : { _id: playerId };
        return {
            ...p,
            playerId,
            userId: {
                ...baseUser,
                _id: baseUser._id || playerId,
                source: extra.source,
                referrerChain: extra.referrerChain,
            },
        };
    });
};
