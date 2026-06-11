import express from 'express';
import { bookieLogin, bookieHeartbeat, getReferralLink, getProfile, updateTheme } from '../../controllers/bookieController.js';
import {
    listSuperBookies,
    createSuperBookie,
    updateSuperBookie,
    toggleSuperBookieStatus,
    deleteSuperBookie,
    getSuperBookiePlayersForParent,
    getSuperBookieCommissionDashboardForParent,
} from '../../controllers/bookieSuperBookieController.js';
import { verifyAdmin, requireBookie } from '../../middleware/adminAuth.js';
const router = express.Router();

router.post('/login', bookieLogin);
router.post('/heartbeat', verifyAdmin, requireBookie, bookieHeartbeat);
router.get('/referral-link', verifyAdmin, requireBookie, getReferralLink);
router.get('/profile', verifyAdmin, requireBookie, getProfile);
router.patch('/theme', verifyAdmin, requireBookie, updateTheme);

router.get('/super-bookies', verifyAdmin, requireBookie, listSuperBookies);
router.get('/super-bookies/:id/players', verifyAdmin, requireBookie, getSuperBookiePlayersForParent);
router.get(
    '/super-bookies/:id/commission-dashboard',
    verifyAdmin,
    requireBookie,
    getSuperBookieCommissionDashboardForParent,
);
router.post('/super-bookies', verifyAdmin, requireBookie, createSuperBookie);
router.put('/super-bookies/:id', verifyAdmin, requireBookie, updateSuperBookie);
router.patch('/super-bookies/:id/toggle-status', verifyAdmin, requireBookie, toggleSuperBookieStatus);
router.delete('/super-bookies/:id', verifyAdmin, requireBookie, deleteSuperBookie);

export default router;
