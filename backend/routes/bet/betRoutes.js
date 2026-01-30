import express from 'express';
import { getBetHistory, getTopWinners } from '../../controllers/betController.js';
import { verifyAdmin } from '../../middleware/adminAuth.js';

const router = express.Router();

router.get('/history', verifyAdmin, getBetHistory);
router.get('/top-winners', verifyAdmin, getTopWinners);

export default router;
