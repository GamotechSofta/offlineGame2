/**
 * Benchmark commission engine tree build + preview (no DB writes).
 * Usage: node scripts/benchmarkCommissionEngine.js [10|100|1000|5000]
 */
import { performance } from 'node:perf_hooks';
import { buildChildrenIndex, getPostOrderOperatorIds, getRootOperatorIds } from '../services/commissionEngine/treeUtils.js';
import { applyEdgeFormula } from '../services/commissionEngine/calculationService.js';
import { mergeChildContexts } from '../services/commissionEngine/contextService.js';

const SIZES = [10, 100, 1000, 5000];

function buildSyntheticForest(size) {
    const operators = [];
    for (let i = 0; i < size; i += 1) {
        const parentIndex = i === 0 ? null : Math.floor((i - 1) / 2);
        operators.push({
            _id: `op_${i}`,
            role: i % 3 === 0 ? 'bookie' : 'super_bookie',
            parentBookieId: parentIndex == null ? null : `op_${parentIndex}`,
            commissionPercentage: 5 + (i % 10),
            status: 'active',
        });
    }
    return operators;
}

function simulatePreviewOnIndex(index) {
    const postOrder = getPostOrderOperatorIds(index.children, index.rootIds);
    let aggregationCount = 0;
    const edges = [];

    for (const operatorId of postOrder) {
        const kids = index.children.get(operatorId) || [];
        const childEdges = kids.map((cid) => edges.find((e) => e.operatorId === cid)).filter(Boolean);
        let rollup;
        if (!kids.length) {
            aggregationCount += 1;
            rollup = {
                operatorId,
                totalBet: 1000,
                grossProfit: 200,
                remainingDistributableIn: 200,
                originLeafOperatorId: operatorId,
                childSettlementIds: [],
            };
        } else if (childEdges.length) {
            rollup = mergeChildContexts(childEdges, { operatorId });
        } else {
            continue;
        }
        const op = index.operators.get(operatorId);
        const edge = applyEdgeFormula(
            { ...rollup, remainingDistributableIn: rollup.remainingDistributableIn },
            op?.commissionPercentage || 0,
        );
        edges.push(edge);
    }

    return { postOrder, aggregationCount, edges };
}

function benchmarkSize(size) {
    const list = buildSyntheticForest(size);
    const t0 = performance.now();
    const { operators, children } = buildChildrenIndex(list);
    const rootIds = getRootOperatorIds(operators, children);
    const index = { operators, children, rootIds };
    const treeMs = performance.now() - t0;

    const t1 = performance.now();
    const { postOrder, aggregationCount, edges } = simulatePreviewOnIndex(index);
    const previewMs = performance.now() - t1;

    const mem = process.memoryUsage().heapUsed / 1024 / 1024;

    return {
        operators: size,
        treeMs: Math.round(treeMs * 100) / 100,
        previewMs: Math.round(previewMs * 100) / 100,
        postOrderNodes: postOrder.length,
        leafAggregations: aggregationCount,
        edges: edges.length,
        heapMb: Math.round(mem * 100) / 100,
        mongoQueries: 1,
    };
}

const arg = Number(process.argv[2]);
const sizes = Number.isFinite(arg) && arg > 0 ? [arg] : SIZES;

console.log('Commission Engine Benchmark (in-memory synthetic tree)');
console.log('─'.repeat(72));
for (const size of sizes) {
    const row = benchmarkSize(size);
    console.log(JSON.stringify(row));
}
