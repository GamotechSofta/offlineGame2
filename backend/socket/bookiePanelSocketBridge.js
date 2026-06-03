import { noteSocketEmit } from '../services/traceMetricsService.js';

/** @type {import('socket.io').Server | null} */
let ioRef = null;

export function setBookiePanelSocketIo(io) {
    ioRef = io;
}

export function bookiePanelRoom(adminId) {
    return `bookie:panel:${String(adminId)}`;
}

/**
 * Push balance update to bookie / super bookie panel sockets.
 */
export function emitBookiePanelBalanceUpdate({ adminId, balance, role, reason }) {
    if (!ioRef || !adminId) return;
    const balanceNum = Number(balance);
    if (!Number.isFinite(balanceNum)) return;

    noteSocketEmit('bookie:balance:update');
    ioRef.to(bookiePanelRoom(adminId)).emit('bookie:balance:update', {
        adminId: String(adminId),
        balance: balanceNum,
        role: role || undefined,
        reason: reason || 'balance_change',
        ts: Date.now(),
    });
}

/** Live payment status for bookie / super-bookie payment screens. */
export function emitBookiePanelPaymentsUpdate({ adminIds, paymentId, status, adminRemarks, processedAt, reason }) {
    if (!ioRef || !paymentId || !status) return;
    const payload = {
        paymentId: String(paymentId),
        status: String(status),
        adminRemarks: adminRemarks ?? undefined,
        processedAt: processedAt ?? undefined,
        reason: reason || 'payment_updated',
        ts: Date.now(),
    };
    const ids = Array.isArray(adminIds) ? adminIds : [adminIds];
    ids.filter(Boolean).forEach((adminId) => {
        noteSocketEmit('bookie:payments:update');
        ioRef.to(bookiePanelRoom(adminId)).emit('bookie:payments:update', payload);
    });
}
