import Admin from '../models/admin/admin.js';
import { emitBookiePanelBalanceUpdate } from '../socket/bookiePanelSocketBridge.js';
import { getBookiePanelGrandTotal } from './bookiePanelGrandTotal.js';

/**
 * Notify connected bookie / super bookie panel of latest wallet balance.
 * @param {string|import('mongoose').Types.ObjectId} adminId
 * @param {string} [reason]
 * @param {number} [balanceOverride] skip DB read when caller already has fresh balance
 */
export async function notifyBookiePanelBalance(adminId, reason = 'balance_change', balanceOverride) {
    if (!adminId) return;
    const id = String(adminId);

    const row = await Admin.findById(id).select('balance role').lean();
    if (!row) return;

    let balanceNum = Number(balanceOverride ?? row.balance ?? 0);
    if (!Number.isFinite(balanceNum)) return;

    if (row.role === 'bookie' || row.role === 'super_bookie') {
        balanceNum = await getBookiePanelGrandTotal(id);
    } else if (balanceOverride === undefined || balanceOverride === null) {
        balanceNum = Number(row.balance || 0);
    }

    emitBookiePanelBalanceUpdate({
        adminId: id,
        balance: balanceNum,
        role: row.role,
        reason,
    });
}

export async function notifyBookiePanelBalances(adminIds, reason = 'balance_change') {
    const unique = [...new Set((adminIds || []).filter(Boolean).map(String))];
    await Promise.all(unique.map((id) => notifyBookiePanelBalance(id, reason)));
}
