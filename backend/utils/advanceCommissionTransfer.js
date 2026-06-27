import mongoose from 'mongoose';
import Admin from '../models/admin/admin.js';
import CommissionPayment from '../models/commission/commissionPayment.js';
import BookieWalletTransaction from '../models/bookieWalletTransaction/bookieWalletTransaction.js';
import { recordBookieWalletTransaction } from './bookieWalletLedger.js';
import { notifyBookiePanelBalances } from './notifyBookiePanelBalance.js';
import { invalidateAdminReadCaches } from '../services/cacheInvalidationService.js';

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

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

/**
 * Paid with other: child Bookie wallet −, SuperBookie wallet + (partial supported).
 */
export async function recordCommissionSettlementPaidWithOther({
    parentBookieId,
    parentUsername,
    superBookieId,
    superBookieUsername,
    amount,
    notes = '',
    createdById,
}) {
    const amt = round2(Number(amount));
    if (!Number.isFinite(amt) || amt <= 0) return null;

    const session = await mongoose.startSession();
    session.startTransaction();

    let payment;
    let parentBalanceAfter = 0;
    let superBookieBalanceAfter = 0;
    let parentName = parentUsername || 'SuperBookie';
    let superName = superBookieUsername || 'bookie';

    try {
        const superBookie = await Admin.findOneAndUpdate(
            { _id: superBookieId, role: 'super_bookie', parentBookieId, balance: { $gte: amt } },
            { $inc: { balance: -amt } },
            { new: true, session },
        )
            .select('balance username')
            .lean();

        if (!superBookie) {
            throw new InsufficientBookieBalanceError(
                'Insufficient child bookie wallet balance for settlement',
            );
        }

        const parent = await Admin.findOneAndUpdate(
            { _id: parentBookieId, role: 'bookie' },
            { $inc: { balance: amt } },
            { new: true, session },
        )
            .select('balance username')
            .lean();

        if (!parent) {
            throw new Error('SuperBookie account not found');
        }

        parentBalanceAfter = Number(parent.balance ?? 0);
        superBookieBalanceAfter = Number(superBookie.balance ?? 0);
        parentName = parent.username || parentName;
        superName = superBookie.username || superName;

        const settlementNotes = `${notes || 'Commission settlement'} | Paid with other`;

        const [created] = await CommissionPayment.create(
            [{
                bookieId: superBookieId,
                amount: amt,
                notes: settlementNotes,
                paymentType: 'settlement',
                createdBy: createdById || parentBookieId,
            }],
            { session },
        );
        payment = created;

        await session.commitTransaction();
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }

    const superTx = await recordBookieWalletTransaction({
        adminId: superBookieId,
        direction: 'debit',
        type: 'commission_settlement_other',
        amount: amt,
        balanceAfter: superBookieBalanceAfter,
        description: `Commission paid to SuperBookie ${parentName} (paid with other)`,
        referenceId: String(payment._id),
    });

    const parentTx = await recordBookieWalletTransaction({
        adminId: parentBookieId,
        direction: 'credit',
        type: 'commission_received_from_super',
        amount: amt,
        balanceAfter: parentBalanceAfter,
        description: `Commission received from bookie ${superName} (paid with other)`,
        referenceId: String(payment._id),
    });

    if (!superTx || !parentTx) {
        await CommissionPayment.findByIdAndDelete(payment._id);
        if (superTx) await BookieWalletTransaction.deleteMany({ _id: superTx._id });
        if (parentTx) await BookieWalletTransaction.deleteMany({ _id: parentTx._id });
        await Admin.findByIdAndUpdate(superBookieId, { $inc: { balance: amt } });
        await Admin.findByIdAndUpdate(parentBookieId, { $inc: { balance: -amt } });
        throw new Error('Failed to record paid-with-other settlement');
    }

    await notifyBookiePanelBalances(
        [parentBookieId, superBookieId],
        'commission_settlement_paid_with_other',
    );
    await invalidateAdminReadCaches('commission_settlement');

    return {
        payment,
        appliedPayment: amt,
        parentBalanceAfter,
        superBookieBalanceAfter,
    };
}

/**
 * Admin collects platform share: SuperBookie wallet −, Admin wallet + (partial supported).
 */
export async function recordAdminCommissionSettlementFromSuperBookie({
    adminId,
    adminUsername,
    superBookieId,
    superBookieUsername,
    amount,
    notes = '',
    createdById,
}) {
    const amt = round2(Number(amount));
    if (!Number.isFinite(amt) || amt <= 0) return null;

    const session = await mongoose.startSession();
    session.startTransaction();

    let payment;
    let adminBalanceAfter = 0;
    let superBookieBalanceAfter = 0;
    let adminName = adminUsername || 'Admin';
    let superName = superBookieUsername || 'SuperBookie';

    try {
        const superBookie = await Admin.findOneAndUpdate(
            { _id: superBookieId, role: 'bookie', balance: { $gte: amt } },
            { $inc: { balance: -amt } },
            { new: true, session },
        )
            .select('balance username')
            .lean();

        if (!superBookie) {
            throw new InsufficientBookieBalanceError(
                'Insufficient SuperBookie wallet balance for settlement',
            );
        }

        const admin = await Admin.findOneAndUpdate(
            { _id: adminId, role: { $in: ['super_admin', 'admin'] } },
            { $inc: { balance: amt } },
            { new: true, session },
        )
            .select('balance username')
            .lean();

        if (!admin) {
            throw new Error('Admin account not found');
        }

        adminBalanceAfter = Number(admin.balance ?? 0);
        superBookieBalanceAfter = Number(superBookie.balance ?? 0);
        adminName = admin.username || adminName;
        superName = superBookie.username || superName;

        const settlementNotes = `${notes || 'Commission settlement'} | Paid to admin`;

        const [created] = await CommissionPayment.create(
            [{
                bookieId: superBookieId,
                amount: amt,
                notes: settlementNotes,
                paymentType: 'settlement',
                createdBy: createdById || adminId,
            }],
            { session },
        );
        payment = created;

        await session.commitTransaction();
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }

    const superTx = await recordBookieWalletTransaction({
        adminId: superBookieId,
        direction: 'debit',
        type: 'commission_settlement_other',
        amount: amt,
        balanceAfter: superBookieBalanceAfter,
        description: `Commission paid to admin ${adminName}`,
        referenceId: String(payment._id),
    });

    const adminTx = await recordBookieWalletTransaction({
        adminId: adminId,
        direction: 'credit',
        type: 'commission_received_from_super',
        amount: amt,
        balanceAfter: adminBalanceAfter,
        description: `Commission received from SuperBookie ${superName}`,
        referenceId: String(payment._id),
    });

    if (!superTx || !adminTx) {
        await CommissionPayment.findByIdAndDelete(payment._id);
        if (superTx) await BookieWalletTransaction.deleteMany({ _id: superTx._id });
        if (adminTx) await BookieWalletTransaction.deleteMany({ _id: adminTx._id });
        await Admin.findByIdAndUpdate(superBookieId, { $inc: { balance: amt } });
        await Admin.findByIdAndUpdate(adminId, { $inc: { balance: -amt } });
        throw new Error('Failed to record admin settlement');
    }

    await notifyBookiePanelBalances(
        [adminId, superBookieId],
        'commission_settlement',
    );
    await invalidateAdminReadCaches('commission_settlement');

    return {
        payment,
        appliedPayment: amt,
        adminBalanceAfter,
        superBookieBalanceAfter,
    };
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
