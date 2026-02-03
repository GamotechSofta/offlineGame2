import express from 'express';
import { placeBet, getBetHistory, getTopWinners } from '../../controllers/betController.js';
import { verifyAdmin } from '../../middleware/adminAuth.js';

const router = express.Router();

// User-facing: place bets (no admin auth; frontend sends userId from session)
router.post('/place', placeBet);

router.get('/history', verifyAdmin, getBetHistory);
router.get('/top-winners', verifyAdmin, getTopWinners);

export default router;
