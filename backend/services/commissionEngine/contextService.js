import { SETTLEMENT_STATUS } from './constants.js';

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

/**
 * Merge child SettlementContexts into parent input (no DB).
 * totalBet = sum(child.totalBet)
 * remainingDistributableIn = sum(child.remainingDistributableOut)
 */
export function mergeChildContexts(childContexts, base = {}) {
    const children = (childContexts || []).filter(Boolean);
    if (!children.length) {
        return null;
    }

    let totalBet = 0;
    let remainingDistributableIn = 0;
    const childSettlementIds = [];

    for (const ctx of children) {
        totalBet = round2(totalBet + Number(ctx.totalBet || 0));
        remainingDistributableIn = round2(
            remainingDistributableIn + Number(ctx.remainingDistributableOut ?? ctx.remainingDistributableIn ?? 0),
        );
        if (ctx.settlementId) childSettlementIds.push(ctx.settlementId);
        else if (ctx._id) childSettlementIds.push(ctx._id);
    }

    return {
        settlementId: null,
        operatorId: base.operatorId ? String(base.operatorId) : null,
        parentOperatorId: base.parentOperatorId ? String(base.parentOperatorId) : null,
        originLeafOperatorId: base.originLeafOperatorId
            ? String(base.originLeafOperatorId)
            : String(children[0]?.originLeafOperatorId || children[0]?.operatorId || ''),
        periodStart: base.periodStart ?? children[0]?.periodStart ?? null,
        periodEnd: base.periodEnd ?? children[0]?.periodEnd ?? null,
        idempotencyKey: base.idempotencyKey || '',
        totalBet,
        playerWinning: 0,
        grossProfit: 0,
        remainingDistributableIn,
        remainingDistributableOut: remainingDistributableIn,
        commissionPercentage: 0,
        calculatedCommission: 0,
        actualCommission: 0,
        settlementOrder: base.settlementOrder ?? 0,
        childSettlementIds,
        status: totalBet <= 0 && remainingDistributableIn <= 0 ? SETTLEMENT_STATUS.SKIPPED : SETTLEMENT_STATUS.PENDING,
    };
}

/** Combine direct-player rollup with child-operator rollups for one operator node. */
export function createParentSettlementContext({ operatorId, parentOperatorId, period, directLeafContext, childContexts }) {
    const parts = [];
    if (directLeafContext) parts.push(directLeafContext);
    if (childContexts?.length) parts.push(...childContexts);

    if (!parts.length) return null;

    const merged = mergeChildContexts(parts, {
        operatorId,
        parentOperatorId,
        periodStart: period?.start,
        periodEnd: period?.end,
        originLeafOperatorId: directLeafContext?.originLeafOperatorId || parts[0]?.originLeafOperatorId,
    });

    return merged;
}

export function buildIdempotencyKey(parentOperatorId, childOperatorId, period) {
    const p = parentOperatorId ? String(parentOperatorId) : 'platform';
    const c = String(childOperatorId);
    const start = period?.start ? new Date(period.start).toISOString() : 'open';
    const end = period?.end ? new Date(period.end).toISOString() : 'open';
    return `${p}:${c}:${start}:${end}`;
}

/** Runtime DTO → CommissionSettlement document shape (no DB write). */
export function settlementContextToDocument(context, extras = {}) {
    return {
        parentOperatorId: context.parentOperatorId || null,
        childOperatorId: context.operatorId,
        originLeafOperatorId: context.originLeafOperatorId,
        idempotencyKey: context.idempotencyKey,
        periodStart: context.periodStart,
        periodEnd: context.periodEnd,
        totalBet: round2(context.totalBet),
        playerWinning: round2(context.playerWinning),
        grossProfit: round2(context.grossProfit),
        remainingDistributableIn: round2(context.remainingDistributableIn),
        remainingDistributableOut: round2(context.remainingDistributableOut),
        commissionPercentage: round2(context.commissionPercentage),
        calculatedCommission: round2(context.calculatedCommission),
        actualCommission: round2(context.actualCommission),
        settlementOrder: context.settlementOrder ?? 0,
        childSettlementIds: context.childSettlementIds || [],
        status: context.status || SETTLEMENT_STATUS.COMPLETED,
        ...extras,
    };
}

/** CommissionSettlement document → SettlementContext DTO. */
export function documentToSettlementContext(doc) {
    if (!doc) return null;
    const d = doc.toObject ? doc.toObject() : doc;
    return {
        settlementId: d._id ? String(d._id) : null,
        operatorId: String(d.childOperatorId || d.operatorId),
        parentOperatorId: d.parentOperatorId ? String(d.parentOperatorId) : null,
        originLeafOperatorId: d.originLeafOperatorId ? String(d.originLeafOperatorId) : null,
        periodStart: d.periodStart,
        periodEnd: d.periodEnd,
        idempotencyKey: d.idempotencyKey || '',
        totalBet: round2(d.totalBet),
        playerWinning: round2(d.playerWinning),
        grossProfit: round2(d.grossProfit),
        remainingDistributableIn: round2(d.remainingDistributableIn),
        remainingDistributableOut: round2(d.remainingDistributableOut),
        commissionPercentage: round2(d.commissionPercentage),
        calculatedCommission: round2(d.calculatedCommission),
        actualCommission: round2(d.actualCommission),
        settlementOrder: d.settlementOrder ?? 0,
        childSettlementIds: (d.childSettlementIds || []).map(String),
        status: d.status,
    };
}
