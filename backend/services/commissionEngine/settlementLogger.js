/**
 * Structured settlement logging (no player PII).
 */

const LOG_PREFIX = '[commission-settlement]';

export function logSettlementEdge({
    phase,
    settlementId = null,
    parentOperatorId = null,
    childOperatorId = null,
    originLeafOperatorId = null,
    totalBet = 0,
    grossProfit = 0,
    calculatedCommission = 0,
    actualCommission = 0,
    remainingDistributableOut = 0,
    idempotencyKey = '',
    executionMs = null,
    status = 'completed',
    skipped = false,
}) {
    const payload = {
        phase,
        settlementId: settlementId ? String(settlementId) : null,
        parentOperatorId: parentOperatorId ? String(parentOperatorId) : null,
        childOperatorId: childOperatorId ? String(childOperatorId) : null,
        originLeafOperatorId: originLeafOperatorId ? String(originLeafOperatorId) : null,
        totalBet: Number(totalBet || 0),
        grossProfit: Number(grossProfit || 0),
        calculatedCommission: Number(calculatedCommission || 0),
        actualCommission: Number(actualCommission || 0),
        remainingDistributableOut: Number(remainingDistributableOut || 0),
        idempotencyKey: idempotencyKey || '',
        status,
        skipped: Boolean(skipped),
        ...(executionMs != null ? { executionMs: Math.round(executionMs) } : {}),
    };

    console.info(LOG_PREFIX, JSON.stringify(payload));
}

export function logSettlementSummary({
    phase,
    rootOperatorId = null,
    edgeCount = 0,
    platformRemainder = 0,
    totalActualCommission = 0,
    totalLeafGrossProfit = 0,
    executionMs = null,
}) {
    console.info(
        LOG_PREFIX,
        JSON.stringify({
            phase,
            event: 'summary',
            rootOperatorId: rootOperatorId ? String(rootOperatorId) : null,
            edgeCount,
            platformRemainder: Number(platformRemainder || 0),
            totalActualCommission: Number(totalActualCommission || 0),
            totalLeafGrossProfit: Number(totalLeafGrossProfit || 0),
            ...(executionMs != null ? { executionMs: Math.round(executionMs) } : {}),
        }),
    );
}

export function logSettlementError({ phase, error, idempotencyKey = '' }) {
    console.error(
        LOG_PREFIX,
        JSON.stringify({
            phase,
            event: 'error',
            code: error?.code || 'SETTLEMENT_ERROR',
            message: error?.message || String(error),
            idempotencyKey: idempotencyKey || '',
        }),
    );
}
