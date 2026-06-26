import Admin from '../../models/admin/admin.js';
import { recordBookieWalletTransaction } from '../../utils/bookieWalletLedger.js';
import { isBookiePanelRole } from '../../utils/adminRoles.js';

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

/**
 * Credit operator wallet for commission earned (bet settlement).
 * Wallet updates only via settlementService transactions.
 */
export async function creditOperatorCommissionSettlement({
    operatorAdminId,
    amount,
    description,
    referenceId = '',
    actor = null,
    session = null,
}) {
    const numAmount = round2(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
        return null;
    }

    const operator = await Admin.findById(operatorAdminId)
        .select('username role balance status')
        .session(session);
    if (!operator || !isBookiePanelRole(operator) || operator.status !== 'active') {
        const err = new Error('Operator wallet account not found');
        err.status = 404;
        throw err;
    }

    const previousBalance = round2(operator.balance || 0);
    const newBalance = round2(previousBalance + numAmount);
    operator.balance = newBalance;

    const ledgerDoc = await recordBookieWalletTransaction({
        adminId: operator._id,
        direction: 'credit',
        type: 'commission_bet_settlement',
        amount: numAmount,
        balanceAfter: newBalance,
        description: description || `Commission settlement ₹${numAmount}`,
        referenceId: String(referenceId || ''),
        meta: actor ? { performedBy: String(actor._id || actor) } : null,
        session,
    });

    await operator.save(session ? { session } : undefined);

    return {
        adminId: operator._id,
        previousBalance,
        balance: newBalance,
        amount: numAmount,
        ledgerTxId: ledgerDoc?._id || null,
    };
}
