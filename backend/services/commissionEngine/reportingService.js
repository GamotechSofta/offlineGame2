import mongoose from 'mongoose';
import CommissionSettlement from '../../models/commission/commissionSettlement.js';
import { SETTLEMENT_STATUS } from './constants.js';
import { settleTreeBottomUpPreview } from './settlementService.js';
import { parseSettlementPeriod } from './periodUtils.js';

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

const toObjectId = (id) => {
    if (!id) return null;
    if (id instanceof mongoose.Types.ObjectId) return id;
    if (mongoose.Types.ObjectId.isValid(String(id))) {
        return new mongoose.Types.ObjectId(String(id));
    }
    return id;
};

function resolvePeriod(input = {}) {
    if (input?.start && input?.end) {
        return { start: input.start, end: input.end };
    }
    if (input?.startDate || input?.endDate || input?.date) {
        return parseSettlementPeriod(input);
    }
    return {};
}

/**
 * Sum completed settlements credited to an operator (childOperatorId).
 */
export async function aggregateSettledCommissionForOperator(operatorId, period = null) {
    const opOid = toObjectId(operatorId);
    const query = {
        childOperatorId: opOid,
        status: SETTLEMENT_STATUS.COMPLETED,
    };
    if (period?.start && period?.end) {
        query.periodStart = period.start;
        query.periodEnd = period.end;
    }

    const [agg] = await CommissionSettlement.aggregate([
        { $match: query },
        {
            $group: {
                _id: null,
                totalActual: { $sum: '$actualCommission' },
                totalCalculated: { $sum: '$calculatedCommission' },
                totalBet: { $sum: '$totalBet' },
                grossProfit: { $sum: '$grossProfit' },
                count: { $sum: 1 },
                lastSettledAt: { $max: '$settledAt' },
            },
        },
    ]);

    return {
        totalActual: round2(agg?.totalActual ?? 0),
        totalCalculated: round2(agg?.totalCalculated ?? 0),
        totalBet: round2(agg?.totalBet ?? 0),
        grossProfit: round2(agg?.grossProfit ?? 0),
        settlementCount: agg?.count ?? 0,
        lastSettledAt: agg?.lastSettledAt ?? null,
    };
}

/**
 * Cap-aware earned commission from engine preview (no wallet writes).
 */
export async function getOperatorEarnedCommission(operatorId, periodInput = {}) {
    const period = resolvePeriod(periodInput);
    const preview = await settleTreeBottomUpPreview({
        rootOperatorId: operatorId,
        period,
    });

    const edge = preview.edges.find((e) => String(e.operatorId) === String(operatorId));
    return {
        actualCommission: round2(edge?.actualCommission ?? 0),
        calculatedCommission: round2(edge?.calculatedCommission ?? 0),
        totalBet: round2(edge?.totalBet ?? 0),
        playerWinning: round2(edge?.playerWinning ?? 0),
        grossProfit: round2(edge?.grossProfit ?? 0),
        remainingDistributableOut: round2(edge?.remainingDistributableOut ?? 0),
        commissionPercentage: round2(edge?.commissionPercentage ?? 0),
        platformRemainder: round2(preview.platformRemainder ?? 0),
        edges: preview.edges,
        period,
    };
}

/**
 * Earned vs settled vs pending for one operator.
 */
export async function getOperatorCommissionReport(operatorId, options = {}) {
    const period = resolvePeriod(options);
    const hasPeriod = Boolean(period?.start && period?.end);

    const [earned, settled] = await Promise.all([
        getOperatorEarnedCommission(operatorId, period),
        aggregateSettledCommissionForOperator(operatorId, hasPeriod ? period : null),
    ]);

    const totalEarned = earned.actualCommission;
    const totalSettled = settled.totalActual;
    const totalPending = round2(Math.max(0, totalEarned - totalSettled));

    let paymentStatus = 'none';
    if (totalEarned > 0) {
        if (totalPending <= 0) paymentStatus = 'paid';
        else if (totalSettled > 0) paymentStatus = 'partial';
        else paymentStatus = 'pending';
    }

    return {
        operatorId: String(operatorId),
        period: hasPeriod ? period : null,
        earned,
        settled,
        totalEarned,
        totalSettled,
        totalPending,
        calculatedCommission: earned.calculatedCommission,
        grossProfit: earned.grossProfit,
        totalBet: earned.totalBet,
        platformRemainder: earned.platformRemainder,
        paymentStatus,
        lastSettledAt: settled.lastSettledAt,
        engineV2: true,
    };
}

/**
 * Platform remainder for admin — sum of root-operator remainders in full tree preview.
 */
export async function getPlatformRemainderReport(options = {}) {
    const period = resolvePeriod(options);
    const preview = await settleTreeBottomUpPreview({
        rootOperatorId: options.rootOperatorId ?? null,
        period,
    });
    const totalActualCommission = round2(
        (preview.edges || []).reduce((s, e) => s + Number(e.actualCommission || 0), 0),
    );

    return {
        platformRemainder: round2(preview.platformRemainder ?? 0),
        totalActualCommission,
        edgeCount: preview.edges?.length ?? 0,
        edges: preview.edges,
        period: period?.start && period?.end ? period : null,
        engineV2: true,
    };
}
