import express from 'express';
import { bookieLogin, bookieHeartbeat, getReferralLink, getProfile, updateTheme } from '../../controllers/bookieController.js';
import { verifyAdmin, requireBookie } from '../../middleware/adminAuth.js';

const router = express.Router();

router.post('/login', bookieLogin);
router.post('/heartbeat', verifyAdmin, requireBookie, bookieHeartbeat);
router.get('/referral-link', verifyAdmin, requireBookie, getReferralLink);
router.get('/profile', verifyAdmin, requireBookie, getProfile);
router.patch('/theme', verifyAdmin, requireBookie, updateTheme);

export default router;
