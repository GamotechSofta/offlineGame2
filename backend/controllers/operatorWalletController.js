import Admin from '../models/admin/admin.js';
import { canAccessBookieManagement } from '../utils/adminTabAccess.js';
import { adjustChildWalletWithParentMirror, adjustOperatorWallet, getOperatorWalletSummary } from '../utils/operatorWalletService.js';
import { getBookieWalletTxLabel } from '../utils/bookieWalletLedger.js';
import { listMyBookieWalletTransactions } from './bookieWalletTransactionController.js';

const assertParentBookie = (req, res) => {
    if (req.admin?.role !== 'bookie') {
        res.status(403).json({ success: false, message: 'SuperBookie access required' });
        return false;
    }
    return true;
};

const handleServiceError = (res, error) => {
    const status = error.status || 500;
    return res.status(status).json({ success: false, message: error.message });
};

/**
 * Admin: get SuperBookie (bookie role) wallet + recent transactions.
 * GET /api/v1/admin/bookies/:id/wallet
 */
export const getAdminBookieWallet = async (req, res) => {
    try {
        if (!canAccessBookieManagement(req.admin)) {
            return res.status(403).json({ success: false, message: 'You do not have access to bookie wallets' });
        }
        if (req.admin?.role !== 'super_admin') {
            return res.status(403).json({ success: false, message: 'Only Super Admin can manage operator wallets' });
        }

        const bookie = await Admin.findOne({ _id: req.params.id, role: 'bookie' }).select('_id').lean();
        if (!bookie) {
            return res.status(404).json({ success: false, message: 'SuperBookie account not found' });
        }

        const data = await getOperatorWalletSummary(bookie._id, { limit: req.query.limit });
        const transactions = (data.transactions || []).map((row) => ({
            ...row,
            label: getBookieWalletTxLabel(row.type),
        }));

        return res.status(200).json({
            success: true,
            data: {
                ...data,
                balance: data.walletBalance,
                transactions,
            },
        });
    } catch (error) {
        return handleServiceError(res, error);
    }
};

/**
 * Admin: credit/debit SuperBookie wallet.
 * POST /api/v1/admin/bookies/:id/wallet/adjust
 */
export const adjustAdminBookieWallet = async (req, res) => {
    try {
        if (!canAccessBookieManagement(req.admin)) {
            return res.status(403).json({ success: false, message: 'You do not have access to bookie wallets' });
        }
        if (req.admin?.role !== 'super_admin') {
            return res.status(403).json({ success: false, message: 'Only Super Admin can manage operator wallets' });
        }

        const { amount, type, note } = req.body || {};
        const bookie = await Admin.findOne({ _id: req.params.id, role: 'bookie' }).select('_id username').lean();
        if (!bookie) {
            return res.status(404).json({ success: false, message: 'SuperBookie account not found' });
        }

        const txType = type === 'credit' ? 'advance_commission_from_admin' : 'balance_adjustment';
        const description = note?.trim()
            ? `Admin ${type}: ₹${Number(amount)} — ${note.trim()}`
            : undefined;

        const result = await adjustOperatorWallet({
            targetAdminId: bookie._id,
            amount,
            type,
            actor: req.admin,
            description,
            txType,
            req,
        });

        return res.status(200).json({
            success: true,
            message: `₹${result.amount} ${type === 'credit' ? 'added to' : 'deducted from'} ${bookie.username}'s wallet`,
            data: result,
        });
    } catch (error) {
        return handleServiceError(res, error);
    }
};

/**
 * SuperBookie: get child Bookie wallet.
 * GET /api/v1/bookie/super-bookies/:id/wallet
 */
export const getSuperBookieChildWallet = async (req, res) => {
    try {
        if (!assertParentBookie(req, res)) return;

        const child = await Admin.findOne({
            _id: req.params.id,
            role: 'super_bookie',
            parentBookieId: req.admin._id,
        }).select('_id').lean();
        if (!child) {
            return res.status(404).json({ success: false, message: 'Bookie account not found' });
        }

        const data = await getOperatorWalletSummary(child._id, { limit: req.query.limit });
        const transactions = (data.transactions || []).map((row) => ({
            ...row,
            label: getBookieWalletTxLabel(row.type),
        }));

        return res.status(200).json({
            success: true,
            data: {
                ...data,
                balance: data.walletBalance,
                transactions,
            },
        });
    } catch (error) {
        return handleServiceError(res, error);
    }
};

/**
 * SuperBookie: credit/debit child Bookie wallet.
 * POST /api/v1/bookie/super-bookies/:id/wallet/adjust
 */
export const adjustSuperBookieChildWallet = async (req, res) => {
    try {
        if (!assertParentBookie(req, res)) return;

        const { amount, type, note } = req.body || {};
        const child = await Admin.findOne({
            _id: req.params.id,
            role: 'super_bookie',
            parentBookieId: req.admin._id,
        }).select('_id username').lean();
        if (!child) {
            return res.status(404).json({ success: false, message: 'Bookie account not found' });
        }

        const result = await adjustChildWalletWithParentMirror({
            parentAdminId: req.admin._id,
            childAdminId: child._id,
            amount,
            type,
            actor: req.admin,
            req,
            note,
        });

        return res.status(200).json({
            success: true,
            message: `₹${result.amount} ${type === 'credit' ? 'added to' : 'deducted from'} ${child.username}'s wallet`,
            data: result,
        });
    } catch (error) {
        return handleServiceError(res, error);
    }
};

export { listMyBookieWalletTransactions };
