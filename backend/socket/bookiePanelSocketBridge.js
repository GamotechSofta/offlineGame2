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
