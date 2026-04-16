import express from 'express';
import {
    createUser,
    userLogin,
    userSignup,
    userHeartbeat,
    userLogout,
    getMyProfile,
    getMyBalance,
    getMyUsername,
    getMyPhone,
    getMyCredit,
    getMyDebit,
    getUsers,
    getSingleUser,
    togglePlayerStatus,
    deletePlayer,
    clearLoginDevices,
    updatePlayerToGiveToTake,
    updatePlayerPassword
} from '../../controllers/userController.js';
import { verifyAdmin, verifySuperAdmin } from '../../middleware/adminAuth.js';
import { verifyUser } from '../../middleware/userAuth.js';

const router = express.Router();

// Public routes
router.post('/login', userLogin);
router.post('/signup', userSignup);
router.post('/logout', userLogout);

// Player auth required
router.post('/heartbeat', verifyUser, userHeartbeat);
router.get('/me', verifyUser, getMyProfile);
router.get('/me/balance', verifyUser, getMyBalance);
router.get('/me/username', verifyUser, getMyUsername);
router.get('/me/phone', verifyUser, getMyPhone);
router.get('/me/credit', verifyUser, getMyCredit);
router.get('/me/debit', verifyUser, getMyDebit);

// Admin/Bookie routes
router.get('/', verifyAdmin, getUsers);
router.get('/:id', verifyAdmin, getSingleUser);
router.post('/create', verifyAdmin, createUser);
router.patch('/:id/toggle-status', verifySuperAdmin, togglePlayerStatus);
router.delete('/:id', verifySuperAdmin, deletePlayer);
router.patch('/:id/clear-devices', verifyAdmin, clearLoginDevices);
router.patch('/:id/to-give-take', verifyAdmin, updatePlayerToGiveToTake);
router.patch('/:id/password', verifyAdmin, updatePlayerPassword);

export default router;
