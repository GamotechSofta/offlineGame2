import express from 'express';
import { placeBet, placeBetForPlayer, getBetHistory, getTopWinners, downloadBetStatement, downloadMyBetStatement } from '../../controllers/betController.js';
import { verifyAdmin } from '../../middleware/adminAuth.js';

const router = express.Router();

// User-facing: place bets (no admin auth; frontend sends userId from session)
router.post('/place', placeBet);

// Bookie: place bet on behalf of a player (requires bookie auth)
router.post('/place-for-player', verifyAdmin, placeBetForPlayer);

// Public: show top winners in user app menu
router.get('/public/top-winners', getTopWinners);

// Player-accessible: download own bet statement (bets placed by bookie)
router.get('/my-statement', downloadMyBetStatement);
router.post('/my-statement', downloadMyBetStatement);

// Admin/Bookie routes
router.get('/history', verifyAdmin, getBetHistory);
router.get('/top-winners', verifyAdmin, getTopWinners);
router.get('/download-statement', verifyAdmin, downloadBetStatement);

export default router;
