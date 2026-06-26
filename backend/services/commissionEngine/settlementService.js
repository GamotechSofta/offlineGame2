import mongoose from 'mongoose';
import { SETTLEMENT_STATUS } from './constants.js';
import {
    buildOperatorTree,
    getPostOrderOperatorIds,
    batchOperatorsWithDirectPlayers,
    loadOperator,
} from './hierarchyService.js';
import { aggregateLeafMetrics } from './metricsService.js';
import { applyEdgeFormula, createLeafRollupContext } from './calculationService.js';
import {
    buildIdempotencyKey,
    createParentSettlementContext,
} from './contextService.js';
import {
    findCompletedSettlementByIdempotencyKey,
    persistSettlementRecord,
    createCommissionPaymentRecord,
} from './persistenceService.js';
import { creditOperatorCommissionSettlement } from './walletSettlementService.js';
import { invalidateAdminReadCaches } from '../../services/cacheInvalidationService.js';
import { assertEdgeContextValid, assertMoneyConservationOrThrow } from './invariants.js';
import { logSettlementEdge, logSettlementSummary, logSettlementError } from './settlementLogger.js';

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

const skippedContext = (operatorId, parentOperatorId, period) => ({
    settlementId: null,
    operatorId: String(operatorId),
    parentOperatorId: parentOperatorId ? String(parentOperatorId) : null,
    originLeafOperatorId: String(operatorId),
    periodStart: period?.start ?? null,
    periodEnd: period?.end ?? null,
    idempotencyKey: '',
    totalBet: 0,
    playerWinning: 0,
    grossProfit: 0,
    remainingDistributableIn: 0,
    remainingDistributableOut: 0,
    commissionPercentage: 0,
    calculatedCommission: 0,
    actualCommission: 0,
    settlementOrder: 0,
    childSettlementIds: [],
    status: SETTLEMENT_STATUS.SKIPPED,
});

/**
 * Build edge contexts bottom-up (no wallet / optional load from DB when persisting).
 */
async function buildTreeEdgeContexts({
    rootOperatorId = null,
    period,
    loadPersisted = false,
    session = null,
}) {
    const { operators, children, rootIds } = await buildOperatorTree(rootOperatorId);
    if (!operators.size) {
        return { edges: [], edgeContexts: new Map(), platformRemainder: 0, rollupByOperator: new Map() };
    }

    const postOrder = getPostOrderOperatorIds(children, rootIds);
    const edgeContexts = new Map();
    const rollupByOperator = new Map();
    let order = 0;
    let totalLeafGrossProfit = 0;

    const operatorsWithPlayers = await batchOperatorsWithDirectPlayers([...operators.keys()]);

    for (const operatorId of postOrder) {
        const operator = operators.get(operatorId);
        if (!operator) continue;

        const idempotencyKey = buildIdempotencyKey(
            operator.parentBookieId || null,
            operatorId,
            period,
        );

        if (loadPersisted) {
            const existing = await findCompletedSettlementByIdempotencyKey(idempotencyKey, session);
            if (existing) {
                edgeContexts.set(operatorId, existing);
                continue;
            }
        }

        const childIds = children.get(operatorId) || [];
        for (const childId of childIds) {
            if (!edgeContexts.has(childId)) {
                edgeContexts.set(childId, skippedContext(childId, operatorId, period));
            }
        }

        const childEdgeContexts = childIds.map((cid) => edgeContexts.get(cid)).filter(Boolean);

        let directLeafContext = null;
        if (operatorsWithPlayers.has(operatorId)) {
            const metrics = await aggregateLeafMetrics(operatorId, period);
            directLeafContext = createLeafRollupContext({
                operatorId,
                parentOperatorId: operator.parentBookieId,
                originLeafOperatorId: operatorId,
                period,
                metrics,
            });
            totalLeafGrossProfit = round2(totalLeafGrossProfit + Number(directLeafContext.grossProfit || 0));
        }

        const nodeRollup = createParentSettlementContext({
            operatorId,
            parentOperatorId: operator.parentBookieId,
            period,
            directLeafContext,
            childContexts: childEdgeContexts,
        });

        if (!nodeRollup) {
            edgeContexts.set(operatorId, skippedContext(operatorId, operator.parentBookieId, period));
            continue;
        }

        rollupByOperator.set(operatorId, nodeRollup);

        const edgeInput = {
            ...nodeRollup,
            operatorId,
            parentOperatorId: operator.parentBookieId ? String(operator.parentBookieId) : null,
            remainingDistributableIn: round2(nodeRollup.remainingDistributableIn),
            idempotencyKey,
            settlementOrder: ++order,
            childSettlementIds: childEdgeContexts
                .map((c) => c.settlementId)
                .filter(Boolean),
        };

        const edgeResult = applyEdgeFormula(edgeInput, operator.commissionPercentage || 0);
        edgeResult.settlementOrder = order;
        assertEdgeContextValid(edgeResult);
        edgeContexts.set(operatorId, edgeResult);
    }

    const edges = postOrder.map((id) => edgeContexts.get(id)).filter(Boolean);
    const activeEdges = edges.filter((e) => e.status !== SETTLEMENT_STATUS.SKIPPED);
    const platformRemainder = round2(
        rootIds.reduce((sum, rootId) => {
            const ctx = edgeContexts.get(rootId);
            return sum + Number(ctx?.remainingDistributableOut ?? 0);
        }, 0),
    );

    assertMoneyConservationOrThrow({
        edges: activeEdges,
        platformRemainder,
        totalLeafGrossProfit,
    });

    return {
        edges,
        edgeContexts,
        platformRemainder,
        rollupByOperator,
        postOrder,
        operators,
        children,
        rootIds,
        totalLeafGrossProfit,
    };
}

