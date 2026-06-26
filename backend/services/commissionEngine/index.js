import { applyEdgeFormula, createLeafRollupContext } from './calculationService.js';
import {
    mergeChildContexts,
    createParentSettlementContext,
    buildIdempotencyKey,
    settlementContextToDocument,
    documentToSettlementContext,
} from './contextService.js';
import { aggregateLeafMetrics } from './metricsService.js';
import {
    buildOperatorTree,
    getDirectChildOperators,
    getTopLevelOperators,
    hasDirectPlayers,
    isOperatorAccount,
    loadOperator,
    loadActiveOperatorIndex,
    getOperatorTree,
    getOperatorChildrenIds,
    getOperatorAncestorIds,
    getOperatorDescendantIds,
    getLeafOperatorIds,
    getOperatorChildren,
    getOperatorAncestors,
    getOperatorDescendants,
    batchOperatorsWithDirectPlayers,
} from './hierarchyService.js';
import {
    settleTreeBottomUpPreview,
    previewEdgeSettlement,
    executeEdgeSettlement,
    settleTreeBottomUp,
    getOperatorSettlementSummary,
} from './settlementService.js';
import { parseSettlementPeriod, assertValidPeriod } from './periodUtils.js';
import {
    findSettlementByIdempotencyKey,
    findCompletedSettlementByIdempotencyKey,
} from './persistenceService.js';
import {
    getOperatorCommissionReport,
    getOperatorEarnedCommission,
    aggregateSettledCommissionForOperator,
    getPlatformRemainderReport,
} from './reportingService.js';
import {
    assertEdgeContextValid,
    assertMoneyConservationOrThrow,
    validateSettlementContextChain,
} from './invariants.js';
import { validateMoneyConservation } from './treeUtils.js';
import { logSettlementEdge, logSettlementSummary } from './settlementLogger.js';

export {
    applyEdgeFormula,
    createLeafRollupContext,
    mergeChildContexts,
    createParentSettlementContext,
    buildIdempotencyKey,
    settlementContextToDocument,
    documentToSettlementContext,
    aggregateLeafMetrics,
    buildOperatorTree,
    getDirectChildOperators,
    getTopLevelOperators,
    hasDirectPlayers,
    isOperatorAccount,
    loadOperator,
    settleTreeBottomUpPreview,
    previewEdgeSettlement,
    executeEdgeSettlement,
    settleTreeBottomUp,
    getOperatorSettlementSummary,
    parseSettlementPeriod,
    assertValidPeriod,
    findSettlementByIdempotencyKey,
    findCompletedSettlementByIdempotencyKey,
    getOperatorCommissionReport,
    getOperatorEarnedCommission,
    aggregateSettledCommissionForOperator,
    getPlatformRemainderReport,
    loadActiveOperatorIndex,
    getOperatorTree,
    getOperatorChildrenIds,
    getOperatorAncestorIds,
    getOperatorDescendantIds,
    getLeafOperatorIds,
    getOperatorChildren,
    getOperatorAncestors,
    getOperatorDescendants,
    batchOperatorsWithDirectPlayers,
    assertEdgeContextValid,
    assertMoneyConservationOrThrow,
    validateSettlementContextChain,
    validateMoneyConservation,
    logSettlementEdge,
    logSettlementSummary,
};

export default {
    previewTree: settleTreeBottomUpPreview,
    previewEdge: previewEdgeSettlement,
    executeTree: settleTreeBottomUp,
    executeEdge: executeEdgeSettlement,
    getOperatorSummary: getOperatorSettlementSummary,
    parseSettlementPeriod,
    applyEdgeFormula,
    mergeChildContexts,
    createParentSettlementContext,
    aggregateLeafMetrics,
};
