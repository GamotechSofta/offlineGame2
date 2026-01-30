import express from 'express';
import { getAllWallets, getTransactions, adjustBalance } from '../../controllers/walletController.js';
import { verifyAdmin } from '../../middleware/adminAuth.js';

const router = express.Router();

router.get('/all', verifyAdmin, getAllWallets);
router.get('/transactions', verifyAdmin, getTransactions);
router.post('/adjust', verifyAdmin, adjustBalance);

export default router;
