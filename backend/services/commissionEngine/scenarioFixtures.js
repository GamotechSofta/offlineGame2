import { applyEdgeFormula, createLeafRollupContext } from './calculationService.js';
import { mergeChildContexts } from './contextService.js';

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

/** Simulate one leaf operator edge (pre-parent formula). */
export function simulateLeafEdge({
    operatorId,
    parentOperatorId = null,
    metrics,
    commissionPercentage,
}) {
    const leaf = createLeafRollupContext({
        operatorId,
        parentOperatorId,
        originLeafOperatorId: operatorId,
        period: {},
        metrics,
    });
    return applyEdgeFormula(
        { ...leaf, remainingDistributableIn: leaf.grossProfit },
        commissionPercentage,
    );
}

/** Simulate parent edge from completed child edge contexts. */
export function simulateParentEdge({
    childEdges,
    operatorId,
    parentOperatorId = null,
    commissionPercentage,
}) {
    const merged = mergeChildContexts(childEdges, {
        operatorId,
        parentOperatorId,
    });
    return applyEdgeFormula(
        {
            ...merged,
            operatorId,
            parentOperatorId,
            remainingDistributableIn: merged.remainingDistributableIn,
        },
        commissionPercentage,
    );
}

/** Two-level tree: leaf bookie → superbookie → platform remainder. */
export function simulateTwoLevelTree({
    leafMetrics,
    bookieRate,
    superBookieRate,
    bookieId = 'bookie',
    superBookieId = 'superbookie',
}) {
    const bookieEdge = simulateLeafEdge({
        operatorId: bookieId,
        parentOperatorId: superBookieId,
        metrics: leafMetrics,
        commissionPercentage: bookieRate,
    });
    const superBookieEdge = simulateParentEdge({
        childEdges: [bookieEdge],
        operatorId: superBookieId,
        parentOperatorId: null,
        commissionPercentage: superBookieRate,
    });
    const totalDistributed = round2(
        bookieEdge.actualCommission + superBookieEdge.actualCommission + superBookieEdge.remainingDistributableOut,
    );
    return { bookieEdge, superBookieEdge, platformRemainder: superBookieEdge.remainingDistributableOut, totalDistributed };
}
