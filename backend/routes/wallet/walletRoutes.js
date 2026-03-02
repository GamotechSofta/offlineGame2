import express from 'express';
import { getAllWallets, getTransactions, getMyTransactions, adjustBalance, setBalance, getBalance } from '../../controllers/walletController.js';
import { verifyAdmin } from '../../middleware/adminAuth.js';
import { verifyUser } from '../../middleware/userAuth.js';

const router = express.Router();

// Admin: list wallets, transactions, adjust (credit/debit), set balance
router.get('/all', verifyAdmin, getAllWallets);
router.get('/transactions', verifyAdmin, getTransactions);
router.post('/adjust', verifyAdmin, adjustBalance);
router.put('/set-balance', verifyAdmin, setBalance);

// User: get own balance (player JWT required; userId from token)
router.get('/balance', verifyUser, getBalance);
router.post('/balance', verifyUser, getBalance);

// User: get own wallet transactions (player JWT required)
router.get('/my-transactions', verifyUser, getMyTransactions);
router.post('/my-transactions', verifyUser, getMyTransactions);

export default router;
