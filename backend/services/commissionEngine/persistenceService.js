import CommissionSettlement from '../../models/commission/commissionSettlement.js';
import CommissionPayment from '../../models/commission/commissionPayment.js';
import { SETTLEMENT_STATUS } from './constants.js';
import { settlementContextToDocument, documentToSettlementContext } from './contextService.js';

export async function findSettlementByIdempotencyKey(idempotencyKey, session = null) {
    let q = CommissionSettlement.findOne({ idempotencyKey });
    if (session) q = q.session(session);
    const doc = await q.lean();
    return doc ? documentToSettlementContext(doc) : null;
}

export async function findCompletedSettlementByIdempotencyKey(idempotencyKey, session = null) {
    let q = CommissionSettlement.findOne({
        idempotencyKey,
        status: SETTLEMENT_STATUS.COMPLETED,
    });
    if (session) q = q.session(session);
    const doc = await q.lean();
    return doc ? documentToSettlementContext(doc) : null;
}

export async function loadChildSettlementsForParent(parentOperatorId, period, session = null) {
    const query = {
        parentOperatorId: parentOperatorId || null,
        periodStart: period.start,
        periodEnd: period.end,
        status: SETTLEMENT_STATUS.COMPLETED,
    };
    let q = CommissionSettlement.find(query).sort({ settlementOrder: 1 });
    if (session) q = q.session(session);
    const docs = await q.lean();
    return docs.map(documentToSettlementContext);
}

export async function persistSettlementRecord({
    context,
    walletSnapshot = {},
    commissionPaymentId = null,
    settledBy = null,
    session = null,
}) {
    const payload = settlementContextToDocument(context, {
        ...walletSnapshot,
        commissionPaymentId,
        settledBy,
        settledAt: new Date(),
        status: context.status || SETTLEMENT_STATUS.COMPLETED,
    });

    const options = session ? { session } : {};
    try {
        const [doc] = await CommissionSettlement.create([payload], options);
        return documentToSettlementContext(doc);
    } catch (error) {
        if (error?.code === 11000 && context.idempotencyKey) {
            const existing = await findCompletedSettlementByIdempotencyKey(context.idempotencyKey, session);
            if (existing) return existing;
        }
        throw error;
    }
}

export async function createCommissionPaymentRecord({
    bookieId,
    amount,
    notes,
    createdBy,
    session = null,
}) {
    const options = session ? { session } : {};
    const [payment] = await CommissionPayment.create(
        [{
            bookieId,
            amount,
            notes: notes || 'Commission settlement (engine V2)',
            paymentType: 'settlement',
            createdBy,
        }],
        options,
    );
    return payment;
}
