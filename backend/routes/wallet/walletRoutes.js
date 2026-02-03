import express from 'express';
import { getAllWallets, getTransactions, adjustBalance, setBalance, getBalance } from '../../controllers/walletController.js';
import { verifyAdmin } from '../../middleware/adminAuth.js';

const router = express.Router();

// Admin: list wallets, transactions, adjust (credit/debit), set balance
router.get('/all', verifyAdmin, getAllWallets);
router.get('/transactions', verifyAdmin, getTransactions);
router.post('/adjust', verifyAdmin, adjustBalance);
router.put('/set-balance', verifyAdmin, setBalance);

// User: get own balance (client sends userId; no auth token)
router.get('/balance', getBalance);
router.post('/balance', getBalance);

export default router;
