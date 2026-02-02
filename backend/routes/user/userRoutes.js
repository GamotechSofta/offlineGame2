import express from 'express';
import { createUser, userLogin, userSignup, userHeartbeat, getUsers, getSingleUser, togglePlayerStatus, deletePlayer } from '../../controllers/userController.js';
import { verifyAdmin, verifySuperAdmin } from '../../middleware/adminAuth.js';

const router = express.Router();

// Public routes
router.post('/login', userLogin);
router.post('/signup', userSignup);
router.post('/heartbeat', userHeartbeat);

// Admin/Bookie routes
router.get('/', verifyAdmin, getUsers);
router.get('/:id', verifyAdmin, getSingleUser);
router.post('/create', verifyAdmin, createUser);
router.patch('/:id/toggle-status', verifySuperAdmin, togglePlayerStatus);
router.delete('/:id', verifySuperAdmin, deletePlayer);

export default router;
