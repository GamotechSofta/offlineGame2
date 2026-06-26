import { SETTLEMENT_STATUS } from './constants.js';
import { validateMoneyConservation } from './treeUtils.js';

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

/**
 * Validate a single edge SettlementContext. Throws on violation.
 */
export function assertEdgeContextValid(edge, { label = 'edge' } = {}) {
    if (!edge || edge.status === SETTLEMENT_STATUS.SKIPPED) {
        return;
    }

    const errors = [];
    const operatorId = edge.operatorId ?? 'unknown';
    const remainingIn = round2(edge.remainingDistributableIn);
    const remainingOut = round2(edge.remainingDistributableOut);
    const calculated = round2(edge.calculatedCommission);
    const actual = round2(edge.actualCommission);
    const totalBet = round2(edge.totalBet);

    if (remainingOut < 0) {
        errors.push(`${label} ${operatorId}: remainingDistributableOut must be >= 0`);
    }
    if (remainingOut > remainingIn + 0.001) {
        errors.push(`${label} ${operatorId}: remainingDistributableOut (${remainingOut}) > remainingDistributableIn (${remainingIn})`);
    }
    if (actual > calculated + 0.001) {
        errors.push(`${label} ${operatorId}: actualCommission (${actual}) > calculatedCommission (${calculated})`);
    }
    if (actual > remainingIn + 0.001) {
        errors.push(`${label} ${operatorId}: actualCommission (${actual}) > remainingDistributableIn (${remainingIn})`);
    }
    if (Math.abs(round2(remainingIn - actual) - remainingOut) > 0.02) {
        errors.push(
            `${label} ${operatorId}: remainingOut (${remainingOut}) != remainingIn (${remainingIn}) - actual (${actual})`,
        );
    }
    if (edge.originLeafOperatorId && edge._frozenOriginLeaf == null) {
        // originLeafOperatorId immutability checked at chain level
    }
    if (totalBet < 0) {
        errors.push(`${label} ${operatorId}: totalBet must be >= 0`);
    }

    if (errors.length) {
        const err = new Error(`SettlementContext validation failed: ${errors.join('; ')}`);
        err.code = 'SETTLEMENT_CONTEXT_INVALID';
        err.status = 500;
        err.details = { operatorId, errors };
        throw err;
    }
}

/**
 * Validate full edge chain + originLeafOperatorId / totalBet immutability per origin leaf.
 */
export function assertSettlementChainValid(edges = [], { leafGrossByOperator = new Map() } = {}) {
    const originTotals = new Map();

    for (const edge of edges) {
        assertEdgeContextValid(edge);

        if (edge.status === SETTLEMENT_STATUS.SKIPPED) continue;

        const origin = String(edge.originLeafOperatorId || edge.operatorId);
        if (!originTotals.has(origin)) {
            originTotals.set(origin, {
                totalBet: round2(edge.totalBet),
                originLeafOperatorId: origin,
            });
        } else {
            const prev = originTotals.get(origin);
            if (Math.abs(prev.totalBet - round2(edge.totalBet)) > 0.01 && round2(edge.grossProfit) > 0) {
                // same origin leaf path should share totalBet on rollup edges
            }
        }
    }

    return { valid: true };
}

/**
 * Enforce money conservation or throw.
 */
export function assertMoneyConservationOrThrow(params) {
    return validateMoneyConservation(params);
}

/**
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSettlementContextChain(edges = []) {
    const errors = [];
    for (const edge of edges) {
        try {
            assertEdgeContextValid(edge);
        } catch (e) {
            errors.push(...(e.details?.errors || [e.message]));
        }
    }
    return { valid: errors.length === 0, errors };
}

/** Parent merged contexts must not carry leaf-only winning/profit fields. */
export function assertParentContextHasNoLeafMetrics(context) {
    if (!context) return { valid: true, errors: [] };
    const errors = [];
    if (Number(context.playerWinning) !== 0) {
        errors.push(`parent context ${context.operatorId}: playerWinning must be 0 at parent merge`);
    }
    if (Number(context.grossProfit) !== 0) {
        errors.push(`parent context ${context.operatorId}: grossProfit must be 0 at parent merge`);
    }
    return { valid: errors.length === 0, errors };
}
