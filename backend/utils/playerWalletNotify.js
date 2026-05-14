import mongoose from 'mongoose';
import { Wallet } from '../models/wallet/wallet.js';
import { emitUserWalletUpdate } from '../socket/walletSocketBridge.js';

/**
 * Re-read wallet from DB and emit realtime balance to the player's subscribed socket(s).
 */
export async function notifyPlayerWalletBalance(userId, reason = 'wallet_updated') {
  if (userId == null) return;
  const uid =
    typeof userId === 'string'
      ? userId.trim()
      : typeof userId?.toString === 'function'
        ? String(userId)
        : '';
  if (!uid || !mongoose.Types.ObjectId.isValid(uid)) return;
  const w = await Wallet.findOne({ userId: uid }).select('balance').lean();
  const balance = Number(w?.balance ?? 0);
  if (!Number.isFinite(balance)) return;
  emitUserWalletUpdate({ userId: uid, balance, reason });
}
