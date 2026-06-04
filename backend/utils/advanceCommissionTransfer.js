import mongoose from 'mongoose';
import Admin from '../models/admin/admin.js';
import CommissionPayment from '../models/commission/commissionPayment.js';
import BookieWalletTransaction from '../models/bookieWalletTransaction/bookieWalletTransaction.js';
import { recordBookieWalletTransaction } from './bookieWalletLedger.js';
import { notifyBookiePanelBalance, notifyBookiePanelBalances } from './notifyBookiePanelBalance.js';

export class InsufficientBookieBalanceError extends Error {
    constructor(message = 'Insufficient bookie balance to settle commission') {
        super(message);
        this.name = 'InsufficientBookieBalanceError';
        this.code = 'INSUFFICIENT_BOOKIE_BALANCE';
    }
}

/**
 * Credit super bookie balance and record advance commission (initial, pay, or manual add).
 */
export async function transferAdvanceCommissionToSuperBookie({
    parentBookieId,
    parentUsername,
    superBookieId,
    superBookieUsername,
    amount,
    notes = '',
    createdById,
    parentBalanceAfter = null,
    superBookieBalanceAfter = null,
    isInitialBalance = false,
}) {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return null;

    const initial =
        isInitialBalance || /initial balance/i.test(String(notes || ''));

    const payment = await CommissionPayment.create({
        bookieId: superBookieId,
        amount: amt,
        notes: notes || (initial ? 'Initial balance from bookie' : 'Advance commission'),
        paymentType: 'advance',
        createdBy: createdById || parentBookieId,
    });

    const sbBal =
        superBookieBalanceAfter != null
            ? Number(superBookieBalanceAfter)
            : Number((await Admin.findById(superBookieId).select('balance').lean())?.balance ?? 0);

    const superTx = await recordBookieWalletTransaction({
        adminId: superBookieId,
        direction: 'credit',
        type: initial ? 'initial_balance' : 'advance_commission',
        amount: amt,
        balanceAfter: sbBal,
        description: initial
            ? `Initial balance from bookie ${parentUsername || 'bookie'}`
            : `Advance commission from bookie ${parentUsername || 'bookie'}`,
        referenceId: String(payment._id),
    });

    if (!superTx) {
        await CommissionPayment.findByIdAndDelete(payment._id);
        throw new Error('Failed to record super bookie wallet transaction');
    }

    if (parentBalanceAfter != null && parentBookieId) {
        const parentTx = await recordBookieWalletTransaction({
            adminId: parentBookieId,
            direction: 'debit',
            type: initial ? 'initial_balance_allocated' : 'balance_adjustment',
            amount: amt,
            balanceAfter: Number(parentBalanceAfter),
            description: initial
                ? `Initial balance allocated to ${superBookieUsername || 'super bookie'}`
                : `Advance commission to ${superBookieUsername || 'super bookie'}`,
            referenceId: String(payment._id),
        });
        if (!parentTx) {
            await BookieWalletTransaction.deleteMany({ referenceId: String(payment._id) });
            await CommissionPayment.findByIdAndDelete(payment._id);
            throw new Error('Failed to record parent bookie wallet transaction');
        }
    }

    await notifyBookiePanelBalances(
        [parentBookieId, superBookieId],
        initial ? 'super_bookie_initial_balance' : 'advance_commission_transfer',
    );

    return payment;
}

/**
 * Deduct parent bookie wallet, credit super bookie wallet, record commission payment + ledger.
 */
