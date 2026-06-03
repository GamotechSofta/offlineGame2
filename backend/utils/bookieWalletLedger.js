import BookieWalletTransaction from '../models/bookieWalletTransaction/bookieWalletTransaction.js';
import { isBookiePanelRole } from './adminRoles.js';

/**
 * Record a ledger line for bookie / super_bookie wallet balance changes.
 * @param {import('mongoose').Types.ObjectId|string} adminId
 * @param {object} payload
 */
export async function recordBookieWalletTransaction({
    adminId,
    direction,
    type,
    amount,
    balanceAfter,
    description = '',
    referenceId = '',
    meta = null,
}) {
    if (!adminId) return null;
    const amt = Number(amount);
    const bal = Number(balanceAfter);
    if (!Number.isFinite(amt) || amt < 0 || !Number.isFinite(bal) || bal < 0) return null;
    if (direction !== 'credit' && direction !== 'debit') return null;
    if (!type) return null;

    try {
        return await BookieWalletTransaction.create({
            adminId,
            direction,
            type: String(type),
            amount: amt,
            balanceAfter: bal,
            description: String(description || '').slice(0, 500),
            referenceId: referenceId ? String(referenceId) : '',
            meta,
        });
    } catch (err) {
        console.error('[BookieWalletLedger] Failed to record:', err.message);
        return null;
    }
}

export async function recordBookieWalletTxIfPanel(admin, payload) {
    if (!admin || !isBookiePanelRole(admin)) return null;
    return recordBookieWalletTransaction({
        adminId: admin._id,
        ...payload,
    });
}

export const BOOKIE_WALLET_TX_LABELS = {
    initial_balance: 'Initial balance (from bookie)',
    advance_received: 'Advance / balance received',
    balance_adjustment: 'Balance adjustment',
    player_deposit: 'Player add fund (approved — added to balance)',
    player_withdrawal: 'Player withdrawal (approved — deducted from balance)',
    wallet_credit_player: 'Fund added to player',
    wallet_debit_player: 'Fund taken from player',
    player_initial_balance: 'Initial balance to player',
    bet_placed: 'Bet placed',
    bet_win: 'Bet winnings',
    initial_balance_allocated: 'Initial balance allocated to super bookie',
};

export function getBookieWalletTxLabel(type) {
    return BOOKIE_WALLET_TX_LABELS[type] || type || 'Transaction';
}

/** Shown in "from bookie" tab list */
export const FROM_BOOKIE_TX_TYPES = ['initial_balance', 'advance_received', 'balance_adjustment'];

/** Counted in "Total from bookie (initial + advance)" summary — credits only */
export const FROM_BOOKIE_SUMMARY_TYPES = ['initial_balance', 'advance_received'];

/** Player-related balance changes (add fund, wallet ops, etc.) */
export const FROM_PLAYER_TX_TYPES = [
    'player_deposit',
    'player_withdrawal',
    'wallet_credit_player',
    'wallet_debit_player',
    'player_initial_balance',
];

/** Counted in "Total from players (add fund)" summary — credits only */
export const FROM_PLAYER_SUMMARY_TYPES = ['player_deposit'];

/** Subtracted in player & grand total summaries */
export const FROM_PLAYER_WITHDRAWAL_SUMMARY_TYPES = ['player_withdrawal'];

export function getBookieWalletTxCategory(type) {
    if (FROM_BOOKIE_TX_TYPES.includes(type)) return 'from_bookie';
    if (FROM_PLAYER_TX_TYPES.includes(type)) return 'from_player';
    return 'other';
}