export async function settleTreeBottomUpPreview({ rootOperatorId = null, period } = {}) {
    const built = await buildTreeEdgeContexts({ rootOperatorId, period, loadPersisted: false });
    return {
        contexts: built.edges,
        platformRemainder: built.platformRemainder,
        edges: built.edges.filter((e) => e.status !== SETTLEMENT_STATUS.SKIPPED),
        rollupByOperator: Object.fromEntries(built.rollupByOperator),
    };
}

async function persistSingleEdgeSettlement(edgeContext, actor, session) {
    if (!edgeContext || edgeContext.status === SETTLEMENT_STATUS.SKIPPED) {
        return edgeContext;
    }

    const existing = await findCompletedSettlementByIdempotencyKey(edgeContext.idempotencyKey, session);
    if (existing) {
        return existing;
    }

    let childWalletBefore = null;
    let childWalletAfter = null;
    let childLedgerTxId = null;
    let commissionPaymentId = null;

    if (edgeContext.actualCommission > 0) {
        const walletResult = await creditOperatorCommissionSettlement({
            operatorAdminId: edgeContext.operatorId,
            amount: edgeContext.actualCommission,
            description: `Bet commission ${edgeContext.commissionPercentage}% on ₹${edgeContext.totalBet} (actual ₹${edgeContext.actualCommission})`,
            referenceId: edgeContext.idempotencyKey,
            actor,
            session,
        });
        if (walletResult) {
            childWalletBefore = walletResult.previousBalance;
            childWalletAfter = walletResult.balance;
            childLedgerTxId = walletResult.ledgerTxId;
        }
    }

    if (edgeContext.actualCommission > 0 && actor) {
        const payment = await createCommissionPaymentRecord({
            bookieId: edgeContext.operatorId,
            amount: edgeContext.actualCommission,
            notes: `Engine V2 settlement | ${edgeContext.idempotencyKey}`,
            createdBy: actor._id || actor,
            session,
        });
        commissionPaymentId = payment._id;
    }

    const persisted = await persistSettlementRecord({
        context: { ...edgeContext, status: SETTLEMENT_STATUS.COMPLETED },
        walletSnapshot: {
            childWalletBefore,
            childWalletAfter,
            childLedgerTxId,
        },
        commissionPaymentId,
        settledBy: actor?._id || actor || null,
        session,
    });

    return persisted;
}

/**
 * Execute bottom-up settlement with atomic per-edge transactions.
 */
function refreshChildSettlementIds(operatorId, edgeContext, childrenMap, edgeContexts) {
    const childIds = childrenMap.get(operatorId) || [];
    return {
        ...edgeContext,
        childSettlementIds: childIds
            .map((cid) => edgeContexts.get(cid)?.settlementId)
            .filter(Boolean),
    };
}

