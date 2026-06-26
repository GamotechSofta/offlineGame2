import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEdgeFormula, createLeafRollupContext } from './calculationService.js';
import { mergeChildContexts } from './contextService.js';
import { SETTLEMENT_STATUS } from './constants.js';

test('applyEdgeFormula — standard two-level example (bookie 10%)', () => {
    const leaf = createLeafRollupContext({
        operatorId: 'bookie1',
        parentOperatorId: 'sb1',
        originLeafOperatorId: 'bookie1',
        period: {},
        metrics: { totalBet: 12000, playerWinning: 9000, grossProfit: 3000 },
    });

    const edge = applyEdgeFormula(
        { ...leaf, remainingDistributableIn: 3000 },
        10,
    );

    assert.equal(edge.calculatedCommission, 1200);
    assert.equal(edge.actualCommission, 1200);
    assert.equal(edge.remainingDistributableOut, 1800);
    assert.equal(edge.totalBet, 12000);
});

test('applyEdgeFormula — superbookie 8% capped by child remainder', () => {
    const childOut = {
        operatorId: 'sb1',
        parentOperatorId: null,
        originLeafOperatorId: 'bookie1',
        totalBet: 12000,
        remainingDistributableIn: 1800,
        remainingDistributableOut: 1800,
        playerWinning: 0,
        grossProfit: 0,
        childSettlementIds: [],
        status: SETTLEMENT_STATUS.PENDING,
    };

    const edge = applyEdgeFormula(childOut, 8);

    assert.equal(edge.calculatedCommission, 960);
    assert.equal(edge.actualCommission, 960);
    assert.equal(edge.remainingDistributableOut, 840);
});

test('applyEdgeFormula — loss caps commission at gross profit', () => {
    const leaf = createLeafRollupContext({
        operatorId: 'bookie1',
        parentOperatorId: 'sb1',
        originLeafOperatorId: 'bookie1',
        period: {},
        metrics: { totalBet: 12000, playerWinning: 11800, grossProfit: 200 },
    });

    const edge = applyEdgeFormula(
        { ...leaf, remainingDistributableIn: 200 },
        10,
    );

    assert.equal(edge.calculatedCommission, 1200);
    assert.equal(edge.actualCommission, 200);
    assert.equal(edge.remainingDistributableOut, 0);
});

test('mergeChildContexts — sums totalBet and remainders', () => {
    const a = applyEdgeFormula(
        {
            operatorId: 'b1',
            totalBet: 5000,
            remainingDistributableIn: 1000,
            remainingDistributableOut: 1000,
            originLeafOperatorId: 'b1',
            childSettlementIds: [],
            status: SETTLEMENT_STATUS.COMPLETED,
        },
        10,
    );
    const b = applyEdgeFormula(
        {
            operatorId: 'b2',
            totalBet: 7000,
            remainingDistributableIn: 800,
            remainingDistributableOut: 800,
            originLeafOperatorId: 'b2',
            childSettlementIds: [],
            status: SETTLEMENT_STATUS.COMPLETED,
        },
        10,
    );

    const merged = mergeChildContexts([a, b], { operatorId: 'parent' });
    assert.equal(merged.totalBet, 12000);
    assert.equal(merged.remainingDistributableIn, 600);
    assert.equal(a.remainingDistributableOut + b.remainingDistributableOut, 600);
});

test('buildIdempotencyKey — stable for same parent, child, period', async () => {
    const { buildIdempotencyKey } = await import('./contextService.js');
    const period = {
        start: new Date('2026-06-25T00:00:00.000Z'),
        end: new Date('2026-06-25T18:29:59.999Z'),
    };
    const a = buildIdempotencyKey('parent1', 'child1', period);
    const b = buildIdempotencyKey('parent1', 'child1', period);
    assert.equal(a, b);
    assert.match(a, /^parent1:child1:/);
});

test('forbidden — commission never uses remaining as percentage base', () => {
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
    assert.notEqual(edge.calculatedCommission, 144);
    assert.equal(edge.calculatedCommission, 960);
});
