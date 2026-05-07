import express from 'express';
import rateLimit from 'express-rate-limit';
import {
    createUser,
    userLogin,
    userSignup,
    userHeartbeat,
    userLogout,
    logoutDeviceForSingleLogin,
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

const getLoginIdentifier = (req) => {
    const body = req?.body || {};
    const phone = body.phone != null ? String(body.phone).replace(/\D/g, '').slice(0, 10) : '';
    if (phone) return `phone:${phone}`;
    const username = body.username != null ? String(body.username).trim().toLowerCase() : '';
    if (username) return `username:${username}`;
    return '';
};

const userLoginLimiter = rateLimit({
    windowMs: 30 * 60 * 1000, // 30 minutes
    max: 3, // 3 failed attempts in window
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // only failed logins consume attempts
    keyGenerator: (req) => {
        const identifier = getLoginIdentifier(req);
        if (identifier) return identifier;
        return String(req.ip || 'unknown-ip');
    },
    message: {
        success: false,
        message: 'Too many failed login attempts. Please try again after 30 minutes.',
    },
});

const userSignupLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many sign-up attempts from this network. Please try again later.',
    },
});

// Public routes
router.post('/login', userLoginLimiter, userLogin);
router.post('/logout-device', userLoginLimiter, logoutDeviceForSingleLogin);
router.post('/signup', userSignupLimiter, userSignup);
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
