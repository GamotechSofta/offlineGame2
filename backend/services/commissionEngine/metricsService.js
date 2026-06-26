import mongoose from 'mongoose';
import Bet from '../../models/bet/bet.js';
import QuizBet from '../../models/quiz/QuizBet.js';
import Admin from '../../models/admin/admin.js';
import { getBookieUserIds, getCommissionOperatorIds } from '../../utils/bookieFilter.js';

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

const toObjectId = (id) => {
    if (!id) return null;
    if (id instanceof mongoose.Types.ObjectId) return id;
    if (mongoose.Types.ObjectId.isValid(String(id))) {
        return new mongoose.Types.ObjectId(String(id));
    }
    return id;
};

const emptyLeafMetrics = () => ({
    totalBet: 0,
    playerWinning: 0,
    grossProfit: 0,
    matkaBetAmount: 0,
    lotteryBetAmount: 0,
    betCount: 0,
});

/** Same bet scope as commissionMetrics.getCommissionScopeMatch (direct players + bookie-placed bets). */
async function buildLeafCommissionScope(operatorId) {
    const admin = await Admin.findById(operatorId)
        .select('_id role parentBookieId')
        .lean();
    if (!admin) return null;

    const userIds = (await getBookieUserIds(admin, { directOnly: true })) || [];
    const operatorIds = await getCommissionOperatorIds(admin, { directOnly: true });
    const clauses = [];
    if (userIds.length) clauses.push({ userId: { $in: userIds } });
    if (operatorIds.length) clauses.push({ placedByBookieId: { $in: operatorIds } });
    if (!clauses.length) return null;
    return clauses.length === 1 ? clauses[0] : { $or: clauses };
}

/**
 * LEAF ONLY — aggregate direct-player scope for one operator and period.
 * Includes referred players and bets placed by this operator on the panel.
 */
export async function aggregateLeafMetrics(operatorId, period) {
    const scope = await buildLeafCommissionScope(operatorId);
    if (!scope) {
        return emptyLeafMetrics();
    }

    const dateFilter = {};
    if (period?.start && period?.end) {
        dateFilter.createdAt = { $gte: period.start, $lte: period.end };
    }

    const matkaMatch = {
        ...dateFilter,
        status: { $ne: 'cancelled' },
        ...scope,
    };
    const quizMatch = {
        ...dateFilter,
        status: { $ne: 'cancelled' },
        ...scope,
    };

    const [
        matkaAgg,
        matkaPayoutAgg,
        quizAgg,
        quizPayoutAgg,
        matkaCount,
        quizCount,
    ] = await Promise.all([
        Bet.aggregate([
            { $match: matkaMatch },
            { $group: { _id: null, totalAmount: { $sum: '$amount' } } },
        ]),
        Bet.aggregate([
            { $match: { ...matkaMatch, status: 'won' } },
            { $group: { _id: null, totalPayout: { $sum: '$payout' } } },
        ]),
        QuizBet.aggregate([
            { $match: quizMatch },
            { $group: { _id: null, totalAmount: { $sum: '$amount' } } },
        ]),
        QuizBet.aggregate([
            { $match: { ...quizMatch, status: 'win' } },
            { $group: { _id: null, totalPayout: { $sum: '$winPayout' } } },
        ]),
        Bet.countDocuments(matkaMatch),
        QuizBet.countDocuments(quizMatch),
    ]);

    const matkaBetAmount = round2(matkaAgg?.[0]?.totalAmount || 0);
    const lotteryBetAmount = round2(quizAgg?.[0]?.totalAmount || 0);
    const totalBet = round2(matkaBetAmount + lotteryBetAmount);
    const playerWinning = round2(
        Number(matkaPayoutAgg?.[0]?.totalPayout || 0) + Number(quizPayoutAgg?.[0]?.totalPayout || 0),
    );
    const grossProfit = round2(totalBet - playerWinning);

    return {
        totalBet,
        playerWinning,
        grossProfit,
        matkaBetAmount,
        lotteryBetAmount,
        betCount: Number(matkaCount || 0) + Number(quizCount || 0),
    };
}
