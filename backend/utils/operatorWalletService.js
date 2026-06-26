import mongoose from 'mongoose';
import Admin from '../models/admin/admin.js';
import BookieWalletTransaction from '../models/bookieWalletTransaction/bookieWalletTransaction.js';
import { recordBookieWalletTransaction } from './bookieWalletLedger.js';
import { isBookiePanelRole } from './adminRoles.js';
import { logActivity, getClientIp } from './activityLogger.js';
import { invalidateAdminReadCaches } from '../services/cacheInvalidationService.js';

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

const getActorLabel = (admin) => {
    if (admin?.role === 'bookie') return 'SuperBookie';
    if (admin?.role === 'super_bookie') return 'Bookie';
    if (admin?.role === 'super_admin') return 'Admin';
    return 'Admin';
};

/**
 * Credit or debit an operator account (SuperBookie / Bookie) wallet balance.
 */
export async function adjustOperatorWallet({
    targetAdminId,
    amount,
    type,
    actor,
    description,
    txType = 'balance_adjustment',
    req = null,
}) {
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
        const err = new Error('Amount must be a positive number');
        err.status = 400;
        throw err;
    }
    if (type !== 'credit' && type !== 'debit') {
        const err = new Error('type must be credit or debit');
        err.status = 400;
        throw err;
    }

    const target = await Admin.findById(targetAdminId).select('username role balance status');
    if (!target) {
        const err = new Error('Account not found');
        err.status = 404;
        throw err;
    }
    if (target.status !== 'active') {
        const err = new Error('Cannot adjust wallet for a suspended account');
        err.status = 400;
        throw err;
    }

    const previousBalance = round2(target.balance || 0);
    let newBalance = previousBalance;

    if (type === 'credit') {
        newBalance = round2(previousBalance + numAmount);
    } else if (previousBalance < numAmount) {
        const err = new Error('Insufficient wallet balance');
        err.status = 400;
        throw err;
    } else {
        newBalance = round2(previousBalance - numAmount);
    }

    target.balance = newBalance;
    await target.save();

    const actorLabel = getActorLabel(actor);
    const finalDescription =
        description
        || `${actorLabel} ${type}: ₹${numAmount.toLocaleString('en-IN')}`;

    await recordBookieWalletTransaction({
        adminId: target._id,
        direction: type,
        type: txType,
        amount: numAmount,
        balanceAfter: newBalance,
        description: finalDescription,
        meta: actor
            ? { performedBy: String(actor._id), performedByRole: actor.role, performedByName: actor.username }
            : null,
    });

    if (req && actor) {
        await logActivity({
            action: 'operator_wallet_adjust',
            performedBy: actor.username,
            performedByType: actor.role || 'admin',
            targetType: target.role === 'bookie' ? 'bookie' : 'super_bookie',
            targetId: String(target._id),
            details: `Wallet ${type} ₹${numAmount} for "${target.username}" (${finalDescription})`,
            meta: { targetAdminId: String(target._id), amount: numAmount, type, balanceAfter: newBalance },
            ip: getClientIp(req),
        });
    }

    await invalidateAdminReadCaches('operator_wallet_adjust');

    return {
        adminId: target._id,
        username: target.username,
        role: target.role,
        balance: newBalance,
        previousBalance,
        amount: numAmount,
        type,
    };
}

/**
 * SuperBookie ↔ child Bookie wallet transfer (mirrored on parent balance).
 * Child credit  => parent debit + child credit
 * Child debit   => child debit + parent credit
 */