export async function settleTreeBottomUp({
    rootOperatorId = null,
    period,
    actor = null,
} = {}) {
    const startedAt = Date.now();
    const built = await buildTreeEdgeContexts({ rootOperatorId, period, loadPersisted: false });
    const { postOrder, edgeContexts, children, rootIds, totalLeafGrossProfit } = built;
    const persistedEdges = [];

    for (const operatorId of postOrder) {
        const baseContext = edgeContexts.get(operatorId);
        if (!baseContext?.idempotencyKey) continue;
        if (baseContext.status === SETTLEMENT_STATUS.SKIPPED) continue;

        const edgeContext = refreshChildSettlementIds(
            operatorId,
            baseContext,
            children,
            edgeContexts,
        );

        const session = await mongoose.startSession();
        const edgeStartedAt = Date.now();
        try {
            let result;
            await session.withTransaction(async () => {
                const existing = await findCompletedSettlementByIdempotencyKey(
                    edgeContext.idempotencyKey,
                    session,
                );
                if (existing) {
                    result = existing;
                    logSettlementEdge({
                        phase: 'execute',
                        ...pickLogFields(existing),
                        idempotencyKey: edgeContext.idempotencyKey,
                        executionMs: Date.now() - edgeStartedAt,
                        status: 'idempotent_skip',
                        skipped: true,
                    });
                    return;
                }
                result = await persistSingleEdgeSettlement(edgeContext, actor, session);
                logSettlementEdge({
                    phase: 'execute',
                    ...pickLogFields(result),
                    idempotencyKey: edgeContext.idempotencyKey,
                    executionMs: Date.now() - edgeStartedAt,
                });
            });
            if (result) {
                edgeContexts.set(operatorId, result);
                persistedEdges.push(result);
            }
        } catch (error) {
            logSettlementError({ phase: 'execute', error, idempotencyKey: edgeContext.idempotencyKey });
            throw error;
        } finally {
            await session.endSession();
        }
    }

    await invalidateAdminReadCaches('commission_settlement');

    const active = persistedEdges.filter((e) => e.status !== SETTLEMENT_STATUS.SKIPPED);
    const platformRemainder = round2(
        rootIds.reduce((sum, rootId) => {
            const ctx = edgeContexts.get(rootId);
            return sum + Number(ctx?.remainingDistributableOut ?? 0);
        }, 0),
    );

    const totalActualCommission = round2(active.reduce((s, e) => s + Number(e.actualCommission || 0), 0));

    logSettlementSummary({
        phase: 'execute',
        rootOperatorId,
        edgeCount: active.length,
        platformRemainder,
        totalActualCommission,
        totalLeafGrossProfit,
        executionMs: Date.now() - startedAt,
    });

    return {
        contexts: persistedEdges,
        edges: active,
        platformRemainder,
        totalActualCommission,
        totalLeafGrossProfit,
    };
}

function pickLogFields(ctx) {
    if (!ctx) return {};
    return {
        settlementId: ctx.settlementId,
        parentOperatorId: ctx.parentOperatorId,
        childOperatorId: ctx.operatorId,
        originLeafOperatorId: ctx.originLeafOperatorId,
        totalBet: ctx.totalBet,
        grossProfit: ctx.grossProfit,
        calculatedCommission: ctx.calculatedCommission,
        actualCommission: ctx.actualCommission,
        remainingDistributableOut: ctx.remainingDistributableOut,
    };
}

/**
 * Settle a single Parent → Child edge (child subtree bottom-up first).
 */
export async function executeEdgeSettlement({
    parentOperatorId,
    childOperatorId,
    period,
    actor = null,
}) {
    return settleTreeBottomUp({
        rootOperatorId: childOperatorId,
        period,
        actor,
    });
}

export async function previewEdgeSettlement({ parentOperatorId, childOperatorId, period }) {
    const child = await loadOperator(childOperatorId);
    if (!child) {
        const err = new Error('Child operator not found');
        err.status = 404;
        throw err;
    }

    const result = await settleTreeBottomUpPreview({
        rootOperatorId: childOperatorId,
        period,
    });

    const childEdge = result.edges.find((e) => String(e.operatorId) === String(childOperatorId));
    return { context: childEdge || null, edges: result.edges };
}

export async function getOperatorSettlementSummary(operatorId, period) {
    const preview = await settleTreeBottomUpPreview({ rootOperatorId: operatorId, period });
    const selfEdge = preview.edges.find((e) => String(e.operatorId) === String(operatorId));
    const totalActualCommission = round2(
        (preview.edges || []).reduce((s, e) => s + Number(e.actualCommission || 0), 0),
    );
    return {
        preview: selfEdge,
        totalActualCommission,
        platformRemainder: preview.platformRemainder,
        edges: preview.edges,
    };
}
