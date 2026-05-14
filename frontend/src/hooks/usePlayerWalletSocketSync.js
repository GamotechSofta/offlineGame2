import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { getQuizSocketUrl } from '../config/api';
import { getCurrentUser } from '../session/userSession';
import { updateUserBalance } from '../api/bets';
import { attachPlayerWalletSocket } from '../lib/playerWalletSocket';

/**
 * Keeps player wallet in sync via Socket.IO (non-lottery routes: lottery pages use their own socket).
 */
export function usePlayerWalletSocketSync(enabled) {
  useEffect(() => {
    if (!enabled) return undefined;
    const socketUrl = getQuizSocketUrl();
    if (!socketUrl) return undefined;

    const socket = io(socketUrl, {
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
    });

    const detachWallet = attachPlayerWalletSocket(socket);

    const onWalletUpdate = (payload) => {
      const current = getCurrentUser() || {};
      const currentUserId = String(current?.id || current?._id || '').trim();
      const targetUserId = String(payload?.userId || '').trim();
      if (!currentUserId || !targetUserId || currentUserId !== targetUserId) return;
      const nextBalance = Number(payload?.balance);
      if (!Number.isFinite(nextBalance)) return;
      updateUserBalance(nextBalance);
    };

    socket.on('wallet:update', onWalletUpdate);

    return () => {
      detachWallet();
      socket.off('wallet:update', onWalletUpdate);
      socket.disconnect();
    };
  }, [enabled]);
}