export async function adjustChildWalletWithParentMirror({
    parentAdminId,
    childAdminId,
    amount,
    type,
    actor,
    req = null,
    note = '',
}) {
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
        const err = new Error('Amount must be a positive number');
        err.status = 400;
        throw err;
    }
    if (type !== 'credit' && type !== 'debit') {
        const err = new Error('type must be credit or debit');
        err.status = 400;
        throw err;
    }

    const session = await mongoose.startSession();
    let childResult = null;

    try {
        await session.withTransaction(async () => {
            const [parent, child] = await Promise.all([
                Admin.findById(parentAdminId).select('username role balance status').session(session),
                Admin.findById(childAdminId).select('username role balance status parentBookieId').session(session),
            ]);

            if (!parent || parent.role !== 'bookie') {
                const err = new Error('SuperBookie account not found');
                err.status = 404;
                throw err;
            }
            if (!child || child.role !== 'super_bookie' || String(child.parentBookieId) !== String(parent._id)) {
                const err = new Error('Bookie account not found');
                err.status = 404;
                throw err;
            }
            if (parent.status !== 'active' || child.status !== 'active') {
                const err = new Error('Cannot adjust wallet for a suspended account');
                err.status = 400;
                throw err;
            }

            const parentBal = round2(parent.balance || 0);
            const childBal = round2(child.balance || 0);
            const noteSuffix = note?.trim() ? ` — ${note.trim()}` : '';

            if (type === 'credit') {
                if (parentBal < numAmount) {
                    const err = new Error('Insufficient SuperBookie wallet balance');
                    err.status = 400;
                    throw err;
                }
                parent.balance = round2(parentBal - numAmount);
                child.balance = round2(childBal + numAmount);

                await recordBookieWalletTransaction({
                    adminId: parent._id,
                    direction: 'debit',
                    type: 'initial_balance_allocated',
                    amount: numAmount,
                    balanceAfter: parent.balance,
                    description: `Allocated to bookie "${child.username}"${noteSuffix}`,
                    meta: { childAdminId: String(child._id), performedBy: String(actor?._id || '') },
                    session,
                });
                await recordBookieWalletTransaction({
                    adminId: child._id,
                    direction: 'credit',
                    type: 'advance_received',
                    amount: numAmount,
                    balanceAfter: child.balance,
                    description: `Received from SuperBookie "${parent.username}"${noteSuffix}`,
                    meta: { parentAdminId: String(parent._id), performedBy: String(actor?._id || '') },
                    session,
                });
            } else {
                if (childBal < numAmount) {
                    const err = new Error('Insufficient wallet balance');
                    err.status = 400;
                    throw err;
                }
                child.balance = round2(childBal - numAmount);
                parent.balance = round2(parentBal + numAmount);

                await recordBookieWalletTransaction({
                    adminId: child._id,
                    direction: 'debit',
                    type: 'balance_adjustment',
                    amount: numAmount,
                    balanceAfter: child.balance,
                    description: `Returned to SuperBookie "${parent.username}"${noteSuffix}`,
                    meta: { parentAdminId: String(parent._id), performedBy: String(actor?._id || '') },
                    session,
                });
                await recordBookieWalletTransaction({
                    adminId: parent._id,
                    direction: 'credit',
                    type: 'balance_adjustment',
                    amount: numAmount,
                    balanceAfter: parent.balance,
                    description: `Recovered from bookie "${child.username}"${noteSuffix}`,
                    meta: { childAdminId: String(child._id), performedBy: String(actor?._id || '') },
                    session,
                });
            }

            await parent.save({ session });
            await child.save({ session });

            childResult = {
                adminId: child._id,
                username: child.username,
                role: child.role,
                balance: child.balance,
                previousBalance: childBal,
                amount: numAmount,
                type,
                parentBalance: parent.balance,
            };
        });

        if (req && actor && childResult) {
            await logActivity({
                action: 'operator_wallet_adjust',
                performedBy: actor.username,
                performedByType: actor.role || 'bookie',
                targetType: 'super_bookie',
                targetId: String(childResult.adminId),
                details: `Wallet ${type} ₹${numAmount} for "${childResult.username}" (SuperBookie balance mirrored)`,
                meta: {
                    parentAdminId: String(parentAdminId),
                    amount: numAmount,
                    type,
                    parentBalance: childResult.parentBalance,
                },
                ip: getClientIp(req),
            });
        }

        await invalidateAdminReadCaches('operator_wallet_adjust');
        return childResult;
    } finally {
        await session.endSession();
    }
}

/**
 * Mirror SuperBookie wallet when funding / recovering player wallets.
 * Player credit => SuperBookie debit | Player debit => SuperBookie credit
 */
