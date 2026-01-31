import express from 'express';
import { adminLogin, createAdmin, createBookie } from '../../controllers/adminController.js';
import { verifyAdmin } from '../../middleware/adminAuth.js';

const router = express.Router();

router.post('/login', adminLogin);
router.post('/create', createAdmin); // For initial admin setup
router.post('/create-bookie', verifyAdmin, createBookie); // Super admin creates bookie for bookie panel

export default router;
