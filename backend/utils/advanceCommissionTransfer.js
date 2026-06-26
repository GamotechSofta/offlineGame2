import CommissionPayment from '../models/commission/commissionPayment.js';

export class InsufficientBookieBalanceError extends Error {
    constructor(message = 'Insufficient balance') {
        super(message);
        this.name = 'InsufficientBookieBalanceError';
        this.code = 'INSUFFICIENT_BOOKIE_BALANCE';
    }
}

/** Record advance commission credit (no wallet movement). */
export async function transferAdvanceCommissionToSuperBookie({
    superBookieId,
    amount,
    notes = '',
    createdById,
    isInitialBalance = false,
}) {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return null;

    const initial = isInitialBalance || /initial balance/i.test(String(notes || ''));

    return CommissionPayment.create({
        bookieId: superBookieId,
        amount: amt,
        notes: notes || (initial ? 'Initial advance from bookie' : 'Advance commission'),
        paymentType: 'advance',
        createdBy: createdById || superBookieId,
    });
}

/** Advance-paid opening advance — tracked as commission advance only. */
export async function transferAdvancePaidInitialBalanceToSuperBookie({
    superBookieId,
    amount,
    notes = '',
    createdById,
}) {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return null;

    return CommissionPayment.create({
        bookieId: superBookieId,
        amount: amt,
        notes: notes || 'Advance paid opening',
        paymentType: 'advance',
        createdBy: createdById || superBookieId,
    });
}

export async function transferAfterPaidInitialBalanceToSuperBookie(params) {
    return transferAdvancePaidInitialBalanceToSuperBookie(params);
}

export async function recordCommissionSettlementPaidWithAdvance({
    parentBookieId,
    superBookieId,
    amount,
    notes = '',
    createdById,
}) {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return null;

    const payment = await CommissionPayment.create({
        bookieId: superBookieId,
        amount: amt,
        notes: `${notes || 'Commission settlement'} | Paid with advance`,
        paymentType: 'settlement',
        createdBy: createdById || parentBookieId,
    });

    return { payment, parentBalanceAfter: 0, superBookieBalanceAfter: 0 };
}

export async function transferAdvanceCommissionFromAdmin({
    bookieId,
    amount,
    notes = '',
    createdById,
    isInitialBalance = false,
}) {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return null;

    const initial = isInitialBalance || /initial balance/i.test(String(notes || ''));

    return CommissionPayment.create({
        bookieId,
        amount: amt,
        notes: notes || (initial ? 'Advance from admin' : 'Advance commission from admin'),
        paymentType: 'advance',
        createdBy: createdById,
    });
}

export const ADVANCE_COMMISSION_WALLET_TYPES = [
    'advance_commission',
    'initial_balance',
    'advance_received',
    'advance_commission_from_admin',
];
