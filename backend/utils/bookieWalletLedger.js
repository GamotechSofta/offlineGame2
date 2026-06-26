import BookieWalletTransaction from '../models/bookieWalletTransaction/bookieWalletTransaction.js';
import { isBookiePanelRole } from './adminRoles.js';

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

export async function recordBookieWalletTransaction({
    adminId,
    direction,
    type,
    amount,
    balanceAfter,
    description = '',
    referenceId = '',
    meta = null,
    session = null,
}) {
    if (!adminId || !direction || !type) return null;
    const amt = round2(amount);
    if (!Number.isFinite(amt) || amt < 0) return null;
    const doc = {
        adminId,
        direction,
        type,
        amount: amt,
        balanceAfter: round2(balanceAfter),
        description: String(description || ''),
        referenceId: String(referenceId || ''),
        meta: meta ?? null,
    };
    if (session) {
        const [created] = await BookieWalletTransaction.create([doc], { session });
        return created;
    }
    return BookieWalletTransaction.create(doc);
}

export async function recordBookieWalletTxIfPanel(admin, payload) {
    if (!admin || !isBookiePanelRole(admin)) return null;
    return recordBookieWalletTransaction({
        adminId: admin._id,
        ...payload,
    });
}

export const BOOKIE_WALLET_TX_LABELS = {
    advance_commission_from_admin: 'Advance / balance from super admin',
    initial_balance: 'Initial balance (from bookie)',
    advance_received: 'Advance / balance received',
    advance_commission: 'Advance commission (from bookie)',
    commission_settlement: 'Commission settlement (legacy)',
    commission_settlement_advance: 'Commission settled (paid with advance)',
    commission_settlement_other: 'Commission paid to SuperBookie (paid with other)',
    commission_received_from_super: 'Commission received from bookie (paid with other)',
    balance_adjustment: 'Balance adjustment',
    player_deposit: 'Player add fund (approved — added to balance)',
    player_withdrawal: 'Player withdrawal (approved — deducted from balance)',
    wallet_credit_player: 'Fund added to player',
    wallet_debit_player: 'Fund taken from player',
    player_initial_balance: 'Initial balance to player',
    bet_placed: 'Bet placed',
    bet_win: 'Bet winnings',
    initial_balance_allocated: 'Initial balance allocated to super bookie',
    advance_paid_initial: 'Initial balance (advance paid — from bookie)',
    advance_paid_initial_allocated: 'Advance paid initial balance allocated to super bookie',
    after_paid_initial: 'Initial balance (legacy — from bookie)',
    after_paid_initial_allocated: 'Initial balance allocated to super bookie (legacy)',
};

export function getBookieWalletTxLabel(type) {
    return BOOKIE_WALLET_TX_LABELS[type] || type || 'Transaction';
}

/** Credits from admin to parent bookie (superbookie panel) */
export const FROM_ADMIN_TX_TYPES = [
    'initial_balance',
    'advance_received',
    'advance_commission_from_admin',
];

/** Shown in "from bookie" tab list */
export const FROM_BOOKIE_TX_TYPES = [
    'initial_balance',
    'advance_received',
    'advance_commission',
    'after_paid_initial',
    'commission_settlement',
    'commission_settlement_advance',
    'commission_settlement_other',
    'commission_received_from_super',
    'balance_adjustment',
];

/** Subtracted from grand total (bookie + players) when commission is settled */
export const FROM_BOOKIE_COMMISSION_SETTLEMENT_TYPES = ['commission_settlement'];

/** Super bookie: debits that reduce Advance paid pool (paid with advance only) */
export const COMMISSION_SETTLEMENT_ADVANCE_DEBIT_TYPES = [
    'commission_settlement_advance',
    'commission_settlement',
];

/** Child bookie: commission paid to parent (paid with other) — reduces wallet / grand total, not Advance paid */
export const COMMISSION_SETTLEMENT_OTHER_DEBIT_TYPES = ['commission_settlement_other'];

/** Parent bookie: commission collected from super bookie wallet (paid with other) */
export const COMMISSION_RECEIVED_FROM_SUPER_TYPES = ['commission_received_from_super'];

/** Counted in advance commission / bookie summary — credits only */
export const FROM_BOOKIE_SUMMARY_TYPES = ['initial_balance', 'advance_received', 'advance_commission'];

/** Adds to super bookie balance / grand total — no advance commission recovery */
export const FROM_BOOKIE_ADVANCE_PAID_INITIAL_TYPES = ['advance_paid_initial', 'after_paid_initial'];

