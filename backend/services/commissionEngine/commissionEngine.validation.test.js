import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEdgeFormula, createLeafRollupContext } from './calculationService.js';
import {
    mergeChildContexts,
    createParentSettlementContext,
    buildIdempotencyKey,
} from './contextService.js';
import { SETTLEMENT_STATUS } from './constants.js';
import {
    simulateLeafEdge,
    simulateParentEdge,
    simulateTwoLevelTree,
} from './scenarioFixtures.js';
import {
    validateSettlementContextChain,
    assertParentContextHasNoLeafMetrics,
} from './invariants.js';
import {
    validateMoneyConservation,
    buildChildrenIndex,
    getRootOperatorIds,
    getOperatorChildren as getChildren,
} from './treeUtils.js';

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

// ---------------------------------------------------------------------------
// Scenario 1 — Bet 12000, Win 9000, Bookie 10%, SuperBookie 8%
// ---------------------------------------------------------------------------
test('Scenario 1 — full distribution equals gross profit 3000', () => {
    const { bookieEdge, superBookieEdge, platformRemainder, totalDistributed } = simulateTwoLevelTree({
        leafMetrics: { totalBet: 12000, playerWinning: 9000, grossProfit: 3000 },
        bookieRate: 10,
        superBookieRate: 8,
    });

    assert.equal(bookieEdge.actualCommission, 1200);
    assert.equal(superBookieEdge.actualCommission, 960);
    assert.equal(platformRemainder, 840);
    assert.equal(totalDistributed, 3000);

    const check = validateSettlementContextChain([bookieEdge, superBookieEdge]);
    assert.equal(check.valid, true, check.errors.join('; '));
});

// ---------------------------------------------------------------------------
// Scenario 2 — Loss cap: gross 200 only
// ---------------------------------------------------------------------------
test('Scenario 2 — loss caps bookie at 200, superbookie and admin get 0', () => {
    const { bookieEdge, superBookieEdge, platformRemainder, totalDistributed } = simulateTwoLevelTree({
        leafMetrics: { totalBet: 12000, playerWinning: 11800, grossProfit: 200 },
        bookieRate: 10,
        superBookieRate: 8,
    });

    assert.equal(bookieEdge.actualCommission, 200);
    assert.equal(bookieEdge.remainingDistributableOut, 0);
    assert.equal(superBookieEdge.actualCommission, 0);
    assert.equal(platformRemainder, 0);
    assert.equal(totalDistributed, 200);
});

// ---------------------------------------------------------------------------
// Scenario 3 — Multiple bookies roll-up
// ---------------------------------------------------------------------------
test('Scenario 3 — multiple bookie child contexts merge correctly', () => {
    const edgeA = simulateLeafEdge({
        operatorId: 'bookieA',
        parentOperatorId: 'super',
        metrics: { totalBet: 10000, playerWinning: 7000, grossProfit: 3000 },
        commissionPercentage: 10,
    });
    const edgeB = simulateLeafEdge({
        operatorId: 'bookieB',
        parentOperatorId: 'super',
        metrics: { totalBet: 5000, playerWinning: 4000, grossProfit: 1000 },
        commissionPercentage: 10,
    });

    assert.equal(edgeA.actualCommission, 1000);
    assert.equal(edgeA.remainingDistributableOut, 2000);
    assert.equal(edgeB.actualCommission, 500);
    assert.equal(edgeB.remainingDistributableOut, 500);

    const merged = mergeChildContexts([edgeA, edgeB], { operatorId: 'super' });
    assert.equal(merged.totalBet, 15000);
    assert.equal(merged.remainingDistributableIn, 2500);
    assert.equal(merged.playerWinning, 0);
    assert.equal(merged.grossProfit, 0);

    const parentCheck = assertParentContextHasNoLeafMetrics(merged);
    assert.equal(parentCheck.valid, true);

    const superEdge = simulateParentEdge({
        childEdges: [edgeA, edgeB],
        operatorId: 'super',
        commissionPercentage: 8,
    });
    assert.equal(superEdge.calculatedCommission, 1200);
    assert.equal(superEdge.actualCommission, 1200);
    assert.equal(superEdge.remainingDistributableOut, 1300);
    assert.equal(
        round2(edgeA.actualCommission + edgeB.actualCommission + superEdge.actualCommission + superEdge.remainingDistributableOut),
        4000,
    );
});

// ---------------------------------------------------------------------------
// SettlementContext invariants
// ---------------------------------------------------------------------------
test('invariants — totalBet preserved through parent merge', () => {
    const leaf = createLeafRollupContext({
        operatorId: 'b1',
        parentOperatorId: 'p1',
        originLeafOperatorId: 'b1',
        period: {},
        metrics: { totalBet: 12000, playerWinning: 9000, grossProfit: 3000 },
    });
    assert.equal(leaf.totalBet, 12000);

    const edge = applyEdgeFormula({ ...leaf, remainingDistributableIn: 3000 }, 10);
    const merged = mergeChildContexts([edge], { operatorId: 'p1' });
    assert.equal(merged.totalBet, 12000);
});