async function transferCommissionWalletToSuperBookie({
    parentBookieId,
    parentUsername,
    superBookieId,
    superBookieUsername,
    amount,
    notes,
    createdById,
    paymentType,
    creditDescription,
    debitDescription,
    notifyReason,
}) {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return null;

    const session = await mongoose.startSession();
    session.startTransaction();

    let payment;
    let parentBalanceAfter = 0;
    let superBookieBalanceAfter = 0;
    let parentName = parentUsername || 'bookie';
    let superName = superBookieUsername || 'super bookie';

    try {
        const parent = await Admin.findOneAndUpdate(
            { _id: parentBookieId, role: 'bookie', balance: { $gte: amt } },
            { $inc: { balance: -amt } },
            { new: true, session },
        )
            .select('balance username')
            .lean();

        if (!parent) {
            throw new InsufficientBookieBalanceError();
        }

        const superBookie = await Admin.findOneAndUpdate(
            { _id: superBookieId, role: 'super_bookie', parentBookieId },
            { $inc: { balance: amt } },
            { new: true, session },
        )
            .select('balance username')
            .lean();

        if (!superBookie) {
            throw new Error('Super bookie not found');
        }

        parentBalanceAfter = Number(parent.balance ?? 0);
        superBookieBalanceAfter = Number(superBookie.balance ?? 0);
        parentName = parent.username || parentName;
        superName = superBookie.username || superName;

        const [created] = await CommissionPayment.create(
            [
                {
                    bookieId: superBookieId,
                    amount: amt,
                    notes,
                    paymentType,
                    createdBy: createdById || parentBookieId,
                },
            ],
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

    await recordBookieWalletTransaction({
        adminId: superBookieId,
        direction: 'credit',
        type: 'commission_settlement',
        amount: amt,
        balanceAfter: superBookieBalanceAfter,
        description: creditDescription.replace('{parent}', parentName).replace('{super}', superName),
        referenceId: String(payment._id),
    });

    await recordBookieWalletTransaction({
        adminId: parentBookieId,
        direction: 'debit',
        type: 'commission_settlement',
        amount: amt,
        balanceAfter: parentBalanceAfter,
        description: debitDescription.replace('{parent}', parentName).replace('{super}', superName),
        referenceId: String(payment._id),
    });

    await Promise.all([
        notifyBookiePanelBalance(parentBookieId, notifyReason, parentBalanceAfter),
        notifyBookiePanelBalance(superBookieId, notifyReason, superBookieBalanceAfter),
    ]);

    return {
        payment,
        parentBalanceAfter,
        superBookieBalanceAfter,
    };
}

/** Cash commission payout after advance is recovered. */
export async function transferCommissionSettlementToSuperBookie(params) {
    return transferCommissionWalletToSuperBookie({
        ...params,
        paymentType: 'settlement',
        notes: params.notes || 'Commission settlement',
        creditDescription: 'Commission settlement from bookie {parent}',
        debitDescription: 'Commission settlement to {super}',
        notifyReason: 'commission_settlement',
    });
}

/** Bet commission applied to advance recovery — still moves cash parent → super bookie. */
export async function transferBetCommissionRecoveryToSuperBookie(params) {
    return transferCommissionWalletToSuperBookie({
        ...params,
        paymentType: 'recovery',
        notes: params.notes || 'Bet commission applied to advance recovery',
        creditDescription: 'Bet commission recovery from bookie {parent}',
        debitDescription: 'Bet commission recovery to {super}',
        notifyReason: 'commission_recovery_settled',
    });
}

/** Admin credits parent bookie wallet (initial balance / top-up). */
export async function transferAdvanceCommissionFromAdmin({
    bookieId,
    amount,
    notes = '',
    createdById,
    bookieBalanceAfter = null,
    isInitialBalance = false,
}) {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return null;

    const initial =
        isInitialBalance || /initial balance/i.test(String(notes || ''));

    const payment = await CommissionPayment.create({
        bookieId,
        amount: amt,
        notes: notes || (initial ? 'Initial balance from admin' : 'Advance commission from admin'),
        paymentType: 'advance',
        createdBy: createdById,
    });

    const bal =
        bookieBalanceAfter != null
            ? Number(bookieBalanceAfter)
            : Number((await Admin.findById(bookieId).select('balance').lean())?.balance ?? 0);

    const tx = await recordBookieWalletTransaction({
        adminId: bookieId,
        direction: 'credit',
        type: initial ? 'initial_balance' : 'advance_commission_from_admin',
        amount: amt,
        balanceAfter: bal,
        description: initial ? 'Initial balance from admin' : 'Advance commission from admin',
        referenceId: String(payment._id),
    });

    if (!tx) {
        await CommissionPayment.findByIdAndDelete(payment._id);
        throw new Error('Failed to record bookie wallet transaction from admin');
    }

    await notifyBookiePanelBalance(bookieId, 'advance_commission_from_admin', bal);
    return payment;
}

export const ADVANCE_COMMISSION_WALLET_TYPES = [
    'advance_commission',
    'initial_balance',
    'advance_received',
    'advance_commission_from_admin',
];
