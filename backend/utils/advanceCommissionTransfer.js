import mongoose from 'mongoose';
import Admin from '../models/admin/admin.js';
import CommissionPayment from '../models/commission/commissionPayment.js';
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
}) {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return null;

    const payment = await CommissionPayment.create({
        bookieId: superBookieId,
        amount: amt,
        notes: notes || 'Advance commission',
        paymentType: 'advance',
        createdBy: createdById || parentBookieId,
    });

    const sbBal =
        superBookieBalanceAfter != null
            ? Number(superBookieBalanceAfter)
            : Number((await Admin.findById(superBookieId).select('balance').lean())?.balance ?? 0);

    await recordBookieWalletTransaction({
        adminId: superBookieId,
        direction: 'credit',
        type: 'advance_commission',
        amount: amt,
        balanceAfter: sbBal,
        description: `Advance commission from bookie ${parentUsername || 'bookie'}`,
        referenceId: String(payment._id),
    });

    if (parentBalanceAfter != null && parentBookieId) {
        await recordBookieWalletTransaction({
            adminId: parentBookieId,
            direction: 'debit',
            type: 'balance_adjustment',
            amount: amt,
            balanceAfter: Number(parentBalanceAfter),
            description: `Advance commission to ${superBookieUsername || 'super bookie'}`,
            referenceId: String(payment._id),
        });
    }

    await notifyBookiePanelBalances([parentBookieId, superBookieId], 'advance_commission_transfer');

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

export const ADVANCE_COMMISSION_WALLET_TYPES = [
    'advance_commission',
    'initial_balance',
    'advance_received',
];
