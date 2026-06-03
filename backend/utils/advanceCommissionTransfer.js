import Admin from '../models/admin/admin.js';
import CommissionPayment from '../models/commission/commissionPayment.js';
import { recordBookieWalletTransaction } from './bookieWalletLedger.js';
import { notifyBookiePanelBalances } from './notifyBookiePanelBalance.js';

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
 * Pay earned commission to super bookie after advance is recovered (earnings >= advance given).
 */
export async function transferCommissionSettlementToSuperBookie({
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
        notes: notes || 'Commission settlement',
        paymentType: 'settlement',
        createdBy: createdById || parentBookieId,
    });

    const sbBal =
        superBookieBalanceAfter != null
            ? Number(superBookieBalanceAfter)
            : Number((await Admin.findById(superBookieId).select('balance').lean())?.balance ?? 0);

    await recordBookieWalletTransaction({
        adminId: superBookieId,
        direction: 'credit',
        type: 'commission_settlement',
        amount: amt,
        balanceAfter: sbBal,
        description: `Commission settlement from bookie ${parentUsername || 'bookie'}`,
        referenceId: String(payment._id),
    });

    if (parentBalanceAfter != null && parentBookieId) {
        await recordBookieWalletTransaction({
            adminId: parentBookieId,
            direction: 'debit',
            type: 'commission_settlement',
            amount: amt,
            balanceAfter: Number(parentBalanceAfter),
            description: `Commission settlement to ${superBookieUsername || 'super bookie'}`,
            referenceId: String(payment._id),
        });
    }

    await notifyBookiePanelBalances([parentBookieId, superBookieId], 'commission_settlement');

    return payment;
}

export const ADVANCE_COMMISSION_WALLET_TYPES = [
    'advance_commission',
    'initial_balance',
    'advance_received',
];
