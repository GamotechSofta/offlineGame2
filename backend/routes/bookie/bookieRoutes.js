import express from 'express';
import { bookieLogin, bookieHeartbeat, getReferralLink } from '../../controllers/bookieController.js';
import { verifyAdmin, requireBookie } from '../../middleware/adminAuth.js';

const router = express.Router();

router.post('/login', bookieLogin);
router.post('/heartbeat', verifyAdmin, requireBookie, bookieHeartbeat);
router.get('/referral-link', verifyAdmin, requireBookie, getReferralLink);

export default router;
