import express from 'express';
import { createUser, userLogin, userSignup } from '../../controllers/userController.js';
import { verifyAdmin } from '../../middleware/adminAuth.js';

const router = express.Router();

// Public routes
router.post('/login', userLogin);
router.post('/signup', userSignup);

// Admin only routes
router.post('/create', verifyAdmin, createUser);

export default router;
