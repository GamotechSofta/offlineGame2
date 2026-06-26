/**
 * Mongo integration tests — requires mongodb-memory-server (devDependency).
 * Run: npm run test:commission:integration
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

let replSet;

async function seedLeafOperatorScenario({ grossProfitTarget = 3000 }) {
    const Admin = (await import('../../models/admin/admin.js')).default;
    const User = (await import('../../models/user/user.js')).default;
    const Bet = (await import('../../models/bet/bet.js')).default;
    const Market = (await import('../../models/market/market.js')).default;

    const parent = await Admin.create({
        username: `parent_${Date.now()}`,
        password: 'testpass1',
        role: 'bookie',
        commissionPercentage: 8,
        balance: 0,
        status: 'active',
    });
    const child = await Admin.create({
        username: `child_${Date.now()}`,
        password: 'testpass1',
        role: 'super_bookie',
        parentBookieId: parent._id,
        commissionPercentage: 10,
        balance: 0,
        status: 'active',
    });
    const market = await Market.create({
        marketName: `Test Market ${Date.now()}`,
        marketType: 'main',
        startingTime: '10:00',
        closingTime: '18:00',
    });
    const player = await User.create({
        username: `player_${Date.now()}`,
        email: `player_${Date.now()}@test.local`,
        password: 'testpass1',
        referredBy: child._id,
    });

    const betAmount = 12000;
    const payout = betAmount - grossProfitTarget;

    await Bet.create({
        userId: player._id,
        marketId: market._id,
        betType: 'single',
        betNumber: '123',
        amount: betAmount,
        status: 'won',
        payout,
        createdAt: new Date('2026-06-01T12:00:00.000Z'),
    });

    const period = {
        start: new Date('2026-06-01T00:00:00.000Z'),
        end: new Date('2026-06-01T23:59:59.999Z'),
    };

    return { parent, child, period };
}

test.before(async () => {
    replSet = await MongoMemoryReplSet.create({ replSets: 1 });
    await mongoose.connect(replSet.getUri());
});

test.after(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
});

test('integration — idempotent settlement does not double wallet credit', async () => {
    const Admin = (await import('../../models/admin/admin.js')).default;
    const CommissionSettlement = (await import('../../models/commission/commissionSettlement.js')).default;
    const CommissionPayment = (await import('../../models/commission/commissionPayment.js')).default;
    const BookieWalletTransaction = (await import('../../models/bookieWalletTransaction/bookieWalletTransaction.js')).default;
    const { settleTreeBottomUp } = await import('./settlementService.js');

    const { parent, child, period } = await seedLeafOperatorScenario({ grossProfitTarget: 3000 });
    const actor = { _id: parent._id };

    const first = await settleTreeBottomUp({ rootOperatorId: parent._id, period, actor });
    const second = await settleTreeBottomUp({ rootOperatorId: parent._id, period, actor });

    const childAfter = await Admin.findById(child._id).lean();
    const settlementCount = await CommissionSettlement.countDocuments({ periodStart: period.start });
    const paymentCount = await CommissionPayment.countDocuments({ bookieId: child._id });
    const ledgerCount = await BookieWalletTransaction.countDocuments({ adminId: child._id });

    const childEdge = first.edges.find((e) => String(e.operatorId) === String(child._id));
    assert.ok(childEdge?.actualCommission > 0);
    assert.equal(second.totalActualCommission, first.totalActualCommission);
    assert.equal(childAfter.balance, childEdge.actualCommission);
    assert.equal(paymentCount, 1);
    assert.equal(ledgerCount, 1);
    assert.ok(settlementCount >= 1);
});

test('integration — money conservation on preview', async () => {
    const { settleTreeBottomUpPreview } = await import('./settlementService.js');
    const { parent, period } = await seedLeafOperatorScenario({ grossProfitTarget: 3000 });

    const preview = await settleTreeBottomUpPreview({ rootOperatorId: parent._id, period });
    const totalActual = preview.edges.reduce((s, e) => s + Number(e.actualCommission || 0), 0);
    const distributed = totalActual + Number(preview.platformRemainder || 0);
    assert.ok(Math.abs(distributed - 3000) < 0.05);
});

test('integration — concurrent duplicate settlement requests', async () => {
    const { settleTreeBottomUp } = await import('./settlementService.js');
    const Admin = (await import('../../models/admin/admin.js')).default;
    const CommissionSettlement = (await import('../../models/commission/commissionSettlement.js')).default;

    const { parent, child, period } = await seedLeafOperatorScenario({ grossProfitTarget: 200 });
    const actor = { _id: parent._id };

    const results = await Promise.all([
        settleTreeBottomUp({ rootOperatorId: parent._id, period, actor }),
        settleTreeBottomUp({ rootOperatorId: parent._id, period, actor }),
    ]);

    const childAfter = await Admin.findById(child._id).lean();
    const keys = await CommissionSettlement.distinct('idempotencyKey', { childOperatorId: child._id });

    assert.equal(results[0].totalActualCommission, results[1].totalActualCommission);
    assert.ok(keys.length >= 1);
    assert.ok(childAfter.balance > 0);
});