test('invariants — remainingDistributable never increases at edge', () => {
    const { bookieEdge, superBookieEdge } = simulateTwoLevelTree({
        leafMetrics: { totalBet: 12000, playerWinning: 9000, grossProfit: 3000 },
        bookieRate: 10,
        superBookieRate: 8,
    });
    assert.ok(bookieEdge.remainingDistributableOut <= bookieEdge.remainingDistributableIn);
    assert.ok(superBookieEdge.remainingDistributableOut <= superBookieEdge.remainingDistributableIn);
    assert.ok(bookieEdge.remainingDistributableOut >= 0);
    assert.ok(superBookieEdge.remainingDistributableOut >= 0);
});

test('createParentSettlementContext — combines direct leaf and children', () => {
    const child = simulateLeafEdge({
        operatorId: 'c1',
        metrics: { totalBet: 5000, playerWinning: 3000, grossProfit: 2000 },
        commissionPercentage: 10,
    });
    const directLeaf = createLeafRollupContext({
        operatorId: 'parent',
        parentOperatorId: null,
        originLeafOperatorId: 'parent',
        period: {},
        metrics: { totalBet: 3000, playerWinning: 1000, grossProfit: 2000 },
    });
    const rollup = createParentSettlementContext({
        operatorId: 'parent',
        parentOperatorId: null,
        period: {},
        directLeafContext: directLeaf,
        childContexts: [child],
    });
    assert.equal(rollup.totalBet, 8000);
    assert.equal(rollup.remainingDistributableIn, round2(2000 + child.remainingDistributableOut));
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------
test('idempotency key — unique per parent, child, period', () => {
    const period = {
        start: new Date('2026-06-25T00:00:00.000Z'),
        end: new Date('2026-06-25T18:29:59.999Z'),
    };
    const k1 = buildIdempotencyKey('p1', 'c1', period);
    const k2 = buildIdempotencyKey('p1', 'c2', period);
    const k3 = buildIdempotencyKey('platform', 'c1', period);
    assert.notEqual(k1, k2);
    assert.notEqual(k1, k3);
    assert.equal(k1, buildIdempotencyKey('p1', 'c1', period));
});

test('idempotency — duplicate key format matches settlement service contract', () => {
    const period = {
        start: new Date('2026-01-01T00:00:00.000Z'),
        end: new Date('2026-01-01T23:59:59.999Z'),
    };
    const key = buildIdempotencyKey('parentId', 'childId', period);
    assert.match(key, /^parentId:childId:/);
    assert.ok(key.includes(period.start.toISOString()));
});

// ---------------------------------------------------------------------------
// reportingService pure math (earned vs settled pending)
// ---------------------------------------------------------------------------
test('reporting — pending = earned - settled', () => {
    const earned = 1200;
    const settled = 500;
    const pending = round2(Math.max(0, earned - settled));
    assert.equal(pending, 700);
});

test('forbidden — % base is always totalBet not remainder', () => {
    const ctx = {
        operatorId: 'x',
        totalBet: 12000,
        remainingDistributableIn: 1800,
        remainingDistributableOut: 1800,
        originLeafOperatorId: 'x',
        childSettlementIds: [],
        status: SETTLEMENT_STATUS.PENDING,
    };
    const edge = applyEdgeFormula(ctx, 8);
    assert.equal(edge.calculatedCommission, 960);
    assert.notEqual(edge.calculatedCommission, round2(1800 * 0.08));
});

test('treeUtils — validateMoneyConservation passes balanced tree', () => {
    validateMoneyConservation({
        edges: [
            { actualCommission: 1200, status: 'completed' },
            { actualCommission: 960, status: 'completed' },
        ],
        platformRemainder: 840,
        totalLeafGrossProfit: 3000,
    });
});

test('treeUtils — validateMoneyConservation throws on violation', () => {
    assert.throws(
        () => validateMoneyConservation({
            edges: [{ actualCommission: 1200, status: 'completed' }],
            platformRemainder: 0,
            totalLeafGrossProfit: 3000,
        }),
        (err) => err.code === 'MONEY_CONSERVATION_VIOLATION',
    );
});

test('hierarchy — buildChildrenIndex single-pass tree', () => {
    const ops = [
        { _id: 'a', parentBookieId: null },
        { _id: 'b', parentBookieId: 'a' },
        { _id: 'c', parentBookieId: 'b' },
    ];
    const { operators, children } = buildChildrenIndex(ops);
    assert.equal(operators.size, 3);
    assert.deepEqual(getChildren('a', children), ['b']);
    assert.deepEqual(getRootOperatorIds(operators, children), ['a']);
});
