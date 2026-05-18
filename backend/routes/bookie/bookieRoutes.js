import express from 'express';
import { bookieLogin, bookieHeartbeat, getReferralLink, getProfile, updateTheme } from '../../controllers/bookieController.js';
import {
    listSuperBookies,
    createSuperBookie,
    updateSuperBookie,
    toggleSuperBookieStatus,
    adjustSuperBookieBalance,
    deleteSuperBookie,
} from '../../controllers/bookieSuperBookieController.js';
import { verifyAdmin, requireBookie } from '../../middleware/adminAuth.js';

const router = express.Router();

router.post('/login', bookieLogin);
router.post('/heartbeat', verifyAdmin, requireBookie, bookieHeartbeat);
router.get('/referral-link', verifyAdmin, requireBookie, getReferralLink);
router.get('/profile', verifyAdmin, requireBookie, getProfile);
router.patch('/theme', verifyAdmin, requireBookie, updateTheme);

router.get('/super-bookies', verifyAdmin, requireBookie, listSuperBookies);
router.post('/super-bookies', verifyAdmin, requireBookie, createSuperBookie);
router.put('/super-bookies/:id', verifyAdmin, requireBookie, updateSuperBookie);
router.patch('/super-bookies/:id/toggle-status', verifyAdmin, requireBookie, toggleSuperBookieStatus);
router.patch('/super-bookies/:id/balance', verifyAdmin, requireBookie, adjustSuperBookieBalance);
router.delete('/super-bookies/:id', verifyAdmin, requireBookie, deleteSuperBookie);

export default router;