/** Wallet credits for "Advance paid" display (initial balance payment type: advance paid) */
export const ADVANCE_PAID_INITIAL_WALLET_TYPES = FROM_BOOKIE_ADVANCE_PAID_INITIAL_TYPES;

/** @deprecated Use FROM_BOOKIE_ADVANCE_PAID_INITIAL_TYPES */
export const FROM_BOOKIE_AFTER_PAID_TYPES = FROM_BOOKIE_ADVANCE_PAID_INITIAL_TYPES;

/** Parent bookie debits when allocating to super bookie */
export const FROM_BOOKIE_ADVANCE_ALLOCATION_DEBIT_TYPES = [
    'initial_balance_allocated',
    'advance_paid_initial_allocated',
    'after_paid_initial_allocated',
    'balance_adjustment',
];

/** Player-related balance changes (add fund, wallet ops, etc.) */
export const FROM_PLAYER_TX_TYPES = [
    'player_deposit',
    'player_withdrawal',
    'wallet_credit_player',
    'wallet_debit_player',
    'player_initial_balance',
];

/** Counted in "Total from players (add fund)" summary — credits only */
export const FROM_PLAYER_SUMMARY_TYPES = ['player_deposit', 'player_initial_balance'];

/** Subtracted in player & grand total summaries */
export const FROM_PLAYER_WITHDRAWAL_SUMMARY_TYPES = ['player_withdrawal'];

export function getBookieWalletTxCategory(type) {
    if (FROM_BOOKIE_TX_TYPES.includes(type)) return 'from_bookie';
    if (FROM_PLAYER_TX_TYPES.includes(type)) return 'from_player';
    return 'other';
}

/** Parent bookie: credit from admin (excludes payouts to super bookies). */
export function isFromAdminWalletTx(tx) {
    if (!tx || tx.direction !== 'credit') return false;
    if (FROM_ADMIN_TX_TYPES.includes(tx.type)) return true;
    if (tx.type === 'balance_adjustment') {
        const desc = String(tx.description || '').toLowerCase();
        return !/super bookie|advance commission to|commission settlement to/i.test(desc);
    }
    return false;
}

/** Change to grand total (bookie + players) for one ledger line. */
export function getGrandTotalDelta(tx) {
    const amt = Number(tx?.amount || 0);
    if (!Number.isFinite(amt) || amt <= 0) return 0;
    const type = tx.type;
    const direction = tx.direction;
    const description = String(tx.description || '');

    if (FROM_BOOKIE_COMMISSION_SETTLEMENT_TYPES.includes(type)) {
        return -amt;
    }
    if (COMMISSION_RECEIVED_FROM_SUPER_TYPES.includes(type) && direction === 'credit') {
        return amt;
    }
    if (type === 'commission_settlement_other' && direction === 'debit') {
        return -amt;
    }
    if (type === 'balance_adjustment' && direction === 'debit' && /commission settlement/i.test(description)) {
        return -amt;
    }
    if (FROM_BOOKIE_SUMMARY_TYPES.includes(type) && direction === 'credit') {
        return amt;
    }
    if (FROM_BOOKIE_ADVANCE_PAID_INITIAL_TYPES.includes(type) && direction === 'credit') {
        return amt;
    }
    if (
        (type === 'after_paid_initial_allocated' || type === 'advance_paid_initial_allocated')
        && direction === 'debit'
    ) {
        return 0;
    }
    if (type === 'initial_balance_allocated' && direction === 'debit') {
        return 0;
    }
    if (FROM_PLAYER_SUMMARY_TYPES.includes(type) && direction === 'credit') {
        return amt;
    }
    if (FROM_PLAYER_WITHDRAWAL_SUMMARY_TYPES.includes(type)) {
        return direction === 'debit' ? -amt : amt;
    }
    if (type === 'wallet_credit_player' && direction === 'debit') {
        return amt;
    }
    if (type === 'wallet_debit_player' && direction === 'credit') {
        return -amt;
    }
    return 0;
}

/** Running grand total after each tx (ascending by time). */
export function buildGrandTotalAfterByTxId(transactionsAsc, openingGap = 0) {
    let running = Math.round((Number(openingGap) || 0) * 100) / 100;
    const map = new Map();
    for (const tx of transactionsAsc) {
        running += getGrandTotalDelta(tx);
        running = Math.round(running * 100) / 100;
        map.set(String(tx._id), running);
    }
    return map;
}
