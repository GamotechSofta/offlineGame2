import express from 'express';
import { placeBet, placeBetForPlayer, getBetHistory, getBetsByUser, getBetSessions, getTopWinners, downloadBetStatement, downloadMyBetStatement } from '../../controllers/betController.js';
import { verifyAdmin } from '../../middleware/adminAuth.js';
import { verifyUser } from '../../middleware/userAuth.js';

const router = express.Router();

// User-facing: place bets (player JWT required; userId from token)
router.post('/place', verifyUser, placeBet);

// Bookie: place bet on behalf of a player (requires bookie auth)
router.post('/place-for-player', verifyAdmin, placeBetForPlayer);

// Public: show top winners in user app menu
router.get('/public/top-winners', getTopWinners);

// Player-accessible: download own bet statement (player JWT required)
router.get('/my-statement', verifyUser, downloadMyBetStatement);
router.post('/my-statement', verifyUser, downloadMyBetStatement);

// Admin/Bookie routes
router.get('/history', verifyAdmin, getBetHistory);
router.get('/by-user', verifyAdmin, getBetsByUser);
router.get('/sessions', verifyAdmin, getBetSessions);
router.get('/top-winners', verifyAdmin, getTopWinners);
router.get('/download-statement', verifyAdmin, downloadBetStatement);

export default router;
