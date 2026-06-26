import { SETTLEMENT_STATUS } from './constants.js';

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

/**
 * Pure edge formula — no MongoDB, no wallet.
 * % always from totalBet; cap from remainingDistributableIn only.
 */
export function applyEdgeFormula(context, commissionPercentage) {
    const totalBet = round2(context.totalBet);
    const remainingDistributableIn = round2(context.remainingDistributableIn);
    const rate = Number(commissionPercentage || 0);

    const calculatedCommission = round2((totalBet * rate) / 100);
    const effectivePool = Math.max(0, remainingDistributableIn);
    const actualCommission = round2(Math.min(calculatedCommission, effectivePool));
    const remainingDistributableOut = round2(remainingDistributableIn - actualCommission);

    return {
        ...context,
        commissionPercentage: rate,
        calculatedCommission,
        actualCommission,
        remainingDistributableOut,
        status:
            totalBet <= 0 && remainingDistributableIn <= 0
                ? SETTLEMENT_STATUS.SKIPPED
                : SETTLEMENT_STATUS.COMPLETED,
    };
}

/** Build pre-edge rollup context from leaf metrics (before parent edge). */
export function createLeafRollupContext({
    operatorId,
    parentOperatorId,
    originLeafOperatorId,
    period,
    metrics,
    idempotencyKey = '',
}) {
    const totalBet = round2(metrics.totalBet);
    const playerWinning = round2(metrics.playerWinning);
    const grossProfit = round2(metrics.grossProfit);

    return {
        settlementId: null,
        operatorId: String(operatorId),
        parentOperatorId: parentOperatorId ? String(parentOperatorId) : null,
        originLeafOperatorId: String(originLeafOperatorId || operatorId),
        periodStart: period?.start ?? null,
        periodEnd: period?.end ?? null,
        idempotencyKey,
        totalBet,
        playerWinning,
        grossProfit,
        remainingDistributableIn: grossProfit,
        remainingDistributableOut: grossProfit,
        commissionPercentage: 0,
        calculatedCommission: 0,
        actualCommission: 0,
        settlementOrder: 0,
        childSettlementIds: [],
        status: totalBet <= 0 && grossProfit <= 0 ? SETTLEMENT_STATUS.SKIPPED : SETTLEMENT_STATUS.PENDING,
    };
}
