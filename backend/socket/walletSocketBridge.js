import { noteSocketEmit } from '../services/traceMetricsService.js';

/** @type {import('socket.io').Server | null} */
let ioRef = null;

export const PLAYER_WALLET_ROOM_PREFIX = 'player:wallet:';

export function playerWalletRoom(userId) {
  return `${PLAYER_WALLET_ROOM_PREFIX}${String(userId || '').trim()}`;
}

export function setWalletSocketIo(io) {
  ioRef = io;
}

export function getWalletSocketIo() {
  return ioRef;
}

/**
 * Push latest balance to sockets in this player's room (see wallet:subscribe).
 */
export function emitUserWalletUpdate(payload = {}) {
  if (!ioRef) return;
  const userId = String(payload?.userId || '').trim();
  if (!userId) return;
  const balanceNum = Number(payload?.balance);
  if (!Number.isFinite(balanceNum)) return;
  noteSocketEmit('wallet:update');
  ioRef.to(playerWalletRoom(userId)).emit('wallet:update', {
    ts: Date.now(),
    userId,
    balance: balanceNum,
    reason: payload?.reason || 'wallet_updated',
  });
}