export async function mirrorSuperBookieWalletForPlayerAdjust({
    superBookieId,
    amount,
    type,
    playerUsername = '',
    actor = null,
    session = null,
}) {
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) return null;
    if (type !== 'credit' && type !== 'debit') return null;

    const parent = await Admin.findById(superBookieId).select('username role balance status').session(session);
    if (!parent || parent.role !== 'bookie' || parent.status !== 'active') {
        const err = new Error('SuperBookie account not found');
        err.status = 404;
        throw err;
    }

    const parentBal = round2(parent.balance || 0);
    const playerLabel = playerUsername ? `"${playerUsername}"` : 'player';

    if (type === 'credit') {
        if (parentBal < numAmount) {
            const err = new Error('Insufficient SuperBookie wallet balance');
            err.status = 400;
            throw err;
        }
        parent.balance = round2(parentBal - numAmount);
        await recordBookieWalletTransaction({
            adminId: parent._id,
            direction: 'debit',
            type: 'wallet_credit_player',
            amount: numAmount,
            balanceAfter: parent.balance,
            description: `Fund added to player ${playerLabel}`,
            meta: { performedBy: String(actor?._id || '') },
            session,
        });
    } else {
        parent.balance = round2(parentBal + numAmount);
        await recordBookieWalletTransaction({
            adminId: parent._id,
            direction: 'credit',
            type: 'wallet_debit_player',
            amount: numAmount,
            balanceAfter: parent.balance,
            description: `Fund recovered from player ${playerLabel}`,
            meta: { performedBy: String(actor?._id || '') },
            session,
        });
    }

    await parent.save(session ? { session } : undefined);
    return { balance: parent.balance, previousBalance: parentBal };
}

/**
 * Deduct operator wallet when a player withdrawal is approved.
 * Bookie (super_bookie) or SuperBookie (bookie) — whoever directly owns the player.
 */
export async function deductOperatorWalletForPlayerWithdrawal({
    operatorAdminId,
    amount,
    playerUsername = '',
    paymentId,
    actor = null,
    session = null,
}) {
    const numAmount = round2(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
        const err = new Error('Invalid withdrawal amount');
        err.status = 400;
        throw err;
    }

    const operator = await Admin.findById(operatorAdminId)
        .select('username role balance status')
        .session(session);
    if (!operator || !isBookiePanelRole(operator) || operator.status !== 'active') {
        const err = new Error('Operator wallet account not found');
        err.status = 404;
        throw err;
    }

    const currentBalance = round2(operator.balance || 0);
    if (currentBalance < numAmount) {
        const err = new Error(
            operator.role === 'super_bookie'
                ? 'Insufficient Bookie wallet balance'
                : 'Insufficient SuperBookie wallet balance',
        );
        err.status = 400;
        throw err;
    }

    operator.balance = round2(currentBalance - numAmount);
    const playerLabel = playerUsername ? `"${playerUsername}"` : 'player';
    await recordBookieWalletTransaction({
        adminId: operator._id,
        direction: 'debit',
        type: 'player_withdrawal',
        amount: numAmount,
        balanceAfter: operator.balance,
        description: `Player withdrawal approved — ${playerLabel}`,
        referenceId: String(paymentId || ''),
        meta: { performedBy: String(actor?._id || '') },
        session,
    });
    await operator.save(session ? { session } : undefined);

    return {
        adminId: operator._id,
        username: operator.username,
        role: operator.role,
        balance: operator.balance,
        previousBalance: currentBalance,
        amount: numAmount,
    };
}

export async function getOperatorWalletSummary(adminId, { limit = 20 } = {}) {
    const admin = await Admin.findById(adminId).select('username role balance status phone email').lean();
    if (!admin) {
        const err = new Error('Account not found');
        err.status = 404;
        throw err;
    }

    const txLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const transactions = await BookieWalletTransaction.find({ adminId })
        .sort({ createdAt: -1 })
        .limit(txLimit)
        .lean();

    return {
        ...admin,
        walletBalance: round2(admin.balance || 0),
        transactions,
    };
}
