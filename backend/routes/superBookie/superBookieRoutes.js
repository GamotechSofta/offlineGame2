import express from 'express';
import {
    superBookieLogin,
    superBookieHeartbeat,
    getSuperBookieProfile,
    getSuperBookieReferralLink,
} from '../../controllers/superBookieController.js';
import { verifyAdmin, requireSuperBookie } from '../../middleware/adminAuth.js';

const router = express.Router();

router.post('/login', superBookieLogin);
router.post('/heartbeat', verifyAdmin, requireSuperBookie, superBookieHeartbeat);
router.get('/profile', verifyAdmin, requireSuperBookie, getSuperBookieProfile);
router.get('/referral-link', verifyAdmin, requireSuperBookie, getSuperBookieReferralLink);
export default router;
